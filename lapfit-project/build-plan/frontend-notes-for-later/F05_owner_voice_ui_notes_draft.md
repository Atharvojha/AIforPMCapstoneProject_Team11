# F05_owner_voice: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

| Screen | Purpose | Entry | Exit |
|---|---|---|---|
| S1 Owners | Filter and read | Tab "Owners"; links from Market, Mine, cards, claim rows | Compare, Find, Mine |
| S2 Add my experience | Form (F06) | Button on S1 | S1 |

| Component | Purpose | User action | Data | API | States |
|---|---|---|---|---|---|
| Filter bar | Six selects | Change | Option lists | `POST /query` (`ownerFilters`) | Initial from link or "Any"; Loading dims results |
| Applied-filter badges | Show what is on | — | Labels | — | Hidden when none |
| Lens note | "A lens on owner reports, not a ranking of laptops" | — | — | — | Always |
| Laptop row | Name, n badge, rating, topics, sources | "Only this laptop" | Row | — | Enough; Not enough evidence; Empty |
| Excerpt list | Quotes with source, user type, months, date, region | Tap link; report | Excerpts | — | Visible only if n ≥ 20 |
| Loosen buttons | Relax one filter | Tap | Offers | `POST /query` | Only when empty |
| Lens preselection (new) | "Developers, because you chose coding" | Remove | Use | — | Visible when arrived from a use |
| Summarise (V2) | Optional | Tap | Rows | `POST /query` | Idle; loading; shown; fallback |

Validation: select values only from the lists; typed questions up to 4,000 characters. UI states: initial (all laptops), loading, success, empty (with loosen buttons), error, partial (some laptops below 20), offline, permission denied (n/a).

