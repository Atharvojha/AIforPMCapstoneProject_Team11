# How to be accurate without training a model

Training or fine-tuning a model is not needed for LapFit's first version. Almost every accuracy problem here comes from **where an answer comes from**, not from how clever the model is. This document lists the techniques, then applies them to every feature and scenario.

**Honest limit:** nothing here guarantees accuracy. It makes errors *rare, visible and checkable*, and it lets the product say "I do not know" instead of guessing. Whether it works is decided by the evaluation, not by this document.

---

## 1. The principle

A model is accurate when the question is easy and the evidence is in front of it. So:

> **Make the question small, put the evidence in front of the model, check the answer in code, and let the product abstain when the evidence is thin.**

The AI model does two things only: **read** (language or an image into fields) and **write** (short wording from given facts). Everything that is a fact, a calculation, a comparison, a ranking or a verdict is done by stored data and code.

---

## 2. The accuracy stack (twelve techniques, in order of effect)

| # | Technique | What it prevents | Where it is in LapFit |
|---|---|---|---|
| 1 | **Ground every fact in a stored row** (spec, price, review, verdict) | Invented specs and prices | Catalog, `spec_fact` with provenance, `price_history`, `claim_ledger` |
| 2 | **Split the task** into read, decide, write | One model call doing everything and being wrong silently | Router reads; code decides; writer words |
| 3 | **Decide in code, not in the model** | Wrong filtering, ranking, arithmetic | SQL filters, scoring, value calculations, claim comparison |
| 4 | **Constrain the output** (JSON schema, closed lists, enums, null for "not stated") | Free-form answers that cannot be checked | Router schema; allowed attributes and topics; "null means not stated" |
| 5 | **Retrieve, then answer from what was retrieved** (filters first, then text search, then vectors; de-duplicate) | Answers from memory; duplicated reviews counted twice | `get_reviews`: filters, full-text, optional vector; duplicate clusters |
| 6 | **Quote exactly** and verify the quote | Fabricated or altered quotes | Existing opinion rows keep exact quote and offsets; the gate checks they appear in the source text |
| 7 | **Verify before showing** (the pre-send gate) | Any wrong figure reaching the user | Gate re-checks IDs, Musts, prices, dates, numbers in text, approvals |
| 8 | **Abstain honestly** (minimum evidence, "not checked yet", "not in catalog") | Overconfidence | n under 20; no verdict without an approver; "cannot check yet" |
| 9 | **Temperature 0, versioned prompts, few examples, tiny tasks** | Run-to-run drift | Reading at 0; writing at 0.2 with a code check; prompt version on every row |
| 10 | **Humans approve what is published or declared true** | Wrong verdicts, abuse, personal data | Claim ledger approvers; owner-report review; tag audits |
| 11 | **Invest in data quality** (curation, provenance, spot checks, duplicates) | "Garbage in" | Curate 14 laptops; verify 13 flagged spec facts; audit opinions |
| 12 | **Measure, then fix the worst failure class** (golden sets, regression tests, judge calibrated against people) | Fixes that make things worse | Evaluation loop with frozen golden sets |

**Why these work without training:** a general model is already good at reading messy language. It is *bad* at knowing today's price of a specific Indian laptop. Techniques 1 to 8 remove that need. Training would teach it patterns; LapFit needs it to look things up.

---

## 3. What each feature does, and what remains

For each scenario: where wrong answers come from, which techniques handle it, and what risk is left.

### F01 Shortlist

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Understanding "under 60k, 16GB compulsory, light, blue" | The model misreads budget, tier (Must or Nice) or attribute | Schema and closed attribute list (4); money parsed again in code (3); `source_text` kept per criterion; editable understood-needs (the buyer corrects) | Rare vague phrases become "cannot check yet" instead of filters |
| Filtering | Wrong match | SQL on stored values; every Must checked twice (query and gate) (3, 7) | Data gaps (hinge, colour) until curated |
| Ranking | Subjective weights | Deterministic scoring with weights in settings; ties by price (3) | Weights are judgement; tune by user sessions |
| "Nothing fits" | Silent dropping of a Must | Counterfactual relax options computed in code; nothing applied without the buyer's choice (3, 8) | — |
| Colour not available | Wrong substitution | Proximity table, then dark colour, stated in a notice (3) | Table coverage |
| Reasons | Invented numbers | Facts passed in; numbers checked against the facts; template fallback (2, 7) | Plainer wording in the fallback |

