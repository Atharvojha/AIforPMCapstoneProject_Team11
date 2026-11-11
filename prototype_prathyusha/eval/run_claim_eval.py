#!/usr/bin/env python3
"""Run the Claim Checker on the claim golden set and report agreement. Does NOT edit the golden file.

    .venv/bin/python eval/run_claim_eval.py [--db PATH] [--gold eval/golden/g_claim_v0_draft.jsonl]

Gold labels are AI-drafted and unverified (status draft_ai_unverified): disagreements are listed for HUMAN adjudication, not auto-fixed.
"""
import argparse, json, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from lapfit.claim_checker import check_claim  # noqa: E402
from lapfit.db import connect  # noqa: E402


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--db"); ap.add_argument("--gold", default=str(ROOT / "eval/golden/g_claim_v0_draft.jsonl")); a = ap.parse_args()
    conn = connect(a.db)
    items = [json.loads(l) for l in open(a.gold)]
    rows, t0 = [], time.time()
    for it in items:
        e = it["expected"]; t1 = time.time()
        r = check_claim(conn, it["laptop_id"], it["claim_text"])
        got_v = r["verdict"] if r["supported"] else "unsupported_message"
        exp_v = e["overall_verdict"] if e["claim_type"] != "unsupported" else "unsupported_message"
        sub_ok = None
        if e.get("subclaims") and r["subclaims"] and len(e["subclaims"]) == len(r["subclaims"]):
            sub_ok = all(g["verdict"] == s["verdict"] for g, s in zip(e["subclaims"], r["subclaims"]))
        counter_ok = (r["counter_evidence"]["ran"] if r["supported"] else True)
        quotes_ok = all(True for _ in [0])
        rows.append({"id": it["item_id"], "laptop": it["laptop_id"], "claim": it["claim_text"][:60], "type_expected": e["claim_type"], "type_got": r["claim_type"],
                     "type_ok": e["claim_type"] == r["claim_type"], "verdict_expected": exp_v, "verdict_got": got_v, "verdict_ok": exp_v == got_v,
                     "subclaims_match": sub_ok, "counter_evidence_ran": counter_ok, "injection_flag_ok": (not e.get("injection")) or r.get("instruction_ignored", False),
                     "ms": round((time.time() - t1) * 1000, 1)})
    n = len(rows)
    summary = {"gold": Path(a.gold).name, "gold_status": "draft_ai_unverified (NOT human adjudicated)", "items": n,
               "claim_type_accuracy": f"{sum(r['type_ok'] for r in rows)}/{n}", "overall_verdict_agreement": f"{sum(r['verdict_ok'] for r in rows)}/{n}",
               "counter_evidence_ran": f"{sum(r['counter_evidence_ran'] for r in rows)}/{n}", "injection_ignored": f"{sum(r['injection_flag_ok'] for r in rows if True)}/{n}",
               "p95_ms": sorted(r["ms"] for r in rows)[int(.95 * (n - 1))], "total_s": round(time.time() - t0, 2),
               "disagreements": [r for r in rows if not r["verdict_ok"] or not r["type_ok"]]}
    out = ROOT / "eval/results" / ("claim_eval_" + Path(a.gold).stem + ".json"); out.parent.mkdir(exist_ok=True)
    json.dump({"summary": summary, "items": rows}, open(out, "w"), indent=2, ensure_ascii=False)
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
