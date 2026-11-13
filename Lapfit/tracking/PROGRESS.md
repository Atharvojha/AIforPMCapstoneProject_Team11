# Progress log (Lapfit workstream)

## 2026-11-13 — session 1
- Read the five Lapfit docs in full (~28.5k words) and the prototype state (`FINAL_STATE_2026-11-11.md`, `DATA_AUDIT.md`, decisions D-035–D-049).
- Found the gap: Lapfit docs plan from scratch; a tested prototype exists (14+15 laptops, ~4k reviews, Ollama). Data files missing on disk (CH-L01).
- Wrote `01_core_scenarios_and_happy_path.md`: scenario scoring, recommended merged "Fit-check" happy path, moat ladder, lens feasibility, eval headline set E1–E5 with oracle labelling, free stack.
- Started background research agent → `research/real_query_patterns.md` (public forum phrasing).
- Set up `tracking/` (TODO, DECISIONS, OPEN_QUESTIONS, CHALLENGES, PROGRESS).
- **Waiting on:** Q-01, Q-02, Q-03.
- Skills used: lenny-skills/ai-evals, pmprompt/seven-powers (moat), deanpeters/jobs-to-be-done (via existing discovery pack).

## 2026-11-13 — session 1, part 2
- Sri answered: own five use cases replace the core scenarios; pick UC1+UC2 as one flow with UC3 as door; choose the best AI approach per workflow; no false no-match, realistic and current.
- Research agent done: 90 real patterns (`research/real_query_patterns.md`). Key: 2026 price inflation, claims #1 theme, service decisive, refurb mainstream, no real code-mixing found.
- Wrote `02_happy_path_v2_second_opinion.md`: one spine / two doors, worked Hinglish pitch walkthrough, approach per step, tiered truth, E6 no-false-no-match.
- Started agent: free data sources and tools → `research/free_data_sources_and_tools.md`.
- Data/tools agent done → `research/free_data_sources_and_tools.md`; named tools merged into v2 §3. Risks: no free legal bulk India price/review feed; hidden terms (Brave, Gemini free); hand-built catalogue goes stale.

