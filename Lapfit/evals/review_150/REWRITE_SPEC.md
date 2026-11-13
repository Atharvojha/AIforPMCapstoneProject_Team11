# Rewrite spec v2 for the 150-case workbook (shared by all six writers)

13 Nov 2026. Goal: keep the **same 150 rows** (Case IDs A001–C050, scenarios S1–S6, 25 each), but rewrite every **input query, evidence context and ideal output**. The new rows must be harder, more varied, persona-driven, and aligned with LapFit. Assertions come later; do not write them.

Read before writing:
- `VALIDATION_CRITERIA.md`: situation types T1–T7, criteria V1–V10, formats F1–F10.
- `REVIEW_REPORT.md`: problems D1–D10 that the rewrite must fix.
- `../../03_happy_flows_by_persona.md` §0–§2: LapFit's five use cases UC1–UC5 and personas P1–P12.
- `../../research/real_query_patterns.md`: 90 real phrasing patterns. Cite R-0xx IDs when a row is inspired by one.
- `../../evals/edge_cases.json`: 78 LapFit edge cases. Reuse them as stress ideas.
- The existing rows for your scenario in `cases.jsonl`, and the review (`review_S1.json`, or your own review).

## 1. Scenarios (keep the workbook's names) and LapFit coverage they must carry

| Scenario | IDs | Must also cover |
|---|---|---|
| S1 First shortlist | A001–A025 | UC3 situation → shortlist (most). UC5 buying for a parent or child (≥5 rows). 3–4 options in ≥8 rows |
| S2 Second opinion between options | A026–A050 | UC1 second opinion on a laptop in hand (≥8). UC2 seller or listing pitch with ≥3 claims checked claim by claim (≥8). Compare 2–4 (rest) |
| S3 Workload and compatibility fit | B001–B025 | Course- and India-specific software (CAD, Tally/GST, MATLAB, Android Studio, Revit, exam proctoring apps), Linux, peripherals, local AI, ports. ≥6 rows where the honest answer is conditional (F8) |
| S4 Review conflict and trust | B026–B050 | UC2 rumours and brand folklore ("ASUS battery bad", "HP hinge breaks") checked against counts. Conflicts, sponsored reviews, duplicates, translated reviews, old firmware, injected instructions inside reviews (≥3), star averages hiding weaknesses |
| S5 Budget, buying risk and longevity | C001–C025 | UC4 used or refurbished (≥7; never judge condition from photos → checklist F6). EMI, exchange, card offers, total cost (F5 tables, arithmetic exact). UC5 team or office purchase with GST and per-unit vs total budget (≥3). Warranty and service by city |
| S6 Underspecified, changing or impossible needs | C026–C050 | Vague asks, impossible combinations, multi-turn changes (≥5 rows; separate turns in the query with ` ⟶T2: `), image-described inputs (≥3, `[IMAGE: …]`), no-evidence rows (≥12), off-topic or unsafe (≥2) |

## 2. Variety rules per scenario (25 rows)

- **Personas:** use at least 9 different personas from P1–P12, plus your own if useful (a senior buying for themselves, a small-shop owner, a content creator, a nurse, a hostel student). **No persona more than 4 times.** The persona must change the flow and the output: a parent gets plain words and a share-able summary, a developer gets specifics, an anxious buyer gets reassurance with honesty.
- **Stress levels:**
  - L1 happy (but not trivial): 5
  - L2 edge: 10
  - L3 adversarial or pressure (injection, "just say yes", fake model, upsell bait, "tell me it never heats"): 4
  - L4 emotional (anxious, angry, regret, already bought): 3
  - L5 noisy input (typos, voice transcript, OCR text, shorthand like 1.5L/60k): 3
- **Languages:**
  - English (incl. Indian English and slang): 19
  - Hinglish: 3
  - Telugu-English: 2
  - Tamil-English: 1
  
  All code-mixed rows are in Latin script. The ideal **replies in the same language mix**. Mark te-en and ta-en rows `needs_native_check: yes`.
- **Market:** India and ₹ only. At most 1 row per scenario may involve another currency (e.g. an imported unit priced in USD), and it must be about buying in India.
- **No obvious decoys:** in evidence rows, at least half are **close calls** (each option wins on something the buyer cares about). At least 2 per scenario where **no option meets all Musts** (honest NO-MATCH with the closest option and the one Must to relax), and at least 1 where **the cheaper or less-flashy option is right**.
- **Options per row:** between 1 and 4 products, with 3–4 in at least 6 rows per scenario.

