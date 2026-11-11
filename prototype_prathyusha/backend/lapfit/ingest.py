"""Build the LapFit database from the processed + curated data files.

    .venv/bin/python -m lapfit.ingest [--no-embed] [--db PATH]

The DB is derived data: it is rebuilt from scratch each run (idempotent by construction). Original review text is stored
unchanged. Nothing is fabricated: spec facts come from the listing title parse (machine_validated) or curated sources with
their recorded validation status.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import time
from collections import defaultdict
from pathlib import Path

from . import text_utils as tu
from .config import settings
from .db import connect, migrate, tx

SRC_REVIEWS = "S-FLIPKART-REVIEWS"
SRC_LISTING = "S-FLIPKART-LISTING"
SRC_AMZ_REVIEWS = "S-AMAZON-REVIEWS-23"
SRC_AMZ_LISTING = "S-AMAZON-LISTING-23"
AMAZON_MIN_REVIEWS = 15        # laptops with fewer reviews are too thin to say anything
AMAZON_MAX_PER_LAPTOP = 150    # one popular model must not outweigh a whole brand; deterministic sample
AMAZON_BRANDS = {"ASUS": r"\basus\b", "HP": r"\bhp\b|hewlett", "LENOVO": r"lenovo", "ACER": r"\bacer\b", "DELL": r"\bdell\b", "APPLE": r"macbook|\bapple\b",
                 "MICROSOFT": r"microsoft|\bsurface\b", "MSI": r"\bmsi\b"}
CURATED_SPEC_MATCH = {  # variant relation of each curated *spec* source to the Flipkart listing it is attached to
    "S-APPLE-MBA-M1": ("exact_family", "verified_on_page"),
    "S-NBC-FKL11-SIB": ("sibling_cpu", "needs_human_spot_check"),
    "S-NBC-FKL05-SPEC": ("sibling_other", "needs_human_spot_check"),
    "S-NBC-FKL09-SPEC": ("sibling_cpu", "needs_human_spot_check"),
}
CLASS_MAP = {"manufacturer": "manufacturer_spec", "independent_lab": "independent_lab", "spec_database": "spec_database"}
CAT_MAP = {"battery": "battery", "thermals": "thermals_noise", "noise": "thermals_noise"}
_CODE = re.compile(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+|\b[A-Z]{1,3}\d{2,}[A-Z0-9]*\b")


def _num(x):
    try:
        return float(str(x).strip())
    except Exception:
        return None


def _read(p: Path):
    with open(p, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_sources(conn):
    conn.execute("""INSERT INTO sources(id,url,publisher,source_name,source_class,licence_status,permission,attribution_text,notes)
        VALUES (?,?,?,?,?,?,?,?,?)""", (SRC_REVIEWS, "https://zenodo.org/records/17612521", "Zenodo (dataset authors)",
        "Flipkart Review Dataset", "owner_review", "unverified (record licence field blank; team PDF says CC BY 4.0)", "stored_full",
        "Flipkart Review Dataset, Zenodo 17612521", "Course/research prototype use only; no redistribution of raw data."))
    conn.execute("""INSERT INTO sources(id,url,publisher,source_name,source_class,licence_status,permission,attribution_text,notes)
        VALUES (?,?,?,?,?,?,?,?,?)""", (SRC_LISTING, "https://zenodo.org/records/17612521", "Zenodo (dataset authors)",
        "Flipkart listing titles (parsed)", "dataset", "unverified", "stored_facts_only", "Flipkart Review Dataset, Zenodo 17612521",
        "Specs parsed from listing titles by rules; not official specifications."))
    for r in _read(settings.curated / "sources.csv"):
        conn.execute("""INSERT INTO sources(id,url,publisher,source_name,source_class,published_at,retrieved_at,licence_status,permission,
            attribution_text,recheck_after,exact_variant_note,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (r["source_id"], r["source_url"], r["publisher_or_author"], r["source_name"], CLASS_MAP.get(r["source_type"], "other"),
             r["publication_date"] or None, r["retrieved_at"], r["licence_or_permission_status"], "stored_facts_only",
             r["attribution_text"], r["recheck_after"], r["exact_variant"], r["notes"]))


