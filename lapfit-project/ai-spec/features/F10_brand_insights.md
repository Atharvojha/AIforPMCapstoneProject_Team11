# F10. Brand and retailer insights (extension, B2B)

**User job.** As a maker or retailer, I want to know what buyers want, what owners complain about, and where my prices sit, so I can fix the product and the range.
**Users.** Brand and category managers, retailers, refurbishers.
**Prototype status.** Built (For brands screen). **Sample data**: the demand rows are invented, so the screen demonstrates the view, not evidence of demand.
**Prompts used.** P7 (insight narrator, designed, optional).
**Full feature specification:** `../specs/F10_brand_insights.md`.

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Rating by user type and topic (heatmap) | SQL aggregate with n | Counts | A model adds nothing | — |
| Price history and position | SQL | — | — | — |
| Checks per week | SQL | — | — | — |
| Buyer demand by band, use and Must | SQL group-by | — | — | — |
| Unmet demand (searches with zero matches) | SQL: matched = 0, grouped by band and Musts | Direct | Clustering needs volume | About 10,000 searches: frequent-itemset mining or clustering of Must combinations |
| Small-group protection | Rule: show a figure only when the group is above a minimum size | Privacy | — | — |
| Narrative note | Optional LLM writing (P7) from computed numbers, checked in code | Saves analyst time | A model could guess causes | — |

## 2. The five parts

### Trigger
Opening For brands; choosing a laptop from the list; a scheduled brand report (n8n, designed).

### Orchestration
1. For the chosen laptop: persona x topic ratings with n, price history by version, weekly checks, rising complaints and price falls in the last 30 days.
2. Catalog-wide demand: budget bands, top Musts, unmet-demand rows.
3. Cells with fewer than 20 reports are marked as early signals.
4. (Designed) P7 writes a short note from these numbers; every number is checked against the input.
**Failure paths.** Empty data: "No owner reports by user type yet." Narrator down: numbers only.

### Model
None today. P7 (designed) is optional.

### Knowledge
`evidence_excerpt`, `price_history`, `view_events`, `demand_signal`. Brand table and access control (needed).

### Eval loop
| Item | Plan |
|---|---|
| Test set | Fixtures with hand-computed aggregates |
| Test types | A cell at 19 vs 20 reports; empty persona; zero-match demand; very small groups; two variants with different price histories |
| Metrics | **Aggregates equal the fixtures (hard)**; n on every cell; early-signal flag correct; narrator faithfulness (every number in the input) |
| User test | Show the view to three brand or retailer contacts and ask what decision it changes and what they would pay (assumption 6 in the JTBD analysis) |
| Proposed ship gate | Fixtures pass; privacy minimum respected |

## 3. Prompt contract summary
| | |
|---|---|
| **Input** | Computed figures with n |
| **Output** | A two to four sentence note |
| **Guardrails** | No causes, forecasts or recommendations; every number from the input; thin data marked as early signal |
| **Trade-offs** | Readable summaries risk over-reading small samples; the early-signal rule and n guard against it |

## 4. Autonomy and cost of being wrong
**Suggest.** Medium: a wrong business decision from thin or sample data.

## 5. Failure modes
| Failure | Behaviour |
|---|---|
| Sample demand data | Labelled sample until real searches exist |
| A brand sees a competitor's figures | Access limited to the brand's own models; aggregates only for others (needs accounts) |

## 5b. Questions for you (answered on your behalf in ../05_ANSWERS.md)
1. Who is the first brand or retailer contact to test this with?
2. Should competitor comparisons be in scope?
