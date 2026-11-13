# LapFit: decisions

Living record. Each decision says what was decided, why, who decided, and **what would make us revisit it**.

**Who decided:** `You` = the product owner (answered in chat). `Assistant` = decided by me on your instruction ("I don't know the answers, you decide"); how each was reached is in `05_ANSWERS.md`. Change any of them and the documents follow.

| ID | Decision | Status |
|---|---|---|
| D-01 | Core use cases for the course submission | Decided (You) |
| D-02 | Everything else is an extension | Decided (You) |
| D-03 | Stack: the cheap stack | Decided (You) |
| D-04 | Reuse of the team repo: **revised** to reuse the data, not the old code or labels | Revised (You, 13 Nov) |
| D-05 | The model never supplies a fact | Decided (Assistant) |
| D-06 | Which kind of AI per scenario | Decided (Assistant) |
| D-07 | One shared router call | Decided (Assistant) |
| D-08 | No agents | Decided (Assistant) |
| D-09 | Retrieval policy (when RAG, when not) | Decided (Assistant) |
| D-10 | Autonomy level per scenario | Decided (Assistant) |
| D-11 | One settings file for every threshold | Decided (Assistant) |
| D-12 | Language policy | Decided (Assistant) |
| D-13 | Image policy | Decided (Assistant) |
| D-14 | Privacy policy for model calls | Decided (Assistant) |
| D-15 | Documentation structure | Decided (You) |

---

## D-01. Core use cases

**Decided:** the course submission covers three:
1. **Shortlist** (the front door).
2. **Second opinion + check the pitch** (one flow).
3. **Used laptop check.**

**Why:** your answer in chat. Matches to-do 0.1 to 0.3 (claim-check is in the submission, not an extension).
**Revisit if:** the grading weights or due date (to-do 0.4, 0.5) change what must be shown.

## D-02. Extensions

**Decided:** buy for others or a team, owner voice, add my experience, market pulse, my laptops, sell plan and brand insights are built in the prototype but are extensions. They get the same five-part document, but lighter evaluation targets.
**Revisit if:** the extensions start to take time from the core three.

## D-03. Stack

**Decided:** the cheap stack from your brief.

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Lovable (React) | Screens in `04_FEATURE_SPECS.md` |
| Backend | Supabase Edge Functions | Every model call runs here; no key in the browser |
| Database | Supabase Postgres | Schema in `../data-model/DATA_MODEL.md` and `../prototype/supabase/schema.sql` |
| Offline jobs | n8n | Price ingestion, review tagging, trend pre-computation, alerts, weekly eval run |
| Model | Gemini, free tier, a fast "Flash-class" model | Check the current model name and limits before building |

**The prototype in `../prototype/` is a reference implementation of the logic** (Node, SQLite, Claude). It is not the target stack. Port function by function:

| Prototype file | Becomes |
|---|---|
| `server/route-request.js` | Edge Function `route-request` |
| `server/engine.js`, `flows.js` | Edge Function `handle-query` plus SQL views |
| `server/gate.js` | Edge Function `pre-send-gate` |
| `server/reasons.js` | Edge Function `write-reasons` |
| `server/submissions.js` | Edge Functions `submit-report`, `review-report` |
| `server/insights.js` | SQL views and one Edge Function |
| `settings.js` | Table `settings` (versioned) plus a cached read |

**What I checked on 13 Nov 2026** (details and sources in `05_ANSWERS.md`, C1 to C4):
- **Terms:** on the unpaid tier Google may use inputs to improve its products and human reviewers may read them, and it tells you not to submit personal information. The paid tier says it does not use inputs to improve its products. So: **free tier for sample data only; paid tier before any real user text or photo.**
- **Rate limits:** per project, can change, not guaranteed, visible in AI Studio. I found no free-tier number for a fast model, so check yours and treat "limit exceeded" as a normal case (rules-only form).
- **Structured output:** supported, but only valid JSON is guaranteed, not correct values, and some limits (such as maximum length) are ignored. Keep validating in code.
- **Images:** supported (JPEG, PNG, WebP and others, 20 MB request limit); small text can be misread.
- **Not verified:** the current free-tier model name and pricing.

