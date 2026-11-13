# AI PRD: F09 Sell plan

Extension; a demonstrated extension, not core. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F09_sell_plan.md`. Prompts: `../ai-spec/03_SYSTEM_PROMPTS.md` (P1, P1g; P6 listing writer and P3 photos designed).

## 01 Problem and user

| | |
|---|---|
| **Who** | Sellers and upgraders; owners from My laptops |
| **What breaks today** | Sellers do not know what the laptop is worth, which fixes are worth paying for, how to price it, or when to sell |
| **Evidence** | Desk research; **no real-user sessions and no real sale data**. The value factors and repair costs are **sample assumptions**, so the estimate is a demonstration |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Reading a seller's description ("2 years old, scratched, battery 70%, upgrading") into condition fields; writing a listing (V1) |
| What stays rule-based? | The value range, whether a fix is worth it (recompute with the fix and subtract its cost), the memory-upgrade rule, pricing pairs, timing |
| Cost of being wrong | **Medium**: a wrong estimate may cause underpricing or a wasted repair. So the plan shows its factors, a range (wider when details are unknown) and "An estimate, not a promise" |

## 03 AI objective and metrics

**Objective:** *Read a seller's description without guessing, so that code can estimate a value range, test each fix and advise on pricing and disclosure.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Sellers who say the plan told them something they could act on | Not measured | Set in sessions |
| Business | Sale outcomes recorded (feeds calibration) | 0 | At least 30 per segment to start |
| Model | Condition fields read correctly | Not measured | At least 0.90 |
| Quality | **Real sale prices inside the stated range** | **Not measurable yet** | **At least 70%** once outcomes exist [A] |
| Hard | A figure that differs from recomputation; a fix verdict inconsistent with its net; a ₹ figure for a laptop not in the catalog | — | **0** |
| Hard | Describing the estimate as accurate before outcomes confirm it | — | **0** |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| Ask a chat assistant "what is my laptop worth?" | Fast | Low | Unsourced and unverifiable | The thing to beat |
| **Rules with sample factors** | Instant | $0 | Transparent; not real | **Chosen now** |
| Prompted reading of the description | About 2.5 s | About $0.0008 | Good on clear text | **Chosen** |
| Learned value model (quantile regression with monotonic limits) | Fast | Needs about 1,000 outcomes per segment | Likely better | **Later**, rules stay as floor and ceiling |
| Vision grading of condition photos | Slower | Higher | Unreliable without training | **Not built** |
| Model-written listing from facts | About 2 s | About $0.0005 | Risk of flattering | **V1**, with every flaw required and numbers checked |
**Trade-off:** honesty about uncertainty (wide ranges) over a precise-looking number.

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| New prices and specs | Existing catalog (14 India laptops); licence unverified | 14 | Curate |
| Memory-slot detail | Existing `ram_upgradeable` for 4 of 29 | Sparse | Curate for the 14 |
| **Resale factors** | **Sample assumptions** in settings | All condition factors | Replace with learned values |
| **Repair costs** | **Sample estimates** | 7 fixes | Replace with real quotes |
| **Used prices and sale outcomes** | **None yet**; routes: outcome form with consent, hand-collected public prices, a refurbisher | 0 | Verified; 30 per segment to compare, about 1,000 to learn |
| Test set | Hand-worked cases | 50 | Two raters |

## 06 Eval plan

| Item | Plan |
|---|---|
| Golden set | At least 50 hand-worked plans; real sales when available |
| Mix | Every field unknown; every field known; battery below 80; cracked screen; free memory slot with a higher version; no slot; laptop not in catalog; "need money fast"; fault as the reason; Hinglish; injection in the description |
| Rubric | Accuracy of figures, honesty about assumptions, usefulness, tone |
| Assertions | Plan equals recomputation; verdict consistent with net; unknowns listed |
| Thresholds | Hard metrics at 0 now; after outcomes exist, 70% inside the range |
| Calibration | After 30 outcomes per segment, if more than 30% fall outside, propose a factor change |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Laptop not in catalog | Match fails | Generic preparation tips and no figures |
| Many unknown fields | Count | A wide range and a list of what to add |
| Sample factors | Always | "How this is worked out" lists every factor; "sample assumptions" stated |
| Model down | Timeout | The form still works |
| Gate mismatch | Recompute | "I could not show this reliably." with generic tips |
| Seller hides a fault | — | The plan lists what to disclose; it cannot force disclosure |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| Factor and cost tables | Admin updates with sources | As real data arrives |
| Used-price and quote import | Reviewer verifies | Per batch |
| Calibration | Admin reviews the weekly report | About 1 hour per week once outcomes arrive [A] |
No human reviews individual plans.

## 09 Responsible AI

- **Fairness:** the same factors for every brand and seller; reading accuracy by language.
- **Privacy:** no name or contact; free text is not stored with the plan; a typed description appears only in the request log, scrubbed, for 30 days (see `../build-plan/07_LOGGING_GUIDE.md`); V1 stores anonymous condition fields and an outcome tied to a receipt hash, with consent and deletion on request.
- **Transparency:** assumptions and the "not a promise" line on every plan.
- **Safety:** advice to meet in public, test before paying, remove accounts; no pressure language.
- **Abuse:** injection treated as data; the estimate cannot be steered by text.

## 10 Cost and token economics

| Path | Calls | Cost |
|---|---|---|
| Form | none | $0 |
| Free text | R | **$0.000775** |
| Listing text (V1) | L | $0.0005 |
| Photo (V1) | P | $0.00078 |
At a 5% share with half free text: about **$0.01 / $0.10 / $0.97 per month** at 500 / 5,000 / 50,000 requests. Versus today: guesswork and listing-site price lookups.

## 11 Latency budget

Form path p95 **under 0.8 s** (no model). Free text **3.5 s**. Listing writer adds about 2 s. If exceeded: router at 8 s uses the form; writer at 2 s uses a template listing. Not yet measured.

## 12 Launch plan and guardrails

Shared phases apply. **Gates:** the plan must not be described as accurate until real outcomes confirm the 70% target; sample-assumption label stays until then; consent and notice before outcome capture. Monitors: outcomes recorded, share inside range, factor-change proposals. Kill switch: hide the value range and keep only the preparation advice.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Where will real used prices and sale outcomes come from? | Product owner | 4 Dec 2026 |
| Real repair quotes for the seven fixes | Data lead | 4 Dec 2026 |
| Is selling in scope for the course submission or a demonstration only? (decision: demonstration) | Product owner confirms | 20 Nov 2026 |
| Do sellers want listing text generated? | Product owner, sessions | 4 Dec 2026 |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
