# LapFit: core scenarios, happy path, data moat and evals (brainstorm v1)

> **SUPERSEDED (13 Nov):** the scenarios are now Sri's five use cases in `03_happy_flows_by_persona.md` §0. Kept for history; the moat, lens and eval ideas (§5–7) still apply.


13 Nov 2026 · Status: **draft for discussion, waiting on decisions Q-01 to Q-03** (see `tracking/OPEN_QUESTIONS.md`)

This document picks the core scenarios and the happy path. It builds on the five documents already in this folder and on the prototype in `../prototype_prathyusha/`. Where they conflict, section 1 says so.

---

## 1. Where we actually stand: two workstreams that do not match

The five `Lapfit/*.md` documents were written as if starting from zero ("the catalog does not exist yet"; stack = Lovable + Supabase + Gemini). In fact the team already has a working prototype, and its rules contradict parts of that plan.

| Topic | Lapfit docs (13 Nov) | Prototype (`prototype_prathyusha`, 11 Nov) | What it means |
|---|---|---|---|
| Catalogue | "Does not exist; about 100 laptops to verify" | 14 Indian Flipkart laptops (about 2022) ranked, plus 15 US Amazon laptops used as evidence only | Queries must be based on what we hold. Much of the 110-query corpus names models we do not have (LOQ, Nitro V, Spectre x360, Zenbook S 14) |
| Owner evidence | Not started | 3,300 Flipkart + 687 Amazon reviews; 4,514 topic opinions read by Llama 3.1 | The evidence moat has a real starting point |
| Model | Gemini free tier | Ollama Llama 3.1 8B, local; the project rule is "free/open models only" | Gemini's free tier sends user text to Google, which conflicts with the project rule. **Decision needed (Q-02)** |
| Stack | Lovable + Supabase + n8n | FastAPI + React + SQLite, 228 unit tests, 39 end-to-end checks | A rebuild throws away working, tested code |
| Extra feature | Not mentioned | Listing Lie Detector (paste any seller listing and each claim is checked) | It works on any laptop, not only the 14 we hold |
| Data on disk | — | **The databases and processed datasets are gitignored and not on disk now** | They must be rebuilt (`SETUP.md`) before anything runs. Logged as CH-L01 |

**Recommendation:** extend the prototype and keep its stack. Use the Lapfit documents as the spec for scenarios, prompts, evals and the PRD. Lovable and n8n are optional add-ons (section 8), not a rebuild.

---

## 2. Scoring the five core scenarios (plus the Listing Lie Detector)

Each scenario is scored 1 to 5 on four questions:

- **Impact:** how often a buyer needs it, and how costly a bad answer is.
- **Resist:** how badly ChatGPT or Claude does it today; 5 means they cannot do it well.
- **Data:** how ready our data is for it.
- **Eval:** how cleanly code can mark it right or wrong.

| # | Scenario | Impact | Resist | Data | Eval | Verdict |
|---|---|---|---|---|---|---|
| S1 | Tell LapFit what you need → ranked laptops | 5 | 3 | 2 | 5 | **Spine of the happy path**. ChatGPT does this too, so the win has to come from correctness and evidence |
| S2 | Preference only ("I want it fast") → suggested numbers | 4 | 2 | 4 | 4 | Not a separate path: it is S1 with sparse input. **Merge into S1** |
| S3 | Check a claim without naming a laptop | 4 | **5** | 3 | 4 | The strongest point of difference: counted owners, scope and abstaining. **Merge into the same input box** |
| S4 | One laptop in detail, with evidence | 3 | 4 | 3 | 3 | A drill-down from a card, not a path |
| S5 | Compare 2–4 laptops | 3 | 2 | 3 | 4 | A step at the end of the path |
| (L) | Listing Lie Detector (paste a listing) | 4 | 4 | 4 | 4 | Works without our catalogue. **Candidate second path (Q-01)** |

Two findings:

1. **S1 alone is a ChatGPT clone with a smaller catalogue.** Its only defensible edge is "no wrong laptop", which matters but is not exciting.
2. **S3 is the edge, but alone it is a curiosity.** People rarely open an app just to check a rumour. They have the rumour while they are choosing. Real posts mix the two: "need a coding laptop under 60k, but I heard ASUS battery is bad, is that true?"

So the creative move is to **merge S1 + S2 + S3 into one input and one result**, with S4 and S5 as drill-downs.

---

## 3. Recommended happy path: "Fit-check" (one box, one flow)

> **Tell LapFit your situation, and anything you've heard, in your own words. You get the laptops that fit you, rated only by owners like you, with what you heard checked against counted evidence.**

### One input, five kinds of content (the parser splits them)

| The person may write… | Example | Becomes |
|---|---|---|
| A situation | "CS student, coding and some video editing" | use cases |
| Numbers and limits | "₹60k max", "under 1.5 kg" | Must or Should constraints |
| Feelings without specs | "fast", "doesn't hang", "lasts all day" | suggested numbers (old S2) |
| Something they heard | "heard ASUS battery is bad" | a claim to check (old S3) |
| A laptop they're considering | "is the HP Pavilion 15 ok?" / a pasted listing / a screenshot | a named candidate (old S4, or the Lie Detector) |

### The flow, using the example query

Example query: *"CS student, coding + some video editing, ₹60k, light, good battery. Heard ASUS laptops are bad at battery, true?"*

| # | Step | Who does it | What the person sees |
|---|---|---|---|
| 1 | Submit text (or a screenshot) | UI | — |
| 2 | Split into needs, feelings, claims and candidates | **AI** (parser prompt), JSON schema | — |
| 3 | Echo "What I understood" | rules | Chips: **Must** ₹60k · **Should** light, battery · use: coding, video editing · **Checking:** "ASUS battery is bad" |
| 4 | Suggested numbers for feelings and uses | rules table, AI writes the reason | RAM 16 GB (video editing), SSD 512 GB, weight ≤1.7 kg, each on an adjustable colour scale |
| 5 | Filter on every Must | **code** (SQL) | Laptops that break a Must never appear. If nothing is left: no-match, showing the closest laptop and which Must it breaks |
| 6 | Rank by "owners like you" | **code** | Score from owners whose reviews mention coding, college or editing, with n |
| 7 | Check the claim, scoped | **code** counts, AI words it | Panel: "ASUS, 3 models, n owners on battery: X% happy vs Y% for other brands → partly supported / not enough evidence" |
| 8 | Connect the claim to the cards | code | ASUS cards carry the badge "Battery: you asked about this", with that model's own n |
| 9 | Cards → detail (S4) → compare (S5) | UI | Quotes are exact sentences, and every number has a source |
| 10 | Log query, parse, edits and clicks | code | Feeds the evals and the moat |

**Why one path is enough:** S2 is sparse S1, S3 is a panel, S4 and S5 are drill-downs. One spine means one golden set, one ship gate and one demo story. That fits a course that grades evals (30%) and iteration (20%) above the demo (20%).

### Alternatives considered

| Option | What it is | Why not (or when) |
|---|---|---|
| A. Door A only (needs → shortlist) | What the earlier documents suggested | Easiest to evaluate, but it is the version ChatGPT already does |
| B. Two doors (needs; claims) | The earlier master plan | Two golden sets and two gates; S3 alone gets little use |
| C. Verify first: paste a listing or a claim → verdict → better alternatives | The Lie Detector as the main door | A strong startup wedge because it needs no big catalogue. Weaker on "find me a laptop". **Best second path if one is wanted** |
| **D. Fit-check (recommended)** | One box that merges S1–S3, with S4 and S5 as drill-downs | Combines the most-used job with the hardest-to-copy feature |

---

## 4. Inputs, situations and personas (summary; full corpus in step 2 of the to-do list)

The existing 110-query corpus (Phases 1–2 doc) covers 15 situation groups and 8 personas well. Two changes are needed:

1. **Rebase it on our data.** Every query gets a column `answerable_with_current_data` (yes / no-match expected / needs new data). Queries that name models we do not hold become not-in-catalogue tests, which are themselves valuable.
2. **Add mixed queries** (needs + claim + candidate in one message), because that is the merged path. Target at least 25 of them.
3. **Add real phrasing.** A research agent is mining public forum posts (Reddit, Quora, Desidime and others, read lightly within their terms). Results go to `research/real_query_patterns.md` and then into corpus v2. Synthetic rows stay tagged synthetic. The course counts only real-user sessions as customer evidence.

Non-obvious parameters to keep in the corpus: colour with a fallback ("midnight blue, or any blue"), "looks premium", weight as a feeling ("no back pain"), stock in my city, service centre near a pincode, onsite warranty, EMI per month, "lasts 5 years", resale value, hinge type, numpad, Linux, Indian summer heat, buying for a parent or child, refurbished, social pressure ("parents want a Mac").

---

## 5. Data moat and new ways to show the data (the Zomato idea)

Zomato counts only orders from within 1 km because those diners got the dish the way it is meant to be eaten. The LapFit equivalent: **count only the owners whose situation matches yours.**

| Idea (how we show it) | What it means | Data we have today | Feasible now? |
|---|---|---|---|
| **Owners like you** switch on every rating | Rating from reviewers whose text shows the same use (gaming, college, coding, editing) | Flipkart reviews are short (median 9 words), so many will not show a use | **Partly.** First measure coverage (task 5.3). Show n, and say "too few owners like you" below the minimum |
| **Honeymoon gap** | Week-1 happiness vs "after 6 months" happiness for the same laptop | Text cues ("after 6 months"); Amazon'23 has dates | Partly. Text cues only |
| **Spec-sheet honesty** bar | Claimed battery hours vs what owners report | Lab data for a few laptops; owner mentions of hours | Partly |
| **Problem onset clock** | When a problem shows up (hinge at about 8 months) | Same text cues | Thin |
| **India vs US** | Same brand, Indian vs US owners (heat in Indian summers) | Flipkart (IN) vs Amazon (US), but different models, so **brand-level only** | Yes, at brand level, labelled |
| **Last 30 days / trending** | What owners are saying now | Flipkart has no dates; Amazon ends 2023 | **No.** Needs a new data source (see the moat ladder) |
| **Regret meter** | Share of owners using "should have bought", "waste of money" | Text | Yes |
| **Gamer-only reviews** | Ratings only from reviews that name games or FPS | Text cues | Yes, small n |
| **Colour reality** | Colours actually sold in India, with a nearest-available ladder | Listing titles only | Thin. Needs hand-added variant rows |

### The moat ladder: data only LapFit accumulates

1. **Owner-lens tags** on public reviews (use, time owned, region). Copyable with effort.
2. **Claim ledger:** every claim checked, with scope, counts and verdict. It grows with use.
3. **Listing ledger:** every pasted seller listing, with which claims held up. Over time this shows which sellers and brands overclaim. Nobody else has it.
4. **Unmet-demand map** from the query log: what Indian buyers ask for that no laptop at their price offers. This is a B2B product for brands.
5. **LapFit owner check-ins (the strongest):** someone who buys through our link is asked at 30 and 180 days how it is going. That creates first-party, dated, verified-purchase owner data, which solves "last 30 days" and the honeymoon gap. It is the true Zomato analogue: a rating only from people who actually bought it for the same need. Affiliate revenue and the moat feed each other.

---

## 6. Multimodal input and output

- **Input:** a screenshot of a listing or a photo of the spec sticker. A free local vision model through Ollama (for example LLaVA), or Tesseract OCR, reads the text. The result is a *candidate* and must be confirmed against the catalogue and by the person. A blurry photo leads to a question, never a guess.
- **Output:** a dashboard, not chat. It shows the understood chips, the colour scales, the ranked cards, the claim panel, the "owners like you" switch, the honesty bar and the compare grid. Photos come only from licensed press images or none; colour swatches come from variant data.

