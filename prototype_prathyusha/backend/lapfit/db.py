"""SQLite access + versioned migrations (raw SQL files in backend/migrations)."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import settings


def connect(path: Path | str | None = None) -> sqlite3.Connection:
    p = Path(path) if path else settings.db_path
    if str(p) != ":memory:":
        p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(p), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if str(p) != ":memory:":
        conn.execute("PRAGMA journal_mode = WAL")
    return conn


def migrate(conn: sqlite3.Connection, migrations_dir: Path | None = None) -> list[str]:
    """Apply any not-yet-applied NNN_*.sql files in order. Returns versions applied now."""
    mdir = migrations_dir or settings.migrations
    conn.execute("CREATE TABLE IF NOT EXISTS _bootstrap (x INTEGER)")
    have = set()
    try:
        have = {r[0] for r in conn.execute("SELECT version FROM schema_migrations")}
    except sqlite3.OperationalError:
        pass
    applied = []
    for f in sorted(mdir.glob("[0-9][0-9][0-9]_*.sql")):
        if f.stem in have:
            continue
        conn.executescript(f.read_text(encoding="utf-8"))
        conn.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, datetime('now'))", (f.stem,))
        conn.commit()
        applied.append(f.stem)
    return applied


@contextmanager
def tx(conn: sqlite3.Connection):
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
