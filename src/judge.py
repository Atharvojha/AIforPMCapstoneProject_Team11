"""Run the LLM judge (judge_prompt.md) on product outputs and write rating rows in the human-sheet format.

    python3 src/judge.py golden_v1.jsonl data/outputs_ai_v0.jsonl data/judge_ratings.csv --run-id run1 [--only G001,G002]

Needs the frozen golden file (the judge reads the reference labels) and credentials. The judge model defaults to
claude-sonnet-5-5 (LAPFIT_JUDGE_MODEL) so it differs from the product model; it is UNVERIFIED until judge_agreement.py
shows it agrees with humans (kappa >= 0.6 on the held-out sample).
"""
import argparse
import csv
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PROVIDER = os.environ.get("LAPFIT_PROVIDER", "anthropic")
JUDGE_MODEL = os.environ.get("LAPFIT_JUDGE_MODEL", "gemini-3-flash-preview" if PROVIDER == "gemini" else "claude-sonnet-5-5")
CRIT = ["C1", "C2", "C3", "C4", "C5"]
_C = {"type": "object", "properties": {"reasoning": {"type": "string"}, "evidence": {"type": "string"},
      "verdict": {"type": "string", "enum": ["Pass", "Fail"]}}, "required": ["reasoning", "evidence", "verdict"], "additionalProperties": False}
SCHEMA = {"type": "object", "properties": {**{c: _C for c in CRIT}, "reference_disputed": {"type": "boolean"},
          "dispute_reason": {"anyOf": [{"type": "string"}, {"type": "null"}]}},
          "required": CRIT + ["reference_disputed", "dispute_reason"], "additionalProperties": False}


def load_prompt(path=None):
    """System prompt = first fenced block of judge_prompt.md; criteria text = from 'Criteria.' to the end of the second."""
    md = open(path or os.path.join(ROOT, "judge_prompt.md"), encoding="utf-8").read()
    blocks = re.findall(r"```\n(.*?)```", md, re.S)
    system, tpl = blocks[0].strip(), blocks[1]
    return system, tpl[tpl.index("Criteria."):].strip()


def build_user(item, output, tail):
    rv = "\n".join(f'[{r["review_id"]}] stars={r.get("stars")} config="{r.get("reviewer_config_stated")}" text="{r["review_text"]}"' for r in item["reviews"])
    e = item["expected"]
    ref = (f"applicable_review_ids: {e['applicable_review_ids']}\ndealbreakers (aspect: review ids): {e['dealbreakers']}\n"
           f"watchouts, unverified (aspect: review ids): {e['watchouts']}\nconflicts: {e['conflicts']}\nevidence_gaps: {e['evidence_gaps']}\n"
           f"expected_confidence: {e['confidence']}\nwhy_correct: {e['why']}")
    clean = {k: v for k, v in output.items() if not k.startswith("_")}
    return (f"<profile>{json.dumps(item['profile'], ensure_ascii=False)}</profile>\n<listing>{json.dumps(item['laptop'], ensure_ascii=False)}</listing>\n"
            f"<reviews>\n{rv}\n</reviews>\n<reference_labels>\n(written by two human labellers; this is the answer key)\n{ref}\n</reference_labels>\n"
            f"<output>{json.dumps(clean, ensure_ascii=False)}</output>\n\n{tail}")


def judge_one(item, output, client, system, tail, model=None):
    model = model or JUDGE_MODEL
    if PROVIDER == "gemini":
        import gemini
        obj, meta = gemini.generate_json(model, system, build_user(item, output, tail), SCHEMA)
        return (obj, None) if obj is not None else (None, meta.get("error", "unknown error"))
    try:
        resp = client.messages.create(model=model, max_tokens=8000, system=system,
                                      messages=[{"role": "user", "content": build_user(item, output, tail)}],
                                      output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}})
        if resp.stop_reason != "end_turn":
            return None, f"stop_reason={resp.stop_reason}"
        return json.loads(next(b.text for b in resp.content if b.type == "text")), None
    except Exception as e:  # a judge error is never a pass
        return None, f"{type(e).__name__}: {e}"[:200]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("golden"); ap.add_argument("outputs"); ap.add_argument("ratings")
    ap.add_argument("--run-id", default=time.strftime("run-%Y%m%d-%H%M%S")); ap.add_argument("--only")
    a = ap.parse_args()
    client = None
    if PROVIDER != "gemini":
        import anthropic
        client = anthropic.Anthropic()
    system, tail = load_prompt()
    gold = [json.loads(l) for l in open(a.golden, encoding="utf-8") if l.strip()]
    outs = {json.loads(l)["item_id"]: json.loads(l) for l in open(a.outputs, encoding="utf-8") if l.strip()}
    only = set(a.only.split(",")) if a.only else None
    new = not os.path.exists(a.ratings)
    with open(a.ratings, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["item_id", "run_id", "rater", *CRIT, "comment"])
        for it in gold:
            if (only and it["item_id"] not in only) or it["item_id"] not in outs or outs[it["item_id"]].get("_failed"):
                continue
            res, err = judge_one(it, outs[it["item_id"]], client, system, tail)
            if res is None:
                print("JUDGE ERROR", it["item_id"], err, file=sys.stderr)
                continue
            fails = "; ".join(f"{c}: {res[c]['reasoning'][:120]}" for c in CRIT if res[c]["verdict"] == "Fail")
            disp = f" | reference disputed: {res['dispute_reason']}" if res["reference_disputed"] else ""
            w.writerow([it["item_id"], a.run_id, "judge", *[res[c]["verdict"] for c in CRIT], (fails + disp)[:400]])
            f.flush()
    print("wrote", a.ratings)


if __name__ == "__main__":
    main()
