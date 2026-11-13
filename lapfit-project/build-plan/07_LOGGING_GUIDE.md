# Logging guide: what is recorded, and where things fail

Written 13 Nov 2026. How to find out what people asked, what the system did, and **exactly where it went wrong**. Decisions D-52 to D-55 in `../ai-spec/02_DECISIONS.md`; code in `backend/supabase/functions/_shared/handler.ts`, `backend/supabase/migrations/20261113000010_logging.sql`, and `backend/scripts/logs.ts`.

## 1. Why this was added

Before, every request wrote one thin row (flow, outcome, time). Of the first 44 requests on the live project, all were marked "ok" or "empty", even though several had really **failed softly**: Gemini timed out and the rules reader answered, the reasons writer fell back to template text, or the live search returned an error. A log that says "ok" for those hides the problems you most need to see. Now every request records each stage, every failure (hard or soft), and the model attempts behind it.

## 2. What is recorded for each request (table `query_log`)

| Column | Meaning |
|---|---|
| `ts`, `request_id` | When, and the id. **Every reply carries `request_id`**, so a user or tester can quote it |
| `input_kind` | `text`, `needs` (the form), `action:compare`, `action:read_image` (a picture: only its size, type and what kind it was are kept, never the picture) and the other direct actions, `owned`, `experience`, `client` (a browser-reported failure), `limit` (rate limited), `oversized`, `wrapper` |
| `flow`, `language`, `router_mode` | What the request was read as; `router_mode` is `model`, `fallback` (smart reader failed), `offline` (no key), or `form` |
| `outcome` | `ok`, `no_match`, `clarify`, `not_laptop`, `out_of_scope`, `abusive`, `distressed`, `gate_dropped`, `error`, `rate_limited`, `too_large`, `client_<kind>` |
| `status` | The HTTP status the caller got (200, 400, 413, 429, 500) |
| `text_scrubbed`, `text_len` | What was typed, with phone numbers, emails, ID numbers and links removed, cut to 300 characters; and its length. Empty when the text log is switched off |
| `timings` | `router_ms`, `flow_ms`, `reasons_ms`, `gate_ms`, `total_ms` |
| `blocks` | The block types in the reply (for example `notice, understood, cards`) |
| `error_stage`, `error_message` | Where a **hard** failure happened, and its message |
| `detail` | `failures[]` (soft failures), `model_attempts[]`, `reasons_mode`, `matched`, `gate_dropped`, `flow_corrected`, `backfilled`, `degraded`, `ignored` |
| `visitor` | A salted daily hash, never an address |

## 3. Where a request can fail

The handler tracks the stage it is in, so a crash says where it happened.

| Stage | Meaning |
|---|---|
| `wrapper` / `parse` | Before the handler: the Edge Function crashed, or the body was not valid JSON (HTTP 400/500) |
| `guard` | The body was too large (HTTP 413) |
| `rate_gate` | Rate limited (HTTP 429), logged once at the first blocked request |
| `clean`, `router` | Cleaning the text; reading it (model or rules) |
| `action:<name>` | A direct action by laptop id (compare, owner_voice, …) |
| `flow:<name>` | The flow itself (database lookups, ranking) |
| `reasons` | The wording step |
| `gate` | The pre-send re-check |
| a screen name (`ask`, `find`, …) | A failure the **browser** saw, reported by the app |

**Hard failures** (the request threw) set `outcome = error`, `error_stage` and `error_message`. The user still gets a calm reply and the row exists.

**Soft failures** (handled, but worth knowing) are listed in `detail.failures` with `stage`, `kind` and `message`:

| stage / kind | What happened | What the user got |
|---|---|---|
| `router` / `fallback` | The smart reader failed or timed out | The rules reader answered, with a notice |
| `model` / `attempt_failed` | One Gemini attempt failed (message holds the model and reason, for example `attempt_timeout`, `model_http_429`, `model_http_503`) | The fallback model, or the rules reader |
| `reasons` / `template_fallback` | The wording model failed or timed out | Plain, code-written reasons |
| `live` / `error` or `limit` | The live search failed, or the daily cap was reached | The dataset only, with a notice |
| `gate` / `dropped` | Cards disagreed with the stored facts after wording | Those cards were removed (details in `gate_log`) |

