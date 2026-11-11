"""Side-by-side comparison of 2-4 laptops for one profile. Same rows for every laptop; differences are reported relative to the first laptop.
No winner is ever marked: unequal evidence is shown instead (how much we know, reviews read)."""
from __future__ import annotations

import sqlite3

from . import analysis
from . import fit_engine as fe

SPEC_ROWS = [("price_inr", "Price", "₹", "lower"), ("ram_gb", "Memory (RAM)", "GB", "higher"), ("storage_gb", "Storage", "GB", "higher"),
             ("weight_kg", "Weight", "kg", "lower"), ("battery_wh", "Battery size", "Wh", "higher"), ("display_size_in", "Screen size", "in", None),
             ("refresh_hz", "Screen refresh rate", "Hz", "higher"), ("cpu", "Processor", "", None), ("gpu", "Graphics", "", None)]


def _spec_value(conn, vid, attr):
    """Best exact value; falls back to a labelled similar-model value (never mixed up with exact)."""
    all_rows = [dict(r) for r in conn.execute("SELECT * FROM spec_facts WHERE variant_id=?", (vid,))]
    merged = analysis.merge_exact([r for r in all_rows if r["attribute"].removesuffix("_options") == attr])
    if attr + "_options" in merged:
        o = merged[attr + "_options"]
        return {"value": o["value_text"].replace(",", ", "), "text": o["value_text"].replace(",", ", "), "similar_model": False, "source_id": o["source_id"], "options": True}
    rows = [r for r in all_rows if r["attribute"] == attr]
    exact = [r for r in rows if r["variant_match"] in analysis.EXACT]
    pick = sorted(exact, key=lambda r: r["variant_match"] != "exact_listing")[:1] or sorted(rows, key=lambda r: r["variant_match"])[:1]
    if not pick:
        return None
    r = pick[0]
    return {"value": r["value_num"] if r["value_num"] is not None else r["value_text"], "text": r["value_text"], "similar_model": r["variant_match"] not in analysis.EXACT,
            "source_id": r["source_id"]}


def _fmt(attr, unit, v):
    if v is None:
        return None
    if attr == "price_inr":
        return f"₹{v:,.0f}"
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return f"{v} {unit}".strip()


def compare(conn: sqlite3.Connection, ids: list[str], profile: dict) -> dict:
    ids = list(dict.fromkeys(ids))
    if not 2 <= len(ids) <= 4:
        raise ValueError("Pick between 2 and 4 laptops to compare.")
    reports = {i: analysis.analyze(conn, i, profile) for i in ids}          # raises KeyError for unknown ids
    laptops = [{"id": i, "display_name": reports[i]["variant"]["display_name"], "review_count": reports[i]["variant"]["review_count"],
                "owner_analysis": reports[i]["owner_analysis"], "knowledge": reports[i]["ratings"]["coverage"], "provisional": reports[i]["ratings"].get("provisional", False)} for i in ids]

    reqs: dict[str, dict] = {}
    for i in ids:
        for g in reports[i]["gate"]:
            reqs.setdefault(g["requirement"], {"requirement": g["requirement"], "label": g["label"], "cells": {}})["cells"][i] = {"status": g["status"], "have": g["have"]}
    problems = {i: {"serious": [{"category": d["category"], "owners": d["distinct_reports"]} for d in reports[i]["dealbreakers"]],
                    "check": [{"category": w["category"], "owners": w["distinct_reports"]} for w in reports[i]["watchouts"]]} for i in ids}
    workloads = list(profile.get("workloads", {}).keys())
    fit = [{"workload": w, "cells": {i: next((f for f in reports[i]["fit_by_use"] if f["workload"] == w), None) for i in ids}} for w in workloads]
    areas = []
    for cat in fe.CATEGORIES:
        cells = {i: {"label": reports[i]["ratings"]["categories"][cat]["label"], "basis": reports[i]["ratings"]["categories"][cat]["basis"],
                     "provisional": reports[i]["ratings"]["categories"][cat].get("provisional", False)} for i in ids}
        known = [c["label"] for c in cells.values() if c["label"] != "not_enough_evidence"]
        areas.append({"category": cat, "cells": cells, "differs": len(set(known)) > 1 and len(known) >= 2})
    specs = []
    for attr, label, unit, better in SPEC_ROWS:
        vals = {i: _spec_value(conn, i, attr) for i in ids}
        if all(v is None for v in vals.values()):
            continue
        specs.append({"attribute": attr, "label": label, "unit": unit, "better": better,
                      "values": {i: (None if v is None else {**v, "display": _fmt(attr, unit, v["value"]) if not isinstance(v["value"], str) else v["text"]}) for i, v in vals.items()}})

    base = ids[0]
    differences = []
    for i in ids[1:]:
        lines = []
        for row in specs:
            a, b = row["values"][base], row["values"][i]
            if not a or not b or a["similar_model"] or b["similar_model"] or isinstance(a["value"], str) or isinstance(b["value"], str) or a["value"] == b["value"]:
                continue
            d = b["value"] - a["value"]
            more = "more" if d > 0 else "less"
            amt = f"₹{abs(d):,.0f}" if row["attribute"] == "price_inr" else f"{abs(d):g} {row['unit']}"
            verb = {"price_inr": "costs", "weight_kg": "weighs"}.get(row["attribute"], "has")
            lines.append(f"{verb} {amt} {more}" + ("" if verb != "has" else f" {row['label'].lower()}"))
        differs = [a_["category"] for a_ in areas if a_["differs"]]
        for a_ in areas:
            ca, cb = a_["cells"][base], a_["cells"][i]
            if ca["label"] != "not_enough_evidence" and cb["label"] != "not_enough_evidence" and ca["label"] != cb["label"]:
                lines.append(f"{a_['category'].replace('_', ' ')}: {ca['label'].replace('_', ' ')} → {cb['label'].replace('_', ' ')}")
        differences.append({"laptop_id": i, "versus": base, "lines": lines})
    notes = []
    if any(not l["owner_analysis"]["state"] == "complete" for l in laptops):
        notes.append("We have not finished reading the owner reviews for every laptop here, so owner-based results are early and may change.")
    spread = max(l["knowledge"] for l in laptops) - min(l["knowledge"] for l in laptops)
    if spread >= 0.15:
        notes.append("We know more about some of these laptops than others. A laptop that looks worse may simply have less information behind it.")
    return {"laptops": laptops, "must_haves": list(reqs.values()), "problems": problems, "fit_by_use": fit, "areas": areas, "specs": specs,
            "differences": differences, "notes": notes, "profile_echo": reports[base]["profile_echo"]}
