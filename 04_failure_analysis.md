# Failure analysis and iteration log narrative

All scores below are against the **AI-drafted golden labels** (written by Claude, not human-verified; see the Labelling_Guide tab). Treat every number as provisional until a human has checked a sample. Model: Gemini, served as `gemini-3.6-flash`. Raw rows are in `04_iteration_log.csv`; outputs in `data/outputs_ai_*.jsonl`.

## Iteration 0 to 1

**Failure class chosen (biggest in run v0): a single complaint escalated to a dealbreaker.** 10 false dealbreakers in v0 run 1, six of them on battery. Cause found in the outputs: the model counted mild remarks ("battery life is average", "could be clearer") as a second complaint, so one clear complaint plus a mild remark became a dealbreaker. This is the HMW's own failure ("dropped a good option over one unverified complaint").

**Change (prompt v0 to v1, two bullets only):** a dealbreaker needs 2 or more independent *clear* complaints; mild or ambiguous remarks ("average", "could be better", "I wish it had", "takes getting used to") do not count toward the two; the watch-out definition says the same. Nothing else changed.

**How the comparison was made fair:** each prompt was run on all 40 items, v0 twice and v1 twice, to see how much two identical runs differ.

| Run | Dealbreaker recall (gate 85%) | Items with a false dealbreaker (gate 10% or less) | Single complaints escalated | Dealbreakers named | Overconfident items (gate 10% or less) | "Insufficient" right (gate 100%) | Assertions all pass |
|---|---|---|---|---|---|---|---|
| v0 run 1 | 8/16 (50%) | 25% | 9 | 18 | 17.5% | 13/15 | 100% |
| v0 run 2 | 9/16 (56%) | 25% | 8 | 19 | 22.5% | 11/15 | 95% |
| v1 run 1 | 5/16 (31%) | 5% | 1 | 7 | 22.5% | 11/15 | 97.5% |
| v1 run 2 | 3/16 (19%) | 7.5% | 1 | 6 | 22.5% | 11/15 | 95% |

**Noise:** two identical runs agreed on the dealbreaker set for 35 of 40 items (both prompts) and on confidence for 32/40 (v0) and 35/40 (v1). The recall spread between identical runs was 1 to 2 dealbreakers out of 16.

## What changed, honestly
- **Target fixed.** Escalated single complaints fell from 8 or 9 to 1; items with a false dealbreaker fell from 25% to 5 to 7.5%. This is well outside run-to-run noise, and it is the first time that gate row passes.
- **Recall fell, and it is the metric the PRD says matters more.** Dealbreakers found dropped from about 50% to about 25%. The PRD says a missed dealbreaker costs the student more than a wrongly flagged one, so on that reasoning iteration 1 moved in the wrong direction overall. It is not a clear improvement.
- **No change** in overconfidence (17.5 to 22.5% before, 22.5% after) or in "Insufficient" accuracy; those differences are inside the noise.
- **No gate row that failed before now passes except the false-dealbreaker one.** The ship gate is still not met.

## Where the remaining misses come from (v1 missed 11 and 13 of the 16 gold dealbreakers in its two runs)
| Cluster | Items | What happens | Is it the model or the label? |
|---|---|---|---|
| Slow multitasking not linked to RAM | G001, G029, G035 | The model files "slow with many tabs" under performance and never connects it to the student's RAM priority or the 8 GB listing. Missed in v0 and v1. | Looks like a real model miss: the listing shows 8 GB and one profile's stated dealbreaker is 8 GB RAM. |
| Heat and fan noise under heavy use | G002, G013 (also G009, G016, G022 in some runs) | The model treats "fan audible in heavy work" as acceptable. Missed in v0 and v1. | Partly a judgement call about how bad the remark is. |
| Borderline battery wording | G012, G025, G033, G034 | One review says "lost charge quickly" (clear), the other "I expected more battery life". The v1 model reads the second as mild. | Mostly a labelling judgement: the label counted it as clear. A human could rule either way. |
| Software on macOS | G005 | Single review plus a listing fact, shown only as a watch-out. | Rule-(b) judgement. |

