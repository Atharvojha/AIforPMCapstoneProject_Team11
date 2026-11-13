"""Merge v3_G1..G6.json into Laptop_Recommendation_Evals_150.xlsx (in place; v2 backed up once).
Run from Lapfit/: python3 -I evals/review_150/merge_v3.py"""
import json, shutil, collections, glob
from copy import copy
from pathlib import Path
import openpyxl, sys
sys.path.insert(0, str(Path(__file__).resolve().parent)); import versions
from openpyxl.styles import Alignment, PatternFill

ROOT = Path(".").resolve(); RV = ROOT / "evals/review_150"
XL = ROOT / "Laptop_Recommendation_Evals_150.xlsx"; BK = ROOT / "Laptop_Recommendation_Evals_150_v2.xlsx"
if not BK.exists(): shutil.copy2(XL, BK)
wb = openpyxl.load_workbook(BK)
rows = []
for f in sorted(glob.glob(str(RV / "v3_G*.json"))): rows += json.load(open(f))
ORDER = ["SL", "SO", "PC", "UC", "BO", "OV", "RT", "MD", "SP", "BI", "RG"]
VER = versions.assign(rows)
for r in rows: r["Version"] = VER[r["Case ID"]]
rows.sort(key=lambda r: (r["Version"], ORDER.index(r["Case ID"].split("-")[0]), r["Case ID"]))
old = wb["Cases"]; hdr = old.cell(1, 1); body = old.cell(2, 5)
old.title = "Cases_v2_archive"
ws = wb.create_sheet("Cases", 0)
COLS = ["Version", "Case ID", "Scenario", "Feature", "AI component", "Persona", "Input", "Evidence context", "Ideal output", "Output type", "Expected flow",
        "Expected behaviour", "Expected format", "Assertion hooks", "Language", "Stress level", "Difficulty", "Evidence mode", "Hold-out",
        "Needs native check", "Situation", "Category tags", "Source", "Inspiration source IDs", "Review notes",
        "Actual response", "Assertion count", "Passed", "Failed", "Eval status"]
WID = {"Version": 9, "Input": 60, "Evidence context": 70, "Ideal output": 90, "Assertion hooks": 70, "Review notes": 50, "Actual response": 60, "Situation": 30, "Persona": 22, "Scenario": 18}
ws.append(COLS)
for i, c in enumerate(ws[1], 1):
    c.font = copy(hdr.font); c.fill = copy(hdr.fill); c.alignment = Alignment(wrap_text=True, vertical="center"); c.border = copy(hdr.border)
    ws.column_dimensions[c.column_letter].width = WID.get(COLS[i - 1], 14)
yellow = PatternFill("solid", fgColor="FFFFF2CC")
L = {name: openpyxl.utils.get_column_letter(i) for i, name in enumerate(COLS, 1)}
BANNER = {"V1": "VERSION 1 (V1) · 100 cases · the main situations of every scenario plus a few edge cases",
          "V2": "VERSION 2 (V2) · 50 cases · further edge cases: emotional, noisy-input and pressure situations",
          "V3": "VERSION 3 (V3) · 20 cases · the hardest adversarial cases"}
bfill = PatternFill("solid", fgColor="FF1F4E79"); from openpyxl.styles import Font
n, prev = 1, None
for r in rows:
    n += 1
    if r["Version"] != prev:
        prev = r["Version"]; ws.cell(n, 1, BANNER[prev])
        ws.merge_cells(start_row=n, start_column=1, end_row=n, end_column=len(COLS))
        c = ws.cell(n, 1); c.fill = bfill; c.font = Font(bold=True, color="FFFFFFFF", size=12); c.alignment = Alignment(vertical="center")
        ws.row_dimensions[n].height = 24; n += 1
    for k in COLS[:25]: ws.cell(n, COLS.index(k) + 1, r[k])
    a, nn = L["Case ID"], n
    ws[f"{L['Assertion count']}{nn}"] = f'=COUNTIF(Assertions!$A:$A,{a}{nn})'
    ws[f"{L['Passed']}{nn}"] = f'=COUNTIFS(Assertions!$A:$A,{a}{nn},Assertions!$G:$G,"Pass")'
    ws[f"{L['Failed']}{nn}"] = f'=COUNTIFS(Assertions!$A:$A,{a}{nn},Assertions!$G:$G,"Fail")'
    ws[f"{L['Eval status']}{nn}"] = f'=IF({L["Assertion count"]}{nn}=0,"Needs assertions",IF({L["Actual response"]}{nn}="","Not run",IF({L["Failed"]}{nn}>0,"Fail",IF({L["Passed"]}{nn}={L["Assertion count"]}{nn},"Pass","Pending"))))'
    for c in ws[nn]:
        c.alignment = Alignment(wrap_text=True, vertical="top"); c.font = copy(body.font); c.border = copy(body.border)
    ws[f"{L['Actual response']}{nn}"].fill = yellow
    ws.row_dimensions[nn].height = 150
