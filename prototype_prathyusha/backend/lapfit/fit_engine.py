"""Deterministic fit engine (no LLM): requirement gate, owner-evidence rules, category ratings, coverage, fit by use.

Rules implemented (MVP_SCOPE §4, decisions D-009/D-011/D-018):
  * Hard requirements: met / not_met / unknown / spec_mismatch. Unknown never counts as a pass.
  * Dealbreaker = >=2 independent (distinct-cluster) CLEAR negative applicable reports on a priority category.
    One clear complaint = watch-out. <3 applicable reports on a priority category = not enough evidence.
  * Category owner rating = Wilson lower bound of the positive share (n>=3), thresholds below. No overall rank.
  * Coverage = sum(weights of categories with a usable rating) / sum(all weights). A number is visible only at coverage >= 0.60.
All thresholds live in CONFIG so they are visible, versioned and testable."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

CATEGORIES = ["performance", "memory", "gpu", "battery", "display", "thermals_noise", "portability", "keyboard_trackpad",
              "ports_connectivity", "upgradeability", "build_reliability", "value"]
CONFIG = {"min_applicable_for_rating": 3, "dealbreaker_min_clear_negative": 2, "coverage_threshold": 0.60,
          "strong_lb": 0.70, "good_lb": 0.45, "wilson_z": 1.96, "version": "fit-1"}

WORKLOAD_WEIGHTS: dict[str, dict[str, int]] = {  # starting hypotheses (editable by the student), not validated universal weights
    "programming": {"performance": 25, "memory": 20, "thermals_noise": 15, "keyboard_trackpad": 10, "battery": 10, "display": 10, "portability": 10},
    "college_research": {"battery": 25, "portability": 20, "display": 20, "keyboard_trackpad": 15, "performance": 10, "value": 10},
    "design_video": {"display": 25, "performance": 20, "gpu": 20, "memory": 15, "thermals_noise": 10, "ports_connectivity": 5, "battery": 5},
    "gaming": {"gpu": 30, "performance": 20, "thermals_noise": 20, "display": 15, "memory": 10, "battery": 5},
    "ai_ml": {"gpu": 30, "memory": 25, "performance": 20, "thermals_noise": 15, "upgradeability": 10},
    "office": {"battery": 20, "portability": 20, "keyboard_trackpad": 20, "display": 15, "value": 15, "performance": 10},
}
FREQ = {"daily": 1.0, "weekly": 0.5, "occasional": 0.25}


@dataclass
class Profile:
    workloads: dict[str, str] = field(default_factory=dict)            # workload -> daily|weekly|occasional
    hard: dict[str, float] = field(default_factory=dict)               # budget_inr_max, ram_gb_min, weight_kg_max, storage_gb_min, battery_h_min
    priorities: list[str] = field(default_factory=list)                # ordered categories, top first
    weights_override: dict[str, float] | None = None

    def weights(self) -> dict[str, float]:
        if self.weights_override:
            w = dict(self.weights_override)
        else:
            w: dict[str, float] = {}
            for name, freq in self.workloads.items():
                for cat, val in WORKLOAD_WEIGHTS.get(name, {}).items():
                    w[cat] = w.get(cat, 0.0) + val * FREQ.get(freq, 1.0)
        for i, cat in enumerate(self.priorities[:3]):                   # top priorities get a boost
            if cat in w:
                w[cat] *= 1.5 - 0.1 * i
        tot = sum(w.values()) or 1.0
        return {c: round(100 * v / tot, 2) for c, v in w.items()}


def wilson_lower(pos: float, n: float, z: float = CONFIG["wilson_z"]) -> float:
    if n <= 0:
        return 0.0
    p = pos / n
    d = 1 + z * z / n
    centre = p + z * z / (2 * n)
    adj = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)
    return max(0.0, (centre - adj) / d)


# ---------------------------------------------------------------- requirement gate ("your must-haves")
def _fmt(n):
    return f"{n:,.0f}" if float(n).is_integer() else f"{n:g}"


def gate(profile: Profile, facts: dict[str, dict], battery_bench: list[dict]) -> list[dict]:
    """facts: attribute -> {value_num, value_text, source_id, variant_match, validation_status}. battery_bench: benchmark rows (hours).
    Each row has plain-language `label` (what the student asked for) and `have` (what we know)."""
    out = []

    def row(req, label, have, status, fact=None, note=""):
        out.append({"requirement": req, "label": label, "laptop_value": (fact or {}).get("value_num"), "have": have, "status": status, "note": note,
                    "source_id": (fact or {}).get("source_id"), "variant_match": (fact or {}).get("variant_match")})

    h = profile.hard

    def numeric(req, key, label, attr, ok, unit_fmt, below_status):
        f = facts.get(attr)
        if not f or f["value_num"] is None:
            opt = facts.get(attr + "_options")
            if opt:
                row(req, label, f"comes in several versions: {opt['value_text'].replace(',', ', ')}", "unknown", opt,
                    "The source lists several versions. Check which exact version you plan to buy.")
            else:
                row(req, label, "not stated in our sources", "unknown")
            return
        v = f["value_num"]
        good = ok(v, h[key])
        row(req, label, unit_fmt(v), "met" if good else below_status, f,
            "" if good else "The listing says less than you asked for. This comes from the listing details, not from owner reviews.")

    if "budget_inr_max" in h:
        numeric("budget_inr_max", "budget_inr_max", f"Costs ₹{_fmt(h['budget_inr_max'])} or less", "price_inr", lambda v, t: v <= t, lambda v: f"₹{_fmt(v)}", "not_met")
    if "ram_gb_min" in h:
        numeric("ram_gb_min", "ram_gb_min", f"Has {_fmt(h['ram_gb_min'])} GB RAM or more", "ram_gb", lambda v, t: v >= t, lambda v: f"{_fmt(v)} GB", "spec_mismatch")
    if "weight_kg_max" in h:
        numeric("weight_kg_max", "weight_kg_max", f"Weighs {h['weight_kg_max']:g} kg or less", "weight_kg", lambda v, t: v <= t, lambda v: f"{v:g} kg", "not_met")
    if "storage_gb_min" in h:
        numeric("storage_gb_min", "storage_gb_min", f"Has {_fmt(h['storage_gb_min'])} GB storage or more", "storage_gb", lambda v, t: v >= t, lambda v: f"{_fmt(v)} GB", "not_met")
    if "battery_h_min" in h:
        # Battery in real use is never passed on a lab web-surfing/video number: always "can't tell", with the numbers as context.
        exact = [b for b in battery_bench if b.get("variant_match") in ("exact_listing", "exact_family") and b.get("methodology") != "manufacturer_claim"]
        sib = [b for b in battery_bench if b.get("variant_match") not in ("exact_listing", "exact_family")]
        note = ""
        if exact:
            note = "A lab measured this laptop, but under specific test conditions that may not match how you use it: " + "; ".join(
                f"{b['value_text']} {b['unit']} ({b['conditions'][:70]})" for b in exact[:3])
        elif sib:
            note = "We only found a lab test of a similar model, so we are not counting it."
        row("battery_h_min", f"Lasts {h['battery_h_min']:g} hours or more in real use", "no test matches your kind of use", "unknown", None,
            note or "We found no independent battery test for this laptop.")
    return out


# ---------------------------------------------------------------- owner evidence
def owner_buckets(claims: list[dict], priorities: list[str]) -> dict[str, dict]:
    """claims: rows with review_id, cluster_key, category, polarity, strength, quote, excluded(reason|None).
    Independent report = one per (cluster_key, category). Returns per-category counts + evidence lists (ids)."""
    seen: set[tuple] = set()
    out: dict[str, dict] = {}
    for c in claims:
        cat = c["category"]
        if cat not in CATEGORIES or c.get("excluded"):
            continue
        key = (c["cluster_key"], cat)
        if key in seen:
            continue
        seen.add(key)
        b = out.setdefault(cat, {"applicable": 0, "pos": 0.0, "neg": 0.0, "neg_clear": 0, "pos_clear": 0, "neg_mild": 0, "ids_neg_clear": [], "ids_pos": [], "ids_neg_mild": []})
        if c["polarity"] in ("positive", "negative", "mixed"):
            b["applicable"] += 1
        if c["polarity"] == "positive":
            b["pos"] += 1
            b["ids_pos"].append(c["review_id"])
            if c["strength"] == "clear":
                b["pos_clear"] += 1
        elif c["polarity"] == "negative":
            b["neg"] += 1
            if c["strength"] == "clear":
                b["neg_clear"] += 1
                b["ids_neg_clear"].append(c["review_id"])
            else:
                b["neg_mild"] += 1
                b["ids_neg_mild"].append(c["review_id"])
        elif c["polarity"] == "mixed":
            b["pos"] += 0.5
            b["neg"] += 0.5
    return out


def classify(buckets: dict[str, dict], priorities: list[str]) -> dict:
    dealbreakers, watchouts, gaps = [], [], []
    for cat, b in buckets.items():
        is_pri = cat in priorities
        if b["neg_clear"] >= CONFIG["dealbreaker_min_clear_negative"] and is_pri:
            dealbreakers.append({"category": cat, "basis": "reviews", "distinct_reports": b["neg_clear"], "review_ids": b["ids_neg_clear"],
                                 "rule": f"{CONFIG['dealbreaker_min_clear_negative']} or more different owners clearly report this problem, and it is one of your top priorities"})
        elif b["neg_clear"] >= 1:
            watchouts.append({"category": cat, "basis": "reviews", "distinct_reports": b["neg_clear"], "review_ids": b["ids_neg_clear"],
                              "rule": "Fewer than 2 owners report it, or it is not one of your top priorities"})
    for cat in priorities:
        if buckets.get(cat, {}).get("applicable", 0) < CONFIG["min_applicable_for_rating"]:
            gaps.append({"category": cat, "reason": "fewer than 3 different owners wrote about this, which is not enough to judge"})
    return {"dealbreakers": dealbreakers, "watchouts": watchouts, "gaps": gaps}


def owner_rating(b: dict | None) -> dict:
    """Label from Wilson lower bound of positive share. n<3 => not_enough_evidence."""
    if not b or b["applicable"] < CONFIG["min_applicable_for_rating"] or (b["pos"] + b["neg"]) <= 0:
        return {"label": "not_enough_evidence", "score": None, "n": (b or {}).get("applicable", 0)}
    n = b["pos"] + b["neg"]
    lb = wilson_lower(b["pos"], n)
    label = "strong" if lb >= CONFIG["strong_lb"] else "good_with_tradeoffs" if lb >= CONFIG["good_lb"] else "weak"
    return {"label": label, "score": round(100 * lb, 1), "n": b["applicable"]}


def spec_rating(category: str, gate_rows: list[dict]) -> dict | None:
    """Deterministic labels for spec-only categories tied to a stated hard requirement."""
    key = {"memory": "ram_gb_min", "portability": "weight_kg_max", "value": "budget_inr_max"}.get(category)
    r = next((g for g in gate_rows if g["requirement"] == key), None)
    if not r or r["status"] == "unknown":
        return None
    ok = r["status"] == "met"
    return {"label": "strong" if ok else "weak", "score": 100.0 if ok else 0.0, "basis": "spec", "detail": r["label"]}


def ratings(profile: Profile, buckets: dict, gate_rows: list[dict], spec_counts: dict, lab_counts: dict) -> dict:
    w = profile.weights() or {c: 100 / len(CATEGORIES) for c in CATEGORIES}
    out, covered = {}, 0.0
    for cat in CATEGORIES:
        owner = owner_rating(buckets.get(cat))
        spec = spec_rating(cat, gate_rows)
        if owner["label"] != "not_enough_evidence":
            res = {**owner, "basis": "owner"}
        elif spec:
            res = {"label": spec["label"], "score": spec["score"], "basis": "spec", "n": 0}
        else:
            res = {"label": "not_enough_evidence", "score": None, "basis": None, "n": owner["n"]}
        res["weight"] = w.get(cat, 0.0)
        res["evidence"] = {"spec": spec_counts.get(cat, 0), "lab_exact": lab_counts.get(cat, {}).get("exact", 0),
                           "lab_sibling": lab_counts.get(cat, {}).get("sibling", 0), "owner": buckets.get(cat, {}).get("applicable", 0)}
        if res["label"] != "not_enough_evidence":
            covered += res["weight"]
        out[cat] = res
    total_w = sum(w.values()) or 1.0
    cov = round(covered / total_w, 4)
    visible = cov >= CONFIG["coverage_threshold"]
    num = None
    if visible:
        num = round(sum(r["weight"] * r["score"] for r in out.values() if r["score"] is not None) / covered, 1)
    return {"categories": out, "coverage": cov, "score": num, "score_visible": visible}


def fit_by_use(profile: Profile, cat_ratings: dict) -> list[dict]:
    rows = []
    for name in profile.workloads:
        wts = WORKLOAD_WEIGHTS.get(name, {})
        tot = sum(wts.values()) or 1
        cov = sum(v for c, v in wts.items() if cat_ratings[c]["label"] != "not_enough_evidence") / tot
        weak = [c for c in wts if cat_ratings[c]["label"] == "weak"]
        if cov < CONFIG["coverage_threshold"] and not weak:
            label = "not_enough_evidence"
        elif weak and any(wts[c] >= 15 for c in weak):
            label = "weak"
        else:
            sc = sum(v * cat_ratings[c]["score"] for c, v in wts.items() if cat_ratings[c]["score"] is not None) / max(1e-9, sum(v for c, v in wts.items() if cat_ratings[c]["score"] is not None))
            label = "strong" if sc >= 70 else "good_with_tradeoffs" if sc >= 45 else "weak"
        rows.append({"workload": name, "label": label, "coverage": round(cov, 3), "driven_by_weak": weak})
    return rows
