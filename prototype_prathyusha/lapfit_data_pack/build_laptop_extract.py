#!/usr/bin/env python3
"""Build the LapFit laptop extract from the downloaded Flipkart + PCBox files.

Reads  datasets/downloaded/  (run download_datasets.py first)
Writes datasets/processed/:
  flipkart_laptop_reviews.csv   - reviews_template.csv schema, original text preserved
  flipkart_laptop_listings.csv  - laptops_template.csv schema (specs parsed from listing title)
  pcbox_laptops.csv             - PCBox rows, translated column names, laptops only
  MANIFEST.json                 - counts + checksums

review_id = FK-<1-based position within the laptop subset, in source order>, which
reproduces the IDs cited in project_data/team11_activity_extracted.txt.
"""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
DL = ROOT / "datasets" / "downloaded"
OUT = ROOT / "datasets" / "processed"
SRC_ID = "flipkart_zenodo_17612521"

LAPTOP = re.compile(r"laptop|notebook|chromebook|macbook", re.I)
NOT_LAPTOP = re.compile(r"\btable\b|\bstand\b|\bbag\b|\bsleeve\b", re.I)


def clean_text(s) -> str:
    return "" if pd.isna(s) else str(s).replace("�", "").strip()


def price_inr(s) -> int | None:
    digits = re.sub(r"[^\d]", "", str(s).split(".")[0])
    return int(digits) if digits else None


def spec(pattern: str, text: str, group: int = 1):
    m = re.search(pattern, text, re.I)
    return m.group(group) if m else None


def parse_listing(name: str) -> dict:
    ram = spec(r"\((\d+)\s*GB\s*/", name) or spec(r"(\d+)\s*GB\s*RAM", name)
    storage = spec(r"/\s*(\d+)\s*GB\s*(?:SSD|HDD|eMMC)", name)
    tb = spec(r"/\s*(\d+)\s*TB\s*(?:SSD|HDD)", name)
    storage_gb = int(storage) if storage else (int(tb) * 1024 if tb else None)
    gpu = spec(r"/\s*\d+\s*GB\s*Graphics/([^/)]+)", name)
    hz = spec(r"/\s*(\d+)\s*Hz", name)
    size = spec(r"\(\s*(\d+(?:\.\d+)?)\s*inch", name)
    kg = spec(r"([\d.]+)\s*kg", name)
    wh = spec(r"(\d+(?:\.\d+)?)\s*Whr?\b", name)
    cpu = spec(r"((?:Core\s*(?:i\d|Ultra\s*\d)|Ryzen\s*\d|Celeron|Pentium|M[123]|Athlon).*?)\s+-\s+\(", name)
    brand = name.split()[0].upper()
    return {
        "brand": "APPLE" if brand == "APPLE" else brand,
        "cpu": cpu.strip() if cpu else None,
        "gpu": gpu.strip() if gpu else None,
        "ram_gb": int(ram) if ram else None,
        "storage_gb": storage_gb,
        "display_size_in": float(size) if size else None,
        "refresh_rate_hz": int(hz) if hz else None,
        "weight_kg": float(kg) if kg else None,
        "battery_wh": float(wh) if wh else None,
    }


def build_flipkart(now: str) -> dict:
    zpath = DL / "flipkart_review_dataset_zenodo_17612521.zip"
    csv_path = DL / "extracted" / "flipkart" / "flipkart_product.csv"
    if not csv_path.exists():
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zpath) as z:
            z.extract("flipkart_product.csv", csv_path.parent)
    df = pd.read_csv(csv_path, encoding_errors="replace")
    mask = df.ProductName.str.contains(LAPTOP, na=False) & ~df.ProductName.str.contains(NOT_LAPTOP, na=False)
    lp = df[mask].reset_index(drop=True)

    # listings
    listings = []
    variant_by_name = {}
    for i, (name, grp) in enumerate(lp.groupby("ProductName", sort=False), start=1):
        vid = f"FKL-{i:02d}"
        variant_by_name[name] = vid
        p = parse_listing(name)
        listings.append({
            "laptop_id": vid,
            "brand": p["brand"],
            "model": clean_text(name),
            "variant_id": vid,
            "cpu": p["cpu"], "gpu": p["gpu"],
            "ram_gb": p["ram_gb"], "ram_type": None, "ram_upgradeable": None,
            "storage_gb": p["storage_gb"],
            "display_size_in": p["display_size_in"], "display_resolution": None,
            "refresh_rate_hz": p["refresh_rate_hz"], "battery_wh": p["battery_wh"],
            "weight_kg": p["weight_kg"],
            "price_inr": price_inr(grp.Price.iloc[0]),
            "source_id": SRC_ID, "last_verified_at": None,
            "review_count": len(grp),
        })
    pd.DataFrame(listings).to_csv(OUT / "flipkart_laptop_listings.csv", index=False)

    # reviews (original text kept: Flipkart 'Review' = title, 'Summary' = body)
    rows = []
    for pos, r in enumerate(lp.itertuples(index=False), start=1):
        body = clean_text(r.Summary)
        rows.append({
            "review_id": f"FK-{pos:05d}",
            "laptop_variant_id": variant_by_name[r.ProductName],
            "source_id": SRC_ID,
            "rating": r.Rate if str(r.Rate).isdigit() else None,
            "review_title": clean_text(r.Review),
            "original_review_text": body,
            "review_date": None, "verified_purchase": None, "helpful_votes": None,
            "language": "en",
            "source_url": "https://zenodo.org/records/17612521",
            "ingested_at": now,
            "content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest()[:16],
        })
    rev = pd.DataFrame(rows)
    rev.to_csv(OUT / "flipkart_laptop_reviews.csv", index=False)
    return {"flipkart_rows_total": len(df), "laptop_reviews": len(rev), "laptop_listings": len(listings),
            "rating_distribution": rev.rating.value_counts(dropna=False).sort_index().to_dict(),
            "empty_review_text": int((rev.original_review_text == "").sum())}


def build_pcbox() -> dict:
    p = pd.read_csv(DL / "products_pcbox_zenodo_14060666.csv")
    p = p.rename(columns={
        "Nombre": "name", "Precio": "price_eur_raw", "Categoria": "category", "Marca": "brand",
        "Valoracion": "rating", "Num_Resenas": "review_count", "Valoracion_Max": "top_rating",
        "Texto_Valoracion_Max": "top_review_text", "Valoracion_Min": "low_rating",
        "Texto_Valoracion_Min": "low_review_text"})
    lap = p[p.category.str.contains("port", case=False, na=False)]  # Portátiles*
    lap.to_csv(OUT / "pcbox_laptops.csv", index=False)
    return {"pcbox_rows_total": len(p), "pcbox_laptop_rows": len(lap)}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    manifest = {"built_at": now, **build_flipkart(now), **build_pcbox()}
    manifest["sha256"] = {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(OUT.glob("*.csv"))}
    (OUT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
