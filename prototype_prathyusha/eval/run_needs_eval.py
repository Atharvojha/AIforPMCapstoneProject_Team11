"""Free-text needs parser evaluation (no model involved). python eval/run_needs_eval.py [--gold path]"""
import argparse, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "backend"))
from lapfit import advisor
ap = argparse.ArgumentParser(); ap.add_argument("--gold", default=str(ROOT / "eval/golden/g_needs_v1_heldout.json")); A = ap.parse_args()
G = json.load(open(A.gold))["items"]
use_ok = bud_ok = brand_ok = 0; tp = fp = fn = 0; bad = []
for g in G:
    n = advisor.parse_needs(g["text"]); got_b = n["budget"].get("max")
    u, b, br = sorted(n["uses"]) == g["uses"], (got_b == g["budget_max"]), sorted(n["brands_avoid"]) == g["brands_avoid"]
    use_ok += u; bud_ok += b; brand_ok += br
    gp, pp = set(g["priorities"]), set(n["priorities"]); tp += len(gp & pp); fp += len(pp - gp); fn += len(gp - pp)
    if not (u and b and br): bad.append({"id": g["id"], "text": g["text"], "uses": [g["uses"], sorted(n["uses"])], "budget": [g["budget_max"], got_b], "avoid": [g["brands_avoid"], sorted(n["brands_avoid"])]})
P = tp / (tp + fp) if tp + fp else 0; R = tp / (tp + fn) if tp + fn else 0
out = {"gold": Path(A.gold).name + " (AI-drafted, unverified)", "items": len(G), "uses_exact": f"{use_ok}/{len(G)}", "budget_exact": f"{bud_ok}/{len(G)}", "brands_avoid_exact": f"{brand_ok}/{len(G)}",
       "priority_precision": round(P, 3), "priority_recall": round(R, 3), "failures": bad}
(ROOT / "eval/results").mkdir(exist_ok=True); json.dump(out, open(ROOT / "eval/results" / ("needs_eval_" + Path(A.gold).stem + ".json"), "w"), indent=1, ensure_ascii=False)
print(json.dumps({k: v for k, v in out.items() if k != "failures"}, indent=1))
for b in bad: print(" ", b["id"], b["text"][:70], "| uses", b["uses"], "| budget", b["budget"], "| avoid", b["avoid"])
