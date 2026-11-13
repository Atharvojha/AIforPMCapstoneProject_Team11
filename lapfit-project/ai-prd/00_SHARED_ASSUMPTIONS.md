# Shared assumptions for the AI PRDs

Every AI PRD in this folder follows the one-page AI PRD template (13 parts). Numbers that are the same across features live here so they are stated once. **Everything marked [A] is an assumption to replace with a measurement.**

## How each PRD maps to the template

| # | Template part | PRD heading |
|---|---|---|
| 01 | Problem and user | Problem and user |
| 02 | Why AI, not rules | Why AI, not rules |
| 03 | AI objective and metrics | AI objective and metrics |
| 04 | Approach options | Approach options |
| 05 | Data | Data |
| 06 | Eval plan | Eval plan |
| 07 | Failure modes and fallback | Failure modes and fallback |
| 08 | Human-in-the-loop | Human-in-the-loop |
| 09 | Responsible AI | Responsible AI |
| 10 | Cost and token economics | Cost and token economics |
| 11 | Latency budget | Latency budget |
| 12 | Launch plan and guardrails | Launch plan and guardrails |
| 13 | Open questions | Open questions (owner and date) |

---

## A. Model and prices (checked 13 Nov 2026)

From Google's Gemini pricing page, paid tier, per 1 million tokens, standard. **Prices change; verify before relying on them.**

| Model (as shown) | Input | Output (includes thinking tokens) | Batch input / output |
|---|---|---|---|
| `gemini-3.1-flash-lite` (**assumed model for all reading and writing here**) | $0.25 (text, image) | $1.50 | $0.125 / $0.75 |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | $0.15 / $1.25 |
| `gemini-2.5-flash-lite` | $0.10 | $0.40 | $0.05 / $0.20 |
| `gemini-3.8-flash` | $0.75 until 31 Dec 2026, then $1.50 | $3.75, then $7.50 | $0.375 / $1.875, then $0.75 / $3.75 |

- **Batch API:** 50% cheaper on the paid tier. Used for offline labelling.
- **Free tier:** no charge, but Google may use the content to improve its products (see decision D-14), so it is for sample or public data only.
- **Thinking tokens count as output.** Set thinking to the minimum for reading and writing calls, or costs rise.
- **Not checked:** embedding model price; Supabase and Make plan prices.

## B. Token and cost per call (assumed sizes)

| Call | Used for | Input tokens [A] | Output tokens [A] | Cost per call |
|---|---|---|---|---|
| R: router | Read a request into fields | 1,300 | 300 | **$0.000775** |
| W: reasons writer | 2 to 3 reasons per result | 450 | 180 | **$0.000383** |
| P: photo reader (V1) | Read one resized image | 1,630 | 250 | **$0.000783** |
| T: review tagger (batch) | Label one review | 300 | 60 | **$0.0000825** |
| S: evidence summariser (V2) | Restate retrieved rows | 1,500 | 120 | **$0.000555** |
| M: moderation triage (V1) | Pre-sort a report | 400 | 60 | **$0.00019** |
| L: listing writer (V1) | Write a listing | 500 | 250 | **$0.0005** |
| N: insight narrator (V2) | Short note from figures | 800 | 150 | **$0.000425** |
| J: judge (evaluation) | Score one answer | 1,500 | 200 | **$0.000675** |

Arithmetic: cost = input tokens × $0.25 ÷ 1,000,000 + output tokens × $1.50 ÷ 1,000,000 (batch uses half the rates). Example, R: 1,300 × 0.25 ÷ 1e6 = $0.000325; 300 × 1.5 ÷ 1e6 = $0.00045; total $0.000775.

**Context caching** (cached input $0.025 per million, storage $1.00 per million tokens per hour): a 1,000-token system prompt saves about $0.000225 per call but costs about $0.73 a month to store, so it pays off only above roughly 3,200 calls a month. Not needed for the prototype.

## C. Blended monthly cost (assumed mix)

Assumed share of requests: F01 40%, F02 20%, F03 10%, F04 5%, F05 10%, F06 1%, F07 5%, F08 3%, F09 5%, F10 1%. Half of the F01, F05 and F09 requests use structured input and make no model call. F02 and F03 each make a router call (F02 plus a writer call).

| Feature | Cost per request used | Share | Weighted |
|---|---|---|---|
| F01 | 50% × (R + W) = $0.000579 | 40% | $0.000232 |
| F02 | R + W = $0.001158 | 20% | $0.000232 |
| F03 | R = $0.000775 | 10% | $0.0000775 |
| F04 | about $0.0010 | 5% | $0.00005 |
| F05 | 50% × R = $0.000388 | 10% | $0.0000388 |
| F09 | 50% × R = $0.000388 | 5% | $0.0000194 |
| F06, F07, F08, F10 | $0 (no model in the first version) | 10% | $0 |
| **Blended** | | | **about $0.00065 per request** |

