"""Structured evidence extraction from owner reviews, with deterministic gates around the model.

Gates (all in code, none delegated to the LLM):
  1. trivial reviews (<4 words) are not sent (status skipped_trivial)
  2. instruction-like reviews are not sent (status skipped_flagged, logged as instruction_injection)
  3. every claim's quote must be an exact substring of the original text, else the claim is rejected
  4. category/polarity/strength must be in the allowed enums, else rejected
Only one representative review per duplicate cluster is sent; duplicates share its claims.
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

from . import text_utils as tu
from .config import ROOT, settings
from .db import connect
from .llm import LLMProvider, OllamaProvider

PROMPT_PATH = ROOT / "backend" / "prompts" / "extract-v2.md"
CATEGORIES = ["performance", "memory", "gpu", "battery", "display", "thermals_noise", "portability", "keyboard_trackpad",
              "ports_connectivity", "upgradeability", "build_reliability", "value", "delivery_or_seller", "other"]
POLARITIES = ["positive", "negative", "mixed", "neutral"]
STRENGTHS = ["clear", "mild"]
SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {"type": "array", "items": {"type": "object", "properties": {
            "category": {"type": "string", "enum": CATEGORIES}, "polarity": {"type": "string", "enum": POLARITIES},
            "strength": {"type": "string", "enum": STRENGTHS}, "claim": {"type": "string"}, "quote": {"type": "string"}},
            "required": ["category", "polarity", "strength", "claim", "quote"]}, "maxItems": 6},
        "usage_context": {"type": "string"},
        "flags": {"type": "array", "items": {"type": "string", "enum": ["instruction_like_content", "promotional", "off_topic", "none"]}},
    },
    "required": ["claims", "usage_context", "flags"],
}


def system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def validate_claims(text: str, raw_claims: list[dict]) -> tuple[list[dict], int]:
    """Return (accepted claims with offsets, number rejected). Pure function: unit-tested without a model."""
    ok, rejected = [], 0
    for c in raw_claims or []:
        try:
            loc = tu.locate_quote(text, c["quote"])
            if loc is None:                       # case-only difference (e.g. an ALL-CAPS review): repair to the original slice, never to different words
                loc = tu.locate_quote_ci(text, c["quote"])
                if loc is not None:
                    c = {**c, "quote": text[loc[0]:loc[1]]}
            if (loc is None or c["category"] not in CATEGORIES or c["polarity"] not in POLARITIES or c["strength"] not in STRENGTHS
                    or not c["claim"].strip() or len(c["quote"]) > 400):
                rejected += 1
                continue
            c = {**c, "category": tu.guard_category(c["quote"], c["category"]), "strength": tu.guard_strength(c["quote"], c["strength"]),
                 "polarity": tu.guard_polarity(c["quote"], c["polarity"])}
            ok.append({**c, "quote_start": loc[0], "quote_end": loc[1]})
        except (KeyError, TypeError, AttributeError):
            rejected += 1
    return ok, rejected


def extract_one(conn: sqlite3.Connection, llm: LLMProvider, review_id: str) -> str:
    r = conn.execute("SELECT id, variant_id, original_text, flag FROM reviews WHERE id=?", (review_id,)).fetchone()
    text = r["original_text"]
    if tu.is_trivial(text):
        conn.execute("INSERT OR REPLACE INTO extraction_runs(review_id,status,model,prompt_version) VALUES (?,?,?,?)",
                     (review_id, "skipped_trivial", None, settings.prompt_version))
        return "skipped_trivial"
    if r["flag"]:
        conn.execute("INSERT OR REPLACE INTO extraction_runs(review_id,status,model,prompt_version,note) VALUES (?,?,?,?,?)",
                     (review_id, "skipped_flagged", None, settings.prompt_version, r["flag"]))
        conn.execute("INSERT INTO exclusion_log(review_id,reason,rule) VALUES (?,?,?)", (review_id, "instruction_injection", "rule:instruction_pattern"))
        return "skipped_flagged"
    res = llm.chat_json(system_prompt(), f"<review>\n{text}\n</review>", SCHEMA)
    if res.data is None:
        conn.execute("INSERT OR REPLACE INTO extraction_runs(review_id,status,model,prompt_version,secs,note) VALUES (?,?,?,?,?,?)",
                     (review_id, "failed", res.model, settings.prompt_version, res.secs, res.error))
        return "failed"
    claims, rejected = validate_claims(text, res.data.get("claims", []))
    # model-reported injection flag also sets the review aside (belt and braces)
    if "instruction_like_content" in res.data.get("flags", []):
        conn.execute("UPDATE reviews SET flag='instruction_like' WHERE id=?", (review_id,))
        conn.execute("INSERT INTO exclusion_log(review_id,reason,rule) VALUES (?,?,?)", (review_id, "instruction_injection", "model:flag"))
        claims = []
    conn.execute("DELETE FROM evidence_claims WHERE review_id=?", (review_id,))
    for c in claims:
        conn.execute("""INSERT INTO evidence_claims(review_id,variant_id,category,claim_text,polarity,strength,usage_context,quote,quote_start,quote_end,
            model,prompt_version,validation_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (review_id, r["variant_id"], c["category"], c["claim"], c["polarity"], c["strength"], res.data.get("usage_context", "not_stated"), c["quote"],
             c["quote_start"], c["quote_end"], res.model, settings.prompt_version, "machine_validated"))
    conn.execute("INSERT OR REPLACE INTO extraction_runs(review_id,status,model,prompt_version,n_claims,n_rejected,secs) VALUES (?,?,?,?,?,?,?)",
                 (review_id, "done", res.model, settings.prompt_version, len(claims), rejected, res.secs))
    return "done"


