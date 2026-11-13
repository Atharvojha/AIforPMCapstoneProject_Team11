# LapFit: free, terms-compliant data sources and tools

## 1. Method and date

- **Date of all checks:** 2026-11-13. Every row was checked on the provider's own page (pricing, terms or docs) on that date unless it is tagged:
  - **snippet**: seen only in a web-search snippet or a third-party page. Treat it as unconfirmed.
  - **not verified**: the page was blocked (403, 404, bot check, JS-only) or did not state the fact. No number has been guessed.
- **Tools:** WebFetch on official URLs, plus WebSearch to locate pages. Pages that only render with JavaScript (PSREF, the Lenovo, Apple and HP locators) are marked "not verified".
- **Scope:** free or free tier only, and legal under the provider's terms and the project's rules (no bulk LaptopMedia, no Reddit or YouTube scraping, no model training). This is not legal advice.
- **Risk key:** low = the terms explicitly allow this use; med = allowed with conditions, or terms unclear or unverified; high = the terms forbid it, or it depends on eligibility we probably do not have.

---

## 2. Options by category

### 2.1 Spec catalogues (hard attributes: hinge, pen, panel, soldered RAM, ports, weight, colours)

| Option | What it gives | Free limits | Terms / licence risk | India coverage | Freshness | Tag | URL |
|---|---|---|---|---|---|---|---|
| **Manufacturer spec pages** (Apple India, HP, Dell, ASUS, Acer, Lenovo India) | The authoritative spec sheet per model and variant: weight, ports, colours, panel. Example: Apple's India MacBook Air spec page lists M5, 1.23 kg / 1.51 kg, colours Sky Blue/Silver/Starlight/Midnight, MagSafe 3 + 2×TB4 + 3.5 mm. | Free to read. No API. | **Low** for manual reading, storing facts and linking back. Med if crawled at volume, so read each site's terms and robots.txt first. | India pages exist (e.g. apple.com/in). India variant lists and colours are not verified for the other brands. | Current. Updated at launch. | **Best** (ground truth) | https://www.apple.com/in/macbook-air/specs/ (verified 2026-11-13) |
| **Lenovo PSREF** | Spec sheets for every Lenovo model and model number (IdeaPad, Yoga, LOQ, Legion, ThinkPad), including memory type (soldered or socketed) and ports. | Free to read. Exports, terms and region fields: **not verified** (the page is a JS app and the fetch returned only its title). | **Low** for facts plus a link (public reference site). Terms of use not verified. | Global model numbers. Which ones are sold in India is not verified. | Current (vendor-maintained). | **Best** for Lenovo | https://psref.lenovo.com/ (only the title loaded on 2026-11-13) |
| **Open Icecat** | Free product-content catalogue from "sponsoring" brands. JSON/XML pull API by brand + product code or GTIN. Free registration. | Free account. Request limits not verified. | **Med.** Covers only brands that sponsor Open Icecat. A Fair Use Policy applies. Icecat's 2022 FAQ says permissions "might be revoked or subject to brand-specific limitations". | HP is listed as a sponsor (snippet). Lenovo, ASUS, Acer and Dell sponsorship is not verified. India-specific SKUs not verified. | Depends on the brand feed. | **Good** (test with an HP SKU first) | https://iceclog.com/faq-for-merchants/ (FAQ dated 2022-03-15, read 2026-11-13). icecat.biz showed a bot check: not verified. |
| **Wikidata** | Model-level entities (chip, release date) via SPARQL. | Free. | **Low**: CC0 (verified). | Thin coverage of laptop variants and no India prices. | Community-edited, so patchy. | **Good** for chips and families only | https://www.wikidata.org/wiki/Wikidata:Licensing |
| **Kaggle Flipkart laptop scrapes** (e.g. ~920 or ~984 rows) | Listing title, price in INR, specs. | Free download. | **High**: these are scrapes of Flipkart, whose terms ban robots and copying (see 2.2). Each dataset's licence is not verified. | India. | Scrape dates not verified, and probably not 2026 (snippet). | **Avoid** for production. A schema reference at most. | snippet: https://baselight.app/u/kaggle/dataset/anas123siddiqui_laptops |
| **HF Amazon Reviews 2023 (McAuley)** | Reviews with Unix timestamps, May 1996 to Sep 2023. Prices in USD. | Free download. | **Med**: no licence stated on the page. | US-centred, not India. | Ends Sep 2023. | **Good** for eval and test data only | https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023 |

