"""Merge rewrite_S1..S6.json into Laptop_Recommendation_Evals_150.xlsx (in place, after a backup).
Usage (from the Lapfit folder): python3 -I evals/review_150/merge_into_workbook.py
- Backs up the original once to Laptop_Recommendation_Evals_150_v1_original.xlsx.
- Cases: rewrites columns A-M and S for all 150 rows; adds columns T-Z (LapFit UC ... Needs native check).
- Assertions: old v1 assertions moved to 'Assertions_v1_archive'; 'Assertions' kept (headers only) so formulas still work.
- Adds 'Review_v1' (verdicts on the old rows) and 'Coverage_v2' (counts); updates 'Guide' and 'Sources'."""
import json, shutil, collections
from copy import copy
from pathlib import Path
import openpyxl
from openpyxl.styles import Alignment

ROOT = Path(".").resolve(); RV = ROOT / "evals/review_150"
XL = ROOT / "Laptop_Recommendation_Evals_150.xlsx"; BK = ROOT / "Laptop_Recommendation_Evals_150_v1_original.xlsx"
if not BK.exists(): shutil.copy2(XL, BK)
wb = openpyxl.load_workbook(BK)  # always rebuild from the pristine original
rows = []
for s in range(1, 7): rows += json.load(open(RV / f"rewrite_S{s}.json"))
assert len(rows) == 150, len(rows)
ws = wb["Cases"]
cols = {ws.cell(1, c).value: c for c in range(1, ws.max_column + 1)}
NEW = ["LapFit UC", "Language", "Stress level", "Expected behaviour", "Expected format", "Hold-out", "Needs native check"]
hdr = ws.cell(1, cols["Review notes"])
for i, name in enumerate(NEW):
    c = ws.max_column + 1 if name not in cols else cols[name]
    cell = ws.cell(1, c, name); cell.font = copy(hdr.font); cell.fill = copy(hdr.fill); cell.alignment = copy(hdr.alignment); cell.border = copy(hdr.border)
    ws.column_dimensions[cell.column_letter].width = 22 if name == "Expected behaviour" else 14
    cols[name] = c
id2row = {ws.cell(r, 1).value: r for r in range(2, ws.max_row + 1)}
for d in rows:
    r = id2row[d["Case ID"]]
    for k in ["Scenario", "Persona", "Input query", "Ideal output", "Evidence context", "Situation", "Category tags", "Evidence mode",
              "Prompt style", "Difficulty", "Inspiration source IDs", "Review notes"] + NEW:
        ws.cell(r, cols[k], d[k])
    ws.cell(r, cols["Independent review"], "Rewritten v2 (13 Nov 2026); validator passed; pending two-person human review")
    ws.cell(r, cols["Actual response"], None)
    ws.cell(r, cols["Assertion count"], f'=COUNTIF(Assertions!$A:$A,A{r})')
    ws.cell(r, cols["Passed"], f'=COUNTIFS(Assertions!$A:$A,A{r},Assertions!$G:$G,"Pass")')
    ws.cell(r, cols["Failed"], f'=COUNTIFS(Assertions!$A:$A,A{r},Assertions!$G:$G,"Fail")')
    ws.cell(r, cols["Eval status"], f'=IF(O{r}=0,"Needs assertions",IF(N{r}="","Not run",IF(Q{r}>0,"Fail",IF(P{r}=O{r},"Pass","Pending"))))')
    for k in NEW:
        src = ws.cell(r, cols["Review notes"]); c = ws.cell(r, cols[k])
        c.font = copy(src.font); c.alignment = Alignment(wrap_text=True, vertical="top"); c.border = copy(src.border)
ws.auto_filter.ref = f"A1:{ws.cell(1, ws.max_column).column_letter}{ws.max_row}"

# Assertions: archive v1, keep header-only sheet
a = wb["Assertions"]; arc = wb.copy_worksheet(a); arc.title = "Assertions_v1_archive"
a.delete_rows(2, a.max_row)
a.cell(2, 1, "(v2: assertions to be rewritten for the new cases. v1 assertions are in Assertions_v1_archive and do NOT match the v2 cases.)")

# Review_v1 sheet
rv = wb.create_sheet("Review_v1")
rv.append(["Case ID", "Scenario", "Old-row verdict", "Situation type", "LapFit UC", "Issues found in v1 row", "Assertion issues (v1)"])
for s in range(1, 7):
    p = RV / f"review_S{s}.json"
    if not p.exists(): continue
    j = json.load(open(p))
    for x in j["rows"]:
        rv.append([x.get("case"), f"S{s}", x.get("verdict"), x.get("situation_type"), x.get("lapfit_uc"), " | ".join(x.get("issues", [])), " | ".join(x.get("assertion_issues", []))])