**Revisit if:** limits, terms or latency fail. Fallback: a paid tier, or the Claude API the prototype already uses.

## D-04. Reuse of the team repo (revised)

**Original (You):** reuse nothing; treat the repo as unusable.
**Revised (You, 13 Nov 2026, "find ways to use the existing databases"):** **reuse the data**: the database in `prototype_prathyusha/backend/data/` (29 laptops, about 4,000 reviews, 1,316 extracted opinions with exact quotes, specs with provenance, a sources table with permissions, embeddings) and its data pack. **Do not reuse** the old Python service as the deployed backend, the AI-drafted golden labels as truth, or the older documents as specifications.
**Why:** I inspected the database: it has provenance, permissions and exact quotes that would take weeks to rebuild, and it matches our data model closely. Its limits (no dates, no user types, unverified licences, machine-read labels) are documented in `../build-plan/01_BACKEND_BUILD_PLAN.md`.
**Revisit if:** rights on the review text cannot be confirmed; then only the spec facts and our own reports are used.

## D-05. The model never supplies a fact

**Decided (Assistant).** The model does only two things:
1. Reads text or an image into structured fields.
2. Writes short wording from facts that code passes in.

Code decides: which laptops qualify, ranking, prices, specs, every tick and cross, and every claim verdict. A pre-send gate re-checks each figure before display and drops what fails.

**Why:** the cost of a wrong spec or price is a bad purchase. It is also the product's difference from a chat assistant.
**Trade-off:** less flexible answers; every new fact type needs a data row first.
**Revisit if:** the gate drops more than a few percent of answers in normal use, which would mean the data is too thin.

---

## D-06. Which kind of AI, per scenario

### The rule used

| If the job is… | Use | Not |
|---|---|---|
| A lookup, filter, comparison or calculation over stored facts | **Rules and SQL** | A model |
| Reading free language or an image into fixed fields | **LLM structured extraction** (temperature 0, schema, retry, rules cross-check) | A model that answers directly |
| Producing wording from facts | **LLM constrained writing**, with a code-written fallback and a numeric check | Free generation |
| Quoting or summarising from a text corpus that grows | **RAG** (retrieve, then write from what was retrieved) | Memory in the prompt |
| Predicting a number or label from many past labelled rows | **Classic ML** (gradient boosting, regression, classifier), with rules as floor and fallback | An LLM guessing |
| Choosing under a budget or capacity | **Optimisation** (greedy, knapsack) | ML |
| Matching free text to a canonical list | **Embeddings and nearest neighbour**, only when plain matching stops working | An LLM per request |
| A multi-step plan that changes with each answer | **Agent** | Not used here (D-08) |

### The choice per scenario

"Now" is what to build first. "Later" is what to add once the trigger is met.

