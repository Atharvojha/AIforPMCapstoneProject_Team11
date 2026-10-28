# Data collection protocol: laptop reviews for the golden set

Goal: 8 laptops x 20-30 real reviews (about 200 reviews) pasted into `02_golden_dataset_v1.xlsx` (tabs `Laptops` and `Review_Bank`). The brief asks for real language, not what we hope users say, so the reviews must be real and messy.

## 1. Pick the laptops (about 30 min, whole team)
- 8 laptops across 3 price tiers: 3 in tier A (up to ₹45k), 3 in tier B (₹45-75k), 2 in tier C (₹75k+). The tier is pre-filled in `Laptops`.
- Choose laptops students actually shortlist: start from Amazon.in and Flipkart bestseller lists for "laptops", plus the r/suggestlaptops style threads.
- Prefer laptops with **at least 40 reviews** and **visible disagreement** (a mix of 5-star and 1-3 star reviews). A laptop everybody loves gives no conflicts to test.
- Cover the edge cases: at least one laptop sold in several RAM/SKU variants (config mismatch), one with long-term complaints (battery, hinge), one with very few reviews (thin evidence), one with a dedicated GPU.
- Fill `Laptops`: model, CPU/GPU, RAM, storage, display, weight, listing price, listing link and date, known controversy. Copy the specs from the listing; they are needed to catch spec contradictions.

## 2. Collect reviews (about 1-1.5 h per person for 2 laptops)
Split so each person owns 2 laptops (and fills `collected_by`).
- Per laptop: **20-30 reviews**, chosen deliberately: about a third 1-2 star, a third 3 star, a third 4-5 star. Do not take only the "top reviews". Include some low-helpful-vote reviews.
- Include at least 3 Hinglish or code-mixed reviews across the whole set if you can find them.
- Include whatever junk exists: promotional-sounding reviews, seller or delivery complaints, one-liners. Do not clean it.
- Copy by hand (select, copy, paste into `review_text`). Keep the review text exactly as written, typos included.
- Record per review: source, source URL, review date, stars (blank if none), helpful votes, verified purchase (Y/N/NA), the config the reviewer states (e.g. "16GB/512GB"), how long they say they have used it, language.
- **Do not record reviewer names or profile links.**
- IDs `R001`-`R300` are pre-numbered in `Review_Bank`. Fill rows in order. Delete the `EX1` example rows when you start.

## 3. Rules for using the data
- No scraping or bots. Manual copy-paste only, from pages you can open normally, within each site's terms.
- The dataset is for this course project only. Keep it in the team folder. Do not publish or redistribute the raw reviews. In the final deck, quote at most a few short lines with the source named.
- Each review's source URL and date are kept so every item can be traced back.

## 4. Optional: supplement from the public Amazon Reviews 2023 dataset
It is large (multi-GB per category) and mostly US listings, so it is a fallback, not the plan. If your team wants it, Claude will check the exact file name and size and ask you before downloading anything.

## 5. Done when
- `Laptops` has 8 filled rows; `Review_Bank` has 160+ real reviews with source and URL.
- Every laptop has the mix described in section 1 (check by sorting `Review_Bank` by `laptop_id`).
- Then go to `Items`: choose a laptop and reviews for each blueprint row, and label using `Labelling_Guide`. Run:
```bash
python3 src/validate_golden.py 02_golden_dataset_v1.xlsx
```