**No open laptop dataset with 2024–2026 India prices and a clear licence was found.** Searches returned only Flipkart scrapes with unknown dates.

### 2.2 Prices and availability (India)

| Option | What it gives | Free limits | Terms / licence risk | India coverage | Freshness | Tag | URL |
|---|---|---|---|---|---|---|---|
| **Flipkart Affiliate programme (API / feeds)** | The affiliate site advertises "APIs, for listing Flipkart deals / products on your own site / app" and "Feeds". | Free for affiliates. Limits **not verified**: /api-docs/ returned 404. | **Med.** Needs an approved affiliate account (login by OTP). Eligibility not verified. If you get access, this is the only sanctioned Flipkart data route. | India. | Live. | **Best if approved** | https://affiliate.flipkart.com/ (verified 2026-11-13) |
| **Amazon Creators API** (successor to PA-API 5) | Amazon product data, prices, offers. | Free with Associates. Eligibility and sales threshold **not verified**. Third parties say PA-API 5 retired in Apr–May 2026 (snippet). | **High** for a student. Amazon's deprecation page confirms Creators API is the successor but gives no dates or eligibility. Associates sales requirements apply (snippet). | amazon.in support not verified. | Live. | **Better** only if Team 11 already holds an Associates account with sales | https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation |
| **Scraping Flipkart pages** | — | — | **High.** The terms forbid any "robot", "spider", "page-scrape" … to "access, acquire, copy or monitor" content. robots.txt disallows `/search?`, `*/product-reviews/*`, `*/specifications?*`, `*page=*`. | — | — | **Do not use** | https://www.flipkart.com/pages/terms, https://www.flipkart.com/robots.txt |
| **Scraping Amazon.in** | — | — | **High.** The Conditions of Use bar "data mining, robots, or similar data gathering and extraction tools" (wording from the UK and US versions, snippet; the amazon.in page returned 503). | — | — | **Do not use** | snippet |
| **Croma / Reliance Digital** | Public product pages. | No public API found (not verified). | **Med–high.** Croma's robots.txt returned Access Denied, so its rules are not verified. | India. | Live. | Manual "as of" checks only | https://www.croma.com/robots.txt (denied 2026-11-13) |
| **PriceHistory.app** | Free price-history charts and alerts for Amazon and Flipkart India. A business Pricing API exists ("contact us"). | Website free. API is paid or on request (price not stated). | **Med.** Terms on scraping not verified. Fine for a human to look up a product and link to it. Do not crawl it. | India (Amazon + Flipkart only). | Live. | **Good** (manual link-out for the "40% off" check) | https://pricehistory.app/ |
| **Keepa** | Amazon price history. | API pricing **not verified** (pages were JS-only or 404). | **Med**: terms not verified. | amazon.in support not verified. | Live. | Not recommended (unverified) | https://keepa.com/ |
| **Google Shopping via Serper** | Google SERP results, including a "Shopping" search type (endpoint not confirmed). | **2,500 free queries, no card.** Expiry not stated. | **Med.** You get Google results second-hand. Serper's own terms on storage not verified. | Uses Google India results if `gl=in` (not verified). | Live. | **Better** (live price lookup) | https://serper.dev/ |
| **SerpAPI** | Google Shopping and other engines. | **250 searches/month, 50/hour** (free plan). | **Med**: same reason as Serper. No non-commercial clause shown. | gl=in (not verified). | Live. | **Good** (backup) | https://serpapi.com/pricing |
| **Smartprix / MySmartPrice** | India price aggregators. | No API. | **Med.** Smartprix robots.txt blocks `/api`, `q=` and redirect paths. Its terms not verified. | India. | Live. | Manual reference only | https://www.smartprix.com/robots.txt |

### 2.3 Reviews and recent owner evidence