| Scenario | AI sub-task | Now | Later (trigger) |
|---|---|---|---|
| **F01 Shortlist** | Read the situation into needs | LLM extraction + money parser cross-check | Fine-tuned small model if cost or latency bites |
| | Filter by Musts | SQL | — |
| | Rank | Deterministic scoring | Classic ML ranker once about 5,000 sessions with a chosen laptop exist. Musts stay hard filters |
| | Colour fallback | Rules (proximity table) | — |
| | Write reasons | LLM constrained writing + template fallback | — |
| | Retrieval | None (facts are in tables) | — |
| **F02 Second opinion + check the pitch** | Spot the laptop in the text | LLM extraction | — |
| | Match it to the catalog | Fuzzy string match (rules) | Embeddings once the catalog passes about 500 models |
| | Musts ticks, alternatives | Rules and SQL | — |
| | Owner evidence | Filtered retrieval by laptop and topic, shown verbatim, with n | LLM summary grounded in retrieved rows (RAG) once excerpts are numerous |
| | Split claims, type them | LLM extraction | Fine-tuned small classifier for claim type at volume |
| | Verify a spec claim | Code parser + comparison | — |
| | Verdict on other claims | **Retrieval without generation**: match the claim to a person-approved ledger row, show its text | Embedding match with a threshold when wording variety grows |
| | Opinions | LLM tag, then "can't be checked" | — |
| **F03 Used check** | Read a listing or screenshot | Multimodal LLM extraction | OCR plus rules if vision is unreliable |
| | Flag impossible combinations, missing battery or serial, OS vs age | Rules | — |
| | Is the price in the usual range? | Percentile band from observed used prices (statistics) | Classic ML (quantile gradient boosting) at about 1,000 used observations per segment |
| | Scam or anomaly patterns | Not built | Classic anomaly detection once flagged cases are labelled |
| **F04 Buy for others / team** | Collect recipient and use | State machine; LLM only to read the answer | — |
| | Read a pasted role table | Deterministic parser, LLM as fallback | — |
| | One laptop per role within a total budget | **Optimisation** (greedy now) | Integer programming above about 20 roles |
| **F05 Owner voice** | Read the question into filters | LLM extraction; the filter bar is the non-AI path | — |
| | Retrieve | SQL aggregate over tagged rows | — |
| | Tag imported reviews with topic, persona, rating | **LLM batch labelling**, human spot-check | Small trained classifier at about 5,000 labelled rows |
| | "People like you" weighting | Rules | — |
| **F06 Add my experience** | Reject contact details, length | Rules | — |
| | Spam, abuse, topic suggestion | LLM triage, then **always a human** | Classic classifier trained on reviewer decisions |
| | Near-duplicate reports | Plain similarity (MinHash) | — |
| **F07 Market pulse** | All counts and trends | SQL and statistics. **No model** | Change-point detection |
| **F08 My laptops** | Warranty, price now, rising complaints | Rules. **No model** | — |
| **F09 Sell plan** | Read condition and reason | LLM extraction | — |
| | Value today and after a fix | Rules with sample factors | **Classic ML** (quantile gradient boosting with monotonic constraints) on real sale outcomes, about 1,000 per segment. Rules stay as floor and ceiling |
| | Judge condition from photos | Not built (user states it) | Trained image classifier once about 2,000 labelled photos exist |
| | Write listing text | LLM constrained writing | — |
| **F10 Brand insights** | Counts, heatmaps, unmet demand | SQL | Frequent-itemset or clustering of Must combinations at about 10,000 searches |
| | Narrative summary | Optional LLM writing from computed numbers | — |
| **Shared** | Router: which flow | LLM classification with schema, confidence 0.6 | Embedding nearest-neighbour or fine-tuned small classifier to cut cost |
| | Language reply | LLM | — |
| | Prompt-injection defence | Rules + schema + "data, not instructions" | A trained detector |
| | Pre-send gate | **Rules, not AI** | — |
| | Judge for evals | LLM, checked against humans | — |

**The numbers above (500, 1,000, 5,000, 10,000)** are rules of thumb. Treat them as starting hypotheses and check against measured error.

**Why it is not RAG everywhere:** retrieval only helps where an answer must be quoted or summarised from a text corpus. Most of LapFit answers are lookups and calculations over structured rows, which RAG would make slower and less accurate. The only true RAG candidates are the owner-evidence summary (F02, F05) and the ledger match (retrieval without generation).

**Revisit if:** measured accuracy, latency or cost for a sub-task misses its target (to-do 5.1, 5.2).

## D-07. One shared router call

**Decided (Assistant).** One LLM call reads the message into a fixed JSON (flow, confidence, language, needs, laptop mentions, claims, flags). Validated by a schema, retried once, then the rules-only form appears. Below 0.6 confidence the flow becomes "clarify".
**Why:** one call keeps cost and latency down and gives one place to defend against injection.
**Trade-off:** one prompt covers many flows, so it grows long and must be tested per flow.
**Revisit if:** router accuracy per flow differs a lot, in which case split it by flow.

## D-08. No agents

**Decided (Assistant).** Every flow is a fixed pipeline. An agent that picks its own steps adds cost, delay and unpredictability and gives nothing back here.
**Revisit if:** a flow genuinely needs a plan that depends on earlier answers.

## D-09. Retrieval policy

**Decided (Assistant).** Use filtered SQL retrieval, no vectors, while the catalog is small and structured. Add embeddings only when (a) free-text claims no longer match ledger rows with plain matching, or (b) the evidence corpus is too large to filter by topic alone. When RAG writes text, it may only restate retrieved rows and must show n.
**Revisit if:** match failures show up in the failure analysis.

