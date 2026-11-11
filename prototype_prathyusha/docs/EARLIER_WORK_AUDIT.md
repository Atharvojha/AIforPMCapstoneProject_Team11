# EARLIER_WORK_AUDIT — team's prior work in `../` (inspected 2026-11-10, read-only)

Policy (D-004/D-005): start from scratch; reuse only what is clearly useful, copy (don't edit) into the new repo, credit the source.

## What exists
| Item | What it is | Verdict |
|---|---|---|
| `02_golden_dataset_v1.xlsx`, `data/golden_draft.jsonl`, `items_inputs.jsonl`, `labels_draft.json` | 40 items (Happy 24 / Edge 11 / Adversarial 5… per subtypes H1–H5, E1–E7, A1–A5), 12 student profiles, 6 laptops, 97 reviews (79 English, 18 Hinglish; 7 synthetic adversarial R091–R097). Each item has profile + listing + reviews + expected labels (applicable/not, dealbreakers, watch-outs, conflicts, gaps, confidence). | **Reuse as fit-analysis stress fixture.** Caveats below. |
| `03_output_schema.md` + `src/lapfit.py` schema | JSON contract: per-review applicability (`applies/partly/not`), 13 aspects, flags (duplicate/promotional/off_topic/instruction_injection/spec_mismatch), dealbreakers/watch-outs/strengths with verbatim quotes, conflicts (explained/unresolved + cause), evidence gaps, confidence. | **Reuse as the seed of our Pydantic models** (extend with variant, source class, coverage). |
| `src/eval_metrics.py` (+ test) | Deterministic assertions (quote verbatim, independent evidence for dealbreaker, …), dealbreaker recall, false-dealbreaker rate, overconfidence, "insufficient" accuracy, Wilson CIs, ship gate fixed before scoring, noise-aware comparison (`compare_runs.py`). | **Reuse/port** — most valuable asset. |
| `src/baseline_rules.py` | Non-AI baseline (stars/keywords). Baseline recall 0.375, false-dealbreaker item rate 0.65. | **Reuse** as baseline arm — proves AI adds value. |
| `src/validate_golden.py`, `judge.py`, `judge_agreement.py`, `judge_prompt.md` | Golden validator; LLM-judge with 5 criteria; Cohen's-kappa agreement sheet. | Judge **uncalibrated** — reuse structure, recalibrate. |
| `04_iteration_log.csv`, `04_failure_analysis.md` | 8 scored runs (rules vs Gemini v0/v1/v2). Best honest finding: v0 recall 50–56% / false-DB 25%; v1 fixes false-DB (5–7.5%) but recall collapses (19–31%); v2 failed (listing-fact claims). **Gate never passed.** Open policy question: can a listing fact alone be a dealbreaker? | **Gold for the case study**: documents real iteration & negative result. Learn from it. |
| `ui/index.html` + `04_experience_design.md` | Single-file evidence-first UI (rules view only; AI view empty), strong a11y + motion rules, evidence sheet, no-score principle. | **Reference only** (design principles are good); new UI will be React/shadcn per master prompt. |
| `customer/*` | Session kit (guide, consent, baseline sheets, evidence workbook). **0 sessions run.** | Reusable for Stage 6 validation; needs real students. |
| `src/gemini.py`, provider code | Gemini/Anthropic API wrappers — **paid/hosted**. | Not reused (open-weight local requirement); keep adapter idea. |
| `data/amazon_laptop_meta.csv` | 755 "laptop-ish" rows, only 44 true laptops (rest accessories). | Superseded by `datasets/processed/amazon_laptop_meta.csv`. |
| `submission/` | PDF/HTML report builder. | Not needed. |

## Problems found (what's wrong / risky)
1. **Provenance of the 97 golden reviews:** 90 are "pasted by team; platform and page URL pending; not independently verified" (`Source=Other`, 1 URL total); 7 are Claude-written adversarial. **None of the 97 texts appear in the Flipkart subset** (0/97 verbatim) — it is a different corpus on a different catalogue (Acer Aspire 14, MSI Katana 15 B13UDXK, Samsung Galaxy Book4, MacBook Air M4, Motobook 60 Pro, MSI Modern 14 — 2026 listings, review dates 2026).
2. **Labels are AI-drafted (Claude), 0 of 40 human-verified**; second-labeller columns empty; human rating sheet has ~1 rated row; judge never calibrated.
3. **Two golden sets that don't match:** the PDF's 10 golden examples (Flipkart `FK-` IDs, 14-listing corpus) vs the 40-item xlsx (R-IDs, 6-laptop corpus). Only the PDF's 10 map to data we can reproduce.
4. **Coverage gap — all 40 items are Scenario A (fit/dealbreaker).** Nothing for Scenario B (Claim Checker).
5. **Ship gate never met** (recall ≥85% / false-DB ≤10%); best arm still far off — expected for a weak prompt on a hosted flash model; our RAG/rules layer targets exactly these failures.
6. Python 3.9 (macOS default) fails 2 of 6 earlier tests (f-string syntax); they pass on Python 3.14.

## Eval/golden coverage matrix — what exists vs what we must build
| Capability | Existing | Gap → to build (Stage 3/4) |
|---|---|---|
| Fit: applicability, dealbreaker/watch-out, conflicts, gaps, confidence, thin evidence | 40 items (AI-labelled) | Human-verify ≥10; add 2nd labeller; re-label for listing-fact policy (v0.6) |
| Quote validity, injection, off-topic, promo, spec-mismatch | A1–A5 items + assertions | Port; add Flipkart-native injection/dup cases |
| Hinglish / shorthand | E3 (18 Hinglish reviews) | Add Flipkart shorthand ("ONE N HALF HOUR", "Battery 5/5") |
| **Claim Checker** (verdict, test conditions, counter-evidence, insufficient/mixed) | **none** | ~30–40 claim items (battery, thermal, RAM upgrade, display, fan noise, AI workloads) with adjudicated verdicts |
| **Retrieval** (recall@k, exact-variant filter, duplicate handling) | none | Query→relevant-review-ID set built from the 14-listing corpus |
| **Variant/SKU resolution** | E1 config-mismatch (2 items) + PDF ex. 08 | Sibling-listing cases (RTX 3050 vs GTX 1650 etc.) |
| **Evidence-class separation** (spec vs lab vs owner) | none | Curated spec + lab fixtures with test conditions |
| **Extraction accuracy** (topic/polarity/applicability per review) | implied in assessments | Gold set of ~150 Flipkart reviews labelled topic+polarity |
| Judge calibration (kappa) | scaffold only | Calibrate on ≥40 human-rated outputs |
| Latency/cost | none | Instrument pipeline |
