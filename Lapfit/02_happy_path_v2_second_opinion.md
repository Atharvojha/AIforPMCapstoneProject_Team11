# LapFit happy path v2: the "Second opinion" spine

> **PARTLY SUPERSEDED (13 Nov):** Sri wants each of the five scenarios kept separate, with its own suitable output (not one shared card). The approach-per-workflow table (§3), the free tools, tiered truth (§4) and E6 still apply.


13 Nov 2026 · Status: **draft for discussion.** It replaces §2–3 of `01_core_scenarios_and_happy_path.md`. Sections 5–7 of that document (moat, lenses, evals E1–E5) still apply.

## 0. What changed and why

Sri replaced the five original scenarios with five new use cases, and picked **UC1 + UC2 as one second-opinion flow, with UC3 as the door**. Sri also set two rules:

- **No "no match" for anything doable.** If a real answer or a workaround exists, find it.
- **Choose the right AI approach per workflow**: rules, classic ML, RAG or a pipeline, whichever gives the best and most accurate result. No model training.

The research in `research/real_query_patterns.md` (90 patterns, mostly TechEnclave and DesiDime 2026 threads; Reddit and Quora could only be seen as snippets) changes four things:

| Finding | Effect on the plan |
|---|---|
| 2026 prices broke old budgets (an RTX 3050 laptop went from ₹50–60k to ₹1L+) | A 2022 catalogue would give wrong answers. The catalogue has to be current (data plan in §4) |
| Claims and brand folklore are the #1 theme (15 of 90) | Confirms UC2 as the core |
| Service and warranty, tied to a city, is often *the* deciding factor | Service moves from "later" into the core path, as a Must |
| Refurbished ThinkPads are mainstream, even for school children | UC4 gets a thin slice inside UC2: checking a refurb listing's claims, with no photo-wear verdict |
| No real Hinglish, Telugu or Tamil code-mixing found (Reddit not readable) | Code-mixed rows will be team-written and tagged as such; real sessions must test them |

## 1. My recommendation: one spine, two doors

I agree with Sri's pick and tighten it. **UC3 is not a separate flow.** It is the same spine, except the candidate laptops come from our catalogue filter instead of from the buyer's hand. That makes it **one happy path with two entry points**, so there is one pipeline, one claim ledger and one dashboard.

```
DOOR A  "I have a laptop / listing / pitch / price-tag photo"  (UC1 + UC2)
DOOR B  "I only have my situation"                             (UC3)
                 │                                   │
                 ▼                                   ▼
        Resolve the exact variant(s)       Filter + rank the current catalogue
                 └──────────────┬────────────────────┘
                                ▼
     SECOND-OPINION CARD for each candidate (same for both doors):
       1 Fit: your Musts ✓/✗, Shoulds, Nice
       2 Claims: each pitch/listing claim → verdict + source
       3 Owners like you: lens ratings with n
       4 Price reality: dated price, sale claim checked
       5 Service: onsite/carry-in, centre near your city or PIN code
       6 Better alternatives that pass every Must (verified)
       7 "Ask the seller" checklist
                                ▼
                 Compare 2–4 · Save · Buy link (disclosed)
```

**UC5 (buying for someone else)** is not a path either. It is a situation modifier. The parser detects "for my dad/daughter" and asks one question about the real user, and accessibility Musts (large text, light weight) feed the same filter. Team bulk buying (12 laptops, GST invoice) comes later.

**UC4 (used or refurbished)** goes in as a thin slice. A refurb listing runs through the UC2 claim check, plus a refurb checklist: battery health, serial or warranty lookup, BIOS or company lock, SSD wear, and whether the photo matches the title. LapFit **never gives a verdict on physical condition from photos**. That labelling is expensive and a mistake is costly, as Sri noted.

## 2. The happy path, walked through

**Door A input** (one paste plus one line, Hinglish pitch):

> *"Shop wale bhaiya bol rahe the: HP Victus 15, i5 13th gen, 16GB, 144Hz, 8 ghante battery, free onsite warranty, Big Billion price ₹62,990 (40% off), best for coding + gaming."*
> *"I'm CSE 1st year, ₹65k max, light preferred, I'm in Warangal."*