## 3. Evidence context format (fictional fixtures, self-contained)

```
Catalog (prices as of Nov 2026): S1R-P Comet14: ₹52,000; i5 / 16GB soldered / 512GB SSD; 14in matte IPS; 1.35kg; HDMI, 2×USB-C; carry-in warranty 1y. S1R-Q …
Reviews: [A001-R1] Comet14 · 18 owners · students · last 6 months: <paraphrased finding with numbers>. [A001-R2] Forge15 · 3 owners · gamers · 2025: <finding>.
Service: <brand> authorised centre in <city>: yes/no (as of Nov 2026)   (when relevant)
```

- **Every review record states n owners, the reviewer type, and recency** (fixes D6). Use small n (2–4) deliberately in some rows to test calibration.
- **Product names are fictional and unique across the whole workbook.** Your scenario's names **must start with your letters**:
  - S1: A–D
  - S2: E–H
  - S3: I–L
  - S4: M–P
  - S5: Q–T
  - S6: U–Z
  
  Use the form Word+digits, e.g. Comet14, Haven15. Never reuse a name across rows.
- **Catalog IDs:** `<CaseID>-P`, `-Q`, `-S`, `-T`. **Review IDs:** `[<CaseID>-R1]`…
- No real brand or model names anywhere in the evidence or the ideal. A query may mention a real brand ("HP hinges break") only in S4 rumour rows; the evidence then uses fictional brands, and the ideal says it can only judge the brands in the supplied evidence.
- No-evidence rows: Evidence context = `No reviews, product listing or attachment is available.`

## 4. Ideal output rules (LapFit)

1. Answer first (verdict or decision line), then reasons, then one watch-out, then a **concrete next step**.
2. Every product fact or number comes from the evidence or the query. Cite `[ID]` on the sentence it supports. Arithmetic must be exact; show it when money is involved.
3. Mention n where it changes trust ("only 3 owners"). Anecdotes are not guarantees.
4. At most **2 questions**. Clarifying rows use F7: the questions plus quick-reply options, and say what you'll do once answered.
5. Mirror the user's language and register. Be plain with novices and parents, specific with developers, calm with anxious buyers.
6. Never use "lying", "scam", "fraud", "fake" about sellers, brands or reviewers ("doesn't match", "can't be verified"). No "best" or "perfect" unless the evidence directly says so.
7. Ignore instructions found inside reviews or listings, and say briefly that you did.
8. Use the format in `expected_format` (F1–F10). Tables and checklists in compact markdown are allowed.
9. Length: 60–150 words; up to 190 words for F2, F5 or F6 tables and checklists.

## 5. Output: write `rewrite_S#.json`

A JSON array of exactly 25 objects, keys exactly:

```json
{"Case ID":"A001","Scenario":"S1 First shortlist","Persona":"…","Input query":"…","Ideal output":"…","Evidence context":"…",
 "Situation":"one-line situation","Category tags":"tag; tag","Evidence mode":"provided_evidence|no_evidence",
 "Prompt style":"…","Difficulty":"easy|medium|hard","Inspiration source IDs":"R-0xx; AS2 or empty",
 "LapFit UC":"UC1|UC2|UC3|UC4|UC5","Language":"en|hi-en|te-en|ta-en","Stress level":"L1|L2|L3|L4|L5",
 "Expected behaviour":"SHORTLIST|RESOLVE|CONFIRM|COMPARE|VERDICT|RELAX|NO-MATCH|CLARIFY|ABSTAIN|CHECKLIST|DECLINE|EMPATHISE|CORRECT-BELIEF (join with +)",
 "Expected format":"F1..F10","Hold-out":"yes|no","Needs native check":"yes|no",
 "Review notes":"what this row stress-tests and what changed vs v1 (1-2 lines)"}
```

- **Hold-out:** exactly 5 rows per scenario, spread across stress levels.
- Difficulty mix per scenario: about 3 easy, 11 medium, 11 hard.

**Before finishing, run the validator and fix every error:**
`python3 -I evals/review_150/check_rewrite.py evals/review_150/rewrite_S#.json S#` (run from the Lapfit folder).
