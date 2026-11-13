# LapFit product and data spec: Phases 3–5

Nov 13, 2026 · @Sri Charan Peri

AI reads the person's words and writes the explanation; rules do all filtering, ranking and rating, so a wrong laptop cannot reach the screen. This spec covers the decision tree, flow, guardrails, output, autonomy map, model choice and data layer for Door A (the course scope), with Door B noted where it differs.

## Decision tree and scorecard (Exercise 1)

**The job, in one sentence:** when someone in India is about to spend a large sum on a laptop, they want a short list that is verified to fit their budget and must-haves, with honest reasons, so they do not regret it.

The job splits into five sub-tasks. Only two are AI work; the rest are rules, because a wrong laptop on screen is the failure we cannot afford.

| Sub-task | Decision | Tree path |
| --- | --- | --- |
| 1. Understand the person's words (any language, any detail level) | AI | Input is open-ended and code-mixed; rules cannot cover it. A wrong output is caught by the echo step and by the rules downstream |
| 2. Filter and rank laptops against Must, Should, Nice | Rules | Fixed logic over verified fields; must be exact and repeatable; no judgement needed |
| 3. Rate each laptop per category | Rules | Ratings must reproduce from a formula over evidence counts |
| 4. Write the reasons, trade-offs and “what changed” notes | AI, limited to stored evidence | Needs natural language, but may only restate catalog and evidence fields |
| 5. Verify catalog specs and approve claim verdicts before they are published | Human | Source of truth and reputation risk; AI can draft, a person signs off |

**Scorecard for the two AI sub-tasks.** I assumed V = value, F = feasibility, D = data readiness and R = risk, scored so 5 is best (lowest risk), because your slides showed the formula but not the definitions or the 1/3/5 anchors. Treat every score as provisional until the real anchors are applied.

| AI sub-task | V | F | D | R | V × F × D × R |
| --- | --- | --- | --- | --- | --- |
| 1. Understand the person's words | 5 | 5 | 3 | 3 | 225 |
| 4. Write reasons from stored evidence | 5 | 3 | 1 | 3 | 45 |

**Weakest dimension: D, data readiness, on sub-task 4.** The catalog and the evidence table do not exist yet, and the writer may say nothing the evidence does not contain. To raise it: build and verify the catalog for one price band first, tag a few hundred evidence excerpts by hand, and have the writer quote or paraphrase only from those rows.

**60-second pitch (template filled).** For a student buying a laptop, understanding their words should use AI because the input is free-text and code-mixed, while ranking should use rules because a wrong laptop must never appear. Score: V5 × F5 × D3 × R3 = 225. Biggest risk: misreading a hard constraint such as the budget. We will de-risk it by showing “what I understood” for the person to correct, and by measuring field-level parsing accuracy on the golden set.

## Happy-path flow (Door A)

The flow has eleven steps. Only steps 2, 4 and 8 use a model; everything that decides which laptop appears is rules. This is a table because the flow runs in a straight line with fallbacks; a drawn version can follow if you want one.

| # | Step | Done by | Fallback |
| --- | --- | --- | --- |
| 1 | Person submits text (photo or voice in later stages) from the app | Rules | Empty or unreadable input: ask again |
| 2 | Read the words into structured needs: budget with tolerance, use, Must, Should, Nice, attributes | AI | Low confidence: ask at most two questions, then go on with stated assumptions |
| 3 | Show “What I understood” with editable chips | Rules | Person edits a chip; steps 4–10 re-run |
| 4 | If no specs were given, turn the need into suggested numbers with a reason each, from a human-maintained table of use-case ranges | AI over a lookup table | No budget: ask for it first |
| 5 | Filter by every Must against verified catalog fields | Rules | Nothing left: NO-MATCH, showing the closest and the constraint it breaks |
| 6 | Rank by Should, then Nice; relax Nice in a fixed order (colour, then finish, then style) | Rules | Every relaxation is recorded for step 8 |
| 7 | Rate each category from evidence counts and a formula | Rules | Too little evidence: show “not enough evidence (n = …)”, no score |
| 8 | Write the reasons, trade-offs and “what changed” notes from stored rows only | AI, validated | A validator checks every name and number against the row; on failure, show template text built from the fields |
| 9 | Pre-send gate: IDs exist, Musts hold, specs equal the catalog, every price has an as-of date | Rules | A laptop that fails is dropped; if all fail, NO-MATCH |
| 10 | Show the result screen with drill-downs: one laptop in detail, compare two to four, check a claim | Rules | Over four compared: ask which four |
| 11 | Log the query, result, edits and clicks for evals and the data moat | Rules | Logging failure never blocks the answer |

