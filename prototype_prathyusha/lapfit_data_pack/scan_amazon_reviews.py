#!/usr/bin/env python3
"""Parallel, resumable scan of Amazon Reviews'23 Electronics reviews for known laptop ASINs.

ASINs come from data/amazon_laptop_meta.csv (rows under 'Computers & Tablets > Laptops').
The 22.6 GB file is split into byte-range chunks; each worker retries on its own and writes
<work>/chunks/NNNN.csv + NNNN.done. Re-running skips finished chunks. `merge` builds
datasets/processed/amazon_laptop_{meta,reviews}.csv. `status` shows progress.
    python3 scan_amazon_reviews.py run [workers] | status | merge
"""
import csv, glob, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parents[1]
URL = "https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/resolve/main/raw/review_categories/Electronics.jsonl"
SIZE = 22616233652
CHUNK = 200_000_000
WORK = Path(os.environ.get("AMZ_WORK", HERE / "datasets" / "_amazon_work")); (WORK / "chunks").mkdir(parents=True, exist_ok=True)
OUT = HERE / "datasets" / "processed"
META = PROJ / "data" / "amazon_laptop_meta.csv"
COLS = ["parent_asin", "asin", "rating", "title", "text", "timestamp_ms", "helpful_vote", "verified_purchase"]


def laptops():
    return [r for r in csv.DictReader(open(META, encoding="utf-8")) if "computers & tablets > laptops" in r["categories"].lower()]


def scan_chunk(idx, asins):
    start, end = idx * CHUNK, min((idx + 1) * CHUNK, SIZE)
    done, part = WORK / "chunks" / f"{idx:04d}.done", WORK / "chunks" / f"{idx:04d}.csv"
    if done.exists():
        return
    rows, pos, buf, first = [], start, b"", idx > 0   # first: discard partial line at chunk start
    while True:
        try:
            req = urllib.request.Request(URL, headers={"Range": f"bytes={pos}-{min(end + 4_000_000, SIZE) - 1}", "User-Agent": "capstone-research"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                while True:
                    c = resp.read(1 << 20)
                    if not c:
                        break
                    buf += c
                    *lines, buf = buf.split(b"\n")
                    for ln in lines:
                        ln_start, pos = pos, pos + len(ln) + 1
                        if first:
                            first = False
                            if idx > 0 and start == ln_start:  # chunk starts exactly on a line? (kept only if prev byte is \n; rare) -> drop, prev chunk owns it
                                pass
                            continue
                        if ln_start >= end:
                            raise StopIteration
                        i = ln.find(b'"parent_asin": "')
                        if i >= 0 and ln[i + 16:i + 26].decode("ascii", "ignore") in asins:
                            d = json.loads(ln)
                            rows.append([d.get(k) if k != "timestamp_ms" else d.get("timestamp") for k in COLS])
                if pos >= end:
                    raise StopIteration
                # stream ended early -> loop and resume at pos
                buf = b""
        except StopIteration:
            break
        except Exception:
            buf = b""
            time.sleep(3)
    with open(part, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    done.write_text(str(len(rows)))


def run(workers):
    asins = {r["parent_asin"] for r in laptops()}
    n = (SIZE + CHUNK - 1) // CHUNK
    print(f"{len(asins)} laptop ASINs, {n} chunks, {workers} workers", flush=True)
    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(lambda i: scan_chunk(i, asins), range(n)))
    print("ALL CHUNKS DONE", flush=True)


def status():
    n = (SIZE + CHUNK - 1) // CHUNK
    d = glob.glob(str(WORK / "chunks" / "*.done"))
    print(f"{len(d)}/{n} chunks done ({100*len(d)/n:.1f}% of file); reviews kept so far: {sum(int(open(x).read()) for x in d)}")


def merge():
    OUT.mkdir(parents=True, exist_ok=True)
    lap = laptops()
    meta_cols = ["parent_asin", "title", "price_usd", "average_rating", "rating_number", "store", "categories", "details_json"]
    with open(OUT / "amazon_laptop_meta.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, meta_cols); w.writeheader()
        for r in lap: w.writerow({k: r[k] for k in meta_cols})
    n = 0
    with open(OUT / "amazon_laptop_reviews.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(COLS)
        for p in sorted(glob.glob(str(WORK / "chunks" / "*.csv"))):
            if os.path.exists(p[:-4] + ".done"):
                for row in csv.reader(open(p, encoding="utf-8")): w.writerow(row); n += 1
    print(f"merged {n} reviews for {len(lap)} laptops")


if __name__ == "__main__":
    cmd = sys.argv[1]
    run(int(sys.argv[2]) if len(sys.argv) > 2 else 16) if cmd == "run" else {"status": status, "merge": merge}[cmd]()
