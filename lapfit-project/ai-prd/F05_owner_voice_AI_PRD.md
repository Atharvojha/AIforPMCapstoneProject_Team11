# AI PRD: F05 Owner voice

Extension; the data moat. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F05_owner_voice.md`. Prompts: `../ai-spec/03_SYSTEM_PROMPTS.md` (P1, P1f, P4 optional, P8 offline tagger).

## 01 Problem and user

| | |
|---|---|
| **Who** | Buyers who want to hear from owners like them: performance seekers, students, parents, professionals |
| **What breaks today** | Reviews are written in the first week, by people with unknown use, mixed with duplicates and promotional text. Buyers cannot ask "what do owners say about heat after six months?" |
| **Evidence** | Your own data audit: **median Flipkart review is 9 words, 69.6% are five-star, 710 duplicate texts**; there are **no dates, no months-owned, no usage context** on the existing reviews. That is evidence the need is real *and* that existing data cannot yet answer it. **No real-user sessions yet** |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Reading "what do gamers say about heat after 6 months" into filters; **labelling thousands of reviews** with topic, polarity and (when stated) user type and months owned |
| What stays rule-based? | Filtering, counting, the minimum-n rule, region, sorting, the "people like you" matching. Counts are SQL and re-checked by the gate |
| Cost of being wrong | **Medium**: a misleading count could sway a purchase. So quotes are shown verbatim with counts, and labels are marked machine-read until a person verifies them |

## 03 AI objective and metrics

**Objective:** *Turn typed questions into correct filters and turn raw reviews into reliably labelled opinions, so that counts and quotes shown to a buyer are traceable and correct.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Buyers who say the owner evidence changed their view | Not measured | Set in sessions |
| Business | Owner-report submissions per month (the moat grows) | 0 | Track |
| Model | Filter reading accuracy | Not measured | At least 0.90 |
| Model | Topic label accuracy (audit vs human) | **Existing reader: precision 0.88, recall 0.83 against AI-written keys** | At least 0.85 on a human-labelled sample before bulk release |
| Model | Polarity accuracy | Not measured | At least 0.85 [A] |
| Hard | A count that differs from the data; a rating without n; an unlicensed excerpt shown; a tag released without audit | — | **0** |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| Show star ratings only | Fastest | $0 | Hides problems | Rejected |
| **Prompted batch labelling + audit** | Offline | About **$0.33** for 4,000 reviews (batch) | Good, about 1 in 8 wrong on the earlier test | **Chosen** |
| Train a topic classifier | Fast | Needs about 5,000 labelled rows | Possibly better | Later |
| RAG summary of retrieved opinions | About 3 s | About $0.0006 per use | Can soften a complaint | **Optional, off by default** |
| Plain filters and verbatim quotes | Fast | $0 | Exact | **Default** |
**Choice:** filters and quotes in code; a model only to read questions and to label offline. **Trade-off:** labels may be wrong, so show the count, the quote and "machine-read".

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Existing opinions | 1,316 machine-read opinions with exact quotes from 3,987 reviews (3,300 Flipkart India, 687 Amazon US); **licence unverified, course use only** | 14 categories; **no persona, months or dates** | Audit a sample; human-verify |
| Duplicate clusters | 458 clusters already built | — | Count distinct clusters |
| Owner reports (F06) | Consented, reviewed by a person | 0 today | The way persona, months and dates start to exist |
| Region | From the source (Flipkart India; Amazon US) | Two regions | — |
| Source register | 10 sources with permission levels | — | Keep rights status per source |
**Coverage per segment:** none of the user-type or months filters can return data until new reports arrive; the product says "not enough evidence" rather than guessing.

## 06 Eval plan

| Item | Plan |
|---|---|
| Golden set | At least 40 typed questions; a labelled sample of at least 100 reviews for the tagger (two labellers on 50) |
| Mix | Persona only; topic only; months; window; combined; no matches; unknown persona; under 20 reports; laptop not in catalog; Hinglish; injection inside a review |
| Rubric | Accuracy of counts, faithfulness of quotes, honesty about limits, clarity |
| Assertions | Counts equal the data; every rating shows n; every quote appears in its source text |
| Thresholds | Section 03; tagger accuracy at least 0.85 on the human sample before release |
| Process | Freeze labels before scoring; log noise by running each prompt twice |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Fewer than 20 reports | Count | "Not enough evidence (n = 14)" and no excerpts |
| Mislabelled topic or polarity | Audit; takedown or report | Labelled "machine-read"; a reviewer can correct or remove |
| No match | Zero rows | "No owner reports match all of these filters. I have not changed any." plus the filter whose removal shows most |
| Unknown persona or topic | Closed lists | "I cannot filter by X yet, so I left it out." |
| Source rights unclear | Source register | The excerpt is not quoted |
| Model down | Timeout | The filters still work; typed questions show a notice |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| Label audit | Reviewer checks one in ten labels (first 100 at about 30 seconds each) | About 50 minutes for the first 100 [A] |
| Release | A reviewer verifies batches only if the audit agrees on at least 85% of fields | Per batch |
| Takedown | Admin removes a row on request | Within 2 working days |
| Owner reports | See F06 | — |

## 09 Responsible AI

- **Fairness:** report label accuracy by language and by source (India vs US); do not mix regions silently.
- **Privacy:** excerpts carry no identity; reviews are third-party text, so rights are checked before public quoting.
- **Transparency:** every count with n, source, region and date; "machine-read" label; verbatim quotes.
- **Safety:** a lens, not a ranking of laptops; no claim about a seller or brand beyond quoted evidence.
- **Abuse:** injection inside a review is treated as data (existing prefilter flags instruction-like text).

## 10 Cost and token economics

| Item | Cost |
|---|---|
| Label 4,000 reviews once (batch) | **$0.33** |
| Label 100,000 reviews (batch) | about $8.25 |
| Typed question | R, **$0.000775** |
| Optional summary (V2) | S, **$0.000555** per use |
Monthly typed-question cost at 10% share with half typed: about **$0.02 / $0.19 / $1.94**. Versus today: manual reading of 4,000 reviews is days of work; the model labelling is minutes and cents, **but only worth it if audited**.

## 11 Latency budget

Filter path p95 **under 1.2 s** (no model). Typed question p95 **3.5 s**. Optional summary adds about 3 s. If exceeded: router at 8 s shows the filters; summary falls back to excerpts. Labelling is offline with no budget. Not yet measured.

## 12 Launch plan and guardrails

Shared phases apply. **Gates:** rights confirmed for any quoted text before phase 2; tagger audit passed before bulk release; at least one real batch of owner reports (with persona and months) before the persona filters are shown as working. Monitors: share of laptop-topic pairs under 20 reports, takedown rate, label disagreement rate in audits. Kill switches: per-source (`rights_status`), `RIGHTS_MODE`, summary off.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Rights to quote Flipkart and Amazon review text publicly | Product owner, with the instructor or legal contact | 4 Dec 2026 |
| Which sources besides owner reports can supply persona and months? | Data lead | 27 Nov 2026 |
| Audit thresholds (0.80 confidence, 1 in 10, 85%) | Reviewer lead, after the first 100 | After first audit |
| Show polarity shares or ratings for imported opinions? (decision made: polarity shares) | Product owner confirms | 20 Nov 2026 |
| Region default (All vs India) | Product owner, sessions | 4 Dec 2026 |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
