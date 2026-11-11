#!/usr/bin/env python3
"""Download public LapFit research datasets into datasets/downloaded/.

This script fetches published research-dataset files only. It does not scrape
retail sites, Reddit, YouTube, LaptopMedia or any other web pages.
Check each source's current licence/terms before reuse or redistribution.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from typing import Iterable

import requests

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "datasets" / "downloaded"
USER_AGENT = "LapFit-Research-Data-Pack/1.0 (dataset retrieval; contact not configured)"

SOURCES = {
    "flipkart": {
        "url": "https://zenodo.org/records/17612521/files/data.zip?download=1",
        "filename": "flipkart_review_dataset_zenodo_17612521.zip",
        "expected_md5": "9d5c74f10a02c69b8da49f9d6b403df0",
    },
    "pcbox": {
        "url": "https://zenodo.org/records/14060666/files/products_pcbox.csv?download=1",
        "filename": "products_pcbox_zenodo_14060666.csv",
        "expected_md5": "8de800abc9198de59eaebad27aacb728",
    },
    "mendeley": {
        # api.data.mendeley.com/.../zip/file_downloaded returns 401; this public endpoint works.
        "url": "https://data.mendeley.com/public-api/zip/2pv6d8fz7y/download/2",
        "filename": "amazon_india_extraction_mendeley_2pv6d8fz7y_v2.zip",
        "expected_md5": None,
    },
    "amazon_2023_electronics_reviews": {
        "url": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/review_categories/Electronics.jsonl.gz",
        "filename": "amazon_reviews_2023_electronics_reviews.jsonl.gz",
        "expected_md5": None,
    },
    "amazon_2023_electronics_metadata": {
        "url": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/meta_categories/meta_Electronics.jsonl.gz",
        "filename": "amazon_reviews_2023_electronics_metadata.jsonl.gz",
        "expected_md5": None,
    },
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def md5_file(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download(name: str, timeout: int = 60) -> Path:
    spec = SOURCES[name]
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / spec["filename"]
    headers = {"User-Agent": USER_AGENT}
    print(f"Downloading {name}: {spec['url']}")
    with requests.get(spec["url"], headers=headers, stream=True, timeout=timeout, allow_redirects=True) as r:
        r.raise_for_status()
        content_type = r.headers.get("content-type", "").lower()
        if "text/html" in content_type:
            raise RuntimeError(
                f"Server returned HTML rather than a data file for {name}. "
                "Open the dataset landing page and download it manually."
            )
        tmp = dest.with_suffix(dest.suffix + ".part")
        total = 0
        with tmp.open("wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    total += len(chunk)
        if total == 0:
            tmp.unlink(missing_ok=True)
            raise RuntimeError(f"Downloaded an empty file for {name}")
        tmp.replace(dest)
    expected = spec.get("expected_md5")
    if expected:
        actual = md5_file(dest)
        if actual.lower() != expected.lower():
            raise RuntimeError(
                f"MD5 mismatch for {name}: expected {expected}, got {actual}. "
                "Keep the file for inspection but do not treat it as verified."
            )
    print(f"Saved: {dest} ({dest.stat().st_size:,} bytes)")
    print(f"SHA-256: {sha256_file(dest)}")
    return dest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--small", action="store_true", help="Download Flipkart and Amazon India Mendeley archives")
    parser.add_argument("--flipkart", action="store_true", help="Download Flipkart Zenodo data.zip")
    parser.add_argument("--mendeley", action="store_true", help="Download Amazon India Mendeley v2 archive")
    parser.add_argument("--pcbox", action="store_true", help="Download PCBox CSV (check licence before reuse)")
    parser.add_argument(
        "--amazon-2023-electronics",
        action="store_true",
        help="Download the large Amazon Reviews'23 Electronics review and metadata files",
    )
    args = parser.parse_args()

    selected: list[str] = []
    if args.small:
        selected.extend(["flipkart", "mendeley"])
    if args.flipkart:
        selected.append("flipkart")
    if args.mendeley:
        selected.append("mendeley")
    if args.pcbox:
        selected.append("pcbox")
    if args.amazon_2023_electronics:
        selected.extend(["amazon_2023_electronics_reviews", "amazon_2023_electronics_metadata"])
    selected = list(dict.fromkeys(selected))

    if not selected:
        parser.print_help()
        return 2

    if args.amazon_2023_electronics:
        print("WARNING: Amazon Reviews'23 Electronics is a large category, not laptop-only.")
        print("Check free disk space and source terms before proceeding.")

    failures = 0
    for name in selected:
        try:
            download(name)
        except Exception as exc:  # keep attempting other selected sources
            failures += 1
            print(f"ERROR downloading {name}: {exc}", file=sys.stderr)
    print(f"\nFinished. {len(selected) - failures}/{len(selected)} downloads succeeded.")
    print(f"Output directory: {OUT}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
