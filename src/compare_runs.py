"""Compare several AI runs against the golden labels, with the failure classes broken out.

    python3 src/compare_runs.py data/golden_draft.jsonl "v0 run1=data/outputs_ai_v0.jsonl" "v1 run1=data/outputs_ai_v1_r1.jsonl" ...

Columns: dealbreakers found / gold, items with a false dealbreaker, single complaints escalated (gold says watch-out),
dealbreakers named in total, gold dealbreakers shown only as a watch-out or not mentioned, overconfident items,
'Insufficient' answered correctly, share of outputs passing every assertion. Also prints the stability of each pair of runs
with the same prompt (same dealbreaker set / same confidence) so the noise band is visible next to any delta.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import eval_metrics as em

RANK = {"Insufficient": 0, "Low": 1, "Medium": 2, "High": 3}


def load(path):
    d = {}
    for ln in open(path, encoding="utf-8"):
        o = json.loads(ln)
        if not o.get("_failed"):
            d[o["item_id"]] = o
    return d


def summarise(gold, out):
    agg, _ = em.aggregate(list(gold.values()), out)
    hit = gtot = esc = other_false = miss_watch = miss_none = over = ins_ok = ins_n = 0
    for iid, g in gold.items():
        e, o = g["expected"], out[iid]
        pd = {d["aspect"] for d in o["dealbreakers"]}
        pw = {d["aspect"] for d in o["watchouts"]}
        for a in e["dealbreakers"]:
            gtot += 1
            if a in pd:
                hit += 1
            elif a in pw:
                miss_watch += 1
            else:
                miss_none += 1
        for a in pd - set(e["dealbreakers"]):
            if a in e["watchouts"]:
                esc += 1
            else:
                other_false += 1
        over += RANK[o["confidence"]] > RANK[e["confidence"]]
        if e["confidence"] == "Insufficient":
            ins_n += 1
            ins_ok += o["confidence"] == "Insufficient"
    return {"found": f"{hit}/{gtot}", "false_items": f"{agg['false_dealbreaker_item_rate']:.1%}", "escalated": esc, "other_false": other_false,
            "named": sum(len(x["dealbreakers"]) for x in out.values()), "miss_as_watch": miss_watch, "miss_unmentioned": miss_none,
            "overconf": f"{over / len(gold):.1%}", "insufficient_ok": f"{ins_ok}/{ins_n}", "all_assertions": f"{agg['all_assertions_pass_rate']:.1%}",
            "quotes": f"{agg['quotes_verbatim_rate']:.1%}"}


def main():
    gold = {json.loads(l)["item_id"]: json.loads(l) for l in open(sys.argv[1], encoding="utf-8")}
    runs = {}
    for spec in sys.argv[2:]:
        name, path = spec.split("=", 1)
        runs[name] = load(path)
    common = set.intersection(*(set(o) for o in runs.values()))
    if len(common) < len(gold):
        print(f"NOTE: comparing the {len(common)} items every run has; left out: {sorted(set(gold) - common)}\n")
    gold = {i: gold[i] for i in gold if i in common}
    rows = {n: summarise(gold, o) for n, o in runs.items()}
    cols = list(next(iter(rows.values())))
    print(f'{"":10s}' + "".join(f"{c:>17s}" for c in cols))
    for n, r in rows.items():
        print(f"{n:10s}" + "".join(f"{str(r[c]):>17s}" for c in cols))
    print()
    groups = {}
    for n in runs:
        groups.setdefault(n.split()[0], []).append(n)
    for g, names in groups.items():
        if len(names) >= 2:
            a, b = runs[names[0]], runs[names[1]]
            same_d = sum({d["aspect"] for d in a[i]["dealbreakers"]} == {d["aspect"] for d in b[i]["dealbreakers"]} for i in gold)
            same_c = sum(a[i]["confidence"] == b[i]["confidence"] for i in gold)
            print(f"{g}: two runs agree on the dealbreaker set for {same_d}/{len(gold)} items and on confidence for {same_c}/{len(gold)}")


if __name__ == "__main__":
    main()
