"""Stream the public Amazon Reviews 2023 (McAuley Lab) files and keep only laptop rows.

Nothing but the filtered CSVs is written to disk. Streams over HTTP with Range-based resume.
Reviewer ids are dropped on purpose.

    python3 src/extract_amazon_laptops.py meta     # -> data/amazon_laptop_meta.csv
    # then pick candidate laptops into data/amazon_candidates.csv (column parent_asin)
    python3 src/extract_amazon_laptops.py reviews  # -> data/amazon_laptop_reviews.csv
Source: https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023  (license not stated on the page; course use only)
"""
import csv
import json
import os
import sys
import time
import urllib.request

BASE = "https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/resolve/main/raw"
META = f"{BASE}/meta_categories/meta_Electronics.jsonl"
REVIEWS = f"{BASE}/review_categories/Electronics.jsonl"
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
MIN_RATINGS = 200          # ignore obscure listings
MAX_REVIEWS_PER_ASIN = 600


def stream_lines(url, log_every=500_000_000):
    """Yield complete lines (bytes); reconnect and resume from the last full line on errors."""
    offset, done = 0, False
    buf = b""
    last_log = 0
    while not done:
        req = urllib.request.Request(url, headers={"Range": f"bytes={offset}-", "User-Agent": "capstone-research"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                while True:
                    chunk = resp.read(1 << 20)
                    if not chunk:
                        done = True
                        break
                    buf += chunk
                    *lines, buf = buf.split(b"\n")
                    for ln in lines:
                        offset += len(ln) + 1
                        yield ln
                    if offset - last_log >= log_every:
                        last_log = offset
                        print(f"  {offset/1e9:.2f} GB read", flush=True)
        except Exception as e:  # network drop: resume from last full line
            print(f"  connection issue ({e}); resuming at byte {offset}", flush=True)
            buf = b""
            time.sleep(5)
    if buf.strip():
        yield buf


def run_meta():
    os.makedirs(DATA, exist_ok=True)
    out = os.path.join(DATA, "amazon_laptop_meta.csv")
    n = kept = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["parent_asin", "title", "price_usd", "average_rating", "rating_number", "store",
                    "categories", "details_json"])
        for ln in stream_lines(META):
            n += 1
            try:
                d = json.loads(ln)
            except Exception:
                continue
            cats = d.get("categories") or []
            if not any("laptop" in c.lower() for c in cats):
                continue
            if (d.get("rating_number") or 0) < MIN_RATINGS:
                continue
            kept += 1
            det = d.get("details") or {}
            keep = {k: v for k, v in det.items() if isinstance(v, (str, int, float))}
            w.writerow([d.get("parent_asin"), d.get("title"), d.get("price"), d.get("average_rating"),
                        d.get("rating_number"), d.get("store"), " > ".join(cats), json.dumps(keep)[:1500]])
    print(f"meta done: {n} rows scanned, {kept} laptop-ish rows kept -> {out}")


def run_reviews():
    cand = os.path.join(DATA, "amazon_candidates.csv")
    asins = {r["parent_asin"] for r in csv.DictReader(open(cand, encoding="utf-8"))}
    out = os.path.join(DATA, "amazon_laptop_reviews.csv")
    counts = {}
    n = kept = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["parent_asin", "rating", "title", "text", "timestamp_ms", "helpful_vote", "verified_purchase"])
        for ln in stream_lines(REVIEWS):
            n += 1
            # cheap pre-filter before JSON parse
            i = ln.find(b'"parent_asin": "')
            if i < 0:
                continue
            asin = ln[i + 16:i + 26].decode("ascii", "ignore")
            if asin not in asins or counts.get(asin, 0) >= MAX_REVIEWS_PER_ASIN:
                continue
            try:
                d = json.loads(ln)
            except Exception:
                continue
            counts[asin] = counts.get(asin, 0) + 1
            kept += 1
            w.writerow([asin, d.get("rating"), d.get("title"), d.get("text"), d.get("timestamp"),
                        d.get("helpful_vote"), d.get("verified_purchase")])
            if kept % 5000 == 0:
                f.flush()
                print(f"  kept {kept} reviews so far", flush=True)
    print(f"reviews done: {n} rows scanned, {kept} kept for {len(counts)} laptops -> {out}")


if __name__ == "__main__":
    {"meta": run_meta, "reviews": run_reviews}[sys.argv[1]]()
