# Operations runbook

How to set up, run, change and troubleshoot the LapFit backend. Written 13 Nov 2026 for the Supabase project `lapfit`. Background is in `05_BACKEND_BUILD_LOG.md`.

## 1. Where things live

| Thing | Where |
|---|---|
| Code | `lapfit-project/backend/` |
| Live project | Supabase project `lapfit` (reference `xgxsucbdaelqsyteipry`, region ap-northeast-2) |
| Endpoint | `https://<project-ref>.supabase.co/functions/v1/query` (POST, JSON). Needs the project's public anon key in the `Authorization: Bearer` and `apikey` headers |
| Secrets (server only) | Supabase secrets: `GEMINI_API_KEY`, `TAVILY_API_KEY`, `SESSION_SALT`. A local `backend/.env` holds the same keys for scripts on your machine; it is gitignored |
| Settings you can change | The `settings` table (section 5) |

The browser holds only the project URL and the public anon key. It never holds the Gemini, Tavily or service-role keys.

## 2. One-time setup (already done for `lapfit`)

1. Create the Supabase project (name `lapfit`, a region near your users, save the database password).
2. Install the CLI: `brew install supabase/tap/supabase`.
3. In a normal Terminal window (not through an assistant): `supabase login`. It opens a browser. It does not work without a real terminal.
4. In `backend/`: `supabase init` (once), then `supabase link --project-ref <ref>`.
5. Apply the migrations in order, all nine files in `supabase/migrations/`. With only your login (no database password):
   `supabase db query --remote --yes -f supabase/migrations/<file>.sql`
   Note: this does not record the migrations in Supabase's migration history. If you later use `supabase db push`, it may try to apply them again. With the database password you can use `supabase db push` instead.
6. Load the data: `node --import tsx scripts/import-existing.ts --via-cli` (about 80 seconds; clears and refills the imported tables, so it is safe to repeat).
7. Set secrets (section 3) and deploy (section 4).

## 3. Secrets

Never paste keys into chat, code or git. Two safe ways:

- **Dashboard:** project, Edge Functions, Secrets, Add new secret.
- **Terminal:** `read -s "K?Paste key: "; supabase secrets set GEMINI_API_KEY="$K"; unset K`.
- **From a local file:** `supabase secrets set --env-file <file> --yes` (the CLI asks for confirmation; it changes the production project).

| Secret | Needed for | If missing |
|---|---|---|
| `GEMINI_API_KEY` | The model reader and the reasons writer | The rules reader answers instead; no model wording |
| `TAVILY_API_KEY` | Live web reviews (preferred source) | Gemini grounding is tried if a Gemini key exists (needs a paid plan); otherwise live reviews show "not switched on" |
| `SESSION_SALT` | Hashing visitors for rate limits | A weak default is used; set a random value |
| Optional: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `ALLOWED_ORIGIN` | Model names (defaults `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`) and the allowed browser origin (default any) | Defaults |

Set `ALLOWED_ORIGIN` to the frontend's address before launch.

## 4. Deploying a code change

```
cd backend
npm test                                   # must be all green
npx tsc --noEmit -p .                      # must be clean
supabase functions deploy query --use-api --yes
```
The tests include a check that every setting the code reads exists in the database. A change to a migration file only takes effect once you apply it (`supabase db query --remote --yes -f <file>`). Add new migrations as new files; do not edit old ones that were already applied.

## 5. Settings you can change without redeploying

Change with SQL, for example:
`supabase db query --remote --yes "update settings set value = '12000' where key = 'ROUTER_TIMEOUT_MS'"`
The change applies to the next request.

