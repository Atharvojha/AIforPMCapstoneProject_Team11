# PROGRESS — plan, status, context (living)

Follows `LapFit-Claude-Master-Prompt.md` Part 14 gates. Update at the end of every session.

## Plan & status
| Stage | Scope | Status | Gate |
|---|---|---|---|
| 0 | Repo & input audit, docs skeleton, earlier-work audit | **Done — Gate 0 passed 2026-11-10** | G0 ✓ |
| 1 | Product ideation: search results, ratings policy, Claim Checker, grain features, prioritisation | **Done — Gate 1 approved 2026-11-10** (MVP_SCOPE.md) | G1: approve MVP scope + rating policy |
| 2 | UX: personas, journeys, screens, wireframes, design system | **Done — Gate 2 approved 2026-11-10** (FEATURE_FLOWS.md, SCREEN_INVENTORY.md, DESIGN_SYSTEM.md, wireframes artifact) | G2: approve flows, key screens, design direction |
| 3 | Data & architecture: schema, model benchmark, retrieval, API, eval | **Done — Gate 3 approved 2026-11-10 (D-021)**: ARCHITECTURE, DATA_DICTIONARY, API_CONTRACTS, RAG_EVALUATION, SOURCE_POLICY; LLM + embedding smoke benchmarks done for installed models (others blocked by network, CH-018) | G3: approve architecture & data strategy |
| 4 | Vertical slice | **Built, awaiting Gate 4 review**: ingest → hybrid retrieval → extraction with validators → deterministic fit engine → API (12 endpoints) → React UI (Home/search, Profile, Laptop report + evidence drawer). 44 backend tests pass. Owner-review analysis is a pilot on 1 of 14 laptops | G4: review working slice |
| 5 | Expand core product | Not started | — |
| 6 | Hardening, evals, demo | Not started | — |

## Context a new session must know
- Working folder = `prototype_prathyusha/` (no new git repo, D-004). Docs in `docs/`.
- No product code yet — by design. Only data scripts in `lapfit_data_pack/`.
- Machine: Apple M5, 16 GB, 759 GB free, Ollama + llama3.1 8B, Node 20, Python 3.9 default (3.14 via brew), no Postgres/Docker.
- Verified data: Flipkart laptop subset 3,300 reviews/14 listings; Amazon'23 sample 2,132 reviews/44 laptops; PCBox 87 laptops. See DATA_AUDIT.md.
- Earlier work inspected: see `docs/EARLIER_WORK_AUDIT.md` (reuse eval harness, schema, baseline, 40-item fit fixture; gaps = claim/retrieval/variant/extraction golden sets).
- Constraints: no model training; free/open models; no fabricated data; PRD FR8 (no score) is under review (CH-001).

## Skills/tools plan (Part 12)
Available and relevant: `product-management:brainstorm`, `product-management:write-spec`, `design:user-research`, `design:design-system`, `design:accessibility-review`, `design:ux-copy`, `engineering:system-design`, `engineering:architecture`, `engineering:testing-strategy`, `engineering:code-review`, `data:explore-data`, `data:validate-data`, `data:statistical-analysis`, `artifact-design`/`artifact-diagramming` (flows/wireframes as artifacts), `claude-in-chrome` (E2E checks), `security-review`.
**Missing:** shadcn/ui skill, FastAPI/Postgres/RAG-specific skills. Proposal: use shadcn CLI docs directly at Stage 4; no third-party skill install without approval.

## Session log
- 2026-11-10 (S1): Downloaded + verified datasets; built laptop extracts; audited prompt, plan, PDF; created docs skeleton.
- 2026-11-10 (S1b): Gate 0 answers received; audited earlier work; logged D-004..D-008, CH-013/014.
- 2026-11-10 (S1c): D-009..D-014 recorded; Stage 1 package written; Gate 1 requested.
- 2026-11-10 (S2): Gate 1 approved. Curation research run (4 laptops specs, 12 benchmark records, 7 gaps; CH-015/016). Stage 2 docs + 6-screen wireframe artifact written.

- 2026-11-11 (S6): Compare (D-030) and Live research v1 (D-029) built and browser-tested; real ASUS page end-to-end; Apple 429 (CH-024); extractor accuracy bugs found and fixed on real text (CH-025); 103 backend tests.

- 2026-11-11 (S6b): Tavily key verified (not displayed); real searches; extractor/identity hardening (D-031); terms researched for Notebookcheck/RTINGS/LaptopMedia; self-audit of IdeaPad findings; 107 backend tests.

