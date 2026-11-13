# AI PRD: F02 Second opinion + check the pitch

Core feature, the product's strongest differentiator. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F02_second_opinion_and_pitch_check.md`. Prompts: `../ai-spec/03_SYSTEM_PROMPTS.md` (P1, P1b, P1c, P2; P3 photo reader and P4 summariser designed).

## 01 Problem and user

| | |
|---|---|
| **Who** | Any buyer looking at one specific laptop; most acutely a first-time buyer or a parent in a shop with a salesperson making claims |
| **What breaks today** | The salesperson, the listing and the video all have an angle. The buyer cannot tell whether the laptop fits their needs, or whether "32 GB RAM" and "battery lasts a full day" are true |
| **Evidence** | Desk research and the existing review data, where **owners' topic opinions exist for 29 laptops**; **no real-user sessions yet**. The central hypothesis is that buyers will check a claim while in a shop; this must be tested with at least five real students (to-do 3.11, 9.1) |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Splitting a pasted pitch into separate claims and typing them (spec, performance, price, service, comparative, absolute, opinion), in several languages; spotting which laptop is meant |
| What stays rule-based? | Comparing a spec claim with the catalog; ticks and crosses; owner counts; **every verdict**, which comes only from a person-approved ledger row |
| Cost of being wrong | **High**: a wrong "matches the catalog" or an invented verdict can cause a bad purchase, or an unfair judgement of a seller. So no verdict is ever model-written |

## 03 AI objective and metrics

**Objective:** *Read a pitch into separate, correctly typed claims and the right laptop, so that code can verify each claim against stored facts and show a verdict only when a named person approved it.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Buyers who say the check changed or confirmed a decision | Not measured | Set in sessions |
| User | Time from pasting to a result | Not measured | Under 6 s p95 |
| Business | Result items clicked after a check | Not measured | Set after pilot |
| Model | Claim split: recall / precision | Not measured | **At least 0.85 / 0.90** |
| Model | Claim type accuracy | Not measured | At least 0.90 |
| Model | Laptop match accuracy (in-catalog) | Not measured | At least 0.95 |
| Hard | Spec verdict wrong; verdict shown without approver; invented spec or price | — | **0** |
| Hard | Wording that accuses a seller ("lying") | — | **0** |
| USP test | Wrong or overconfident answers vs a general chat assistant on 10 real pitches with planted errors | Not run | LapFit clearly fewer |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| Ask a general assistant to judge the pitch | Fast | Low | Fluent but can invent specs; no audit trail | The thing we must beat |
| Rules only | Fastest | Lowest | Misses phrasing; cannot split a run-on pitch | Used for spec comparison |
| **Prompted reader + code verification + approved ledger** | About 2.5 s + code | About $0.0012 | Reading good; facts exact; verdicts human-approved | **Chosen** |
| RAG to generate a verdict from reviews | Slower | Higher | Could sound right and be wrong | **Rejected** for verdicts; evidence shown verbatim |
| Embedding match of a claim to ledger entries | Fast | Small | Better than keywords at volume | Later, with a measured false-match rate |
| Fine-tuned claim splitter | Fast | Needs labelled data | Possibly better | Later |
**Trade-off:** many claims will read "Not checked yet" because few have an approved verdict. That is honest, and approvals grow the coverage.

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Specs with provenance | Existing database: 173 facts, mostly machine-validated; 13 need a human spot check | 14 India laptops fully; 15 evidence-only | Verify the 13 flagged; add hinge, warranty, year |
| Owner opinions | 1,316 machine-read opinions with exact quotes; **licence unverified, course use only; unverified labels** | 14 categories; small counts per laptop and topic | Audit a sample; mark verified by hand |
| Benchmarks | 12 curated rows, facts and links only | A few laptops | Spot-check 9 flagged rows |
| **Claim ledger** | **Does not exist; to be written by named reviewers** | 0 today | Start with the 5 to 10 most common seller claims; 10 to 15 minutes each |
| Pitch test set | Written by the team; later real pitches | Needs all four language mixes | Two raters |

