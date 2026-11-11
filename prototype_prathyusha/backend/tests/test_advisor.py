"""Free-text needs, recommended numbers, ranking, and claims with no laptop chosen."""
import pytest

from lapfit import ingest, advisor, topic_reader
from lapfit.db import connect

ASUS = ["FKL-01", "FKL-05", "FKL-08", "FKL-09"]


@pytest.fixture(scope="module")
def conn(tmp_path_factory):
    p = tmp_path_factory.mktemp("adv") / "a.db"
    ingest.build(p, embed=False)
    return connect(p)


@pytest.fixture()
def votes(tmp_path, monkeypatch, conn):
    """A tiny separate votes DB: every ASUS laptop has mostly unhappy battery owners, every other laptop mostly happy ones."""
    monkeypatch.setattr(topic_reader, "VOTES_DB", tmp_path / "votes.db")
    v = topic_reader.votes_conn()
    i = 0
    asus_ids = {r[0] for r in conn.execute("SELECT lv.id FROM laptop_variants lv JOIN laptop_models lm ON lm.id=lv.model_id WHERE lm.brand='ASUS'")}
    for r in conn.execute("SELECT id FROM laptop_variants WHERE catalogue_set!='live_researched' ORDER BY id"):
        vid = r[0]
        revs = [x[0] for x in conn.execute("SELECT id FROM reviews WHERE variant_id=? ORDER BY id LIMIT 14", (vid,))]
        if len(revs) < 14:
            continue
        for k, rid in enumerate(revs):
            op = ("negative" if k < 10 else "positive") if vid in asus_ids else ("positive" if k < 11 else "negative")
            v.execute("INSERT OR REPLACE INTO topic_votes VALUES (?,?,?,?,?,?,?)", (rid, vid, "battery", op, "battery text for " + rid, "t", topic_reader.VERSION))
            v.execute("INSERT OR REPLACE INTO topic_done VALUES (?,?,?,?,?)", (rid, vid, 1, 1.0, topic_reader.VERSION))
    v.commit()
    return v


# ------------------------------------------------------------------------------------------------ understanding text
def test_parse_example_student():
    n = advisor.parse_needs("I am a CS student. Mostly coding, some video editing. Budget around 60k. I want it fast and light, with good battery, no MSI")
    assert {"programming", "design_video", "college_research"} <= set(n["uses"])
    assert {"performance", "portability", "battery"} <= set(n["priorities"])
    assert n["hard"]["budget_inr_max"] == 60000 and n["brands_avoid"] == ["MSI"]

@pytest.mark.parametrize("text,expected", [("budget 50-70k", 70000), ("under ₹55,000", 55000), ("around 1.2 lakh", 120000), ("budget 80000", 80000)])
def test_budget_forms(text, expected):
    assert advisor.parse_needs(text)["hard"]["budget_inr_max"] == expected

def test_specs_are_not_mistaken_for_budget():
    n = advisor.parse_needs("I need 16 GB RAM, 512 GB SSD, under 1.5 kg and 8 hours battery")
    assert "budget_inr_max" not in n["hard"]
    assert n["hard"]["ram_gb_min"] == 16 and n["hard"]["storage_gb_min"] == 512 and n["hard"]["weight_kg_max"] == 1.5 and n["hard"]["battery_h_min"] == 8

def test_nothing_understood_is_reported_not_invented():
    n = advisor.parse_needs("hello there")
    assert n["uses"] == [] and n["understood"] == []


# ------------------------------------------------------------------------------------------------ recommended numbers
def test_recommendations_follow_use_and_priority():
    r = {x["key"]: x for x in advisor.recommend_specs(advisor.parse_needs("gaming, I want it fast"))}
    assert r["ram_gb"]["minimum"] >= 16 and "gpu" in r and r["refresh_hz"]["minimum"] >= 120 and all(x["kind"] in ("rule of thumb", "checked against vendor pages") and (x["kind"] == "rule of thumb") == (not x["sources"]) for x in r.values())
    s = {x["key"]: x for x in advisor.recommend_specs(advisor.parse_needs("student, I carry it every day, long battery"))}
    assert s["weight_kg_max"]["minimum"] <= 1.8 and s["battery_h"]["minimum"] >= 7 and "gpu" not in s

def test_user_numbers_are_shown_next_to_suggestions():
    r = {x["key"]: x for x in advisor.recommend_specs(advisor.parse_needs("coding, I need 32 GB RAM"))}
    assert r["ram_gb"]["you_asked"] == 32

