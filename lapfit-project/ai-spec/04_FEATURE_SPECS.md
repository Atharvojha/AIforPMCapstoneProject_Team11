# LapFit: feature specifications

Implementation-level specification for every opportunity, based on the prompt "Product Feature Decomposition & Full-Stack Specification". Each feature has its own file in `specs/`; this file holds what they share.

**Stack:** Lovable (React), Supabase (Postgres, Edge Functions, Auth), n8n, Gemini (decision D-03). **No opportunities were invented.** Supporting features are listed only where an opportunity cannot work without them. Assumptions are tagged **[A]**. Facts I checked are in `05_ANSWERS.md`.

## Spec files

| Feature | Opportunity | Class | Spec | AI anatomy |
|---|---|---|---|---|
| F01 | Shortlist | Core | `specs/F01_shortlist.md` | `features/F01_shortlist.md` |
| F02 | Second opinion + check the pitch | Core | `specs/F02_second_opinion_and_pitch_check.md` | `features/F02_…` |
| F03 | Used laptop check | Core | `specs/F03_used_laptop_check.md` | `features/F03_…` |
| F04 | Buy for others or a team | Extension | `specs/F04_buy_for_others_and_teams.md` | `features/F04_…` |
| F05 | Owner voice | Extension | `specs/F05_owner_voice.md` | `features/F05_…` |
| F06 | Add my experience | Extension | `specs/F06_add_my_experience.md` | `features/F06_…` |
| F07 | Market pulse | Extension | `specs/F07_market_pulse.md` | `features/F07_…` |
| F08 | My laptops | Extension | `specs/F08_my_laptops.md` | `features/F08_…` |
| F09 | Sell plan | Extension | `specs/F09_sell_plan.md` | `features/F09_…` |
| F10 | Brand and retailer insights | Extension | `specs/F10_brand_insights.md` | `features/F10_…` |

All ten are fully specified. Every spec follows the same eleven phases: context, decomposition, workflows, frontend, backend, roles, data and intelligence, integrations, edge cases, backlog, blueprint and acceptance criteria. Questions that came up are answered in `05_ANSWERS.md`.

---

## Phase 1. Opportunity context (all ten, kept intact)

| Opportunity | User segment | User problem | Desired outcome | User context |
|---|---|---|---|---|
| F01 Shortlist | First-time buyers, students, parents, professionals | Too many options, contradictory advice | A short list meeting every must-have | At home or in a shop with a budget and a use in mind |
| F02 Second opinion + pitch check | All buyers; parents in shops | Cannot tell whether a laptop fits or whether a seller's claims are true | Confidence to buy or walk away | Looking at one laptop, often with a seller present |
| F03 Used laptop check | Used and refurbished buyers | Cannot inspect a listing | Know what does not add up and what to check | Reading a listing or a photo |
| F04 Buy for others / team | Adult children, parents, owners, admins | Not the user; many roles | A fit for them within a total budget | Buying for someone else |
| F05 Owner voice | Performance seekers, students, parents | Reviews are written in week one and not by people like me | Reports from owners like me over months | Choosing between finalists |
| F06 Add my experience | Owners | No way to help other buyers | Share an experience safely | After months of use |
| F07 Market pulse | Buyers with a shortlist; analysts | Not knowing when or what is moving | See trends, complaints and price falls | Timing a purchase |
| F08 My laptops | Owners | Warranty and value are forgotten | One place for status | After purchase |
| F09 Sell plan | Sellers and upgraders | Unknown value, unknown which fixes pay | Most money, least effort | Preparing to sell |
| F10 Brand insights | Brands, retailers | Unknown demand and complaints | Product and range decisions | Planning and monitoring |

---

## Shared platform (used by every spec)

Each spec refers to this section and lists only what is specific to its feature.

### Shared services (Supabase Edge Functions unless stated)

| Service | Responsibility | Used by |
|---|---|---|
| `handle-query` | Orchestrates a request: read, route, run the flow, write reasons, gate, log | F01 to F05, F09 |
| `route-request` | One model call (prompt P1), schema validation, one retry, confidence cut at 0.6 | F01 to F05, F09 |
| `write-reasons` | Prompt P2 with a numeric check and a code-written fallback | F01, F02, F04 |
| `pre-send-gate` | Recomputes every figure and verdict from stored data and drops what differs | All |
| `catalog` | Laptop matching, variant lookups, filters, alternatives | F01 to F04, F08, F09 |
| `evidence` | Owner-report queries with n and the minimum-count rule | F02, F05, F07, F08, F10 |
| `settings` | Versioned thresholds; each answer records the version | All |
| `logging` | `query_log`, `unhandled_requests`, `gate_log`, anonymous activity logs | All |
| `admin` | Roles, imports, approvals | All admin features |
| n8n jobs | Price ingestion, trend pre-computation, review tagging, retention clean-up, weekly eval run | F05, F07, F09, F10 |