| Key | Default | What it does |
|---|---|---|
| `data_mode` | `course` | `course` shows imported (unverified) laptops labelled "Sample data". `production` hides anything not verified by a person |
| `MIN_EVIDENCE_N` | 20 | Fewest owner opinions before a count or quote is shown |
| `ROUTER_CONFIDENCE_MIN` | 0.6 | Below this the reader asks one clarifying question |
| `ROUTER_TIMEOUT_MS` / `WRITER_TIMEOUT_MS` | 8000 / 3500 | Time limits for the reader and the reasons writer; each model attempt also gets 4 seconds |
| `SHORTLIST_FIRST` / `SHORTLIST_MAX` | 3 / 5 | Cards shown first, and cards in total |
| `WEIGHTS` | see table | Ranking weights: Should, Nice, price headroom, evidence |
| `QUOTE_MAX_WORDS` | 25 | Longest quote from review text |
| `REASON_MAX_WORDS` | 25 | Longest sentence the reasons writer may produce |
| `LIGHT_KG` | 1.5 | What "light" means |
| `BATTERY` | `{"note_below":80,"check_below":70}` | Used-laptop battery thresholds: a note below the first, a warning below the second |
| `WEIGHT_TOLERANCE_KG` | 0.05 | How close a claimed weight must be to count as matching |
| `LIVE_PER_QUERY` / `MAX_ALTERNATIVES` | 2 / 2 | Live searches per shortlist, and alternatives shown in a second opinion |
| `USED_PRICE_BAND` | 0.30 to 0.75 | Sample used-price range as a share of the new price (a sample, not data) |
| `RESALE` | sample table | Sample factors for the sell plan (labelled sample assumptions) |
| `LIVE_TTL_HOURS` | 24 | How long live results are reused |
| `LIVE_DAILY_LIMIT` | 30 | Live searches per day (Tavily free plan is about 33 a day) |
| `LIVE_MAX_ITEMS` / `LIVE_SNIPPET_WORDS` / `LIVE_TIMEOUT_MS` | 4 / 25 / 9000 | Live result size and time limit |
| `RATE_LIMITS` | see section 6 | Request limits |
| `SUBMIT_RATE_PER_HOUR` | 5 | Owner reports per visitor per hour |
| `IMAGE_LIMITS` | `{"per_hour":6,"global_daily":200,"max_bytes":700000,"max_b64_chars":950000}` | Picture limits per visitor and per day, and the largest picture |
| `RETAILERS` | Amazon.in, Flipkart, Croma search links, no tags | Shops for "Where to buy"; a non-empty `tag` makes that shop's link an affiliate link (see `10_MONETIZATION.md`) |
| `AFFILIATE_DISCLOSURE` | plain-language sentence | Shown whenever an affiliate link is shown |
| `DATA_STATUS` | set by `refresh_data_status()` | The honest data summary behind the banner; refresh after any data import |
| `LOG_QUERY_TEXT` | true | Keep the scrubbed typed text in the request log. Set `false` to stop storing it |
| `LOG_RETENTION_DAYS` | 30 | Days before log rows are deleted (also `select purge_logs();`) |
| `FEATURE_FLAGS` | all on | Kill switches: `router_enabled` (typed requests), `model_enabled` (Gemini), `reasons_enabled` (model-written sentences), `live_reviews`, `submissions_open` (owner reports). Set one to `false` to switch that part off |

Kill switch example, live reviews off:
`update settings set value = '{"live_reviews": false}' where key = 'FEATURE_FLAGS'` (merge with the other flags you want to keep).

## 6. Rate limiting: why, what, how to tune

**Why.** The endpoint is public: anyone holding the public anon key can call it, and every request can cost money (a Gemini call to read the text, another to write the reasons, a Tavily search). Without a limit, one script could spend the free quotas in minutes, exhaust the Tavily credits for the month, and slow the service for everyone. The limit is the cost and abuse control. It is not authentication.

**What it does** (runs before any paid work, in `guard.ts` and `tool_rate_gate`, one database call):

| Situation | Result |
|---|---|
| Body over 20,000 characters | HTTP 413, nothing else runs |
| More than 10 requests in a minute, or 60 in an hour, from one visitor | HTTP 429 with a `Retry-After` header and a plain message |
| More than 30 requests in an hour from one visitor | **Degraded**: still answered, by the rules reader, with no model and no live search, and the reply says so |
| More than 1,500 smart-reader requests in a day across all visitors | Everyone is degraded until the next day (not blocked) |
| The limiter's database call fails | Degraded (stays up, spends nothing) |

Design choices: a visitor is a salted hash of the network address and the day (the address is never stored); blocked requests still count so hammering gets no cheaper; degrading comes before blocking so a heavy but honest user still gets an answer.

**Tuning:**
```
update settings set value = '{"per_minute":10,"per_hour":60,"soft_per_hour":30,"global_daily_model":1500,"body_max_chars":20000}' where key = 'RATE_LIMITS';
```
Before a group demo or classroom use, raise `per_minute`, `per_hour` and `soft_per_hour`: everyone behind one shared network address shares one limit. Lower them if costs or abuse rise.

**Frontend duty.** Handle HTTP 429 by showing the message and waiting `Retry-After` seconds; handle 413 by asking for shorter text; show the `notice` blocks (they explain a degraded reply).

