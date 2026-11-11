"""Local embeddings via sentence-transformers (no training). Vectors are L2-normalised float32.

The model name is stored with every vector; never mix models in one search (see DATA_DICTIONARY)."""
from __future__ import annotations

import sqlite3
import threading

import numpy as np

from .config import settings

_lock = threading.Lock()
_models: dict[str, object] = {}


def _prefixes(name: str) -> tuple[str, str]:
    return ("query: ", "passage: ") if "e5" in name.lower() else ("", "")


def _load(name: str):
    with _lock:
        if name not in _models:
            import torch
            from sentence_transformers import SentenceTransformer
            dev = "mps" if torch.backends.mps.is_available() else "cpu"
            _models[name] = SentenceTransformer(name, device=dev)
        return _models[name]


class Embedder:
    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.embed_model
        self._qp, self._pp = _prefixes(self.model_name)

    @property
    def dim(self) -> int:
        return int(_load(self.model_name).get_sentence_embedding_dimension())

    def encode(self, texts: list[str], kind: str = "passage", batch_size: int = 64) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        p = self._qp if kind == "query" else self._pp
        v = _load(self.model_name).encode([p + t for t in texts], normalize_embeddings=True, convert_to_numpy=True,
                                          show_progress_bar=False, batch_size=batch_size)
        return v.astype(np.float32)


def to_blob(v: np.ndarray) -> bytes:
    return np.asarray(v, dtype=np.float32).tobytes()


def from_blob(b: bytes, dim: int) -> np.ndarray:
    return np.frombuffer(b, dtype=np.float32, count=dim)


def load_matrix(conn: sqlite3.Connection, owner_type: str, model_name: str, owner_ids: list[str] | None = None):
    """Return (ids, matrix) for stored vectors of one model. Optionally restricted to owner_ids."""
    rows = conn.execute("SELECT owner_id, dim, vector FROM embeddings WHERE owner_type=? AND model_name=?",
                        (owner_type, model_name)).fetchall()
    if owner_ids is not None:
        keep = set(owner_ids)
        rows = [r for r in rows if r["owner_id"] in keep]
    if not rows:
        return [], np.zeros((0, 0), dtype=np.float32)
    return [r["owner_id"] for r in rows], np.stack([from_blob(r["vector"], r["dim"]) for r in rows])
