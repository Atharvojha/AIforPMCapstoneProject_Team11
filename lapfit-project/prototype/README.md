# LapFit (prototype, SAMPLE data)

A laptop second-opinion and recommendation app for buyers in India. Mobile-first, plain language.
All laptops are made up ("SampleBrand", Sample Laptop A to H). Every result carries the banner **SAMPLE DATA, not real laptops**.

## Run it

```bash
cd lapfit
npm install
cp .env.example .env        # optional; or just export the variable below
export ANTHROPIC_API_KEY=sk-...   # server only
npm start                   # http://localhost:3000
```

No key? Try it with the rules-based stand-in reader: `npm run dev:offline`.
With no key and no offline reader, every request shows the rules-only form (the same fallback as a model error or a timeout over 8 seconds).

- `/admin` also holds the owner-report review queue. Without `ADMIN_TOKEN` it opens from this computer only; with it, add `?token=...`.
- `/admin` lists unhandled requests (out of scope, not a laptop, clarify, low confidence, model errors), pre-send gate drops, and recent queries. Set `ADMIN_TOKEN` to protect it.
- `npm test` runs the smoke tests (offline reader, in-memory DB).
- `npm run seed` rebuilds the SQLite file with the sample data.

## Use cases

| # | Job | Screen / flow | Who decides the facts |
|---|---|---|---|
| 1 | Second opinion on a laptop I am considering | `second_opinion` | Catalog, code |
| 2 | Check what a seller claimed | Check, `check_pitch` | Catalog and approved claim ledger |
| 3 | Get a shortlist | Find, `shortlist` | SQL filter and code ranking |
| 4 | Check a used listing | Check, `used_check` | Catalog, settings |
| 5 | Buy for a parent, child or team | `buy_for_others` | Catalog, code |
| 6 | What owners like me say | Owners, `owner_voice` | Owner reports, code |
| 7 | What is trending | Market, `trending` | Views, reports, price history |
| 8 | Track what I own | Mine | Catalog, code |
| 9 | **Sell my laptop for more** | **Sell, `sell_laptop`** | **Catalog price, settings, repair-cost table, code** |

### Sell my laptop (use case 9)

The user gives the laptop, its condition and why they are selling, either in the form or in their own words. LapFit returns:

- **What it may fetch today** as a range, with how it was worked out.
- **What to do, in order.** Each possible fix is tested by recomputing the value with the fix applied. A fix is marked "Do this" only if it adds more than it costs (at least `RESALE.MIN_NET_INR`), and "Skip this" otherwise, with the numbers. Free steps (reset, find the bill and box, clean) are always worth doing. A RAM upgrade is suggested only if the catalog says a memory slot is free and a higher-RAM version exists, and its value comes from the catalog price difference.
- **The range after the worthwhile fixes**, the repair costs, and the net gain.
- **How to price it**: a quick-sale and a best-price pair, each with a listing price and a lowest price to accept. The user's urgency highlights one.
- **Timing**, from the new-price history in the catalog.
- **Be upfront**: what to disclose, and a note tied to the reason for selling (upgrading, need money, not using, a fault, gift).
- **What is missing** that would tighten the range. Unknown details are never guessed; they widen the range.

Where the model fits: it only reads the user's words into `seller_info`. It never supplies a figure. The pre-send gate recomputes the whole plan from the normalised input and drops the block if anything differs. If the laptop is not in the catalog, the answer is generic preparation tips with no figures.

**Honest limits:** the age curve and condition factors in `settings.js` (`RESALE`) and the repair costs in the `resale_action` table are SAMPLE assumptions, not real sales data. Replace them with real used-price data and real repair quotes before relying on the numbers. The prototype does not connect buyers.

## The app (screens)

