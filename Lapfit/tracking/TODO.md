# LapFit master to-do list (living)

Status key: ✅ done · 🟡 in progress · ⏸ waiting on a decision · ⬜ not started. Updated 13 Nov 2026.
Phases follow the discovery pack (0–10), plus new tasks marked **NEW** that came out of reconciling it with the prototype.

| # | Task | Output | Status |
|---|---|---|---|
| 0.1 | Read all five Lapfit docs + prototype state | Gap table in `01_core_scenarios_and_happy_path.md` §1 | ✅ |
| 0.2 | Decide happy path | D-L01; `02_happy_path_v2…` | 🟡 Sri picked UC1+UC2 (+UC3 door); confirm spine framing |
| 0.3 | Approach per workflow (good/better/best) | v2 §3 | ✅ draft with named free tools |
| 0.4 | Current, realistic catalogue + tiered truth + live lookup | v2 §4; `research/free_data_sources_and_tools.md` | ✅ research done; catalogue build ⬜ (5–7 person-days) |
| 0.5 | **NEW** Rebuild prototype data on disk (DBs and processed datasets are gitignored/missing) | Running API, 228 tests pass | ⬜ (CH-L01) |
| 0.6 | One-sentence user job | Phases 3–5 doc | ✅ (re-word for merged path) |
| 1.1 | Competitor teardown, JTBD, personas, interview guide, sizing | Phases 1–2 doc | ✅ draft |
| 1.2 | 5+ real-user sessions (≥4 personas), verbatims, change log | `customer/` session log | ⬜ **start now — 15% of grade** |
| 1.3 | Real-phrasing research | `research/real_query_patterns.md` (90 patterns; Reddit/Quora snippet-only) | ✅ |
| 1.4 | Persona stress test (synthetic, labelled) + opportunity sizing that attacks itself | Phases 1–2 doc | ✅ draft; rerun for merged path |
| 2.0 | **NEW** Corpus v2 per door: ≥100 Door A (pitches/listings/names/photos/refurb) + ≥100 Door B; each of Sri's edge cases ≥1 row | `evals/corpus_v2.csv` | ⬜ |
| 2.1 | (superseded detail) Corpus v2: rebase 110 queries on our data (`answerable_with_current_data`), add ≥25 mixed needs+claim+candidate queries, add real phrasing → ≥120 for the happy path | `evals/corpus_v2.csv` | ⬜ |
| 2.2 | Label the parse for all corpus rows (1 min each) | expected_parse column | ⬜ |
| 2.3 | **NEW** Independent oracle filter script → acceptable IDs per row | `evals/oracle.py` | ⬜ |
| 2.4 | Golden set v1: 45 hand-labelled pairs, 2 labellers, ~9 hold-out, versioned | `evals/golden_v1.jsonl` | ⬜ |
| 3.1–3.6 | Decision tree, V×F×D×R scorecard, pitch, model decision record, autonomy map, failing-segment drill | Phases 3–5 doc | ✅ draft (anchors missing) |
| 4.1 | Flow, guardrails, tone, dashboard — **update for merged path** (claim panel, claim↔card badge) | Product spec v2 | ⬜ |
| 4.2 | **NEW** Measure "owners like you" lens coverage per laptop (share of reviews with a usable use cue) | Coverage table; go/no-go for lens | ⬜ |
| 4.3 | Multimodal: screenshot → OCR/vision candidate → confirm | Spec + 5 image rows | ⬜ |
| 5 | Data spec: variant/colour rows, service centre (later), claim ledger, listing ledger, query log | Data spec v2 | ⬜ |
| 6.1 | Five-part anatomy for the merged path (trigger, orchestration, model, knowledge/RAG, evals loop) | AI spec v2 | ⬜ |
| 6.2 | System prompts: merged parser (needs + claims + candidates), numbers writer, reason writer, claim summary writer, judge | `prompts/*.md` versioned | ⬜ (A1–B2 drafts exist) |
| 7.1 | Rubric 4 criteria × 1/3/5 anchors | Phases 6–7 doc | ✅ draft |
| 7.2 | Assertions A1–A10 as code + E2 recall@3 | `evals/assertions/` | ⬜ |
| 7.3 | Judge verified vs 2 humans on 50 outputs incl. planted failures | Agreement report | ⬜ |
| 7.4 | Competitor benchmark: 20 queries × ChatGPT, Claude, Smartprix, 91mobiles, LapFit, blind | Benchmark report | ⬜ |
| 7.5 | Ship gate fixed **before** first results | `config/thresholds.json` | ⬜ |
| 7.6 | ≥3 iteration cycles: run, cluster, fix one class, re-run, log delta | `evals/iteration_log.md` (graded) | ⬜ |
| 8 | AI PRD one-page + full, five capstone updates | Phase 8 doc | ✅ draft; update for merged path |
| 9 | Revenue streams, unit economics, USP vs ChatGPT; **NEW** owner check-ins as moat+revenue loop | Phase 8 doc + §5 here | 🟡 |
| 10 | Master build doc v2 for Claude Code (reconciled with prototype) + 10-min demo | `00_MASTER_BUILD_v2.md` | ⬜ after Q-01–Q-03 |

## The user's examples — where each is covered
| Example | Covered by |
|---|---|
| "CS student, coding + video editing, ₹60k, light, good battery" | Happy path walkthrough §3; corpus row 1 |
| "I want it fast" → numbers on colour scales | Step 4 of happy path; corpus 11–17 |
| Convertible → HP Spectre, never a MacBook | E1 assertion; corpus 18. **Our 14 laptops likely include no convertible → expected NO-MATCH until spec-only rows are added (Q-03)** |
| "Under 1 lakh compulsory, don't care about style" | Must/Nice tiers; corpus 26 |
| Midnight blue Mac → nearest blue | Colour ladder; corpus 33 (needs variant colour rows) |
| "ASUS bad at battery" | Claim panel step 7; corpus 60 |
| Zomato 1 km idea, gamer-only, India vs US, last 30 days | §5 lens table + moat ladder (30 days needs owner check-ins) |
| Photos/colours out, images in | §6 |
| ChatGPT/Claude workaround | E-competitor benchmark 7.4 |

## Happy-flow brief (13 Nov)
| # | Task | Status |
|---|---|---|
| HF1 | Personas + queries per scenario | ✅ approved |
| HF2 | Happy flow per scenario | ✅ approved; mode pill removed |
| HF3 | Input→output interface + clickable mock | ✅ done
| HF4 | Edge cases, back end and front end side by side | ✅ draft (78 cases), waiting for review |
| HF5 | Compile into one document | ⬜ |
| T1 | Test spec | ✅ `evals/TEST_SPEC.md` |
| T2 | 100 tests per UC (500) | ⏸ paused for happy flows |