@pytest.mark.parametrize("cpu,tier", [("Intel Core i3 10th Gen", 1), ("Celeron Dual Core", 1), ("Ryzen 7 Octa Core AMD R7-4800H", 4), ("Apple M1", 3)])
def test_cpu_tiers(cpu, tier):
    assert advisor.cpu_tier(cpu) == tier


# ------------------------------------------------------------------------------------------------ ranking
def test_advice_ranks_and_flags_missed_numbers(conn, votes):
    d = advisor.advise(conn, "coding student, budget 40k, need 16 GB RAM")
    assert len(d["laptops"]) == 14                                   # only the 14 laptops sold in India are ranked; US (Amazon) laptops are evidence only
    assert all(len(l["categories"]) == 10 for l in d["laptops"])
    first_missing = next((i for i, l in enumerate(d["laptops"]) if l["misses"] > 0), len(d["laptops"]))
    assert all(l["misses"] == 0 for l in d["laptops"][:first_missing]) and all(l["misses"] > 0 for l in d["laptops"][first_missing:])   # laptops that meet every number you gave come first
    over = [l for l in d["laptops"] if l["price_inr"] and l["price_inr"] > 40000]
    assert over and all(l["misses"] >= 1 for l in over)

def test_avoided_brand_is_left_out(conn, votes):
    assert not any(l["brand"] == "MSI" for l in advisor.advise(conn, "gaming, no MSI")["laptops"])

def test_category_rating_needs_three_owners(conn, votes):
    d = advisor.advise(conn, "student")
    bat = next(c for c in d["laptops"][0]["categories"] if c["topic"] == "battery")
    assert bat["n"] >= 3 and bat["happy_pct"] is not None
    other = next(c for c in d["laptops"][0]["categories"] if c["topic"] == "display")
    assert other["happy_pct"] is None and other["rating"] == "Not enough reviews"


# ------------------------------------------------------------------------------------------------ claims with no laptop chosen
def test_brand_claim_supported_with_best_and_worst(conn, votes):
    r = advisor.check_free_claim(conn, "ASUS laptops are bad at holding battery")
    assert r["mode"] == "brand" and r["verdict"] == "supported"
    assert r["groups"][0]["label"] == "ASUS" and r["groups"][0]["models"] >= 4 and r["groups"][1]["label"] == "All other brands"
    assert r["best"] and not r["best"][0]["in_scope"] and r["worst"][0]["in_scope"]
    assert r["suggestions"] and all(not s["in_scope"] for s in r["suggestions"])

def test_opposite_claim_is_contradicted(conn, votes):
    assert advisor.check_free_claim(conn, "ASUS laptops have great battery")["verdict"] == "contradicted"

def test_generic_request_suggests_laptops_without_a_verdict(conn, votes):
    r = advisor.check_free_claim(conn, "I want a laptop with good battery")
    assert r["mode"] == "generic" and r["verdict"] is None and r["suggestions"]
    assert all(s["brand"] != "ASUS" for s in r["suggestions"]) and r["brands"]

def test_too_few_reviews_gives_insufficient_not_a_guess(conn, tmp_path, monkeypatch):
    monkeypatch.setattr(topic_reader, "VOTES_DB", tmp_path / "empty.db")
    r = advisor.check_free_claim(conn, "ASUS laptops are bad at holding battery")
    assert r["verdict"] == "insufficient" and "Not enough" in r["headline"]

def test_numeric_brand_claim_uses_listing_data(conn, votes):
    r = advisor.check_free_claim(conn, "HP laptops are heavy")
    assert r["mode"] == "numeric" and r["groups"][0]["label"] == "HP" and r["verdict"] in ("supported", "contradicted", "mixed")

def test_named_model_goes_to_the_laptop_engine(conn, votes):
    r = advisor.check_free_claim(conn, "MacBook Air gets 12 hours of battery")
    assert r["mode"] == "laptop" and r["laptop_id"] == "FKL-10" and r["result"]["subclaims"]

def test_unknown_claim_says_what_it_can_check(conn, votes):
    r = advisor.check_free_claim(conn, "the moon is made of cheese")
    assert r["mode"] == "unsupported" and "Try" in r["headline"]


# ------------------------------------------------------------------------------------------------ wider catalogue (Amazon US)
def test_amazon_laptops_are_loaded_as_evidence_with_caps(conn):
    rows = conn.execute("SELECT lv.id, lv.display_name, lv.review_count, lv.catalogue_set FROM laptop_variants lv WHERE lv.id LIKE 'AMZ-%'").fetchall()
    assert len(rows) >= 10 and all(r["catalogue_set"] == "well_evidenced" for r in rows)
    assert all(r["review_count"] <= 150 for r in rows)                                   # one popular model cannot outweigh a brand
    assert not any("renewed" in r["display_name"].lower() or "refurbished" in r["display_name"].lower() for r in rows)
    n = conn.execute("SELECT COUNT(*) FROM reviews WHERE id LIKE 'AM-%'").fetchone()[0]
    assert n == sum(r["review_count"] for r in rows)
    assert conn.execute("SELECT COUNT(*) FROM spec_facts WHERE variant_id LIKE 'AMZ-%' AND attribute='price_inr'").fetchone()[0] == 0   # no invented rupee prices