## New failure mode seen in the repeat runs
In 5 of 120 outputs the model claimed a dealbreaker with `basis: listing_fact` but cited no applicable review (for example "no dedicated GPU" for a GPU-hungry student, or a value claim), and in one v0 run a quote was not verbatim. Both are caught by the assertions, which is why single runs are not enough.
**Design question for the team:** should a listing fact alone (the student's stated dealbreaker is "integrated graphics" and the listing says integrated) ever be a dealbreaker without a review? The current rule says no; the model keeps trying to say yes, and arguably it has a point.

## Decision and next step
Keep prompt v1's definition of a clear complaint (it fixes the failure the problem statement is about), but do not call it a success. **Iteration 2 should recover recall without bringing back escalation:** (1) tell the model that slow multitasking is memory evidence and to compare the listing's RAM with the student's stated need; (2) count a heavy-use fan or heat complaint as a thermals complaint for students who do heavy work; (3) decide the listing-fact question above first. Re-run with repeats and compare to the noise band above.

## Caveats
Labels are AI-drafted and the borderline clear-versus-mild calls are my own judgement, so part of "improvement" here means "closer to my rule", not "closer to the truth". The prompt and the labelling rules come from the same guide. One model family, one served version, two runs per prompt.


---

## Iteration 1 to 2 (did not work; prompt v1 stays the working prompt)

**Failure class targeted:** real dealbreakers the model never made (the miss clusters above).
**Change (prompt v1 to v2, one added line):** slow multitasking is memory evidence, so compare the listing's RAM with the student's need; heat or fan noise during heavy work counts as a thermals complaint for students who do heavy work.
**Data caveat:** the credit balance ran out (HTTP 402) on the last item of run 1, so item G039 is missing from v2 run 1. All six runs below are compared on the **39 items every run has**. The log row for v2 run 1 is marked INCOMPLETE.

| Run | Dealbreakers found (of 16) | Items with a false dealbreaker | Single complaints escalated | Dealbreakers named | Overconfident | "Insufficient" right (of 15) | Assertions all pass |
|---|---|---|---|---|---|---|---|
| v1 run 1 | 5 | 5.1% | 1 | 7 | 23.1% | 11 | 97.4% |
| v1 run 2 | 3 | 7.7% | 1 | 6 | 23.1% | 11 | 94.9% |
| v2 run 1 | 4 | 17.9% | 1 | 11 | 10.3% | 14 | 87.2% |
| v2 run 2 | 6 | 12.8% | 1 | 11 | 20.5% | 12 | 89.7% |

**What happened**
- **The targeted guidance did nothing measurable.** Review-based dealbreakers that match the labels: 4 and 3 (v1) against 4 and 4 (v2). RAM-from-multitasking cases found: 0 of 6 item-runs (v1) against 1 of 6 (v2). Heat cases: 2 of 10 in both.
- **It made things worse in one specific way.** Every new false dealbreaker and every new assertion failure is a dealbreaker with `basis: listing_fact` and no review cited. Such claims were 2 to 3 of about 6 dealbreakers in v1 and 6 to 7 of 11 in v2. They are mostly "no dedicated GPU" for GPU-hungry profiles (G002, G005, G020, G026) and one price claim (G034). Telling the model to compare the listing with the student's needs pushed it toward listing-only claims.
- **Small gains inside the noise:** overconfidence (10 to 20% against 23%) and "Insufficient" accuracy (12 to 14 of 15 against 11) moved in the right direction, but the identical-run spread (v0: 8 to 9 found, 11 to 13 "Insufficient") is as large.

**Decision:** revert the working prompt to v1 (v2 stays in the code as a record). Do not pretend this was progress.

## The listing-fact question now blocks the metrics
The model is not simply wrong when it says a student who needs a GPU should not buy a laptop with integrated graphics; the profile's own stated dealbreaker says so. My labelling rule (b) only allows a listing fact when one review also reports it, so those claims count as false and also fail assertion A4. Until the team decides whether a listing fact alone can be a dealbreaker, false-dealbreaker rate and recall are partly measuring that open policy question, not model quality. If the answer is yes, the labels need a new version (v0.6) with listing-only dealbreakers added and the runs re-scored, logged as a labelling change and not as a model improvement.

## Suggested iteration 3 (architecture, not another sentence in the prompt)
Two single-call prompt edits have now each fixed one thing and broken another. The PRD's own design splits the work: the model **extracts** per review (aspect, polarity, how clear, which use) and **code applies the thresholds** (two clear reports make a dealbreaker, one makes a watch-out, listing facts handled by the agreed policy). That makes the counting deterministic, removes the escalation problem by construction, and leaves the model only the reading task it is good at.

## Cost and state
All AI runs so far: 269 request records, about 450k input and 1.59M output and thinking tokens, about $6.3 at Google's list price. The prepaid credit balance is now depleted, so no more runs are possible until it is topped up.
