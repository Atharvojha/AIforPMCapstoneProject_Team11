# Backend build log (13 Nov 2026)

What was built, why, what was proven, what went wrong along the way, and what is still not proven. Read this first if you are new to `backend/`. Architecture diagrams are in `04_ARCHITECTURE_DIAGRAMS.md`; how to run and operate it is in `06_OPERATIONS_RUNBOOK.md`; the reasons behind each choice are D-32 to D-45 in `../ai-spec/02_DECISIONS.md`.

## 1. The idea in one paragraph

A buyer (or seller, or owner) sends text or a form to one HTTPS endpoint. The backend reads the request into fixed fields, finds facts in the database with SQL, ranks and words the answer, then **re-reads the stored facts before anything is shown** and drops whatever does not match. A language model is used in three narrow places: reading text into fields, writing short sentences from facts it is handed, and (optionally) fetching live web reviews. **Code and SQL decide every fact.** That is why a model mistake cannot become a wrong price on screen.

## 2. What exists

| Area | Where | What it does |
|---|---|---|
| Database schema | `supabase/migrations/…0001_schema.sql` | Catalog (models, variants, spec facts with source and date, price history, curation), reviews and machine-read opinions, claim ledger, logs, settings, filter registry. Row-level security on every table |
| SQL tools | `…0002_tools.sql`, `…0004`, `…0005` | The only way code reads data: `tool_find_variants`, `tool_get_variant`, `tool_get_price`, `tool_evidence_summary`, `tool_evidence_quotes`, `tool_resolve_laptop`, `tool_lookup_claim_verdict`, `tool_term_mentions`, `tool_brand_stats`, `tool_trending`, `tool_report_*`, `tool_live_*`, `tool_rate_gate` and others (24 in total) |
| Settings | `…0003`, `…0007`, `…0008` | Thresholds, weights, limits, feature flags, rate limits: one table, changed without redeploying |
| Orchestrator | `supabase/functions/_shared/handler.ts` | Clean input, read it, route it, run the flow, word it, gate it, log it |
| Flows | `_shared/flows/` | Shortlist, second opinion and pitch check, used-laptop check, compare, owner voice, brand insights, market pulse, buy for others and team table, sell plan, my laptops, owner reports |
| Reader | `router.ts`, `normalise.ts`, `soft.ts` | Model reads text into JSON; code validates it; a rules reader is the fallback and also a safety net |
| Ranking and cards | `rank.ts`, `cards.ts`, `lens.ts`, `reasons.ts` | Rank in code, build cards from stored rows, optional model wording checked number by number |
| Pre-send gate | `gate.ts` | Re-reads stored facts after wording and drops any card that disagrees |
| Live reviews | `live.ts`, `flows/livecards.ts` | Tavily web search (Gemini Google Search grounding as a fallback), cached, capped, labelled, kept apart from dataset numbers |
| Rate limiting | `guard.ts`, `…0008_rate_limit.sql`, `query/index.ts` | Size check, per-visitor limits, degrade-before-block, global daily budget |
| Edge wrapper | `supabase/functions/query/index.ts` | Thin HTTP wrapper around the handler |
| Import | `scripts/` | Copies the team's existing SQLite database into Postgres, locally, over a database URL, or through the Supabase CLI login |
| Tests | `tests/` | 162 tests (below) on in-memory Postgres with a fake model and a fake live source |

About 1,950 lines of TypeScript and 800 lines of SQL.

## 3. Build order (what happened, in sequence)

