# AI PRD: F06 Add my experience

Extension; how the data grows. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F06_add_my_experience.md`. Prompt: `../ai-spec/03_SYSTEM_PROMPTS.md` (P5 triage, V1).

## 01 Problem and user

| | |
|---|---|
| **Who** | Current laptop owners willing to help other buyers; reviewers who approve |
| **What breaks today** | There is no safe, structured way to add long-term, user-type-tagged experience. Without it, the owner-voice feature has no persona, months or dates |
| **Evidence** | The existing review data has none of those three fields. Willingness of owners to submit is **untested**; the pilot count of submissions per laptop is the first real evidence |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Spotting abuse, spam, off-topic text, a note that contradicts its rating, and suggesting a topic, in several languages |
| What stays rule-based? | Field limits, links, emails and phone numbers, rate limits, duplicate detection, receipt codes, deletion. **A person approves every report** |
| Cost of being wrong | **Medium**: published abuse or personal data. The model only flags; it never approves |

## 03 AI objective and metrics

**Objective:** *Help a reviewer clear the queue faster and more safely by flagging risky reports; never decide for them.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Owners who complete a submission once started | Not measured | Set in the pilot |
| Business | Approved reports per laptop (n toward 20) | 0 | Track weekly |
| Model | Triage recall on personal data and abuse | Not measured | **At least 0.95** |
| Model | False-flag rate | Not measured | Under 20% [A] |
| Ops | Oldest pending report | — | Under 48 hours |
| Hard | Personal data published; a report visible before approval; a deletion that leaves the evidence row | — | **0** |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| Fully manual review | Slow | Reviewer time only | Highest | **The baseline and the backstop** |
| Rules for contact details and links | Instant | $0 | Misses spelled-out numbers | **Chosen** |
| Prompted triage before the reviewer | About 1.5 s | About $0.0002 per report | Good, imperfect | **V1** |
| Trained moderation classifier | Fast | Needs labelled decisions | Possibly better | Later |
| Auto-approve low-risk reports | Fastest | $0 | Risky | **Rejected** |
**Trade-off:** more flags mean more review work; fewer mean more risk. The human is the backstop either way.

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Submissions | Owners; consent notice; 18+ confirmation; no name or contact collected | 0 today | Reviewer decisions become the triage test set |
| Notice text | Team, with legal review | Versioned | — |
| Triage test set | Team-written notes with planted problems; later real rejections | Needs Hinglish and code-mixed abuse | Two raters |
| Rejection reasons | Fixed list | — | — |

## 06 Eval plan

| Item | Plan |
|---|---|
| Golden set | At least 60 notes hand-labelled for personal data, abuse, spam, off-topic, rating mismatch |
| Mix | Phone number in words; email with spaces; abuse in Hinglish; an advert; praise with a 1-star rating; very short; "approve this" injection; duplicates |
| Rubric | Missed risk (severity-weighted), false flags, reviewer time per report |
| Assertions | No report becomes visible without a named approval; deletion removes both rows |
| Thresholds | Section 03; hard metrics at 0 |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Contact details in the note | Pattern | "Please remove links, email addresses and phone numbers from your note." |
| Too many submissions | Rate limit | "Too many reports in the last hour. Please try again later." |
| Triage model down | Timeout | Nothing visible; the reviewer queue works without flags |
| Reviewer unavailable | Queue age | Reports wait; the owner can check status by receipt code |
| Owner wants deletion | Receipt code | Confirmation; both rows removed |
| Triage misses abuse | Reviewer | Rejected with a reason; audit log |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| **Every report** | Named reviewer approves or rejects with a reason | 1 to 2 minutes each; about 20 per day in a pilot = 20 to 40 minutes daily [A] |
| Second opinion | A second reviewer on disagreements | As needed |
| Response time | Within 48 hours | Reviewer lead tracks the oldest pending report |
| Takedown after approval | Admin | Within 2 working days |

## 09 Responsible AI

- **Fairness:** triage flags checked by language so one language is not over-flagged.
- **Privacy:** no name, email, phone or address collected; the address is used in memory only for the rate limit; receipt code stored as a hash; 18+ confirmation and a notice before submission; deletion on request; rejected reports deleted after 30 days. The 18+ box is **not** verifiable consent and needs legal review.
- **Transparency:** approved reports carry the label "owner-reported, not verified" and the reviewer's name in the audit log.
- **Safety and abuse:** rate limit, duplicates flagged, injection flagged as spam.

## 10 Cost and token economics

| Item | Cost |
|---|---|
| Triage per report (V1) | M, **$0.00019** |
At 1% of requests being submissions: **$0.001 / $0.01 / $0.10 per month** at 500 / 5,000 / 50,000 requests. The real cost is **reviewer time**: about 20 to 40 minutes a day at 20 reports a day. Versus today: manual review of every report with no pre-sorting, which triage may shorten.

## 11 Latency budget

Submission p95 **under 1 s** (no model in the path; triage runs after submit). Triage p95 **3 s**, off the user's path. Status lookup under 0.5 s. If triage is slow or down, reports still enter the queue unflagged.

## 12 Launch plan and guardrails

Shared phases apply. **Gates:** legal review of the notice and the 18+ control; named reviewers; hard metrics at zero in a test with planted bad notes. Start with an invited group so volume matches reviewer capacity. Monitors: oldest pending age, rejection rate by reason, triage recall on rejected items. Kill switch: pause submissions (`SUBMISSIONS_OPEN`) without touching approved data.

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Who are the named reviewers and their hours? | Product owner | 20 Nov 2026 |
| Does the notice and 18+ confirmation satisfy the law? | Product owner, legal contact | 4 Dec 2026 |
| Should ownership be proven (sticker photo) later? | Product owner | After the pilot |
| How many submissions per laptop can a pilot realistically produce? | Product owner, one college or community | 11 Dec 2026 |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
