# LapFit project digest: data model, JTBD, prototype

Sources (all under `AIforPMCapstoneProject_Team11/lapfit-project/`): `data-model/DATA_MODEL.md`, `jtbd-analysis/JTBD_EXPANSION.md`, and `prototype/` (README.md, package.json, settings.js, supabase/schema.sql, server/*.js, scripts/*.js, tests/smoke.js, public/index.html, public/app.js skimmed).

---

## 1. Data model (`DATA_MODEL.md`)

**Status labels:** Built (a table in `prototype/server/db.js`, holding SAMPLE data), Needed (not built; a use case depends on it), Device (browser `localStorage` only).
**Privacy classes:** P0 public product facts; P1 approved community content with no identity; P2 anonymous behaviour; P3 personal or potentially identifying (typed text, uploaded photos, accounts, ownership and price paid).

**Core rule:** the model reads text or images into structured fields and writes short wording from facts it is given. Every fact shown (spec, price, ranking, verdict, rupee figure) comes from a stored row. If a value is not stored, it is not shown.

**Principles for every table:** fact tables carry `verified, verified_by, verified_at, is_sample`, and only rows that are verified or sample may be shown; a price is never shown without an as-of date; units are fixed (whole INR integers, GB with 1 TB = 1024, kg, inches, ISO 8601); counts travel with claims, and below n = 20 the app says "not enough evidence"; every row records its source; analytics never store typed words.

### Built tables
| Table | Class | Key fields / notes |
|---|---|---|
| `laptop_model` | P0 | id, brand (text, later FK), line, year, processor (free text), gpu, display_size, weight_kg, hinge_type (`clamshell`/`convertible_360`/`detachable`), ram_slots_or_soldered (a RAM upgrade is suggested only if it contains "free"), warranty, warranty_years, fact columns |
| `variant` | P0 | id, model_id, ram_gb, storage_gb, colours (JSON names), price_inr, price_as_of, availability (`in_stock`/`limited`) |
| `price_history` | P0 | variant_id, seller (text), price_inr, timestamp. Feeds price drops, buy timing, brand price chart, sell timing |
| `evidence_excerpt` | P1 | id (`E…` imported, `U…` approved owner submissions), laptop_id, topic (battery, keyboard, hinge, display, performance, heat_noise, service), text (max 300 chars for owner reports), source_name/url, date, reviewer_type (owner/reviewer), persona (gamer, student, developer, creator, parent, office), ownership_months, n_reports, rating 1–5 |
| `owner_submission` | P3 pending, P1 approved | laptop_id, persona, ownership_months, topic, rating, text, status (pending/approved/rejected), submitted_at, reviewed_by, reviewed_at, evidence_id. No name, email, phone or IP is stored; links, emails and phone numbers are rejected |
| `claim_ledger` | P1 | claim_text, scope (a laptop line or `general`), match_terms (comma list), verdict (shown only if an approver exists), sample_size, evidence_ids (JSON), approver (named person), date |
| `view_events` | P2 | ts, laptop_id, kind (`view` only today), is_sample |
| `demand_signal` | P2 | ts, budget_band (5 bands, Under ₹40,000 to ₹80,000 and above, plus "No budget given"), use_cases (≤3), musts (≤5 labels), matched (0 = unmet demand) |
| `query_log` | P2 | flow, confidence, language, router_mode (`model`, `offline`, `form`, `chips`, `filters`), duration_ms, outcome, text_len; no text |
| `unhandled_requests` | **P3** | text, guessed_flow, reason (`clarify`, `low_confidence`, `out_of_scope_laptop`, `not_laptop`, `tone:…`, `router_error:…`) |
| `gate_log` | P2 | laptop_id, variant_id, check_name (e.g. `must_failed`, `price_mismatch`, `reasons_replaced`, `owner_voice_mismatch`, `sell_plan_mismatch`), detail |
| `resale_action` | SAMPLE costs | ids `os_clean`, `gather_docs`, `clean_cosmetic`, `replace_battery`, `fix_keyboard`, `replace_screen`, `ram_upgrade`; cost_low/high |

Resale assumptions (age curve, condition factors, spread, ₹500 minimum net gain) live in `settings.js` as SAMPLE values. Sell inputs (`seller_info`, not stored): variant_id, months_owned, body (`like_new`/`good`/`scratched`/`damaged`), screen (`perfect`/`marks`/`cracked`), battery_pct, keyboard_ok, docs (`bill_box`/`bill`/`none`), warranty_months, os (`fresh`/`cluttered`), reason (`upgrade`, `need_money`, `not_using`, `issue`, `gift`, `other`), urgency (`quick`/`best_price`).

My laptops (Device): `localStorage` key `lapfit.garage` holding variant_id, bought_on, paid_inr. The list is sent to the server to compute the summary and is not stored there.

### Needed tables
- **Catalog:** `brand`, `model_generation` (successor, released_on), `variant_colour` (hex, image_id), `spec_detail` (touchscreen, backlit keyboard, ports, panel, battery Wh, charger W; these are reported as "cannot check yet" today), processor and GPU lookup tables.
- **Commerce:** `seller`, `offer` (live price per seller, the source for price_history), `affiliate_click` (session_hash, no identity), `conversion` (commission_inr).
- **Trust:** `reviewer`, `source` (licence, reliability), `import_batch` (undo an import), `claim_log` ("pitch fingerprints").
- **Used market:** `sell_plan_request`, `sale_outcome` (called "the most valuable seller-side data"), `used_listing`, `used_price_observation`, `repair_action`/`repair_quote`, `used_flag_stats`.
- **Accounts (opt-in only):** `account` (contact hashed or encrypted, consent_version), `garage_item` (serial_hash optional; report prompts at 1, 6 and 12 months), `price_alert`, `saved_search`, `consent_log`.
- **Model quality:** `model_call_log` (no user text), `eval_case` (golden dataset), `eval_run`, `settings_version`.
- **From JTBD (section 16):** `symptom_report`, `service_centre`/`service_visit`, `shared_list`/`shared_list_member`, `organisation`/`org_member`/`org_asset`, `part_compatibility`, `seller_score`, `alert`, `event_calendar`.

### Sources and how each is obtained
Manual checks and CSV import feed the catalog (`npm run import`); retailer prices feed prices (the prototype has no scraping, and the Needed `offer` table plus a daily job would supply them); owners submit reports and My laptops entries; reviewers approve; buyer searches, checks and compares produce demand and activity; sellers use the Sell form and paste used listings; pasted text and photos are read by the model into fields and then verified in code. Collection order (§15): verified catalog, dated prices from a few sellers, licensed images, a seed of owner reports "from sources you have permission to use", real used prices and repair quotes, sale outcomes, accounts last.

### Images
The prototype shows a placeholder icon for every laptop and CSS colour guesses. Uploaded photos are resized on the device (1280 px long side, JPEG quality 0.82), sent to the model to read, and **not stored**. Needed: `model_image` (kind hero/open/side/ports/keyboard/underside/swatch/box, storage_key, alt_text required, licence `owned`/`licensed`/`press_kit`/`creative_commons`/`unknown`, sha256, perceptual_hash; unverified or unlicensed images are never shown) and `media_upload` (purpose pitch/used_listing/battery_report/serial_sticker/condition/owner_report/sell_listing, private bucket, exif_stripped, consent_id, extracted JSON with source region and confidence, extraction_verified, pii_flags, moderation_status, retention_until). The 7-step pipeline is receive, clean (strip EXIF, sha256), read, verify in code against the catalog, protect (blur serials and faces), retain, show. Appendix A gives Postgres DDL for `model_image`, `variant_colour` and `media_upload`.

### Privacy, retention, consent
| Data | Keep for |
|---|---|
| P0 catalog, prices, images | Indefinitely (licence per image and per price source) |
| P1 approved reports, verdicts | Indefinitely; delete on request via submission id |
| P2 events, demand, query, gate logs | 24 months, then aggregate |
| `unhandled_requests.text` (P3) | 90 days; **gap:** it stores typed text today and needs scrubbing of phone numbers, emails and names |
| Pending `owner_submission` | Until reviewed; 30 days if rejected |
| `media_upload` raw files | 30 days (set per purpose) |
| My laptops | On the device; **gap:** moving it to an account needs consent and encryption |
| Accounts and alerts | While the account exists |

Consent is handled by `consent_log` and `media_upload.consent_id`, both Needed. **Freshness:** prices always carry an as-of date; trend windows are 7, 30 or 90 days; a rising complaint is a report rated 3.0 or lower, with at least 5 recent reports and more than in the previous window. Sample dates are relative to the seed day.

---

## 2. JTBD (`JTBD_EXPANSION.md`)

Tags: [F] fact, [A] assumption, [H] hypothesis. **All scores are hypotheses; no user research was done.**

**Core job:** "When I am about to spend a large part of my budget on a laptop, and everyone advising me has an angle, I want to check independently whether a specific laptop fits my needs and whether what I have been told is true, so I can buy once, at a fair price, and not regret it."
- **Functional:** choose a laptop that fits needs and budget, and verify the claims made about it.
- **Emotional:** feel confident, not fooled; less fear of being cheated and less regret.
- **Social:** look informed in front of the shopkeeper; justify the choice to a spouse, parent, manager or finance team; show care when buying for someone.
- **Alternatives:** shopkeeper, a friend who knows computers, YouTube, Reddit and WhatsApp, Amazon and Flipkart reviews, Smartprix and 91mobiles, general chatbots.

**Segments S1–S11:** first-time buyers or students and their parents; performance seekers; working professionals; people buying for others; used and refurbished buyers; sellers and upgraders; current owners; SMBs and colleges; brands, retailers and refurbishers; reviewers and creators; lenders and EMI partners.

**Jobs J1–J71** in 16 categories. Built: J1 shortlist, J2 second opinion, J3 claim check, J4 used check, J5 owner voice, J6 compare, J8 buy for others, J9 sell, J27, J30–32, J34, J35, J38, J39, J43, J48. Unmet or underserved: J66 in-shop claim check, J67 true used value, J68 durability after 6–12 months, J69 variant confusion, J70 service experience, J71 total cost of ownership.

**Hidden assets (asset → insight):** variant-level catalog (variant confusion); dated price history (sale reality, used anchor); owner reports by persona, months and n (durability curve); claim ledger (habitually misleading claims); demand signals (unmet demand); views; used checks; sell inputs and outcomes; My laptops (install base); `unhandled_requests` ("the most underrated asset", a free list of downstream jobs); `query_log.language` (Hinglish, Telugu, Tamil); repair costs; `gate_log`; the approver network; conversion data.

**Use cases U1–U22**, including: U1 parent in a shop told "32 GB RAM, full-day battery"; U2 student with ₹45,000; U3 gamer worried about heat; U6 founder equipping 12 staff; U9 battery drain ("is this normal?"); U11 festive-sale discount; U12 got 8 GB instead of 16 GB; U21 upgrade with a free slot; U22 safe handover when selling.

**Opportunity scoring** (1–5 each: Frequency, Importance, Unmet, Fit, Capability, Differentiation, Business, Feasibility; total out of 40):

| ID | Opportunity | F | I | U | Fit | Cap | D | B | Fe | Total | Class |
|---|---|---|---|---|---|---|---|---|---|---|---|
| O1 | Seller-pitch reality check | 4 | 5 | 5 | 5 | 5 | 4 | 3 | 4 | 35 | High |
| O2 | Owner voice by persona and months | 4 | 4 | 5 | 5 | 4 | 5 | 4 | 3 | 34 | High |
| O3 | Needs-based shortlist | 5 | 4 | 3 | 5 | 5 | 2 | 4 | 5 | 33 | High (table stakes) |
| O9 | Unmet-demand intel for brands | 3 | 4 | 4 | 3 | 5 | 5 | 5 | 3 | 32 | Strategic adjacent |
| O7 | In-shop negotiation helper | 3 | 4 | 4 | 5 | 4 | 4 | 3 | 4 | 31 | High |
| O6 | "Is this normal?" | 3 | 4 | 5 | 4 | 4 | 4 | 3 | 3 | 30 | High |
| O5 | Price alerts and buy timing | 4 | 4 | 3 | 4 | 4 | 3 | 4 | 4 | 30 | High |
| O4 | Sell plan and resale advisor | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 30 | Strategic adjacent |
| O8 | Verified used marketplace | 3 | 4 | 4 | 3 | 3 | 4 | 5 | 2 | 28 | Strategic adjacent |
| O18 | Festive-sale price check | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 4 | 28 | Strategic adjacent |
| O10 | Upgrade or replace | 2 | 3 | 4 | 4 | 4 | 4 | 2 | 4 | 27 | Strategic adjacent |
| O11 | Warranty and service companion | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 3 | 27 | Strategic adjacent |
| O13 | SMB and college procurement | 2 | 5 | 3 | 3 | 3 | 3 | 5 | 3 | 27 | Strategic adjacent |
| O12 | Shared shortlist | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 27 | Experimental |
| O16 | Verified-seller score | 3 | 4 | 4 | 3 | 3 | 4 | 4 | 2 | 27 | Experimental |
| O17 | Photo-first tools | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 26 | Experimental |
| O19 | Creator data feed | 2 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 25 | Experimental |
| O15 | EMI and lender data | 3 | 3 | 3 | 2 | 3 | 3 | 5 | 2 | 24 | Experimental |
| O14 | Rent vs buy | 2 | 3 | 3 | 2 | 3 | 3 | 4 | 2 | 22 | Experimental |
| O20 | Explainers and glossary | 4 | 3 | 3 | 4 | 3 | 2 | 2 | 5 | 26 | Low |
| O21 | E-waste routing | 1 | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 17 | Low |

The class is driven by need, fit and differentiation; feasibility alone never decides it.

**Prioritised top 10 (O3 excluded as table stakes):** 1 O1 pitch check (first experiment: 10 real pitches with wrong specs, compared against a general chatbot); 2 O2 owner voice (seed 200 permitted real reports); 3 O7 negotiation helper; 4 O6 "is this normal?"; 5 O5 and O18 alerts and festive check (100 users); 6 O4 sell plan on real data (50 sale outcomes); 7 O9 brand intelligence (3 contacts); 8 O8 used marketplace (manual pilot, 30 listings); 9 O10 upgrade or replace; 10 O13 procurement (5 interviews). Twelve research assumptions follow, e.g. that n = 20 per laptop and topic is reachable, and that the neutral wording "does not match the specs" is accepted.

---

## 3. Prototype (`prototype/`)

### Stack and how to run it
- Node (ES modules) with the plain `node:http` server in `server/index.js`, port `PORT` or 3000. Dependencies are only `better-sqlite3` ^11.5.0 and `zod` ^3.23.8. Front end is vanilla JS (`public/app.js`, hash router), with `index.html` and `style.css`.
- SQLite at `data/lapfit.db` (`LAPFIT_DB` overrides it; tests use `:memory:`), WAL mode. `supabase/schema.sql` is the Postgres mirror with RLS for the service role only.
- Scripts: `npm start`; `npm run dev:offline` (`LAPFIT_OFFLINE_ROUTER=1`); `npm run seed` (`scripts/reset-db.js` deletes `data/lapfit.db*` and re-seeds); `npm run import -- <table> <file.csv> [--verified-by "Name"]`; `npm test`.
- **Three modes:**
  - **Claude API:** `ANTHROPIC_API_KEY` set; `server/model.js` calls the Messages API directly (`anthropic-version: 2023-06-01`; `ANTHROPIC_BASE_URL` can override the endpoint). The model is `SETTINGS.MODEL = process.env.LAPFIT_MODEL || 'claude-haiku-5-5'`, used for both the router and the reasons. Images are accepted as png/jpeg/webp/gif.
  - **Offline:** no key and `LAPFIT_OFFLINE_ROUTER=1`; `server/offline-router.js` is a regex stand-in that cannot read photos.
  - **Neither:** every typed request returns the rules-only form block, which is also the fallback for a model error or a timeout over 8 s.
- `/admin` holds the owner-report queue, unhandled requests (last 200), gate drops (100) and queries (50). With `ADMIN_TOKEN` set it needs `?token=`; otherwise it is open to localhost only.

### Nine screens (hash routes in `VIEWS`)
Bottom tabs: **Home** (`#/home`: ask box, examples, photo button, 6-step journey, "This month" pulse from `/api/home`), **Find** (budget slider ₹20k–₹150k, use pills, RAM, storage, weight and type Musts, colour as a nice-to-have; posts `needs`), **Check** (Seller pitch or Used listing toggle; posts `forceFlow`), **Owners** (owner-voice filter bar plus the "Add my experience" form), **Sell** (11-field form or "Use my words"), **Mine** (My laptops in `localStorage`, `/api/garage`). Top links: **Market** (`trending` 30 days), **For brands** (`#/insights`: persona × topic matrix, price chart, checks per week, `/api/demand` unmet demand), **How it works** (`#/vision`: data and revenue tables with Built, Prototype and Concept labels). There is also a compare drawer for 2–4 cards.

API: `POST /api/query`, `GET /api/config`, `/api/home`, `/api/demand`, `/api/insights?laptop=`, `POST /api/garage`, `GET /api/catalog`, `POST /api/submit-report`, `GET /admin`, `POST /admin/review`.

### Eight flows
`second_opinion`, `check_pitch`, `shortlist`, `used_check`, `buy_for_others` (in `flows.js`), `owner_voice`, `trending` (`flows.js`, using the engine), and `sell_laptop` (`sell.js`). The router can also return `clarify`, `out_of_scope_laptop` and `not_laptop`.

### Routing: picked by the user or detected
It is hybrid (`handler.js` `handle()`):
- **User-picked, no router call:** `rulesForm` (form), `sellerForm` (Sell form), `ownerFilters` (Owners bar), `trending` (Market), `needs` (Find chips). These are logged as router_mode `form`, `filters` or `chips`.
- **User-picked with router extraction:** Check and Sell "Use my words" send text plus `forceFlow`. The router still reads the fields, then `router.flow` is overwritten and confidence is set to 1. Offer buttons with `flow` call `ctx.forceFlow`.
- **Detected:** free text on Home goes to `routeRequest()`, either one Claude call (temperature 0, zod `RouterSchema`, 1 retry, 8 s abort) or `offlineRoute()` regex. If confidence < 0.6 or the flow is `clarify`, a choices block with up to 4 options is shown. A non-normal tone gets a calm reply. A mixed request sets `followup_flow`, which becomes an offer. A link-only message returns "I cannot open links". `findInjections()` regexes are merged into `ignored_instructions`.

### What the pre-send gate checks (`server/gate.js`)
It runs after the reasons are written and before anything is sent; the model never sees it. Failures are written to `gate_log`.
- **Cards:** the variant exists and is showable and the model id matches; each Must is true (`requireAll`); each shown tick equals `evalCriterion`; price_inr and price_text equal the row; price_as_of is present and matches; weight, display, RAM, storage, hinge, year, processor and GPU equal the row; rating value and n match `ratingFor`; every number in the reasons is in `allowedNumbers` with no "!" and ≤40 words. If the reasons fail, template reasons replace them (`reasons_replaced`); otherwise the card is dropped. If the main second-opinion card fails, the whole answer becomes `NO_MATCH`.
- **Team:** failing cards are nulled and the totals recomputed.
- **Claims:** a `verdict` row must re-match a ledger row with an approver, the same verdict text and the same sample_size, or it is downgraded to "Not checked yet". Supported and contradicts spec rows are re-evaluated, or set to "Not in catalog".
- **Evidence topics:** n and `enough` must match.
- **Owner voice, trending, sell plan:** fully recomputed (`queryEvidence`, `computeTrending`, `computeSellPlan`) and compared as JSON; if they differ, the block is replaced with `NO_MATCH`.

### Rules versus LLM
- **LLM (2 calls):** `route-request.js` reads input into JSON (flow, needs, mentions, claims split and typed, seller_info, owner_filters, language, tone); `reasons.js` writes 2–3 reasons per card from `fact_lines` at temperature 0.2 in the user's language, otherwise `templateReasons`.
- **Code:** everything else. That covers SQL per Must (`queryVariants`/`whereFor`), ranking (`rank`, `useScore`, rating bonus only when n ≥ 20), relax options, nearest colour, spec-claim parsing (`parseSpecClaim`, `evalSpecClaim`, weight tolerance 0.05 kg), ledger lookup by `match_terms` (claim verdicts are never LLM output), used flags (RAM above the max, impossible combination, weight, Windows 10 end of support 2025-10-14, used band 30–75% of the new price, missing battery health and serial), the team table parser, owner-voice counts, trending, and the sell plan (age curve, factors, a fix is "do" only if net ≥ ₹500, RAM upgrade only with a free slot and a catalog variant with more RAM). Submissions go through zod validation plus a PII regex and a limit of 5 per hour per IP.

### Seed data
It is **fictional** ("SampleBrand", Sample Laptop A–H, SampleChip S3–S9, "SampleOwners Forum", "SampleReviews Blog", example.com URLs), and the banner "SAMPLE DATA, not real laptops" appears on every result. The seed has 8 models, 13 variants, 4 price points per variant (SampleStore One and Two, 100, 50, 20 and 3 days ago), and 35 evidence rows representing 445 owner/reviewer reports (`n_reports` sum). It also has 3 ledger claims (L1 and L2 approved by "Sample Reviewer 1" and "Sample Reviewer 2"; L3 "Never gets hot" not approved), 7 resale actions, 164 recent and 128 prior view events, and 209 demand signals across 12 patterns. Dates are relative to the seed day. The Flipkart, PCBox and Amazon datasets mentioned in the parent CLAUDE.md are not used here.

### Tests (`tests/smoke.js`)
About 70 assertions using the offline reader and an in-memory database, with no API key. They cover: a shortlist that meets every Must, the budget and 16 GB; no "!"; relax offers; second-opinion crosses and evidence counts; n < 20 shown with no excerpts; variant disambiguation; not-in-catalog handling; claim statuses (contradicts, verdict, cant_check, not_checked) with no "lying" wording; used flags (≥3) with no buy verdict; out of scope; not a laptop; clarify; prompt injection; abusive tone; links; buy-for-others questions; the team table; the rules form; mixed-request follow-up; owner-voice filters and loosen offers; trending lists and the window switch; views feeding most-checked (a lenient assertion); submission accept and reject, with approval counted once; the gate dropping a tampered owner-voice count; the sell plan (ordered range, verdict versus net, unknowns, quick focus, reason note, form round trip, free steps, RAM upgrade, the gate accepting a clean plan and rejecting a changed figure, unknown laptop returning tips with no ₹). Not covered: the live model path, model-written reasons, photos, admin HTTP.

### Known gaps and TODOs
There are no `TODO`/`FIXME` markers. Gaps found in the docs and code:
- README says `cd lapfit` and `cp .env.example .env`, but neither the folder name nor `.env.example` exists.
- `supabase/schema.sql` lacks `owner_submission`, `view_events`, `demand_signal`, `resale_action` and the `persona` column.
- Comments and admin text still say "five flows".
- `logDemand` always writes `is_sample = 1`.
- `unhandled_requests` stores raw text with no scrubbing or retention.
- The rate limit is kept in memory.
- The admin token is passed in the query string.
- UI text is English only.
- No accounts, real affiliate links, price scraping, product images, link fetching or translated UI.
- The offline reader cannot read photos.
- Resale factors and repair costs are sample values.
- Specs like touchscreen and ports cannot be checked.
- Processor and GPU are free text.
- `import-csv.js` covers only 5 tables.
- No eval set or model-call logging exists yet (`eval_case` is Needed).

---

## Points that may conflict with other plans
- **Stack:** Node, plain http, SQLite (`better-sqlite3`) and vanilla JS, with an optional Supabase/Postgres schema that is incomplete. The `prototype_prathyusha` CLAUDE.md lists Python ≥3.11, Ollama and "no Postgres/Docker yet". The README also says the app was "built outside Lovable".
- **Data sources and terms:** all data is fictional. Real data is to come by CSV import with `--verified-by`, and owner reports through a human-approved queue "from sources you have permission to use". Price scraping is listed as not built, while the data model plans retailer price feeds, licensed images and "scraped prices need permission". Other plans use Flipkart, PCBox and Amazon'23 datasets and ban bulk LaptopMedia, Reddit and YouTube scraping. The JTBD names Amazon/Flipkart reviews, Reddit and YouTube as alternatives, not as sources.
- **Model choice:** the prototype hard-defaults to the paid Anthropic API (`claude-haiku-5-5`, overridable with `LAPFIT_MODEL`) and has no Ollama or sentence-transformers path. This conflicts with the "free/open models only (Ollama llama3.1 8B)" rule in `prototype_prathyusha/CLAUDE.md`.
- **Human approval of verdicts:** non-spec claim verdicts appear only from `claim_ledger` rows with a named approver, and owner reports need admin approval. Spec claims ("Matches the catalog" or "Does not match the specs"), used-listing flags, rankings and sell plans are decided by code with no human sign-off. Unapproved claims show "Not checked yet" even when evidence exists.
- **Mode picking:** hybrid. Screens (Find, Check toggle, Owners, Sell, Market) pick the flow through `forceFlow` or structured bodies, while Home's free-text box auto-detects the flow with the LLM router (or regex offline), using a 0.6 confidence threshold and clarify choices. The README calls the Home text box "a shortcut, not the product".
