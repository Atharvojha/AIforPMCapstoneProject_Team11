import sqlite3, pytest
from lapfit import ingest
from lapfit.db import connect
from lapfit.retrieval import Retriever, CATEGORY_QUERIES

@pytest.fixture(scope="module")
def db(tmp_path_factory):
    p = tmp_path_factory.mktemp("db") / "t.db"
    summary = ingest.build(p, embed=True)
    return p, summary

def test_ingest_counts_match_verified_data(db):
    _, s = db
    assert s["variants"] == 14 + s["amazon_laptops"] and s["reviews"] == 3300 and s["benchmarks"] == 12    # 14 Indian laptops + Amazon US evidence laptops
    assert s["amazon_laptops"] >= 10
    assert s["flagged_instruction_like"] <= 6
    assert s["hardware_modified"] >= 11 and s["upgrade_mentioned"] >= 40

def test_original_text_preserved_and_ids_match_pdf(db):
    p, _ = db
    c = connect(p)
    r = c.execute("SELECT original_text, rating, variant_id FROM reviews WHERE id='FK-02936'").fetchone()
    assert r["rating"] == 5 and "58000" in r["original_text"] and r["variant_id"] == "FKL-07"

def test_facts_carry_provenance_and_variant_match(db):
    p, _ = db
    c = connect(p)
    bad = c.execute("SELECT COUNT(*) FROM spec_facts WHERE source_id IS NULL OR variant_match IS NULL OR validation_status IS NULL").fetchone()[0]
    assert bad == 0
    sib = c.execute("SELECT variant_match FROM benchmarks WHERE id='BM-006'").fetchone()[0]
    assert sib == "sibling_cpu"
    exact = c.execute("SELECT COUNT(*) FROM benchmarks WHERE variant_match='exact_family'").fetchone()[0]
    assert exact == 5

def test_dedup_clusters_collapse_in_retrieval(db):
    p, _ = db
    c = connect(p); r = Retriever(c)
    hits = r.search("FKL-07", "battery backup", k=30)
    cids = [h.dup_cluster_id for h in hits if h.dup_cluster_id is not None]
    assert len(cids) == len(set(cids))                      # no cluster appears twice

def test_variant_filter_never_leaks(db):
    p, _ = db
    c = connect(p); r = Retriever(c)
    for q in ("battery", "fan noise", "display"):
        for mode in ("lexical", "vector", "hybrid"):
            ids = [h.review_id for h in r.search("FKL-11", q, k=15, mode=mode)]
            assert ids and all(c.execute("SELECT variant_id FROM reviews WHERE id=?", (i,)).fetchone()[0] == "FKL-11" for i in ids)

def test_hybrid_finds_battery_reviews(db):
    p, _ = db
    c = connect(p); r = Retriever(c)
    hits = r.search("FKL-10", CATEGORY_QUERIES["battery"], k=10)
    rel = sum(1 for h in hits if any(w in h.text.lower() for w in ("battery", "backup", "charge", "hours", "hour")))
    assert rel >= 8


def test_rebuild_preserves_extraction_results(tmp_path):
    p = tmp_path / "keep.db"
    ingest.build(p, embed=False)
    c = connect(p)
    rid, text = c.execute("SELECT id, original_text FROM reviews WHERE word_count>=8 LIMIT 1").fetchone()
    c.execute("INSERT INTO extraction_runs(review_id,status,model,prompt_version,n_claims) VALUES (?,?,?,?,1)", (rid, "done", "m", "p"))
    c.execute("""INSERT INTO evidence_claims(review_id,variant_id,category,claim_text,polarity,strength,quote,quote_start,quote_end,model,prompt_version,validation_status)
                 SELECT ?, variant_id, 'battery', 'x', 'negative', 'clear', ?, 0, 5, 'm','p','machine_validated' FROM reviews WHERE id=?""", (rid, text[:5], rid))
    c.commit(); c.close()
    s = ingest.build(p, embed=False)
    assert s["restored_runs"] == 1 and s["restored_claims"] == 1
    c = connect(p)
    assert c.execute("SELECT COUNT(*) FROM evidence_claims").fetchone()[0] == 1


def test_rebuild_preserves_live_research_data(tmp_path):
    from lapfit.research import pipeline
    p = tmp_path / "live.db"
    ingest.build(p, embed=False)
    c = connect(p)
    jid, _ = pipeline.create_job(c, "Dell Inspiron 15 3520")
    c.execute("INSERT OR IGNORE INTO laptop_models(brand, marketing_name) VALUES ('DELL','Dell Inspiron 15 3520')")
    mid = c.execute("SELECT id FROM laptop_models WHERE marketing_name='Dell Inspiron 15 3520'").fetchone()[0]
    c.execute("INSERT INTO laptop_variants(id,model_id,listing_title,display_name,catalogue_set,aliases,review_count) VALUES ('LIVE-x',?,'t','Dell Inspiron 15 3520 (looked up online)','live_researched','[]',0)", (mid,))
    c.execute("INSERT INTO sources(id,url,source_class,permission) VALUES ('S-LIVE-aaaa','https://www.dell.com/x','manufacturer_spec','stored_facts_only')")
    c.execute("INSERT INTO spec_facts(variant_id,attribute,value_text,value_num,unit,source_id,quote,variant_match,validation_status) VALUES ('LIVE-x','weight_kg','1.65',1.65,'kg','S-LIVE-aaaa','Weight 1.65 kg','exact_family','machine_validated')")
    c.commit(); c.close()
    s = ingest.build(p, embed=False)
    assert s["restored_live_laptops"] == 1
    c = connect(p)
    assert c.execute("SELECT COUNT(*) FROM spec_facts WHERE variant_id='LIVE-x'").fetchone()[0] == 1
    assert c.execute("SELECT COUNT(*) FROM research_jobs").fetchone()[0] == 1
    assert c.execute("SELECT variant_id FROM fts_variants WHERE fts_variants MATCH 'inspiron'").fetchone()[0] == "LIVE-x"
