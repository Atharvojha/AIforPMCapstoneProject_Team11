# LapFit business case and AI PRD: Phase 8

Nov 13, 2026 · @Sri Charan Peri

## AI PRD, one page

LapFit gives an Indian laptop buyer a short list where every laptop meets what they said they must have. AI reads the request and writes the reasons; code filters, ranks and checks.

| Item | Decision |
| --- | --- |
| Problem | Buying a laptop in India means sorting hundreds of models by price, specs, colour, weight and service, and general chatbots can show a laptop that breaks a stated limit or quote an old spec or price. |
| Users | The eight personas in the Phases 1–2 doc. Real users are not yet interviewed; the five or more real sessions the course needs will confirm or change this list. |
| Why AI, not rules | Rules cannot read “light, a bit stylish, under 70k, service centre nearby” in Hinglish with typos and decide what is a Must and what is a Nice. Everything after that reading, rules do better. |
| What AI does | Door A: reads the request into Musts, Shoulds and Nices (A1), suggests a budget when none is given (A2), writes the reasons from stored facts (A3). Door B: reads the claim (B1), writes the evidence summary (B2). |
| What rules do | Filter by Musts, rank, rate, count evidence, decide verdicts, and run the pre-send gate (IDs exist, Musts hold, specs equal the catalog, every price dated). |
| What people do | Verify catalog rows, approve claim verdicts before they enter the ledger, label the golden set, review failures. |
| Not in scope | Selling, payments, order tracking, after-sales support, and any verdict the rules did not compute. |

### Objectives and metrics

Targets are my proposals. The outcome and business targets are left open until the first real sessions give a baseline.

| Objective | Metric | Target |
| --- | --- | --- |
| Never show a wrong laptop | Must violations; spec or price mismatches | 0 on the hold-out set and in live use |
| Read the person correctly | Parse accuracy on Must and budget, per language and segment | ≥95% |
| Never confirm a false claim | False-confirm rate on Door B | 0 |
| Help the person decide | Share of sessions where the person picks or saves a laptop; rubric task-fit score | Set after 5+ real sessions; rubric mean ≥4 of 5 |
| Be fast and cheap enough | p95 response time; cost per conversation | ≤8 s; ≤₹5 |
| Earn without bias | Click-outs, and share of recommendations where commission changed the order | Click-out rate set after launch; commission-changed order = 0 |

## Approach options and trade-offs

Option B is the build: a small model reads and writes, and code decides what is shown. Option C is the fallback when the model is off.

| Option | How it works | Speed | Cost | Accuracy risk | Call |
| --- | --- | --- | --- | --- | --- |
| A. One large model does everything | The model gets the request and a catalog excerpt and returns recommendations | Slowest: long prompt, long answer | Highest | It can break a Must or invent a spec, and the error is found only after the fact | Reject. This is the behaviour LapFit is tested against |
| B. Hybrid | Model reads the request into JSON; SQL filters by Musts; code ranks; model writes reasons of 40 words or fewer from stored facts; a validator checks before sending | Two short model calls; filtering takes milliseconds | Low: two small calls | The main risk is a parse error, measured per segment; a shown laptop cannot break a Must because code filtered it | **Recommended** |
| C. Rules and forms only | Dropdowns for budget, use, size and colour; no model | Fastest | Lowest | No parse risk, but it cannot read free text, other languages, claims or “nearest blue” | Fallback mode |
| D. Embedding search only | Embed the query and return the nearest laptops | Fast | Low | Nearest is not the same as meeting a Must, so “under 1 lakh, compulsory” can be broken | Only inside B, after the SQL filter (k = 8) |

### Trade-offs accepted

- **Speed for accuracy.** The validator and the pre-send gate add a step. It is code, so the cost is small and the gain is that a wrong laptop is stopped before the screen.
- **Coverage for safety.** A segment that fails its bar gets questions and suggestions instead of automatic answers, so some people get a slower path.
- **Cost for accuracy.** A larger model may parse better. That is decided by measurement on the golden set, not by assumption; the model comparison is set up under cost and token economics.

## Data, coverage and labelling

Data readiness is the weakest part of the plan: the catalog does not exist yet, and the rights to store review text are unsettled.

