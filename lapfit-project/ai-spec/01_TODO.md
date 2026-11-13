# LapFit: overall to-do list

Your list, carried over with tags, plus what this round changed. A new column says what happened here.

**Source tags** [M1] your first message, [M2] your long brief, [S1]–[S11] the course slides in the order you attached them (S1 capstone tree, S2 engineering vs product sync, S3 cost of being wrong, S4 decide and say it plainly, S5 PRD update list, S6 rubric sheet, S7 golden dataset, S8 two judges, S9 failure analysis, S10 deliverables, S11 grading).

**Status key**
`[x]` done  ·  `[~]` drafted in this folder, needs your review  ·  `[ ]` open
**This round:** *Decided* (you answered) · *Drafted* (written here) · *Needs you* · *Needs data or measurement* · *Later*

**Rule from decision D-04:** the team repo is treated as unusable. Items you marked done before this round are kept as you marked them, but they are **not** in this repo; where a document here covers the same ground, it is noted.

---

## New items added this round

| # | Item | This round |
|---|---|---|
| N1 | Finalise every system prompt: the "Questions for you" under each prompt in `03_SYSTEM_PROMPTS.md` (P1 to P9) | **Answered by me** (`05_ANSWERS.md` section 5); you review |
| N2 | Ask you questions while writing each prompt (tone, refusal wording, languages, examples). Can be done later | Later |
| N3 | Review the F02 full specification and its four checkpoint questions | **Answered by me** (Q-F02-1 to 4); F02 spec updated; you review |
| N4 | Full specifications for F01, F03, F04 to F10, one at a time | **F01, F02 and F03 done**; F04 next; rest later |
| N5 | Review the per-feature AI docs `features/F01…F10` and their "Questions for you" | **Answered by me** (`05_ANSWERS.md` section 6); you review |
| N6 | Confirm the AI model-type choice per scenario (decision D-06) | **Confirmed by me**, you review |
| N7 | Verify Gemini free-tier limits, data-use terms, JSON-schema and image support (decision D-03) | **Checked 13 Nov 2026** (`05_ANSWERS.md` C1 to C4). Still to check: model name, pricing, your project's numeric limits |
| N8 | Choose free or paid model tier (O-06) | **Decided:** free for sample data only; paid before real users |
| N9 | Port the prototype logic to the cheap stack (Lovable, Supabase Edge Functions, n8n), following the file map in D-03 | Later |
| N10 | Name the approvers for claims and reports (O-07) | Needs you (cannot be answered by checking) |
| N11 | Replace sample assumptions: resale factors, repair costs, used-price band | Needs data |
| N12 | Scrub and set retention for `unhandled_requests` text (data model, section 12) | Later |
| N13 | Decide whether accounts and reminders are in course scope (F08) | Needs you |

---

## PHASE 0. DECIDE THE SCOPE

| ID | Item | Status | This round |
|---|---|---|---|
| 0.1 | Pick the core use cases | `[x]` | **Decided (D-01):** shortlist, second opinion + check the pitch, used laptop check |
| 0.2 | Default: second opinion plus check the pitch as one flow, shortlist as front door | `[x]` | **Decided** (consistent with D-01); F02 covers both |
| 0.3 | Is the claim-check flow in the course submission or an extension? | `[x]` | **Decided:** in the submission (inside F02) |
| 0.4 | PRD due date and submit format [S5] | `[ ]` | Needs you (O-01). Working assumption: one week before the last class |
| 0.5 | Confirm the grading weights in class [S11] | `[~]` | **Answered from your own item 12.6** (O-02): problem and PRD 15%, eval rigour 30%, iteration 20%, customer learning 15%, demo 20%. Confirm in class |

## PHASE 1. DISCOVERY

| ID | Item | Status | This round |
|---|---|---|---|
| 1.1 to 1.4, 1.6 | Competitor teardown, JTBD, personas and journey, interview guide, opportunity sizing | `[x]` | Done earlier (not in this repo). A JTBD expansion exists in `../jtbd-analysis/` |
| 1.5 | Persona stress test: answer the interview as each persona | `[ ]` | Later |
| 1.7 | Re-run 1.1 to 1.6 for any use case added in 0.1 (the used laptop check) | `[ ]` | Later |

## PHASE 2. QUERIES