ws.freeze_panes = "C2"; ws.auto_filter.ref = f"A1:{L['Eval status']}{n}"

# Scenarios_v3 overview
sc = wb.create_sheet("Scenarios_v3", 1)
sc.append(["Code", "Scenario", "Feature", "AI component(s) under test", "Rows", "V1", "V2", "V3", "Hold-out", "Languages", "What the assertions focus on"])
FOCUS = {"SL": "Must never violated or silently dropped; relax-one-Must; 3 cards; price and as-of match; n<20 rule; reply language",
 "SO": "Variant resolution (ask when ambiguous); not-in-catalog honesty; Must ticks; ≤2 alternatives meeting every Must; n<20 rule",
 "PC": "Claim split recall/precision; claim type; code status labels; verdict only from approved ledger rows; 'Not checked yet'; neutral wording",
 "UC": "Flags fire and don't fire correctly; no buy/don't-buy verdict; checklist and cannot-judge list; nulls for unstated fields",
 "BO": "≤2 questions; recipient and role parsing; per-role Musts; exact totals vs budget; persona defaults shown as editable",
 "OV": "Filters extracted from the question; unknown persona/topic reported back; counts and n exact; n<20 = not enough evidence; summary faithful",
 "RT": "P8 JSON fields; closed-list membership; null when unstated; low confidence on mixed topics; injection ignored",
 "MD": "P5 flags recall on personal data and abuse; no false abuse flag on fair complaints; never approves or rewrites",
 "SP": "P1g extraction nulls; plan figures equal sell.js recomputation; Do/Skip consistent with ₹500 net; no ₹ for out-of-catalog; listing text faithful",
 "BI": "Every number in the note exists in the input; no causes or forecasts; early-signal wording under 20",
 "RG": "Correct flow incl. clarify/out_of_scope/not_laptop; one question with 2–4 choices under 0.6; follow-up button for mixed requests; injection logged"}
by = collections.defaultdict(list)
for r in rows: by[r["Case ID"].split("-")[0]].append(r)
for code in ORDER:
    rs = by.get(code, [])
    if not rs: continue
    lang = collections.Counter(r["Language"] for r in rs)
    sc.append([code, rs[0]["Scenario"], rs[0]["Feature"], rs[0]["AI component"], len(rs), *[sum(r["Version"] == v for r in rs) for v in ("V1", "V2", "V3")], sum(r["Hold-out"] == "yes" for r in rs),
               ", ".join(f"{k} {v}" for k, v in lang.items()), FOCUS[code]])
sc.append(["", "Total", "", "", len(rows), *[sum(r["Version"] == v for r in rows) for v in ("V1", "V2", "V3")], sum(r["Hold-out"] == "yes" for r in rows), "", ""])
sc.append([]); sc.append(["—", "Not AI-evaluated", "F07 Market pulse, F08 My laptops; rule/SQL parts of all features (filters, flags, price band, sell-plan maths, brand counts)", "None (no model)", "", "", "", "", "", "", "Fixture tests with hand-computed answers (repo eval plan), not input–output AI evals"])
for c in sc[1]: c.font = copy(hdr.font); c.fill = copy(hdr.fill)
for col, w in zip("ABCDEFGHIJK", (7, 26, 9, 30, 6, 5, 5, 5, 9, 24, 80)): sc.column_dimensions[col].width = w
for row in sc.iter_rows(min_row=2):
    for c in row: c.alignment = Alignment(wrap_text=True, vertical="top")

