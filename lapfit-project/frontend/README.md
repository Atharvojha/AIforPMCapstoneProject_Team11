# LapFit frontend

A mobile-first web app for LapFit, built against the deployed backend (`../backend`). React 18, Vite, TypeScript. Plain CSS (no UI library), light and dark themes, about 64 KB of JavaScript gzipped. It uses the same stack Lovable generates, so the folder can be imported there later.

**The rule it follows:** the frontend never computes a fact. Prices, ticks, counts, totals and verdicts come from the backend; the frontend arranges them, shows every notice, and keeps what the user typed when something fails.

## Run it

```
cd frontend
cp .env.example .env.local      # fill in the two PUBLIC values (project URL and anon key)
npm install
npm run dev -- --host 127.0.0.1 # open http://127.0.0.1:5173
npm test                        # 187 tests
npm run build                   # type-check, then a production build in dist/
```
`.env.local` holds only the project URL and the public anon key (meant for browsers). Never put the Gemini, Tavily or service-role keys here. Without the two values the app shows a setup page and makes no requests.

## What makes it different
Playful but honest: a laptop mascot, "laptop DNA" charts, evidence rings, swipeable cards, tug-of-war compare bars, seller-claim stamps, an answer receipt that shows where every answer's data came from, confetti when your Musts are met. **Voice** (speak in English, Hindi, Telugu or Tamil, and hear answers read aloud), **pictures** (a listing, a seller's chat, a spec screen, a laptop or its box), and **sharing** (WhatsApp, copy, or a picture card). **Where to buy** links with a plain affiliate disclosure. See `../build-plan/11_FRONTEND_DESIGN.md`, `09_MULTIMODAL.md`, `10_MONETIZATION.md`.

Design review: `npm run dev -- --host 127.0.0.1`, then open `/?mock#/explore` (also `#/ask`, `#/check`, `#/sell`, `#/you`; `?mock` preloads the catalog so no live request is made) or `#/gallery/<fixture>` (every kind of reply). Development only.

## Screens

Five spaces and almost no typing (details in `../build-plan/11_FRONTEND_DESIGN.md`, section 0).

| Space | What you do | Backend call |
|---|---|---|
| **Ask** | Tap vibe tiles, drag a budget, press one button; or type, speak (English, Hindi, Telugu, Tamil), or add a picture. Follow-ups ("cheaper") carry the earlier needs | `{needs}` / `{text, history, prior_needs}` / `{action: "read_image"}` |
| **Explore** | The laptop map: drag a budget, hide brands, tap dots, Compare (overlay radar + table), or "Show what fits" | `{action: "compare", variant_ids}` / `{needs}` |
| **Check** | Drop a picture or paste what the seller said; optionally add details | `{action: "read_image"}` / `{text}` / `{action: "used_check"}` |
| **Sell** | Pick a laptop, slide the age, tap a condition face | `{action: "sell_plan"}` |
| **You** | My laptops (saved on this device only); share your experience with stars, a topic and one sentence; check or delete a report by code | `{owned}`, `{experience}`, `{action: "report_status" / "report_delete"}` |
| Market, About | Market pulse and brand insights; sources, privacy and limits (footer links) | `{text}`; none |

Result cards offer "What owners say" and "Second opinion" (direct actions by laptop id: no text reading, no model call) and a Compare tick. A tray collects picked laptops. Live web reviews appear labelled "Live, not verified" with safe external links.

## How it handles trouble

| Situation | What the user sees |
|---|---|
| Waiting | A status line ("Checking the facts… up to 15 seconds") |
| Server or network error | A plain message and "Try again"; the typed text is kept |
| Too many requests (HTTP 429) | The message, a countdown, and the send button disabled until it ends |
| Message too large (413) | Asked to shorten it |
| Smart reader slow | The reply says a simpler reader was used and to check the needs |
| Older answer arriving late | Ignored; a newer request is never overwritten |
| Browser storage blocked | "Not saved on this device"; works for the visit |
| Unknown new block type from the backend | A short note, never a crash |

## Failure reporting
Failures only the browser can see (no connection, a timeout, a crashed screen) are reported to the server with the kind, the screen and a short message, **never anything typed**, throttled to one per kind a minute. A crashed screen shows a plain message and a reload button instead of a blank page. See `../build-plan/07_LOGGING_GUIDE.md`.

## Accessibility and trust rules built in

Skip link and landmarks; every control has a text label; Must ticks carry words ("Meets", "Does not meet", "Unknown") as well as symbols; bars have text alternatives; focus rings; reduced-motion respected; 44 px touch targets; light and dark themes. Every notice the backend sends is shown; "not enough evidence (n = …)" is shown instead of numbers when evidence is thin; the sample-data banner is always visible; text from the backend is always rendered as text, and only `https` links are ever made clickable.

## Tests (114)

- **Real backend replies:** `src/test/fixtures/*.json` are real replies from the backend handler (made by `npm run fixtures` in `../backend`), 22 cases covering every block type. Every block renders without crashing.
- **API client:** success, 429 with Retry-After, 413, 401, 400, 500, bad bodies, network failure, timeout, abort.
- **Conversation logic:** one request at a time, older answers ignored, text kept on failure, countdown, follow-ups carry needs and history.
- **Screens:** the needs form builds the right request; a used listing becomes a structured request; compare picks (max four); share validation (contact details refused, 18+ and consent required, delete asks first); saved laptops stay on the device; storage blocked.
- **Live check (manual, not in the suite):** the API client was run against the deployed backend for nine request types, and every block returned is one the app can render.

## Not built, and why

| Not built | Why |
|---|---|
| Results updating as you type | Each change would be a request and the server rate-limits (10 a minute); the Find screen uses a button |
| Brand sign-in and brand-only insights (S11) | Needs user accounts, which do not exist |
| Admin and review screens (S12) | The backend has the SQL tools but no admin endpoints; reviewers use SQL for now |
| A `config` endpoint and switches (J10) | Feature flags live on the server; the backend states what is off in each reply |
| Photo upload | The backend does not read images yet |
| Persona and months filters for owner reports | The dataset has neither; the UI does not pretend |
| "Sell this" prefill from My laptops | Not wired; the Sell screen has its own picker |

## Deploying

Any static host works (the build is the `dist/` folder).
- **Vercel or Netlify:** import the GitHub repo, set the root to `lapfit-project/frontend`, build command `npm run build`, output `dist`, and add the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Lovable:** import the repository and point it at this folder, with the same two variables.
- After deploying, set `ALLOWED_ORIGIN` on the backend to the site's address (`supabase secrets set ALLOWED_ORIGIN=https://your-site`), so other websites cannot call the function from a browser.
- Before a group demo, raise the rate limits (`../build-plan/06_OPERATIONS_RUNBOOK.md`, section 6).

## Known limits

- The pages and flows were verified with automated tests and a live API check, but I could not open the app in a real browser from the build environment (the browser tool could not reach local pages), so **visual layout has not been checked by eye**. Open it on a phone-sized window and report anything that looks wrong.
- Latency is whatever the backend gives: direct actions 1 to 2.5 seconds; typed questions 3 to 12 seconds, mostly the AI model.
