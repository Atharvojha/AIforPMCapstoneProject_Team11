# F10_brand_insights: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

| Screen | Purpose | Entry | Exit |
|---|---|---|---|
| S1 Sign-in | Authenticate | Link "For brands" | S2 |
| S2 Insights | The views | After sign-in | Export |
| S3 Terms | Terms and notice | Footer, first sign-in | — |
| A1 Admin: brands | Manage | Admin | — |

| Component | Purpose | Action | Data | API | States |
|---|---|---|---|---|---|
| Sample-data banner | Honesty | — | — | — | Shown on sample data |
| Model selector | Choose a model | Select | Models | `GET /brand/models` | Loaded; empty |
| Tiles (4) | Rating, checks, complaints, price falls | — | Summary | `GET /brand/insights` | Loaded; "None" |
| Heatmap table | Rating and n per cell | Tap a cell | Matrix | same | Normal; early signal (dashed); hidden |
| Price chart | Lines per version with legend | Toggle | Series | same | Loaded; no data |
| Checks bars | Eight weeks | — | Weeks | same | Loaded |
| Complaints list | Topic, n, prior | — | List | same | Loaded; none |
| Demand panel | Bands, uses, Musts | — | Aggregates | `GET /brand/demand` | Loaded; suppressed |
| Unmet-demand list | Briefs | — | List | same | Loaded; none |
| Export buttons (V1) | CSV | Tap | File | `GET /brand/export` | Idle; done |

Validation: model id must be one of the user's. Charts have text alternatives; numbers are readable text. States: initial, loading, success, empty, error, partial (some cells suppressed), offline, permission denied (clear message).

