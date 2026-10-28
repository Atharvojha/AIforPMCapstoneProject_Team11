"""Agreement between two raters (human vs human, or human consensus vs LLM judge).

Input: CSV or XLSX in the wide format of 03_human_rating_sheet.xlsx:
    item_id, run_id, rater, C1, C2, C3, C4, C5, comment      (verdicts are Pass or Fail)

    python3 src/judge_agreement.py ratings.xlsx --a human --b judge
    python3 src/judge_agreement.py ratings.xlsx --a rater1 --b rater2

Prints, per criterion and pooled: n, percent agreement, Cohen's kappa, and (treating --a as the reference)
the precision and recall of --b's Fail verdicts. Rows with the word EXAMPLE in item_id are ignored.
"""
import argparse
import csv
import sys

CRITERIA = ["C1", "C2", "C3", "C4", "C5"]


def read_rows(path):
    if path.lower().endswith((".xlsx", ".xlsm")):
        from openpyxl import load_workbook
        ws = load_workbook(path, data_only=True)["Ratings"]
        head = [c.value for c in ws[1]]
        return [dict(zip(head, r)) for r in ws.iter_rows(min_row=2, values_only=True) if any(r)]
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def kappa(pairs):
    n = len(pairs)
    if n == 0:
        return None
    labels = ["Pass", "Fail"]
    po = sum(a == b for a, b in pairs) / n
    pe = sum((sum(a == l for a, _ in pairs) / n) * (sum(b == l for _, b in pairs) / n) for l in labels)
    if pe == 1:
        return 1.0 if po == 1 else 0.0
    return (po - pe) / (1 - pe)


def collect(rows, ra, rb):
    by = {}
    for r in rows:
        if "EXAMPLE" in str(r.get("item_id", "")).upper() or not r.get("rater"):
            continue
        by.setdefault((r["item_id"], r.get("run_id")), {})[str(r["rater"]).strip()] = r
    out = {c: [] for c in CRITERIA}
    for key, raters in by.items():
        if ra in raters and rb in raters:
            for c in CRITERIA:
                a, b = raters[ra].get(c), raters[rb].get(c)
                if a in ("Pass", "Fail") and b in ("Pass", "Fail"):
                    out[c].append((a, b))
    return out


def summarise(pairs):
    n = len(pairs)
    if n == 0:
        return {"n": 0}
    tp = sum(a == "Fail" and b == "Fail" for a, b in pairs)
    fp = sum(a == "Pass" and b == "Fail" for a, b in pairs)
    fn = sum(a == "Fail" and b == "Pass" for a, b in pairs)
    return {
        "n": n,
        "agree": round(sum(a == b for a, b in pairs) / n, 3),
        "kappa": None if kappa(pairs) is None else round(kappa(pairs), 3),
        "fail_precision": round(tp / (tp + fp), 3) if tp + fp else None,
        "fail_recall": round(tp / (tp + fn), 3) if tp + fn else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ratings")
    ap.add_argument("--a", required=True, help="reference rater name (e.g. human)")
    ap.add_argument("--b", required=True, help="other rater name (e.g. judge)")
    a = ap.parse_args()
    data = collect(read_rows(a.ratings), a.a, a.b)
    print(f"reference={a.a}  other={a.b}")
    for c in CRITERIA:
        print(c, summarise(data[c]))
    pooled = [p for c in CRITERIA for p in data[c]]
    s = summarise(pooled)
    print("POOLED", s)
    if s.get("n", 0) < 20:
        print("WARNING: fewer than 20 paired verdicts; the plan asks for 20 outputs x 5 criteria.")
    sys.exit(0)


if __name__ == "__main__":
    main()