| Option | What it gives | Free limits | Terms / licence risk | India coverage | Freshness | Tag | URL |
|---|---|---|---|---|---|---|---|
| **Existing Flipkart review set (3,300) + Amazon'23 sample** | Dated owner reviews. | Already local. | Med: course use only, not for redistribution (project rule). | India (Flipkart). | ≤2023. | Keep, labelled "older evidence" | local `lapfit_data_pack/` |
| **Owner submissions (LapFit form)** | First-party, dated, consented owner reports. | Free. | **Low** (your own data plus consent). | India. | Live. | **Best** (the only clean source of new owner voice) | n/a |
| **Notebookcheck** | Lab tests: battery runtime, display brightness and coverage, thermals. | Free to read. | **Low if** quotes stay under 100 words with a visible link and the Notebookcheck name. Copying text or photos otherwise needs permission. Non-commercial sites may use one photo. | Global models, many sold in India. | Current. | **Best** for checking battery and panel claims | https://www.notebookcheck.net/Contact.270.0.html (verified 2026-11-13) |
| **YouTube Data API v3** | Video search and comments via the official API (no scraping). | **10,000 units/day** default + 100 `search.list` calls. `commentThreads.list` cost not verified. | **Med–high.** Non-authorised data may be stored ≤30 days, then deleted or refreshed. No independently derived metrics (III.E.4.h). No scraping (III.E.6). Must credit YouTube as the source. Counting sentiment across videos is a derived metric, which is risky. | Indian creators. | Live. | **Good** (show 1–3 linked videos only, no aggregates) | https://developers.google.com/youtube/v3/getting-started, https://developers.google.com/youtube/terms/developer-policies |
| **Reddit Data API** | Posts and comments. | 100 QPM for approved non-commercial use (**snippet**). Approval needed for every new client since Nov 2025 (**snippet**). | **High.** Reddit's pages could not be fetched (blocked). Third parties say the terms ban AI/ML training and that new requests closed or are closing (snippet). The project rule already says "no Reddit scraping". | r/IndianGaming, r/LaptopsIndia. | Live. | **Avoid** unless approval is granted in writing | not verified (redditinc.com and reddit.com blocked fetch) |
| **Amazon / Flipkart live reviews** | — | — | **High** (see 2.2 terms). Flipkart reviews "become Our property". | — | — | **Do not scrape**. Link out instead. | https://www.flipkart.com/pages/terms |

### 2.4 Service centres and pincodes

| Option | What it gives | Free limits | Terms / licence risk | India coverage | Freshness | Tag | URL |
|---|---|---|---|---|---|---|---|
| **Dell India locator** | Search by city or PIN, or browse by state and city. Results appear on a map. | Free. No download. | Low for manual lookup. Med for bulk extraction (JS app, terms not verified). | India. | Live. Dell says to call ahead. | **Best** (deep link) | https://www.dell.com/support/home/en-in/servicecenter |
| **ASUS India locator** | Search by pincode ("18 Service Centres Near Your Location" for 400047). The sample entry showed a **placeholder address** ("Anytown, CA"). | Free. No download. | Low for manual lookup. **Data quality risk.** | India. | Live, but has errors. | **Good** (verify by phone) | https://www.asus.com/in/support/Service-Center/India |
| **HP India locator** | "Find an HP authorized service center near you". Search loads dynamically. | Free. No download. | Low (manual). | India. | Live. | **Good** (deep link) | https://support.hp.com/in-en/service-center |
| **Lenovo / Acer / Apple India** | Official locators. | — | Lenovo returned 403, Acer timed out, Apple loaded only its title: **not verified**. | India (presumed). | — | Deep link only | https://www.lenovo.com/in/en/servicelocator/, https://www.acer.com/in-en/support/service-centers, https://locate.apple.com/in/en/ |
| **data.gov.in All India Pincode Directory** | Pincode → office, division, region, circle. A separate "WebService" catalogue entry adds district and state (snippet). | Free. Whether an API key is needed: not verified. The monthly file page says "API does not exist yet" (snippet). | **Low.** Government open data. Licence (GODL) not verified, since the page returned 403. | All India. | Monthly (snippet). | **Best** (download the CSV once, map pincode → district) | https://data.gov.in/resource/all-india-pincode-directory-till-last-month (403 on 2026-11-13) |

**No brand offers structured or downloadable service-centre data** among those checked.

### 2.5 Web search and reading tools (live lookup / RAG)