def load_variants_and_specs(conn):
    listings = _read(settings.processed / "flipkart_laptop_listings.csv")
    for r in listings:
        title = r["model"]
        base = title.split(" - (")[0].strip()
        cur = conn.execute("INSERT OR IGNORE INTO laptop_models(brand, marketing_name) VALUES (?,?)", (r["brand"], base))
        mid = conn.execute("SELECT id FROM laptop_models WHERE brand=? AND marketing_name=?", (r["brand"], base)).fetchone()[0]
        ram, sto = _num(r["ram_gb"]), _num(r["storage_gb"])
        disp = f"{base} · {int(ram)} GB / {int(sto)} GB" if ram and sto else base
        aliases = sorted({a.lower() for a in _CODE.findall(title) if len(a) > 3})
        conn.execute("INSERT INTO laptop_variants(id,model_id,listing_title,display_name,catalogue_set,aliases,review_count) VALUES (?,?,?,?,?,?,?)",
                     (r["laptop_id"], mid, title, disp, "flipkart14", json.dumps(aliases), int(r["review_count"])))
        conn.execute("INSERT INTO fts_variants(text, variant_id) VALUES (?,?)", (f"{disp} {title} {' '.join(aliases)}", r["laptop_id"]))
        facts = [("cpu", r["cpu"], None, None), ("gpu", r["gpu"], None, None), ("ram_gb", r["ram_gb"], _num(r["ram_gb"]), "GB"),
                 ("storage_gb", r["storage_gb"], _num(r["storage_gb"]), "GB"), ("display_size_in", r["display_size_in"], _num(r["display_size_in"]), "in"),
                 ("refresh_hz", r["refresh_rate_hz"], _num(r["refresh_rate_hz"]), "Hz"), ("weight_kg", r["weight_kg"], _num(r["weight_kg"]), "kg"), ("battery_wh", r.get("battery_wh"), _num(r.get("battery_wh")), "Wh"),
                 ("price_inr", r["price_inr"], _num(r["price_inr"]), "INR")]
        for attr, txt, num, unit in facts:
            if txt in (None, ""):
                continue
            conn.execute("""INSERT INTO spec_facts(variant_id,attribute,value_text,value_num,unit,source_id,quote,variant_match,validation_status,retrieved_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""", (r["laptop_id"], attr, str(txt), num, unit, SRC_LISTING, title, "exact_listing", "machine_validated", "2026-11-10"))
    # curated spec facts (battery, weight, memory layout, display) from hand-curated sources
    for r in _read(settings.curated / "laptops_curated.csv"):
        match, status = CURATED_SPEC_MATCH[r["source_id"]]
        for attr, col, unit in (("battery_wh", "battery_wh", "Wh"), ("weight_kg_curated", "weight_kg", "kg"), ("ram_type", "ram_type", None),
                                ("ram_upgradeable", "ram_upgradeable", None), ("display_resolution", "display_resolution", None)):
            v = r.get(col, "")
            if v in ("", None):
                continue
            conn.execute("""INSERT OR IGNORE INTO spec_facts(variant_id,attribute,value_text,value_num,unit,source_id,quote,variant_match,validation_status,retrieved_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""", (r["variant_id"], attr, v, _num(v) if unit else None, unit, r["source_id"], None, match, status, r["last_verified_at"]))