### F02 Second opinion + check the pitch

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Which laptop is meant | Fuzzy names, several versions | Alias table, fuzzy match in code, ask which, "not in catalog" (3, 8) | New aliases appear; admin adds them |
| Tick or cross for each Must | Wrong comparison | Computed from stored values (1, 3) | Data gaps |
| Owner evidence | Thin or duplicated reviews; misread polarity | Counts after duplicate removal; minimum n; quotes shown verbatim; "machine-read" label (5, 6, 8) | Machine labels are wrong about 1 in 8 (your measured figure) |
| Spec claim ("32 GB RAM") | Model judging a spec | Parsed in code and compared to the catalog (3) | Odd phrasing; unit confusion handled by rules |
| Other claims ("full-day battery") | Model inventing a verdict | **Retrieval without generation**: show a verdict only if a named person approved it; otherwise "Not checked yet" with counts (1, 8, 10) | Many claims will be "not checked yet"; approvals grow it |
| Claim splitting | Missed or merged claims | Schema, one claim per entry, dedupe; evaluated for recall and precision (4, 12) | Run-on sentences |
| Prompt injection in the pitch | Text steering the model | Text as data; schema; code patterns; ignored list; the model cannot change a verdict anyway (2, 3) | Novel phrasing |

### F03 Used laptop check

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Reading a listing | Guessing missing values | "Null if not stated"; code treats null as a flag, not a value (4) | Photos (V1) misread small text |
| Impossible combinations, OS, battery, serial | Model opinions | Rules against the catalog and a dated OS table (3) | Windows 11 rule follows Microsoft's processor lists; unknown processors say so |
| Is the price right? | No real used prices | Percentile band from observed prices when 20 or more exist; sample band labelled as sample otherwise (1, 8) | Real used prices must be collected |
| "Should I buy?" | Model giving a verdict | No verdict anywhere in the product; fixed wording (3, 8) | — |

### F04 Buy for others or a team

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Recipient and use | Over-asking or guessing | State machine, at most two questions (2, 3) | Persona defaults are assumptions, shown as editable |
| Team table | Parsing errors | Deterministic parser first; model only for messy tables; unreadable lines named (3, 4) | Odd table layouts |
| Totals | Arithmetic mistakes | Integer maths in code; the gate recomputes totals (3, 7) | — |

### F05 Owner voice

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Typed question to filters | Misread persona or topic | Closed lists; unknown values named back (4) | Imported data has no persona, months or dates |
| Counts and ratings | Wrong arithmetic; duplicates | SQL aggregates, duplicate clusters, gate recomputes (3, 5, 7) | — |
| Labels on imported reviews | Wrong topic or polarity | Audit one in ten; confidence threshold; human verify before "verified"; show as machine-read (10, 11, 12) | Existing 1,316 labels are unverified |
| "People like you" | Blending groups | Only the matching group is counted; the wider view is labelled (3, 8) | Small groups |

### F06 Add my experience

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Personal data, abuse, spam | Missed by a pattern | Rules, then model triage, then **a human on every report** (10) | A determined bad actor; rate limits and audit |
| Deletion | Orphaned data | Receipt code removes the submission and its evidence row; counts recompute (3) | — |

### F07 Market pulse

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Trends, complaints, price falls | Over-reading noise; bots | Fixed thresholds in settings; minimum counts; distinct sessions; gate recompute (3, 7, 8) | Needs real history; sample data until then |

