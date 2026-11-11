"""Hybrid retrieval over owner reviews: structured filter (variant) + FTS5 BM25 + vector cosine, fused with RRF.

Duplicate texts are collapsed to one hit carrying the cluster size, so repeated reviews never inflate evidence."""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field

import numpy as np

from .config import settings
from .embeddings import Embedder, load_matrix

# Query expansion per category: English + Hinglish/shorthand seen in the corpus. Deterministic, versionable.
CATEGORY_QUERIES: dict[str, str] = {
    "performance": "performance fast slow lag smooth hang processor speed multitasking tabs",
    "memory": "ram memory 8gb 16gb multitasking slow hang upgrade",
    "gpu": "graphics gpu gaming fps nvidia rtx gtx games rendering",
    "battery": "battery backup charge drain hours hour life charging mah",
    "display": "display screen brightness colour color panel resolution angle bright dim",
    "thermals_noise": "heat heating hot temperature fan noise loud noisy throttling warm",
    "portability": "weight heavy light portable carry thin lightweight",
    "keyboard_trackpad": "keyboard touchpad trackpad typing keys backlit",
    "ports_connectivity": "ports usb hdmi wifi bluetooth type-c connectivity",
    "upgradeability": "upgrade upgradable upgradeable ram slot ssd slot expandable",
    "build_reliability": "build quality plastic hinge body durable sturdy defect issue broke warranty service",
    "value": "value money price worth budget",
}


@dataclass
class Hit:
    review_id: str
    score: float
    text: str
    title: str | None
    rating: int | None
    dup_cluster_id: int | None
    cluster_size: int
    flag: str | None
    config_hint: str | None
    ranks: dict = field(default_factory=dict)


def _fts_query(q: str) -> str:
    toks = [t for t in re.findall(r"[\w']+", q.lower()) if len(t) > 1]
    return " OR ".join(f'"{t}"' for t in dict.fromkeys(toks)) or '""'


class Retriever:
    def __init__(self, conn: sqlite3.Connection, embedder: Embedder | None = None):
        self.conn = conn
        self.embedder = embedder or Embedder()
        self._cache: dict[str, tuple[list[str], np.ndarray]] = {}

    def _vectors(self, variant_id: str):
        if variant_id not in self._cache:
            ids = [r[0] for r in self.conn.execute("SELECT id FROM reviews WHERE variant_id=?", (variant_id,))]
            self._cache[variant_id] = load_matrix(self.conn, "review", self.embedder.model_name, ids)
        return self._cache[variant_id]

    def lexical(self, variant_id: str, query: str, n: int = 50) -> list[str]:
        rows = self.conn.execute(
            "SELECT review_id FROM fts_reviews WHERE fts_reviews MATCH ? AND variant_id = ? ORDER BY bm25(fts_reviews) LIMIT ?",
            (_fts_query(query), variant_id, n)).fetchall()
        return [r[0] for r in rows]

    def vector(self, variant_id: str, query: str, n: int = 50) -> list[tuple[str, float]]:
        ids, mat = self._vectors(variant_id)
        if not ids:
            return []
        q = self.embedder.encode([query], kind="query")[0]
        sims = mat @ q
        order = np.argsort(-sims)[:n]
        return [(ids[i], float(sims[i])) for i in order]

    def search(self, variant_id: str, query: str, k: int = 10, mode: str = "hybrid", rrf_k: int = 60) -> list[Hit]:
        lex = self.lexical(variant_id, query) if mode in ("hybrid", "lexical") else []
        vec = self.vector(variant_id, query) if mode in ("hybrid", "vector") else []
        fused: dict[str, float] = {}
        ranks: dict[str, dict] = {}
        for name, lst in (("lex", lex), ("vec", [i for i, _ in vec])):
            for r, rid in enumerate(lst, 1):
                fused[rid] = fused.get(rid, 0.0) + 1.0 / (rrf_k + r)
                ranks.setdefault(rid, {})[name] = r
        hits: list[Hit] = []
        seen_clusters: set[int] = set()
        for rid, sc in sorted(fused.items(), key=lambda kv: -kv[1]):
            row = self.conn.execute(
                """SELECT r.id, r.original_text, r.title, r.rating, r.dup_cluster_id, r.flag, r.config_mismatch_hint,
                          COALESCE(c.size,1) AS csize FROM reviews r LEFT JOIN dup_clusters c ON c.id=r.dup_cluster_id WHERE r.id=?""", (rid,)).fetchone()
            cid = row["dup_cluster_id"]
            if cid is not None:
                if cid in seen_clusters:
                    continue
                seen_clusters.add(cid)
            hits.append(Hit(row["id"], sc, row["original_text"], row["title"], row["rating"], cid, row["csize"], row["flag"],
                            row["config_mismatch_hint"], ranks[rid]))
            if len(hits) >= k:
                break
        return hits
