import os, pytest
from fastapi.testclient import TestClient
from lapfit import ingest

@pytest.fixture(scope="module")
def client(tmp_path_factory):
    p = tmp_path_factory.mktemp("api") / "api.db"
    ingest.build(p, embed=True)
    os.environ["LAPFIT_DB"] = str(p)
    import importlib, lapfit.config as cfg
    importlib.reload(cfg)
    import lapfit.db, lapfit.api as api
    importlib.reload(lapfit.db); importlib.reload(api)
    with TestClient(api.app) as c:
        yield c

PROFILE = {"workloads": {"programming": "daily", "college_research": "daily"}, "hard_requirements": {"budget_inr_max": 60000, "ram_gb_min": 16, "weight_kg_max": 1.7, "battery_h_min": 6},
           "priorities": ["memory", "keyboard_trackpad", "battery"]}

def test_health_and_ready(client):
    assert client.get("/api/v1/health").json()["status"] == "ok"
    r = client.get("/api/v1/ready").json()
    assert r["db"] and r["embeddings"] and "live_search_configured" in r

def test_catalogue(client):
    d = client.get("/api/v1/laptops").json()
    assert len(d["items"]) == 14 and d["request_id"] and all(i["variant_confidence"] == "exact_listing" for i in d["items"])

def test_search_exact_model_and_alias(client):
    r = client.get("/api/v1/search", params={"q": "IdeaPad 3 15ALC6"}).json()
    assert r["intent"] in ("laptop", "ambiguous") and any(m["variant_id"] == "FKL-11" for m in r["matches"])
    r2 = client.get("/api/v1/search", params={"q": "MGN93HN/A macbook air m1"}).json()
    assert r2["matches"][0]["variant_id"] == "FKL-10"

def test_search_precision_cases(client):
    def top(q): 
        r = client.get("/api/v1/search", params={"q": q}).json(); return r["intent"], [m["variant_id"] for m in r["matches"]]
    assert top("TUF Gaming F15") == ("laptop", ["FKL-05"])            # not the TUF A17
    assert top("macbook air m1") == ("laptop", ["FKL-10"])
    assert top("vivobook 15 x515ja")[1][:1] == ["FKL-09"]
    assert top("hp pavilion")[0] == "ambiguous"                         # several Pavilion listings
    assert top("ThinkPad X1 Carbon")[0] == "laptop" and top("ThinkPad X1 Carbon")[1] == []   # unknown model, not forced onto a wrong laptop

def test_search_unknown_laptop_offers_research_honestly(client, monkeypatch):
    import lapfit.api as api
    monkeypatch.setattr(api, "make_provider", lambda: None)          # independent of any real key
    r = client.get("/api/v1/search", params={"q": "Dell Inspiron 15 3520 i5 16GB"}).json()
    assert r["intent"] == "laptop" and r["matches"] == [] and r["research_offer"] is not None
    assert r["research_offer"]["available"] is False and r["research_offer"]["unavailable_reason"]   # no key in test env

def test_search_out_of_scope_and_validation(client):
    assert client.get("/api/v1/search", params={"q": "what is the capital of france"}).json()["intent"] == "out_of_scope"
    e = client.get("/api/v1/search", params={"q": ""})
    assert e.status_code == 422 and e.json()["error"]["code"] == "validation_error"

def test_fit_analysis_gate_and_honest_partial(client):
    d = client.post("/api/v1/fit-analysis", json={"variant_id": "FKL-11", "profile": PROFILE}).json()
    g = {r["requirement"]: r["status"] for r in d["gate"]}
    assert g["ram_gb_min"] == "spec_mismatch" and g["budget_inr_max"] == "met" and g["weight_kg_max"] == "met" and g["battery_h_min"] == "unknown"
    assert d["status"] == "partial" and d["owner_analysis"]["state"] == "not_run" and d["warnings"]     # nothing analysed -> says so
    assert d["dealbreakers"] == [] and d["gaps"]                                                       # absence is a gap, never "no problems"
    assert d["ratings"]["score_visible"] is False
    assert d["ratings"]["categories"]["memory"]["label"] == "weak" and d["ratings"]["categories"]["portability"]["label"] == "strong"

