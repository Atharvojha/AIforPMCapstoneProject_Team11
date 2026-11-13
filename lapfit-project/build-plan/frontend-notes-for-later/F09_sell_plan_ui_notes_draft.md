# F09_sell_plan: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

| Screen | Purpose | Entry | Exit |
|---|---|---|---|
| S1 Sell | Form, own-words box, plan | Tab "Sell"; Mine; offer button | Owners, Mine |
| S2 Outcome (V1) | Record the sale | Plan link, receipt code | — |

| Component | Purpose | Action | Data | API | States |
|---|---|---|---|---|---|
| Sell form | 12 inputs, each with "Not sure" | Fill; submit | Catalog list | `POST /query` (`sellerForm`) | Initial; prefilled; Loading |
| Own-words box | Free text | Type; "Use my words" | Text | `POST /query` (forceFlow) | Initial; Loading |
| Result tiles | Today; after fixes; net | — | Plan | — | Loaded; no fixes worth it |
| Action cards | Title, Do or Skip, summary, why, steps | Expand | Actions | — | Do; Skip |
| Pricing pair | Quick and best | — | Prices | — | One highlighted |
| Timing, disclosures, reason note | Text lists | — | Plan | — | Hidden if none |
| Missing-details panel | What to add | Tap button | List | — | Hidden if none |
| "How this is worked out" | Factors table, limits | Expand | Factors | — | Collapsed |
| Listing writer (V1) | Text | Tap; copy | Text | `POST /query` | Idle; loading; fallback template |
| Outcome form (V1) | Sold, price, days, fixes | Submit | Fields | `POST /sale-outcome` | Idle; sent |

Validation: age 0 to 240 months; battery 0 to 100; warranty 0 to 60 months; sold price ₹1,000 to ₹10,00,000. States: initial, loading, success, empty (generic tips), error, partial (many unknowns), offline, permission denied (n/a).