def reguard_stored(conn: sqlite3.Connection) -> dict:
    """Apply the deterministic guards to already-stored claims (no model call). Returns counts of changes."""
    changed = {"category": 0, "strength": 0, "polarity": 0}
    for r in conn.execute("SELECT id, category, strength, polarity, quote FROM evidence_claims").fetchall():
        nc, ns, npl = tu.guard_category(r["quote"], r["category"]), tu.guard_strength(r["quote"], r["strength"]), tu.guard_polarity(r["quote"], r["polarity"])
        if nc != r["category"] or ns != r["strength"] or npl != r["polarity"]:
            conn.execute("UPDATE evidence_claims SET category=?, strength=?, polarity=? WHERE id=?", (nc, ns, npl, r["id"]))
            changed["category"] += nc != r["category"]
            changed["strength"] += ns != r["strength"]
            changed["polarity"] += npl != r["polarity"]
    conn.commit()
    return changed


def representatives(conn: sqlite3.Connection, variant_id: str) -> list[str]:
    """One review id per duplicate cluster (lowest id) plus all unclustered reviews, in id order."""
    rows = conn.execute("""SELECT id FROM reviews WHERE variant_id=? AND (dup_cluster_id IS NULL OR id = (
        SELECT MIN(r2.id) FROM reviews r2 WHERE r2.dup_cluster_id = reviews.dup_cluster_id)) ORDER BY id""", (variant_id,)).fetchall()
    return [r[0] for r in rows]


def run(conn: sqlite3.Connection, llm: LLMProvider, variant_id: str, limit: int | None = None, log=print) -> dict:
    todo = [i for i in representatives(conn, variant_id)
            if conn.execute("SELECT 1 FROM extraction_runs WHERE review_id=?", (i,)).fetchone() is None]
    if limit:
        todo = todo[:limit]
    counts: dict[str, int] = {}
    for n, rid in enumerate(todo, 1):
        st = extract_one(conn, llm, rid)
        conn.commit()
        counts[st] = counts.get(st, 0) + 1
        if n % 10 == 0:
            log(f"  {variant_id}: {n}/{len(todo)} {counts}")
    return {"variant": variant_id, "processed": len(todo), **counts}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", action="append", required=True)
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    conn = connect()
    llm = OllamaProvider()
    for v in a.variant:
        print(run(conn, llm, v, a.limit), flush=True)
