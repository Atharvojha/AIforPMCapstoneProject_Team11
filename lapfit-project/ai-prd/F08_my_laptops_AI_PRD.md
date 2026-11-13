# AI PRD: F08 My laptops

Extension. **This feature uses no AI model by design.** Written to the template so the decision to avoid AI is documented. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F08_my_laptops.md`.

## 01 Problem and user

| | |
|---|---|
| **Who** | Current owners of a laptop |
| **What breaks today** | Warranty dates are forgotten; owners do not know whether the price has dropped since they bought, what the laptop is worth, or what other owners report about it |
| **Evidence** | Desk research; **no real-user sessions yet**. Whether owners will return to such a view is untested |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Nothing |
| What stays rule-based? | Warranty end date, days left, price gap, resale range (shared with F09), owner counts |
| Cost of being wrong | **Medium for dates**: a wrong warranty date could cost an owner a claim. So dates show the rule used and the catalog text |
**Decision:** no model. These are date and price calculations.

## 03 AI objective and metrics

**Data objective (in place of an AI objective):** *Compute warranty, price and value facts for a saved laptop exactly, and show them with their source and date.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Owners who return within 30 days | Not measured | Track |
| User | Owners who take a next step (owner reports, share, sell) | Not measured | Track |
| Quality | Dates and price gaps equal fixtures | — | **100%** |
| Privacy | Any owner list stored on the server in the on-device version | — | **0** |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| **Calculation in code** | Instant | $0 | Exact | **Chosen** |
| Model to explain status | Slower | Small | Can misstate a date | Rejected |
| Reminders by scheduled job | Scheduled | Small | Exact | V2, needs accounts |
| Accounts and sync | — | Security and support cost | — | V2 |

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Owned laptops (version, purchase date, optional price paid) | The owner, kept on their device | Per user | None |
| Catalog warranty years | **Missing in the existing data**; curate from manufacturer pages | 14 laptops | Named verifier |
| Price now with date | Catalog | 14 laptops | As F01 |
| Owner reports | F05, F06 | Sparse | — |

## 06 Eval plan

| Item | Plan |
|---|---|
| Test set | Fixtures with known dates and prices |
| Mix | Warranty ends today, yesterday, in a leap year; a purchase date in the future; price paid blank; gap positive, negative, zero; a version removed; storage blocked |
| Assertions | Server stores no list; dates and gaps exact |
| Thresholds | All fixtures pass; privacy check passes |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Browser storage blocked | Write fails | Works for the session: "Not saved on this device" |
| Version removed from catalog | Lookup fails | Saved facts with "no longer in the catalog" |
| Server unreachable | Timeout | Saved facts without computed figures and a notice |
| Browser data cleared | — | The list is gone; V1 export is the remedy |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| Warranty rule exceptions per brand | Admin adds rules with sources | As needed |
No other human review.

## 09 Responsible AI

- **Fairness:** not applicable; no model.
- **Privacy:** the list stays on the device; the server computes and does not log it; any move to accounts needs a notice and consent first.
- **Transparency:** warranty shown with its rule and the catalog text; the resale range labelled as a sample.
- **Safety:** no claim about refunds or price protection.
- **Abuse:** rate limit on the compute call.

## 10 Cost and token economics

**$0 per request in model cost.** Infrastructure not checked. Versus today: owners track this by hand or not at all.

## 11 Latency budget

Summary p95 **under 0.5 s** for up to 10 items. No model.

## 12 Launch plan and guardrails

Shared phases apply. **Gates:** warranty years curated and verified for every catalog laptop; fixtures pass. Monitors: error rate of the compute call; storage-blocked rate. Kill switch: hide the resale range if the sample band is disputed.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| When does each brand's warranty start (purchase or invoice date)? | Data lead, checking manufacturer pages | 4 Dec 2026 |
| Are accounts and reminders in scope (decision: V2)? | Product owner confirms | 20 Nov 2026 |
| Reminder channel (email, other) and consent | Product owner | After accounts are scoped |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