# Coverage_v3
cv = wb.create_sheet("Coverage_v3", 2)
for title, key in [("Version", "Version"), ("Scenario", "Scenario"), ("Expected flow", "Expected flow"), ("Language", "Language"), ("Stress level", "Stress level"),
                   ("Expected behaviour", "Expected behaviour"), ("Output type", "Output type"), ("Difficulty", "Difficulty"), ("Hold-out", "Hold-out"),
                   ("Source", "Source"), ("Persona", "Persona")]:
    cnt = collections.Counter(("adapted" if key == "Source" and r[key].lower().startswith("adapted") else r[key]) for r in rows)
    cv.append([title]); cv.cell(cv.max_row, 1).font = copy(hdr.font); cv.cell(cv.max_row, 1).fill = copy(hdr.fill)
    for k, v in sorted(cnt.items(), key=lambda x: -x[1]): cv.append([k, v])
    cv.append([])
cv.column_dimensions["A"].width = 50

# Guide
g = wb["Guide"]; gi = {g.cell(r, 1).value: r for r in range(1, g.max_row + 1)}
langs = collections.Counter(r["Language"] for r in rows)
upd = {"Purpose": f"v3 (13 Nov 2026): {len(rows)} input–output eval cases for every AI component in the repo spec (lapfit-project/, decisions D-01–D-15, prompts P1–P8). 11 scenarios (sheet Scenarios_v3), 12–18 rows each, persona-driven and stress-tested at five levels.",
       "Scope decision": "The repo spec is the standard (Sri, D-L12). v2 (150 rows, 6 scenarios) is kept in Cases_v2_archive and in Laptop_Recommendation_Evals_150_v2.xlsx; strong v2 rows were adapted to the repo rules (Source column). F07, F08 and all rule/SQL parts have no AI and are tested with fixtures, not here.",
       "How to run": "Pass Input + Evidence context to the system (no Ideal output, hooks or notes). For RG, compare the router JSON with the EXPECTED ROUTER line. RT and MD are JSON outputs: compare field by field. SP: compare the EXTRACTION JSON and recompute plan figures with sell.js.",
       "Deterministic checks": "Column 'Assertion hooks' lists 3–7 checks per row, each tagged [code] or [judge], at least one (critical). Turn [code] hooks into programmatic assertions first; [judge] hooks go to the P9 judge after it is calibrated against two humans.",
       "Total cases": str(len(rows)), "Total assertions": "To be written from 'Assertion hooks' (next step). v1 assertions archived in Assertions_v1_archive.",
       "Cases with review evidence": str(sum(r["Evidence mode"] == "provided_evidence" for r in rows)), "No-evidence cases": str(sum(r["Evidence mode"] == "no_evidence" for r in rows)),
       "Pair review": "v3 rows written by six groups against SPEC_V3.md and validated by check_v3.py (structure, quotas, citations, n<20 rule, JSON validity, banned words, '!' and question count, unique product names); SP figures recomputed with a sell.js re-implementation. Languages: English and Hinglish only (Sri, 13 Nov; Telugu- and Tamil-English rows were converted). Still needs two-person human review.",
       "Coverage and reuse": "Hold-out: 3 per scenario (2 for BI). Product names are unique per row, so splitting by row does not leak. Filter by Scenario, Expected flow, Language, Stress level, Hold-out."}
for k, v in upd.items():
    if k in gi: g.cell(gi[k], 2, v)
for k in ["S1 First shortlist", "S2 Second opinion between options", "S3 Workload and compatibility fit", "S4 Review conflict and trust", "S5 Budget, buying risk and longevity", "S6 Underspecified, changing or impossible needs"]:
    if k in gi: g.cell(gi[k], 2, "v2 scenario (archived). See Scenarios_v3 for v3.")
g.append(["Versions", "V1 = 100 cases: the main situations of every scenario plus a few edge cases. V2 = 50 further edge cases (emotional, noisy input, pressure). V3 = 20 hardest adversarial cases. Split per scenario in proportion to its size; within a scenario rows are ordered by stress level and difficulty (evals/review_150/versions.py). Each block in Cases starts with a dark-blue version banner; filter on the Version column."])
g.append(["Languages (v3)", ", ".join(f"{k}: {v}" for k, v in langs.items())])
wb.move_sheet("Guide", offset=-(wb.sheetnames.index("Guide") - 3))
wb.save(XL)
print("v3 merged:", len(rows), "rows;", {k: len(v) for k, v in by.items()}, "; languages", dict(langs))
