# F08. My laptops (extension)

**User job.** As an owner, I want one place that tells me my warranty status, what my laptop is worth and what others report about it, so I can look after it and decide when to act.
**Users.** Current owners.
**Prototype status.** Built (Mine screen). Saved on the device only. Sample data.
**Prompts used.** None. This feature uses no model.
**Full feature specification:** `../specs/F08_my_laptops.md`.

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Warranty end and days left | Date calculation from purchase date and the catalog warranty | Exact | — | — |
| Price now vs paid | Arithmetic on the dated catalog price | Exact | — | — |
| Rough resale range | The same rules as F09 (sample band) | Consistent with Sell | — | F09 uses a trained model: reuse it |
| Rising complaints for my model | The F07 rule filtered to my model | Exact | — | — |
| "Share your experience" prompt | Rule: owned at least 1 month | Simple | — | Timing based on milestones (1, 6, 12 months) |
| Reminders (warranty ending) | Scheduled job (n8n) | Time-based | — | — |

**Decision:** no AI. All outputs are calculations.

## 2. The five parts

### Trigger
Opening Mine; adding a laptop (variant, purchase date, optional price paid); a scheduled reminder (designed, needs accounts).

### Orchestration
1. Read saved items from the device (accounts are needed for sync).
2. Send the list to the server to compute summaries (nothing stored on the server).
3. Show warranty countdown, price now vs paid with the as-of date, rough resale range (labelled as a sample band), rating with n, and rising complaints.
4. Buttons: what owners say, share my experience, sell this laptop, remove.
**Failure paths.** Storage blocked: the page works without saving, and says so. Variant removed from the catalog: show the saved data and "no longer in the catalog".

### Model
None.

### Knowledge
Catalog, price history, evidence, settings. User data stays on the device.

### Eval loop
| Item | Plan |
|---|---|
| Test set | Fixtures with known dates and prices |
| Test types | Warranty ends today, yesterday, in a leap year; purchase date in the future (rejected); price paid blank; price gap positive, negative, zero; variant missing |
| Metrics | **Dates and gaps exactly right (hard)**; privacy (no server storage of the list); accessibility |
| Proposed ship gate | All fixtures pass; privacy check passes |

## 3. Contract summary
| | |
|---|---|
| **Input** | Variant, purchase date, optional price paid |
| **Output** | Computed summary per laptop |
| **Guardrails** | Future dates rejected; the resale range is labelled sample; nothing stored server-side |
| **Trade-offs** | On-device storage is private but is lost when data is cleared; accounts fix this but need consent and security |

## 4. Autonomy and cost of being wrong
**Suggest.** Low. A wrong warranty date could cost the user a claim, so dates are shown with the rule.

## 5. Failure modes
| Failure | Behaviour |
|---|---|
| Warranty text unclear in the catalog | Uses the structured years field; shows the text too |
| User bought a different variant | They choose the exact one; if absent, a prompt to tell us |

## 5b. Questions for you (answered on your behalf in ../05_ANSWERS.md)
1. Do you want accounts and reminders in the course scope, or only the on-device version?
