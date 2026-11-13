# Review of `Laptop_Recommendation_Evals_150.xlsx`

13 Nov 2026 · **Status: partial.**

- **Done:** the mechanical checks cover all 150 rows, and the dataset-level checks are done.
- **Row review:** S1 (25 rows) is reviewed. S2–S6 (125 rows) are not, because the parallel reviewer agents failed with an API login error (HTTP 403).
- **No changes made:** nothing in the workbook has been changed (waiting for Sri's approval).

Criteria: `VALIDATION_CRITERIA.md`. Per-row results: `review_S1.json`. Mechanical results: `auto_checks.json`.

## 1. What the workbook is

- **What it tests:** 150 cases across 6 scenarios (S1–S6, 25 each), with 768 assertions.
- **Fixtures:** each case brings its own **fictional** catalogue and review snippets ("Evidence context"). The model must answer from those alone.
- **Which layer it covers:** this tests LapFit's **answer-writing layer** (grounding, calibration, trade-offs, clarifying, tone), given retrieved evidence.
- **What it doesn't test:** the catalogue filter, real specs or real reviews. Those need LapFit's own oracle tests on real data. The two are complementary.

## 2. Mechanical checks (all 150 rows, `auto_checks.py`)

| Check | Result |
|---|---|
| Every cited [ID] exists in that row's evidence | ✅ 150/150 |
| No product name outside that row's evidence | ✅ 150/150 |
| No cited ID in no-evidence rows | ✅ 23/23 |
| Every number traceable to the evidence, the query or simple arithmetic | 142/150. 8 to check by hand (A048, B001, B016, C005, C007, C012, C021, C025), of which 2–3 are false positives ("when" read as "wh") |
| Quoted phrases exact | 147/150 (B050, C046, C049: quotes of the user's or seller's words, still to check) |
| Hinglish query → Hinglish reply | 3 mismatches flagged by code (B001, B044, C001), plus A023 and A025 found by reading |
| Length | 53–97 words, median 85: good |

## 3. S1 row review (25 rows): KEEP 20 · POLISH 5 · FIX 0

**Factually the S1 ideals are excellent:**
- the right decision, budget honoured, citations on the right product;
- the trade-off named, no guarantees, a concrete next step.

A014 is a model answer: it notices that 6.5 hours barely clears a 6-hour need.

| Row | Verdict | Why | Proposed fix |
|---|---|---|---|
| A003 | POLISH | The user said "I don't understand processor names"; the reply still says "memory", "viewing-angle" | Plain words ("screen looks washed out unless you sit straight in front") |
| A013 | POLISH | A citation is attached to a catalogue price, not the review | Move the citation |
| A023 | POLISH | Hinglish query, English reply; 3–4 questions (LapFit max 2); typo | Hinglish, 2 questions with quick-reply options (F7) |
| A024 | POLISH | Asks about 4 things: a questionnaire | 2 questions (F7) |
| A025 | POLISH | Hinglish query, English reply; ranking request only | Hinglish if-then trade-off (F8) |

The full proposed texts are in `review_S1.json`.

## 4. Dataset-level findings (these matter more than single rows)

| # | Finding | Why it matters | Recommendation |
|---|---|---|---|
| D1 | **One template dominates S1.** 22/25 rows: 2 options, 1 review each, and a decoy that is clearly worse | The model can pass by spotting the obvious decoy. Close calls, 3–4 options, "neither fits" and ranking are untested | Add close-call rows (both options partly fit), 3–4 options, and "none fits the Musts" rows |
| D2 | **All 768 assertions are typed "semantic"** | Budget ceilings, "uses both citations", and "≤2 questions" can be checked exactly by code. The course deck says to use assertions, not an LLM, for constrained checks | Re-type about 150+ assertions as deterministic (budget, citation presence, question count, language) |
| D3 | **No language assertion anywhere** | Hinglish-in/English-out passes today. LapFit requires a language match | Add "replies in the user's language" to every code-mixed row |
| D4 | **Only 8 code-mixed rows (all Hinglish); 0 Telugu- or Tamil-English** | LapFit's per-segment gate needs about 20 rows per segment | Add ≥12 Hinglish and ≥10 each te-en and ta-en (native-speaker check) |
| D5 | **About 10 non-India rows (USD, GBP, CAD, EUR)** | LapFit is India-only | Keep 2–3 as currency-robustness tests; convert the rest to India |
| D6 | **Sample size is ambiguous.** Fixtures say "each may summarise one or more reports", while ideals say "a singer", "one report" | Calibration (V3) can't be graded consistently, and LapFit always shows n | Put n in each evidence record ("n=12 owners") |
| D7 | **Leakage risk:** 15 product labels are reused across cases (e.g. Forge15 in A001, A026, C002) | A hold-out split by row would leak | Split dev/hold-out by product family |
| D8 | **Coverage gaps vs LapFit's scenarios:** little UC2 (checking a seller's pitch claim by claim), little UC5 team buying, no image inputs, no multi-turn rows | The headline LapFit scenarios are under-tested | Add about 25 UC2 pitch rows (≥3 claims each), about 10 UC5, 5 image-described, 5 multi-turn |
| D9 | **Missing columns:** expected behaviour code, language, hold-out flag, real vs synthetic | Results can't be sliced the way the ship gate needs | Add the columns (TEST_SPEC.md schema) |
| D10 | **Every ideal is prose** | Fine for grading text; LapFit's UI renders tables, checklists and stamps | Keep prose ideals, and add an "expected format" column (F1–F10) so the format is graded too |