**Five-part anatomy for Door A** (the full spec comes in Phase 6)

- **Trigger:** app form submit.
- **Orchestration:** one small server function running steps 2–9 in order.
- **Model:** called at steps 2, 4 and 8 only.
- **Knowledge:** the verified catalog, evidence rows, price history and the use-case range table.
- **Evals loop:** the golden set, rubric, LLM judge and ship gate from Phase 7.

## Guardrails for bad input and risky output

Every guardrail costs something. The trade-off column says what we give up, and the last column says what is still exposed.

| Risk | Guardrail | Trade-off | Still exposed |
| --- | --- | --- | --- |
| Unknown or fake model (query 99) | Resolve every name against the catalog; if not found, say so and offer the closest real models | A brand-new launch may be wrongly “not found” | Catalog lag |
| Instructions hidden in the query (100, 101) | User text is data; model output must fit a fixed schema; ranking is code | Odd requests about format are ignored | New attack styles |
| Impossible or conflicting constraints (91–93) | NO-MATCH with the closest option and the constraint it breaks | Fewer results; may feel unhelpful | People relax the wrong constraint |
| Missing information (94–97) | Ask at most two questions, then go on with stated assumptions | One extra step | A wrong assumption, caught by the “What I understood” card |
| Marketing language or unsupported claims in the explanation | The writer may only restate stored rows; a validator removes anything else | Plainer copy | Gaps in the evidence |
| Over-broad claims (Door B, 64, 68) | The verdict covers exactly what was named; abstain below a minimum sample; calling a false claim true is weighted worst | More “not enough evidence” answers | Noise in small samples |
| Stale price or stock (45–48) | An as-of date on every price; hide prices older than a set age | Fewer prices visible | Price changed minutes ago |
| Ranking bent by commission (104) | The ranking code has no commission input; the affiliate link is disclosed; audited | Possible lower click revenue | How it looks to users |
| Photo misidentified (78–82) | The model's reading is a candidate only; confirm against the catalog and with the person | One extra tap | Look-alike variants |
| Requests for fake reviews or false ad claims (103, 106) | Decline in one line | Blocks rare legitimate uses | None material |
| Personal money advice (30) | Give the factual price conversion; do not advise whether to take a loan | Less help on EMI questions | People still ask |
| Pincode and photos | Use the pincode only for the lookup; store the city, not the pincode, unless the person opts in; do not keep photos by default | Weaker personalisation | Retention policy still to be decided |
| Language not understood (87, 88) | Reply in English, confirm the parse, flag the row for review | Slower for those users | A weaker experience for that segment |

## Output design

The result screen answers “which laptops, and why should I believe it” in one scroll, with the evidence one tap away.

**Tone.** Plain and specific, like a knowledgeable friend who shows their evidence. Short sentences, no hype words such as “best” or “perfect” without evidence behind them, and “I'm not sure” with the sample size when the data is thin. Reply in the language the person wrote in, including Hinglish. Reasons run at most 40 words per laptop, matching the conciseness criterion in your rubric example.

**Result screen, top to bottom**