| Option | What it gives | Free limits | Terms / licence risk | India coverage | Freshness | Tag | URL |
|---|---|---|---|---|---|---|---|
| **Tavily** | Search + extract API built for LLMs. | **1,000 credits/month, no card. 100 RPM** (Researcher plan). Credit cost per call not verified. | Med: terms on storage not verified. | Global web. | Live. | **Best** (simplest live lookup) | https://www.tavily.com/pricing, https://docs.tavily.com/documentation/rate-limits |
| **Brave Search API** | Independent web index. | $5 free credit/month per plan (the page also says "up to $20"; it does not reconcile the two). ~1,000 searches at $5/1k (my arithmetic). | **High for RAG storage.** §3(b) bans storing, caching or building a database of results (transient use only) and bans using results to "create, evaluate, train … benchmark" AI. Terms updated 1 Sep 2026. | Global. | Live. | Good for transient lookups only. **Not for building an eval set.** | https://brave.com/search/api/, https://api-dashboard.search.brave.com/terms-of-service |
| **SearXNG (self-hosted)** | Metasearch across up to 260 engines. JSON output once `format: json` is enabled in settings.yml (403 otherwise). | Free (self-hosted). | Med: the upstream engines' terms and rate limits still apply. The docs have limiter and CAPTCHA pages. | Global. | Live. | **Better** (free, no key) | https://docs.searxng.org/dev/search_api.html |
| **Jina Reader (r.jina.ai)** | URL → clean markdown. | **20 RPM without a key. 500 RPM with a free key, 10M free tokens per new key.** | Low–med: you are still bound by the target site's terms. | n/a | Live. | **Best** reader | https://jina.ai/reader/ |
| **Firecrawl (cloud free)** | Scrape and crawl to markdown. | **1,000 credits/month, 2 concurrent**, no card. | Same as Jina: respect each target site's terms. | n/a | Live. | Good | https://www.firecrawl.dev/pricing |
| **Crawl4AI** | Open-source crawler, v0.9.5 (14 Oct 2026). | Free (local). | **Low** licence risk (Apache-2.0). A robots.txt option was not verified on the README, so honour robots.txt in your own config. | n/a | — | **Better** (local, allow-listed brand pages only) | https://github.com/unclecode/crawl4ai |
| **DuckDuckGo** | No official web-results API confirmed. | not verified | Unofficial wrappers scrape DDG, so risk is med–high. | — | — | Avoid | https://duckduckgo.com/duckduckgo-help-pages/open-source/api/ (did not state it) |

### 2.6 Local AI tooling (16 GB Apple M-series)

Download sizes are verified on ollama.com. **The memory column is my estimate** (weights + KV cache + OS ≈ download × 1.3 + ~2 GB headroom), not a vendor figure.

| Option | Use | Size (verified) | Fits 16 GB? (estimate) | Licence | Tag | URL |
|---|---|---|---|---|---|---|
| **qwen3-vl:8b** | Price-tag and screenshot OCR + extraction to JSON. 256K context, vision + tools. Needs Ollama ≥0.12.7. | 6.2 GB | Yes, alone (~9–10 GB). Do not run it alongside llama3.1:8b. | not verified (Qwen) | **Best** vision | https://ollama.com/library/qwen3-vl |
| qwen3-vl:4b | Faster fallback. | 3.3 GB | Yes, easily. | not verified | Better (speed) | same |
| qwen2.5vl:7b | Older vision model. | 6.0 GB | Yes. | not verified | Good | https://ollama.com/library/qwen2.5vl |
| gemma3:4b / 12b | Vision on 4B and up (1B and 270M are text-only). 128K context. | 3.4 / 8.2 GB | 4b yes. 12b is tight. | Gemma terms (not verified) | Good | https://ollama.com/library/gemma3 |
| llama3.2-vision:11b | Vision. | 7.8 GB | Tight. | Llama licence (not verified on the page) | Good | https://ollama.com/library/llama3.2-vision |
| llama3.1:8b (installed) | Text extraction. | — | Yes. | Llama licence | Keep | — |
| **PaddleOCR 3.7.0** (2026-06-11) | Deterministic OCR before the LLM. macOS badge. PP-OCRv5 covers 109 languages incl. Devanagari, Telugu, Tamil. | — | Yes. | Apache-2.0 | **Best** OCR | https://github.com/PaddlePaddle/PaddleOCR |
| Tesseract | Simple OCR fallback. | — | Yes. | not verified this session | Good | — |
| **bge-m3** | Embeddings: 1024-dim, 8192 tokens, 100+ languages. | — | Yes. | MIT | **Best** | https://huggingface.co/BAAI/bge-m3 |
| **bge-reranker-v2-m3** | Reranker, 0.6B, multilingual. | — | Yes. | Apache-2.0 | **Best** | https://huggingface.co/BAAI/bge-reranker-v2-m3 |
| **sqlite-vec** | Vectors inside SQLite (`pip install sqlite-vec`). Pre-v1, breaking changes possible. | — | Yes. | MIT / Apache-2.0 | **Best** (one file with the catalogue) | https://github.com/asg017/sqlite-vec |
| LanceDB | Embedded, runs in-process. | — | Yes. | Apache-2.0 | Better | https://github.com/lancedb/lancedb |
| Chroma | Vector DB. Local persistent client not confirmed on the README. | — | Yes. | Apache-2.0 | Good | https://github.com/chroma-core/chroma |
| **n8n (self-hosted)** | Refresh-job scheduler. | Free. | **Low** for this use. The Sustainable Use License allows "internal business purposes or … non-commercial or personal use". You may not sell it as a hosted service. | — | Good (optional; cron + Python is simpler) | https://github.com/n8n-io/n8n/blob/master/LICENSE.md |
| Lovable (Free) | UI prototyping. | **5 build credits/day (≤30/month) + 20 Cloud credits/month.** Private projects and custom domain not stated. | Low. | — | Good for a demo UI | https://lovable.dev/pricing |