## 5. Which output format suits which query (from the S1 review and the criteria)

| Format | Helps for | Example in this workbook |
|---|---|---|
| F1 Verdict + reasons + watch-out | One clear pick between 2 options | Most S1 rows (A002, A004, A008…) |
| F2 Comparison table | 3+ criteria or 3+ options; when the user must weigh trade-offs | A001 (price, weight, battery, gaming), A010 |
| F3 Claim-by-claim list | "Is what I was told true?" | Expected across S4 |
| F5 Cost breakdown | EMI, accessories, exchange, offers | Expected across S5 |
| F6 Checklist | Refurb or used, before paying | Expected across S5 |
| F7 Clarifying question with quick replies | Vague asks | A023, A024 |
| F8 If-then | Impossible or conflicting wish lists | A025 |
| F9 Evidence summary | Trust and quality of reviews | Expected across S4 |

---

## 6. Update 13 Nov 2026: full review and v2 rewrite done

**Review of the old rows (all 150, six parallel reviewers):** KEEP 87 · POLISH 58 · FIX 5.

| FIX | Problem |
|---|---|
| A033 | A finding is pinned to the wrong laptop |
| B016 | Invents a portability fact |
| B038 | Invents a "Reddit" source |
| C024 | Claims the user can stretch to a budget that depended on a refused promise |
| C046 | Puts a made-up quote in quotation marks |

**Dataset-wide problems confirmed in every scenario:**
- one template, with the pricier option almost always right (S4: 17 of 19 picks);
- bare citations;
- no n per review;
- English replies to Hinglish queries;
- too few code-mixed rows;
- non-India rows;
- every assertion marked for an AI judge.

Per-row detail is in the `Review_v1` sheet and `review_S1…S6.json`.

**v2 rewrite merged into `Laptop_Recommendation_Evals_150.xlsx`** (the original is kept as `…_v1_original.xlsx`):
- Same 150 Case IDs. Every query, evidence context and ideal output is new.
- Every row passes `check_rewrite.py` with 0 errors. The 19 remaining warnings are multi-step arithmetic, spot-checked by hand.
- Laptop names are unique across the workbook, so there is no leakage.

| What | v2 |
|---|---|
| Languages | en 114 · hi-en 18 · te-en 12 · ta-en 6 (18 rows need a native-speaker check) |
| Stress levels per scenario | L1 5 · L2 10 · L3 4 · L4 3 · L5 3 |
| Personas | 14–25 distinct per scenario, none more than 4 times |
| LapFit coverage | UC1 second opinion, UC2 pitch claim-by-claim, UC3 shortlist, UC4 used/refurb with checklist, UC5 proxy/team; multi-turn, image, injection, no-match and cheaper-is-right rows in every scenario |
| Hold-out | 5 per scenario, 30 total |
| Evidence | Every review states n owners, reviewer type and recency; prices are dated |
| No evidence | 18 rows |

**Next:** assertions for v2 (deterministic where possible), a two-person human review of a sample, and the native-speaker check.