| Data | Source | Checked by | Refresh (proposed) | Main risk |
| --- | --- | --- | --- | --- |
| Catalog: specs, hinge type, weight, colours, variants | Manufacturer pages and store listings | A person verifies each row before it is live | Weekly, and on any model change | Wrong or stale spec |
| Prices and availability | Store listings | Code compares with the last value | Daily for shown laptops; every price carries an as-of date | Stale price shown as current |
| Evidence: review excerpts and tags | Public reviews and forums | Sampled by a person | Weekly | Data rights; reviewer type and region are inferred |
| Claim ledger | Built from evidence | A person approves each verdict | On review | A verdict approved on thin evidence |
| Golden set and failure log | Hand-labelled | Two labellers | Each release | Labeller disagreement |

### Coverage by language and segment

The corpus in the Phases 1–2 doc has 110 synthetic rows, so it shows the gaps but does not measure real users.

| Segment | Rows in corpus today | Plan |
| --- | --- | --- |
| English | Most of the 110 | Automatic once it passes its bar |
| Hinglish | 2 | Add rows first; Suggest-level until the bar is met |
| Telugu-English | 1 | Add rows with a native-speaker check; Suggest-level until then |
| Tamil-English | 1 | Same as Telugu-English |
| Image queries | 5 | Add rows; image reading is Suggest-level at launch |
| Claim checks | 10 | Door B only after a larger set and the approval step exist |

The proposed rule is 20 or more labelled rows in a segment before it can run automatically. Below that, the product asks a question or shows a short list for the person to confirm.

### Labelling

- Two people label each row independently, using the schema in the Phases 6–7 doc, and disagreements are settled and logged.
- Telugu-English and Tamil-English rows need a native speaker. I have not assumed who that is.
- Every real session adds rows. A row from a real person is marked, because only those count as customer learning for the course.

## Failure modes, fallback and human review

Every failure below has a detector and a safe fallback, so the worst case is a slower answer, never a wrong laptop.

| Failure | How it is caught | What the person sees | Owner |
| --- | --- | --- | --- |
| Budget or a Must misread | The screen repeats “I understood: under ₹75,000, 16 GB RAM” for a tap to correct; parse accuracy tracked per segment | A correction chip before the shortlist is trusted | Product |
| Model output is not valid JSON | Schema check, one retry | Rules-only form (Option C) | Engineering |
| Model slow or down | Timeout at the latency budget; error rate | Rules-only form with a short notice | Engineering |
| No laptop meets every Must | Filter returns zero rows | “Nothing matches all of these” plus which Must to relax and what it would add | Product |
| Stale price | As-of date older than the limit (limit to be set, I suggest 48 hours) | Price shown as “check current price”, never as current | Data |
| Catalog row wrong | Pre-send gate; user report; weekly sample | Row pulled, laptop hidden until re-verified | Data |
| Reason states something unsupported | Validator compares each cited fact with stored rows | A templated reason from stored facts | Engineering |
| False claim shown as supported | Verdict is computed by rules and approved by a person | Not possible without both; otherwise “not reviewed yet” | Data |
| Hidden instruction in a query or review | Text is treated as data; assertions A10; ignored\_instructions logged | Normal answer, instruction ignored | Engineering |
| Commission changes the order | Ranking code takes no commission input; audit of ranking inputs | Not applicable by design | Product |
| Upset or abusive person | Intent label EMPATHISE | Calm, short reply and a way to report a problem | Product |

### Human in the loop

Autonomy is set per segment: **Suggest** (the person confirms everything), **Assist** (shortlist shown, a question first if unsure) or **Automate** (shortlist shown directly). A segment moves up only after it meets its bar on the golden set and then on real sessions. A segment that falls below its bar moves back down.

### Reviewer capacity and response time

The numbers below are assumptions to replace with a timed sample of 20 rows.

| Task | Assumed time | Capacity formula | Target |
| --- | --- | --- | --- |
| Verify one catalog row | 10 minutes | Rows per hour = 60 ÷ minutes per row, so 6 | A launch catalog of 100 laptops is about 17 hours of work |
| Approve one claim verdict | 15 minutes | Verdicts per week = reviewer hours × 4 | A queue answer within 48 hours; until then the person sees the evidence summary marked “not yet reviewed” |
| Review one failure | 10 minutes | Reviewed per cycle = failures ÷ reviewers | Gate failures first, same day |

## Responsible AI

The trust claim is that LapFit shows only what it can back with a stored fact, and says plainly when it cannot.