**Known limits of this design.** It limits by network address, so a determined user with many addresses is not stopped; shared addresses can be limited unfairly; the counters are fixed windows, so a short burst across a window boundary can briefly double. Real protection against abuse needs sign-in, which is not built.

## 7. Running and testing locally

```
cd backend
npm install
npm test                 # 209 tests, no network, no keys
npm run matrix           # shows how 75 different inputs are routed
node --import tsx scripts/import-existing.ts      # dry-run import into in-memory Postgres
```
Tests never call Gemini, Tavily or Supabase. To try the real services, call the deployed endpoint:
```
curl -X POST "https://<ref>.supabase.co/functions/v1/query" -H "Authorization: Bearer <anon key>" -H "apikey: <anon key>" -H "content-type: application/json" -d '{"text":"laptop for coding under 60k"}'
```
Every reply carries `router_mode` (`model`, `fallback`, `offline`, `form`), `router_error` when the model failed, and `timings` (router, flow, reasons, gate, total, in milliseconds).

## 8. Request formats

| Body | Does |
|---|---|
| `{"text": "..."}` | Read the text, answer |
| `{"text": "...", "prior_needs": <the needs from the last reply>}` | Follow-up ("cheaper", "only Lenovo") |
| `{"needs": {...}}` | Form input, no text reading |
| `{"owned": [{"name": "...", "purchase_date": "YYYY-MM-DD", "price_paid": 90000}]}` | Warranty and value for saved laptops (nothing stored) |
| `{"experience": {...}}` | Submit an owner report; returns a receipt code |
| `{"action": "report_status" \| "report_delete", "receipt": "..."}` | Check or delete a report |
| `{"action": "live_reviews", "variant_id": "FKL-10", "topic": "battery"}` | Live reviews for one laptop |
| `{"live": true}` added to a shortlist request | Also fetch live reviews for the top picks |
| `{"action": "catalog"}` | The list of laptops for pickers (no model) |
| `{"action": "data_status"}` | What data the product holds and how old it is (no model) |
| `{"action": "read_image", "image": {"mime": "image/jpeg", "data": "<base64>"}}` with header `x-lapfit-image: 1` | Read a picture (needs the model; 6 an hour per visitor) |
| `{"action": "where_to_buy", "variant_id": "FKL-10"}` | Shop links for a laptop (no model) |
| `{"action": "outbound_click", "retailer": "amazon_in", "variant_id": "FKL-10"}` | Count a shop-link click |
| `{"action": "compare", "variant_ids": ["FKL-10", "FKL-14"]}` | Compare two to four laptops by id (no model) |
| `{"action": "owner_voice", "variant_id": "FKL-10", "topic": "battery"}` | Owner opinions for one laptop (no model) |
| `{"action": "second_opinion", "variant_id": "FKL-14"}` | Card, owner evidence and cheaper alternatives for one laptop (no model) |
| `{"action": "sell_plan", "variant_id": "FKL-10", "sell": {"age_years": 2, "condition": "good", "battery_health_pct": 72}}` | Sell plan from a form |
| `{"action": "used_check", "variant_id": "FKL-10", "listing": {"price_inr": 40000, "battery_health_pct": 65, "has_bill": false}}` | Used-listing check from a form |

Replies are `{ok, flow, notice, footer, blocks: [...], ...}`. Each block has a `type` (cards, evidence, compare, notice, choices, live_reviews, team_plan, sell_plan, findings, checklist, claims and others). Block shapes are in the flow files.

## 9. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| `router_mode: "fallback"` and a `router_error` | The model was slow, over quota (429) or overloaded (503) | Read `router_error`; the answer is still valid (rules reader). If it persists check the Gemini quota and billing |
| Live reviews show `status: "error"` | Tavily key wrong or out of credits, or a timeout | The note carries a short reason; check the Tavily dashboard |
| Live reviews show `status: "limit"` | The daily live cap was reached | Wait a day or raise `LIVE_DAILY_LIMIT` (watch Tavily credits) |
| Live reviews show `status: "off"` | No source configured or the flag is off | Set `TAVILY_API_KEY` or turn on the flag |
| Every reply has the "simpler reader" notice | Visitor degraded, or the daily budget is spent, or the limiter failed | Check `rate_bucket` counts; raise limits if shared network |
| HTTP 401 from the endpoint | Missing or wrong anon key | Send both `Authorization` and `apikey` headers |
| HTTP 429 | Rate limited | Wait `Retry-After` seconds |
| `permission denied for function tool_...` when testing by hand | The tools are locked to the server role on purpose | Test through the endpoint, or use the admin role in `supabase db query` without `--read-only` |
| A new laptop is not shown | In `production` mode it must be verified; or it has no price | Check `variant.verified` and the price fact |
| Slow replies | Gemini latency | Read `timings`; the database part is about 1 to 2 seconds |

