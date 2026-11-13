# LapFit project

Everything built in this round, in one folder.

| Folder | What is in it | Start with |
|---|---|---|
| `prototype/` | Working app on sample data (Node, SQLite, Claude API): nine screens, eight flows, tests | `README.md`, then `npm install` and `npm run dev:offline` |
| `data-model/` | All the data LapFit gets and needs, including images, privacy and retention | `DATA_MODEL.md` |
| `jtbd-analysis/` | Jobs to be done, hidden assets, use cases, opportunity scoring | `JTBD_EXPANSION.md` |
| `build-plan/` | Backend build plan (data layer, tools, keys, order), accuracy without training, frontend jobs and triggers | `01_BACKEND_BUILD_PLAN.md` |
| `ai-prd/` | AI PRDs, one per feature, in the 13-part template, with shared cost and latency assumptions | `00_SHARED_ASSUMPTIONS.md` |
| `ai-spec/` | To-do, decisions (including the AI type per scenario), system prompts, feature specs, and one AI-anatomy document per feature | `00_INDEX.md` |

The other folders and files in `AIforPMCapstoneProject_Team11` (PRD, golden dataset, eval scripts, customer kit and so on) are the team's earlier work. Decision D-04 in `ai-spec/02_DECISIONS.md` (revised 13 Nov 2026) reuses the **data** in `prototype_prathyusha/` (see `build-plan/01_BACKEND_BUILD_PLAN.md`) but not the old code, labels or documents as specifications.
