#!/usr/bin/env python3
"""Extraction evaluation: stored model claims (after validators + guards) vs g_ext_v0.json gold, at (category, polarity) level per review."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "backend"))
from lapfit.db import connect  # noqa: E402
import argparse
ap = argparse.ArgumentParser(); ap.add_argument("--gold", default=str(ROOT / "eval/golden/g_ext_v0.json")); A = ap.parse_args()
G = json.load(open(A.gold)); c = connect()
tp = fp = fn = 0; pol_ok = pol_n = 0; empty_ok = empty_n = 0; rows = []; fps = []; fns = []
LAX = {"neutral": "mid", "mixed": "mid"}
for it in G["items"]:
    gold = {g["category"]: g["polarity"] for g in it["gold"]}
    got = {}
    for r in c.execute("SELECT category, polarity FROM evidence_claims WHERE review_id=?", (it["review_id"],)):
        got.setdefault(r["category"], []).append(r["polarity"])
    got = {k: max(set(v), key=v.count) for k, v in got.items()}
    if not gold:
        empty_n += 1; empty_ok += (len(got) == 0)
    for k in gold:
        if k in got:
            tp += 1; pol_n += 1; pol_ok += (LAX.get(gold[k], gold[k]) == LAX.get(got[k], got[k]))
        else:
            fn += 1; fns.append((it["item_id"], k, gold[k]))
    for k in got:
        if k not in gold:
            fp += 1; fps.append((it["item_id"], k, got[k]))
P = tp / (tp + fp) if tp + fp else 0; R = tp / (tp + fn) if tp + fn else 0
summary = {"gold": Path(A.gold).name + " (AI-drafted, unverified)", "reviews": len(G["items"]), "gold_claims": tp + fn, "model_claims": tp + fp,
           "category_precision": round(P, 3), "category_recall": round(R, 3), "category_f1": round(2 * P * R / (P + R), 3) if P + R else 0,
           "polarity_accuracy_on_matched": f"{pol_ok}/{pol_n}", "reviews_with_no_claim_gold_handled": f"{empty_ok}/{empty_n}",
           "false_positives": fps, "misses": fns}
out = ROOT / "eval/results" / ("ext_eval_" + Path(A.gold).stem + ".json"); out.parent.mkdir(exist_ok=True); json.dump(summary, open(out, "w"), indent=1)
print(json.dumps(summary, indent=1))