`detail.model_attempts` lists each Gemini attempt with its model, time in ms, success and error, so slow or flaky models show up with numbers.

## 4. Reading the log

From your machine, through your Supabase CLI login (read-only, no database password). Run in `backend/`:

```
npm run logs -- recent 30        the last requests
npm run logs -- failures 30      failed or fallen-back requests, with the stage and reason
npm run logs -- stages           which stage fails most, and how often
npm run logs -- summary          per day and flow: count, average, p50, p95, router fallbacks
npm run logs -- slow 15          the slowest requests with each stage's time
npm run logs -- request <id>     everything about one request
npm run logs -- search <words>   requests whose scrubbed text contains the words
npm run logs -- client 30        failures only the browser saw
npm run logs -- clicks           shop-link opens per day and shop (affiliate or not)
```

Real output from the live project:

```
$ npm run logs -- failures 6
time             request_id        flow       outcome         stage  why                              ms
13 Nov 19:48:17  77bv4y8kmwf2aq5z  client     client_network  ask    Failed to fetch
13 Nov 19:48:16                    oversized  too_large       guard  body of 30013 characters
13 Nov 19:48:16  a29eg7z1mwf2aoyx  wrapper    error           parse  request body was not valid JSON
13 Nov 19:48:13  9a6chpxlmwf2af3o  shortlist  ok                     reasons: template_fallback…   8998

$ npm run logs -- stages
stage    kind               times  last_seen     example
reasons  template_fallback  1      13 Nov 19:48  attempt_timeout
model    attempt_failed     1      13 Nov 19:48  gemini-3.1-flash-lite (generateContent): attempt_timeout
```
One request in full (`npm run logs -- request 9a6chpxlmwf2af3o`): the router attempt succeeded in 2,101 ms, the reasons attempt timed out at 3,508 ms, so `reasons_mode` was `template` and the request took 8,998 ms in total (router 2,109, flow 2,388, reasons 3,510, gate 988). That is the kind of answer the old log could not give.

Directly in SQL (Supabase dashboard, SQL editor, or `supabase db query --remote`):

```
select * from v_failures limit 50;           -- failed or fallen-back requests
select * from v_stage_failures;              -- failures by stage and kind
select * from v_daily_summary;               -- counts and timings per day, flow and outcome
select * from query_log where request_id = '<id>';
select * from gate_log where request_id = '<id>';     -- why a card was dropped
```

Typical investigations:

| Question | Look at |
|---|---|
| "It was slow" | `slow`, then the stage with the big number; `model_attempts` for a slow Gemini |
| "It gave a poor read of my sentence" | `request <id>`: `router_mode` (was it the rules reader?), `flow_corrected`, `backfilled`, and the scrubbed text |
| "Live reviews are missing" | `stages` for `live`; the message holds the status code (for example `tavily_http_429`) |
| "The app said no connection" | `client`: which screen and kind |
| "No laptops shown" | `outcome` (`no_match` or `gate_dropped`) and `gate_log` |
| "Is anyone hitting the limit?" | `summary` and `input_kind = 'limit'` rows |

## 5. Privacy and access

