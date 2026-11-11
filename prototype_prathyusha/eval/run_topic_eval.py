"""Fast topic reader vs the 40-review gold set (g_ext_v1). Uses a throw-away votes DB. python eval/run_topic_eval.py"""
import argparse, json, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "backend"))
from lapfit import topic_reader as T
from lapfit.db import connect
from lapfit.llm import OllamaProvider
T.VOTES_DB = Path(tempfile.mkdtemp()) / "v.db"
ap = argparse.ArgumentParser(); ap.add_argument("--gold", default=str(ROOT / "eval/golden/g_ext_v2_heldout.json")); ap.add_argument("--workers", type=int, default=1); A = ap.parse_args()
G = json.load(open(A.gold))["items"]; main = connect(); votes = T.votes_conn(); llm = OllamaProvider(num_predict=60)
import time; T0 = time.time()
tp = fp = fn = pol_ok = pol_n = noclaim_ok = noclaim_n = 0
for g in G:
    T.read_one(main, votes, llm, g["review_id"])
    got = {r["topic"]: r["opinion"] for r in votes.execute("SELECT topic, opinion FROM topic_votes WHERE review_id=?", (g["review_id"],))}
    gold = {c["category"]: c["polarity"] for c in g["gold"] if c["category"] in T.TOPICS}
    if not gold: noclaim_n += 1; noclaim_ok += (not got); 
    tp += len(set(got) & set(gold)); fp += len(set(got) - set(gold)); fn += len(set(gold) - set(got))
    for t in set(got) & set(gold):
        if gold[t] in ("positive", "negative", "mixed"): pol_n += 1; pol_ok += got[t] == gold[t]
P = tp / (tp + fp); R = tp / (tp + fn)
out = {"gold": Path(A.gold).name + " (AI-drafted, unverified); topics outside the reader's list ignored", "reader_version": T.VERSION, "reviews": len(G), "topic_precision": round(P, 3), "topic_recall": round(R, 3), "f1": round(2 * P * R / (P + R), 3),
       "opinion_right_on_matched": f"{pol_ok}/{pol_n}", "reviews_with_no_topic_handled": f"{noclaim_ok}/{noclaim_n}", "seconds_per_review": round(__import__("time").time() - T0, 1) / len(G)}
json.dump(out, open(ROOT / "eval/results" / ("topic_eval_" + T.VERSION + "_" + Path(A.gold).stem + ".json"), "w"), indent=1); print(json.dumps(out, indent=1))