| ID | Item | Status | This round |
|---|---|---|---|
| 2.1 | 110-row draft corpus | `[x]` | Done earlier (not in this repo) |
| 2.2 | Grow to at least 100 queries for EACH core use case [M1] | `[ ]` | Targets set in `features/F01, F02, F03`; queries not yet written. Later |
| 2.3 | Cover every parameter: RAM, storage, colour, weight, stylish, availability, service, service-centre availability | `[ ]` | Note: service-centre availability and stylish are **not** in the data model yet; needs a decision |
| 2.4 | Cover priorities ("under 1 lakh compulsory, style last") | `[ ]` | Test type listed in F01 |
| 2.5 | Cover colour fallback (midnight blue to blue) | `[ ]` | Test type listed in F01 |
| 2.6 | Cover bad, code-mixed, angry, ambiguous, confused, adversarial inputs | `[ ]` | Test types listed per feature |
| 2.7 | Add real phrasing from public posts, within each site's terms | `[ ]` | Needs you |
| 2.8 | Native-speaker check for Telugu-English and Tamil-English rows | `[ ]` | Needs you |

## PHASE 3. PRODUCT DEFINITION

| ID | Item | Status | This round |
|---|---|---|---|
| 3.1, 3.2 | One-sentence job; AI / rules / human tree | `[x]` | Done earlier. The per-scenario version is now decision **D-06** |
| 3.3 | Score the AI sub-task V × F × D × R on the 1/3/5 anchors [S1] | `[ ]` | **Needs you:** I have not seen the slide, so I did not guess the anchors (O-04) |
| 3.4 | Name the weakest dimension; rehearse the 60-second pitch | `[ ]` | Needs 3.3 |
| 3.5 to 3.7 | Fewest happy paths; guardrails; tone, format, features | `[x]` | Done earlier. Guardrails per prompt are in `03_SYSTEM_PROMPTS.md` |
| 3.8 | Multimodal input and output | `[~]` | Drafted: P3 image reader; swatches and product photos in the data model. Not built |
| 3.9 | Data moat and lens views | `[x]` | Built in the prototype (F05). India vs US region lens: **not** built; asked in F05 |
| 3.10 | "People like you" rating | `[~]` | Drafted in F05 (rules: match persona and months). Not built as a single score |
| 3.11 | USP vs a chat assistant; test on 10 real pitches | `[ ]` | Test defined in F02; needs real pitches |

## PHASE 4. AI SPEC PER USE CASE

| ID | Item | Status | This round |
|---|---|---|---|
| 4.1 | Five parts per flow | `[~]` | **Drafted for all ten features** in `features/` |
| 4.2 | Parameters, context, RAG pipeline, files and data types | `[~]` | Drafted per feature (knowledge section) |
| 4.3 | System prompts for every flow | `[~]` | **Drafted** in `03_SYSTEM_PROMPTS.md` (P1 to P9) |
| 4.4 | Prompts for new use cases (used check, buy for others) | `[~]` | Drafted: P1d (draft), P1e |
| 4.5 | Router prompt and handling for requests outside the use cases | `[~]` | Drafted: P1 and the out-of-scope and clarify rules |

## PHASE 5. MODEL AND AUTONOMY

| ID | Item | Status | This round |
|---|---|---|---|
| 5.1 | Option sheet with measured accuracy, p95 and cost per model [S2] | `[ ]` | Needs data: run the golden set on each candidate model |
| 5.2 | Model decision record, with what would make you revisit | `[~]` | Drafted: D-06 (model type) and D-03 (provider), each with "revisit when" |
| 5.3 | Cost of being wrong: replace my scenarios with the course worksheet [S3] | `[ ]` | Needs you (O-04). My version is in D-10 |
| 5.4 | Autonomy level per scenario | `[x]` | Re-stated in D-10 |
| 5.5 | Flag launch blockers [S3] | `[~]` | Blockers: no real catalog; no named approvers; hard metrics not yet zero; sample assumptions; free-tier privacy unresolved |
| 5.6 | Go/no-go bar per segment, confirmed by you [S5] | `[~]` | Gates proposed per feature and **segments defined** (language and user type) in O-03. You confirm |
| 5.7 | Failing-segment decision and five-line stakeholder message [S4] | `[ ]` | Needs measured results |
| 5.8 | Staged rollout with gates and rollback | `[x]` | Done earlier (not in this repo) |

## PHASE 6. DATA

| ID | Item | Status | This round |
|---|---|---|---|
| 6.1 | Verified catalog (about 100 laptops) | `[ ]` | Needs data. Fields and checks in the data model |
| 6.2 | Price history with as-of dates | `[ ]` | Needs data |
| 6.3 | Evidence excerpts tagged by topic, reviewer type, region, ownership time | `[ ]` | Needs data. **Region** is not yet a column |
| 6.4 | Service-centre data with last-verified dates | `[ ]` | Needs data; `service_centre` is in the data model's additions |
| 6.5 | Claim ledger with person-approved verdicts | `[ ]` | Needs approvers (N10) |
| 6.6 | Settle data rights and retention before storing or quoting review text | `[ ]` | Needs you |

