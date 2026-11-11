# eval/ — golden sets, runners, results

**All gold labels here were written by Claude (AI-drafted) and are NOT human-adjudicated.** Where a set was used to tune code, it is marked *dev*; honest held-out numbers are the FIRST runs.

| Set | File | Items | Runner | Status |
|---|---|---|---|---|
| G-FIT (earlier team) | `../../data/golden_draft.jsonl` | 40 | (not ported yet) | AI-labelled, unverified |
| G-CLAIM v0 | `golden/g_claim_v0_draft.jsonl` | 14 | `run_claim_eval.py --gold …` | dev |
| G-CLAIM v1 held-out | `golden/g_claim_v1_heldout.jsonl` | 35 | same | first run was held-out (28/35); **now dev** |
| G-VAR | `golden/g_var_v0.jsonl` | 51 | `run_var_eval.py` | hand-written from titles; first run 48/51, now dev |
| G-SAFE | `golden/g_safe_v0.json` | 30 attacks + 60 real benign + 23 hosts + 28 URLs + 39 quotes + 8 claims | `run_safe_eval.py` | detector tuned on it (dev); SSRF/URL/quote parts not tuned |
| G-SAFE held-out v1 / v2 | `golden/g_safe_heldout_v1.json`, `_v2.json` | 20 + (20 attacks + 20 tricky benign) | inline (see RAG_EVALUATION) | v1 = dev after first run; **v2 = true held-out, run once** |
| G-EXT | `golden/g_ext_v0.json` | 40 reviews, 67 gold claims | `run_ext_eval.py` | labelled without looking at model output; guards later tuned on it (dev) |
| G-RET | (derived from G-EXT) | 15 queries / 40-doc pool | `run_ret_eval.py` | ablation signal only |
| G-LIVE | `golden/g_live_v0.json` | 5 laptops | manual (see file) | precision only, Claude-judged |
| Injection end-to-end | `golden/g_safe_heldout_v1/v2` | 40 attacks | `run_injection_e2e.py` (needs Ollama) | real model |
| Model smoke | — | 44 snippets | `bench_llm_extraction.py`, `bench_embeddings.py` | no gold needed |

Results: `results/*.json` (latest per runner). Freeze rule: a set's FIRST run is its honest number; after fixing against it, it becomes a dev set and a fresh held-out set is needed.

## Added 2026-11-11
| Set | File | What it tests | Status |
|---|---|---|---|
| G-NEEDS v1 | `golden/g_needs_v1_heldout.json` (24) | free-text needs parsing | first run 21/24 on uses; fixed → dev set |
| Fast reader | uses `g_ext_v1_heldout.json` | topic precision/recall for `topic_reader` | first run P 0.89 / R 0.46 / opinion 30/30 |
Runners: `eval/run_needs_eval.py`, `eval/run_topic_eval.py`.

| G-EXT v2 | `golden/g_ext_v2_heldout.json` (40 reviews, 76 topics) | reader v2 topic precision/recall | first run P 0.81 / R 0.95 / opinion 68/72 |

| G-EXT v3 | `golden/g_ext_v3_heldout.json` (40 reviews, 78 topics) | reader v3 (compact reply) | first run P 0.88 / R 0.83 / opinion 58/65, 1.04 s per review |


## 2026-11-11 (later)
`run_e2e_check.py` now has 39 checks (scenario 6: needs sheet and listing check). The Lie Detector has no answer-key evaluation yet (Q-033); do not quote an accuracy for it.

`run_listing_eval.py [key.json] [--model]` scores the Listing Lie Detector (keys: `golden/g_listing_v1.json`, `v2_heldout`, `v3_fresh`). First-run result files are kept as `*FIRST_RUN*`. See `docs/LISTING_EVALUATION.md`; do not quote an accuracy beyond what that file says.


## Final state table (2026-11-11)
| Runner | Key / input | Needs running API? | Latest first-run (honest) |
|---|---|---|---|
| `run_needs_eval.py` | `golden/g_needs_v1_heldout.json` (24) | no | uses 21/24, budget 24/24, avoid 24/24 |
| `run_topic_eval.py [--gold]` | `golden/g_ext_v3_heldout.json` (78 topics) | needs Ollama | P 0.878, R 0.833, opinion 58/65 |
| `run_claim_eval.py` | `golden/g_claim_v2_heldout.jsonl` (41) | no | 19/41 (dev set 41/41 after fixes) |
| `run_listing_eval.py [key] [--model]` | `golden/g_listing_v1/v2_heldout/v3_fresh.json` (123 claims) | no (`--model` needs Ollama) | 68%, 91%, 100% of verdicts; laptop match 17/24 on the first |
| `run_e2e_check.py` | live API, 5 scenarios + needs sheet + listing | yes | 39/39 (33/33 earlier while missing real bugs) |
All keys are AI-written and unverified by a person. First-run result files are kept (`*FIRST_RUN*`); the v1 listing first run is recorded in `docs/LISTING_EVALUATION.md` only.
