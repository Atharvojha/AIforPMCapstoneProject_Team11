# F06_add_my_experience: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

| Screen | Purpose | Entry | Exit |
|---|---|---|---|
| S1 Form (inside Owners) | Submit a report | "Add my experience" | Confirmation |
| S2 Confirmation | Receipt code, what happens next | After submit | Status page, Owners |
| S3 Status page | Status and deletion | Link or `/status` | — |
| A1 Reviewer queue | Approve or reject | Admin menu | — |

| Component | Purpose | Action | Data | API | States |
|---|---|---|---|---|---|
| Notice | Data protection notice | Read | Notice text | `GET /config` | Always |
| Age checkbox | Confirm 18 or older | Tick | — | — | Unticked blocks submit |
| Laptop, use, months, topic, rating selects and inputs | The report | Choose | Lists | `GET /catalog` | Initial; error per field |
| Note textarea with counter | The text | Type | 10 to 300 characters | — | Initial; over limit; rejected for contact details |
| Send button | Submit | Tap | Form | `POST /submit-report` | Disabled until valid and ticked; sending |
| Receipt panel | Shows the code once | Copy | Code | — | Shown once |
| Status form | Enter code | Submit | Code | `POST /report-status` | Pending, approved, rejected (reason), not found |
| Delete button | Request deletion | Confirm | Code | `POST /report-delete` | Confirm dialog; done |
| Queue table (admin) | Pending reports with flags | Approve, reject | Rows | Admin APIs | Empty ("Nothing waiting"); loading; permission denied |

Validation: note 10 to 300 characters; months 0 to 120; rating 1 to 5; the checkbox required. Messages are plain and say what to fix.

