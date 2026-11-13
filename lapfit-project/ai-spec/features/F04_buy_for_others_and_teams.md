# F04. Buy for others or a team (extension)

**User job.** When I am buying for a parent, a child or a team, I want a recommendation that fits them, without answering many questions, so I can decide quickly and defend the choice.
**Users.** Adult children buying for parents, parents buying for children, small-business owners, college administrators.
**Prototype status.** Built (Home ask box). Parent and child shortcuts; team table with one recommendation per role and total vs budget. Sample data.
**Prompts used.** P1 (P1e recipient and team reader), P2.
**Full feature specification:** `../specs/F04_buy_for_others_and_teams.md`.

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Who is it for and what for | State machine; LLM only to read the answer | At most two questions is a product rule | A free chat would ask more | — |
| Read a pasted role table | Deterministic parser first; LLM fallback for messy tables | Cheap and repeatable | An LLM on every table is slow and costs more | Parser failure rate is high |
| Persona defaults (parent: bigger screen, light; child: long warranty) | Rules from a persona table | Explainable | Learned preferences need outcome data | Outcome data exists |
| One laptop per role within a total budget | **Optimisation**: greedy now (best fit per role under a per-role cap) | Small problem | ML does not solve a budget split | More than about 20 roles: integer programming |
| Wording | P2 | — | — | — |

## 2. The five parts

### Trigger
Home ask box message such as "laptop for my mom, mostly video calls", or a pasted table (role, number of people, use, budget each), plus an optional total budget.

### Orchestration
1. Router returns `buy_for_others` and `recipient`.
2. Recipient unknown: ask "Who will use it?" (tappable). Use unknown: ask "What will they mainly use it for?". After two questions, proceed with defaults.
3. Parent or child: add persona Shoulds and Nices; run the F01 pipeline.
4. Team: parse the table; per-role cap = the role's budget, else the remaining total divided by remaining people; run the F01 pipeline per role (limit 1); total cost vs total budget; list roles with no fit.
5. Reasons (P2) and gate as in F01.
**Failure paths.** Table unparseable: ask for one line per role with an example. Over budget: say by how much.

### Model
P1e for reading; P2 for wording. Gemini Flash-class.

### Knowledge
Catalog tables, persona table (code), settings. No RAG.

### Eval loop
| Item | Plan |
|---|---|
| Golden set | At least 40 queries (extension target; raise if this becomes core) |
| Test types | Parent, child, team; wrong recipient; no use given; more than two questions needed; messy table; roles with no fit; total over budget; Hinglish |
| Metrics | Questions asked (hard: at most 2); recipient accuracy; table parse accuracy; per-role pick meets every Must; total cost computed correctly (hard: exact); language of reply |
| Judge, rubric | As F01 |
| Proposed ship gate | Hard metrics met; table parse accuracy at least 0.90 on the golden set |

## 3. Prompt contract summary
| | |
|---|---|
| **Input** | Message plus earlier answers; optional pasted table |
| **Output** | Recipient, use cases, budget; table parsed by code |
| **Guardrails** | At most two questions; never invent a role or headcount; all totals computed in code |
| **Trade-offs** | A capped question count may produce a generic pick; persona defaults are assumptions and are shown as chips the user can change |

## 4. Autonomy and cost of being wrong
**Suggest.** Medium to high: a team purchase is expensive. A person confirms.

## 5. Failure modes and fallbacks
| Failure | Behaviour |
|---|---|
| Table in an odd format | Model fallback, then ask for one line per role |
| No laptop fits a role's budget | Row says "Nothing fits this budget"; total leaves it out and says so |
| Missing total budget | Show cost only |

## 5b. Questions for you (answered on your behalf in ../05_ANSWERS.md)
1. Are persona defaults (parent: 14 inch or more, 1.5 kg or less; child: 2-year warranty) right?
2. Should team picks use one model per role or allow mixing versions?
