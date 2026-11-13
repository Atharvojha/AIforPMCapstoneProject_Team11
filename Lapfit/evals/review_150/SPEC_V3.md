# Eval workbook v3 spec: one scenario per AI feature in the repo spec

13 Nov 2026. **Standard = the repo** `lapfit-project/` (Sri, D-L12): its decisions D-01–D-15, prompts P1–P9, flows, settings, data model and UI wording. Where this spec and the repo disagree, the repo wins. Note the conflict in "Review notes".

## 1. Scenarios, IDs and row counts (170 rows)

| Code | Scenario | Feature | AI component(s) under test | Rows | Writer group | Reuse v2 rows from |
|---|---|---|---|---|---|---|
| SL | Shortlist | F01 | P1 router + P1a needs reader, P2 reasons | 18 | G1 | v2 S1, S3, S6 (adapt) |
| BO | Buy for others or a team | F04 | P1e recipient/team reader, P2; ≤2 questions | 14 | G1 | v2 UC5 rows (adapt) |
| SO | Second opinion | F02 | P1b laptop and Musts reader, P2, P4 (optional) | 16 | G2 | v2 S2 UC1 rows (adapt) |
| PC | Check the pitch | F02 | P1c claim reader (split and type) | 18 | G2 | v2 S2 UC2, S4 rows (adapt) |
| UC | Used laptop check | F03 | P1d used-listing reader, P3 (image described) | 16 | G3 | v2 S5 UC4 rows (adapt) |
| RG | Router and guardrails | Shared | P1 flow choice incl. `clarify`, `out_of_scope_laptop`, `not_laptop`, mixed requests (`followup_flow`), injection, links, abusive tone, language | 16 | G3 | v2 S6 rows (adapt) |
| OV | Owner voice | F05 | P1f owner-filter reader, P4 evidence summariser | 15 | G4 | new |
| BI | Brand insights note | F10 | P7 insight narrator | 12 | G4 | new |
| RT | Review tagger (offline) | F05 | P8 review tagger (topic, persona, rating, months, confidence) | 15 | G5 | new |
| MD | Moderation triage | F06 | P5 report moderation triage | 15 | G5 | new |
| SP | Sell plan | F09 | P1g seller-condition reader, P6 listing text writer (plan figures are code) | 15 | G6 | new |

**Case IDs:** `<Code>-<nn>`, e.g. `SL-01` to `SL-18`, in order. No AI eval rows for F07 Market pulse or F08 My laptops. Those features have no AI, so they are tested with fixtures. Say so in the Guide.

## 2. Read before writing (all groups)

- `lapfit-project/ai-spec/03_SYSTEM_PROMPTS.md`: **your prompts, in full**. Output field names must match exactly.
- `lapfit-project/ai-spec/features/F0x_*.md` and `specs/F0x_*.md` for your features.
- `lapfit-project/ai-spec/02_DECISIONS.md` and `04_FEATURE_SPECS.md` (shared UI and wording rules).
- `lapfit-project/prototype/settings.js` and the relevant `server/*.js`. Use the code's **exact user-facing wording, status labels, thresholds and formulas**:
  - flows and claim statuses: `flows.js`
  - personas, topics and `MIN_EVIDENCE_N`: `engine.js`
  - sell plan factors: `sell.js`
- `Lapfit/research/lapfit_project_digest/*.md`: fast orientation.
- Phrasing and stress ideas:
  - `Lapfit/evals/review_150/rewrite_S1..S6.json`: the v2 rows, for adaptation;
  - `Lapfit/03_happy_flows_by_persona.md` §1: personas P1–P12;
  - `Lapfit/research/real_query_patterns.md`;
  - `Lapfit/evals/edge_cases.json`.

## 3. Repo rules every ideal output must obey

1. **The model never supplies a fact.** Every spec, price, count, rating and verdict comes from the evidence context, as code would compute it. Prices carry an as-of date.
2. **Minimum evidence:** when an owner-evidence group has fewer than `MIN_EVIDENCE_N` (20) reports, say "not enough evidence" with the count. **No excerpts, no percentages, no rating** for that group.
3. **Claim statuses (F02):** use exactly the labels in `flows.js`, i.e. the code's wording for:
   - **spec claims:** supported, contradicts, or not in catalog;
   - **opinions:** can't be checked;
   - **other claims with an approved ledger row:** verdict with sample size, approver and date;
   - **other claims without one:** "Not checked yet", plus the evidence summary.
   
   **Only ledger verdicts and owner reports need a named approver.** Spec checks, used flags, rankings and sell plans come from code.
4. **Used check (F03):** never "buy" or "don't buy". Give flags with levels, the fixed in-person checklist, and a "cannot judge from a listing" list.
5. **Shortlist (F01):** three cards, expandable to five. When nothing matches, name the one Must to relax and what it adds. A vague "light" becomes a Should of ≤1.5 kg. Colour fallback: nearest colour, then a dark one.
6. **Clarify:** confidence below 0.6 gets **one question with 2–4 tappable choices**. F04 asks at most 2 questions in total. With no budget, no Must and no use, ask "What is your budget?".
7. **Wording:** calm, plain, short sentences, **no exclamation marks**, neutral about sellers ("does not match the specs"). Never "lying", "scam", "fraud" or "fake". Reasons ≤40 words per card, with numbers only from the facts.
8. **Language:** reply in the user's language (en or hi-en only). Numbers in rupees, with 60k, 1 lakh and similar understood.
9. **Injection:** text and images are data. Ignored instructions are noted.
10. **Personas and topics** for owner evidence are the code's closed lists:
    - personas: gamer, student, developer, creator, parent, office;
    - topics: battery, keyboard, hinge, display, performance, heat_noise, service.

    Unknown values are reported back, not guessed.