## D-10. Autonomy level

**Decided (Assistant).** Levels: *Suggest* (user decides), *Assist* (system acts with the user's confirmation), *Automate* (system acts alone).

| Scenario | Level | Human touchpoint | Cost of being wrong |
|---|---|---|---|
| F01 Shortlist | Suggest | User picks | High: a rupee outlay |
| F02 Second opinion, pitch check | Suggest | User decides; verdicts need a named approver | High: a bad purchase from a wrong verdict |
| F03 Used check | Suggest | User inspects in person | High |
| F04 Buy for others / team | Suggest | User or team lead confirms | Medium to high |
| F05 Owner voice | Suggest | None | Medium: a misleading count |
| F06 Add my experience | Assist | A reviewer approves every report | Medium: published abuse or personal data |
| F07 Market pulse | Suggest | None | Low |
| F08 My laptops | Suggest (Automate for reminders later) | None | Low |
| F09 Sell plan | Suggest | User chooses price | Medium: a wrong estimate |
| F10 Brand insights | Suggest | Analyst reads | Medium: a wrong business decision |

**Revisit if:** the course worksheet for cost of being wrong (to-do 5.3) gives different categories.

## D-11. One settings file

**Decided (Assistant).** Every threshold lives in one place: minimum n of 20, router timeout 8 seconds, confidence 0.6, temperatures (0 reading, 0.2 writing), trend windows, price-drop minimum, sample resale factors. In the cheap stack this is a versioned `settings` table, and each answer records the settings version.

## D-12. Language policy

**Decided (Assistant).** The model replies in the user's language (English, Hinglish, Telugu-English, Tamil-English). Fixed screen text is English at first. Numbers are always Indian rupees; "60k", "1 lakh" and "sixty thousand" are understood by both the model and a code-side parser.
**Languages first:** English and Hinglish; Telugu-English and Tamil-English are tested from day one against the same hard gates, with a softer wording gate until a native speaker checks them (O-05 in `05_ANSWERS.md`).
**Revisit if:** the language assertions in the eval fail (to-do 8.4).

## D-13. Image policy

**Decided (Assistant).** The model may read an image into fields. Code verifies those fields against the catalog. Nothing read from an image is shown as fact unless it matches. In the first version the image is not stored. Storing images needs consent, retention and stripping of location data (`../data-model/DATA_MODEL.md`, section 10).

## D-14. Privacy for model calls

**Decided (Assistant).** No names, phone numbers or emails are sent on purpose. Pasted text may contain them, so scrub before sending where it is cheap, and do not store the raw text of ordinary requests. **Checked:** the free tier does allow the provider to use inputs and have humans read them, so real user text and photos stay off it. Use the paid tier first (O-06).

## D-15. Documentation

**Decided (You).** Four living documents plus one document per feature:

| File | Purpose |
|---|---|
| `01_TODO.md` | To-do list |
| `02_DECISIONS.md` | This file |
| `03_SYSTEM_PROMPTS.md` | Every system prompt, with input, output, guardrails and trade-offs |
| `04_FEATURE_SPECS.md` | Feature specifications, one opportunity at a time |
| `features/F01…F10` | The five parts of an AI product for each feature |

---

## Decisions added with the backend plan (13 Nov 2026, Assistant, on your instruction)

| ID | Decision | Reason | Revisit if |
|---|---|---|---|
| D-16 | **Live request path in Supabase Edge Functions. Offline jobs on Supabase Cron plus Edge Functions (revised 13 Nov). Make.com only for connectors.** Make on the live path only as a prototype shortcut, behind an Edge Function, with a secret header, respond-early design and the same fallback | Must answer within 8 s; flows need tests. Make's webhook response limit is **still undocumented** in what I could read, and Make's Free plan is 1,000 credits a month, about 2 active scenarios and a 15-minute minimum interval; Supabase Cron runs any interval and can call functions | A needed connector only Make has |
| D-17 | **Adopt the existing 14-category topic taxonomy** (performance, battery, display, build_reliability, thermals_noise, keyboard_trackpad, memory, ports_connectivity, gpu, portability, upgradeability, value, delivery_or_seller, other); our seven topics become a grouping | 1,316 opinions are already labelled this way | Users find the groups confusing |
| D-18 | **Imported opinions show polarity counts; new owner reports keep a 1 to 5 rating** | The imported rows have polarity, not a topic-level score; inventing averages would mislead | A topic-level score is labelled by people |
| D-19 | **Text search first; re-embed with a hosted embedding model and use pgvector for meaning-based matching; keep the old vectors for a side-by-side test** | A query must be embedded with the same model as the stored vectors; the old model is a local one | The test shows text search is enough |
| D-20 | **Two data modes: `course` (unverified sources allowed, labelled) and `production` (only confirmed rights)** | Licences are unverified (Flipkart blank, Amazon none) | Rights are confirmed |
| D-21 | **Existing machine-read opinions are labelled "machine-read, not human-verified" until audited** | Your own figure: precision 0.88, recall 0.83 against AI-written keys | An audit passes |
| D-22 | **The old Python backend is not deployed**; kept as a reference and a local batch tool | It depends on a local model and a local machine, so it does not fit Lovable, Make or Supabase | Someone wants to host it |
| D-23 | **Model for reading and writing: `gemini-3.1-flash-lite` as the starting choice**, compared with the next tier on the golden set before it is fixed (to-do 5.1) | Lowest cost of the current Flash-Lite options at the prices checked | Measured accuracy or latency fails |
| D-24 | **Feature specs are functional only; screens are specified after the frontend is built.** The frontend's jobs and triggers are in `../build-plan/03_FRONTEND_JOBS_AND_TRIGGERS.md`; earlier UI notes are drafts | Your instruction | — |

## Decisions added by the research round (13 Nov 2026, Assistant)

| ID | Decision | Reason (see `05_ANSWERS.md`) | Revisit if |
|---|---|---|---|
| D-25 | **Windows 11 rule uses the processor, not the model year**: Intel Core 8th generation or later and the AMD models on Microsoft's list are supported; others say "check with PC Health Check" | C23, Q-R7 | Microsoft changes its lists |
| D-26 | **Source rights statuses:** `declared_cc_by_4` (Flipkart: short excerpts up to 25 words with attribution), `research_only` (Amazon 2023: never public), `facts_only` (manufacturer and lab pages: facts and links) | C17, C18, Q-R1, Q-R2 | Legal review or new permission |
| D-27 | **Embeddings: `gemini-embedding-2` at 768 dimensions**, tested against `gemini-embedding-001` and the old vectors in four language styles | C19, Q-R3 | The test fails |
| D-28 | **Supabase Free to build, Pro for the demo and pilot** (about $25 a month); keep the Free project active because it pauses after a week | C20, Q-R4 | Cost or size changes |
| D-29 | **Colours are optional in version 1**; the colour note works only where data exists | Q-R12 | A buyer test shows colour matters |
| D-30 | **Warranty default 1 year for the 14 laptops**, start date from the purchase date the owner enters, with "keep the invoice" | C25, Q-R9 | A brand differs |
| D-31 | **Battery: note under 80%, check under 70%**; 80% anchored on Apple's design target, 70% a labelled rule of thumb | C24, Q-R8 | A better source appears |

## Open decisions

**Answered in `05_ANSWERS.md`** (O-01 to O-07). Those that nobody can answer by checking, such as the due date, the slides' anchors and the named reviewers, carry a labelled working assumption there.

| ID | Question | Why it matters |
|---|---|---|
| O-01 | Submission due date and format (to-do 0.4) | Sets how much to polish |
| O-02 | Grading weights (to-do 0.5) | Decides how much effort goes to evals |
| O-03 | Go/no-go bar per segment (to-do 5.6) | I proposed numbers in each feature doc; you confirm or change them |
| O-04 | Do you have the course's cost-of-being-wrong worksheet and the V×F×D×R anchors? (to-do 3.3, 5.3) | I have not seen the slides, so I did not guess them |
| O-05 | Which languages must work first? | Sets the size of the language test set |
| O-06 | Free tier or a paid tier for model calls? | Affects privacy (D-14) and limits |
| O-07 | Who approves claims and reports? (named people) | The ledger and review queue need real approvers |
