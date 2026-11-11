# LapFit: final state of the prototype (2026-11-11)

This is the one page that says what exists today, how it works, what is proven, and what is not. Older documents keep their history (dated update blocks); where they disagree with this page, this page wins. Questions the team raised and the answers given are in `DOUBTS_AND_ANSWERS.md`.

## 1. What LapFit is, in one paragraph
A laptop helper for Indian students that **shows its evidence instead of giving opinions**. You describe your needs in your own words and get a needs sheet (every category, a suggested number with its source or "rule of thumb") and a ranked list of laptops with owner ratings per category. You can paste any seller listing or shop pitch and get each claim checked, or labelled "only the seller's word", with questions to ask the seller. You can check any claim ("ASUS laptops are bad at battery") without naming a laptop. Every owner statement opens the exact sentence an owner wrote. It never says "buy this".

**Why it is not just a chatbot (the USP):** a chatbot answers anything, fluently, without receipts. LapFit answers only what it can show: counted owners with their exact words, listing numbers, arithmetic, and our suggested numbers with sources. Where it cannot show anything it says "not enough evidence" or "only the seller's word". It works on any pasted listing, not only laptops it has stored. It is **not** a general-knowledge assistant and does not try to be.

## 2. Screens (navigation: My needs · Find laptops · Check a listing · Check a claim · Compare; About in the footer)
| Screen | Route | What it does |
|---|---|---|
| **My needs** | `/needs` | Type needs in plain words. Shows what we understood, uses (tap to change), budget and brands to skip, then **12 categories** (10 owner-rated: speed, memory, battery, screen, heat and fan noise, weight and size, keyboard and touchpad, build, value, ports and Wi-Fi; plus graphics and storage, which are checked on the listing). Each has a level (Don't care / Nice to have / Important / Must have), a colour scale for the number to aim for (red below our minimum, amber to comfortable, green beyond) and a stepper to set your own number. Numbers link a vendor page or say "Rule of thumb, no source". "Save my needs" keeps it in the browser; "Save and find laptops" ranks with your edits. |
| **Find laptops** | `/` | Type needs, get what we understood, suggested numbers, and the **14 Indian laptops** ranked (hard misses first, then soft misses, then owner-review score). Each card: spec grid, miss/unknown chips, warnings ("meets your numbers, but owners are unhappy about battery"), a bar per category (click to read owner sentences), and "How is the N worked out?". Name search sits under a fold. Uses the saved needs sheet when the text matches ("Using your saved needs sheet"). |
| **Check a listing** (Listing Lie Detector) | `/listing` | Paste a listing, ad or pitch for any laptop. Each claim gets "Checks out / Doesn't add up / Partly, or it depends / Only the seller's word", the source, owner quotes where relevant, vendor links where relevant, and an "Ask" line. Ends with "Ask the seller" questions (copyable) and, for unknown laptops, an optional online lookup. A "How this was done" card states whether the language model or the rule-based splitter was used. |
| **Check a claim** | `/claim` | One box. Scope is read from the words: one laptop, a model line, a brand, a spec group (gaming laptops, Ryzen, Intel, under ₹50k, light), head-to-head (sent to Compare), or no scope (generic question: best and weakest). Direction (good or bad) is read from the words and never guessed. Absolutes ("all", "every") need no exceptions. Specific words ("throttle", "coil whine") show which owners used them. |
| **Laptop detail** | `/laptops/:id` | Owner ratings per topic, problems with exact quotes, sources, lab data where we have it. |
| **Compare** | `/compare` | 2 to 4 laptops side by side. |
| **Live lookup** | `/research/:id` | Looks a laptop we do not have up on official pages (Tavily search, allowlisted, quota-guarded). Never run automatically. |
| **About** | `/about` | How it works, **where the AI is and is not**, glossary, limits, and our own test results including the bad first runs. |

Removed on purpose (D-044): separate "How it works" and "Can you trust it" pages (merged into About). "My needs" was removed on 2026-11-11 and **brought back the same day** as the needs sheet (D-054).

## 3. Where the AI is, and where it is not (D-055)
| Part | AI? | Model | When | Decides a verdict? |
|---|---|---|---|---|
| Reading owner reviews into topic opinions (positive, negative, mixed) | Yes | Llama 3.1 8B via Ollama, on this computer | Ahead of time (≈1 s per review; stored in `votes.db`) | No: stored notes are counted by code |
| Splitting a pasted listing into claims | Yes | Same model | While you wait (≈5 to 9 s) | No. It may only copy exact words that are in your text; code discards anything else; rules take over if the model is off (the page says so) |
| Finding reviews with the same meaning in different words | Yes | MiniLM sentence embeddings | Search inside the per-laptop engine | No |
| Needs parsing, suggested numbers, ranking, counting owners, arithmetic, fit checks, every verdict | **No, code** | rules | Always | Yes |
So the honest answer to "is it only a database?": the data is a database of owner reviews and listing facts; AI reads those reviews into structured notes and splits pasted text; everything that produces a verdict is deterministic code, on purpose, so the product cannot sound confident without proof. It is not a chatbot and cannot answer from general knowledge.

## 4. How each feature works
**Needs sheet and ranking (`advisor.py`).** `parse_needs` reads uses, priorities, budget (k, lakh, ranges), RAM, storage, weight, battery hours, brands to avoid, "NVIDIA/CUDA", and a list of things we cannot check (Linux, OLED, 4K, Thunderbolt, webcam, fingerprint, touchscreen, Wi-Fi 6, VMs, audio). `apply_overrides` applies the student's edits (uses, importance 0-3 per topic, own numbers, brands to skip, graphics on/off); **edits always win**. `recommend_specs` applies `SPEC_RULES` per use; RAM, storage and CUDA rules link vendor pages (Docker, Android Studio, Adobe, Steam, Windows 11, PyTorch; checked by Claude on 2026-11-11, Adobe's page itself returned 403 so those figures come from search results about it); processor level, battery hours, weight and refresh stay "rule of thumb". `needs_sheet` builds the 12 categories with levels and scales. `advise` ranks only the 14 Indian laptops (US laptops are evidence only), with per-topic ratings (happy share, owners counted, Wilson lower bound), warnings when a priority topic has under 50% happy owners (n ≥ 5, weight ≥ 0.12), and verdict text.
**Claim Checker (`advisor.check_free_claim`, `claim_checker.py`).** Free text in; scope, topic and direction read by code. Group scores are macro-averages over laptops with ≥ 3 owners; brand or group verdicts need ≥ 20 owners, a single laptop ≥ 5; a 30-point spread between a brand's laptops means "mixed"; "no fan" cannot be proven by heat opinions so it is "not enough evidence"; claims with named laptops and measured numbers go to the per-laptop engine (specs, battery with lab data, upgrade, experience, predictive).
**Listing Lie Detector (`listing_check.py`).**
1. `clean_text` drops instruction-like lines (text_utils filter plus extra patterns) and caps length.
2. Split into claims: model copies exact quotes, one fact per item; code keeps only real substrings, re-splits groups, replaces a shortened claim with the longer exact words; rule splitter (lines, bullets, ✔ marks, pipes, sentences, commas, "but", "and it") is both fallback and safety net.
3. Match a laptop: only **India catalogue** laptops, and the listing's processor (family, generation, model number; "i3-1315U" is read as 13th Gen) must agree. Otherwise evidence is brand-level or none.
4. Classify and check each claim: spec vs stored value or "seller's word"; the listing contradicting itself (ignoring "up to/max/expandable"); battery watts = Wh ÷ hours (under 2 W contradicted, 2 to 4 W "best case only", 4 W or more "seller's number"; lines are our rule of thumb); fit ("great for gaming") vs our suggested numbers; experience vs that laptop's owners (75% / 35% cut-offs, ≥ 12 owners) else its brand (labelled "NOT this model"); marketing words need a number; non-claims (price, shipping) are not judged.
5. "Ask the seller" questions from what the listing leaves out (battery Wh, model number, warranty and GST bill, OS, soldered RAM, SSD or HDD, panel and nits, weight, refurbished).
**Reader (`topic_reader.py`, `topics-v3`).** Code finds candidate topics per sentence; the model returns only an array of opinions (one per listed topic). Stored in a separate `votes.db` so rebuilding the main database cannot erase it.

