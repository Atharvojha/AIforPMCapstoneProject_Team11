"""Score one arm (rules baseline or AI) and append a row to the iteration log.

    python3 src/run_eval.py baseline --note "first structural run"
    python3 src/run_eval.py ai --outputs data/outputs_ai_v0.jsonl --note "prompt v0"      # after lapfit.py run
    python3 src/run_eval.py ai --generate --items golden_v1.jsonl --note "prompt v0"      # runs lapfit first (needs credentials)

--items: data/items_inputs.jsonl (no labels: structural checks only) or the frozen golden_v1.jsonl from
validate_golden.py --export (adds recall, false dealbreakers, confidence, baseline comparison and the gate).
"""
import argparse
import csv
import datetime as dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE)
import eval_metrics as em  # noqa: E402

LOG_COLS = ["run_id", "arm", "model", "prompt_version", "items_file", "n_items", "labelled_items", "all_assertions_pass_rate",
            "quotes_verbatim_rate", "dealbreaker_recall", "false_dealbreaker_item_rate", "overconfident_item_rate",
            "insufficient_correct", "baseline_dealbreaker_exposure", "recall_minus_baseline", "gate", "top_failures", "note"]


def load(path):
    return [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("arm", choices=["baseline", "ai"])
    ap.add_argument("--items", default=os.path.join(ROOT, "data", "items_inputs.jsonl"))
    ap.add_argument("--outputs")
    ap.add_argument("--generate", action="store_true", help="ai arm: run lapfit.py first")
    ap.add_argument("--note", default="")
    ap.add_argument("--log", default=os.path.join(ROOT, "04_iteration_log.csv"))
    a = ap.parse_args()
    items = load(a.items)
    outputs_path = a.outputs or os.path.join(ROOT, "data", f"outputs_{a.arm}.jsonl")
    model = prompt = ""
    if a.arm == "baseline":
        import baseline_rules
        with open(outputs_path, "w", encoding="utf-8") as f:
            for it in items:
                f.write(json.dumps(baseline_rules.analyze(it["profile"], it["laptop"], it["reviews"], it["item_id"]), ensure_ascii=False) + "\n")
        model, prompt = "rules", "baseline_rules.py"
    elif a.generate:
        import lapfit
        lapfit.run(a.items, outputs_path)
    outputs = {}
    for o in load(outputs_path):
        outputs[o["item_id"]] = o
    if a.arm == "ai":
        metas = [o.get("_meta", {}) for o in outputs.values()]
        model = ",".join(sorted({m.get("model") or m.get("model_requested") or "?" for m in metas}))
        prompt = ",".join(sorted({m.get("prompt_version", "?") for m in metas}))
    outputs = {k: v for k, v in outputs.items() if not v.get("_failed")}
    agg, failures = em.aggregate(items, outputs)
    print(json.dumps({k: v for k, v in agg.items() if k != "assertion_pass_by_id"}, indent=2))
    print("assertions passed per check:", agg["assertion_pass_by_id"])
    for iid, msg in failures[:15]:
        print("FAIL", iid, msg)
    gate = "n/a (no labels)"
    if agg["labelled_items"]:
        rows = em.check_gate(agg)
        for name, v, rule, ok in rows:
            print(f"  {name:30s} {v if v is None else round(v, 3)!s:8s} need {rule:8s} {'PASS' if ok else 'not measured' if ok is None else 'FAIL'}")
        gate = "PASS" if all(r[3] for r in rows) else "NOT PASSED"
    row = {"run_id": dt.datetime.now().strftime("%Y%m%d-%H%M%S"), "arm": a.arm, "model": model, "prompt_version": prompt,
           "items_file": os.path.basename(a.items), "n_items": agg["items"], "labelled_items": agg["labelled_items"], "gate": gate,
           "top_failures": "; ".join(f"{i}:{m[:40]}" for i, m in failures[:3]), "note": a.note}
    for k in LOG_COLS:
        if k in agg and agg[k] is not None:
            row[k] = round(agg[k], 3) if isinstance(agg[k], float) else agg[k]
    new = not os.path.exists(a.log)
    with open(a.log, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=LOG_COLS)
        if new:
            w.writeheader()
        w.writerow(row)
    print("logged ->", a.log)


if __name__ == "__main__":
    main()
