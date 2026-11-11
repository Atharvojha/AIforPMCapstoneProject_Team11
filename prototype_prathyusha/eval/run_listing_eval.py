"""Score the Listing Lie Detector against an answer key (default: eval/golden/g_listing_v1.json).
Every expected claim is a (span, kind, verdict). A claim is FOUND when some system claim contains the span. Verdict and kind are scored only on found claims.
Verdicts the system gives to claims that are NOT in the key are listed as 'unreviewed', not scored (the key only holds clear cases), except where the key forbids them.
  .venv/bin/python eval/run_listing_eval.py [key.json] [--model]      (--model also runs with the local language model)"""
import json, re, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from lapfit import listing_check as L          # noqa: E402
from lapfit.db import connect                  # noqa: E402
from lapfit.llm import OllamaProvider          # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
key_path = Path(args[0]) if args else ROOT / "eval/golden/g_listing_v1.json"
key = json.loads(key_path.read_text())
conn = connect()
CONF = ("supported", "contradicted")


def run(mode: str):
    prov = OllamaProvider(num_predict=300, timeout=90, retries=0) if mode == "model" else None
    tot = {"claims": 0, "found": 0, "verdict_ok": 0, "kind_ok": 0, "items": len(key["items"]), "matched_ok": 0, "ask_ok": 0, "ask_n": 0, "ign_ok": 0, "ign_n": 0, "forbid_bad": 0}
    unreviewed, fails, secs = [], [], 0.0
    conf_matrix: dict[str, int] = {}
    for it in key["items"]:
        t0 = time.time()
        r = L.check_listing(conn, it["text"], prov)
        secs += time.time() - t0
        got = r["matched"]["id"] if r["matched"] else None
        if got == it["matched"]:
            tot["matched_ok"] += 1
        else:
            fails.append(f"{it['id']} MATCH expected {it['matched']} got {got}")
        used = set()
        for ec in it["claims"]:
            tot["claims"] += 1
            sc = next((c for c in r["claims"] if ec["span"].lower() in c["text"].lower()), None)
            if sc is None:
                fails.append(f"{it['id']} MISSING claim '{ec['span']}' (expected {ec['verdict']})")
                continue
            used.add(sc["id"]); tot["found"] += 1
            tot["kind_ok"] += sc["kind"] == ec["kind"]
            ok = sc["verdict"] == ec["verdict"]
            tot["verdict_ok"] += ok
            conf_matrix[f"{ec['verdict']}->{sc['verdict']}"] = conf_matrix.get(f"{ec['verdict']}->{sc['verdict']}", 0) + 1
            if not ok:
                fails.append(f"{it['id']} VERDICT '{ec['span']}' expected {ec['verdict']} got {sc['verdict']} | {sc['headline'][:110]}")
            if sc["kind"] != ec["kind"]:
                fails.append(f"{it['id']} KIND '{ec['span']}' expected {ec['kind']} got {sc['kind']}")
        for c in r["claims"]:
            if c["id"] in used:
                continue
            if any(f.lower() in c["text"].lower() for f in it.get("forbidden_in_claims", [])):
                tot["forbid_bad"] += 1; fails.append(f"{it['id']} FORBIDDEN claim made from injected text: '{c['text']}'")
            elif any(f.lower() in c["text"].lower() for f in it.get("forbid_confident_spans", [])) and c["verdict"] in CONF:
                tot["forbid_bad"] += 1; fails.append(f"{it['id']} FORBIDDEN confident verdict on '{c['text']}' -> {c['verdict']}")
            elif it.get("forbid_confident") and c["verdict"] in CONF:
                tot["forbid_bad"] += 1; fails.append(f"{it['id']} FORBIDDEN confident verdict on non-claim '{c['text']}' -> {c['verdict']}")
            elif c["verdict"] in CONF:
                unreviewed.append(f"{it['id']} [{c['verdict']}] {c['text'][:60]} -> {c['headline'][:90]}")
        if it.get("expect_ignored"):
            tot["ign_n"] += 1; tot["ign_ok"] += bool(r["ignored_instructions"])
            if not r["ignored_instructions"]:
                fails.append(f"{it['id']} instructions NOT reported as ignored")
        for kw in it.get("ask_contains", []):
            tot["ask_n"] += 1
            hit = kw.lower() in " ".join(r["questions"]).lower()
            tot["ask_ok"] += hit
            if not hit:
                fails.append(f"{it['id']} ASK-THE-SELLER missing '{kw}'")
    return tot, fails, unreviewed, conf_matrix, secs


out = {}
for mode in (["rules", "model"] if "--model" in sys.argv else ["rules"]):
    tot, fails, unrev, cm, secs = run(mode)
    pct = lambda a, b: f"{100 * a / b:.0f}%" if b else "n/a"
    print(f"\n=== {key['id']} | splitter: {mode} | {tot['items']} listings, {tot['claims']} expected claims | {secs:.0f}s")
    print(f"claims found {tot['found']}/{tot['claims']} ({pct(tot['found'], tot['claims'])}) | verdict right on found {tot['verdict_ok']}/{tot['found']} ({pct(tot['verdict_ok'], tot['found'])}) | "
          f"verdict right overall {tot['verdict_ok']}/{tot['claims']} ({pct(tot['verdict_ok'], tot['claims'])}) | kind right {tot['kind_ok']}/{tot['found']}")
    print(f"right laptop (or none) {tot['matched_ok']}/{tot['items']} | injection reported {tot['ign_ok']}/{tot['ign_n']} | ask-the-seller keywords {tot['ask_ok']}/{tot['ask_n']} | forbidden outputs {tot['forbid_bad']}")
    print("verdict confusion (expected->got):", dict(sorted(cm.items())))
    print(f"unreviewed confident verdicts (need a human look, not scored): {len(unrev)}")
    for u in unrev:
        print("   ?", u)
    print(f"FAILURES ({len(fails)}):")
    for f in fails:
        print("  -", f)
    out[mode] = {**tot, "failures": fails, "unreviewed": unrev, "confusion": cm, "seconds": round(secs, 1)}
dest = ROOT / "eval/results" / f"listing_eval_{key_path.stem}.json"
dest.parent.mkdir(exist_ok=True)
dest.write_text(json.dumps({"key": key["id"], "run": time.strftime("%Y-%m-%d %H:%M"), "results": out}, indent=1))
print("\nsaved", dest.relative_to(ROOT))