## 5. Data
| Item | Count | Notes |
|---|---|---|
| Laptops recommended | 14 | Flipkart listings, India, about 2022 (`catalogue_set='flipkart14'`) |
| Laptops used only as evidence | 15 | Amazon Reviews 2023 sample, US, USD prices, never ranked, hidden from `/laptops` and `/search` (`well_evidenced`) |
| Reviews stored | 3,300 Flipkart + 687 Amazon | duplicates flagged (1,091 Flipkart in duplicate clusters) |
| Reviews read by the reader | 2,819 (2,155 Flipkart + 664 Amazon) | 4,514 topic opinions: 3,091 positive, 1,366 negative, 57 mixed |
| Lab / maker facts | hand-curated; deep reading problem lists for only 3 laptops (FKL-09, 10, 11; MacBook partial) | `evidence_claims` |
Sources never used: bulk LaptopMedia, Reddit, YouTube. PCBox listings are not used. Licences for Flipkart data are unverified; Amazon data is not licensed: course use only.
**Data safety:** the live database is backed up before any rebuild (`backend/data/backups/`, D-047) after incident CH-035 (a rebuild with untested code crashed after deleting the file; 1,316 deep-reading claims were recovered from the running API and the old state). Build new loaders into a scratch database first.

## 6. API (all under `/api/v1`)
`GET /health, /ready, /laptops, /laptops/{id}, /laptops/{id}/ratings, /laptops/{id}/opinions?topic=, /laptops/{id}/reviews, /search?q=, /evidence/review/{id}, /research/{job}, /trust, /methodology` · `POST /advice` (with optional `overrides`), `/needs`, `/listing-check`, `/claim-checks` (optional `variant_id`), `/fit-analysis`, `/compare`, `/research`. Contracts: `API_CONTRACTS.md`.

