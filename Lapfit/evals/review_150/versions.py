"""Assign every v3 row to release V1 (100), V2 (50) or V3 (20). Imported by merge_v3.py.
V1 = the main situations of every scenario plus a few edge cases; V2 = further edge cases; V3 = the hardest remainder.
Per scenario, quotas are proportional to its row count (largest remainder). Within a scenario rows are ordered by
stress (L1 happy, L2 edge, L5 noisy / L4 emotional, L3 adversarial) plus difficulty (easy, medium, hard)."""
import collections
TOTALS = {"V1": 100, "V2": 50, "V3": 20}
STRESS = {"L1": 0, "L2": 1, "L5": 2, "L4": 2, "L3": 3}
DIFF = {"easy": 0, "medium": 1, "hard": 2}
def _quota(sizes, total, cap=None):
    n = sum(sizes.values()); raw = {k: total * v / n for k, v in sizes.items()}
    q = {k: int(raw[k]) for k in sizes}
    if cap: q = {k: min(q[k], cap[k]) for k in q}
    for k in sorted(sizes, key=lambda k: -(raw[k] - int(raw[k]))):
        if sum(q.values()) >= total: break
        if not cap or q[k] < cap[k]: q[k] += 1
    return q
def assign(rows):
    by = collections.defaultdict(list)
    for r in rows: by[r["Case ID"].split("-")[0]].append(r)
    sizes = {k: len(v) for k, v in by.items()}
    q1 = _quota(sizes, TOTALS["V1"])
    rest = {k: sizes[k] - q1[k] for k in sizes}
    q2 = _quota(rest, TOTALS["V2"], cap=rest)
    out = {}
    for k, rs in by.items():
        rs = sorted(rs, key=lambda r: (STRESS[r["Stress level"]] + DIFF[r["Difficulty"]], STRESS[r["Stress level"]], r["Case ID"]))
        for i, r in enumerate(rs): out[r["Case ID"]] = "V1" if i < q1[k] else "V2" if i < q1[k] + q2[k] else "V3"
    return out
