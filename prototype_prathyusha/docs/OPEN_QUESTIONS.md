# OPEN_QUESTIONS — unresolved only

## Closed at Gate 0
Q-001 (repo/reuse) → D-004/D-005; Q-002 (catalogue) → D-006; Q-003 (depth) → D-007.

## Now (Gate 1)
- Q-009 (provisionally closed → D-011; veto allowed) Can a **listing fact alone** (e.g., integrated GPU vs student's stated need) be a dealbreaker without a review? (earlier work's unresolved blocker, affects labels v0.6)
- Q-012 Hosted LLM fallback allowed? (none by default.)

- **Gate 2 approval** of flows (FEATURE_FLOWS.md), screens (SCREEN_INVENTORY.md), wireframes and design direction (DESIGN_SYSTEM.md) — pending user.
- Q-016 closed → D-016. Q-017 closed → D-017 (names of the two teammates still needed).
- Q-018 closed → D-019. **Action for user:** create `prototype_prathyusha/.env` from `.env.example` and put your Tavily key in `TAVILY_API_KEY` (do not paste it in chat).
- Q-019 Which 2–3 newer laptops for the well-evidenced set (D-016)? Proposal: pick ones with RTINGS/Notebookcheck coverage in the ₹60k–₹90k range, confirmed by me from sources.

## Later
- Q-020 Permission outreach to LaptopMedia / licence check on Flipkart + PCBox.
- Q-021 Finish Amazon'23 scan?
- Q-022 Student sessions (customer folder in parent) feeding the golden set.

## Added 2026-11-11
- Q-023 **Tavily key** still not set (`.env` missing). Needed to test the real search call and the transient-refusal fallback (CH-024).
- Q-024 Terms of notebookcheck/rtings/laptopmedia (teammate task, CH-019) — decides whether lab pages can ever be read automatically.
- Q-025 G-LIVE: pick 15 laptops not in the catalogue and verify their official facts by hand (needed to measure extractor accuracy).

## Added 2026-11-11 (evening)
- Q-023 closed → D-032. Q-024 closed (terms researched, SOURCE_POLICY).
- **Q-026 Notebookcheck**: allow automatic reading of its pages for short facts (≤25-word quotes, link + name shown)? Terms allow quotes ≤100 words with a link but don't mention automated access. Recommended: yes for spec pages only; no for review text.

## Added 2026-11-11 (pivot)
- **Q-027** Widen the catalogue beyond 14 Flipkart laptops (Amazon 2023 sample brands, PCBox listings) so brand claims cover more models? Recommended: yes, after the fast reader's recall improves.
- **Q-028** Ground each recommended number (RAM, storage, processor level…) in a published source? Recommended: yes; list per rule. **Partly done 2026-11-11:** RAM, storage and CUDA rules now link vendor pages (Docker, Android Studio, Adobe, Steam, Windows 11, PyTorch); processor, battery, weight, refresh stay rules of thumb.
- **Q-029** Human adjudication: someone who is not Claude should check about 50 items from the needs, topic and claim sets.
- **Q-030** Should free-text needs also be parsed by the local model when rules find nothing? (Rules cover ordinary phrasing; 24/24 on the practice set after fixes.)

- **Q-027 (updated)**: widened with 15 Amazon US laptops as evidence-only. Next: finish the Amazon scan (only 28% scanned) for more laptops per brand, or add India-sold models by live research. PCBox skipped.
- **Q-031** Should US laptops ever appear as "similar models" on a laptop page? Currently no.

- **Q-032 (2026-11-11, raised by the team)** The app only answers about the 14 Indian + 15 US laptops in the database. A laptop or question outside it gets nothing, while ChatGPT or Claude answer anything. What is LapFit's reason to exist next to a general chatbot? Working answer: a chatbot gives fluent answers with no receipts; LapFit's edge is proof (exact owner quotes, counted owners, "not enough evidence" when true). To keep that edge for ANY laptop, the product should take a pasted listing, pitch or model name, check each claim against owners and live public pages, and label every line "owners said" vs "live web, not owner-verified". Candidate feature: "Listing Lie Detector" (see PRODUCT_DECISIONS D-053, proposed, not built). Needs the team's yes.

- **Q-032 update (2026-11-11):** answered in product terms by D-053/D-055 (Listing Lie Detector). Still open: whether the team agrees this is the headline USP for the demo.
- **Q-033** Evaluate the Lie Detector on a fresh answer key: 20 real listings (Flipkart/Amazon/shop messages) with the expected verdict per claim, written by someone other than the builder. Until then its accuracy is unknown. Also unknown: how often the model splits a claim wrongly on messy prose (rules plus the "exact words" check keep it safe, not necessarily complete).
- **Q-034** Should "Look it up online" results feed back into the Lie Detector (official spec pages for unknown models)? Needs a decision on search quota (1,000 free credits a month).

- **Q-033 update (2026-11-11):** Claude wrote three keys and evaluated (see LISTING_EVALUATION.md). Still open and necessary: a PERSON copies 20 real listings by hand (Flipkart, Amazon, a shop's WhatsApp message), writes the expected verdict per claim without looking at the code, and we run `eval/run_listing_eval.py` on it unchanged. Until then do not quote an accuracy for the Lie Detector beyond "first run 68%, 91%, 100% on Claude-written sets".


## Index of open questions at the final state (2026-11-11)
Open: Q-028 (sources for processor, battery, weight, refresh numbers; RAM, storage, CUDA done), Q-029 (a person checks the answer keys), Q-032 (is the Lie Detector the headline USP for the demo? answered in product terms, needs the team's yes), Q-033 (a person writes a key from 20 real copied listings), Q-034 (should live-lookup results feed the Lie Detector?). Answers given to the team's doubts are in `DOUBTS_AND_ANSWERS.md`.