1. **Schema and tools.** Wrote the schema and the SQL tools; applied them to PGlite (Postgres 17 in memory); fixed what broke. Whitelisted every filterable column in a registry so no column name is ever built from user text.
2. **Import.** Wrote the SQLite-to-Postgres import with integrity checks. Counts match the source exactly: 3,987 reviews, 1,316 opinions, 29 variants, 173 spec facts, 14 prices.
3. **Data tests (14).** Counts equal the source; every price has a date; Amazon text is never quotable; every Must holds on every row; unknown attributes and operators are refused; a verdict needs a named approver.
4. **Core flows.** Router, normaliser, ranking, cards, reasons writer, gate, shortlist, second opinion, pitch check, used check (16 tests).
5. **User feedback:** the first real output for "a stylish laptop in India" ignored "stylish" and was titled "meet every Must". This led to the soft-word registry, the owner-evidence lenses and honest titles.
6. **Every input type.** Added brand, OS, processor and graphics filters with exclusions; compare; owner voice; brand insights; market pulse; team tables; sell plan; warranty maths; owner reports; fuzzy name matching; follow-ups; hygiene for odd input. Built a 75-input matrix and 30 specific tests (107 tests in `inputs.test.ts`).
7. **Live reviews layer.** Built the source interface, cache, daily limit and sanitiser, tested with a fake source (11 tests).
8. **Deployment to Supabase.** Installed the CLI, linked the project, applied the migrations, imported the data through the CLI login, deployed the function, set secrets.
9. **First real-service tests.** Found and fixed the problems in section 5.
10. **Rate limiting** (12 tests).
11. **Documentation** (this file, the runbook, the diagrams, decisions D-32 to D-45), which found and fixed problem 16.

## 4. What was proven, and how

| Claim | Evidence |
|---|---|
| The data layer matches the source | Import counts equal the SQLite file, locally and on the live project |
| Every Must holds on every shown laptop | `data.test.ts`, `inputs.test.ts`, run on every request path |
| A tampered or stale card is dropped | Gate test: a card with a changed price is removed |
| The model cannot put a made-up number on screen | Test with a model that lies in its reasons: replaced by code-written text |
| Amazon review text is never quoted | Data test and rights rule on the `source` table |
| A verdict needs a named approver | Database constraint plus test |
| Prompt injection is reported and ignored | Offline reader strips steering sentences first; tested |
| Rate limiting works on the real endpoint | 14 simultaneous requests: 10 answered, 4 got HTTP 429 with Retry-After; a 30,000-character body got HTTP 413 |
| The deployed stack works end to end | Real Gemini read a Hinglish request; real Tavily returned relevant live reviews; real Postgres returned the same counts as the local tests (234 MacBook opinions; 6 laptops under ₹60,000 excluding HP) |
| Public keys cannot reach the data | After migration 06: 0 tool functions and 0 tables are accessible to the `anon` or `authenticated` roles |

Test count by file: data 15, flows 17, inputs 107, live 11, rate limit 12 = **162**, all passing.

## 5. Problems found and fixed

| # | Problem | How it was found | Fix |
|---|---|---|---|
| 1 | "Stylish" was silently ignored and the title claimed "meet every Must" | You ran the first real query | Soft-word registry (`soft.ts`), owner-praise looks lens, honest titles, notices |
| 2 | A multi-line team table was read as one line (wrong budgets) | Reading real output | The text cleaner kept newlines; unreadable lines are named |
| 3 | Single-person "buy for others" cards skipped the reasons writer and the gate | Reading real output | Cards are now passed through both |
| 4 | Every anonymous submission shared one rate bucket (`anon`) | A test | The Edge wrapper derives a per-visitor hash; the handler honours it |
| 5 | Topic words ("battery") polluted laptop names so the laptop was not found | The input matrix | Topic words are cut from names; unmatched names drop trailing words |
| 6 | Typos like "macbok" were not recognised | The input matrix | One-letter typo correction for brand and product words; fuzzy name matching |
| 7 | **Two tool functions were callable with the public anon key** | A check on the live database | Migration 06 re-applies the lock to every tool and removes table grants from public roles |
| 8 | Gemini grounding returned HTTP 429 "quota exceeded" | First real live-search call | Grounding needs a paid Google plan; Tavily became the preferred live source |
| 9 | Gemini sometimes took 5 to 20 seconds and the whole budget was lost on one attempt | Real timings on the live endpoint | Per-attempt time limits, a fallback model, then the rules reader |
| 10 | The fallback wrapper would hang forever if a model client ignored the abort signal | A test I wrote | Each attempt now races against its own timer |
| 11 | Gemini dropped "not HP" from a Hinglish request | Real Gemini output | Code re-adds brand, OS, processor, graphics and refresh-rate wishes the model missed, and says so |
| 12 | Gemini sent "what do owners say about the Macbook Air M1 battery" to brand insights | Real Gemini output | Prompt rule plus a code guard that trusts the rules reader on clear compare and owner-voice requests |
| 13 | The safety gate checked cards one after another (slow) | Timings | Cards and lookups are checked in parallel |
| 14 | A "style: stylish" criterion from the model appeared as an unsupported item | Real Gemini output | Style attributes are dropped; the looks lens handles them |
| 15 | Video chapter lists came back as "reviews" from Tavily | Reading real results | Results with several timestamps are skipped |
| 16 | **The code read settings under names the database did not have** (for example the battery thresholds), so a 65% battery was not flagged as a warning in the used-laptop check, and several limits silently used code defaults | Writing this documentation and comparing the settings table with the code | Code now reads the stored names; migration 09 aligns the table; a test fails if the code ever reads a setting that does not exist; a regression test checks the 65% and 75% battery cases |