def test_us_laptops_never_appear_in_recommendations(conn, votes):
    ids = {l["id"] for l in advisor.advise(conn, "student, coding")["laptops"]}
    assert not any(i.startswith("AMZ-") for i in ids)


def test_brand_score_is_average_of_models_not_dominated_by_one_big_model(conn, tmp_path, monkeypatch):
    monkeypatch.setattr(topic_reader, "VOTES_DB", tmp_path / "m.db")
    v = topic_reader.votes_conn()
    hp = [r[0] for r in conn.execute("SELECT lv.id FROM laptop_variants lv JOIN laptop_models lm ON lm.id=lv.model_id WHERE lm.brand='HP' AND lv.id LIKE 'FKL-%' ORDER BY lv.id")]
    big, small = hp[0], hp[1:]

    def put(vid, pos, neg):
        revs = [x[0] for x in conn.execute("SELECT id FROM reviews WHERE variant_id=? ORDER BY id LIMIT ?", (vid, pos + neg))]
        for k, rid in enumerate(revs):
            v.execute("INSERT INTO topic_votes VALUES (?,?,?,?,?,?,?)", (rid, vid, "battery", "positive" if k < pos else "negative", "q", "t", topic_reader.VERSION))
    put(big, 30, 0)                      # one HP model: 30 happy owners
    for s_ in small:
        put(s_, 0, 8)                    # the other HP models: all unhappy
    for r in conn.execute("SELECT id FROM laptop_variants WHERE catalogue_set='flipkart14'"):
        if r[0] not in hp:
            put(r[0], 8, 2)
    v.commit()
    r = advisor.check_free_claim(conn, "HP laptops are bad at holding battery")
    g = r["groups"][0]
    assert g["happy_pct"] is not None and g["happy_pct"] < 50           # average of models (about 25%), not pooled (about 55%)
    # one HP model is loved and the others are hated: the headline must say there is no single answer, not "claim holds / does not hold"
    assert r["verdict"] == "mixed" and "no single answer" in r["headline"] and "Claim holds" not in r["headline"] and "Claim does not hold" not in r["headline"]


def test_feature_words_in_listing_titles_do_not_count_as_model_names(conn, votes):
    # found by the end-to-end check: a US laptop titled "...Touch-Screen..." made "a great screen" look like a laptop name
    assert advisor._named_variants(conn, "I want a laptop with a great screen") == []
    assert advisor._named_variants(conn, "the touch keyboard and display are good") == []
    assert advisor._named_variants(conn, "MacBook Air gets 12 hours of battery") == ["FKL-10"]
    assert advisor.check_free_claim(conn, "I want a laptop with a great screen")["mode"] == "generic"


# ------------------------------------------------------------------------------------------------ student-persona changes
def test_reasons_do_not_mix_different_numbers():
    r = {x["key"]: x for x in advisor.recommend_specs(advisor.parse_needs("coding and a bit of college work"))}
    assert "16 GB" in r["ram_gb"]["why"] and "8 GB handles notes" not in r["ram_gb"]["why"]      # the reason matches the number we suggest
    assert r["ram_gb"]["why"].startswith("Coding:")

def test_priority_reason_is_shown_first():
    r = {x["key"]: x for x in advisor.recommend_specs(advisor.parse_needs("coding, I want it fast"))}
    assert r["ram_gb"]["why"].startswith("You said speed matters")

def test_cards_carry_the_specs_a_nerd_checks_and_a_breakdown(conn, votes):
    d = advisor.advise(conn, "coding student")
    l = d["laptops"][0]
    assert [x["label"] for x in l["specs"]][:3] == ["Processor", "Graphics", "Memory"]
    assert all({"weight", "lb", "happy", "unhappy"} <= set(c) for c in l["categories"])
    ideapad = next(x for x in d["laptops"] if x["id"] == "FKL-11")
    assert "1 SODIMM slot" in next(s["value"] for s in ideapad["specs"] if s["label"] == "Memory")   # upgrade info shown when a source states it

