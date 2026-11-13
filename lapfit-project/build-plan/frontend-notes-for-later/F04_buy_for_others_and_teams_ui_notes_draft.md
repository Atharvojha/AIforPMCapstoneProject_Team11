# F04_buy_for_others_and_teams: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

| Screen | Purpose | Entry | Exit |
|---|---|---|---|
| S1 Home ask box and answer panel | Start and answers | Home | Find, compare |
| S2 Question panel | One question with tappable answers | Router | Results |
| S3 Team result | Table, totals, notes | Team request | Compare, copy |
| S4 Team table editor (V1) | Edit rows before running | "Edit table" | S3 |

| Component | Purpose | User action | Data | API | States |
|---|---|---|---|---|---|
| Question buttons | Recipient and use | Tap | Choices | `POST /query` | Loaded; answered buttons disabled |
| Persona chips | Show and edit defaults | Tap to cycle Should or Nice, × to remove | Chips | `POST /query` (needs) | Normal; empty |
| Cards (3) | Single-person result | Expand, compare | Cards | — | As F01 |
| Team table | One row per role: role, people, use, laptop, price each, subtotal | Tap a laptop name to open its card | Rows | — | Loaded; "Nothing fits" row; gate-dropped row |
| Totals line | Total, budget, difference | — | Totals | — | Under; over (with savings, V1); no budget given |
| Notice | Roles left out, assumptions | — | Notes | — | Hidden if none |
| Editable table (V1) | Fix rows | Edit cells, add or delete rows | Rows | `POST /query` (team) | Valid; row error |
| Copy summary (V1) | Plain-text copy | Tap | Text | — | Idle; copied |

| Field | Validation | Message |
|---|---|---|
| Table lines | 1 to 30 roles | "Please keep to 30 roles or fewer." |
| People | Whole number 1 to 500 | "People must be a number from 1 to 500." |
| Budget each, total | ₹5,000 to ₹10,00,000 each; total up to ₹10 crore | "I could not read that budget." |
| Role | 1 to 60 characters | — |

UI states: initial (no table), loading, success, empty ("Paste one line per role"), error (line-level), partial (some roles missing), offline, permission denied (n/a).