| # | Step | Approach (§3) | What the buyer sees |
|---|---|---|---|
| 1 | Paste, type or photo | UI | — |
| 2 | Split into **situation** (CSE, ₹65k Must, light Should, Warangal) and **claims** (7 separate claims) | LLM parser, JSON schema; money and number rules run first | "What I understood" chips plus a claim list, both editable |
| 3 | Resolve "HP Victus 15 i5 13th gen 16GB" to exact variant(s) | Classic matching: model-code regex + fuzzy + embeddings; ask if two variants are within the margin | "Did you mean Victus 15-fa1xxx (i5-13420H, RTX 3050)? / or -fb (Ryzen)?" One tap |
| 4 | Check fit: ₹62,990 ≤ ₹65k ✓; weight 2.3 kg vs light ✗ Should | Deterministic | Fit row with a trade-off note |
| 5 | Check each claim | Spec claims: code against the verified spec. Battery: rules + lab + owner counts. "40% off": price history. "Free onsite": warranty table. "Best for coding": not checkable, so shown as "seller's opinion" | Claim table: ✓ checks out · ≠ doesn't match the specs · ½ depends · ? can't be checked · n/a not enough evidence |
| 6 | Owners like you | RAG over tagged reviews (filter laptop + aspect + lens, hybrid search, rerank) → code counts | "Students and gamers: battery 41% happy (n=37), heat 55% (n=29)" with exact quotes |
| 7 | Service near Warangal | Lookup table (official locator) + pincode → district | "HP: authorised centre in Warangal (as of …) · onsite: depends on the warranty pack" |
| 8 | Better alternatives | Same filter as Door B, from the current catalogue, excluding this laptop | Up to three verified variants that pass every Must, each with its own mini second-opinion card |
| 9 | Write the summary | LLM, restricted to the rows above, plus a validator; template if validation fails | ≤60-word verdict in the buyer's language: "Price and specs check out. The battery claim doesn't match owners. It's heavier than you wanted. Two lighter options are below." |
| 10 | Ask the seller | Rules over what is missing (exact model number, battery Wh, warranty type on the invoice) | Copyable checklist |
| 11 | Log | Code | Feeds the claim ledger, the listing ledger and the evals |

**Door B** starts at step 2 with no claims and no candidate. Step 8 becomes the main result, and each shortlisted laptop gets the same card.

**Tone rule (from Sri):** "doesn't match the specs", never "the seller is lying". LapFit verdicts are about claims, not people.

**Approval rule, reconciled:** Sri's text says a person approves each verdict. Doing that live would block the buyer. So:

- **Spec, price and warranty verdicts** compare a claim against a verified row in code, so no approval is needed.
- **Experience and brand-level verdicts** ("ASUS battery is bad") show as an *evidence summary, not yet reviewed* in the session. They enter the public claim ledger only after a person approves them.

## 3. The right approach per workflow (good / better / best)

The rule: **use the least-AI method that is accurate.** An LLM is used only where language is open-ended. Nothing is trained, and "classic ML" here means off-the-shelf matching, ranking and statistics.

| Workflow step | Good | Better | **Best (pick)** | Why |
|---|---|---|---|---|
| Read the situation and split the pitch into claims | Regex + keyword rules | Local LLM with a JSON schema | **Rules for money and numbers first, then the LLM with schema and few-shot examples from the golden set; low confidence → ask, or try a second larger model** | Text is open-ended and code-mixed; the rules make numbers exact |
| Name, listing or photo → exact variant | Fuzzy string match | + model-code regex (15-fa1xxx, 82K2…) | **Regex on codes → fuzzy → embedding similarity over catalogue names; abstain or ask when the top two are close** | Classic and deterministic, so it can be tested; no LLM guessing of models |
| Price-tag or screenshot photo | Tesseract OCR | PaddleOCR | **OCR + a local vision model (e.g. Qwen2.5-VL via Ollama); use the result only when both agree, otherwise ask** | Agreement of two readers catches misreads |
| Laptop not in the catalogue (avoids "no match") | Say "not found" | Web search | **Live lookup: search restricted to official maker domains → page reader → LLM extracts specs with the exact source sentence → shown as "from HP's page, as of [date], not yet verified by us" → queued for human verification** | Sri's no-false-no-match rule; truth stays tiered and labelled |
| Keep the catalogue current | Manual CSV | Scheduled scripts | **Scheduled pipeline (cron, or self-hosted n8n if a visual workflow helps the demo): fetch → LLM extract → diff → human approves the diff** | Freshness without unchecked AI writes |
| Filter and rank | — | — | **SQL + a scoring formula (deterministic)** | Must be exact and repeatable; no labels to learn from yet. Learning-to-rank from clicks is a post-launch option |
| Spec, price and warranty claims | — | — | **Code compares against the verified row or the price history** | Crisp labels, so a gate is possible |
| Experience claims (battery, heat, hinge) | Star ratings | LLM summary | **Offline batch: LLM tags aspect + sentiment per sentence (already built, P 0.88 / R 0.83) → code counts with a Wilson lower bound and minimum n → baseline against other brands** | Counting is code; the LLM only reads |
| Evidence retrieval (RAG) | Keyword search | Embeddings | **Metadata filter (laptop, aspect, date, lens) → hybrid BM25 + embeddings → reranker → quotes are exact substrings** | Evaluate the retriever separately (ai-evals skill: component isolation) |
| Writing reasons and summaries | Templates | LLM free text | **LLM restricted to the supplied rows + validator (every number and name traced) → template fallback** | Fluent but provable |
| Service by city or PIN code | — | — | **Lookup table from official locators + India Post pincode → district** | Deterministic; dated |