def test_two_named_laptops_are_sent_to_compare(conn, votes):
    r = advisor.check_free_claim(conn, "MacBook Air M1 vs IdeaPad 3 which is better")
    assert r["mode"] == "compare" and {"FKL-10", "FKL-11"} <= set(r["compare_ids"]) and "FKL-04" not in r["compare_ids"] and r["verdict"] is None   # IdeaPad 3, not IdeaPad Gaming


def test_nerd_phrasings_are_understood_and_unknowns_are_admitted():
    n = advisor.parse_needs("CS undergrad, into Linux and machine learning side projects. I want 16GB RAM, a good keyboard and decent thermals, around 70k. No MSI. Need CUDA.")
    assert {"programming", "college_research", "ai_ml"} <= set(n["uses"])
    assert {"keyboard_trackpad", "thermals_noise"} <= set(n["priorities"])
    assert n["cannot_check"] == ["Linux support"] and n["needs_nvidia"] and n["brands_avoid"] == ["MSI"]
    assert any("can't check" in u and "Linux support" in u for u in n["understood"])      # we say what we cannot verify instead of ignoring it

def test_cuda_need_makes_nvidia_a_hard_requirement(conn, votes):
    d = advisor.advise(conn, "machine learning, need CUDA, 90k")
    for l in d["laptops"]:
        g = next((c for c in l["checks"] if c["label"] == "Graphics"), None)
        assert g and g["hard"] and "NVIDIA" in g["need"]
    mac = next(l for l in d["laptops"] if l["id"] == "FKL-10")
    assert next(c for c in mac["checks"] if c["label"] == "Graphics")["status"] == "miss"    # Apple silicon has no CUDA


# ------------------------------------------------------------------------------------------------ claim parsing found by the critic pass
@pytest.mark.parametrize("text,expected", [
    ("TUF F15 throttles under load", ("thermals_noise", "negative")), ("MacBook Air M1 has no fan", ("thermals_noise", "positive")),
    ("Gaming laptops have bad battery", ("battery", "negative")), ("the screen is not bad", ("display", "positive")),
    ("Lenovo IdeaPad Gaming runs hot", ("thermals_noise", "negative")), ("laptops under 50k are all plastic and flimsy", ("build_reliability", "negative")),
    ("MSI GF63 fan is too loud", ("thermals_noise", "negative")), ("the battery", ("battery", None)), ("hello there", (None, None))])
def test_claim_direction_is_read_not_guessed(text, expected):
    assert advisor.claim_topic_and_stance(text) == expected

def test_gaming_laptops_group_does_not_crash_and_uses_dedicated_graphics(conn, votes):
    r = advisor.check_free_claim(conn, "Gaming laptops have bad battery")
    assert r["mode"] == "line" and "Gaming laptops" in r["scope"] and r["groups"][1]["label"] == "All other laptops"
    assert all(m["market"] == "IN" for m in r["models"])                      # group claims use the laptops whose specs we know

def test_price_group_only_contains_laptops_under_the_price(conn, votes):
    r = advisor.check_free_claim(conn, "laptops under 50k have bad battery")      # the synthetic votes in this fixture are about battery
    inside = [m for m in r["models"] if m["in_scope"]]
    assert inside and all((m["price_inr"] or 1e9) <= 50000 for m in inside)

def test_brand_versus_brand_is_a_head_to_head_without_a_verdict(conn, votes):
    r = advisor.check_free_claim(conn, "ASUS vs Lenovo battery")
    assert r["mode"] == "generic" and r["verdict"] is None and "ASUS" in r["headline"] and "Lenovo" in r["headline"]

def test_processor_comparison_is_declined_and_sent_to_compare(conn, votes):
    r = advisor.check_free_claim(conn, "Ryzen 5 5600H is faster than i5 11th gen")
    assert r["mode"] == "unsupported" and "Compare page" in r["headline"]

def test_processor_codes_are_not_model_names(conn, votes):
    assert advisor._named_variants(conn, "the 5600H is fast") == [] and advisor._named_variants(conn, "TUF F15 throttles") == ["FKL-05"]

def test_unclear_direction_shows_the_picture_without_a_verdict(conn, votes):
    r = advisor.check_free_claim(conn, "ASUS battery")
    assert r["verdict"] is None and "good or bad" in r["mode_note"]

def test_upgrade_claims_go_to_the_per_laptop_engine(conn, votes):
    r = advisor.check_free_claim(conn, "IdeaPad 3 RAM is upgradeable")
    assert r["mode"] == "laptop" and r["laptop_id"] in ("FKL-11", "FKL-12")

def test_advice_questions_are_not_pretended_to_be_claims(conn, votes):
    r = advisor.check_free_claim(conn, "is 16GB RAM overkill, should i get it")
    assert r["mode"] == "unsupported" and "advice" in r["headline"]