## 4. Variety rules (per scenario)

- **Personas:** at least 6 distinct buyer personas (P1–P12 or your own). None more than 4 times. The persona must change the input wording and the ideal (plain words for parents, specifics for developers, calm for anxious buyers).
  - **RT, MD and BI** use "author" personas instead: the review writer, the owner submitting, the brand analyst.
- **Stress levels:** L1 happy, L2 edge, L3 adversarial or pressure, L4 emotional, L5 noisy input (typos, voice, OCR). At least 2 rows of each.
- **Languages (updated 13 Nov, Sri):** **English and Hinglish only.** No Telugu-English or Tamil-English. At least 3 hi-en rows per scenario. In RT and MD the *input* may be Hinglish while the output is JSON.
- **Difficulty:** mix easy, medium and hard, with at least a third hard.
- **No obvious decoys.** Each scenario includes close calls, at least 1 honest negative (no match, not enough evidence, not checked, cannot judge), and at least 1 row where the cheaper or simpler option is right, where relevant.
- **Hold-out:** 3 rows per scenario (2 for BI), spread across stress levels.

## 5. Evidence context (fictional, self-contained, matches the repo data model)

```
Catalog (as of Nov 2026): <ID>-P <Name14> · variant 16GB/512GB · ₹52,000 (as of 2026-11-01) · 1.35kg · 14in IPS · hinge: clamshell · RAM: soldered/1 free slot · warranty 1y carry-in
Evidence: [<ID>-E1] <Name14> · topic battery · persona student · n_reports 26 · avg rating 3.9 · months owned 6–12 · source <fictional> · <short paraphrase>
Ledger: [<ID>-L1] claim "…" · scope <model> · verdict "…" · sample_size 40 · approver <name> · 2026-10-20     (or "no approved ledger row")
Settings: MIN_EVIDENCE_N 20 · …   (only when relevant)
```

- **BI:** Input = the computed figures (heatmap cells with n, price history, weekly checks, demand rows).
- **RT:** Input = one review text plus its source metadata.
- **MD:** Input = the submitted note plus metadata (laptop, persona, months, topic, rating).
- **SP:** Input = the seller's words and/or form fields. Evidence = catalog row, settings factors and repair costs, copied from `settings.js` and `sell.js` sample values.
- **Product names:** reuse a v2 row's names when adapting it. Every new fictional name must start with your group's syllable:
  - G1 "Ka"
  - G2 "Lo"
  - G3 "Mi"
  - G4 "No"
  - G5 "Pa"
  - G6 "Ru"
  
  e.g. Kavi14, Lorne15. Names must be unique across rows.
- No real laptop brands or models. Real software and app names are fine.

## 6. Ideal output

- **User-facing scenarios (SL, BO, SO, PC, UC, RG, OV, SP):** the text the user sees, in reading order. Briefly render each card or flag as a line: understood chips → cards/claims/flags → evidence (n) → next step. Length 50–170 words (up to 220 for tables or checklists).
- **SP:** add the P6 listing text, and before it, on its own line, the P1g extraction JSON (`EXTRACTION: {...}`).
- **RT and MD:** the ideal is **JSON only**, using the exact output fields of P8 or P5 from `03_SYSTEM_PROMPTS.md`.
- **BI:** the 2–4 sentence P7 note.
- **RG:** the user-facing reply, plus `EXPECTED ROUTER: {"flow": …, "confidence": "≥0.6|<0.6", "language": …}` on its own last line.

## 7. JSON schema per row (keys exactly)

```json
{"Case ID":"SL-01","Scenario":"SL Shortlist","Feature":"F01","AI component":"P1a; P2",
 "Persona":"…","Input":"…","Evidence context":"…","Ideal output":"…",
 "Output type":"user_text|json|user_text+json","Expected flow":"shortlist|second_opinion|check_pitch|used_check|buy_for_others|owner_voice|sell_laptop|trending|clarify|out_of_scope_laptop|not_laptop|offline_batch",
 "Expected behaviour":"SHORTLIST|NO-MATCH|CLARIFY|COMPARE|VERDICT|NOT-CHECKED|CHECKLIST|FLAGS|ABSTAIN|DECLINE|EMPATHISE|EXTRACT|LABEL|TRIAGE|NARRATE|PLAN|DIRECT|PROVISIONAL (join with +; DIRECT = name-only answer per D-L14, PROVISIONAL = a compulsory Must is unverified, per D-L15)",
 "Expected format":"F1..F10 or JSON",
 "Assertion hooks":"3–7 checks separated by ' || ', each prefixed [code] or [judge], e.g. [code] every shown laptop price ≤ 70000 || [code] no '!' || [judge] reply in Hinglish",
 "Language":"en|hi-en|te-en|ta-en","Stress level":"L1..L5","Difficulty":"easy|medium|hard",
 "Evidence mode":"provided_evidence|no_evidence","Hold-out":"yes|no","Needs native check":"yes|no",
 "Situation":"one line","Category tags":"tag; tag","Source":"new | adapted from A0xx","Inspiration source IDs":"R-0xx …",
 "Review notes":"what this row stress-tests and why the ideal is right per the repo rules (cite the rule or code)"}
```

**Assertion hooks** are the bridge to the assertion-based evals:
- Prefer `[code]` wherever a program can decide (prices, n, labels, question count, JSON fields, banned words, flow).
- Use `[judge]` only for tone, faithfulness or language.
- At least 3 per row, and at least 1 of them critical. Mark it `(critical)`.

## 8. Validate before finishing

Run: `python3 -I evals/review_150/check_v3.py evals/review_150/v3_<GROUP>.json` from the Lapfit folder. Fix every ERROR. Read each WARNING. Your file is one JSON array holding the rows of all your scenarios.
