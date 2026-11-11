#!/usr/bin/env python3
"""Embedding smoke test (not a retrieval-accuracy benchmark; that needs G-RET gold).

For each (anchor, positive, negative) triple the model must score cos(anchor, positive) > cos(anchor, negative).
Triples are SYNTHETIC test strings written for this check (English, Hinglish, shorthand, and near-miss topics such as
fan noise vs speaker sound). Also reports load time and encode throughput on 400 real Flipkart review texts.

    .venv/bin/python eval/bench_embeddings.py MODEL_NAME
"""
import csv, json, sys, time
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parents[1]
TRIPLES = [
    ("battery drains very fast", "backup sirf ek ghanta chalta hai", "screen is very bright"),
    ("the fan is too loud", "fan sounds like a jet engine", "speaker sound is poor"),
    ("laptop hangs when many tabs are open", "browser mein bahut tabs kholo toh slow ho jata hai", "keyboard feels nice"),
    ("Battery 5/5", "battery life is excellent", "delivery was late"),
    ("battery lasts one and a half hour", "ONE N HALF HOUR backup", "display has good colours"),
    ("gets very hot while gaming", "heating problem after 1 hour of use", "value for money"),
    ("RAM can be upgraded", "there is a free slot to add more memory", "camera quality is bad"),
    ("touchpad is not responsive", "trackpad kaam nahi karta", "price is too high"),
    ("screen is dim outdoors", "display brightness is low", "charger is heavy"),
    ("speaker sound is poor", "audio quality bekar hai", "the fan is too loud"),
    ("build feels cheap plastic", "body quality is flimsy", "windows 11 comes preinstalled"),
    ("good for coding and docker", "runs VS Code and containers smoothly", "heavy to carry"),
]


def prefixes(name):
    return ("query: ", "passage: ") if "e5" in name.lower() else ("", "")


def main():
    name = sys.argv[1]
    t0 = time.time(); m = SentenceTransformer(name, device="mps" if __import__("torch").backends.mps.is_available() else "cpu"); load_s = time.time() - t0
    qp, pp = prefixes(name)
    enc = lambda xs, p: m.encode([p + x for x in xs], normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
    a = enc([t[0] for t in TRIPLES], qp); pos = enc([t[1] for t in TRIPLES], pp); neg = enc([t[2] for t in TRIPLES], pp)
    sp = (a * pos).sum(1); sn = (a * neg).sum(1); win = sp > sn
    rows = list(csv.DictReader(open(ROOT / "lapfit_data_pack/datasets/processed/flipkart_laptop_reviews.csv", encoding="utf-8")))
    texts = [r["original_review_text"] for r in rows if r["original_review_text"].strip()][:400]
    t1 = time.time(); enc(texts, pp); dt = time.time() - t1
    out = {"model": name, "device": str(m.device), "dim": int(a.shape[1]), "load_s": round(load_s, 1),
           "triple_accuracy": f"{int(win.sum())}/{len(TRIPLES)}", "mean_margin": round(float((sp - sn).mean()), 3),
           "failed_triples": [TRIPLES[i][0] for i in range(len(TRIPLES)) if not win[i]],
           "encode_400_reviews_s": round(dt, 2), "reviews_per_s": round(len(texts) / dt, 1),
           "note": "Smoke test on synthetic triples; selection requires recall@k on G-RET."}
    Path(ROOT / "eval/results").mkdir(parents=True, exist_ok=True)
    json.dump(out, open(ROOT / f"eval/results/emb_smoke_{name.split('/')[-1]}.json", "w"), indent=2)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
