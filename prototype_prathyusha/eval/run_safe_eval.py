#!/usr/bin/env python3
"""Safety evaluation: injection detector, SSRF guard, URL policy, quote validator, claim sanitiser. Pure code, no model, no network (DNS only for literals)."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "backend"))
from lapfit import text_utils as tu  # noqa: E402
from lapfit.claim_checker import sanitise  # noqa: E402
from lapfit.research import policy  # noqa: E402
S = json.load(open(ROOT / "eval/golden/g_safe_v0.json"))
atk = [(a, bool(tu.injection_flag(a))) for a in S["injection_attacks"]]
ben = [(b, bool(tu.injection_flag(b))) for b in S["benign_real_reviews"]]
ssrf = []
for x in S["ssrf_hosts"]:
    try: policy.assert_public_host(x["host"]); blocked = False
    except policy.PolicyError: blocked = True
    ssrf.append((x["host"], x["expected_blocked"], blocked))
urls = [(u["url"], u["expected_action"], policy.classify(u["url"]).action) for u in S["url_policy"]]
qs = [(q, q["valid"], tu.locate_quote(q["text"], q["quote"]) is not None) for q in S["quote_checks"]]
cl = []
for c in S["claim_injection"]:
    clean, flagged = sanitise(c["claim"]); cl.append((c["claim"], c["expected_flagged"], flagged, clean))
summary = {"gold": "g_safe_v0.json (AI-drafted)",
  "injection_attack_recall": f"{sum(f for _, f in atk)}/{len(atk)}", "injection_false_positives_on_real_reviews": f"{sum(f for _, f in ben)}/{len(ben)}",
  "ssrf_correct": f"{sum(e == g for _, e, g in ssrf)}/{len(ssrf)}", "url_policy_correct": f"{sum(e == g for _, e, g in urls)}/{len(urls)}",
  "quote_validator_correct": f"{sum(e == g for _, e, g in qs)}/{len(qs)}", "quote_false_accepts": sum((not e) and g for _, e, g in qs),
  "claim_injection_correct": f"{sum(e == f for _, e, f, _ in cl)}/{len(cl)}",
  "missed_attacks": [a for a, f in atk if not f], "false_positives": [b[:90] for b, f in ben if f],
  "ssrf_wrong": [(h, e, g) for h, e, g in ssrf if e != g], "url_wrong": [(u, e, g) for u, e, g in urls if e != g],
  "quote_wrong": [(q["quote"][:50], q.get("why"), g) for q, e, g in qs if e != g], "claim_wrong": [(c[:60], e, f) for c, e, f, _ in cl if e != f]}
out = ROOT / "eval/results/safe_eval_latest.json"; out.parent.mkdir(exist_ok=True); json.dump(summary, open(out, "w"), indent=2, ensure_ascii=False)
print(json.dumps(summary, indent=2, ensure_ascii=False))
