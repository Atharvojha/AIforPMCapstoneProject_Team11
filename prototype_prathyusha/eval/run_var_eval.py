#!/usr/bin/env python3
"""Variant/search evaluation against g_var_v0.jsonl (hand-written gold from listing titles). Uses the real /search endpoint logic."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "backend"))
from fastapi.testclient import TestClient  # noqa: E402
import lapfit.api as api  # noqa: E402
items = [json.loads(l) for l in open(ROOT / "eval/golden/g_var_v0.jsonl")]
res = []
with TestClient(api.app) as c:
    for it in items:
        r = c.get("/api/v1/search", params={"q": it["query"]}).json()
        got = [m["variant_id"] for m in r["matches"]]; k = it["expected_kind"]; exp = it["expected_variant_ids"]
        if k == "match": ok = len(got) >= 1 and got[0] == exp[0] and r["intent"] == "laptop"; kind_got = "match" if got else r["intent"]
        elif k == "ambiguous": ok = r["intent"] == "ambiguous" and set(exp) <= set(got) and not (set(got) - set(exp)); kind_got = r["intent"]
        elif k == "unknown_laptop": ok = r["intent"] == "laptop" and got == [] and r["research_offer"] is not None; kind_got = r["intent"] + (":matched " + ",".join(got) if got else "")
        else: ok = r["intent"] == "out_of_scope"; kind_got = r["intent"]
        res.append({"id": it["item_id"], "query": it["query"], "kind": k, "expected": exp, "got": got, "intent": r["intent"], "ok": ok})
def rate(kind):
    s = [r for r in res if r["kind"] == kind]; return f"{sum(r['ok'] for r in s)}/{len(s)}"
typo = [r for r in res if r["id"] in ("V27", "V28", "V29")]
summary = {"gold": "g_var_v0.jsonl (AI-drafted, unverified)", "items": len(res), "overall": f"{sum(r['ok'] for r in res)}/{len(res)}", "top1_match": rate("match"), "ambiguity_detected": rate("ambiguous"),
           "unknown_laptop_not_forced": rate("unknown_laptop"), "out_of_scope_correct": rate("out_of_scope"), "typo_cases_correct": f"{sum(r['ok'] for r in typo)}/{len(typo)}",
           "failures": [r for r in res if not r["ok"]]}
out = ROOT / "eval/results/var_eval_latest.json"; out.parent.mkdir(exist_ok=True); json.dump({"summary": summary, "items": res}, open(out, "w"), indent=2)
print(json.dumps(summary, indent=2))