## PHASE 7. BUILD

| ID | Item | Status | This round |
|---|---|---|---|
| 7.1 | Cheapest stack | `[x]` | **Decided (D-03)** |
| 7.2, 7.3 | Lovable Prompt 1 and Prompt 2 | `[x]` | Written earlier (not in this repo). A working prototype of the same logic exists in `../prototype/` |
| 7.4 | Run both prompts and fix what breaks | `[ ]` | Later (N9) |
| 7.5 | Replace sample data with verified rows | `[ ]` | Needs data |
| 7.6 | Rules-only fallback working with the model off | `[x]` | Works in the prototype (form on model error) |
| 7.7 | Unhandled-requests log feeding new test rows | `[~]` | Log works in the prototype; the step that turns rows into test cases is not built |

## PHASE 8. EVALS

| ID | Item | Status | This round |
|---|---|---|---|
| 8.1 | At least five eval parameters | `[x]` | Accuracy, reliability, safety and honesty, experience, language; defined per feature |
| 8.2 | Convertible test | `[x]` | Included in F01 test types |
| 8.3 | Human rubric: four criteria on 1/3/5 | `[x]` | Four criteria named in each feature doc; anchors to write |
| 8.4 | Assertion tests, including reply language | `[x]` | Listed per feature |
| 8.5 | Golden dataset, 30 to 50 hand-labelled pairs per core use case [S7] | `[ ]` | Targets set; **start clean** (D-04) |
| 8.6 | Two or more raters per sample; log disagreements [S8] | `[ ]` | Needs people |
| 8.7 | LLM judge verified against humans [S8] | `[ ]` | P9 drafted; calibration needs 8.6 |
| 8.8 | Competitor benchmark vs your benchmark | `[ ]` | Test defined in F02 |
| 8.9 | Ship gate [S7] | `[~]` | Proposed in each feature doc; you confirm |
| 8.10 | Failure analysis, at least three cycles [S9] | `[ ]` | Needs runs |
| 8.11 | Iteration log, graded [S9] | `[ ]` | Start a new log |
| 8.12 | Turn each example into a test row | `[ ]` | Types listed per feature; rows to write |

## PHASE 9. CUSTOMER LEARNING

| ID | Item | Status | This round |
|---|---|---|---|
| 9.1 | At least five real-user sessions [S10] | `[ ]` | Needs you and real users |
| 9.2 | Save verbatims | `[ ]` | — |
| 9.3 | Record what changed because of them | `[ ]` | — |
| 9.4 | Add real queries to the golden set, marked real | `[ ]` | — |

## PHASE 10. AI PRD

| ID | Item | Status | This round |
|---|---|---|---|
| 10.1, 10.2 | Full PRD sections; one-page AI PRD | `[x]` | Done earlier (not in this repo). The decisions and prompts here can feed an update |
| 10.3 | Update with the five capstone items [S5] | `[ ]` | Material ready in D-06, D-10, 5.5, 5.6; needs 5.1 to 5.7 |
| 10.4 | Fill open numbers once measured | `[ ]` | Needs measurement |

## PHASE 11. BUSINESS

| ID | Item | Status | This round |
|---|---|---|---|
| 11.1, 11.3, 11.4, 11.5 | Revenue beyond affiliate; token economics; latency budget; responsible AI | `[x]` | Done earlier. Revenue lines are in the prototype's "How it works" page |
| 11.2 | Confirm the affiliate commission rate from the programme's own schedule | `[ ]` | Needs you |
| 11.6 | Market potential check on the new use cases | `[ ]` | Later |

## PHASE 12. HAND-OFF AND FINISH

| ID | Item | Status | This round |
|---|---|---|---|
| 12.1 | Master document for Claude Code | `[x]` | Done earlier |
| 12.2 | Update the master document after Phase 0 decisions | `[ ]` | Phase 0 now decided; ready to update |
| 12.3 | Export all documents as Markdown | `[~]` | This folder, the data model and the JTBD analysis are Markdown |
| 12.4 | Final demo and 10-minute presentation [S10] | `[ ]` | Needs you |
| 12.5 | Check end-of-course deliverables [S10] | `[ ]` | — |
| 12.6 | Check against the grading [S11] | `[ ]` | — |

---

## What I could not do, and why

- **Any measured number** (accuracy, p95, cost, agreement): no model key and no real data were available. All ship gates are **proposals**.
- **V × F × D × R anchors and the cost-of-being-wrong worksheet:** I have not seen the slides.
- **Real catalog, prices, reviews, used prices:** they have to be collected.
- **Real-user sessions and native-speaker checks:** they need people.
