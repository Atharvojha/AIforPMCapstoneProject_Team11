#!/usr/bin/env python3
"""Extract ONLY laptop products + their reviews from Amazon Reviews'23 (McAuley Lab).

Streams the raw Electronics files (meta ~1.3 GB, reviews ~6.5 GB); nothing is stored but the filtered CSVs.
Laptop = category path contains 'Computers & Tablets > Laptops' (accessories like bags/skins are excluded).
Reviewer ids are dropped. Output: datasets/processed/amazon_laptop_{meta,reviews}.csv
    python3 build_amazon_laptop_reviews.py [--min-ratings 20]
"""
import argparse, csv, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
from extract_amazon_laptops import stream_lines, META, REVIEWS  # resumable HTTP line streamer

OUT = Path(__file__).resolve().parent / "datasets" / "processed"
LAPTOP_PATH = "computers & tablets > laptops"


def run(min_ratings):
    OUT.mkdir(parents=True, exist_ok=True)
    asins, n, titles = {}, 0, {}
    with open(OUT / "amazon_laptop_meta.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["parent_asin", "title", "price_usd", "average_rating", "rating_number", "store", "categories", "details_json"])
        for ln in stream_lines(META):
            n += 1
            try:
                d = json.loads(ln)
            except Exception:
                continue
            cats = d.get("categories") or []
            if not any(LAPTOP_PATH in c.lower() for c in cats) or (d.get("rating_number") or 0) < min_ratings:
                continue
            det = {k: v for k, v in (d.get("details") or {}).items() if isinstance(v, (str, int, float))}
            asins[d["parent_asin"]] = 0
            w.writerow([d["parent_asin"], d.get("title"), d.get("price"), d.get("average_rating"),
                        d.get("rating_number"), d.get("store"), " > ".join(cats), json.dumps(det)[:2000]])
    print(f"META DONE: {n} scanned, {len(asins)} laptops", flush=True)

    kept = n = 0
    with open(OUT / "amazon_laptop_reviews.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["parent_asin", "asin", "rating", "title", "text", "timestamp_ms", "helpful_vote", "verified_purchase"])
        for ln in stream_lines(REVIEWS):
            n += 1
            i = ln.find(b'"parent_asin": "')
            if i < 0 or ln[i + 16:i + 26].decode("ascii", "ignore") not in asins:
                continue
            try:
                d = json.loads(ln)
            except Exception:
                continue
            asins[d["parent_asin"]] += 1
            kept += 1
            w.writerow([d["parent_asin"], d.get("asin"), d.get("rating"), d.get("title"), d.get("text"),
                        d.get("timestamp"), d.get("helpful_vote"), d.get("verified_purchase")])
            if kept % 5000 == 0:
                f.flush(); print(f"  kept {kept} reviews", flush=True)
    print(f"REVIEWS DONE: {n} scanned, {kept} kept across {sum(1 for v in asins.values() if v)} laptops", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(); p.add_argument("--min-ratings", type=int, default=20)
    run(p.parse_args().min_ratings)
