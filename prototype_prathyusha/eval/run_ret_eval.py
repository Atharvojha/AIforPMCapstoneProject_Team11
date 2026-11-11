#!/usr/bin/env python3
"""Retrieval ablation on the 40 labelled reviews (relevance = my independent category labels in g_ext_v0.json).
Ranks the 40-review pool with BM25 only, vector (MiniLM, stored embeddings) only, and RRF hybrid, for 3 paraphrased queries per topic.
Small pool (40 docs): an ablation signal, not a benchmark."""
import json, re, sys
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "backend"))
from rank_bm25 import BM25Okapi  # noqa: E402
from lapfit.db import connect  # noqa: E402
from lapfit.embeddings import Embedder, from_blob  # noqa: E402
G = json.load(open(ROOT / "eval/golden/g_ext_v0.json"))["items"]; c = connect(); emb = Embedder()
ids = [g["review_id"] for g in G]; text = {i: c.execute("SELECT original_text FROM reviews WHERE id=?", (i,)).fetchone()[0] for i in ids}
vec = {r["owner_id"]: from_blob(r["vector"], r["dim"]) for r in c.execute("SELECT owner_id,dim,vector FROM embeddings WHERE owner_type='review' AND model_name=?", (emb.model_name,)) if r["owner_id"] in text}
tok = lambda s: re.findall(r"[a-z0-9']+", s.lower())
bm = BM25Okapi([tok(text[i]) for i in ids]); M = np.stack([vec[i] for i in ids])
Q = {"battery": ["how long does the battery last", "does it run out of charge quickly", "backup time when unplugged"],
     "performance": ["is it fast and smooth", "does the laptop lag or hang", "processor speed for everyday work"],
     "display": ["how is the screen quality", "is the display good", "screen brightness and picture"],
     "build_reliability": ["is the build quality good", "does it feel durable or flimsy", "plastic body strength"],
     "value": ["is it worth the money", "good for the price", "value for budget"]}
rel = {cat: {g["review_id"] for g in G if any(x["category"] == cat for x in g["gold"])} for cat in Q}
def rank(method, q):
    s_b = bm.get_scores(tok(q)); s_v = M @ emb.encode([q], kind="query")[0]
    rb = {ids[i]: r for r, i in enumerate(np.argsort(-s_b), 1)}; rv = {ids[i]: r for r, i in enumerate(np.argsort(-s_v), 1)}
    if method == "lexical": sc = {i: -rb[i] for i in ids}
    elif method == "vector": sc = {i: -rv[i] for i in ids}
    else: sc = {i: 1 / (60 + rb[i]) + 1 / (60 + rv[i]) for i in ids}
    return sorted(ids, key=lambda i: -sc[i])
def metrics(order, R):
    top5 = order[:5]; p5 = sum(i in R for i in top5) / 5; r10 = sum(i in R for i in order[:10]) / len(R)
    ap = sum((k + 1 and sum(j in R for j in order[:k + 1]) / (k + 1)) for k, i in enumerate(order) if i in R) / len(R)
    return p5, r10, ap
out = {}
for m in ("lexical", "vector", "hybrid"):
    P, R_, A = [], [], []
    for cat, qs in Q.items():
        for q in qs:
            p5, r10, ap = metrics(rank(m, q), rel[cat]); P.append(p5); R_.append(r10); A.append(ap)
    out[m] = {"precision@5": round(float(np.mean(P)), 3), "recall@10": round(float(np.mean(R_)), 3), "MAP": round(float(np.mean(A)), 3)}
summary = {"pool": len(ids), "queries": sum(len(v) for v in Q.values()), "relevant_per_topic": {k: len(v) for k, v in rel.items()}, "results": out,
           "note": "AI-drafted labels, 40-doc pool, no Hinglish in the corpus (0/3300), embeddings = multilingual MiniLM"}
json.dump(summary, open(ROOT / "eval/results/ret_eval_latest.json", "w"), indent=1); print(json.dumps(summary, indent=1))