## 6. Real-service measurements (13 Nov 2026)

| Item | Result |
|---|---|
| Router call, `gemini-3.1-flash-lite`, low thinking | median 3.2 s, worst 5.8 s, valid 6 of 6. With "minimal" thinking it was slower and erratic (median 11 s) |
| `gemini-3.5-flash-lite` | median 1.7 s but returned 503 and 429 on the free tier |
| `gemini-2.5-flash-lite` | no longer available to new users |
| Tavily basic search | about 2.5 to 3 s; 1 credit per search |
| Database part of a shortlist request | about 1.1 s, gate about 0.6 s |
| Whole request | 2.8 s (compare) to 12 s (shortlist with a model-written reasons step and live search); dominated by Gemini |
| Gemini grounding | HTTP 429: not usable on this account's plan |

These are single runs on a free tier. Treat them as indicative, not as a service level.

## 7. Not proven, not built

**Not proven:**
- Latency under load; one measurement run only.
- The Edge Function on a custom domain, and behaviour from the Lovable frontend (the frontend does not exist yet).
- Gemini Google Search grounding (blocked by quota; code written from the documentation).
- Accuracy of the model reader across languages beyond a handful of manual checks.

**Not built:**
- Reading photos; embedding search (column exists, import supports it); scheduled jobs; webhooks and the reviewer notification (see D-42); model-based triage of owner reports (rules only); user accounts; an admin screen for approving reports and claim verdicts (the SQL tools exist).
- Persona and months-owned filters on the dataset (the data has neither; the product says so).
- Real used-price and sale data for the sell plan (factors are labelled sample assumptions).
- A staleness warning on old prices.

## 8. Costs and limits in effect

| Service | Limit or price (checked 13 Nov 2026) | How the backend stays inside it |
|---|---|---|
| Gemini (free tier) | Free-tier input may be used by Google to improve its products; request caps not fully known | Rate limits; degraded mode; global daily cap of 1,500 model calls; only sample data and test queries until a paid plan |
| Tavily (free) | 1,000 credits a month; basic search is 1 credit | 24-hour cache per laptop and topic; daily cap of 30 live searches |
| Supabase Free | 500 MB database; project pauses after a week of inactivity; Edge Functions limited in time and CPU | Small data (about 12 MB plus logs); keep the project active |
| Google Search grounding | About $14 per 1,000 search queries on Gemini 3 models after a monthly allowance (pricing page; Interactions billing not confirmed) | Off by default; needs a paid plan |

## 9. Privacy summary

- The typed text goes to Gemini (to be read) when the model path is on. It goes nowhere else.
- Only a laptop name and a topic go to Tavily, never the user's text.
- Phone numbers, emails and ID numbers are removed from text before anything else happens.
- The visitor id is a salted daily hash of the network address; the address is never stored.
- Query logs hold timing, flow and outcome, not typed text. The unhandled-request log holds scrubbed text, capped at 500 characters.
- Owner reports collect no name or contact; the receipt code is stored only as a hash; deletion removes the row.
- Free-tier Gemini inputs may be used by Google. Use a paid plan before real users type into the product (D-14).
