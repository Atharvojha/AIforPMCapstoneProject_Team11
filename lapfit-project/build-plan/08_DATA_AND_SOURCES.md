# What data LapFit really holds, how fresh it is, and where it is used

Written 13 Nov 2026. This answers: *why did the app say "course project / sample data"? Is everything real and real-time? Where are the dataset reviews used?* Facts below were read from the live database on 13 Nov 2026.

## 1. The short answer

Not everything is real-time. **Only the web reviews are live.** Everything else is a saved snapshot.

| Part of an answer | What it really is | Fresh? |
|---|---|---|
| **Prices** (14 laptops with an Indian price) | Recorded once from Flipkart listings on **10 Nov 2026** | **Saved snapshot, not live.** A price can already differ in the shop |
| **Specs** (29 laptop versions) | Imported listing data | Saved. **0 of 29 have been verified by a person** |
| **Owner opinions** (1,316) | Read by a machine (an AI model) from **3,987 dataset reviews**: 3,300 Flipkart India and 687 Amazon US | Saved. **No review carries a date**, so recency is unknown |
| **Web reviews** | Fetched when you ask, through Tavily web search | **Live**, cached up to 24 hours, never verified |
| **Owner reports** | Written by users on LapFit, approved by a named person | None exist yet |

So the old banner ("Course project: sample data") was a blunt way of saying this. It is replaced by an exact line, built from the database each time:

> *Prices are a saved snapshot from 10 Nov 2026, not live. Specs are imported listing data that no person has checked yet. Web reviews are fetched live when you ask.*

If `data_mode` is `production` the banner is empty; if a person has verified some specs, the second sentence changes. The line comes from the setting `DATA_STATUS` (refreshed by `select refresh_data_status()`, which the import script calls), so it cannot drift from the data.

## 2. Where the dataset reviews are used

The 1,316 machine-read opinions (from the 3,987 reviews) feed these things. Counts always remove duplicate reviews (458 duplicate clusters) and show `n`.

| Where | How the dataset is used | Code |
|---|---|---|
| **Every laptop card** | "N owner opinions" chip, the evidence ring, and "101 of 196 positive" when n is at least 20; "Collecting owner voices: n of 20" when not | `tool_evidence_summary`, `cards.ts` |
| **Ranking** | A small weight for the positive share, only when n is at least 20 | `rank.ts` |
| **What owners say** | Opinions by topic (battery, heat, keyboard, display, performance, build, service), with verbatim quotes of up to 25 words only from sources that allow quoting (Flipkart yes; Amazon never) | `tool_evidence_quotes`, `flows/owner.ts` |
| **Compare** | An owner-opinions row per laptop | `flows/compare.ts` |
| **Second opinion, seller claims** | Owner evidence on a topic next to a performance claim ("battery lasts 2 days") as context, never as a verdict | `flows/pitch.ts` |
| **Stand-ins for words not in the catalog** | "Stylish" counts owners who praised the looks (keyword match in review text); "good battery" and "durable" use the battery and build opinions | `lens.ts`, `tool_term_mentions` |
| **Brand insights, market pulse** | Positive and negative counts per brand; most-reviewed laptops | `tool_brand_stats`, `flows/market.ts` |
| **The answer receipt** | States how many dataset opinions fed the answer | `provenance.ts` |

Where the dataset is **not** used: prices, specs, filters and Musts (those come from the catalog), the pre-send check, shop links, and the live web results.

Limits that matter: the reviews are mostly short and written in the first week; two sources only; none carries a date, a user type or months owned, so "what do students say after six months" cannot be answered, and the product says so. Amazon reviews are research-only: they are counted but never quoted. Licence: Flipkart reviews are declared CC BY 4.0 on the Zenodo record (short attributed excerpts); the Amazon 2023 dataset has no licence, so it stays internal.

## 3. How every answer shows its sources

Each answer ends with a collapsible **receipt** ("How I built this answer"), built from the reply itself so it cannot claim a source the answer did not use: the catalog snapshot date, the number of dataset opinions, any live web excerpts with their provider and time, which AI parts ran (reader, wording), that every price and spec was re-checked before display, and whether shop links are affiliate links. Each price also carries a freshness chip ("as of 10 Nov 2026 · 3 days old"), green within a week, amber within a month, red beyond.

## 4. If you want real-time prices

This is not built. It needs a data source with rights, not scraping.

| Option | What it needs | Notes |
|---|---|---|
| Retailer affiliate or product APIs and feeds | An approved affiliate account (Amazon Associates India, Flipkart Affiliate) | Terms usually restrict how prices may be shown and how stale they may be (not verified here; read them first). Also unlocks real product links |
| Scheduled refresh job | Supabase Cron plus an Edge Function; the schema already has `price_history` | Each laptop would then have more than one price, so price drops and history become real |
| A person verifying specs | A named reviewer using the existing `variant.verified` and `variant_curation.verified` flags | Switching `data_mode` to `production` hides anything unverified |
| Web search for a current price | Tavily or similar | Snippets are unreliable for prices; treat as a hint, never a stored fact |

Until then, the honest line stays: prices are a snapshot, with their date.

## Laptop pictures (added 13 Nov 2026)

Table `laptop_image` (variant, https URL, source site, description, `licence_status = unverified_web`, `rejected`). 42 rows for 14 variants, from Tavily image search, filtered by description match and a real image content-type check. They are shown only as pictures with attribution; no fact comes from them. Re-run with `node --env-file=.env --import tsx scripts/fetch-images.ts --via-cli [--dry]` (about 14 search credits). Replace with licensed images before launch.

## Web-wide market and brand context (added 13 Nov 2026)

Market pulse and Brand insights show two separate things: **dataset counts** (reviews and prices stored in the app) and a **web panel** (what the wider web says now). The web panel comes from Tavily search, one search per topic, cached 24 hours and counted against `LIVE_DAILY_LIMIT`.

- **Market:** news search, last month, limited to a list of Indian business and gadget press plus a few global tech sites (`MARKET_SITES` in `live.ts`); the text must be about laptops and India. A real check returned 2 usable articles (Economic Times, Times of India), so the panel is often short; that is shown as is.
- **Brand:** general search, last year, with social media, the brand's own website and shop pages removed; the text must name the brand and talk about experience (reliability, service, build, warranty). A real check kept 5 of 8; the quality is mixed (blogs and review sites), which is why it is labelled "not verified".
- **Never:** counted in n, ranked, used to decide a card, or sent the user's words. Only a fixed phrase and a brand name leave the system.
- **Off switches:** `FEATURE_FLAGS.web_insights = false`, or `live_reviews = false` (which also turns off live laptop reviews).
- **Cost:** a market view costs at most 1 search per day (cached), a brand view at most 1 per brand per day.
- **Known limits:** snippets are search-engine excerpts, not summaries and not checked for truth; paid or sponsored articles may appear; the site list is a judgement and should be reviewed.
