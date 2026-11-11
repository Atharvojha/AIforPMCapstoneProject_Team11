# FEATURE_BACKLOG — living (Stage 1 draft; nothing here is approved scope until Gate 1)

> **Final state (2026-11-11, latest): read `FINAL_STATE_2026-11-11.md` first.** Product: five nav items (My needs · Find laptops · Check a listing · Check a claim · Compare; About in the footer). Headline feature: **Listing Lie Detector** (paste any listing; each claim checked or labelled "only the seller's word"; questions to ask the seller). Needs are a **needs sheet** (12 categories, levels, number scales, your edits win). AI = reads reviews, splits pasted listings, finds same-meaning reviews; every verdict is code. Evidence covers 14 Indian + 15 US evidence laptops. Team doubts and answers: `DOUBTS_AND_ANSWERS.md`.

> **Update 2026-11-11:** built since last status — free-text needs, recommended numbers, ranked list with category ratings, claims without a laptop (brand/line/generic/numeric). Still not built: bottleneck explainer, share report, correction loop, adaptive interview.


Scores 1–5 (5 = best; for risk/complexity 5 = safest/simplest). Status = Proposal until approved.

| ID | Feature | Value | Diff. | Feasible | Data ready | AI-reliable | Legal-safe | Demo | Proposed |
|---|---|---|---|---|---|---|---|---|---|
| F01 | **Claim router** — classify a claim into spec / measured / experiential / predictive and send it to the right verdict engine | 5 | 5 | 4 | 4 | 4 | 5 | 5 | MVP |
| F02 | **Test-condition normaliser ("claim translation")** — restate "12 h battery" as testable conditions; show claim vs evidence conditions side by side; mark non-comparable | 5 | 5 | 3 | 3 | 4 | 5 | 5 | MVP |
| F03 | **Evidence ledger** — For / Against / Not applicable lanes per sub-claim, exact quotes, source class, variant match, "why excluded" | 5 | 4 | 4 | 5 | 4 | 4 | 5 | MVP |
| F04 | **Verdict ladder (deterministic)** — Supported / Contradicted / Mixed / Insufficient from documented rules; manufacturer-only = "claimed, unverified" | 5 | 4 | 4 | 4 | 5 | 5 | 4 | MVP |
| F05 | **What would change this verdict + seller questions / in-store test** (from evidence gaps) | 4 | 4 | 4 | 5 | 4 | 5 | 4 | MVP |
| F06 | **Hard-requirement gate + SKU-trap detector** (RAM/GPU/storage/price vs profile; sibling listings; upgraded-RAM reviews) | 5 | 4 | 4 | 4 | 5 | 5 | 5 | MVP |
| F07 | **Category ratings with coverage** (policy B): deterministic engine, weights per workload, coverage shown separately, no overall rank | 5 | 4 | 3 | 3 | 5 | 5 | 5 | MVP |
| F08 | **Evidence coverage map** — categories × evidence class (spec / lab / owner) heat grid; blanks are visible | 4 | 5 | 4 | 4 | 5 | 5 | 5 | MVP |
| F09 | **Workload→bottleneck explainer** ("your first limit will be RAM, then thermals") | 5 | 4 | 3 | 3 | 3 | 5 | 4 | MVP |
| F10 | **Disagreement explainer** — conflicting reports clustered and explained by usage/config/duration, never averaged | 5 | 4 | 3 | 4 | 3 | 5 | 5 | MVP |
| F11 | **Duplicate collapse** — "3,300 reviews → 2,590 distinct texts"; copies count once | 3 | 3 | 5 | 5 | 5 | 5 | 3 | MVP-lite |
| F12 | **Adaptive workload interview** — presets + 2–4 follow-ups per workload, optional free text parsed into an editable profile card | 5 | 4 | 3 | 5 | 3 | 5 | 5 | MVP (D-010) |
| F13 | **Trust page** — live eval metrics, versions, prompt-injection demo | 4 | 5 | 4 | 4 | 5 | 5 | 5 | Next (cheap if harness built) |
| F14 | Parent/co-payer share report (print/PDF) | 4 | 3 | 4 | 5 | 5 | 5 | 4 | Next |
| F15 | Compare 2–3 variants ("what you gain/lose") | 4 | 3 | 4 | 4 | 4 | 5 | 4 | MVP (core scenario A) |
| F16 | **Live research for any laptop/claim** (search adapter, permission gate, extraction, validation, cache) — D-015 | 5 | 5 | 2 | 3 | 3 | 3 | 5 | **MVP** (promoted) |
| F17 | Answer-change tracing when new evidence arrives | 3 | 5 | 2 | 2 | 4 | 5 | 3 | Later |
| F18 | User correction loop → eval candidates | 3 | 4 | 3 | 5 | 5 | 5 | 3 | Next |
| F19 | Community ownership reports | 2 | 3 | 1 | 1 | 2 | 2 | 2 | Later |
| F20 | Chat-style assistant | 2 | 1 | 4 | 5 | 2 | 5 | 2 | **Reject** (looks like generic ChatGPT; weak provenance) |
| F21 | Overall best-laptop leaderboard / single score | 2 | 1 | 4 | 3 | 3 | 5 | 3 | **Reject** (PRD FR8, D-009) |

## Open design questions per feature
- F01/F04: exact rules for each claim type (drafted in Stage 1 discussion; see PRODUCT_DECISIONS once approved).
- F02: which measurement classes exist per attribute (battery: video playback / web / office / gaming; thermals: CPU package / GPU / surface / fan dB).
- F07: weights per workload and minimum coverage to show a number (proposal: ≥60% weighted coverage; else label "Not enough evidence").


## Build status (2026-11-11)
Built: F01 router, F02 condition-aware battery (situations), F03 evidence ledger, F04 verdict ladder, F05 'what would change'/gaps (partial: gaps and 'doesn't prove', no seller checklist), F06 must-haves + 'below what you asked', F07 category ratings with coverage, F08 coverage evidence mix (as 'Based on' column), F10 disagreements, F11 duplicate collapse, F13 Trust page, F15 compare, F16 live research.
Not built: F09 bottleneck explainer, F12 adaptive interview + free-text parsing (replaced by a plain form), F14 share report, F17 answer-change tracing, F18 correction loop, F19 community reports.


## Final state status (2026-11-11)
**Built:** needs sheet (levels, scales, steppers, saved), free-text needs and ranking, claims with any scope, Listing Lie Detector (claims, arithmetic, fit, owners by laptop or brand, seller questions, optional lookup), sourced suggested numbers (RAM, storage, CUDA), 15 US evidence laptops, reader v3, About page with the AI map and our own results, backups. **Ideas not built:** same-chip twin (nearest laptop we have for an unknown model, shown as "likely"), a shareable "ask the seller" card, live-lookup results feeding the Lie Detector (Q-034), share report, saved history, bottleneck explainer. **Needed next:** human-written key from 20 real listings (Q-033); sources for processor, battery, weight, refresh numbers (Q-028); battery Wh for the 9 laptops missing it; more laptops (Amazon scan 28% done); unit and language handling (lbs, mAh, Hinglish) in the Lie Detector.