| Risk | Commitment | How it is checked |
| --- | --- | --- |
| Hidden commission bias | Ranking never uses commission; affiliate links are disclosed on the screen where the link appears | Audit of ranking inputs each release; the commission-changed-order metric stays at 0 |
| False confidence | Every rating shows n, sources and dates; below the minimum sample the answer is “not enough evidence” | Assertions A4 and A7; rubric groundedness |
| Defaming a brand or reviewer | No words like fake, scam or lie; quotes of 15 words or fewer, attributed; verdicts only from the approved ledger | Judge flag; reviewer approval |
| Inferred reviewer traits (owner, gamer, region) | Shown as inferred, with confidence; never shown below a confidence bar (bar to be set) | Open question 7 in the Phases 6–7 doc |
| Unequal quality across languages | Each language segment has its own bar; a failing segment gets more questions | Per-segment parse accuracy on the golden set |
| Privacy | Store the query text and chosen laptop only as needed to improve answers; no sign-in at launch; a retention period is not yet decided | Open question below |
| Photo uploads | Used only to read the laptop or colour; not stored by default; people in photos are not analysed | Design review before image input goes live |
| Prompt injection | Query text, reviews and uploaded images are data, never instructions | Adversarial rows 99–106 |
| Source rights | Evidence is used only where terms allow it; this plan did not mine Reddit, LinkedIn or Amazon reviews | Rights review before the evidence table is filled |

## Cost and token economics

Model cost is small: about ₹0.2 to ₹3 per conversation on the paid tier, against a proposed ceiling of ₹5. What decides whether LapFit pays for itself is how many conversations end in a purchase, not tokens.

```latex
\text{cost per conversation} = \text{turns} \times \sum_{\text{calls}} \frac{\text{input tokens} \times P_{in} + \text{output tokens} \times P_{out}}{10^6}
```

### Assumptions (mine, to replace with logged numbers)

| Call | Input tokens | Output tokens | How often |
| --- | --- | --- | --- |
| A1 parser | 1,500 | 250 | Every turn |
| A3 reason writer | 2,000 | 350 | Every turn |
| A2 number suggester | 800 | 100 | 30% of turns |

A conversation is 3 turns, which gives about 11,200 input and 1,900 output tokens. The exchange rate is ₹90 to the dollar; I did not check today's rate. Door B adds roughly the same again per claim and is not included.

### Cost per conversation by model

