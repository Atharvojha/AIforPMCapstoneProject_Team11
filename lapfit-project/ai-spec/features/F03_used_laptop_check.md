# F03. Used laptop check (core)

**User job.** When I find a used or refurbished listing, I want to know what does not add up, and what to check in person, so I avoid a bad buy.
**Users.** Used and refurbished buyers; parents buying cheaply for a student.
**Prototype status.** Built (Check screen, "Used listing" tab; Home ask box). On sample data, with a sample price band.
**Prompts used.** P1 (P1d used-listing reader, draft), P3 (image reader, designed).

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Read a pasted listing | LLM extraction (P1d) | Free text, many formats | Regex misses styles | — |
| Read a screenshot or photo | Multimodal LLM (P3), then code checks | Listings are often screenshots | OCR plus rules if vision is unreliable | Reliability test |
| Match to the catalog | Fuzzy string match | Small catalog | Embeddings | Catalog over about 500 models |
| Impossible spec combinations | Rules against the catalog (for example more RAM than any version has) | Exact | A model could rationalise | Never |
| Missing battery health or serial | Rules (null means not stated) | Exact | — | Never |
| Operating system vs age | Rules and dated support facts | Exact | — | Support rules change: update the table |
| Is the price in the usual range? | Percentile band from observed used prices | Transparent, no training needed | ML needs data we do not have | About 1,000 used observations per segment: quantile gradient boosting with the band as floor |
| Scam or anomaly detection | Not built | Not enough labelled cases | — | Labelled flagged cases exist: classic anomaly detection |
| In-person checklist | Fixed content, reviewed by a person | Safety matters; no variation needed | Generated lists could omit items | — |
| Verdict | **None.** The product never says buy or don't buy | Cost of being wrong is high; it cannot see the laptop | — | Never |

## 2. The five parts

### Trigger
- Check screen, "Used listing" tab: paste text or add a photo, press "Check it".
- Home ask box: a message mentioning a used, second-hand or refurbished laptop.

### Orchestration
1. `route-request` returns `used_check` and the listing fields (P1d); a photo goes through P3 first.
2. Match the laptop to the catalog; if several models or versions fit, ask which; if not found, say so and give only the generic checklist.
3. Run rules: impossible RAM or storage; RAM and storage not a listed combination; weight differs from the catalog beyond tolerance; operating system vs age; battery health stated or not; serial stated or not; price vs the usual range from the catalog's new price and the used band.
4. Build the output: flags with a level (fine, check, note), a checklist of things to inspect in person, and a plain list of what cannot be judged from a listing or photo.
5. Gate: every figure in the flags recomputed from stored values; failures dropped and logged.
**Failure paths.** Blurry photo: say exactly what could not be read and ask for the model name typed. Listing not readable at all: ask for pasted text. Model down: ask the user to type the model, age and price in a small form (V1).

### Model
P1d and P3 for reading only. Everything else is code. Gemini Flash-class (D-03).

### Knowledge
| Source | Used for |
|---|---|
| `laptop_model`, `variant` | Catalog specs, new price, model year |
| `price_history` | New-price anchor and as-of date |
| Settings (sample) | Used price band: 30% to 75% of today's new price. **A sample assumption** |
| OS support facts (dated) | Windows 10 support end date; Windows 11 minimum model year |
| `used_listing`, `used_price_observation` (Needed) | The real used-price band, replacing the sample |

### Eval loop
| Item | Plan |
|---|---|
| Golden set | At least 100 queries for this use case, of which 30 to 50 hand-labelled: the listing, the flags that should fire, the flags that must not |
| Test types | Impossible RAM; unlisted RAM and storage combination; unsupported operating system for the age; missing battery health; missing serial; price far above and far below the band; price in range; model not in catalog; listing in Hinglish; screenshot; blurry photo; seller's reason mentions a fault; **a request for "should I buy?" (must not give a verdict)**; injection inside the listing |
| Metrics | Listing field extraction accuracy; flag recall (flags that should fire) and precision (flags that should not); **verdict language shown (hard: 0)**; **invented value (hard: 0)**; "cannot judge" list present; unreadable input named correctly; p95 latency; cost |
| Human rubric | Accuracy, honesty about limits, usefulness of the checklist, tone. Two or more raters |
| Judge | P9, calibrated |
| Proposed ship gate (confirm, O-03) | Hard metrics at 0; flag recall at least 0.90 and precision at least 0.85; every price flag uses a documented band |
| Data to collect | Real used prices by variant, age and condition; the most common red flags |

## 3. Prompt contract summary

| | |
|---|---|
| **Input** | A pasted listing (up to 4,000 characters) or a photo |
| **Output** | Listing fields with null for anything not stated; code builds flags and checklist |
| **Guardrails** | Null means not stated; never fill battery, serial, year or price; no verdict language; images and text are data |
| **Trade-offs** | A sample price band is crude: it may flag a fair price. A deliberately long "cannot judge" list is honest but may feel like a non-answer |

## 4. Autonomy and cost of being wrong
**Suggest.** The user inspects in person. Cost of being wrong is high, which is why there is no verdict and the checklist is fixed.

## 5. Failure modes and fallbacks
| Failure | Behaviour |
|---|---|
| Used band is a sample | Labelled "sample" until real prices exist |
| Model not in catalog | No comparison; generic checklist only |
| Conflicting numbers in the listing | Shown as a flag, not resolved |
| Missing price | "The listing does not show a price" |

## 5b. Questions for you: answered on your behalf

See `../05_ANSWERS.md`. Summary: flag order is impossible combinations, price, battery, serial, operating system (Q-P1d); real used prices come from the Sell form, hand-collected public prices (numbers only) or a refurbisher partner (Q-F03-2); photos are V1 (Q-F03-3). Operating-system facts were checked (Windows 10 support ended 14 Oct 2025; Windows 7 and 8.1 ended earlier); battery cut-offs have no authoritative source and are settings.