- **What is stored:** the scrubbed text of typed requests (phone numbers, emails, 12-digit IDs and links removed; 300 characters at most), never the text of owner reports, never a name, address or contact detail. The scrubbing uses patterns, so a name or address typed in free text could still appear. That is why the text is kept only 30 days and can be switched off.
- **Switch the text off:** `update settings set value = 'false' where key = 'LOG_QUERY_TEXT';` (the rest of the log keeps working). Change the retention with `LOG_RETENTION_DAYS` (default 30). Old rows are deleted automatically (about once in 100 log writes) or on demand with `select purge_logs();`.
- **Who can read it:** only the server role and admins. The tables and views are closed to the public keys (verified on the live project after the migration: 0 public table grants, 0 public functions), and new objects no longer get public access by default.
- **Visitors:** a salted hash that changes daily. Not an address.
- **People are told:** the About page in the app says what is logged and for how long. If you turn the text log off, update that page.
- **Before real users:** the notice and consent for logging typed text, and the retention period, should be reviewed by someone who can give legal advice (India's data protection rules, which take full effect from about May 2027, apply to personal data, and typed text can contain it).
- **Browser reports** carry only the kind of failure, the screen, a short message and the kind of request. Never anything typed.

## 6. Cost and speed

One database insert per request, written after the reply is built, so it is not part of the time the user waits for the answer (the logged `total_ms` is measured before the write). If the write fails, the user is not affected (tested). Rate-limit hits are logged once per limit window, not per request, so a flood does not become a flood of writes. A browser reports at most one failure per kind a minute and five a minute.

## 7. Known gaps

- No alerting. Someone has to look (`failures`, `stages`). A reviewer-style notification (see D-42) could send a message when failures rise.
- No dashboard screen; only the command-line viewer and SQL.
- Admin actions (approving a report or a claim verdict) are not in this log.
- Requests rejected by Supabase before reaching the function (for example a wrong or missing public key, HTTP 401) are not logged here; look in the Supabase dashboard under Edge Functions, Logs.
- Messages are short and generic by design (no stack traces). For a crash you may need the function's own console logs in the Supabase dashboard.

## 8. Tests

Backend, in `backend/tests/logging.test.ts` (15): one row per successful request with scrubbed text, block types and timings; input kinds; PII and links never stored, long text cut, text switch; hard failures at the flow, gate and action stages with the user still answered; router fallback with model attempts; reasons failure; live failure; gate drops linked to the gate log; rate limit logged once; oversized body logged; browser reports accepted only for known kinds and not counted as queries; a broken log writer never breaks an answer; retention and the retention setting; the three views; exactly one row per request across all 75 kinds of input.
Frontend, in `frontend/src/test/clientlog.test.tsx` (10): the report carries only kind, screen, message and request kind; throttling; a failing report is swallowed; cancels and rate limits not reported; the error boundary shows a message and reports once; a dead connection shows a message, keeps the text and reports without it; the About page states what is logged.

## 9. Input log: everything people type or tap (added 13 Nov 2026, on the owner's instruction)

Table `input_log` (migration 18), separate from `query_log` (which stays scrubbed and short). Written by the edge function **before** the size check and rate limit, so blocked, oversized and malformed requests are recorded too.

| Stored | Detail |
|---|---|
| `text_input` | What was typed, **as typed** (up to 5,000 characters): free text, pasted listings and pitches, voice transcripts |
| `payload` | Everything else the person chose or sent: form choices, budget, tiles, Sell answers, laptop ids, owner-report fields, compare picks |
| `kind`, `ts`, `request_id`, `visitor` | What it was, when, the id that links it to `query_log`, the salted daily hash (no address) |
| Not stored | Pictures (only that one was sent), automatic calls (app open, catalog, click counts, browser error reports) |

Read it (in `backend/`): `npm run logs -- inputs 30` (last inputs in full), `npm run logs -- isearch <words>`, `npm run logs -- export` (all rows to `exports/inputs-<date>.jsonl`, a folder git ignores, because it holds raw text). Join to the outcome with `npm run logs -- request <id>`.
Controls: `LOG_INPUTS = {"enabled": true, "raw": true}` (set `raw` to false to scrub phone numbers, emails and links before storing; `enabled` false stops it; changes apply at once), `LOG_INPUT_RETENTION_DAYS` (30). Rows are deleted after the retention period.
**Before real users or user testing:** typed text can contain personal data, and this stores it unscrubbed. The About page and the Trust sheet now say so. People in a test session must be told (consent form or script) and told not to type real personal details. Someone qualified should review the notice and retention under India's data-protection rules. Gemini's free plan may use inputs to improve its products; use the paid plan. Never commit or share an export.
Tested: 5 backend tests (full and structured capture, pictures never stored, automatic calls skipped, malformed bodies recorded, scrub mode, off switch, retention, closed to public keys) and a real request through the live endpoint.

**Live tail.** `npm run logs -- tail` (in `backend/`) prints each new input within a few seconds of it arriving, then a second line with what the system did with it (flow, outcome, time, whether the AI model or the rules read it, soft failures, or the stage that failed). `npm run logs -- tail 5` also shows the last 5 first; `TAIL_SECONDS=2` checks more often (default 3, minimum 2). Ctrl+C stops it. It only reads. Each check is one read-only call through your Supabase login, so leave it running in its own terminal tab during a test session. In Claude Code you can run it with `! cd backend && npm run logs -- tail`. Tested against the live project: a typed message appeared in about 3 seconds and its outcome line followed.