## Artifacts
- Wireframes (private): https://claude.ai/artifact/D9Fs6fSKkYkXiVf8mA3Fdy — source `docs/wireframes/lapfit_wireframes.html`
- 2026-11-10 (S3a): Gate 2 approved; Tavily approved (D-019); Stage 3 docs drafted; venv built; LLM smoke benchmark started; model pulls blocked by network (CH-018).
- 2026-11-10 (S3b): Stage 3 docs complete (ARCHITECTURE, DATA_DICTIONARY, API_CONTRACTS, RAG_EVALUATION, SOURCE_POLICY). LLM smoke benchmark (llama3.1 8B) and embedding smoke test (MiniLM) run; CH-019/020 opened; G-CLAIM draft (14 items) created. Awaiting Gate 3.
- 2026-11-10 (S4): Vertical slice built and browser-tested; found and fixed 4 issues (search generic-token bug, premature numeric score, lukewarm-strength and category mislabels); pilot extraction running for FKL-11.
- 2026-11-10 (S5): Plain-language UI rewrite (D-026, COPY_GUIDE); Claim Checker v1 built + API + UI + eval (D-027, 14/14 vs draft gold, CH-023); ingest protection (D-028); extraction queue restarted for FKL-11/09/10 after two rebuild mishaps (CH-022).
- 2026-11-11 (S7): Notebookcheck spec pages enabled (D-033); 7 eval sets drafted and run (eval/README.md); fixes from them: accessory queries, injection stance, claim engine gaps, extraction guards (274 labels corrected), NAT64/DNS64 bug, reading budget; embed config fixed; 126 backend tests.
- 2026-11-11 (S8): fresh held-out claim (19/41) and extraction (F1 0.675) sets run once; engine extended (owner opinions, phrasings, operators); Trust page; DEMO_SCRIPT, README, ARCHITECTURE as-built, backlog status. Stage 6 largely done; remaining: human verification, third held-out set, finish MacBook reading.\n
- 2026-11-11 (S9, **pivot**): user found the prototype not useful. Defined five core scenarios; rebuilt Home (free-text needs → understood needs → recommended numbers → ranked laptops with 10 category ratings), Claim Checker (no laptop picker; brand/line/generic/numeric/laptop modes), nav reduced to three, About page merged. Added `advisor.py`, `topic_reader.py` (fast reader, background run over all 14 laptops), 23 new tests, needs-parser and fast-reader held-out evals. Docs updated (PIVOT_2026-11-11.md and per-doc blocks). **In progress:** the reader is working through about 2,150 reviews.

- 2026-11-11 (S10): widened catalogue (+15 Amazon US laptops, evidence-only); reader v2 (recall 0.46 -> 0.95 on a fresh set); brand scores are model averages; data-loss incident CH-035 recovered and prevented (D-047). **Reader v2 is running over about 2,800 reviews (about 2 hours); ratings and brand verdicts fill in as it goes.**

- 2026-11-11 (S11): **complete data** (2,819 reviews read with reader v3), catalogue 14 + 15 US evidence laptops. End-to-end check 32/32. Critic pass as a nerd student: 21 issues fixed (claim direction, group claims, absolutes, evidence on demand, specs on cards, match explanation, warnings, honest "can't check" list). Tests 209. Open: phone layout unverified, sources for recommended numbers, human-checked answer keys.

- 2026-11-11 (S12, final state of this build): critic follow-ups done. Example quotes ranked so ones that contradict their label come last; phone layout checked at 390 px (no sideways scroll on Find, Claim, About); suggested numbers link vendor pages where a page states a number (Docker, Android Studio, Adobe, Steam, Windows 11, PyTorch), the rest say "Rule of thumb, no source". Tests 209 pass, end-to-end 32/32. Left open on purpose: battery size for 9 of 14 laptops, no review data on Linux/OLED/Thunderbolt/webcam/audio, answer keys written by Claude (Q-029). **Biggest remaining product risk: it only knows 14 + 15 laptops (Q-032).**

- 2026-11-11 (S13): **Listing Lie Detector built (D-053)** and **My needs page brought back as a needs sheet (D-054)**. New nav: My needs · Find laptops · Check a listing · Check a claim · Compare. Tests 224 pass, end-to-end 39/39 (7 new checks). Phone width (390 px) checked on needs, listing, find: no sideways scroll. **Not evaluated:** the Lie Detector has no answer-key test yet (Q-033); its verdict rules are covered by unit tests only.

- 2026-11-11 (S14): **Lie Detector evaluated** on 3 answer keys (24 + 13 + 12 listings, 123 expected claims), written by Claude from real published specs and stress cases, unchecked by a person. First runs: 68% (46/68), 91% (29/32), 100% (23/23) of verdicts right; right laptop matched 17/24 on first run, all after fixes. 9 problems found and fixed (see `docs/LISTING_EVALUATION.md`). Tests 228 pass, end-to-end 39/39. Q-033 is half answered: a PERSON still has to write a key from real copied listings.


- 2026-11-11 (S15, final state): all docs updated with the final state. New: `FINAL_STATE_2026-11-11.md` (single current-state page), `DOUBTS_AND_ANSWERS.md` (every doubt the team raised and the answer given, corrected by later work: closed catalogue vs chatbots, USP, "is it only a database", what AI is used, needs numbers), README rewritten, update blocks in PRODUCT_BRIEF, MVP_SCOPE, FEATURE_FLOWS, FEATURE_BACKLOG, SCREEN_INVENTORY, PIVOT, DESIGN_SYSTEM, COPY_GUIDE, DATA_DICTIONARY, DATA_AUDIT, RAG_EVALUATION, SETUP, DEMO_SCRIPT, BEGINNERS_GUIDE, ARCHITECTURE, CRITIC_REVIEW, OPEN_QUESTIONS (index), PRODUCT_DECISIONS (D-044 update, D-057). Tests 228, end-to-end 39/39.
