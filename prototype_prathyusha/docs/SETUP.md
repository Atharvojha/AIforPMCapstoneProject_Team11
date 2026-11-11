# SETUP — run LapFit locally (macOS, Apple Silicon)

Prereqs: Python 3.14 (`/opt/homebrew/bin/python3.14`), Node 20, Ollama with `llama3.1` (`ollama list` shows `llama3.1:latest`).

```bash
cd prototype_prathyusha
cp .env.example .env              # then open .env and replace tvly-REPLACE_ME with your Tavily key (live research, not built yet); never commit .env
open -e .env                      # opens the hidden file in TextEdit (Finder hides dotfiles: Cmd+Shift+. shows them)
python3.14 -m venv .venv && .venv/bin/pip install pydantic fastapi httpx numpy pandas python-dotenv pytest "uvicorn[standard]" trafilatura beautifulsoup4 rank-bm25 sentence-transformers

# data (needs network; skip if lapfit_data_pack/datasets/processed already exists)
python3 lapfit_data_pack/download_datasets.py --small --pcbox && python3 lapfit_data_pack/build_laptop_extract.py

# build the database (derived data; rebuilds from scratch) — downloads the embedding model on first run
cd backend && ../.venv/bin/python -m lapfit.ingest

# owner-review extraction (slow, resumable; ~20-30 s/review on an 8B model). Example: one laptop
../.venv/bin/python -m lapfit.extraction --variant FKL-11
../.venv/bin/python -c "from lapfit.db import connect; from lapfit.extraction import reguard_stored; print(reguard_stored(connect()))"

# API (port 8000) and frontend (port 5173)
cd .. && .venv/bin/uvicorn lapfit.api:app --app-dir backend --port 8000
cd frontend && npm install && npm run dev
```
Tests: `cd backend && ../.venv/bin/python -m pytest -q tests` (first run builds a temp DB and embeddings, ~30 s). Frontend types: `cd frontend && npx tsc -b`.
Benchmarks: `python3 eval/bench_llm_extraction.py llama3.1:latest`, `.venv/bin/python eval/bench_embeddings.py sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
Notes: the macOS default Python 3.9 fails some legacy tests; use the venv. Network is slow here (CH-018): model and package downloads can take long and may need retries.

Dev-only live-research stub (real fetching, fake search): `LAPFIT_DEV_FAKE_SEARCH=1 LAPFIT_DEV_FAKE_URLS="https://www.asus.com/...techspec/" uvicorn ...`. Never use it for real use.
Never run `python -m lapfit.ingest` while extraction is running (it now refuses). Claim eval: `.venv/bin/python eval/run_claim_eval.py`.

## Added 2026-11-11: reading reviews for ratings
`cd backend && ../.venv/bin/python -m lapfit.topic_reader` reads every catalogue laptop (about 2,150 reviews, about 90 minutes; resumable; `--variant FKL-10` for one laptop; `--limit N` for a test). Needs Ollama running. Output goes to `backend/data/votes.db` and survives `python -m lapfit.ingest`. Evaluate: `python eval/run_topic_eval.py`, `python eval/run_needs_eval.py`.


## Final state (2026-11-11)
- **Ollama must be running with `llama3.1`** for two things: reading reviews (`python -m lapfit.topic_reader`) and splitting pasted listings in Check a listing. If it is off the page still works with a rule-based splitter and says so.
- **Needs sheet and listing check need no extra setup.** The browser stores your needs sheet; nothing about pasted listings is saved on the server.
- **Tavily key** (`.env`, `TAVILY_API_KEY`) is needed only for "Look it up online"; never paste it into chat or code; free quota 1,000 credits a month; lookups are never automatic.
- **Backups:** `python -m lapfit.ingest` backs the live database up to `backend/data/backups/` first. Build new loaders into a scratch database before touching the live one (CH-035).
- **Checks:** `cd backend && ../.venv/bin/python -m pytest -q tests` (228); with the API running `.venv/bin/python eval/run_e2e_check.py` (39); `.venv/bin/python eval/run_listing_eval.py eval/golden/g_listing_v3_fresh.json [--model]`; frontend types `cd frontend && npx tsc --noEmit -p .` with Node at `~/.local/node-v20.20.2/bin`.
- Frontend dev server on 127.0.0.1:5173 proxies `/api` to port 8000.

## Committed databases (2026-11-11)
`backend/data/lapfit.db` and `backend/data/votes.db` are in the repo, so after cloning you can skip the ingest and the 90-minute reading and go straight to the API. `python -m lapfit.ingest` rebuilds `lapfit.db` (and backs the old one up first). Never delete `votes.db`: it is the only copy of the reader's work. WAL/SHM files and backups are not committed.
