"""Assemble a fit report for (variant, profile) from stored evidence. All decisions come from fit_engine (deterministic);
quotes are re-validated against the original review text before being returned (never trust stored quotes blindly)."""
from __future__ import annotations

import json
import sqlite3
from collections import Counter

from . import fit_engine as fe
from . import text_utils as tu
from .config import settings

ATTR_CATEGORY = {"ram_gb": "memory", "ram_type": "memory", "ram_upgradeable": "upgradeability", "cpu": "performance", "gpu": "gpu",
                 "battery_wh": "battery", "weight_kg": "portability", "weight_kg_curated": "portability", "display_size_in": "display",
                 "display_resolution": "display", "refresh_hz": "display", "price_inr": "value", "storage_gb": "memory"}
LISTING_SRC = "S-FLIPKART-LISTING"
EXACT = ("exact_listing", "exact_family")


def profile_from_dict(d: dict) -> fe.Profile:
    return fe.Profile(workloads=d.get("workloads", {}), hard={k: float(v) for k, v in d.get("hard_requirements", {}).items()},
                      priorities=d.get("priorities", []), weights_override=d.get("weights"))


def variant_row(conn, variant_id: str):
    return conn.execute("SELECT * FROM laptop_variants WHERE id=?", (variant_id,)).fetchone()


def _facts(conn, variant_id):
    rows = conn.execute("SELECT * FROM spec_facts WHERE variant_id=?", (variant_id,)).fetchall()
    return [dict(r) for r in rows]


def merge_exact(facts: list[dict]) -> dict[str, dict]:
    """Exact-level facts only (siblings never feed the gate). When several sources give different values for one attribute (including
    '<attr>_options' lists), the attribute becomes '<attr>_options' with every value: we never pick one arbitrarily."""
    by_base: dict[str, list[dict]] = {}
    for f in facts:
        if f["variant_match"] in EXACT:
            by_base.setdefault(f["attribute"].removesuffix("_options"), []).append(f)
    out: dict[str, dict] = {}
    for base, rows in by_base.items():
        rows = sorted(rows, key=lambda f: (f["variant_match"] != "exact_listing", f["variant_match"] != "exact_family", f["attribute"].endswith("_options")))
        vals: set[float] = set()
        numeric = True
        for f in rows:
            parts = [x for x in str(f["value_text"]).split(",") if x.strip()] if f["attribute"].endswith("_options") else [f["value_text"]]
            for x in parts:
                try:
                    vals.add(round(float(x), 2))
                except (TypeError, ValueError):
                    numeric = False
        first = rows[0]
        if numeric and len(vals) > 1:
            out[base + "_options"] = {**first, "attribute": base + "_options", "value_text": ",".join(f"{v:g}" for v in sorted(vals)), "value_num": None}
        elif numeric and len(vals) == 1 and not first["attribute"].endswith("_options"):
            out[base] = first
        elif numeric and len(vals) == 1:
            out[base] = {**first, "attribute": base, "value_text": f"{next(iter(vals)):g}", "value_num": next(iter(vals))}
        else:
            out[first["attribute"]] = first
    return out


def _best_by_attr(facts: list[dict]) -> dict[str, dict]:
    return merge_exact(facts)


def _bench(conn, variant_id):
    return [dict(r) for r in conn.execute("SELECT * FROM benchmarks WHERE variant_id=? ORDER BY id", (variant_id,))]


def owner_status(conn, variant_id) -> dict:
    cs = conn.execute("SELECT catalogue_set FROM laptop_variants WHERE id=?", (variant_id,)).fetchone()
    if cs and cs[0] == "live_researched":
        return {"state": "not_available", "representatives": 0, "processed": 0, "by_status": {}}
    reps = conn.execute("""SELECT COUNT(*) FROM reviews WHERE variant_id=? AND (dup_cluster_id IS NULL OR id=(SELECT MIN(r2.id) FROM reviews r2
        WHERE r2.dup_cluster_id=reviews.dup_cluster_id))""", (variant_id,)).fetchone()[0]
    st = Counter(r[0] for r in conn.execute("SELECT status FROM extraction_runs er JOIN reviews r ON r.id=er.review_id WHERE r.variant_id=?", (variant_id,)))
    done = st.get("done", 0) + st.get("skipped_trivial", 0) + st.get("skipped_flagged", 0) + st.get("failed", 0)
    state = "complete" if reps and done >= reps else "partial" if done else "not_run"
    return {"state": state, "representatives": reps, "processed": done, "by_status": dict(st)}