## 2026-11-13 — session 1, part 3
- Sri pasted five use cases (UC1–UC5) to evaluate and test; started `evals/TEST_SPEC.md` (schema, codes, assertions A1–A22, taxonomy, quotas). **Test writing paused** when Sri sent the happy-flow brief.
- Five Phase docs confirmed unchanged since the full read (timestamps 02:10–02:12).
- Happy-flow brief, Task 1 done: `03_happy_flows_by_persona.md` §1–2 (12 proto-personas grounded in R-patterns; persona × UC matrix; 32 example queries). Waiting on Sri before Task 2.
- Task 1 approved by Sri. Task 2 drafted (`03_…` §3): shared 5-layer skeleton, mode pill + routing rules, consistency rules, one flow + unique output screen per UC (Verdict card, Claim table, Shortlist board, Used-deal report, Per-person plan), shared/unique matrix.
- Sri rejected user-picked modes. Removed the mode pill and "buying for" chip; §3.0 now uses back-end signal detection that composes answer sections (several per mixed query), fact-only questions; self-critique in §3.7 (D-L08).
- Task 3 drafted (`03_…` §4): conversation-shaped screen, input→output mapping (12 inputs incl. trap "I used my old Dell"), screen states. Clickable mock `mock/lapfit_mock.html` published: https://claude.ai/artifact/7y78UDqYTjFffKAmwpqHdB (sample data only; parser checked on 10 examples).
- Sri: mock can't be tried for real answers (no DB/API), which is correct; it's a UI mock. Sri: a person approves every verdict, fast, no card-after-card. Added §3.8 (pre-approved ledger + queue) and D-L09; mock now shows one consolidated answer per turn with review status per verdict; banner says not connected.
- Sri: 24 h review turnaround OK. Task 4 drafted: `evals/edge_cases.json` (78 cases: UC1 23, UC2 18, UC3 13, UC4 10, UC5 7, cross 7; all of Sri's listed edge cases plus added ones) → generator `mock/build_edge_cases.py` writes `03_…` §5 and `mock/edge_cases.html` (side-by-side page, published https://claude.ai/artifact/8mm8YuWq8m818fNH4iT7u1).
- Sri asked for a designer's end-to-end journey + a local simulation. Wrote `04_experience_design.md` (goal → fear → next step table, trust defaults, visual language, 8-stage journey, interaction rules, honest scope). Rebuilt Flipkart data (Zenodo 17612521, same 3,300/14 as the team) into `sim/data/` (gitignored, course use only). Built `sim/` (index.html, logic.js, app.js, build_sim_data.py, serve.sh): real quotes (exact substrings, asserted), laptop renders to scale, weight-as-bottles, battery day strip from owner-stated hours, people-dot grids with "owners like you" lens, claim stamps, visual compare, goal-based next-step offers with drafts, buy search links. Headless Chrome smoke test `sim/_test.html` runs all 10 examples: 0 errors. Local: http://localhost:8765 (run `sim/serve.sh`).
- Sri shared `Laptop_Recommendation_Evals_150.xlsx` (150 cases, 6 scenarios, 768 assertions, fictional fixtures). Read the course deck "Designing Evals for AI Features" (19 slides). Wrote `evals/review_150/VALIDATION_CRITERIA.md` (situations T1–T7, criteria V1–V10, formats F1–F10), `auto_checks.py` (all 150 rows), `review_S1.json` (KEEP 20 / POLISH 5 / FIX 0), `REVIEW_REPORT.md` (10 dataset-level findings). S2–S6 not reviewed: sub-agents fail with API 403 login error (CH-L08). No workbook changes until Sri approves.
- Sri ran /login; six parallel reviewer-writers reviewed all 150 v1 rows (KEEP 87 / POLISH 58 / FIX 5) and rewrote all 150 to REWRITE_SPEC.md; all pass check_rewrite.py (0 errors). Merged in place into `Laptop_Recommendation_Evals_150.xlsx` (backup `_v1_original.xlsx`): new columns T–Z, sheets Review_v1 and Coverage_v2, v1 assertions archived. Next: v2 assertions, human review, native check.
- Pulled origin/main (4 commits, fast-forward): teammate added lapfit-project/ (prototype, data model, JTBD, ai-spec with F01–F10 feature specs, system prompts, decisions), plus prototype databases and processed datasets, which resolves CH-L01. Lapfit/ is still untracked.
- Read lapfit-project/ in full (core docs directly; long specs, answers, prompts, todo, data model, JTBD, prototype via 4 digests in research/lapfit_project_digest/). Wrote 05_product_understanding.md: product, 10 features, AI per step, data, eval plan, mapping to our work, 6 conflicts to resolve. Waiting for Sri's next prompts.
- Sri: repo specs are the standard (D-L12). Next: extend the eval workbook to about 200 rows, adding the new AI features. Listed the AI features for Sri to choose the allocation.
- Eval workbook v3 merged: 170 rows across 11 AI scenarios (SL 18, SO 16, PC 18, UC 16, BO 14, OV 15, RT 15, MD 15, SP 15, BI 12, RG 16), each with assertion hooks, all validated together (0 errors, unique names). Validator n-rule fixed to group sums. v2 kept (archive sheet plus _v2.xlsx). Spec-vs-code gaps written to evals/review_150/REPO_GAPS.md. Next: turn the hooks into assertions; human review; native check.
- Converted all 25 te-en/ta-en rows to hi-en (23) or en (2) per Sri; workbook re-merged: 170 rows, en 113 / hi-en 57, 0 errors.
- Sri: outputs read like logs, with no images or links. Wrote SPEC_V3_EXPERIENCE.md; validator now checks images and buy links on cards, URL grounding, the footer, meta phrases and exact quotes (93 errors on current rows). All six groups are rewriting all 170 ideals.
- v3.1 experience rewrite merged: 170 rows, all validated together (0 errors); SP recompute matches. Opened the workbook for Sri.
