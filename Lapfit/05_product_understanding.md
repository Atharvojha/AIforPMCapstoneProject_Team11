# LapFit: what the product is now (synthesis of `lapfit-project/`)

13 Nov 2026. Sources:
- Read directly: `ai-spec/00_INDEX`, `02_DECISIONS`, `04_FEATURE_SPECS`, and all ten `features/F01–F10`.
- Read via four faithful digests (in `research/lapfit_project_digest/`): the ten long specs, `05_ANSWERS`, `03_SYSTEM_PROMPTS`, `01_TODO`, `DATA_MODEL`, `JTBD_EXPANSION`, and the prototype code.

## 1. The product in one paragraph

**Core job (JTBD):** "When I am about to spend a large part of my budget on a laptop, and everyone advising me has an angle, I want to check independently whether a specific laptop fits my needs and whether what I have been told is true, so I can buy once, at a fair price, and not regret it."

LapFit is a **checker, not a chatbot**:
- **The model only reads and writes.** It reads messy input (text, Hinglish, a photo) into fields, and writes short wording from facts that code passes in.
- **Code decides everything else:** filtering, ranking, every tick and cross, every figure, every spec verdict.
- **Two kinds of verdict.** Claim verdicts come only from **person-approved ledger rows** ("retrieval without generation"). Spec verdicts come from code comparisons.
- **A pre-send gate** recomputes every figure and drops anything that differs.

The pitch against chat assistants: same honesty every time, n shown on every owner number, nothing invented.

## 2. Ten features

| | Feature | Class | AI | The hard rule |
|---|---|---|---|---|
| F01 | Shortlist | Core | LLM reads needs; SQL filters; deterministic rank; LLM writes reasons | No Must violated or silently dropped; honest relax-one-Must when nothing fits |
| F02 | Second opinion + check the pitch (one flow) | Core | LLM reads laptop, Musts, claims; fuzzy catalog match; code checks spec claims; ledger match for other claims | No verdict without a named approver; otherwise "Not checked yet" |
| F03 | Used laptop check | Core | Multimodal read; rule flags R1–R20; statistical price band (sample 30–75% of new) | **Never a buy/don't-buy verdict**; fixed in-person checklist |
| F04 | Buy for others / team | Ext | State machine (≤2 questions); table parser; greedy optimisation per role within the total | Totals exact; never invent a role |
| F05 | Owner voice ("people like you") | Ext, **the moat** | SQL over LLM-tagged reviews (P8, batch, human spot-check); optional RAG summary (P4) | n<20 → "not enough evidence"; counts recomputed |
| F06 | Add my experience | Ext | Rules + LLM triage (P5) + **always a human** | Nothing public before approval; no personal data |
| F07 | Market pulse | Ext | **No AI**: SQL thresholds (5 low ratings, 3% price drop) | Lists equal fixtures |
| F08 | My laptops | Ext | **No AI**: dates and arithmetic, on-device | Dates exact; nothing stored on the server |
| F09 | Sell plan | Ext | Rules with sample factors now; quantile GBM at about 1,000 sales per segment | Not called accurate until ≥70% of real sales fall in range |
| F10 | Brand insights (B2B revenue) | Ext | SQL; optional LLM note (P7) | Small-group protection; demand data is currently sample |

**Course scope (D-01):** F01, F02 and F03. Everything else is an extension with lighter evals (D-02).

**Opportunity scores (hypotheses, no user research):**
- Pitch check 35/40
- Owner voice 34
- Shortlist 33 ("table stakes")
- Brand intel 32
- In-shop negotiation 31
- "Is this normal?" 30

## 3. Architecture and AI choices

- **Target stack (D-03):** Lovable + Supabase (Edge Functions, Postgres) + n8n + Gemini Flash-class.
  - Free tier for sample data only; paid tier before real user text (D-14).
  - **Prototype:** Node, SQLite and the **Claude API (`claude-haiku-5-5`)**, plus an offline regex router. It is a reference to port function by function.
- **One router call (D-07):** one LLM call returns flow, confidence, language, needs, mentions, claims and flags. Below 0.6 confidence, it asks one question with tappable choices. Model failure or a timeout over 8 s brings up the rules-only form.
- **AI per sub-task (D-06):**
  - SQL and rules for lookups.
  - LLM structured extraction at temperature 0.
  - LLM constrained writing at temperature 0.2, with a template fallback.
  - RAG only for owner-evidence summaries and ledger matching.
  - Classic ML later, at stated data triggers.
  - Optimisation for team budgets.
  - **No agents (D-08).**
  - Embeddings only when plain matching fails (D-09).