**Logs.** The full guide is `07_LOGGING_GUIDE.md`. Quick start, in `backend/`: `npm run logs -- failures 30` (what failed and where), `npm run logs -- request <id>` (everything about one request; every reply carries `request_id`), `npm run logs -- summary` (counts and timings). Browser-side failures show with `npm run logs -- client`.

Useful checks:
```
-- recent requests and outcomes
select ts, flow, outcome, router_mode, duration_ms from query_log order by ts desc limit 20;
-- gate drops
select * from gate_log order by ts desc limit 20;
-- rate counters
select * from rate_bucket order by window_start desc limit 20;
-- live search use today
select * from live_usage order by day desc;
```

## 10. Security model

- Row-level security is on for every table; the server uses the service role.
- Every `tool_*` function and `rate_hit` is executable only by the service role; the `anon` and `authenticated` roles have no table grants. Verified on the live project after migration 06.
- Column names in filters come only from the `filter_attribute` registry; operators are whitelisted; values are quoted. SQL and HTML in user text are plain text.
- The model never sees secrets and never decides a fact. Text in reviews, pages and pasted listings is treated as data, never instructions.
- Feedback or tool text asking an assistant to take actions is never executed.
- Still open: no user sign-in, so the public anon key gives access to the endpoint (limited by rate limits); `ALLOWED_ORIGIN` is open until set; the service-role key must never be shared.

## 11. The frontend
The web app lives in `frontend/` (see its README). It needs only the project URL and the public anon key. After deploying it, set `ALLOWED_ORIGIN` to its address. Deploy the backend after every backend change: the frontend's live check (`frontend` API client against the endpoint) caught a stale deployment once.

## 12. Before real users

1. Move Gemini to a paid plan (free-tier inputs may be used by Google) and check the quota.
2. Set `ALLOWED_ORIGIN` and review the rate limits for your audience.
3. Get a named person to verify the imported data, or keep `data_mode = course` with the "Sample data" label.
4. Confirm rights for quoting Flipkart review text (declared CC BY 4.0) and keep Amazon text internal.
5. Add a notice and consent text for the typed-text-to-Gemini flow, and review the owner-report notice and 18+ control with someone who can give legal advice.
6. Build the reviewer notification (D-42) so owner reports do not sit unseen.

## Deploying everything (14 Nov 2026)

1. **Database:** apply every migration in `backend/supabase/migrations/` in order to the project (`supabase db query --remote --yes -f <file>` from `backend/`, or `supabase db push`). Latest: 18 input log, 19 picture seed, 20 sell, market and launch fields.
2. **Secrets (names only, set once, never in the repo):** `GEMINI_API_KEY`, `TAVILY_API_KEY`, `SESSION_SALT`, and optionally `ANTHROPIC_API_KEY` (Claude, the backup reader after Gemini; `ANTHROPIC_MODEL` overrides the default `claude-haiku-5-5`) (the `SUPABASE_*` ones exist by default). Check with `supabase secrets list`. Set CORS to the app's address after hosting: `supabase secrets set ALLOWED_ORIGIN=https://<your-host>`.
3. **Function:** `supabase functions deploy query --use-api --yes`.
4. **Frontend:** `frontend/.env.local` (or the host's environment settings) holds only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, both public by design. `npm run build` makes `dist/`; any static host works (Vercel, Netlify, Cloudflare Pages). Routing uses `#/...`, so no rewrite rules are needed. `frontend/vercel.json` sets basic security headers. The bundle was scanned: no Gemini, Tavily or service-role key in it.
5. **Logs:** nothing to deploy: `query_log` and `input_log` fill on their own; read them with `npm run logs -- ...` in `backend/` (see 07_LOGGING_GUIDE.md); `export-all` saves a dated copy.
6. **Before real users:** paid Gemini plan (free-tier inputs may be used by the provider), legal review of the logging notice, raise the rate limit for a test room sharing one network, and tell testers what is saved.