| Scenario | Requests per month | Model cost per month |
|---|---|---|
| Course demo (about 50 users × 10) | 500 | about **$0.33** |
| Closed pilot (about 500 users × 10) | 5,000 | about **$3.25** |
| Early growth (about 10,000 users × 5) | 50,000 | about **$32.50** |

One-off: labelling 4,000 existing reviews in batch ≈ **$0.33**; each evaluation run of 150 items with a judge ≈ **$0.22**. Embedding cost is not checked.
**Cost per user per month:** about $0.0065 at 10 requests per user (pilot).
**Compare with today:** there is no equivalent service today; the closest is shop advice, which costs the buyer nothing but is biased. The fair comparison is the **rules-only path ($0 model cost)**: the model adds about a tenth of a US cent per request, and its value is understanding free text and writing in the user's language.
**Infrastructure** (database, hosting, automation plan) is not included because I did not check those plans.

## D. Latency model (proposal; nothing is measured yet)

| Step | p95 target |
|---|---|
| Network and entry point | 0.5 s |
| Router call (R) | 2.5 s (hard timeout 8 s, then the rules-only fallback) |
| Database tools (all, in parallel where possible) | 0.4 s |
| Reasons call (W) | 2.0 s (if exceeded, use the code-written reasons) |
| Pre-send gate | 0.2 s |
| **End to end, free-text path with reasons** | **about 5.6 s** |
| **End to end, structured path (no model)** | **under 1.2 s** |

If the router exceeds 8 seconds, the rules-only form appears with a short notice. If the writer exceeds 2 seconds, template reasons are used and the event is logged.

## E. Human capacity [A]

| Task | Time | Volume | Total |
|---|---|---|---|
| Review one owner report | 1 to 2 min | 20 per day in a pilot | 20 to 40 min per day |
| Approve one claim verdict (with evidence check) | 10 to 15 min | 30 to start | about 5 to 7.5 hours one-off |
| Audit one machine label | 0.5 min | first 100, then 5% | about 50 min for the first 100 |
| Curate one laptop's missing fields | 15 to 20 min | 14 laptops | about 4 to 5 hours |
Response-time targets: owner reports reviewed within 48 hours; a takedown request actioned within 2 working days.

## F. Responsible AI (shared)

| Area | Commitment |
|---|---|
| Fairness by language | The same gates apply in English, Hinglish, Telugu-English and Tamil-English. Proposed parity target: accuracy and gate-pass rate within 5 percentage points across languages. Wording quality gates are softer for Telugu-English and Tamil-English until a native speaker has checked them |
| Fairness by segment | Report results by user type (student, parent, performance seeker, professional) and budget band |
| Privacy | No names or contacts collected; typed text not stored except the scrubbed unhandled log (90 days); free-tier model for sample data only; DPDP notice, 18+ confirmation, deletion by receipt code (see `../ai-spec/04_FEATURE_SPECS.md`). Not legal advice |
| Transparency | Every answer states its sources, dates and counts; sample, machine-read and unverified data are labelled |
| Safety | No buy or don't-buy verdict; no claim about a seller's honesty; neutral wording |
| Abuse | Rate limits; injection treated as data; reports and verdicts need a named human |
| Independence | Commission and sponsorship never change ranking or verdicts |

## G. Launch plan template (each PRD adapts it)

| Phase | Who | Gate to enter the next phase |
|---|---|---|
| 0 Internal, sample data | Team | Hard metrics zero on the golden set; tests pass |
| 1 Class demo, course data mode | Class | Real-user sessions started; notice shown; data labelled |
| 2 Closed pilot (5 real students, then up to about 100) | Invited users | Paid model tier; rights confirmed for any quoted text; reviewers named; hard metrics zero for two weeks |
| 3 Soft public launch | Public | Quality and cost targets met in the pilot; incident process ready |

**Kill switches** (settings, flipped without a deploy): global `MODEL_ENABLED`; per-feature model switches; `RIGHTS_MODE` (course or production); `SAMPLE_NOTICE`.
**Monitoring:** gate drop rate; fallback rate; router and writer p95; unhandled and low-confidence rate; cost per day against a cap; reviewer queue age.
**Alerts (proposed):** gate drop rate above 5% in a day; fallback rate above 10%; p95 above budget for an hour; daily cost above the cap; oldest pending report above 48 hours.
**Review cadence:** weekly for the first two phases; monthly after.
**Rollback:** flip the switch, restore the previous settings version and data version.