- **Prompts:** P1 (router, with readers P1a–P1g), P2 (reasons), P3 (image), P4 (evidence summary), P5 (moderation), P6 (listing text), P7 (brand note), P8 (review tagger), P9 (eval judge, trusted only after it agrees with 2 human raters).
- **One settings table (D-11):** min n 20, timeout 8 s, confidence 0.6, temperatures, trend thresholds, resale factors. Every answer records the settings version.
- **Languages (D-12):** English and Hinglish first. Telugu- and Tamil-English are tested from day one with a softer wording gate until a native speaker checks them.
- **Privacy (DPDP):**
  - a notice before any collection;
  - an 18+ checkbox (admitted not to be verifiable consent);
  - receipt codes for deletion, no accounts;
  - retention 90 days (typed text) and 30 days (uploads);
  - images not stored in V1.

## 4. Data

- **Catalogue:** `laptop_model`, `variant`, `price_history` (dated).
- **Owner evidence:** `evidence_excerpt` (topic, persona, months, n, source), `claim_ledger` (verdict, approver, date).
- **Logs:** `query_log`, `unhandled_requests`, `gate_log`, `view_events`, `demand_signal`.
- **User data:** `owner_submission`, `resale_action`, and about 40 more tables planned.
- **Today:** only fictional seed data (8 models, 13 variants, 35 evidence rows, 3 ledger claims).
- **Hidden assets** named as the moat: owner reports by persona and months, the claim ledger, dated prices, demand signals, and `unhandled_requests`.

## 5. Eval plan in the spec (not yet built)

- **Data:** per core feature, ≥100 queries, of which 30–50 are hand-labelled.
- **Hard metrics = 0:**
  - a Must violated or silently dropped;
  - an invented spec or price;
  - a verdict without an approver;
  - verdict language in a used check;
  - personal data published.
- **Graders:** 4-criterion human rubric on a 1/3/5 scale with 2 raters, plus the P9 judge after calibration. At least 3 failure-analysis cycles.
- **Proposed gates:**
  - F01 needs F1 ≥0.90 and reply language ≥95%.
  - F02 claim split recall ≥0.85 and precision ≥0.90, laptop match ≥0.95.
  - F03 flag recall ≥0.90 and precision ≥0.85.
- **Status:** none of it measured. The prototype has about 70 smoke assertions on the offline path only.

## 6. How this maps to our `Lapfit/` work

**Strong agreement:**
- code decides and the model reads/writes;
- n on every owner number;
- neutral wording;
- no verdict from photos in the used check;
- a pre-send gate;
- per-segment language gates;
- ≥100 queries per scenario, 30–50 labelled;
- rubric and judge checked against humans;
- three or more iteration cycles.

**Our assets that slot straight in:**
- **The 150-row eval workbook (v2).** It already covers F01–F05 and maps cleanly (S1→F01, S2→F02, S3→F01/F02, S4→F02/F05, S5→F03/F04, S6→router and clarify). Its *Expected behaviour* and *Expected format* columns are ready for assertions.
- **The 78 edge cases** (back end vs front end).
- **The free-tools research.**
- **The real Flipkart data simulation.**
- **The experience design:** goal → next step, sources and quotes always shown.

## 7. Conflicts to resolve (your call)

| # | Topic | `lapfit-project/` says | `Lapfit/` (your earlier decisions) says |
|---|---|---|---|
| 1 | **Mode picking** | Hybrid. Screens pick the flow (Find, Check tabs "Seller pitch / Used listing", Owners, Sell, `forceFlow`); only Home's box auto-detects | **The user never picks a mode** (D-L08); one box, sections composed from signals |
| 2 | **Who approves verdicts** | Only claim-ledger verdicts and owner reports need a named person. Spec verdicts, used flags, rankings and sell plans are code-only | **A person approves every verdict** (D-L09), via a pre-approved ledger plus a 24-hour queue |
| 3 | **Model and stack** | Gemini (target), Claude API (prototype) | `prototype_prathyusha` rule: free/open models only (Ollama). Our tools research recommended local models |
| 4 | **Data** | Fictional seed; real data later by CSV with `verified_by`. **D-04: nothing from the team repo is reused** | Real Flipkart data (3,300 reviews, 14 laptops) now pulled into the repo; used in our simulation |
| 5 | **Scope** | 3 core features + 7 extensions | Your 5 scenarios (UC1–UC5) all treated as core |
| 6 | **Eval data** | Golden set to be rebuilt from scratch | A reviewed and rewritten 150-row workbook already exists |

Items 1 and 2 decide the next prompts and evals: the router assertions, and what "verdict without an approver = 0" means. Items 3 and 4 decide what we can demo with real data.
