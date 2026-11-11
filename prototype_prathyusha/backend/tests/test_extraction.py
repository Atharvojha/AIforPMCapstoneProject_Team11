import sqlite3
from lapfit import extraction as ex, ingest
from lapfit.db import connect
from lapfit.llm import LLMResult

class FakeLLM:
    model = "fake"
    def __init__(self, data): self.data = data; self.calls = 0
    def chat_json(self, system, user, schema):
        self.calls += 1
        return LLMResult(self.data, "", 0.1, "fake")

def _claim(quote, **kw):
    d = dict(category="battery", polarity="negative", strength="clear", claim="battery drains fast", quote=quote); d.update(kw); return d

def test_validate_claims_accepts_only_exact_quotes_and_valid_enums():
    text = "Battery drains in 2 hours. Display is good."
    ok, rej = ex.validate_claims(text, [_claim("Battery drains in 2 hours"), _claim("battery drains in 2 hours"),
                                       _claim("Display is good", category="screen"), _claim("Display is good", polarity="great"), {"junk": 1}])
    assert len(ok) == 2 and rej == 3                       # exact quote + case-only difference (repaired to the original slice); the rest rejected
    assert all(text[o["quote_start"]:o["quote_end"]] == o["quote"] for o in ok) and ok[1]["quote"] == "Battery drains in 2 hours"

def test_pipeline_gates(tmp_path):
    p = tmp_path / "t.db"; ingest.build(p, embed=False); conn = connect(p)
    # pick a trivial review, a normal review and fabricate an injection-flagged one
    triv = conn.execute("SELECT id FROM reviews WHERE word_count<4 LIMIT 1").fetchone()[0]
    norm = conn.execute("SELECT id, original_text FROM reviews WHERE word_count>=8 AND flag IS NULL LIMIT 1").fetchone()
    inj = conn.execute("SELECT id FROM reviews WHERE word_count>=8 AND flag IS NULL AND id<>? LIMIT 1", (norm["id"],)).fetchone()[0]
    conn.execute("UPDATE reviews SET flag='instruction_like' WHERE id=?", (inj,)); conn.commit()
    llm = FakeLLM({"claims": [_claim(norm["original_text"][:15]), _claim("this quote was never in the review")], "flags": ["none"]})
    assert ex.extract_one(conn, llm, triv) == "skipped_trivial" and llm.calls == 0           # never sent to model
    assert ex.extract_one(conn, llm, inj) == "skipped_flagged" and llm.calls == 0            # never sent to model
    assert ex.extract_one(conn, llm, norm["id"]) == "done" and llm.calls == 1
    got = conn.execute("SELECT quote, validation_status FROM evidence_claims WHERE review_id=?", (norm["id"],)).fetchall()
    assert len(got) == 1 and got[0]["quote"] == norm["original_text"][:15]                  # fabricated quote dropped
    assert conn.execute("SELECT n_rejected FROM extraction_runs WHERE review_id=?", (norm["id"],)).fetchone()[0] == 1
    assert conn.execute("SELECT COUNT(*) FROM exclusion_log WHERE review_id=? AND reason='instruction_injection'", (inj,)).fetchone()[0] == 1

def test_model_flagged_injection_discards_claims(tmp_path):
    p = tmp_path / "t.db"; ingest.build(p, embed=False); conn = connect(p)
    rid, text = conn.execute("SELECT id, original_text FROM reviews WHERE word_count>=8 AND flag IS NULL LIMIT 1").fetchone()
    llm = FakeLLM({"claims": [_claim(text[:10])], "flags": ["instruction_like_content"]})
    assert ex.extract_one(conn, llm, rid) == "done"
    assert conn.execute("SELECT COUNT(*) FROM evidence_claims WHERE review_id=?", (rid,)).fetchone()[0] == 0
    assert conn.execute("SELECT flag FROM reviews WHERE id=?", (rid,)).fetchone()[0] == "instruction_like"

def test_representatives_one_per_cluster(tmp_path):
    p = tmp_path / "t.db"; ingest.build(p, embed=False); conn = connect(p)
    reps = ex.representatives(conn, "FKL-07")
    cl = [conn.execute("SELECT dup_cluster_id FROM reviews WHERE id=?", (i,)).fetchone()[0] for i in reps]
    cl = [c for c in cl if c is not None]
    assert len(cl) == len(set(cl))