### Named free tools (from `research/free_data_sources_and_tools.md`, checked 13 Nov 2026; see that file for URLs and what is unverified)

| Need | Pick | Watch-outs |
|---|---|---|
| OCR + vision | PaddleOCR 3.7 (Apache-2.0) + qwen3-vl:8b via Ollama (6.2 GB, fits 16 GB) | Use only when both agree |
| Embeddings, reranker, vector store | bge-m3 + bge-reranker-v2-m3 + sqlite-vec | All local and free |
| Live lookup | Tavily (1,000 credits/month free) + Jina Reader (free key), official maker domains only | Show as "found on <url>, as of <date>, unverified" |
| Specs | Brand pages, Lenovo PSREF; Open Icecat only as an HP pre-fill | Lenovo, ASUS, Acer and Dell coverage unconfirmed |
| Battery and lab facts | Notebookcheck: quotes ≤100 words with name and link | — |
| Prices | Serper (2,500 free queries) or SerpAPI (250/month) for Google Shopping, live per query, stamped "as of", **not stored**; apply to the Flipkart Affiliate programme | No free legal bulk India price feed. Flipkart terms and robots.txt forbid scraping |
| Recent owner evidence | LapFit owner-submission form + Notebookcheck + up to 3 linked YouTube videos per laptop (official API) | YouTube: 30-day storage cap and no derived metrics, so no sentiment counts. Flipkart reviews labelled "older evidence (≤2023)" |
| Service | data.gov.in pincode → district, then deep-link to brand locators | No brand offers a downloadable list; ASUS locator returned junk data |
| **Avoid** | Brave Search API: its terms ban storing results and using them for AI or evals. Gemini free tier: prompts used to improve Google products and can be read by human reviewers | — |

Catalogue effort: about 5–7 person-days for 60–100 India models (each field with a source URL and checked date), then 3–4 hours a month to keep it current.

## 4. "No false no-match": the tiered-truth rule

Every answer comes from the highest tier available and says which tier it used:

1. **Verified catalogue** (a person checked it against the maker page): full claims and Musts.
2. **Live official lookup** (maker page, dated, not yet verified): shown with a label. It can satisfy a Must only if the field was read from the official page, and the card says so.
3. **Owner and lab evidence**: experience claims, with n.
4. **Truly unknown**: "we couldn't find this anywhere official", plus what to ask the seller.

A **genuine no-match**, meaning nothing on the Indian market meets the Musts (for example a gaming laptop under 1.2 kg and ₹40k), still says no match. It shows the closest options and the one constraint to relax. The new eval assertion is E6: **a false no-match fails** if the oracle shows a real option exists.

## 5. Evals: what this path gives us

- **UC2 multiplies rows.** One pitch carries about five claims, so 45 pitches give more than 150 claim rows. "Zero false confirmations" is the crisp gate.
- **Corpus targets (Sri: ≥100 per scenario):** at least 100 Door A inputs (pitches, listings, names, photos, refurb listings) and at least 100 Door B situations. The headline set grows from E1–E5 to six:

| # | Parameter | Gate |
|---|---|---|
| E1 | Zero wrong laptop | 0 violations |
| E2 | Right laptops found (recall@3) | set from the first run |
| E3 | Understood me (parse) | ≥95% |
| E4 | Honest (faithful + calibrated) | 0 false confirmations |
| E5 | Helped me decide (rubric) | mean ≥4 |
| **E6** | **No false no-match** | **0** |

  Variant-resolution accuracy (including "asked when ambiguous") is a new parse sub-metric under E3.
- **Hard cases** come straight from Sri's edge-case lists (identity, input, price, fit, evidence, alternatives, adversarial, emotional, claim types, half-truths). Each one becomes at least one golden row.
