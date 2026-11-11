# LapFit — laptop help for Indian students that shows its evidence

IIIT Hyderabad · AI for PMs · Team 11. LapFit helps a student choose a laptop and check what sellers say, **with receipts**: counted owners and their exact words, listing numbers, arithmetic, and suggested numbers with sources. Where it cannot show evidence it says "not enough evidence" or "only the seller's word". It never says "buy this".

**Read first:** `docs/FINAL_STATE_2026-11-11.md` (everything that exists, how it works, what is proven and what is not) and `docs/DOUBTS_AND_ANSWERS.md` (the team's doubts and the answers: "is it only a database?", "why not ChatGPT?", "what is the AI?").

## Why it is not just a chatbot
A chatbot answers anything, fluently, without receipts. LapFit answers only what it can show. It is **not** a general-knowledge assistant. The USP is proof, plus a listing checker that works on any pasted listing, not only laptops we store.

## What you can do (nav: My needs · Find laptops · Check a listing · Check a claim · Compare; About in the footer)
| Screen | What it does |
|---|---|
| **My needs** | Type needs in plain words → needs sheet: 12 categories with a level each (Don't care … Must have), a colour scale for the number to aim for (source or "rule of thumb"), steppers for your own numbers, uses, budget, brands to skip. Saved in the browser; your edits always win. |
| **Find laptops** | Type needs → what we understood → suggested numbers → the 14 Indian laptops ranked with 10 owner-rated categories, warnings, and click-to-read owner sentences. |
| **Check a listing** | Paste any listing, ad or shop pitch → each claim "Checks out / Doesn't add up / Partly / Only the seller's word", with sources, owner quotes and "Ask the seller" questions. Optional online lookup for unknown laptops. |
| **Check a claim** | "ASUS laptops are bad at battery", "gaming laptops run hot", "Which laptop has the best screen?": scope and direction are read from your words. |
| **Compare / Laptop detail / Live lookup / About** | Side by side; owner ratings, problems and sources; official-page lookup; how it works, where the AI is, limits and our own test results including the bad first runs. |

## Where the AI is
Llama 3.1 (on this computer) **reads every review once** into topic opinions (ahead of time) and **splits a pasted listing into claims** (while you wait, copying exact words only; rules take over if it is off). A small embedding model finds same-meaning reviews. **Every verdict, ranking, number and check is plain code.**

## State today (2026-11-11)
- Data: 14 Indian laptops (recommended) + 15 US laptops (evidence only); 3,300 + 687 reviews; 2,819 unique reviews read, 4,514 topic opinions.
- Tests: `cd backend && ../.venv/bin/python -m pytest -q tests` (228). End to end with the API running: `.venv/bin/python eval/run_e2e_check.py` (39).
- Evaluations (all answer keys written by Claude, **not checked by a person**): reader v3 precision 0.88 / recall 0.83; Lie Detector first runs 68%, 91%, 100% of verdicts on three Claude-written sets (`docs/LISTING_EVALUATION.md`); critic passes found and fixed 24 problems (`docs/CRITIC_REVIEW_2026-11-11.md`).
- Layout checked at 390 px wide on all five main screens.

## Run it
See `docs/SETUP.md`. Short version: Python 3.14 venv, Node 20, Ollama with `llama3.1`; `uvicorn lapfit.api:app --app-dir backend --port 8000`; `cd frontend && npm run dev` (port 5173). Secrets stay in `.env`.

## Honest limits
Owner evidence covers 29 laptops and their brands only; answer keys are AI-written (a person must write a key from real copied listings, Q-033); processor, battery, weight and refresh numbers are rules of thumb; battery size is missing for 9 of 14 laptops; no review data on Linux, OLED, Thunderbolt, webcam or audio; the reader is wrong on about 1 in 8 happy/unhappy calls; injection filters are pattern-based; every fresh test exposed new gaps and each fix turned that test into a development set. Data is for course use only (Flipkart licence unverified; Amazon data not licensed).

## Read in this order
`docs/FINAL_STATE_2026-11-11.md` → `docs/DOUBTS_AND_ANSWERS.md` → `docs/PROGRESS.md` → `docs/PRODUCT_DECISIONS.md` → `docs/CHALLENGES.md` → `docs/OPEN_QUESTIONS.md` → `docs/LISTING_EVALUATION.md` → `docs/RAG_EVALUATION.md` → `eval/README.md` → `docs/ARCHITECTURE.md` → `docs/DATA_AUDIT.md` → `docs/SOURCE_POLICY.md`. Demo: `docs/DEMO_SCRIPT.md`.
