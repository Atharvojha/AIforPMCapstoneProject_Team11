# CHANGELOG

## 2026-11-10
- Data: Flipkart (3,300 laptop reviews / 14 listings) and PCBox extracted; Amazon'23 laptop sample (2,132 reviews / 44 laptops); Mendeley found to contain no laptops; downloader URL fixed.
- Curation: 4 laptops' specs, 12 benchmark records (10 lab incl. siblings, 2 manufacturer claims), 6 sources, 7-row evidence-gap register (`lapfit_data_pack/datasets/curated/`).
- Docs: CLAUDE.md, CHALLENGES (CH-001..016), DATA_AUDIT, EARLIER_WORK_AUDIT, PRODUCT_DECISIONS (D-001..014), PRODUCT_BRIEF, FEATURE_BACKLOG, MVP_SCOPE, SOURCE_REGISTER, FEATURE_FLOWS, SCREEN_INVENTORY, DESIGN_SYSTEM, PROGRESS, OPEN_QUESTIONS.
- Wireframes: 6-screen low-fi artifact (private).
- No product code written (by design; Gate 4 is the first implementation gate).

## 2026-11-10 (Stage 3)
- Docs: ARCHITECTURE, DATA_DICTIONARY, API_CONTRACTS, RAG_EVALUATION, SOURCE_POLICY; decisions D-015..D-020; challenges CH-017..CH-020.
- Env: `.venv` (Python 3.14) with torch/sentence-transformers/FastAPI/Pydantic; `.env.example`, `.gitignore`.
- Eval: `eval/bench_llm_extraction.py`, `eval/bench_embeddings.py`, `eval/golden/g_claim_v0_draft.jsonl` (14 AI-drafted items), results in `eval/results/`.

## 2026-11-10 (Stage 4 vertical slice)
- Backend `backend/lapfit/`: migrations, ingest, embeddings, hybrid retrieval (FTS5+vector+RRF, dedup collapse), extraction with trust gates, deterministic fit engine, analysis assembler, FastAPI (health/ready/search/laptops/fit-analysis/reviews/evidence/methodology).
- Frontend `frontend/`: React+TS+Vite; Home (search states, catalogue), Profile, Laptop report (gate, findings, fit by use, 12-category ratings, owner experience, lab/spec lanes, gaps), evidence drawer with exact-quote highlighting, How it works.
- Safety: instruction-pattern prefilter, exact-quote validator (output-time re-validation), category/strength guards, provisional labelling, withheld numeric score while analysis incomplete.
- Docs: SETUP.md; decisions D-021..D-025; challenges CH-021.

## 2026-11-10 (Claim Checker + plain language)
- UI copy rewritten in plain language; How to read this page; glossary; nav: Find a laptop · Check a claim · My needs · How it works.
- Claim Checker: `lapfit/claim_checker.py`, `POST /api/v1/claim-checks`, `/claim` page; curated extra facts (`spec_facts_extra.csv`); eval runner `eval/run_claim_eval.py`.
- Ingest preserves extraction results; guard against rebuild during extraction.

## 2026-11-11 (Compare + Live research)
- Compare: `lapfit/compare.py`, `POST /api/v1/compare`, `/compare` page, compare tray, "Add to compare" on laptops.
- Live research: `lapfit/research/{policy,fetcher,extract,search,pipeline}.py`, migration 002, `POST/GET /api/v1/research`, `/research/:id` progress page, "Look it up online", live laptops in reports (no owner reviews), ingest preserves live data.
- Safety: SSRF guard, redirect re-checks, robots (conservative), 2 MB cap, tier policy, credit budget, no spoofing; 37 research tests.

## 2026-11-11 (evaluation + hardening)
- Notebookcheck database pages enabled (spec pages only; short quotes; credited); report shows each official fact with exact words + link.
- Eval: `eval/README.md`, golden sets (VAR, SAFE, CLAIM v1 held-out, EXT, RET, LIVE) and runners; results in `eval/results/`.
- Hardening: injection screen v2 (obfuscation-aware) with honest limits; claim engine supports price/storage/size/refresh/'all day'/RAM-option nuance; extraction guards v2; NAT64-aware SSRF guard; reading-budget accounting; accessory queries out of scope.

