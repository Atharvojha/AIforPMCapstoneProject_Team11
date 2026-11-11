"""Central configuration. Secrets come only from the environment / .env (never committed)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:  # optional: .env support
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None

ROOT = Path(__file__).resolve().parents[2]          # prototype_prathyusha/
if load_dotenv:
    load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    db_path: Path = Path(os.environ.get("LAPFIT_DB", ROOT / "backend" / "data" / "lapfit.db"))
    data_pack: Path = ROOT / "lapfit_data_pack"
    processed: Path = ROOT / "lapfit_data_pack" / "datasets" / "processed"
    curated: Path = ROOT / "lapfit_data_pack" / "datasets" / "curated"
    migrations: Path = ROOT / "backend" / "migrations"
    ollama_host: str = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    llm_model: str = os.environ.get("LAPFIT_LLM_MODEL", "llama3.1:latest")
    embed_model: str = os.environ.get("LAPFIT_EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    prompt_version: str = "extract-v2"
    ingestion_version: str = "ing-1"
    tavily_key: str | None = os.environ.get("TAVILY_API_KEY") or None
    admin_token: str = os.environ.get("LAPFIT_ADMIN_TOKEN", "change-me")


settings = Settings()