1. **What I understood:** editable chips coloured by Must, Should and Nice; any assumption is flagged.
2. **Suggested numbers** (only when the person gave no specs): RAM, processor tier and storage as adjustable colour scales, each with a one-line reason.
3. **Ranked laptops:** up to three main picks, then “also consider”. Each card shows what is in the next list.
4. **What changed:** every relaxed Nice constraint, stated (for example “no midnight blue; nearest is …”).
5. **Next actions:** see evidence, compare two to four, check a claim.
6. **Footer:** affiliate disclosure and the data as-of date.

**On each laptop card**

- Photo and colour swatches, each marked available or not.
- Price with as-of date.
- RAM, storage, processor, display, weight, ports, hinge type (convertible or not), warranty.
- Five category ratings with evidence-strength dots: battery, performance, heat, portability, keyboard and build. A sixth, service reach, appears when a pincode or city is given.
- Claimed battery hours beside owner-reported hours, with the number of reports.
- “Why it fits you” (two lines) and “Watch out for” (one line, with its source).

**Ways to show the data that a general chat assistant does not**

- A “people like you” switch on every rating: students, gamers, owners after six months, India vs US, last 30 days. The sample size always shows, and the reviewer type is labelled as inferred with a confidence. Below the minimum sample the view says so instead of showing a number.
- A claimed-versus-real battery bar.
- A brand × problem heatmap for Door B, shaded by complaint rate with the evidence strength shown as opacity.
- Photos from manufacturer press pages with their licence checked; colour swatches from catalog data.

**Parameters we do not show:** any rating without a formula and a sample behind it, and any price without a date.

## Autonomy map: the cost of being wrong

Four of the eight scenarios block launch. Severity is raised where the buyer cannot undo the purchase, because return rules vary by seller. Frequencies are my estimates until the golden-set runs measure them.

| # | Failure scenario | Severity | Frequency | Autonomy | Human in the loop (who, when) | Launch blocker? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A laptop that breaks a Must appears (a non-convertible for a convertible query) | High | Occasional | Automate the gate in code; no model decides | Eval owner reviews every gate failure; any live hit is looked at the same day | Yes |
| 2 | A shown spec or variant price differs from the catalog | High | Occasional | Assist: the gate blocks mismatches and queues the row | Catalog owner, within two days | Yes |
| 3 | A false claim is confirmed as true (Door B) | High | Occasional | Suggest: the model drafts; a person approves before any verdict is published | Reviewer, before publishing | Yes, for Door B |
| 4 | A budget or Must is misread from the person's words | Medium | Occasional | Assist: “What I understood” echoes it and the person confirms | None live; eval owner samples weekly | No, but parse accuracy is in the ship gate |
| 5 | A stale price is shown | Medium | Frequent | Automate: hide beyond a maximum age and show the as-of date | Alert to the catalog owner when a feed goes stale | No |
| 6 | A wrong service-centre claim for a pincode | Medium | Occasional | Suggest: show only verified data, otherwise “cannot confirm” | Ops owner verifies a city before it is switched on | No |
| 7 | Hinglish or regional input is misread | Medium | Frequent | Assist: confirm the parse, fall back to English | Language reviewer samples weekly; a native speaker labels the golden rows | Per-segment gate (see the go/no-go bar) |
| 8 | Ranking is bent by commission | High | Rare | Automate: the ranking code has no commission input | Quarterly audit by someone outside the build | Yes |

## Model decision record (Exercise 2)

Proposed: use the larger, more accurate model (A) for reading the person's words, and the smaller model (B) with a validator for writing reasons, until measured results say otherwise. Every number below is a proposal to agree, not a result.

**Context.** A model is called at three steps: understand the words (2), suggest numbers (4), write the reasons (8). Option A is large, more accurate, slower and costlier. Option B is small, fast, cheap and weaker on code-mixed speech.

**Option sheet (to be filled from a run on the golden set; nothing here is measured yet)**

