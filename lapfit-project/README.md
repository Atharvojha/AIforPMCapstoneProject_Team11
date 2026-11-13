# LapFit project

Everything built in this round, in one folder.

| Folder | What is in it | Start with |
|---|---|---|
| `prototype/` | Working app on sample data (Node, SQLite, Claude API): nine screens, eight flows, tests | `README.md`, then `npm install` and `npm run dev:offline` |
| `data-model/` | All the data LapFit gets and needs, including images, privacy and retention | `DATA_MODEL.md` |
| `jtbd-analysis/` | Jobs to be done, hidden assets, use cases, opportunity scoring | `JTBD_EXPANSION.md` |
| `build-plan/` | Backend build plan, accuracy without training, frontend jobs and triggers, architecture diagrams, the backend build log and the operations runbook | `01_BACKEND_BUILD_PLAN.md`, `05_BACKEND_BUILD_LOG.md` |
| `backend/` | The deployed backend: Supabase schema and SQL tools, the TypeScript orchestrator and flows, live reviews, rate limiting, import scripts, 209 tests | `README.md`, then `../build-plan/05_BACKEND_BUILD_LOG.md` |
| `frontend/` | The web app (React, Vite, TypeScript): ask, find, check, compare, sell, my laptops, share, market, about; 187 tests | `README.md` |
| `ai-prd/` | AI PRDs, one per feature, in the 13-part template, with shared cost and latency assumptions | `00_SHARED_ASSUMPTIONS.md` |
| `ai-spec/` | To-do, decisions (including the AI type per scenario), system prompts, feature specs, and one AI-anatomy document per feature | `00_INDEX.md` |

The other folders and files in `AIforPMCapstoneProject_Team11` (PRD, golden dataset, eval scripts, customer kit and so on) are the team's earlier work. Decision D-04 in `ai-spec/02_DECISIONS.md` (revised 13 Nov 2026) reuses the **data** in `prototype_prathyusha/` (see `build-plan/01_BACKEND_BUILD_PLAN.md`) but not the old code, labels or documents as specifications.


## Set up your own copy (what "git pull" does not give you)

The repo has the code, the migrations and the seed data. It does **not** have your database, your keys or a deployed backend. If the app looks different from someone else's (for example no **Show photo** button), one of these is missing:

1. **A Supabase project with every migration applied, in order** (`backend/supabase/migrations/`, 0001 to the latest). Migration 14 creates the picture table and **19 fills it** with the 42 product pictures, so the Show photo button appears. Pictures are third-party web images with an unverified licence; `FEATURE_FLAGS.web_images = false` turns them all off.
2. **The query function deployed from the same code** (`supabase functions deploy query`). An older deployed function does not send the newer fields (pictures, screen and weight, follow-up answers).
3. **Your own keys** as Supabase secrets (`GEMINI_API_KEY`, `TAVILY_API_KEY`, `SESSION_SALT`) and, in `frontend/.env.local`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (copy `.env.example`). Keys are never in the repo.
4. **Reviews and catalog data** loaded with the import scripts in `backend/scripts/` (the dataset is not committed).

To check a copy: open the app, ask for a laptop under 60k, and look at the first result. If it shows a drawing but no **Show photo** button, the picture table is empty (step 1) or the deployed function is old (step 2).