### Shared API conventions

| Item | Rule |
|---|---|
| Public entry point | `POST /functions/v1/query`. Body is one of: text request, needs (controls or chips), a feature form (`rulesForm`, `usedForm`, `sellerForm`), `ownerFilters`, `trending`, or `team`. Response: `{ ok, flow, language, router_mode, banner, footer, blocks[], ignored_instructions[] }` |
| Other public endpoints | `GET /config`, `GET /catalog/laptops`, `POST /submit-report`, `POST /garage`, `GET /insights` (brand role) |
| Errors | 400 bad body; 401 or 403 role; 413 body over 8 MB; 429 rate limit. A model failure is **not** an error: it returns 200 with a form block |
| Limits | Text up to 4,000 characters; image 1280 px (V1); history up to 6 earlier messages |
| Authentication | Public endpoints anonymous and rate-limited. Admin and brand endpoints use Supabase Auth with a role claim. Row-level security on every table. [A] |
| Idempotency | Reads only; submissions use a receipt code so a double tap does not create two rows |

### Shared roles

| Role | Can |
|---|---|
| Visitor | Use every public feature; submit an owner report; no account |
| Reviewer | Approve or reject owner reports and claim verdicts; approve checklist items; verify imports |
| Admin | Everything a reviewer can; manage settings, tables, imports, roles, deletions |
| Brand user (F10) | View insights for their own brand's models and aggregates for the category |
| Account holder (V2) | Sync My laptops and alerts; delete their data |

### Shared UI conventions

| Convention | Rule |
|---|---|
| Banner and footer | Sample-data banner on every result; "Links may earn LapFit a commission; it never changes the order." at the foot of every result |
| States every screen defines | Initial, Loading, Success, Empty, Error, Disabled, Partial data, Offline, Permission denied |
| Requests | Debounce 250 ms for live controls; the latest request wins; a stale answer is ignored |
| Accessibility | Keyboard use; 44 px touch targets; every status shown as a word and a symbol, not colour alone; dark mode; readable at phone width |
| Wording | Calm, plain, short sentences, no exclamation marks; neutral about sellers ("does not match the specs") |
| Language | The model writes reasons in the user's language; fixed screen text is English at first (decision D-12) |
| Counts | Anything built from owner reports shows n; under 20 it says "not enough evidence" and shows the count |

### Shared data rules

Fact tables carry `verified`, `verified_by`, `verified_at`, `is_sample`; only verified or sample rows are shown. A price has an as-of date. Money is whole rupees; storage in GB (1 TB = 1024); weight in kg. Full model in `../data-model/DATA_MODEL.md`.

### Shared non-functional requirements

| Area | Requirement |
|---|---|
| Latency | Router step within 8 seconds, then the rules-only form. Filter and rank under 200 ms for 10,000 versions on indexed columns. End-to-end p95 to be set once measured |
| Security | No keys in the browser; parameterised queries; column names only from registries; input limits; row-level security |
| Reliability | Every model call has a non-model fallback; a rate limit from the model is treated as a normal case |
| Testing | Hard metrics must be zero before launch: a Must violated or dropped silently, an invented spec or price, a verdict without a named approver, personal data published |
| Observability | `gate_log` and `query_log` reviewed weekly; settings version on every answer |

### Privacy and data protection (India)

I checked India's data protection law on 13 Nov 2026 (sources in `05_ANSWERS.md`, C11 and C12). **This is not legal advice; confirm with the Gazette text and a lawyer before launch.**

| Rule | What the specs do |
|---|---|
| The Digital Personal Data Protection Rules were notified in Nov 2025 and phase in over about 18 months; the main duties start around May 2027 (sources differ by a day or two) | Build the notice, consent and deletion features now so they are ready |
| A notice must accompany or precede a consent request | Every form that collects anything shows a short notice: what is collected, why, how long, how to delete |
| Children under 18 need verifiable parental consent, and tracking, behavioural monitoring and targeted ads aimed at children are prohibited | The owner-report form asks the submitter to confirm they are 18 or older. LapFit does not knowingly collect children's data. Parents buy for children; the child is never the user. Nothing is tracked per person |
| Erasure on request | Anyone who submits a report or a sell-plan outcome gets a **receipt code** that lets them see status and ask for deletion. No account is needed |
| Retention limits | Typed text in `unhandled_requests` 90 days; pending reports 30 days after rejection; raw uploads 30 days (V1); activity logs 24 months then aggregated |
| Breach reporting (secondary source: 72 hours) | An incident process is a launch task; **not verified** against the Rules |

---

## Using the specs

- Read `specs/F0x_…md` for the build detail and `features/F0x_…md` for the AI anatomy.
- The to-do list (`01_TODO.md`) tracks what remains: data, evals, real users.
- Recommended order of building across features: catalog and prices, then F01, F02, F03, then the extensions.
