# LapFit capstone folder

Problem: students choosing a laptop can't tell which reviews apply to their use, which drawbacks are dealbreakers for them, or where evidence conflicts or is missing.

| Deliverable | Files | State |
|---|---|---|
| 1 AI PRD | `01_AI_PRD.docx` | Draft v0.2 (Team 11 and members filled in) |
| 2 Golden dataset | `02_golden_dataset_v1.xlsx`, `02_data_collection_protocol.md` | 40 items, 97 reviews, **all 40 labelled by Claude (AI-drafted, NOT human-verified)**; a human spot-check of about 10 items is still needed |
| 3 Eval framework | `03_eval_framework.docx`, `03_output_schema.md`, `judge_prompt.md`, `03_human_rating_sheet.xlsx` | Written; judge uncalibrated |
| 4 Results and iterations | `04_iteration_log.csv`, `data/`, `src/` | Rules baseline and AI arm (Gemini, prompt v0, one run) logged, and both scored against the AI-drafted labels (provisional). Iterations 1 and 2 done (two runs per prompt); v1 kept, v2 did not help; see `04_failure_analysis.md`. Credits depleted: no more AI runs until topped up |
| 4 Failure analysis | `04_failure_analysis.md` | Iteration 0 to 1 written up |
| 4 Prototype and design | `ui/index.html`, `04_experience_design.md` | Built; checked in a browser |
| 5 Customer evidence | `customer/` (guide, consent, baseline sheets, evidence workbook, recruit plan) | **Kit built; no sessions run.** Needs 5+ real students (not teammates or classmates) |
| 6 Demo and deck | (to do) | |

## Commands (run from this folder)
Needs Python 3 and `openpyxl` for the first two; the rest use the standard library.

```bash
python3 src/validate_golden.py 02_golden_dataset_v1.xlsx            # check the golden workbook
python3 src/export_app_data.py                                        # rebuild ui/data.json and data/*.jsonl from the workbook
python3 src/run_eval.py baseline --note "what changed"                # score the rules baseline and log a row
python3 src/lapfit.py dry data/items_inputs.jsonl G001                # show the AI prompt for one item
python3 src/lapfit.py run data/items_inputs.jsonl data/outputs_ai_v0.jsonl   # AI arm; resumes, skipping finished items
#   Claude: pip install anthropic, then set ANTHROPIC_API_KEY (or run `ant auth login`)
#   Gemini: set LAPFIT_PROVIDER=gemini and GEMINI_API_KEY in the environment (never in a file); default model gemini-3.5-flash
#           (Google served it as gemini-3.6-flash; the served version is stored in each record's _meta)
python3 src/run_eval.py ai --outputs data/outputs_ai_v0.jsonl --note "prompt v0"
python3 src/judge.py <golden.jsonl> <outputs.jsonl> data/judge_ratings.csv   # LLM judge (after labels are frozen)
python3 src/judge_agreement.py 03_human_rating_sheet.xlsx --a human --b judge
python3 -m http.server 8765 --directory ui                            # then open http://localhost:8765
python3 src/summarise_sessions.py customer/05_customer_evidence.xlsx   # totals and targets for the customer sessions
```

Tests (all use stub or toy data): `python3 src/test_eval_metrics.py`, `test_baseline_rules.py`, `test_lapfit.py`, `test_judge.py`, `test_gemini.py`, `test_summarise_sessions.py`.

## Rules
The golden labels were drafted by Claude (an AI) because the team had no time. They were written before any model result was scored, but they are not hand labels and are not human-verified; say so wherever scores are quoted. The gate in `src/eval_metrics.py` is fixed before the first scored run. Review text in this folder is team-collected and unverified; 7 reviews (R091 to R097) are synthetic adversarial tests and are marked as such.
