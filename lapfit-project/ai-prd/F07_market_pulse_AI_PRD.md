# AI PRD: F07 Market pulse

Extension. **This feature uses no AI model by design.** The PRD is still written, because the template requires it and because the reasons for not using AI are part of the product decision. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F07_market_pulse.md`.

## 01 Problem and user

| | |
|---|---|
| **Who** | Buyers with a shortlist who want to time a purchase; analysts (the same data) |
| **What breaks today** | Buyers do not know what is being checked, what complaints are growing, or whether a price has really fallen |
| **Evidence** | Desk research; **no real-user sessions yet**. The existing data has **no dates and no price history**, so this feature cannot work on it; it needs live usage or sample data |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Nothing in the first version |
| What stays rule-based? | Everything: counts, windows, thresholds, price comparison |
| Cost of being wrong | **Low to medium**: a false trend could mislead timing. Fixed thresholds, minimum counts and the gate's recomputation protect against it |
**Decision:** no model. A model would add cost and error to counts that are exact, and **forecasting prices is deliberately not offered**, because the data cannot support it.

## 03 AI objective and metrics

**Data objective (in place of an AI objective):** *Show three lists (most checked, rising complaints, price falls) that equal what the data says, with counts and dates.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Visits to owner reports from a market item | Not measured | Track |
| Business | Return visits to the market view | Not measured | Track |
| Quality | Lists equal hand-computed fixtures | — | **100%** |
| Quality | Items below minimums listed; a view carrying an address or account | — | **0** |
| Ops | Snapshot older than 36 hours | — | 0 |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| **Counts and thresholds in SQL** | Fast | $0 | Exact | **Chosen** |
| Statistical change-point detection | Fast | $0 | Better on noisy series | V2 |
| Model-written trend summaries | Slower | Small | Can over-read noise | Rejected |
| Price forecasting | — | — | Unproven | **Rejected** until a measured skill exists |

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Views | Our own events; distinct sessions, hashed, no identity | 0 real; sample until real | — |
| Owner reports with dates | F06 reports (new) | 0 real | — |
| Price history by seller and day | Price job (to build) | **One snapshot (10 Nov 2026) for 14 laptops** | Daily ingestion; verified sellers only |
| Sample series | Marked `is_sample`, labelled | For demonstration | — |
Coverage per segment: not applicable; no segmentation in the first version.

## 06 Eval plan

| Item | Plan |
|---|---|
| Test set | Fixtures with known answers for each rule |
| Mix | Exactly 5 reports (listed) vs 4 (not); equal to the prior window (not rising); 3% vs 2.9% drop; empty window; new laptop with no history; a price rise; one session viewing five times |
| Assertions | List equals fixture; counts respect distinct sessions |
| Thresholds | All fixtures pass; minimums respected |
| Calibration | After four weeks of real data, check the thresholds against the observed distribution of day-to-day price changes |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Nothing meets the minimum | Count | "Nothing meets the minimum for this window." |
| Snapshot stale or job failed | Age check | Computed on demand; alert to the team |
| Gate mismatch | Recompute | "I could not show this reliably." |
| A bot inflates views | Distinct sessions; admin exclusion | Not counted |
| One seller's error price | Verified sellers only; admin exclusion | Not used |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| Threshold calibration | Admin reviews the calibration report | Monthly [A] |
| Exclusions (bots, bad prices) | Admin | As needed |
No approvals are needed per answer.

## 09 Responsible AI

- **Fairness:** not applicable by segment in the first version; checks are counts of anonymous activity.
- **Privacy:** random per-tab-session ids, hashed; no address, no account; no tracking of people.
- **Transparency:** each list states its thresholds, window and data source; sample activity is labelled.
- **Safety:** no forecasts and no "buy now" advice.
- **Abuse:** distinct-session counting and exclusions.

## 10 Cost and token economics

**$0 per request in model cost.** Database reads only. Infrastructure plans were not checked. Versus today: no equivalent service.

## 11 Latency budget

Reading a snapshot p95 **under 0.5 s**; on-demand compute **under 2 s**; no model in the path.

## 12 Launch plan and guardrails

Shared phases apply. **Gates:** fixtures pass; real price ingestion running for at least four weeks before phase 2 so the lists are real; sample data labelled until then. Monitors: snapshot age, share of empty lists, distinct-session vs raw view ratio. Kill switch: hide the feature if lists are empty or wrong.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Which price sources, with what permission? | Data lead, product owner | 4 Dec 2026 |
| Are 3% (price), 5 reports (complaint) and 20 checks (most checked) the right thresholds? | Product owner, after four weeks of data | Four weeks after ingestion starts |
| Should "most checked" be public or only for brands? (decision: public above the minimum) | Product owner confirms | 27 Nov 2026 |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