def test_absolute_claims_are_not_supported_by_averages(conn, votes):
    # fixture: all ASUS laptops are mostly unhappy about battery -> 'every ASUS laptop' has no exceptions here, so it can hold;
    r = advisor.check_free_claim(conn, "every ASUS laptop is bad at holding battery")
    assert r["verdict"] in ("supported", "mixed")
    # now make one ASUS laptop loved: the absolute must fail
    v = topic_reader.votes_conn()
    asus = [x[0] for x in conn.execute("SELECT lv.id FROM laptop_variants lv JOIN laptop_models lm ON lm.id=lv.model_id WHERE lm.brand='ASUS' AND lv.id LIKE 'FKL-%' ORDER BY lv.id")]
    for rid in [x[0] for x in conn.execute("SELECT id FROM reviews WHERE variant_id=? ORDER BY id LIMIT 14", (asus[0],))]:
        v.execute("UPDATE topic_votes SET opinion='positive' WHERE review_id=? AND topic='battery'", (rid,))
    v.commit()
    r2 = advisor.check_free_claim(conn, "every ASUS laptop is bad at holding battery")
    assert r2["verdict"] == "mixed" and "do not fit" in r2["headline"]

def test_specific_words_show_who_used_them(conn, votes):
    r = advisor.check_free_claim(conn, "TUF F15 throttles under load")
    assert r["word_hits"]["word"] == "throttl" and isinstance(r["word_hits"]["reviews"], int)
    for e in r["word_hits"]["examples"]:
        assert e["quote"].lower().count("throttl") >= 1

def test_fan_hardware_claim_is_not_proven_by_heat_opinions(conn, votes):
    r = advisor.check_free_claim(conn, "MacBook Air M1 has no fan")
    assert r["verdict"] in ("insufficient", None) and "hardware fact" in r["headline"]

def test_headlines_do_not_repeat_the_word_laptops(conn, votes):
    r = advisor.check_free_claim(conn, "Gaming laptops have bad battery")
    assert "laptops laptops" not in r["headline"]


def test_worse_than_the_rest_is_not_the_same_as_bad(conn, tmp_path, monkeypatch):
    monkeypatch.setattr(topic_reader, "VOTES_DB", tmp_path / "w.db")
    v = topic_reader.votes_conn()
    lenovo = [r[0] for r in conn.execute("SELECT lv.id FROM laptop_variants lv JOIN laptop_models lm ON lm.id=lv.model_id WHERE lm.brand='LENOVO' AND lv.id LIKE 'FKL-%'")]

    def put(vid, pos, neg):
        for k, rid in enumerate([x[0] for x in conn.execute("SELECT id FROM reviews WHERE variant_id=? ORDER BY id LIMIT ?", (vid, pos + neg))]):
            v.execute("INSERT INTO topic_votes VALUES (?,?,?,?,?,?,?)", (rid, vid, "battery", "positive" if k < pos else "negative", "q", "t", topic_reader.VERSION))
    for l in lenovo:
        put(l, 6, 4)                       # Lenovo: 60% happy
    for r in conn.execute("SELECT id FROM laptop_variants WHERE catalogue_set='flipkart14'"):
        if r[0] not in lenovo:
            put(r[0], 9, 1)                # everyone else: 90% happy
    v.commit()
    r = advisor.check_free_claim(conn, "Lenovo laptops are bad at battery")
    assert r["verdict"] == "mixed" and "too strong" in r["headline"]      # worse than the rest (60 vs 90) but most owners are still happy


def test_laptops_with_identical_titles_get_tell_apart_names(conn, votes):
    names = [l["name"] for l in advisor.advise(conn, "student")["laptops"]]
    assert len(names) == len(set(names))

def test_meeting_the_numbers_is_not_hidden_when_owners_warn_about_a_priority(conn, votes):
    d = advisor.advise(conn, "student, long battery, under 60k")
    flagged = [l for l in d["laptops"] if l["warnings"]]
    assert flagged and all("owners are unhappy about" in l["verdict"] or l["misses"] or l["soft_misses"] for l in flagged)
    assert all("Battery" in w for l in flagged for w in l["warnings"] if "battery" in w.lower())


def test_unrated_laptops_do_not_look_like_recommendations(conn, votes):
    d = advisor.advise(conn, "student")
    for l in d["laptops"]:
        if l["score"] is None and not l["misses"] and not l["soft_misses"]:
            assert ("too few owner reviews" in l["verdict"] or l["warnings"]) and l["tone"] == "mix"