## 2026-11-11 (Stage 6)
- Fresh held-out sets (claims v2, extraction v1) run once; claim engine extended; listing battery parsed from titles.
- Trust page + `/api/v1/trust`; DEMO_SCRIPT.md; README.md; ARCHITECTURE as-built; backlog status; D-037/D-038; CH-030.

## 2026-11-11 (pivot)
- New: `lapfit/advisor.py`, `lapfit/topic_reader.py`, `/api/v1/advice`, `/api/v1/claim-checks` without `variant_id`, `data/votes.db`, `eval/run_needs_eval.py`, `eval/run_topic_eval.py`, golden `g_needs_v1_heldout.json`.
- Changed: Home, ClaimPage, App nav, About page (merged), Compare/Report links, trust registry (+2 tests).
- Removed from the UI: My needs page, How it works page, Can you trust it page (content merged into About).

## 2026-11-11 (catalogue + reader v2)
- `ingest.load_amazon`, backups before rebuild, `topic_reader` v2 (single-writer parallel), advisor macro-averaged groups and US-evidence handling, tests 176.

- Reader v3 (compact reply format) shipped; full re-read of 2,819 reviews.

## 2026-11-11 (critic pass)
- New: `/laptops/{id}/ratings`, `/laptops/{id}/opinions`, `eval/run_e2e_check.py`, `docs/CRITIC_REVIEW_2026-11-11.md`. Claim parsing rewritten (direction, groups, head-to-head, absolutes, word evidence). Cards: specs, match breakdown, warnings, click-to-read owners. Detail page: topic ratings for every laptop.

## 2026-11-11 (final follow-ups)
- Changed: `advisor._examples` ranks clean quotes first; `advisor.SRC/SOURCED` add `sources` and `kind` to each suggested number; Home page links them; test updated for the new `kind` values. No new endpoints.
- Verified: phone-width layout (390 px) on three pages.

## 2026-11-11 (Listing Lie Detector, needs sheet)
- New: `backend/lapfit/listing_check.py` (claims split by the local model or by rules, then checked by code); `POST /api/v1/listing-check`; `POST /api/v1/needs` (needs sheet); `/advice` accepts `overrides` (uses, importance 0-3 per topic, own numbers, brands to skip, graphics on/off).
- New: `advisor.needs_sheet`, `advisor.apply_overrides`, importance levels, number scales with steppers; pages `ListingPage`, `NeedsPage`, `needsStore.ts` (saved in the browser); About now has "Where the AI is, and where it is not".
- Changed: performance claim words now include lag/hang/freeze; "lightweight", "super light" and "lasts the whole day" read as positive; `eval/run_e2e_check.py` has 7 more checks (39 total); 15 new tests (224 total).

## 2026-11-11 (Lie Detector evaluation)
- New: `eval/golden/g_listing_v1.json`, `g_listing_v2_heldout.json`, `g_listing_v3_fresh.json`, `eval/run_listing_eval.py`, `docs/LISTING_EVALUATION.md`, a "listing" item on the trust page.
- Changed (`listing_check.py`): matching needs an India-catalogue laptop and a consistent processor (family, generation, model number); battery lines 2 W / 4 W; one laptop's experience claims judged on its own owners (75% / 35%, 12+ owners); owner evidence for "lasts all day"; prose split on "but" and "and it"; more injection patterns; ✔ separators; model-shortened claims replaced by the longer exact words; fit claims with nothing stated now "insufficient"; "good X for students" counts as an X claim. Tests 228.


## 2026-11-11 (docs, final state)
Docs only: README rewritten; `FINAL_STATE_2026-11-11.md` and `DOUBTS_AND_ANSWERS.md` added; final-state blocks added to the scope, flow, design, copy, data, evaluation, setup, demo and guide documents. No code change.