## 06 Eval plan

| Item | Plan |
|---|---|
| Golden set | At least 100 pitches; 30 to 50 hand-labelled with laptop, claims, correct type and status per claim, and why |
| Mix | True claim; contradicted spec; unit confusion (1 TB vs 1000 GB); two laptops in one message; laptop not in catalog; two versions; claim about a different laptop; opinions; absolute and comparative claims; approved and unapproved ledger claims; Hinglish, Telugu-English, Tamil-English; blurry photo (V1); injection |
| Rubric | Accuracy, honesty about what is unchecked, clarity, usefulness in a shop |
| Assertions | No verdict without approver; no accusatory wording; reply language correct |
| Thresholds | As in section 03; hard metrics at 0 |
| Held-out | One set written from real pitches that no one tunes against, to avoid the "fixes tuned to the test" effect seen in the earlier claim-checker runs |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Laptop not in catalog | Match fails | "That laptop is not in the catalog, so I will not guess its specs or price." |
| Several versions | More than one match | One question with tappable versions |
| Claim cannot be matched to a field | Parser returns none | "Not in catalog" for that claim |
| No approved verdict | Ledger lookup empty | "Not checked yet" with the owner count; no verdict |
| Photo unreadable (V1) | Reader flags it | Names exactly what could not be read; asks for the model name |
| Model down or slow | Timeout | The structured fallback: pick the laptop and type claims; same checks |
| Injection in the pitch | Pattern and flag | A notice; no verdict changes |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| **Verdicts** | A named reviewer approves each ledger entry with evidence | 10 to 15 min each; about 30 entries is 5 to 7.5 hours one-off [A] |
| Retiring a verdict | Reviewer or admin | As needed |
| Failure review | Team turns real failures into test rows | About 1 hour per week [A] |
| Disputes | A seller or brand disputes a verdict: reviewer re-checks | Within 2 working days |

## 09 Responsible AI

- **Fairness:** claim reading accuracy by language; parity within 5 points; the same ledger rules for every brand.
- **Privacy:** pitch text is not stored; photos (V1) only on the paid tier with consent and short retention.
- **Transparency:** each verdict shows approver, date and number of reports; "not checked yet" is never rendered as true or false.
- **Safety:** wording is "does not match the specs", never "lying"; no buy or don't-buy verdict.
- **Abuse:** injection treated as data; rate limit; brands cannot influence verdicts.

## 10 Cost and token economics

| Path | Calls | Cost per request |
|---|---|---|
| Text pitch | R + W | **$0.00116** |
| With a photo (V1) | P + R + W | $0.00194 |
Monthly at a 20% share of 500 / 5,000 / 50,000 requests: about **$0.12 / $1.16 / $11.60**. Cost per user (10 requests, 2 on F02) about $0.0023. Versus today: no equivalent service; shop advice is free and biased.

## 11 Latency budget

p95 target **5.6 s** (network 0.5, router 2.5, tools 0.4, reasons 2.0, gate 0.2); photo path adds about 2 s. If exceeded: router over 8 s uses the fallback; writer over 2 s uses code reasons. Not yet measured.

## 12 Launch plan and guardrails

Shared phases and kill switches apply. **Specific gates:** at least 10 approved ledger entries before phase 1; named reviewers before phase 2; the USP test run and logged before any claim that LapFit is better than a chat assistant. Monitors: share of claims ending in "not checked yet", spec-verdict disagreements found by reviewers, disputes raised, gate drop rate. Photos stay off until the paid tier and consent are in place.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Who are the named reviewers (two team members plus one outsider)? | Product owner | 20 Nov 2026 |
| Which 10 seller claims are most common in India (for the first ledger)? | Product owner, from student interviews | 27 Nov 2026 |
| Do buyers use this in a shop? | Product owner, field test with 5 students | 4 Dec 2026 |
| How should a seller's wrong claim be worded in Hinglish, Telugu-English and Tamil-English? | Native speakers | 4 Dec 2026 |
| Embedding match for ledger lookup: false-match rate | Engineering lead | After the first scored run |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
