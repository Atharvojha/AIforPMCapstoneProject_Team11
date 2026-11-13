# LapFit backend

Supabase (Postgres + Edge Function) backend for LapFit. Code decides every fact; the model only reads text and writes short wording.
Plan: `../build-plan/01_BACKEND_BUILD_PLAN.md`. Build log: `../build-plan/05_BACKEND_BUILD_LOG.md`. Operations: `../build-plan/06_OPERATIONS_RUNBOOK.md`. Diagrams: `../build-plan/04_ARCHITECTURE_DIAGRAMS.md`. Decisions: D-32 to D-46 in `../ai-spec/02_DECISIONS.md`.

## What is here
| Path | What |
|---|---|
| `supabase/migrations/` | Schema, SQL tools (`tool_*` functions), seed settings |
| `supabase/functions/_shared/` | Router, normaliser, ranking, flows (shortlist, second opinion + pitch check, used check), reasons writer, pre-send gate, Gemini client |
| `supabase/functions/query/` | Deno wrapper that exposes `handleQuery` as one HTTP endpoint |
| `scripts/import-existing.ts` | Copies the team's SQLite database into the schema |
| `tests/` | 209 tests on in-memory Postgres (PGlite) with a fake model and a fake live source; `npm run matrix` prints how each of 75 inputs is handled |

## Run
```
npm install
npm test                  # 178 tests, no network, no API key
npm run matrix            # shows the route and blocks for 75 different inputs
npm run import:test       # dry-run import, prints counts
node --import tsx scripts/import-existing.ts --database-url=postgres://...   # real Postgres
```

## What was verified and what was not
- **Verified (tests):** migrations apply on Postgres 17 (PGlite); import counts equal the source (3,987 reviews, 1,316 opinions, 14 prices); every Must holds on every shown laptop; a tampered card is dropped by the gate; Amazon text is never quoted; a verdict needs a named approver; prompt injection is reported and ignored; a lying model reason is replaced by code-written text.
- **Not verified:** the Gemini client (no API key available; written to the docs of 13 Nov 2026, with a switch to the older request shape), the Deno wrapper (no Deno or Supabase project here), RLS and `service_role` grants (PGlite has no roles), and latency. Test these first when a project exists.
- Newer Gemini models may ignore a custom temperature, so nothing relies on it; replies are checked in code and retried once.
- Data: all imported variants are `verified = false`, so in `data_mode = production` nothing is shown. The default `course` mode shows them labelled "Sample data". Use sample data only on Gemini's free tier, since Google may use free-tier inputs to improve its products.

## What it handles
Needs (budget, specs, Musts vs Shoulds, brand include or exclude, processor, graphics, OS), subjective words ("stylish", "durable", "fast": shown as stand-ins or owner-evidence lenses, never silently ignored), named laptops with typos, compare, owner voice, brand insights,
seller pitch checks, used listings, sell plan (sample factors), my-laptops warranty maths, buying for a parent, child or a team table (exact totals), market pulse, owner submissions (reviewed by a named person), follow-ups ("cheaper"), Hinglish/Telugu/Tamil,
and hostile or odd input (empty, gibberish, emoji, links, phone numbers and emails, other currencies, other countries, photos, injection, SQL, HTML, very long text, a broken database).

## Live reviews
Besides the recorded dataset, `live.ts` fetches what the web says now (Gemini with Google Search grounding), caches it for 24 hours, limits calls per day, and shows it separately: labelled live, unverified, linked to its source, never counted in the owner numbers and never used by the gate.
Only the laptop name and a topic are sent out, never the user's text. Retailer scraping and Reddit are deliberately not used (site terms; Reddit needs approval and a commercial agreement).
The Google call itself is untested without a key. Cost per Google's pricing page (checked 13 Nov 2026): about $14 per 1,000 search queries on Gemini 3 models after a monthly free allowance; verify before launch.

## Pictures, shop links and the answer receipt
`action: read_image` reads a picture with Gemini vision (validated in code, never stored or logged, own limits); `where_to_buy` and `outbound_click` build and count shop links (affiliate tags optional, never affecting results: proved by test); every answer carries a `provenance` block (the receipt) and the banner comes from `DATA_STATUS`. See `../build-plan/08_DATA_AND_SOURCES.md`, `09_MULTIMODAL.md`, `10_MONETIZATION.md`.

## Logging
Every request writes one row: what was asked (scrubbed), stage timings, where it failed (hard and soft), model attempts, live-search status. Read it with `npm run logs -- failures`, `-- stages`, `-- summary`, `-- slow`, `-- request <id>`, `-- search <words>`, `-- client`. Guide: `../build-plan/07_LOGGING_GUIDE.md`. The typed text is kept scrubbed for 30 days and can be switched off (`LOG_QUERY_TEXT`).

## Rate limiting
Runs first in the Edge Function, before any model or search call (`_shared/guard.ts`, `tool_rate_gate` in migration 08).
Per visitor (a salted daily hash of the network address, never stored raw): 10 requests a minute and 60 an hour are blocked with HTTP 429 and `Retry-After`.
Past 30 an hour the visitor is **degraded**: still answered, but by the rules reader with no model and no live search, and told so.
A global daily cap on paid model calls (1,500) degrades everyone instead of blocking. Bodies over 20,000 characters get HTTP 413. If the limiter itself fails, the service stays up in degraded mode.
Change the numbers without redeploying: `update settings set value = '{...}' where key = 'RATE_LIMITS'`. Tavily live calls are capped at 30 a day (`LIVE_DAILY_LIMIT`) to fit the free 1,000 credits a month.
Caveat: visitors behind one shared network address (a classroom, a demo room) share one limit. Raise `per_minute` and `per_hour` before a group demo.

## Not built yet
Embedding search (column exists, import supports `--embeddings`), reading photos, scheduled jobs, model-based triage of owner reports (rules only), persona and months filters on the dataset (the data has neither), real used-price data for the sell plan.