### 2.7 Free LLM APIs (optional fallback, extraction only)

| Option | Free limits (own page) | Do they train on free prompts? | Other terms | Tag | URL |
|---|---|---|---|---|---|
| **Gemini API (unpaid)** | The free tier exists for e.g. Gemini 3.x Flash / Flash-Lite and 2.5 Flash. Per-model RPM/RPD are **not verified**: the docs say to view them in AI Studio. | **Yes.** "Used to improve our products: Yes" (free) vs "No" (paid). Human reviewers "may read, annotate, and process" input and output. "Do not submit sensitive, confidential, or personal information." | **Must be 18+.** No apps aimed at under-18s. Available regions only. Terms effective 23 Mar 2026. | **Good**: only for public spec text, never user data | https://aistudio.google.com/docs/pricing, https://aistudio.google.com/docs/terms, https://aistudio.google.com/docs/rate-limits |
| **Groq** | Free-plan numbers **not verified**. The public table shows "Developer plan" base limits, e.g. gpt-oss-20b at 30 RPM / 1K RPD / 8K TPM. | Does not retain inference data by default. Troubleshooting logs are kept up to 30 days. Training on prompts is not stated. | Data held in US GCP. | **Better** (best privacy of the three) | https://console.groq.com/docs/rate-limits, https://console.groq.com/docs/your-data |
| **OpenRouter `:free` models** | **20 RPM. 50 RPD** (under 10 credits bought, all time). **1,000 RPD** after buying ≥10 credits. | Varies by provider. Free and paid models have separate training settings. Opting out of training stops routing to providers that train. | Check each endpoint's policy. | Good (turn on "no training" in settings) | https://openrouter.ai/docs/api-reference/limits, https://openrouter.ai/docs/guides/privacy/provider-logging |

---

## 3. Recommended free stack per workflow