Prices are the paid-tier list prices per million tokens from [Google's Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing), which shows no effective date. The free tier lists no charge, but its rate limits are on a separate page and I have not read them, nor the data terms, which matter before real user text is sent.

| Model | Input / output (USD per 1M) | Cost per conversation (₹) | One 45-row eval run with judge (₹) |
| --- | --- | --- | --- |
| Gemini 2.5 Flash-Lite | 0.10 / 0.40 | 0.17 | 4 |
| Gemini 3.1 Flash-Lite | 0.25 / 1.50 | 0.51 | 13 |
| Gemini 3 Flash Preview | 0.50 / 3.00 | 1.02 | 25 |
| Gemini 3.5 Flash | 1.50 / 9.00 | 3.05 | 76 |

The eval run assumes one parse, one write and one judge call per row (3,000 input, 400 output for the judge). The batch API is listed at half price, which suits overnight eval runs. Lower costs are available through caching of the long system prompts, which I have not modelled.

The measured part is still open: run each candidate on the golden set and record parse accuracy, p95 and cost, then pick the cheapest model that passes the bar. These figures show that even the dearest candidate stays under the ₹5 ceiling, so the choice should be made on accuracy.

### Does a conversation earn more than it costs?

Revenue per purchase is price × commission. Commission for laptops in India is not confirmed: one secondary guide lists electronics at 1–3% with a 24-hour cookie ([FluxNote](https://fluxnote.io/guides/amazon-india-affiliate-commission-rates-2026)) and itself says to check Amazon's own schedule, so treat it as approximate.

Break-even conversion = cost per conversation ÷ (price × commission).

| Laptop price | Commission | Revenue per purchase (₹) | Break-even at ₹1 cost | Break-even at ₹5 cost |
| --- | --- | --- | --- | --- |
| ₹50,000 | 1% | 500 | 0.20% | 1.0% |
| ₹65,000 | 1% | 650 | 0.15% | 0.77% |
| ₹65,000 | 3% | 1,950 | 0.05% | 0.26% |
| ₹80,000 | 3% | 2,400 | 0.04% | 0.21% |

In plain terms, at about ₹1 per conversation, roughly 1 conversation in 650 has to end in a tracked purchase at 1% commission on a ₹65,000 laptop. Fixed costs (hosting, catalog verification time, a person approving claims) are not in this table and may matter more than tokens.

## Latency budget

The target is a shortlist on screen within 8 seconds at p95, split across four steps. The split is a proposal; no step has been timed yet.

| Step | Budget (s) | What happens | If it runs over |
| --- | --- | --- | --- |
| Parse | 2.5 | Model call A1 returns the JSON | One retry only if time remains; otherwise the rules-only form |
| Filter and rank | 0.5 | SQL filter by Musts, embedding match on the filtered rows (k = 8), code ranking | Skip the embedding step and rank by rules |
| Write | 4.0 | Model call A3 writes the reasons | Show the cards with templated reasons from stored facts |
| Check and draw | 1.0 | Pre-send gate, validator, screen render | Never skipped: the gate runs even if the answer is late |
| **Total** | **8.0** |  |  |

Three ways to stay inside it: show the cards as soon as the filter returns and stream the reasons in under them; keep prompts short and cache the long system text; and write the reasons for all cards in one call instead of one call per card.

Measurement plan: log the time of every step on every run, report p50 and p95 per step each release, and treat a step over budget in two runs in a row as a failure to log, the same as a wrong answer.

## Revenue streams

Affiliate commission is the only stream that can start without a partner. The rest each need something to be true first, and none has evidence behind it yet. One rule holds for all of them: money never enters ranking, verdicts or the claim ledger.

| Stream | Who pays | What must be true | Risk to trust | When |
| --- | --- | --- | --- | --- |
| Affiliate links to stores | Retailers pay a commission on tracked purchases | Programme approval; enough click-outs; the commission rate for laptops (not confirmed) | Low if disclosed and ranking ignores it | Launch |
| Accessories and upgrades (bag, mouse, RAM or SSD) | Retailers, by affiliate | People buy add-ons after choosing | Low | After launch |
| Protection plans and service referrals | Warranty or service providers, per lead | A partner exists; the service-centre data (group 8 of the corpus) is verified | Medium: a paid referral must be labelled | Later |
| Bulk buying advice for colleges and small teams | The institution or team, per order or per project | Buyers with 10 or more laptops need a verified shortlist; to test in interviews | Low | Later |
| Verified-shortlist widget for other sites | Review sites, creators or retailers, per call or monthly | Traffic and a catalog large enough to be useful elsewhere | Medium: the partner may want to influence results | Later |
| Anonymised buyer-need and claim-check reports | Brands, as a subscription or one-off report | Enough sessions to be representative; consent and a retention rule; a firewall so the brand cannot buy a verdict | High: a brand paying for reports about itself | Only after the above |
| Premium tools for heavy buyers (price alerts, saved comparisons) | The buyer | A group that returns often; unproven willingness to pay | Low | Test only |

What I would not do: sponsored placements inside the shortlist, paid claim verdicts, or any fee that depends on which laptop is chosen. Each would break the one thing LapFit sells, which is that the shortlist is not for sale.

Sizing for the affiliate stream is in the Phases 1–2 doc (base case about ₹1.23 crore a year, resting on assumptions apart from the 7.3 million IDC figure). The other streams are not sized, because I have no basis for their numbers.

## USP and why a general assistant does not replace it

The claim: LapFit is the laptop shortlist where a wrong laptop is blocked by code, and every rating shows how many reports it rests on. A general assistant can give a good shortlist, but it has no way to guarantee one.

This comparison describes design, not measured results. I have not run the same queries through any other tool yet; the competitor benchmark in the Phases 6–7 doc does that, and if it shows no gap, this positioning changes.

| What the buyer needs | A general assistant (ChatGPT, Claude) | LapFit | Why it is hard to copy |
| --- | --- | --- | --- |
| Every laptop meets every Must | Follows the instruction when it can; no check stands between the answer and the screen | Code filters by the catalog, so a laptop that breaks a Must cannot be shown | Needs a verified catalog with hard fields such as hinge type, which takes work, not a better prompt |
| Specs and variants match the store | Depends on what it finds or recalls at that moment | Specs come only from verified rows; every price has an as-of date | The same catalog and refresh process |
| “Is this claim true?” | Answers in fluent prose, usually without a count | Verdict from rules over counted evidence, approved by a person, with n and dates | A ledger built over months, and a reviewer |
| “People like me” | Cannot slice evidence by owner, gamer, region or last 30 days unless it holds the tagged data | Lens ratings (gamers, owners of 6+ months, India or US, last 30 days) with n shown | Tagged evidence collected over time, the Zomato-within-1-km idea applied to laptops |
| India detail | Variable | India variants, colours (with nearest-colour fallback), service centres, Hinglish and regional mixes | Local data and a language-specific test set |
| Same answer twice | Can differ between runs | Same needs give the same shortlist, tested as stability under paraphrase | Deterministic ranking in code |
| Why trust it | Nothing to inspect | Published ship gate, failure log and benchmark results | Credibility built from results over time |

### What a careful user can do instead

A careful buyer can paste a prompt that lists the Musts and asks the assistant to check each spec on the store page. That works for one laptop at a time and costs the buyer the checking work LapFit does in advance. For a simple query it may be enough, so the product should win on the hard cases: strict budgets, hinge or colour constraints, claims, and India variants.

### What copies easily and what does not

1. **Easy, within weeks:** the chat screen, the prompts, the tone.
2. **Harder, months:** the verified catalog, the tagged evidence and the claim ledger.
3. **Hardest:** the labelled golden set, the failure history and real-session data. These are what make the next release better than the last.

## Capstone PRD updates and demo

The five capstone updates are drafted across these documents. The PRD due date and submit format were blank on your slides, so I have not shaped the final PRD for a format.

| Capstone update | Where it is drafted | Still needed from you |
| --- | --- | --- |
| 1. Decision rationale | Job sentence, decision tree and scorecard (Phases 3–5 doc); “why AI, not rules” and approach options (this doc) | The V, F, D, R anchors; confirm the scores |
| 2. Model decision record | Large against small model (Phases 3–5 doc); candidates and cost per conversation (this doc) | Measured parse accuracy, p95 and cost for each candidate |
| 3. Autonomy map | Eight scenarios and blockers (Phases 3–5 doc); Suggest, Assist, Automate by segment and failure table (this doc) | Confirm which scenarios stay at Suggest |
| 4. Go/no-go criteria per segment | Bars and playbook (Phases 3–5 doc); ship gate (Phases 6–7 doc); coverage table (this doc) | Confirm the thresholds; add labelled rows for thin segments |
| 5. Staged rollout with gates and rollback | Stages 0–3, about 100 beta users, switches, rules-only mode (Phases 3–5 doc) | Named owner for each switch |

The other course items sit in the Phases 6–7 doc: golden dataset, human rubric, assertions, two benchmarks and the iteration log of three or more cycles. The five or more real-user sessions need you to run them; synthetic personas do not count.

### Suggested 10-minute demo

The course asks for a final demo and a 10-minute presentation. This run-of-show is my suggestion.

| Minutes | Show | Why |
| --- | --- | --- |
| 1 | The buying problem and who feels it | Problem and PRD weight |
| 2 | Live Door A with a hard case: convertible under budget, no MacBook | Shows the claim in action |
| 1 | A wrong laptop blocked by the gate, with the assertion that caught it | Shows code, not a prompt, is in charge |
| 2 | Golden-set results by segment and the ship gate | Eval rigour carries the most weight |
| 2 | Iteration log: three cycles, what failed, what changed, the delta | Iteration weight |
| 1 | Competitor benchmark result, whichever way it came out | Honest comparison |
| 1 | Cost per conversation, break-even, next step | Economics |

## Open questions

1. **PRD due date and format.** Both were blank on your slides. Until they are known, the one-page PRD and the full version stay in this shape.
2. **Commission rates.** The 1–3% for laptops comes from a secondary guide. Which affiliate programmes will you apply to, and what do their own schedules say?
3. **Exchange rate and token counts.** I assumed ₹90 to the dollar and the token counts in the cost table. Replace them with logged numbers from the first runs.
4. **Free-tier terms.** Before real user text goes to a free-tier model, check its rate limits and what the provider does with prompts.
5. **Model candidates.** Do you want all four models in the comparison, or only the two cheapest plus one stronger model?
6. **Reviewer time.** The 10 and 15 minutes per row and verdict are guesses. Time 20 rows and update the capacity table.
7. **Retention and privacy.** How long query text is kept, and whether it is kept at all, is not decided.
8. **Revenue order.** Is affiliate-only enough for the course story, or should the PRD name one second stream to test?
9. **Scope.** Door A only or both doors? The master document for Claude Code is shaped by this answer.