for c, w in zip("ABCDEFG", (9, 8, 12, 12, 14, 80, 60)): rv.column_dimensions[c].width = w
for c in rv[1]: c.font = copy(hdr.font); c.fill = copy(hdr.fill)
for row in rv.iter_rows(min_row=2):
    for c in row: c.alignment = Alignment(wrap_text=True, vertical="top")

# Coverage_v2 sheet
cv = wb.create_sheet("Coverage_v2")
def block(title, key):
    cnt = collections.Counter(d[key] for d in rows); cv.append([title]); cv.cell(cv.max_row, 1).font = copy(hdr.font); cv.cell(cv.max_row, 1).fill = copy(hdr.fill)
    for k, v in sorted(cnt.items(), key=lambda x: -x[1]): cv.append([k, v])
    cv.append([])
for t, k in [("Scenario", "Scenario"), ("LapFit use case", "LapFit UC"), ("Language", "Language"), ("Stress level", "Stress level"), ("Expected format", "Expected format"),
             ("Evidence mode", "Evidence mode"), ("Difficulty", "Difficulty"), ("Hold-out", "Hold-out"), ("Needs native check", "Needs native check"), ("Persona", "Persona")]:
    block(t, k)
cv.column_dimensions["A"].width = 48; cv.column_dimensions["B"].width = 8

# Guide updates
g = wb["Guide"]; gi = {g.cell(r, 1).value: r for r in range(1, g.max_row + 1)}
langs = collections.Counter(d["Language"] for d in rows); noev = sum(d["Evidence mode"] == "no_evidence" for d in rows)
upd = {
 "Purpose": "v2 (13 Nov 2026): 150 rewritten input–output cases for LapFit, a review-grounded laptop second-opinion assistant for India. Six scenarios × 25. Each scenario is stress-tested from ≥9 personas at five stress levels (L1 happy, L2 edge, L3 adversarial/pressure, L4 emotional, L5 noisy input), with LapFit use cases UC1–UC5 mapped per row.",
 "Scope decision": "Same 150 Case IDs as v1; every input query, evidence context and ideal output was rewritten after a criteria-based review of v1 (see Review_v1, and evals/review_150/REVIEW_REPORT.md). v1 is kept unchanged in Laptop_Recommendation_Evals_150_v1_original.xlsx.",
 "Test data": "All laptop names, prices, specs and review records in Evidence context are fictional fixtures (names unique across the workbook). Each review record states n owners, reviewer type and recency. They are not real products or reviews.",
 "Pair review": "v1: three writer–checker pairs. v2: six scenario writers, each reviewing v1 against criteria V1–V10, then rewriting; every v2 row passed check_rewrite.py (citations, numbers, ≤2 questions, banned words, language mix, quotas, unique names). Still needs two-person human review before use as a golden set.",
 "Coverage and reuse": "Filter columns T–Z (LapFit UC, Language, Stress level, Expected behaviour, Expected format, Hold-out, Needs native check). Hold-out: 5 per scenario (30 total), never used when tuning prompts. Product names are unique, so splitting by row does not leak.",
 "Total assertions": "0 in v2 (to be written next). v1's 768 assertions are archived in Assertions_v1_archive and do not match the v2 cases.",
 "Cases with review evidence": str(150 - noev), "No-evidence cases": str(noev),
 "Prepared on": "v1 and v2: 13 November 2026.",
}
for k, v in upd.items():
    if k in gi: g.cell(gi[k], 2, v)
g.append(["Languages (v2)", ", ".join(f"{k}: {v}" for k, v in langs.items()) + ". te-en and ta-en rows need a native-speaker check."])
g.append(["Expected format (v2)", "F1 verdict+reasons · F2 comparison table · F3 claim-by-claim · F4 ranked shortlist · F5 cost breakdown · F6 checklist · F7 clarify with quick replies · F8 if-then · F9 evidence summary · F10 step plan (see evals/review_150/VALIDATION_CRITERIA.md)."])
for r in (g.max_row - 1, g.max_row):
    for c in (1, 2): g.cell(r, c).alignment = Alignment(wrap_text=True, vertical="top")

# Sources: LapFit research patterns
so = wb["Sources"]
so.append(["R-001…R-090", "TechEnclave, DesiDime, Reddit/Quora (snippets)", "LapFit real query patterns (Lapfit/research/real_query_patterns.md)", "see file", "2026-11-13", "65 patterns from opened pages, 25 from search snippets", "Paraphrased phrasing only; inspiration for v2 queries."])
wb.save(XL)
print("merged", len(rows), "rows; languages", dict(langs), "; no-evidence", noev)