### F08 My laptops

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Warranty, price gap | Wrong dates | Pure date and price arithmetic; rule shown (3) | Warranty start rule per brand is an assumption |

### F09 Sell plan

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Reading condition | Guessing a battery % | Null for anything not said (4) | Vague words leave fields unknown |
| Value and fixes | No real used prices; sample factors | Counterfactual calculation, range widened for unknowns, assumptions shown on every plan (3, 8) | **The numbers are samples until real sale outcomes exist** |
| Listing text (V1) | Flattering a flawed laptop | Facts only; every flaw included; numbers checked; template fallback (2, 7) | — |

### F10 Brand insights

| Scenario | Where errors come from | What prevents them | What remains |
|---|---|---|---|
| Aggregates | Small groups, one-source skew | Minimum group sizes; early-signal labels; source counts (8) | Demand data is sample until real searches exist |
| Narrative (V2) | Over-reading | Numbers only from the computed figures; checked (2, 7) | — |

---

## 4. What your own tests already show

These are from your repo's README and evaluation files, and they matter because they show how accuracy actually behaves.

| Observation | Meaning |
|---|---|
| The opinion reader scored **precision 0.88 and recall 0.83**, against answer keys written by Claude, not by a person | Good for a first pass; wrong about 1 call in 8. So label as machine-read, and audit |
| An earlier model arm reached **56%** dealbreaker recall against a target of 85% | Model-only answers did not meet the bar; this is why decisions move into code |
| The claim checker went from **68% to 91% to 100%** across three Claude-written sets, "every fresh test exposed new gaps" | Fixes were tuned to the tests. Keep a **held-out** set that no one fixes against, and write at least one by hand from real listings |
| Deterministic metrics (quote exact-match, citation validity) were set at **100%** | These are checkable by code, so they can be required to be perfect |

Lesson: **put anything that can be checked by code behind a code check, and expect the language parts to be good, not perfect.**

---

## 5. What can honestly be promised

| Claim | Can we promise it? | Why |
|---|---|---|
| "Every spec and price shown comes from a stored, dated row" | Yes, enforced by the gate | Code |
| "A Must you set is never silently dropped" | Yes | Code and tests |
| "A verdict appears only if a named person approved it" | Yes | Code and tests |
| "The numbers on screen match the data" | Yes | Gate recomputation |
| "Owner opinions are summarised correctly" | **No, only 'usually'** | Machine-read labels; show exact quotes and the count so the buyer can check |
| "The sell estimate is accurate" | **No** | Sample factors until real outcomes exist |
| "The answer is right for your situation" | **No** | LapFit shows evidence; the buyer decides |

---

## 6. Measuring it (the loop that keeps it accurate)

1. **Golden sets per feature**, frozen (hashed) before the first scored run and never edited to look better. Reuse the structure in your `docs/RAG_EVALUATION.md`.
2. **Two kinds of metrics:** *hard* (must be exactly zero or 100%, checkable by code) and *soft* (reading accuracy, wording quality).
3. **Hand-labelled core:** at least 30 to 50 items per core feature labelled by two people, with disagreements logged. Labels written by an AI do not count as truth.
4. **Judge model** only after it agrees with the two people.
5. **Failure analysis cycles:** run, cluster the failures, fix the worst class, rerun, log the change. Three cycles minimum.
6. **Regression block:** a change that lowers a hard metric cannot be released.

---

## 7. When would training become worth it?

Not now. Revisit when a measured number says so:

| Trigger | Next step |
|---|---|
| Router cost or latency misses budget at volume | Fine-tune or distil a small router |
| About 5,000 labelled reviews and the model labeller is the bottleneck | Train a small topic and polarity classifier |
| About 1,000 real used or sale prices per segment | Learn a price model (quantile regression), keeping rules as floor and ceiling |
| About 5,000 sessions with a chosen laptop | Learn a ranking, keeping Musts as hard filters |
| About 2,000 labelled condition photos | Train an image classifier for condition |

Until then: **better data, better tools, tighter checks, and honest abstention.**
