# AI PRD: F04 Buy for others or a team

Extension. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F04_buy_for_others_and_teams.md`. Prompts: `../ai-spec/03_SYSTEM_PROMPTS.md` (P1, P1e, P2).

## 01 Problem and user

| | |
|---|---|
| **Who** | Adult children buying for a parent, parents buying for a child, small-business owners and college administrators buying for a team |
| **What breaks today** | The buyer is not the user, does not know their needs, and a team has several roles and one budget. Spreadsheets and guesswork |
| **Evidence** | Desk research and the JTBD analysis only; **no real-user sessions yet**. Persona defaults (parent: 14 inch or larger, 1.5 kg or less; child: 2-year warranty) are assumptions |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Reading who the laptop is for and what for, in free text and several languages; reading a messy pasted role table |
| What stays rule-based? | The two-question limit, persona defaults, per-role budget caps, picking laptops, totals and savings. A **deterministic parser reads clean tables first**; the model is the fallback |
| Cost of being wrong | **Medium to high**: a team purchase is large. A person confirms; totals are computed in code and re-checked |

## 03 AI objective and metrics

**Objective:** *Read who the laptop is for, what for, and a pasted role table, with as few questions as possible, so that code can recommend one laptop per person or role and add up the cost exactly.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Journeys completed within two questions | Not measured | At least 90% [A] |
| User | Team buyers who say the table matched their roles | Not measured | Set in sessions |
| Business | Team requests per month | Not measured | Track |
| Model | Recipient accuracy | Not measured | At least 0.95 |
| Model | Team-table parse accuracy (clean parser plus fallback) | Not measured | At least 0.90 |
| Hard | More than two questions asked; a total that is not exactly computed; a result not meeting its row's needs | — | **0** |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| Free chat to gather needs | Slow, many turns | Higher | Drifts, asks too much | Rejected |
| State machine with two questions | Fast | Low | Predictable | **Chosen** |
| Regex or parser for tables | Fastest | $0 | Exact on clean tables | **Chosen first** |
| Model for messy tables | About 2.5 s | About $0.0008 | Good on odd layouts | **Fallback** |
| Optimisation (greedy now, integer programming for more than about 20 roles) | Fast | $0 | Exact for the budget split | **Chosen** |
| Learned preferences | — | Needs outcome data | Unknown | Later |
**Trade-off:** capped questions can give a generic pick; defaults are shown as editable need items so the buyer can correct them.

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Catalog | As F01 | 14 India laptops | As F01 |
| Role keyword table (design to editing, developer to coding, accounts to office, field or sales to travel) | Team-written | Small | Review with a few real teams |
| Persona defaults | Team-written assumptions | Parent, child | Test in interviews |
| Team-table test set | Team-written; later real tables | Pipes, tabs, commas, headers, repeated roles, messy lines | Two raters |

## 06 Eval plan

| Item | Plan |
|---|---|
| Golden set | At least 40 requests (extension target): parent, child, other, team |
| Mix | No use given; more than two questions needed; table with header; repeated roles; unreadable lines; budget zero; total under the explicit budgets; over budget; no fit; Hinglish; injection in a cell |
| Rubric | Accuracy, honesty about assumptions, clarity, fit |
| Assertions | At most two questions; totals equal the sum of price × people |
| Thresholds | Section 03; hard metrics at 0 |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Table unreadable | Parser error | "I could not read line 3. Please use one line per role, for example: Designer \| 3 \| editing \| ₹90,000." |
| Over budget | Totals | The amount over, and (V1) computed savings |
| Role with no fit | Empty pick | "Nothing fits this budget" for that role; the total says how many are left out |
| Needs unclear after two questions | Question counter | Proceeds with stated defaults |
| Model down | Timeout | Single person: the structured form; team: parser only, with a note |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| The buyer or team lead | Confirms the recommendation | Immediate |
| Persona and role tables | Admin edits after interviews | As needed |
| Failed tables | Team adds test rows weekly | About 30 minutes [A] |
No reviewer approves individual answers.

## 09 Responsible AI

- **Fairness:** recipient reading accuracy by language; defaults never assume ability, age or gender beyond the stated recipient.
- **Privacy:** pasted tables are not stored; no personal data is needed.
- **Transparency:** assumptions (defaults, caps) are shown and editable.
- **Safety:** no advice on whether a person "needs" more or less; totals exact.
- **Abuse:** injection in a cell treated as data.

## 10 Cost and token economics

| Path | Calls | Cost |
|---|---|---|
| One turn (question or answer) | R | $0.000775 |
| Single-person journey (2 questions, then result) | 3R + W | about **$0.0027** |
| Team table | R, sometimes a second | about **$0.0009** |
Average per request about $0.0010. At a 5% share of 500 / 5,000 / 50,000: about **$0.03 / $0.25 / $2.50 per month**. Versus today: no equivalent; a human advisor or spreadsheet.

## 11 Latency budget

Each turn p95 **3.5 s** (question) to **5.6 s** (result with reasons); a team table under **4 s** plus parsing under 2 s for 30 roles. If exceeded: router over 8 s falls back as in F01; writer over 2 s uses code reasons. Not yet measured.

## 12 Launch plan and guardrails

Shared phases apply. Gate: golden set at hard metrics zero; at least two real team or parent interviews before phase 1. Monitors: share of journeys that reach a result in two questions, parse failures, over-budget rate. Kill switch: per-feature model switch (falls back to parser-only for teams).

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Are the parent and child defaults right? | Product owner, interviews | 4 Dec 2026 |
| Do teams want the same model across roles? | Product owner, one team interview | 4 Dec 2026 |
| Do businesses need a GST invoice or on-site warranty in the recommendation? (not verified) | Product owner | 4 Dec 2026 |
| Real team-table formats | Team collects 5 examples | 27 Nov 2026 |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
