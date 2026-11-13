# LapFit AI spec: index

Living documents for the LapFit AI product. Written for the cheap stack (Lovable, Supabase, n8n, Gemini free tier). The team repo is treated as unusable (decision D-04), so everything here starts clean.

| File | What it is |
|---|---|
| `01_TODO.md` | Your to-do list, tagged, with what changed this round, plus new items |
| `02_DECISIONS.md` | Decisions with reasons and "revisit when". **Includes the AI model type per scenario (D-06)** |
| `03_SYSTEM_PROMPTS.md` | Every system prompt (P1 to P9): input, output, guardrails, trade-offs, fallback, open questions |
| `04_FEATURE_SPECS.md` | Implementation-level specification, one opportunity at a time. **F02, F01 and F03 (the three core features) are complete** |
| `05_ANSWERS.md` | Every open question, the answer I chose, how I reached it, and the facts I checked (with sources) |
| `features/F01…F10` | One document per feature covering the five parts of an AI product |

## The five parts, in every feature document

| Part | Meaning |
|---|---|
| Trigger | What starts it: a form, the app, a schedule |
| Orchestration | The steps, in order, including fallbacks |
| Model | Which AI calls, and which model type (rules, classic ML, RAG, LLM) |
| Knowledge | The data and retrieval the answer depends on |
| Eval loop | Golden set, test types, metrics, human rubric, judge, ship gate |

## Features

| ID | Feature | Core or extension | Model type in one line |
|---|---|---|---|
| F01 | Shortlist | Core | Rules and SQL decide; LLM reads and writes |
| F02 | Second opinion + check the pitch | Core | LLM reads; code verifies; verdicts come from approved ledger rows |
| F03 | Used laptop check | Core | LLM reads; rules flag; statistics for price; no verdict |
| F04 | Buy for others or a team | Extension | State machine, parser, optimisation |
| F05 | Owner voice | Extension | SQL retrieval; LLM tags reviews offline; optional RAG summary |
| F06 | Add my experience | Extension | Rules, LLM triage, always a human |
| F07 | Market pulse | Extension | No AI |
| F08 | My laptops | Extension | No AI |
| F09 | Sell plan | Extension | Rules now; classic ML on real sale data later |
| F10 | Brand insights | Extension | SQL; optional LLM note |

## Related folders

| Folder | Contents |
|---|---|
| `../prototype/` | Working reference implementation (Node, SQLite, Claude) on sample data |
| `../data-model/` | Tables, images and privacy |
| `../jtbd-analysis/` | Jobs and opportunity analysis |

## Where you are needed

I answered the open questions for you in `05_ANSWERS.md`. What only you can supply:
1. The submission due date (O-01) and the slides' V × F × D × R anchors and cost-of-being-wrong worksheet (O-04).
2. Named reviewers for claims and reports (O-07).
3. A brand or retailer contact (Q-F10-1), real used-price sources, and review rights (Q-F03-2, Q-F05-2).
4. A native speaker for Telugu-English and Tamil-English wording (Q-P2).
5. Skim `05_ANSWERS.md` and overrule anything you disagree with.