def _claims(conn, variant_id):
    rows = conn.execute("""SELECT ec.id AS claim_id, ec.review_id, ec.category, ec.polarity, ec.strength, ec.quote, ec.quote_start, ec.quote_end,
        ec.claim_text, r.original_text, r.rating, r.flag, r.config_mismatch_hint, r.dup_cluster_id, COALESCE(c.size,1) AS csize
        FROM evidence_claims ec JOIN reviews r ON r.id=ec.review_id LEFT JOIN dup_clusters c ON c.id=r.dup_cluster_id
        WHERE ec.variant_id=? AND ec.validation_status != 'rejected'""", (variant_id,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["cluster_key"] = f"c{d['dup_cluster_id']}" if d["dup_cluster_id"] else f"r{d['review_id']}"
        d["excluded"] = "instruction_injection" if d["flag"] else "different_variant" if d["config_mismatch_hint"] == "hardware_modified" else \
            "off_topic" if d["category"] in ("delivery_or_seller", "other") else None
        out.append(d)
    return out


def _evidence_items(claims_by_cat: dict[str, list[dict]], ids: list[str], cat: str, warnings: list[str]):
    items, seen = [], set()
    for c in claims_by_cat.get(cat, []):
        if c["review_id"] in ids and c["review_id"] not in seen:
            loc = tu.locate_quote(c["original_text"], c["quote"])           # re-validate at output time
            if loc is None:
                warnings.append(f"quote for {c['review_id']} failed re-validation and was omitted")
                continue
            seen.add(c["review_id"])
            items.append({"claim_id": c["claim_id"], "review_id": c["review_id"], "quote": c["quote"], "quote_start": loc[0], "quote_end": loc[1],
                          "rating": c["rating"], "polarity": c["polarity"], "strength": c["strength"], "duplicates": c["csize"]})
    return items


def analyze(conn: sqlite3.Connection, variant_id: str, profile_dict: dict) -> dict:
    v = variant_row(conn, variant_id)
    if v is None:
        raise KeyError(variant_id)
    profile = profile_from_dict(profile_dict)
    facts = _facts(conn, variant_id)
    best = _best_by_attr(facts)
    bench = _bench(conn, variant_id)
    battery_bench = [b for b in bench if b["category"] == "battery"]
    gate_rows = fe.gate(profile, best, battery_bench)
    status = owner_status(conn, variant_id)
    claims = _claims(conn, variant_id)
    buckets = fe.owner_buckets(claims, profile.priorities)
    cls = fe.classify(buckets, profile.priorities)
    if status["state"] in ("not_run", "not_available"):                  # never imply "no problems" when nothing was analysed
        why = "we have not read the owner reviews for this laptop yet" if status["state"] == "not_run" else "no owner reviews are available for a laptop looked up online"
        cls["gaps"] = [{"category": c, "reason": why} for c in profile.priorities]
    spec_counts = Counter(ATTR_CATEGORY.get(f["attribute"]) for f in facts if f["variant_match"] in EXACT or True)
    lab_counts: dict[str, dict] = {}
    for b in bench:
        if b["methodology"] == "manufacturer_claim":
            continue
        k = "exact" if b["variant_match"] in EXACT else "sibling"
        lab_counts.setdefault(b["category"], {}).setdefault(k, 0)
        lab_counts[b["category"]][k] += 1
    rat = fe.ratings(profile, buckets, gate_rows, dict(spec_counts), lab_counts)
    provisional = status["state"] not in ("complete",)
    if provisional:   # never publish a number built on partly analysed owner reviews
        rat["score_visible"], rat["score"], rat["provisional"] = False, None, True
        for r in rat["categories"].values():
            if r.get("basis") == "owner":
                r["provisional"] = True
    fits = fe.fit_by_use(profile, rat["categories"])
    for f_ in fits:
        f_["provisional"] = provisional and any(rat["categories"][c].get("provisional") for c in fe.WORKLOAD_WEIGHTS.get(f_["workload"], {}))
    by_cat: dict[str, list[dict]] = {}
    for c in claims:
        by_cat.setdefault(c["category"], []).append(c)
    warnings: list[str] = []
    for d in cls["dealbreakers"] + cls["watchouts"]:
        d["evidence"] = _evidence_items(by_cat, d["review_ids"], d["category"], warnings)
    disagreements = []
    for cat, b in buckets.items():
        if b["ids_pos"] and b["ids_neg_clear"]:
            disagreements.append({"category": cat, "side_positive": _evidence_items(by_cat, b["ids_pos"][:3], cat, warnings),
                                  "side_negative": _evidence_items(by_cat, b["ids_neg_clear"][:3], cat, warnings), "explained_by": None})
    # set-aside (why excluded): rule-based + extraction-time exclusions
    set_aside = Counter()
    n_trivial = conn.execute("SELECT COUNT(*) FROM reviews WHERE variant_id=? AND word_count<4", (variant_id,)).fetchone()[0]
    n_dups = conn.execute("""SELECT COALESCE(SUM(c.size-1),0) FROM dup_clusters c WHERE c.id IN (SELECT DISTINCT dup_cluster_id FROM reviews WHERE variant_id=?)""", (variant_id,)).fetchone()[0]
    set_aside["duplicate"] = int(n_dups)
    set_aside["unclear_context"] = n_trivial          # too short to carry a testable claim
    set_aside["different_variant"] = conn.execute("SELECT COUNT(*) FROM reviews WHERE variant_id=? AND config_mismatch_hint='hardware_modified'", (variant_id,)).fetchone()[0]
    set_aside["instruction_injection"] = conn.execute("SELECT COUNT(*) FROM reviews WHERE variant_id=? AND flag IS NOT NULL", (variant_id,)).fetchone()[0]
    lanes = {"lab_exact": [b for b in bench if b["variant_match"] in EXACT and b["methodology"] != "manufacturer_claim"],
             "manufacturer_claims": [b for b in bench if b["methodology"] == "manufacturer_claim"],
             "lab_sibling": [b for b in bench if b["variant_match"] not in EXACT]}
    srcs = {r["id"]: dict(r) for r in conn.execute("SELECT id,url,publisher,source_class,attribution_text,retrieved_at FROM sources")}
    curated_facts = [{**f, "source": srcs.get(f["source_id"])} for f in facts if f["source_id"] != LISTING_SRC]
    gaps = list(cls["gaps"])
    for g in gate_rows:
        if g["status"] == "unknown":
            gaps.append({"category": g["requirement"], "label": g["label"], "reason": g.get("note") or "no evidence available for this requirement"})
    resp_status = "complete" if status["state"] == "complete" else "partial"
    if status["state"] == "not_available":
        warnings.append("Maker pages often describe a whole model range, and versions differ by country and configuration. Check the exact version you plan to buy.")
        warnings.append("This laptop was looked up online. We have official details and links, but no owner reviews, so there is nothing here about what owners complain about.")
    elif status["state"] != "complete":
        warnings.append(f"We have read {status['processed']} of {status['representatives']} different owner reviews for this laptop so far. "
                        "Anything about owners below is an early result, and a missing problem does not mean there is none.")
    return {
        "variant": {"id": v["id"], "display_name": v["display_name"], "listing_title": v["listing_title"], "catalogue_set": v["catalogue_set"],
                    "variant_confidence": "exact_family" if v["catalogue_set"] == "live_researched" else "exact_listing", "review_count": v["review_count"]},
        "profile_echo": {"workloads": profile.workloads, "hard_requirements": profile.hard, "priorities": profile.priorities, "weights": profile.weights()},
        "gate": gate_rows,
        "dealbreakers": cls["dealbreakers"], "watchouts": cls["watchouts"], "disagreements": disagreements,
        "fit_by_use": fits, "ratings": rat, "gaps": gaps,
        "owner_analysis": status,
        "independent_tests_and_specs": {"lanes": lanes, "curated_spec_facts": curated_facts},
        "set_aside": {"total_reviews": v["review_count"], "by_reason": dict(set_aside)},
        "summary": _summary(v["display_name"], gate_rows, cls, fits, rat, status),
        "versions": {"fit_engine": fe.CONFIG["version"], "extraction_prompt": settings.prompt_version, "llm": settings.llm_model, "embed": settings.embed_model,
                     "thresholds": {k: fe.CONFIG[k] for k in ("min_applicable_for_rating", "dealbreaker_min_clear_negative", "coverage_threshold")}},
        "status": resp_status, "warnings": warnings,
    }


def _summary(name, gate_rows, cls, fits, rat, status) -> dict:
    """Plain-language summary written by rules (no model). Every line says what it rests on."""
    lines = []
    bad = [g for g in gate_rows if g["status"] in ("not_met", "spec_mismatch")]
    unk = [g for g in gate_rows if g["status"] == "unknown"]
    met = [g for g in gate_rows if g["status"] == "met"]
    for g in bad:
        lines.append({"text": f"Below what you asked: you wanted a laptop that {g['label'][0].lower() + g['label'][1:]}. The listing says {g['have']}.", "basis": "listing"})
    if met:
        lines.append({"text": "Meets your must-haves on: " + ", ".join(g["label"][0].lower() + g["label"][1:] for g in met) + ".", "basis": "listing"})
    for g in unk:
        lines.append({"text": f"Can't tell yet: {g['label'][0].lower() + g['label'][1:]}.", "basis": "gap"})
    for d in cls["dealbreakers"]:
        lines.append({"text": f"Serious problem on {d['category'].replace('_', ' ')}: {d['distinct_reports']} different owners report it.", "basis": "reviews", "review_ids": d["review_ids"]})
    for w in cls["watchouts"]:
        n = w["distinct_reports"]
        lines.append({"text": f"Worth checking on {w['category'].replace('_', ' ')}: {n} {'owner reports' if n == 1 else 'different owners report'} it.", "basis": "reviews", "review_ids": w["review_ids"]})
    if status["state"] == "not_available":
        lines.append({"text": "No owner reviews are available for this laptop because it was looked up online. Ratings below rest on official details only.", "basis": "coverage"})
    elif status["state"] != "complete":
        lines.append({"text": f"We have read {status['processed']} of {status['representatives']} different owner reviews for this laptop so far, so owner findings are early results and may change.", "basis": "coverage"})
    pct = round(rat["coverage"] * 100)
    lines.append({"text": f"How much we know about what matters to you: {pct}%. "
                          + ("A score is shown." if rat["score_visible"] else
                             "No score is shown because we have no owner reviews for this laptop." if status["state"] == "not_available" else
                             "No score is shown yet because we have not finished reading the reviews." if rat.get("provisional") else
                             "That is below 60%, so we show no score."), "basis": "coverage"})
    return {"lines": lines, "drafted_by": "rules (no model)", "name": name}