Home (journey and this month's pulse), Find (live filters, no typing), Check (seller pitch or used listing), Owners (filter owner reports, add yours), Sell (what to do to get more for your laptop), Market (trending, from the top bar), Mine (my laptops, saved on the device), For brands (insights and unmet demand), How it works (data and revenue streams, with Built / Prototype / Concept labels). The text box on Home is a shortcut, not the product.

New data: `demand_signal` stores budget band, use, Must labels and how many laptops matched, never the typed words. Unmet demand is the share with zero matches.

## Beyond fit: owner evidence (the part competitors cannot copy quickly)

The same database now answers three more jobs. All counts are computed in code and re-checked by the gate.

1. **Owner voice** (`owner_voice` flow): filter owner reports by who said it (gamer, student, developer, creator, parent, office), how long they owned it (3+, 6+, 12+ months), topic, and time window. Ask in words ("what do gamers say about heat after 6 months?") or use the filter bar. Every row shows n; below 20 it says "not enough evidence" and shows no excerpts. It is a lens, not a ranking of laptops.
2. **Trending** (`trending` flow): for 7, 30 or 90 days: most checked, rising complaints (low-rated reports, at least 5 and more than the window before), and price drops (3% or more). "Most checked" comes from a `view_events` log written after the gate.
3. **Add my experience**: a form that puts owner reports in a queue (`owner_submission`). Nothing shows until a person approves it on `/admin`, and an approved report becomes a verified `evidence_excerpt` with the reviewer's name. No names or contact details are collected; links, emails and phone numbers are rejected; 5 reports per hour per address.

Why this is hard to copy: long-term, persona-tagged, human-approved reports with ownership months build up over time. Each report improves the filters, and the filters bring more reports.

Sample dates are relative to the day the database is seeded. Delete `data/lapfit.db*` or run `npm run seed` to refresh them. Old databases are migrated automatically (sample rows only).

## The core rule, and where it lives

| The model does | Code does |
|---|---|
| `server/route-request.js`: reads text or an image into JSON (temperature 0, schema-validated with zod, one retry, then the form) | `server/engine.js`: which laptops qualify (SQL per Must), ranking, prices, specs, every tick and cross |
| `server/reasons.js`: writes 2 or 3 short reasons from facts passed in (temperature 0.2) | `server/flows.js`: the five flows, claim verdicts (ledger lookups only) |
| | `server/gate.js`: **pre-send gate**. Re-checks IDs, Musts, prices, as-of dates, spec numbers in text and ledger approvals. Drops failing cards and logs to `gate_log` |

All thresholds (minimum n of 20, 8 second timeout, confidence 0.6, temperatures, limits) are in `settings.js`.

## Choices worth knowing

- **Database:** local SQLite (`better-sqlite3`) so it runs anywhere. `supabase/schema.sql` is the same schema for Postgres. Swapping the driver is limited to `server/db.js` and the SQL in `server/engine.js`.
- **Model connection:** direct Anthropic Messages API from `server/model.js` (default `claude-haiku-5-5`, change with `LAPFIT_MODEL`). Lovable's own connection is not used because this was built outside Lovable.
- **Reasons that fail the check:** if model-written reasons contain a number that is not a stored fact, the card keeps code-written reasons instead of being dropped. A card is dropped when its ID, a Must, its price, its as-of date or its specs fail.
- **Router extras:** the router JSON has optional fields beyond the spec (`recipient`, `tone`, `followup_flow`, `owner_filters`) and two extra flows (`owner_voice`, `trending`). They are optional in the schema, so a model that leaves them out still validates.
- **Extra columns:** `n_reports`, `rating`, `source_name` on `evidence_excerpt` (so n and ratings can be computed), `match_terms` on `claim_ledger`, `warranty_years` and `price_as_of` for filtering and as-of dates.
- **Links:** this prototype does not fetch pages. A bare link gets "I cannot open links" and a request for the model name or pasted text.
- **Language:** the model writes reasons in the user's language. Fixed screen text and notices are English only for now.
- **Photos:** sent to the model for reading. The offline reader cannot read photos.

## Adding real data later

```bash
npm run import -- laptop_model data/models.csv --verified-by "Your Name"
```
CSV headers must match column names. Real rows get `is_sample = 0`. Without `--verified-by` they stay hidden. Remove the sample rows with `DELETE ... WHERE is_sample = 1` before launch.

## Not built (prototype limits)

Accounts, real affiliate links, price scraping, an admin login beyond a token, and translated UI text.
