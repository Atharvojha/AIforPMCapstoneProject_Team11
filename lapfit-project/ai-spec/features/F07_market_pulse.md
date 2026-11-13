# F07. Market pulse (extension)

**User job.** When I am deciding when and what to buy, I want to see what is trending, what people are complaining about and which prices are falling, so I can time the purchase.
**Users.** Buyers with a shortlist; brand analysts (the same data).
**Prototype status.** Built (Market screen, Home "This month" tiles). Windows of 7, 30, 90 days. Activity is sample data.
**Prompts used.** None. This feature uses no model.
**Full feature specification:** `../specs/F07_market_pulse.md`.

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Most checked | SQL count of views in the window vs the window before | A count | A model adds nothing | — |
| Rising complaints | Rule: low-rated reports (3.0 or below), at least 5 in the window, more than the window before | Transparent threshold | ML would hide the rule | Enough history: change-point detection |
| Price drops | Rule: current price vs the price at the window start, at least 3% | Exact | Forecasting would imply certainty we lack | Never forecast prices without evidence of skill |
| Narration | None | Numbers are enough | A model could over-read | — |

**Decision:** no AI, on purpose. This is the clearest case where a lookup and a threshold beat a model.

## 2. The five parts

### Trigger
Market screen opens or the window changes; Home tiles load; n8n schedule pre-computes the lists.

### Orchestration
1. Read the window (7, 30 or 90 days).
2. Compute the three lists in code (or read a pre-computed view).
3. Gate: recompute and compare; mismatch replaces the block with a "could not show" message.
4. Items link to Owners filtered to that laptop.
**Offline path (n8n).** Nightly: ingest prices, append to `price_history`; refresh trend views.

### Model
None.

### Knowledge
`view_events`, `evidence_excerpt`, `price_history`. Thresholds in settings.

### Eval loop
| Item | Plan |
|---|---|
| Test set | Fixed fixtures with known answers: for each rule, items just above and just below the threshold |
| Test types | Exactly 5 reports (listed) vs 4 (not); equal to prior window (not rising); 3% vs 2.9% drop; empty window; new laptop with no history; a price rise |
| Metrics | **Lists equal the hand-computed fixtures (hard)**; every item shows n or the dated prices; page load time |
| Proposed ship gate | All fixtures pass |
| Caveat | Views are sample activity until real use exists; the page says so |

## 3. Contract summary
| | |
|---|---|
| **Input** | A window in days |
| **Output** | Three lists with counts, dates, and the previous-window comparison |
| **Guardrails** | Fixed thresholds from settings; the gate recomputes; no forecasting |
| **Trade-offs** | Thresholds are blunt (a 2.9% fall is hidden); a cold start means empty lists |

## 4. Autonomy and cost of being wrong
**Suggest.** Low.

## 5. Failure modes
| Failure | Behaviour |
|---|---|
| No data in the window | "Nothing meets the minimum for this window" |
| Stale prices | Dates shown on every price |
| Gaming of view counts | V1: count one view per session per laptop per day |

## 5b. Questions for you (answered on your behalf in ../05_ANSWERS.md)
1. Are 3% (price) and 5 reports (complaints) the right thresholds?
2. Should "most checked" be shown to the public or only to brands?