| # | Workflow | Recommended stack | What goes stale | Refresh |
|---|---|---|---|---|
| 1 | **Second opinion** (name, pasted listing or photo → exact variant) | PaddleOCR → qwen3-vl:8b (JSON extraction) → deterministic match against the **local curated catalogue** (sqlite + sqlite-vec, bge-m3 + bge-reranker) keyed by brand model number (PSREF MTM, HP/Dell SKU). If there is no match: **live lookup** (Tavily → Jina Reader on an allow-listed brand domain), shown as "found on <url>, as of <date>, not yet verified". Never answer "no match" without trying the live lookup. | New SKUs each launch cycle. | Monthly catalogue diff, plus on demand when a lookup misses. |
| 2 | **Check the pitch** (specs, battery, "free onsite warranty", "40% off") | Specs: the brand spec page or PSREF (cited). Battery: Notebookcheck measured figure (≤100-word quote + link). Warranty type: the brand's warranty page for that SKU (manual, cited). "40% off": compare against MRP on the brand page + a PriceHistory.app link for the user to open. LapFit does not store prices it scraped. | Prices and offers change daily. Warranty bundles change each sale. | Live, with an "as of" stamp on every price. Warranty pages quarterly. |
| 3 | **Situation → verified shortlist** | Curated catalogue of 60–100 India SKUs. Hard attributes (hinge type, pen, panel, soldered RAM, ports, weight, India colours) are typed by hand from brand pages and PSREF, with a source URL and checked date per field. Unknown stays unknown and is never scored as good. Open Icecat is an optional pre-fill for HP. | Line-ups and stock (models discontinued). | Monthly availability check. Specs only change at refresh. |
| 4 | **Recent owner evidence** | 1) LapFit owner-submission form (dated, consented). 2) Notebookcheck lab facts. 3) Up to 3 linked YouTube videos via the official API (≤30-day cache, no aggregate scores). 4) The old Flipkart and Amazon reviews, labelled "older evidence (≤2023)". | Everything. | Owner form is continuous. YouTube cache is refreshed or deleted every 30 days (a policy requirement). |
| 5 | **Service-centre coverage** | data.gov.in pincode CSV → district (local). Then **deep-link** to the brand's official locator for that city or PIN (Dell, HP, ASUS). Optional: a hand-checked list of authorised centres for the top 10 cities, each marked "verified by phone/page on <date>". | Centre openings and closures. ASUS showed placeholder data. | Hand-checked list quarterly. Pincode CSV every 6 months. |
| 6 | **Price history / availability** | Flipkart Affiliate API **if approved** (the only sanctioned live feed). Otherwise Serper (2,500 free) or SerpAPI (250/month) Google Shopping query at request time, shown with "as of <time>" and a link, not stored. Price history = a link out to PriceHistory.app. | Prices daily, sales hourly. | Live per query. Never cache a price longer than one session. |

---

## 4. Hard limits (no free, legal source covers these well)

| Gap | Why | Honest workaround |
|---|---|---|
| **Live India prices and sale prices in bulk** | Flipkart and Amazon terms ban scraping. The Amazon API needs Associates sales (snippet). Flipkart API access is unverified. | Live per-query SERP lookup with an "as of" stamp, plus a link out. Show a price band from the brand site's MRP. Apply for Flipkart Affiliate now. |
| **Recent owner reviews at scale** | Flipkart and Amazon reviews: terms forbid it. Reddit: approval needed, AI use banned (snippet). YouTube: no derived metrics, 30-day storage cap. | Owner submissions, Notebookcheck lab facts, and a few linked videos. Say plainly: "We have N owner reports from 2026 for this model." |
| **Which variants and colours are actually sold in India** | Global spec sources (PSREF, Icecat) do not mark India availability. Brand India pages are partial. | Manually check brand India pages and the listing itself. Store `india_sold: verified/unknown` with a date. |
| **Structured service-centre data** | No brand offers a download. Locators are JS apps. ASUS data had placeholder entries. | Deep link + pincode → district + a small hand-verified list. Never claim "covered" without a dated check. |
| **Warranty type per listing** ("free onsite") | Depends on the seller and bundle. Not in any feed. | Treat it as a seller claim. Tell the user to verify on the brand's warranty-check page after purchase. Label it "unverified seller claim". |
| **Refurbished stock (Edify, Gameloot)** | No API or feed found. Edify: 12-month warranty (6 months Apple), 14-day returns. Gameloot listing: 6-month warranty. | Link to the seller and quote its stated warranty with a date. No stock claims. |

---

## 5. Effort to stand up a current catalogue of 60–100 India laptops

| Task | Effort (estimate) |
|---|---|
| Choose SKUs (top sellers by segment: LOQ, Victus, Snapdragon X, M4/M5 Air, convertibles, OLED) | 0.5 day |
| Schema with per-field `source_url`, `checked_on`, `confidence`, unknowns allowed | 0.5 day |
| Data entry, ~10–15 min per SKU from brand page / PSREF (+ LLM pre-fill from the page text, human check) | **15–25 h** for 80 SKUs |
| Second-person audit of a 20% sample (hinge, soldered RAM, ports, weight) | 4–6 h |
| Notebookcheck links and battery facts where reviewed | 4–6 h |
| Pincode CSV + brand locator deep links + top-10-city centre list | 4–6 h |
| Live-lookup path (Tavily/SearXNG + Jina + "as of" UI label) | 1–1.5 days |
| Monthly refresh (diff line-ups, re-check availability) | ~3–4 h/month |
| **Total to first usable version** | **~5–7 person-days** (spread across 2–3 people over one week) |