## 7. Code map
`backend/lapfit/`: `advisor.py` (needs, numbers, ranking, free claims), `listing_check.py` (Lie Detector), `topic_reader.py`, `claim_checker.py`, `fit_engine.py`, `compare.py`, `retrieval.py`, `extraction.py`, `ingest.py`, `llm.py`, `embeddings.py`, `text_utils.py`, `api.py`, `research/`. `frontend/src/`: pages `NeedsPage, Home, ListingPage, ClaimPage, ComparePage, Report, ResearchPage, AboutPage`; `needsStore.ts` (needs saved in the browser); `components/bits.tsx`. `eval/`: runners, `golden/` keys, `results/`, `trust_registry.json`.

## 8. What was measured (all answer keys are written by Claude, unverified by a person)
| What | First (honest) result | After fixes / notes |
|---|---|---|
| Needs parser (24 requests, incl. Hinglish) | uses 21/24, budget 24/24, avoid 24/24 | 24/24 but now a dev set; keys written knowing the word list |
| Review reader v3 (fresh 40 reviews, 78 topics) | precision 0.878, recall 0.833, opinion 58/65 | ≈ 1 in 8 happy/unhappy calls wrong; example quotes ranked so contradicting ones come last; ratings average the noise |
| Reader history | v1 P 0.89 / R 0.46; v2 P 0.81 / R 0.95 | v3 is the current one |
| Claim checker (G-CLAIM v2, 41) | 19/41 | 41/41 dev set |
| Page injection filter (20 unseen attacks) | caught 1/20 | patterns added; damage is capped, not prevented |
| **Listing Lie Detector, set 1 (24 listings, 68 claims)** | **46/68 verdicts (68%), right laptop 17/24** | 68/68 dev set |
| Lie Detector, set 2 (13 listings, 32 claims) | 29/32 (91%), right laptop 12/13, injection 0/1 | 32/32 dev set |
| Lie Detector, set 3 (12 listings, 23 claims) | 23/23 (100%), one disputable flag on Hinglish | easy set; two bugs still found and fixed |
| End-to-end script (`eval/run_e2e_check.py`, live API) | 33/33 at one point while missing a crash and a wrong-direction verdict | now 39/39 |
| Critic passes (nerd persona, student persona) | 21 problems found and fixed, then follow-ups 22 to 24 | `CRITIC_REVIEW_2026-11-11.md` |
| Unit tests | | 228 pass |
Lie Detector keys: real published specs (Apple, ASUS, Lenovo, Acer, HP; URLs in the key) retyped in listing style, catalogue-laptop cases, and stress cases. **Not verbatim seller listings** (copying shops in bulk breaks their terms). See `LISTING_EVALUATION.md`.

