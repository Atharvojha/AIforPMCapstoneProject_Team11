# F09. Sell plan (extension)

**User job.** When I want to sell my laptop, I want to know what it may fetch, which fixes are worth paying for, how to price it and when to sell, so I get more for it.
**Users.** Sellers and upgraders.
**Prototype status.** Built (Sell screen; Home ask box; "Sell this laptop" in Mine). **Sample assumptions** for the value factors and repair costs. No buyers connected.
**Prompts used.** P1 (P1g seller-condition reader), P6 (listing writer, designed), P3 (photos, designed).
**Full feature specification:** `../specs/F09_sell_plan.md`.

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Read condition and reason from free text | LLM extraction (P1g) or the form | Free language | The form alone loses typed input | — |
| Value today | Rules: new price from the catalog x age factor x condition factors, with a range | Transparent; no training data exists | An ML model without data would be noise | **Classic ML** (quantile gradient boosting with monotonic constraints) once about 1,000 real sale outcomes per segment exist. Rules stay as floor and ceiling |
| Is a fix worth it? | Recompute the value with the fix applied, minus the repair cost | Exact, explainable | An LLM guess would be unchecked | Same trigger as above: the model does the recompute |
| RAM upgrade | Rules: needs a free slot in the catalog and a higher-RAM version with the same storage; value from the catalog price gap | Uses real catalog data | — | — |
| Timing | Rules from new-price history | Transparent | Forecasting overclaims | — |
| Condition from photos | **Not built**; the user states it | Photo condition grading is unreliable without training | A vision LLM would guess | About 2,000 labelled condition photos: trained image classifier |
| Listing text | LLM constrained writing (P6), checked in code | Saves the seller time | Templates read poorly | — |

## 2. The five parts

### Trigger
Sell screen form submit; the "Use my words" box; Home ask box; "Sell this laptop" in Mine; offer button "Add the missing details".

### Orchestration
1. Read the input (form fields or P1g), normalise (unknown stays null).
2. Resolve the laptop to one catalog version (ask if several; if not in the catalog, give generic preparation tips and no figures).
3. Compute today's range from the catalog price and the sample factors. Widen the range for each unknown.
4. For each applicable fix, recompute with it applied; "Do this" if the gain beats the cost by at least the minimum net (₹500), or it is free; otherwise "Skip this", with the numbers.
5. Chain the worthwhile fixes for the "after fixes" range, costs and net gain.
6. Pricing: quick-sale and best-price pairs (list price, lowest to accept). Timing from price history. Disclosures and a reason-for-selling note.
7. Gate: recompute the whole plan from the stored input and compare; mismatch drops the plan.
8. (Designed) P6 writes listing text from the plan's facts, checked in code.
**Failure paths.** Missing details: list them and offer the form. Model down: the form still works.

### Model
P1g for reading; P6 (designed) for listing text. The valuation is code now; classic ML later. Gemini Flash-class for the LLM parts.

### Knowledge
| Source | Used for |
|---|---|
| Catalog | New price, memory-slot detail, higher versions |
| `price_history` | Timing |
| `resale_action` | Repair costs (**sample**) |
| Settings `RESALE` | Age and condition factors (**sample**) |
| `used_price_observation`, `sale_outcome`, `repair_quote` (Needed) | Real data to replace the samples |

### Eval loop
| Item | Plan |
|---|---|
| Golden set | At least 50 cases with hand-worked expected ranges (from real sales when available) |
| Test types | Every field unknown; every field known; battery below 80; cracked screen (repair not worth it); free memory slot with a higher version; no slot; laptop not in catalog; "need money fast"; a fault as the reason; Hinglish description; injection in the description |
| Metrics | **Plan figures equal a fresh recomputation (hard)**; verdict consistent with net (hard); unknowns listed; MAPE of the mid value against real sale prices (once available); regret rate: sellers who say they would not repeat the advice |
| Proposed ship gate | Hard metrics met; once real sales exist, mid value within an agreed error band (for example 15%) on at least 70% of cases. **Do not call the estimate accurate before this** |
| Data to collect | Real sold prices, days to sell, fixes done, condition |

## 3. Prompt contract summary
| | |
|---|---|
| **Input** | Condition and reason as free text or form fields |
| **Output** | Seller info with null for anything not said; code builds the plan |
| **Guardrails** | Never guess a battery percentage; every figure computed in code; sample assumptions labelled; "not a promise" shown |
| **Trade-offs** | Sample factors are crude, so ranges are wide and may be wrong; more questions would tighten the range but add friction |

## 4. Autonomy and cost of being wrong
**Suggest.** Medium: a wrong estimate may cause underpricing or a wasted repair. Hence ranges, "worth it" arithmetic shown, and labels.

## 5. Failure modes and fallbacks
| Failure | Behaviour |
|---|---|
| Laptop not in catalog | Generic tips, no figures |
| Very low confidence in inputs | Widen the range, list what to add |
| Repair quote far from the sample cost | User can edit the cost (V1) |

## 5b. Questions for you (answered on your behalf in ../05_ANSWERS.md)
1. Where will real used prices and sale outcomes come from?
2. Is selling inside the course scope, or kept as a demonstrated extension?
3. Do you want listing text generation (P6) in the first version?