def load_extra_facts(conn):
    f = settings.curated / "spec_facts_extra.csv"
    if not f.exists():
        return
    for r in _read(f):
        conn.execute("""INSERT OR IGNORE INTO spec_facts(variant_id,attribute,value_text,value_num,unit,source_id,quote,variant_match,validation_status,retrieved_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", (r["variant_id"], r["attribute"], r["value_text"], _num(r["value_num"]), r["unit"] or None, r["source_id"], None,
                                              r["variant_match"], r["validation_status"], "2026-11-10"))


def load_benchmarks(conn):
    for r in _read(settings.curated / "benchmarks_curated.csv"):
        v = r["measurement_value"]
        conn.execute("""INSERT INTO benchmarks(id,variant_id,source_id,category,test_name,value_text,value_num,unit,conditions,methodology,
            published_at,source_url,retrieved_at,variant_match,validation_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (r["benchmark_id"], r["laptop_variant_id"], r["source_id"], CAT_MAP.get(r["attribute"], r["attribute"]), r["test_name"], v, _num(v),
             r["measurement_unit"], r["test_conditions"], r["methodology"], r["publication_date"] or None, r["source_url"], r["retrieved_at"],
             r["variant_match"], r["validation_status"]))


def load_reviews(conn):
    rows = _read(settings.processed / "flipkart_laptop_reviews.csv")
    groups: dict[tuple, list[str]] = defaultdict(list)
    for r in rows:
        groups[(r["laptop_variant_id"], tu.normalise_for_dedup(r["original_review_text"]))].append(r["review_id"])
    cluster_of: dict[str, int] = {}
    for (vid, key), ids in groups.items():
        if len(ids) > 1 and key:
            cid = conn.execute("INSERT INTO dup_clusters(representative_review_id,size,method) VALUES (?,?,?)", (ids[0], len(ids), "normalised")).lastrowid
            for i in ids:
                cluster_of[i] = cid
    for r in rows:
        t = r["original_review_text"]
        conn.execute("""INSERT INTO reviews(id,external_review_id,source_id,variant_id,rating,title,original_text,language,is_synthetic_test,
            dup_cluster_id,word_count,content_hash,flag,config_mismatch_hint,ingestion_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (r["review_id"], r["review_id"], SRC_REVIEWS, r["laptop_variant_id"], int(float(r["rating"])) if r["rating"] else None, r["review_title"], t,
             r["language"], 0, cluster_of.get(r["review_id"]), tu.word_count(t), tu.content_hash(t), tu.injection_flag(t),
             tu.config_mismatch_hint(t), settings.ingestion_version))
        conn.execute("INSERT INTO fts_reviews(text, review_id, variant_id) VALUES (?,?,?)", (f"{r['review_title']} {t}".strip(), r["review_id"], r["laptop_variant_id"]))
    return len(rows), len(set(cluster_of.values()))


def embed_reviews(conn):
    from .embeddings import Embedder, to_blob
    emb = Embedder()
    rows = conn.execute("SELECT id, original_text FROM reviews ORDER BY id").fetchall()
    t0 = time.time()
    vecs = emb.encode([r["original_text"] for r in rows])
    conn.executemany("INSERT INTO embeddings(owner_type,owner_id,model_name,dim,vector) VALUES ('review',?,?,?,?)",
                     [(r["id"], emb.model_name, vecs.shape[1], to_blob(v)) for r, v in zip(rows, vecs)])
    return len(rows), round(time.time() - t0, 1)


def _snapshot_extraction(path: Path) -> dict | None:
    """Read model-extraction results from an existing DB so a rebuild does not destroy hours of work. Keyed by review id + content hash."""
    if not path.exists():
        return None
    import sqlite3
    try:
        c = sqlite3.connect(str(path)); c.row_factory = sqlite3.Row
        live = {}
        try:
            vs = [dict(r) for r in c.execute("SELECT v.*, m.brand AS _brand, m.marketing_name AS _mname FROM laptop_variants v JOIN laptop_models m ON m.id=v.model_id WHERE v.catalogue_set='live_researched'")]
            ids = [v["id"] for v in vs]
            qm = ",".join("?" * len(ids)) or "''"
            live = {"variants": vs, "facts": [dict(r) for r in c.execute(f"SELECT * FROM spec_facts WHERE variant_id IN ({qm})", ids)],
                    "sources": [dict(r) for r in c.execute("SELECT * FROM sources WHERE id LIKE 'S-LIVE-%'")],
                    "jobs": [dict(r) for r in c.execute("SELECT * FROM research_jobs")], "links": [dict(r) for r in c.execute("SELECT * FROM research_links")],
                    "credits": [dict(r) for r in c.execute("SELECT * FROM search_credits")]}
        except Exception:
            live = {}
        snap = {"live": live, "runs": [dict(r) for r in c.execute("SELECT e.*, r.content_hash FROM extraction_runs e JOIN reviews r ON r.id=e.review_id")],
                "claims": [dict(r) for r in c.execute("SELECT ec.*, r.content_hash FROM evidence_claims ec JOIN reviews r ON r.id=ec.review_id")],
                "excl": [dict(r) for r in c.execute("SELECT x.*, r.content_hash FROM exclusion_log x JOIN reviews r ON r.id=x.review_id")]}
        c.close()
        return snap
    except Exception:
        return None


def _restore_live(conn, live: dict) -> int:
    if not live or not live.get("variants"):
        return 0
    for sc in live["sources"]:
        cols = [k for k in sc]
        conn.execute(f"INSERT OR REPLACE INTO sources({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [sc[k] for k in cols])
    for v in live["variants"]:
        conn.execute("INSERT OR IGNORE INTO laptop_models(brand, marketing_name) VALUES (?,?)", (v["_brand"], v["_mname"]))
        mid = conn.execute("SELECT id FROM laptop_models WHERE brand=? AND marketing_name=?", (v["_brand"], v["_mname"])).fetchone()[0]
        conn.execute("INSERT OR REPLACE INTO laptop_variants(id,model_id,listing_title,display_name,catalogue_set,aliases,review_count) VALUES (?,?,?,?,?,?,?)",
                     (v["id"], mid, v["listing_title"], v["display_name"], v["catalogue_set"], v["aliases"], v["review_count"]))
        conn.execute("DELETE FROM fts_variants WHERE variant_id=?", (v["id"],))
        conn.execute("INSERT INTO fts_variants(text, variant_id) VALUES (?,?)", (f"{v['display_name']} {v['listing_title']}", v["id"]))
    for f in live["facts"]:
        conn.execute("""INSERT OR REPLACE INTO spec_facts(variant_id,attribute,value_text,value_num,unit,source_id,quote,variant_match,validation_status,retrieved_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", (f["variant_id"], f["attribute"], f["value_text"], f["value_num"], f["unit"], f["source_id"], f["quote"], f["variant_match"], f["validation_status"], f["retrieved_at"]))
    for j in live["jobs"]:
        conn.execute("INSERT OR REPLACE INTO research_jobs(id,query,query_key,status,variant_id,steps,counts,error,credits_used,created_at,finished_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                     (j["id"], j["query"], j["query_key"], j["status"], j["variant_id"], j["steps"], j["counts"], j["error"], j["credits_used"], j["created_at"], j["finished_at"]))
    for l in live["links"]:
        conn.execute("INSERT INTO research_links(job_id,url,title,decision,tier,reason,snippet) VALUES (?,?,?,?,?,?,?)", (l["job_id"], l["url"], l["title"], l["decision"], l["tier"], l["reason"], l["snippet"]))
    for cr in live["credits"]:
        conn.execute("INSERT OR REPLACE INTO search_credits(month,provider,used,budget) VALUES (?,?,?,?)", (cr["month"], cr["provider"], cr["used"], cr["budget"]))
    return len(live["variants"])


def _restore_extraction(conn, snap: dict | None) -> dict:
    if not snap:
        return {"restored_runs": 0, "restored_claims": 0, "restored_live_laptops": 0}
    nl = _restore_live(conn, snap.get("live") or {})
    ok = {r["id"]: r["content_hash"] for r in conn.execute("SELECT id, content_hash FROM reviews")}
    nr = nc = 0
    for r in snap["runs"]:
        if ok.get(r["review_id"]) == r["content_hash"]:
            conn.execute("INSERT OR REPLACE INTO extraction_runs(review_id,status,model,prompt_version,n_claims,n_rejected,secs,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                         (r["review_id"], r["status"], r["model"], r["prompt_version"], r["n_claims"], r["n_rejected"], r["secs"], r["note"], r["created_at"])); nr += 1
    for c in snap["claims"]:
        if ok.get(c["review_id"]) == c["content_hash"]:
            conn.execute("""INSERT INTO evidence_claims(review_id,variant_id,category,claim_text,polarity,strength,usage_context,quote,quote_start,quote_end,model,
                prompt_version,validation_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                         (c["review_id"], c["variant_id"], c["category"], c["claim_text"], c["polarity"], c["strength"], c["usage_context"], c["quote"], c["quote_start"],
                          c["quote_end"], c["model"], c["prompt_version"], c["validation_status"], c["created_at"])); nc += 1
    for x in snap["excl"]:
        if ok.get(x["review_id"]) == x["content_hash"]:
            conn.execute("INSERT INTO exclusion_log(review_id,reason,rule,profile_hash,created_at) VALUES (?,?,?,?,?)", (x["review_id"], x["reason"], x["rule"], x["profile_hash"], x["created_at"]))
    return {"restored_runs": nr, "restored_claims": nc, "restored_live_laptops": nl}


def _extraction_running() -> bool:
    import subprocess
    try:
        return subprocess.run(["pgrep", "-f", "lapfit.extraction"], capture_output=True, text=True).stdout.strip() != ""
    except Exception:
        return False


def load_amazon(conn) -> dict:
    """Extra evidence for brand and topic claims: Amazon.com laptops (US market, USD, about 2015-2023). They are NOT recommended to
    an Indian buyer (no INR price, often old hardware); Renewed (refurbished) units and unknown brands are left out."""
    import random
    mp, rp = settings.processed / "amazon_laptop_meta.csv", settings.processed / "amazon_laptop_reviews.csv"
    if not mp.exists() or not rp.exists():
        return {"amazon_laptops": 0, "amazon_reviews": 0}
    for sid, name, cls, perm in ((SRC_AMZ_REVIEWS, "Amazon Reviews 2023 (laptop sample)", "owner_review", "stored_full"), (SRC_AMZ_LISTING, "Amazon listing details (parsed)", "dataset", "stored_facts_only")):
        conn.execute("""INSERT INTO sources(id,url,publisher,source_name,source_class,licence_status,permission,attribution_text,notes) VALUES (?,?,?,?,?,?,?,?,?)""",
                     (sid, "https://amazon-reviews-2023.github.io/", "McAuley Lab, UCSD", name, cls, "unverified (no licence stated)", perm, "Amazon Reviews 2023, McAuley Lab",
                      "Course/research prototype use only. US market (USD), 2015-2023, partial sample. Used as extra evidence for brand claims, not for recommendations."))
    reviews: dict[str, list[dict]] = defaultdict(list)
    for r in _read(rp):
        reviews[r["parent_asin"]].append(r)
    metas = []
    for m in _read(mp):
        title = m["title"] or ""
        if m["store"] == "Amazon Renewed" or re.search(r"renewed|refurbished|pre-owned", title, re.I):
            continue
        brand = next((b for b, rx in AMAZON_BRANDS.items() if re.search(rx, title, re.I)), None)
        if brand and len(reviews.get(m["parent_asin"], [])) >= AMAZON_MIN_REVIEWS:
            metas.append((m, brand))
    metas.sort(key=lambda x: -len(reviews[x[0]["parent_asin"]]))
    rng, n_rev, k = random.Random(2026), 0, 0
    for m, brand in metas:
        k += 1; vid = f"AMZ-{k:02d}"
        title = re.sub(r"\s+", " ", m["title"]).strip()
        short = title[:70].rstrip() + ("…" if len(title) > 70 else "")
        conn.execute("INSERT OR IGNORE INTO laptop_models(brand, marketing_name) VALUES (?,?)", (brand, short))
        mid = conn.execute("SELECT id FROM laptop_models WHERE brand=? AND marketing_name=?", (brand, short)).fetchone()[0]
        revs = sorted(reviews[m["parent_asin"]], key=lambda r: r["timestamp_ms"] or "")
        if len(revs) > AMAZON_MAX_PER_LAPTOP:
            revs = sorted(rng.sample(revs, AMAZON_MAX_PER_LAPTOP), key=lambda r: r["timestamp_ms"] or "")
        conn.execute("INSERT INTO laptop_variants(id,model_id,listing_title,display_name,catalogue_set,aliases,review_count) VALUES (?,?,?,?,?,?,?)",
                     (vid, mid, title, f"{short} (Amazon US)", "well_evidenced", "[]", len(revs)))
        d = json.loads(m.get("details_json") or "{}")
        ram = re.search(r"(\d+)\s*GB", d.get("RAM", "") or "", re.I)
        sto = re.search(r"(\d+(?:\.\d+)?)\s*(GB|TB)", d.get("Hard Drive", "") or "", re.I)
        scr = re.search(r"(\d+(?:\.\d+)?)", d.get("Standing screen display size", "") or "")
        facts = [("price_usd", m["price_usd"], _num(m["price_usd"]), "USD"), ("ram_gb", ram.group(1) if ram else "", _num(ram.group(1)) if ram else None, "GB"),
                 ("storage_gb", f"{float(sto.group(1)) * (1000 if sto.group(2).upper() == 'TB' else 1):g}" if sto else "", float(sto.group(1)) * (1000 if sto.group(2).upper() == 'TB' else 1) if sto else None, "GB"),
                 ("display_size_in", scr.group(1) if scr else "", _num(scr.group(1)) if scr else None, "in")]
        for attr, txt, num, unit in facts:
            if txt in (None, ""):
                continue
            conn.execute("""INSERT INTO spec_facts(variant_id,attribute,value_text,value_num,unit,source_id,quote,variant_match,validation_status,retrieved_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""", (vid, attr, str(txt), num, unit, SRC_AMZ_LISTING, title[:200], "exact_listing", "machine_validated", "2026-11-10"))
        groups: dict[str, list[str]] = defaultdict(list)
        rows = []
        for i, r in enumerate(revs, 1):
            t = ((r["title"] + ". ") if r["title"] else "") + (r["text"] or "")
            rid = f"AM-{vid[4:]}-{i:03d}"
            rows.append((rid, r, t)); groups[tu.normalise_for_dedup(t)].append(rid)
        cluster_of = {}
        for key, ids in groups.items():
            if len(ids) > 1 and key:
                cid = conn.execute("INSERT INTO dup_clusters(representative_review_id,size,method) VALUES (?,?,?)", (ids[0], len(ids), "normalised")).lastrowid
                for x in ids:
                    cluster_of[x] = cid
        for rid, r, t in rows:
            conn.execute("""INSERT INTO reviews(id,external_review_id,source_id,variant_id,rating,title,original_text,language,is_synthetic_test,
                dup_cluster_id,word_count,content_hash,flag,config_mismatch_hint,ingestion_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (rid, f"{r['parent_asin']}:{r['timestamp_ms']}:{r['asin']}:{rid}", SRC_AMZ_REVIEWS, vid, int(float(r["rating"])) if r["rating"] else None, r["title"], t, "en", 0,
                 cluster_of.get(rid), tu.word_count(t), tu.content_hash(t), tu.injection_flag(t), tu.config_mismatch_hint(t), settings.ingestion_version))
            conn.execute("INSERT INTO fts_reviews(text, review_id, variant_id) VALUES (?,?,?)", (t, rid, vid))
            n_rev += 1
    return {"amazon_laptops": k, "amazon_reviews": n_rev}


def build(db_path=None, embed=True, force=False) -> dict:
    p = Path(db_path) if db_path else settings.db_path
    snap = None
    if str(p) == str(settings.db_path) and not force and _extraction_running():
        raise RuntimeError("Extraction is running against the live database. Stop it first (pkill -f lapfit.extraction), "
                           "otherwise its results are written to a file this rebuild deletes. Use force=True to override.")
    if str(p) != ":memory:":
        if p.exists() and p.stat().st_size > 0:      # safety net: a failed rebuild must never cost hours of model reading (CH-035)
            import shutil
            bk = p.parent / "backups"; bk.mkdir(exist_ok=True)
            shutil.copy2(p, bk / (p.stem + ".before_rebuild.db"))
        snap = _snapshot_extraction(p)
        for suf in ("", "-wal", "-shm"):
            Path(str(p) + suf).unlink(missing_ok=True)
    conn = connect(p)
    migrate(conn)
    with tx(conn):
        load_sources(conn)
        load_variants_and_specs(conn)
        load_extra_facts(conn)
        load_benchmarks(conn)
        n_rev, n_clusters = load_reviews(conn)
        amz = load_amazon(conn)
        restored = _restore_extraction(conn, snap)
    emb = embed_reviews(conn) if embed else None
    conn.commit()
    summary = {
        "db": str(p), "variants": conn.execute("SELECT COUNT(*) FROM laptop_variants").fetchone()[0],
        "spec_facts": conn.execute("SELECT COUNT(*) FROM spec_facts").fetchone()[0], "benchmarks": conn.execute("SELECT COUNT(*) FROM benchmarks").fetchone()[0],
        "sources": conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0], "reviews": n_rev, "dup_clusters": n_clusters,
        "distinct_texts": conn.execute("SELECT COUNT(*) FROM (SELECT 1 FROM reviews GROUP BY variant_id, content_hash)").fetchone()[0],
        "flagged_instruction_like": conn.execute("SELECT COUNT(*) FROM reviews WHERE flag IS NOT NULL").fetchone()[0],
        "hardware_modified": conn.execute("SELECT COUNT(*) FROM reviews WHERE config_mismatch_hint='hardware_modified'").fetchone()[0],
        "upgrade_mentioned": conn.execute("SELECT COUNT(*) FROM reviews WHERE config_mismatch_hint='upgrade_mentioned'").fetchone()[0],
        "trivial_lt4_words": conn.execute("SELECT COUNT(*) FROM reviews WHERE word_count < 4").fetchone()[0],
        "embedded": emb, **amz, **restored,
    }
    conn.close()
    return summary


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-embed", action="store_true")
    ap.add_argument("--db")
    a = ap.parse_args()
    print(json.dumps(build(a.db, embed=not a.no_embed), indent=2))