def test_sibling_evidence_in_separate_lane(client):
    d = client.post("/api/v1/fit-analysis", json={"variant_id": "FKL-11", "profile": PROFILE}).json()
    lanes = d["independent_tests_and_specs"]["lanes"]
    assert lanes["lab_exact"] == [] and len(lanes["lab_sibling"]) == 4
    m = client.post("/api/v1/fit-analysis", json={"variant_id": "FKL-10", "profile": PROFILE}).json()["independent_tests_and_specs"]["lanes"]
    assert len(m["lab_exact"]) == 3 and len(m["manufacturer_claims"]) == 2          # Notebookcheck x3 exact_family, Apple claims x2

def test_fit_validation_errors(client):
    assert client.post("/api/v1/fit-analysis", json={"variant_id": "NOPE", "profile": PROFILE}).status_code == 404
    bad = dict(PROFILE, workloads={"astrology": "daily"})
    assert client.post("/api/v1/fit-analysis", json={"variant_id": "FKL-11", "profile": bad}).status_code == 422

def test_review_retrieval_and_evidence_detail(client):
    h = client.get("/api/v1/laptops/FKL-10/reviews", params={"q": "battery backup", "category": "battery", "k": 5}).json()["hits"]
    assert 1 <= len(h) <= 5
    e = client.get(f"/api/v1/evidence/review/{h[0]['review_id']}").json()
    assert e["review"]["original_text"] == h[0]["text"] and e["source"]["id"] == "S-FLIPKART-REVIEWS"

def test_methodology_exposes_rules(client):
    m = client.get("/api/v1/methodology").json()
    assert m["thresholds"]["coverage_threshold"] == 0.6 and len(m["categories"]) == 12