## 9. Known limits and open items (nothing hidden)
1. **Closed evidence.** Owner evidence exists for 14 + 15 laptops and their brands only (Dell and Acer rest on 2 laptops each with few reviews). Anything else: "only the seller's word", or an optional live lookup (official pages, no owner reviews).
2. **Answer keys are AI-written and not independent** (Q-029, Q-033). A person must copy about 20 real listings by hand, write expected verdicts without looking at the code, and we run `eval/run_listing_eval.py` unchanged. Until then quote no accuracy beyond "first run 68%, 91%, 100% on Claude-written sets".
3. **Rule-of-thumb numbers:** processor level, battery hours, weight, refresh rate, the 2 W / 4 W battery lines, the 75% / 35% and 12 / 20 owner cut-offs are ours, not measured (Q-028 partly answered).
4. **Data gaps:** battery size missing for 9 of 14 laptops (Flipkart titles do not identify the exact model, so a looked-up value could belong to another variant: not guessed); upgrade info mostly "not stated"; no review data on Linux, OLED, Thunderbolt, webcam or audio (the page says "we can't check this"); lab problem lists for 3 laptops only.
5. **Reader noise** (≈ 1 in 8). **Mixed-language sentences** (Hinglish) can get a verdict from the English word only. **Units** (lbs, mAh) and non-English claims are not read by the Lie Detector.
6. **Injection filters are pattern-based**; new wording can slip past.
7. **Runtime needs:** Ollama with `llama3.1` for the claim splitter (rules are used if it is off); a Tavily key in `.env` only for live lookup (free quota 1,000 credits a month, never auto-run).
8. **Layout:** checked at 390 px wide on Find, Check a claim, About, My needs and Check a listing (no sideways scroll); not tried on a real phone.
9. **Not built:** share report, saved history, bottleneck explainer, user accounts, rate limiting, catalogue beyond 29 laptops, Amazon scan only 28% complete.
10. **Decision pending (Q-032):** whether the team agrees the Lie Detector is the headline USP for the demo. Q-034: whether live-lookup results should feed the Lie Detector.

## 10. Run it
Python 3.14 venv, Node 20, Ollama with `llama3.1`. `cd prototype_prathyusha && .venv/bin/uvicorn lapfit.api:app --app-dir backend --port 8000`, `cd frontend && npm run dev` (port 5173). Tests: `cd backend && ../.venv/bin/python -m pytest -q tests` (228). End to end (API running): `.venv/bin/python eval/run_e2e_check.py` (39). Lie Detector evaluation: `.venv/bin/python eval/run_listing_eval.py eval/golden/g_listing_v3_fresh.json --model`. Details in `SETUP.md`. Secrets live only in `.env` and are never printed or pasted.

## 11. Decision and issue index
Decisions D-039 to D-056 (`PRODUCT_DECISIONS.md`): five core scenarios, free-text needs, claims with any scope, About page, widened catalogue, reader v3, backups, Lie Detector (D-053), needs sheet (D-054), where the AI is (D-055), "promising not accurate" (D-056). Challenges CH-031 to CH-040 (`CHALLENGES.md`). Open questions Q-027 to Q-034 (`OPEN_QUESTIONS.md`).
