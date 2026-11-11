import pytest
from lapfit.fit_engine import (Profile, gate, owner_buckets, classify, owner_rating, ratings, fit_by_use, wilson_lower, CONFIG, CATEGORIES)

def fact(num, src="S-FLIPKART-LISTING", vm="exact_listing"): return {"value_num": num, "value_text": str(num), "source_id": src, "variant_match": vm}

def claims(rows):  # (cluster, category, polarity, strength)
    return [{"review_id": f"R{i}", "cluster_key": k, "category": c, "polarity": p, "strength": s, "excluded": None} for i, (k, c, p, s) in enumerate(rows)]

def test_wilson_basic():
    assert wilson_lower(0, 0) == 0.0
    assert wilson_lower(10, 10) > 0.7 and wilson_lower(2, 3) < 0.5      # small n is cautious

def test_gate_unknown_never_passes_and_spec_mismatch_is_separate():
    p = Profile(hard={"budget_inr_max": 60000, "ram_gb_min": 16, "weight_kg_max": 1.7, "battery_h_min": 6})
    facts = {"price_inr": fact(46999), "ram_gb": fact(8), "weight_kg": fact(1.65)}
    g = {r["requirement"]: r for r in gate(p, facts, [])}
    assert g["budget_inr_max"]["status"] == "met" and g["weight_kg_max"]["status"] == "met"
    assert g["ram_gb_min"]["status"] == "spec_mismatch"
    assert g["battery_h_min"]["status"] == "unknown"

def test_battery_never_passes_even_with_exact_lab_hours():
    p = Profile(hard={"battery_h_min": 6})
    bench = [{"variant_match": "exact_family", "methodology": "independent_lab_script", "value_text": "16", "unit": "hours", "conditions": "150 nits web surfing"}]
    g = gate(p, {}, bench)[0]
    assert g["status"] == "unknown" and "150 nits" in g["note"]

def test_missing_fact_is_unknown_not_met():
    g = gate(Profile(hard={"ram_gb_min": 16}), {}, [])[0]
    assert g["status"] == "unknown"

def test_dealbreaker_needs_two_independent_clear_complaints_on_priority():
    c = claims([(1, "battery", "negative", "clear"), (2, "battery", "negative", "clear"), (3, "display", "negative", "clear")])
    cl = classify(owner_buckets(c, ["battery"]), ["battery"])
    assert [d["category"] for d in cl["dealbreakers"]] == ["battery"]
    assert [w["category"] for w in cl["watchouts"]] == ["display"]       # single complaint is a watch-out

def test_duplicates_count_once():
    c = claims([(1, "battery", "negative", "clear"), (1, "battery", "negative", "clear")])   # same cluster twice
    cl = classify(owner_buckets(c, ["battery"]), ["battery"])
    assert cl["dealbreakers"] == [] and len(cl["watchouts"]) == 1

def test_mild_remarks_do_not_count_toward_dealbreaker():
    c = claims([(1, "battery", "negative", "clear"), (2, "battery", "negative", "mild")])
    assert classify(owner_buckets(c, ["battery"]), ["battery"])["dealbreakers"] == []

def test_excluded_claims_ignored():
    c = claims([(1, "battery", "negative", "clear"), (2, "battery", "negative", "clear")]); c[1]["excluded"] = "different_variant"
    assert classify(owner_buckets(c, ["battery"]), ["battery"])["dealbreakers"] == []

def test_priority_with_few_reports_is_a_gap():
    c = claims([(1, "battery", "positive", "clear"), (2, "battery", "positive", "clear")])
    cl = classify(owner_buckets(c, ["battery"]), ["battery"])
    assert cl["gaps"] and owner_rating(owner_buckets(c, [])["battery"])["label"] == "not_enough_evidence"

def test_coverage_matches_documented_example_30_percent():
    # wireframe example: memory 20 + portability 10 of 100 have evidence => 30%, no number shown
    p = Profile(workloads={"programming": "daily"})
    g = gate(Profile(hard={"ram_gb_min": 16, "weight_kg_max": 1.7}), {"ram_gb": fact(8), "weight_kg": fact(1.65)}, [])
    r = ratings(p, {}, g, {}, {})
    assert r["coverage"] == pytest.approx(0.30, abs=1e-6) and r["score_visible"] is False and r["score"] is None
    assert r["categories"]["memory"]["label"] == "weak" and r["categories"]["portability"]["label"] == "strong"

def test_score_visible_only_with_enough_coverage():
    p = Profile(workloads={"programming": "daily"})
    rows = []
    k = 0
    for cat in ("performance", "memory", "thermals_noise", "keyboard_trackpad"):   # 25+20+15+10 = 70% of weights
        for _ in range(5):
            k += 1; rows.append((k, cat, "positive", "clear"))
    r = ratings(p, owner_buckets(claims(rows), []), [], {}, {})
    assert r["coverage"] >= CONFIG["coverage_threshold"] and r["score_visible"] and r["score"] is not None

def test_hard_fail_overrides_fit_label():
    p = Profile(workloads={"programming": "daily"})
    g = gate(Profile(hard={"ram_gb_min": 16}), {"ram_gb": fact(8)}, [])
    r = ratings(p, {}, g, {}, {})
    f = fit_by_use(p, r["categories"])[0]
    assert f["label"] == "weak" and "memory" in f["driven_by_weak"]

def test_weights_normalise_and_priority_boost():
    p = Profile(workloads={"programming": "daily", "design_video": "weekly"}, priorities=["memory"])
    w = p.weights()
    assert abs(sum(w.values()) - 100) < 0.1 and w["memory"] > 20
