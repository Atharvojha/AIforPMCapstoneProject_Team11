# AI PRD: F10 Brand and retailer insights

Extension; a second payer for the same data. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F10_brand_insights.md`. Prompt: `../ai-spec/03_SYSTEM_PROMPTS.md` (P7 narrator, V2, optional).

## 01 Problem and user

| | |
|---|---|
| **Who** | Brand and category managers, retailers, refurbishers |
| **What breaks today** | They see sales but not why a model underperforms: what buyers asked for and could not find, what owners complain about by user type, and where prices sit |
| **Evidence** | Desk research and the JTBD analysis. **Nobody has been asked yet.** The demand figures in the prototype are **invented**, so the screen demonstrates a concept and is not evidence of demand; what a brand would pay is unknown |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Only the optional short narrative (V2) |
| What stays rule-based? | All figures: ratings by user type and topic, price series, checks per week, complaints, demand bands, unmet demand, and the **suppression of small groups** |
| Cost of being wrong | **Medium**: a wrong figure could drive a business decision, and small groups could identify a person's preference. So figures are exact and small cells are hidden |
**Decision:** no model in the first version. A narrator could be added later only if every number in it is checked against the computed figures.

## 03 AI objective and metrics

**Data objective (AI optional):** *Give a brand exact, anonymous, correctly labelled insights from owner reports, prices, views and buyer demand, hiding anything too small to be safe.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Brand contacts who say it changed or would change a decision | Not measured | At least 2 of 3 contacts [A] |
| Business | Brand contacts willing to pay, and the price | **Unknown** | Learn in three conversations |
| Quality | Figures equal fixtures | — | **100%** |
| Hard | A suppressed cell shown or exported; a brand reading another brand's model | — | **0** |
| Model (V2) | Every number in a narrator note found in its input | — | 100% |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| **SQL aggregates with suppression** | Fast | $0 | Exact | **Chosen** |
| Clustering of Must combinations | Fast | $0 | Finds patterns | Future (about 10,000 searches) |
| Model-written narrative from figures | About 3 s | About $0.0004 | Can over-read thin data | V2, checked |
| Free-form chat over the data | — | — | Can invent | Rejected |
**Trade-off:** hiding small groups loses detail but protects people and avoids over-reading.

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Owner opinions | Existing machine-read opinions (course use only) and future owner reports | 14 categories; no user types yet | As F05 |
| Prices | Price job (to build) | One snapshot today | Daily ingestion |
| Views | Our own distinct-session events | Sample until real | — |
| **Buyer demand** | Logged from searches: budget band, uses, Must labels, matched count; **no typed text** | **Sample (invented) until real searches exist** | — |
| Brand accounts | Supabase Auth with a role and brand id | None | Admin invites |
The buyer-facing privacy notice must state that anonymous preferences are used in aggregate.

## 06 Eval plan

| Item | Plan |
|---|---|
| Test set | Fixtures with hand-computed aggregates |
| Mix | A cell with 4, 12 and 20 reports; empty user type; zero-match demand; groups under 20; two versions with different price histories; a brand requesting another brand's model |
| Assertions | Suppressed cells absent from views and exports; scope enforced by the database |
| Thresholds | Fixtures pass; privacy minimums respected |
| User test | Show the view to three brand or retailer contacts and record the decision it changes and what they would pay |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| No data yet | Empty result | "No owner reports by user type yet." |
| Cell too small | Suppression rule | Hidden or marked "early signal" |
| Sample data | Flag | A SAMPLE DATA notice |
| Gate mismatch | Recompute | "I could not show this reliably." |
| Brand disputes a report | Takedown process | Row removed; counts recompute |
| Not authorised | Role check | 403 and a logged attempt |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| Brand onboarding | Admin creates the brand and links models | Per brand |
| Release rules | Admin decides what may be shown | One-off, then as needed |
| Disputes | Reviewer re-checks the report | Within 2 working days |
| Narrative (V2) | Spot-check | Sample weekly [A] |

## 09 Responsible AI

- **Fairness:** the same figures for every brand; no sponsored boosting; sample data labelled.
- **Privacy:** aggregates only; groups under 5 hidden, 5 to 19 marked early signals, demand cells need 20 or more searches; no typed text; no identifiers; access log.
- **Transparency:** every figure with n and its source; a statement that the data is indicative and anonymous.
- **Safety:** no recommendations to change a product; no competitor figures.
- **Abuse:** rate limits; exports logged; the database enforces brand scope.

## 10 Cost and token economics

**$0 per request in model cost** in the first version. Narrator (V2): N, **$0.000425** per note; at 20 notes a month per brand that is under a cent. Infrastructure not checked. Versus today: market research reports or surveys, whose cost I did not check.

## 11 Latency budget

Views p95 **under 2 s** from summary tables; export under 5 s. No model in the path.

## 12 Launch plan and guardrails

Shared phases apply. **Gates:** sign-in, brand scope and access log in place; terms and the buyer notice reviewed; real data (not sample) before any brand sees it as evidence; three brand conversations held. Monitors: access log, suppressed-cell ratio, brand disputes. Kill switch: disable the brand surface without affecting buyer features.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Which three brand or retailer contacts? | Product owner (ask the instructor or mentor) | 27 Nov 2026 |
| What would a brand pay? (unknown) | Product owner, from conversations | 11 Dec 2026 |
| Minimum group sizes (5 and 20) | Product owner, with a privacy advisor | 4 Dec 2026 |
| Does the buyer notice cover aggregate use? | Legal contact | 4 Dec 2026 |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
