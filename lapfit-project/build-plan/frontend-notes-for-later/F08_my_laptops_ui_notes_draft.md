# F08_my_laptops: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

| Screen | Purpose | Entry | Exit |
|---|---|---|---|
| S1 Mine | List and add | Tab "Mine" | Owners, Sell, form |

| Component | Purpose | Action | Data | API | States |
|---|---|---|---|---|---|
| Banner and "saved on this device" note | Honesty | — | — | — | Always |
| Laptop card | Name, version, months owned, warranty, price now, resale, reports, issues | Buttons | Summary | `POST /garage` | Loaded; partial; catalog-missing |
| Add form | Version select, date, optional price | Add | Catalog list | `GET /catalog` | Initial (today's date); error |
| Empty state | "No laptops yet" | Add | — | — | Shown when empty |
| Buttons | Owners, share, sell, remove | Tap | — | — | Share appears after 1 month |
| Export and import (V1) | Backup | Tap | File | — | Idle; error |

Validation: date not after today; price paid 1 to 1,00,00,000; version must exist. UI states: initial, loading, success, empty, error, partial (no computed figures), offline (saved facts only), permission denied (n/a).