| Option | Parse accuracy, Must and budget fields | p95 latency | Cost per conversation |
| --- | --- | --- | --- |
| A: large | to measure | to measure | to measure |
| B: small | to measure | to measure | to measure |

**Role positions** (assumed roles, since I did not see the role cards)

| Role | Must-have | Can flex |
| --- | --- | --- |
| Engineering | p95 latency inside the budget below | Model size, if routing keeps latency in budget |
| Product | Must and budget fields read correctly in every language segment, including code-mixed | Polish of the explanation text |
| Data and eval | Every output can be checked by the validator and reproduced in a run | How often the judge runs |
| Finance | Cost per conversation inside the ceiling below | Model quality on steps that rules already protect |

**Proposed thresholds**

- **Eval threshold:** Must and budget fields parsed correctly on at least 95% of golden rows in each language segment. The remaining cases are caught by the echo card and the rules gate.
- **Cost ceiling:** ₹5 per conversation. The base-case revenue per user in the sizing doc is about ₹165 (15% of users buy at ₹1,100 each), so one conversation at this ceiling uses about 3% of it.
- **Latency budget, p95 end to end:** 8 seconds, split as 2.5 for reading the words, 0.5 for rules, 4 for writing the reasons and 1 for overhead. If exceeded, show the ranked list first and stream the reasons after it.

**Fallback.** A model call that fails or times out returns rules-only results with template reasons and a one-line notice. Low parse confidence triggers a question, not a guess.

**Revisit when:** B meets the threshold in every segment; cost per conversation exceeds the ceiling; p95 is over budget for two weeks; a new model is released; or a segment fails the go/no-go bar.

## Data layer

Ten tables. Only rows marked verified can reach a result, because the pre-send gate (step 9) reads nothing else. A field becomes verified when someone has checked it against the manufacturer's page.

| Table | Key fields | Source | Rights or quality risk |
| --- | --- | --- | --- |
| Laptop model | brand, line, year, processor, GPU, display size and panel, weight, ports, RAM slots or soldered, hinge type (clamshell, 360°, detachable), pen support, warranty | Manufacturer spec pages, cross-checked | Specs are facts, but images and descriptive text carry licences |
| Variant | model, RAM and storage, colour names, India price, availability | Manufacturer and retailers | Mixing variants is a named failure, so every variant has its own ID |
| Price history | variant, seller, price, timestamp | Feeds or APIs whose terms allow it | Scraping may breach a site's terms; every price shows its as-of date |
| Evidence excerpt | laptop, category tag (battery, heat, hinge, keyboard, service), short quote or paraphrase, source link, date, reviewer type and region (both inferred, with confidence), ownership time | Public reviews and posts, used within their terms, plus owner submissions | Copyright: keep quotes short and link to the source; inferred tags need a confidence |
| Owner report | laptop, months owned, issues, optional photos | Users | Consent, moderation and photo privacy |
| Service centre | brand, city, pincode coverage, carry-in or onsite, last verified | Brand sites and owner reports | Goes stale; needs a re-verification date |
| Rating | laptop, category, score, formula version, sample size | Computed | Must reproduce from the formula |
| Claim ledger | claim text, scope (brand, line, model, spec group), verdict, sample size, evidence IDs, approver, date | Ours | Reputation risk, so a person approves each verdict |
| Use-case range table | use → RAM, processor tier, storage ranges, with a reason | Maintained by hand | Drifts as hardware changes; review each quarter |
| Query log | query, language, parsed needs, results, edits, clicks, feedback | Ours | Privacy; retention to be decided |

**What compounds into the moat, in order:** price history (it grows daily), evidence tagged by reviewer type, owner reports after six months, the claim ledger, service-centre reports, and the query log of what Indian buyers actually ask.

## Failing-segment playbook and go/no-go bar (Exercise 4)

No segment has failed yet. This is the decision written in advance, so it is made against a bar and not under pressure. Every number is a proposal.