def test_partial_owner_analysis_withholds_number_and_marks_provisional(client):
    import lapfit.api as api
    c = api.state.conn
    # pretend 3 representatives were processed with rich positive claims => coverage could pass, but analysis is partial
    reps = [r[0] for r in c.execute("SELECT id FROM reviews WHERE variant_id='FKL-11' AND word_count>=8 AND dup_cluster_id IS NULL LIMIT 12")]
    cats = ["performance", "memory", "thermals_noise", "keyboard_trackpad"]
    for i, rid in enumerate(reps):
        c.execute("INSERT OR REPLACE INTO extraction_runs(review_id,status,model,prompt_version,n_claims) VALUES (?,?,?,?,1)", (rid, "done", "t", "t"))
        text = c.execute("SELECT original_text FROM reviews WHERE id=?", (rid,)).fetchone()[0]
        c.execute("""INSERT INTO evidence_claims(review_id,variant_id,category,claim_text,polarity,strength,quote,quote_start,quote_end,model,prompt_version,validation_status)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", (rid, "FKL-11", cats[i % 4], "x", "positive", "clear", text[:5], 0, 5, "t", "t", "machine_validated"))
    c.commit()
    d = client.post("/api/v1/fit-analysis", json={"variant_id": "FKL-11", "profile": {"workloads": {"programming": "daily"}, "hard_requirements": {}, "priorities": []}}).json()
    assert d["owner_analysis"]["state"] == "partial" and d["ratings"]["score_visible"] is False and d["ratings"]["score"] is None
    assert d["ratings"]["provisional"] is True
    assert any(r.get("provisional") for r in d["ratings"]["categories"].values() if r.get("basis") == "owner")
    assert "early results" in " ".join(l["text"] for l in d["summary"]["lines"])


def test_claim_check_endpoint(client):
    r = client.post("/api/v1/claim-checks", json={"variant_id": "FKL-10", "claim_text": "This laptop gives 12 hours of battery life."}).json()
    assert r["claim_type"] == "measured" and r["verdict"] == "mixed" and r["counter_evidence"]["ran"] and r["request_id"]
    assert client.post("/api/v1/claim-checks", json={"variant_id": "NOPE", "claim_text": "battery 12 hours"}).status_code == 404
    assert client.post("/api/v1/claim-checks", json={"variant_id": "FKL-10", "claim_text": "x"}).status_code == 422
    u = client.post("/api/v1/claim-checks", json={"variant_id": "FKL-10", "claim_text": "It has the best keyboard ever."}).json()
    assert u["claim_type"] == "unsupported" and u["verdict"] is None


def test_compare_aligned_rows_no_winner(client):
    r = client.post("/api/v1/compare", json={"variant_ids": ["FKL-11", "FKL-09", "FKL-10"], "profile": PROFILE}).json()
    assert [l["id"] for l in r["laptops"]] == ["FKL-11", "FKL-09", "FKL-10"]
    for row in r["must_haves"]:
        assert set(row["cells"]) == {"FKL-11", "FKL-09", "FKL-10"}           # every laptop answers every must-have
    assert all(set(a["cells"]) == {"FKL-11", "FKL-09", "FKL-10"} for a in r["areas"]) and len(r["areas"]) == 12
    assert not any("winner" in k or "best" in k or "rank" in k for k in r)    # never a winner
    price = next(s for s in r["specs"] if s["attribute"] == "price_inr")["values"]
    assert price["FKL-11"]["display"] == "₹46,999" and price["FKL-09"]["display"] == "₹33,990"
    d = next(x for x in r["differences"] if x["laptop_id"] == "FKL-09")
    assert any("costs ₹13,009 less" in l for l in d["lines"])
    batt = next(s for s in r["specs"] if s["attribute"] == "battery_wh")["values"]
    assert batt["FKL-11"]["similar_model"] is True and batt["FKL-10"]["similar_model"] is False   # similar-model value is flagged, not mixed in

def test_compare_validation(client):
    assert client.post("/api/v1/compare", json={"variant_ids": ["FKL-11"], "profile": PROFILE}).status_code == 422
    assert client.post("/api/v1/compare", json={"variant_ids": ["FKL-11", "NOPE"], "profile": PROFILE}).status_code == 404


def test_live_variant_report_is_honest_about_missing_reviews(client):
    import lapfit.api as api
    c = api.state.conn
    c.execute("INSERT OR IGNORE INTO laptop_models(brand, marketing_name) VALUES ('ACME','Acme Book 14')")
    mid = c.execute("SELECT id FROM laptop_models WHERE marketing_name='Acme Book 14'").fetchone()[0]
    c.execute("INSERT OR REPLACE INTO laptop_variants(id,model_id,listing_title,display_name,catalogue_set,aliases,review_count) VALUES ('LIVE-acme',?,'Acme Book 14 specs','Acme Book 14 (looked up online)','live_researched','[]',0)", (mid,))
    c.execute("INSERT OR REPLACE INTO sources(id,url,source_class,permission) VALUES ('S-LIVE-t1','https://www.apple.com/x','manufacturer_spec','stored_facts_only')")
    for attr, txt, num in (("weight_kg", "1.3", 1.3), ("ram_gb_options", "8,16", None)):
        c.execute("INSERT OR REPLACE INTO spec_facts(variant_id,attribute,value_text,value_num,source_id,quote,variant_match,validation_status) VALUES ('LIVE-acme',?,?,?, 'S-LIVE-t1','q','exact_family','machine_validated')", (attr, txt, num))
    c.commit()
    d = client.post("/api/v1/fit-analysis", json={"variant_id": "LIVE-acme", "profile": PROFILE}).json()
    assert d["owner_analysis"]["state"] == "not_available" and d["status"] == "partial" and any("looked up online" in w for w in d["warnings"])
    g = {r["requirement"]: r for r in d["gate"]}
    assert g["weight_kg_max"]["status"] == "met" and g["budget_inr_max"]["status"] == "unknown"
    assert g["ram_gb_min"]["status"] == "unknown" and "8, 16" in g["ram_gb_min"]["have"]           # several versions: never guessed
    assert d["dealbreakers"] == [] and d["ratings"]["score_visible"] is False

def test_research_endpoint_unavailable_without_key_and_status_404(client, monkeypatch):
    import lapfit.api as api
    monkeypatch.setattr(api, "make_provider", lambda: None)          # never spend real credits in tests
    r = client.post("/api/v1/research", json={"query": "Dell Inspiron 15 3520"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "upstream_unavailable"
    assert client.get("/api/v1/research/nope").status_code == 404
    s = client.get("/api/v1/search", params={"q": "Dell Inspiron 15 3520 i5 16GB"}).json()
    assert s["research_offer"]["available"] is False and s["research_offer"]["unavailable_reason"]

def test_research_endpoint_runs_job_with_stub_provider(client, monkeypatch):
    import time, lapfit.api as api
    from lapfit.research.search import FakeSearch, SearchHit
    stub = FakeSearch([SearchHit("https://www.notebookcheck.net/some-review.html", "Review", "s"), SearchHit("https://www.lenovo.com/x", "Lenovo", "s")])
    monkeypatch.setattr(api, "make_provider", lambda: stub)
    r = client.post("/api/v1/research", json={"query": "Acme Zeta 14 Pro"}).json()
    jid = r["job_id"]
    for _ in range(40):
        j = client.get(f"/api/v1/research/{jid}").json()
        if j["status"] in ("done", "failed"):
            break
        time.sleep(0.25)
    assert j["status"] == "done" and j["variant_id"] is None and j["counts"]["link_only"] == 2
    assert {l["decision"] for l in j["links"]} == {"link_only"} and all((l["reason"] or "").strip() for l in j["links"])
    assert client.post("/api/v1/research", json={"query": "zeta 14 pro acme"}).json()["reused"] is True      # same words, reused, no new job


def test_conflicting_live_facts_become_options_not_a_pick(client):
    import lapfit.api as api
    from lapfit import analysis
    rows = [dict(attribute="ram_gb", value_text="16", value_num=16.0, variant_match="exact_family", source_id="a"),
            dict(attribute="ram_gb_options", value_text="16,32", value_num=None, variant_match="exact_family", source_id="b"),
            dict(attribute="weight_kg", value_text="1.28", value_num=1.28, variant_match="exact_family", source_id="a"),
            dict(attribute="weight_kg", value_text="1.28", value_num=1.28, variant_match="exact_family", source_id="b"),
            dict(attribute="ram_gb", value_text="64", value_num=64.0, variant_match="sibling_cpu", source_id="c")]
    m = analysis.merge_exact(rows)
    assert m["ram_gb_options"]["value_text"] == "16,32" and "ram_gb" not in m          # disagreement kept as options; sibling value ignored
    assert m["weight_kg"]["value_num"] == 1.28                                          # agreement stays a single value


def test_trust_endpoint_reads_real_results_and_lists_limits(client):
    d = client.get("/api/v1/trust").json()
    ids = {i["id"] for i in d["items"]}
    assert {"search", "safety", "inj_screen", "inj_e2e", "claims", "extraction", "retrieval", "live"} <= ids
    inj = next(i for i in d["items"] if i["id"] == "inj_screen")
    assert "1 of 20" in inj["first"]                                   # the bad number is shown, not hidden
    assert any("AI" in l for l in d["limits"]) and d["data"]["owner_reviews"] >= 3300


def test_laptop_ratings_and_opinions_endpoints(client):
    r = client.get("/api/v1/laptops/FKL-10/ratings").json()
    assert len(r["categories"]) == 10 and all({"topic", "happy_pct", "n"} <= set(c) for c in r["categories"])
    o = client.get("/api/v1/laptops/FKL-10/opinions?topic=battery").json()
    assert set(o["counts"]) == {"positive", "negative", "mixed"}
    assert client.get("/api/v1/laptops/FKL-10/opinions?topic=nonsense").status_code == 422
    assert client.get("/api/v1/laptops/NOPE/ratings").status_code == 404
