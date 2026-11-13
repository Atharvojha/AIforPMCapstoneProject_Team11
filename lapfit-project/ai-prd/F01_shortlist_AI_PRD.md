# AI PRD: F01 Shortlist

Core feature, the front door. Shared assumptions (prices, token sizes, latency, human capacity, launch template) are in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F01_shortlist.md`. Prompts: `../ai-spec/03_SYSTEM_PROMPTS.md` (P1, P1a, P2).

## 01 Problem and user

| | |
|---|---|
| **Who** | First-time buyers and students in India, and the parents who pay; also working professionals and performance seekers. Budgets in this prototype's catalog run from about ₹27,000 to ₹87,000 |
| **What breaks today** | Dozens of listings, contradictory videos and shop advice; a buyer cannot tell which laptops meet *all* of their must-haves, and nobody tells them which must-have to relax when nothing fits |
| **Evidence** | **Limited and mostly desk research:** the team's discovery work and the JTBD analysis; the existing review data (69.6% five-star, median 9 words) shows star ratings hide problems; **no real-user sessions have been run yet** (to-do 9.1). Treat the problem as a hypothesis until five or more real students are interviewed |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Understanding "laptop under 60k for coding, 16GB compulsory, light, blue" in English, Hinglish, Telugu-English or Tamil-English, including "60k", "1 lakh", "sixty thousand" and which words mean compulsory |
| What stays rule-based? | Filtering by every Must, ranking, colour fallback, the relax options, all numbers. A Must is a promise; code keeps it |
| Cost of being wrong | **High**: a rupee outlay. So the model never decides what qualifies; a wrong reading is visible and editable before results are trusted |

## 03 AI objective and metrics

**Objective:** *Turn a buyer's free-text situation into correct, editable needs so that code can return a short list that meets every Must.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Share of sessions where the buyer reaches a shortlist without re-typing | Not measured | At least 80% [A] |
| User | Buyers who say the "what I understood" reading was right | Not measured | At least 85% [A] |
| Business | Free-text requests that end in a compare or an outbound link | Not measured | Set after pilot |
| Model | Needs reading accuracy (field-level F1: attribute, operator, value, tier) | Not measured; rules-only reader not built | **At least 0.90** |
| Model | Money parsed correctly ("60k", "1 lakh", words) | Not measured | At least 0.98 |
| Hard | A Must violated or dropped silently; an invented spec or price shown | — | **0** |
| Model | Reasons faithful (every number in the facts) | — | 100% after the check |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| Rules only (forms and regex) | Fastest | Lowest | Exact for what it covers; cannot read free text | **Kept as the fallback and the structured path** |
| Prompting a small model with a schema | About 2.5 s | About $0.0008 per read | Good on clear text, weaker on vague or code-mixed text | **Chosen for reading** |
| RAG | Slower | Higher | Not needed: facts are in tables | Not used |
| Fine-tune | Fast at runtime | Training cost and labelled data | Possibly better on Hinglish | Later, if cost or latency bites |
| Classic ML (learned ranking) | Fast | Needs about 5,000 sessions | Possibly better order | Later; Musts stay hard filters |

**Choice:** prompting plus code. **Trade-off:** a little latency and cost for free-text understanding, in exchange for the exactness of rules where it matters.

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Catalog (14 Indian laptops with price, RAM, storage, display, weight, processor) | Existing database, parsed from listings; **licence unverified, course use only** | 14 laptops. Gaps: hinge, colours, warranty, year, slots | Curate by hand; named verifier |
| Colour proximity, vague-term map, weights | Our own tables | Small | Written by the team |
| Test requests for the golden set | Written by the team; later real sessions | Needs English, Hinglish, Telugu-English, Tamil-English and segments | Two labellers per item; native speaker for Telugu and Tamil |
Coverage per language and segment is **not yet known**; the golden set must be built to cover each.

## 06 Eval plan

| Item | Plan |
|---|---|
| Golden set | At least 100 requests; 30 to 50 hand-labelled with correct needs, correct allowed laptops and the reason. Frozen and hashed before the first scored run |
| Mix | Every attribute (RAM, storage, colour, weight, availability, service); priorities ("under 1 lakh compulsory, style last"); colour fallback ("midnight blue" to blue); convertible vs MacBook; code-mixed; ambiguous; angry; adversarial; no-match; contradictory Musts |
| Rubric | Four criteria on 1, 3, 5 with anchors: accuracy, honesty about limits, clarity, fit to the stated situation |
| Assertions | A Must is never dropped; reply language equals the user's; no number outside the facts |
| Thresholds (proposed) | Hard metrics at 0; needs F1 at least 0.90; money parse at least 0.98; language assertion at least 95% on non-English; p95 within budget |
| Process | Two raters; disagreements logged; judge used only after it agrees with the raters; at least three failure-analysis cycles |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Model down, slow (over 8 s) or rate limited | Timeout and error | A short notice and the structured form; same filter |
| Wrong reading (tier or attribute) | Understood needs shown; buyer edits | The reading is visible and editable before they trust results |
| A want the data cannot check (touchscreen) | Attribute not in the registry | "Cannot check yet", not silently dropped |
| Nothing matches | Zero rows | "Nothing meets every Must. I have not dropped any." plus up to two relax options |
| Gate drops a result item | Recompute mismatch | The item is not shown; if all drop, the no-match answer |
| Prompt injection in the text | Pattern and model flag | A notice that part of the message was treated as text |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| Understood needs | **The buyer** corrects the reading | Immediate |
| Weekly review of low-confidence and unhandled requests | Team member turns real failures into test rows | About 1 hour per week [A] |
| Curating the catalog | Named verifier signs each row | About 15 to 20 minutes per laptop [A] |
No human approves each answer; the checks are in code.

## 09 Responsible AI

Shared commitments in `00_SHARED_ASSUMPTIONS.md` (section F). Specific to F01:
- **Fairness:** report needs accuracy by language and by budget band; parity target within 5 points.
- **Privacy:** requests are not stored except an anonymous demand row (budget band, use, Must labels, matched count).
- **Transparency:** every result shows the price date, the Musts met and not met, the owner count and "not enough evidence" below 20.
- **Safety and abuse:** no ranking by commission; injection treated as data; rate limit.

## 10 Cost and token economics

| Path | Calls | Cost per request |
|---|---|---|
| Free text with reasons | R + W | **$0.00116** |
| Free text, reasons from code | R | $0.00078 |
| Structured input | none | $0 |
Volume: at 40% of 500 / 5,000 / 50,000 total requests, with half free-text, F01 model cost is about **$0.12 / $1.16 / $11.60 per month**. Cost per user (10 requests, 4 on F01, half free-text) about $0.0023. Versus today: no equivalent; the rules-only path costs $0 and cannot read free text.

## 11 Latency budget

Free-text path p95 target **5.6 s** end to end (network 0.5, router 2.5, tools 0.4, reasons 2.0, gate 0.2). Structured path under **1.2 s**. If exceeded: the router at 8 s switches to the form; the writer at 2 s switches to code reasons. Not yet measured.

## 12 Launch plan and guardrails

Phases and kill switches as in `00_SHARED_ASSUMPTIONS.md` (section G). Gate to leave phase 0: golden set run with hard metrics at zero. Feature-specific monitors: needs-reading edit rate (how often buyers change the reading), no-match rate, relax-option acceptance, fallback rate. A rising edit rate means the reader is misreading; investigate before widening the audience.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Is 1.5 kg right for "light"? | Product owner, with five student interviews | 27 Nov 2026 |
| Is three results the right first view? | Product owner, from sessions | 27 Nov 2026 |
| Which of hinge, colour, warranty, year, slots can be verified for all 14 laptops? | Data lead | 20 Nov 2026 |
| Rights to show listing-derived specs and prices publicly | Product owner, with the instructor | 4 Dec 2026 |
| Native-speaker check of Telugu-English and Tamil-English wording | Product owner (find speakers) | 4 Dec 2026 |
| Real measured p95 and cost | Engineering lead | After the first scored run |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
