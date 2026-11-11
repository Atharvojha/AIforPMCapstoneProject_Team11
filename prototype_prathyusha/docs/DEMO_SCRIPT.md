# DEMO_SCRIPT — LapFit (about 6 minutes)
Start: Ollama, API (`uvicorn lapfit.api:app --app-dir backend --port 8000`), frontend (`npm run dev`). The reader has finished for all laptops (`python -m lapfit.topic_reader` resumes if you rebuild).

One line: *Tell LapFit what you need in your own words. It suggests the numbers, ranks laptops with a rating for every category, and checks any claim against what owners wrote, showing the exact words.*

1. **Needs in plain words (1 min).** Home → Example 1 → *Find my laptops*. Show "What we understood" (edit the text to correct it), "What to look for" (RAM, processor, storage… each with a reason), then the ranked list: spec strip (✓/✕), 10 category bars with owner counts. Say: our numbers are rules of thumb; yours are hard requirements.
2. **I don't know specs (30 s).** Type only "I want it fast". Show the numbers LapFit recommends and why.
3. **Brand claim (1.5 min).** Check a claim → "ASUS laptops are bad at holding battery". Show verdict, ASUS vs other brands, every ASUS model best→worst, quotes from happy and unhappy owners (open one: the sentence is highlighted), and "Keep in mind: only 14 laptops".
4. **Suggestions (45 s).** "Which laptop has the best battery?" → best models and a brand table; no verdict because no claim was made.
5. **A specific laptop (1 min).** "MacBook Air gets 12 hours of battery" → depends on the situation (lab 16 h at 150 nits, 8.5 h at ~400 nits; maker's 18 h video claim doesn't count).
6. **Numeric (30 s).** "HP laptops are heavy" → averages from the listings.
7. **Compare (30 s).** Add 3 laptops → Compare. No winner, same rows.
8. **Trust (45 s).** Footer → About: first honest results of every test, e.g. fast reader precision 0.89 / recall 0.46; claims 19/41 on a fresh set before fixes; hidden-instruction filter caught 1 of 20.
Optional: search an unknown laptop → *Look it up online* (needs Tavily key and internet).

**Likely questions:** Why rank now? You asked for it; misses stay visible. Is the AI deciding? No: it labels reviews; code counts. How reliable are ratings? Right when labelled (89%), but each rating uses only about half of what owners said. Biggest weakness? Only 14 laptops, AI-written answer keys, rules of thumb not yet sourced.

## Nerd-persona extras (from the critic pass)
- Needs: type "CS undergrad, Linux and ML projects, 16GB RAM, good keyboard, decent thermals, around 70k, no MSI, need CUDA". Show: "We can't check Linux support", NVIDIA as a hard need, Vivobook Pro first, Apple last, a MacBook failing CUDA.
- Click **Heat and fan noise** on a laptop card: the owners' exact sentences. Click **How is the 54 worked out?**.
- Claims: "TUF F15 throttles under load" (who used the word "throttle"), "Gaming laptops have bad battery" (a group), "ASUS vs Lenovo battery" (head-to-head), "MacBook Air M1 has no fan" (not a claim owners can prove), "laptops under 50k are all flimsy" (absolutes need no exceptions), "Ryzen 5 5600H vs i5 11th gen" (declined, points to Compare).

## Added 2026-11-11: the two new scenes (use these first; they answer "why not ChatGPT?")
1. **Listing Lie Detector (2 min).** Check a listing → Example 1 (ASUS TUF) → show the green spec lines, the 12 hours on 48 Wh line ("must average only 4.0 W"), "Best laptop for gaming and video editing" going red, and "Runs cool and quiet" with an owner quote. Then Example 3 (HP, 8 GB and 16 GB RAM, 20 hours on 70 Wh): the listing contradicts itself. End on "Ask the seller". Say: a chatbot would answer fluently; this shows the receipt or says "only the seller's word".
2. **My needs sheet (1.5 min).** My needs → Example 1 → every category with Must/Important levels and a number scale → tap + on RAM, set the level of Battery to "Nice to have", skip a brand → Save and find laptops: the ranking uses those edits and says so.
3. **Where the AI is (30 s).** About page card: reads reviews (ahead of time), splits listings (now), everything else is code. Switch Ollama off to show the rule-based fallback line (optional).


## Final recommended order (2026-11-11, supersedes the numbering above; about 9 minutes)
1. **Why not ChatGPT (30 s):** say the USP in one sentence: proof, not fluent answers.
2. **Check a listing (2.5 min):** Example 1, Example 3, then paste any real listing from a student's phone. Point at the arithmetic line, the self-contradiction, "only the seller's word", and "Ask the seller". Optional: stop Ollama and show the rule-based fallback line.
3. **My needs (2 min):** Example 1; change a level, step RAM up, skip a brand; Save and find laptops; show "Using your saved needs sheet".
4. **Find laptops (1 min):** open a category bar and read the owner's exact sentence; open the full review.
5. **Check a claim (1.5 min):** "ASUS laptops are bad at holding battery"; then "Gaming laptops have bad battery".
6. **About (1 min):** "Where the AI is, and where it is not"; the honest first results including 68% on the first Lie Detector test.
7. **Say the limits (30 s):** 29 laptops of owner evidence; answer keys written by us, not a person; rules of thumb are labelled.
Questions to expect and the answers: `DOUBTS_AND_ANSWERS.md`.