**Go/no-go bar per segment.** A segment launches only when its own rows pass; one strong average cannot cover a weak segment. The corpus is too small to judge most segments today.

| Segment | Labelled rows in the corpus today | Rows needed (proposed) | Bar to launch |
| --- | --- | --- | --- |
| English text | most of the 110 | 20 or more | Must and budget fields at least 95% correct; zero Must violations shown |
| Hinglish | 2 (83, 84) | 20 or more | Same |
| Telugu-English | 1 (87) | 20 or more | Same |
| Tamil-English | 1 (88) | 20 or more | Same |
| Image input | 5 (78–82) | 20 or more | Every photo confirmed with the person before use; zero laptops used unconfirmed |
| Door B claims | 10 (60–69) | 20 or more | Zero false confirmations; abstains on every below-minimum sample |

**If a segment fails, in this order**

1. **Diagnose what is different about that segment:** too few labelled examples, wrong labels, script (Latin-letter Telugu or Tamil vs native script), how the languages are mixed, or a gap in the use-case table. Speech is out of scope until voice input exists.
2. **Choose one of four:**
   - **Roll back** that segment immediately if any Must violation reached a person: turn the segment off and fall back to English with a confirm step.
   - **Restrict** if accuracy is below the bar but nothing wrong was shown: keep it live in confirm-first mode.
   - **Iterate** with more labelled examples; the course expects at least three logged cycles.
   - **Kill** the segment for this release if three cycles do not close the gap.
3. **Name the owner and the date** for the decision. Owner: eval owner (name to be set). Date: set when the failure is found.
4. **Send the five-line message** below.

**Stakeholder message (template, filled for a Telugu-English failure)**

- **What happened:** Telugu-English queries were misread on \[X\]% of test cases against a 95% bar.
- **Who is affected:** people typing in Telugu-English. English and Hinglish are unaffected.
- **What we are doing now:** that segment is in confirm-first mode while we add labelled examples and re-test.
- **What users will see:** a “Did I get this right?” card before any results, and replies in English.
- **Next update by:** \[time\].

## Staged rollout

Four stages, each with a gate to enter the next and a way back. Stage sizes are proposals.

| Stage | Who | Gate to move on | Rollback |
| --- | --- | --- | --- |
| 0. Internal | The team, running the golden set and a frozen hold-out | The ship gate from Phase 7 is met on the hold-out; no launch blocker from the autonomy map is open | Not applicable |
| 1. Moderated sessions | Five or more real users, one at a time (the course requirement) | No wrong laptop shown; every session logged with verbatims and one change made | Pause sessions and fix before the next one |
| 2. Closed beta | About 100 invited users, English and Hinglish only | Each enabled segment has 20 or more labelled rows and meets its bar; two weeks with no blocker event | Turn the segment off; fall back to English with a confirm step |
| 3. Open launch | Anyone, with segments enabled one at a time | Each new segment passes its own bar first | Per-segment switch; model calls off, so the product runs on rules with template reasons |

**Always available:** a switch that turns off the model calls (rules-only mode), a switch that hides prices if a feed goes stale, and a rule that any blocker event pauses the stage until the cause is fixed.

## Open questions

- [ ] V, F, D, R definitions and 1/3/5 anchors: the scorecard in section 1 uses my assumptions and needs re-scoring with the real ones.
- [ ] Role cards for the Exercise 2 sync: the four roles here are assumed.
- [ ] Owners by name: eval owner, catalog owner, ops owner, claim reviewer. In a student team, who plays each?
- [ ] Proposed numbers to confirm or change: 95% parse bar, 20 rows per segment, ₹5 per conversation, 8-second p95, 100 beta users, the maximum price age.
- [ ] Catalog scope for version 1: price band and number of models to verify by hand.
- [ ] Data rights: which sources we may store and show; a legal check before launch.
- [ ] Retention for pincode and photos.
- [ ] Door B: in or out of the course submission.
- [ ] Do you want the flow in section 2 drawn as a diagram?
