# F07_market_pulse: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

| Screen | Purpose | Entry | Exit |
|---|---|---|---|
| S1 Market | The three lists | Top link "Market"; Home tiles | Owners |
| S2 Home tiles | Preview | Home | S1 |

| Component | Purpose | Action | Data | API | States |
|---|---|---|---|---|---|
| Window selector | Choose 7, 30, 90 | Tap | Choices | `POST /query` (`trending`) | Selected; Loading |
| Explainer line | "Worked out from checks, owner reports and recorded prices. In this prototype the activity is sample data." | — | — | — | Always |
| Most checked list | Rank, name, checks, previous window | Tap | Items | — | Loaded; empty |
| Rising complaints list | Laptop, topic, n, prior | Tap | Items | — | Loaded; empty; early-signal tag |
| Price drops list | Version, price now with date, drop, was with date | Tap | Items | — | Loaded; empty |
| "See owner reports" | Deep link | Tap | Laptop | — | — |
| Home tiles (3) | Previews | Tap | Snapshot | `GET /home` | Data; "No data" |

Validation: window must be one of the settings choices. UI states: initial (30 days), loading, success, empty per list, error, partial (one list empty), offline, permission denied (n/a).