---

## 7. Evals: the five core parameters (shared by every prompt)

The 12 parameters in the Phases 6–7 doc stay. These five are the headline set, one per question a user would ask:

| # | Parameter | The user's question | How it is measured | Grader | Bar (proposed) |
|---|---|---|---|---|---|
| E1 | **Zero wrong laptop** (constraint precision) | "Does every laptop shown fit what I said?" | Each shown ID is checked against every Must and exclusion | Code assertion | 0 violations (gate) |
| E2 | **Right laptops found** (recall@3 against an oracle) | "Did it miss a better fit?" | Top 3 overlaps the oracle-acceptable set | Code | Set from the first run, then raise. **New, missing from the earlier docs** |
| E3 | **Understood me** (parse accuracy per segment) | "Did it read my budget, Musts and claim right?" | Field-level match against the labelled parse, split by English, Hinglish, Telugu-English and Tamil-English | Code | ≥95% on Must and budget (gate per segment) |
| E4 | **Honest** (faithfulness + calibration) | "Is everything it says true, and does it admit what it doesn't know?" | Quotes are exact substrings; numbers trace to rows; abstains or says no-match when it should; false confirmations | Code + LLM judge checked against people | 0 unsupported, 0 false confirmations (gate) |
| E5 | **Helped me decide** (task fit + tone) | "Could I act on it, in my language, without jargon?" | 4-criterion rubric scored 1/3/5 (accuracy, groundedness, task fit, tone) | 2 humans + judge | Mean ≥4 of 5 |

Supporting checks: injection resistance (gate), paraphrase stability, p95 latency and cost, and **competitor win-rate** (the same 20 queries through ChatGPT, Claude, Smartprix, 91mobiles and LapFit, blind-scored on E1, E4 and E5).

### Making "100+ queries per scenario" affordable: oracle labels

Hand-labelling a shortlist for every query does not scale. Instead:

1. A person labels only the **parse**: budget, Musts, exclusions, expected behaviour code. That takes about 1 minute per query.
2. A **separate, independently written** filter script (not the product's code, so the two cannot share a bug) computes the acceptable laptop set from the catalogue.
3. E1, E2 and E4's no-match checks then run automatically on all 120+ queries. The rubric (E5) and the judge run on the 45-row hand-labelled golden subset, with about 9 rows held out.

That gives the depth the user asked for (100+ per path) and the 30–50 hand-labelled pairs the course asks for, at about a tenth of the labelling cost.

---

## 8. Cheapest and free ways to build it

| Need | Free option (recommended) | Paid or optional |
|---|---|---|
| Model | Ollama locally (Llama 3.1 8B, already used); a vision model for screenshots | Gemini or Claude APIs, only after a privacy and terms check |
| App and API | Keep the existing FastAPI + React + SQLite | Lovable to restyle the UI on its free tier; free limits not checked |
| Scheduled jobs | Cron or a Python script; n8n community edition self-hosted (free) if a visual workflow helps the demo | n8n cloud |
| Embeddings | sentence-transformers MiniLM (already used) | — |
| Hosting a demo | Run locally for the class demo | Free tiers of Render, Fly or Vercel; not checked |

"n8n + Lovable" is not the easiest route here. Both would re-implement what already exists. The cheapest accurate result comes from deterministic code over a verified catalogue, which we already have.

---

## 9. Biggest risks in this plan

1. **Stale catalogue.** Fourteen laptops from about 2022 make a weak shortlist for a 2026 buyer. Proposed mitigation (Q-03): add about 10 hand-verified current India models with specs only, labelled "no owner evidence yet". That also tests "unknown ≠ good".
2. **"Owners like you" may have too little data** because the reviews are short. Measure coverage before promising the lens.
3. **Synthetic everything.** The course grades real users. Five or more real sessions have to start soon (task 1.2).
4. **The merged parser is harder** than a needs-only parser, so it needs per-field evals from day one.
