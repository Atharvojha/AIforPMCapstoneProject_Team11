# F05. Owner voice (extension, the data moat)

**User job.** When I am choosing, I want to hear from owners like me (same use, owned for months, about one topic, recently), so I can trust what I read.
**Users.** Performance seekers, students, parents, working professionals; later reviewers.
**Prototype status.** Built (Owners screen; Home ask box). Filters by user type, months owned, topic, time window, laptop. Sample data.
**Prompts used.** P1 (P1f owner-filter reader), P4 (evidence summariser, designed), P8 (review tagger, designed, offline).

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Read "what do gamers say about heat after 6 months" into filters | LLM extraction (P1f); the filter bar is the non-AI path | Free language | A form alone loses typed questions | — |
| Retrieve matching reports | SQL aggregate over tagged rows | Exact counts with n | Vector search would blur filters | Corpus too large to filter by topic |
| Tag imported reviews with topic, persona, rating, months | LLM batch labelling (P8) with human spot-check | No labelled data to train on | A classifier needs labels | About 5,000 labelled rows: train a small classifier |
| "People like you" weighting | Rules: only reports matching the buyer's persona (and months) count | Explainable | A model could drift from the buyer's situation | — |
| Summary of retrieved reports | **RAG** (P4): retrieve, then restate with n; optional | Saves reading on large sets | Free summarising invents | If summaries soften complaints in tests: show verbatim only |
| Counts, ratings | Code | — | — | — |

## 2. The five parts

### Trigger
- Owners screen: any change to the filter bar (user type, topic, months, window, laptop).
- Market screen: "See owner reports" on a trending item.
- Home ask box: a question about what owners say.
- Offline: n8n schedule runs the review tagger (P8) when new reviews are imported.

### Orchestration
1. Normalise filters (unknown persona or topic reported back, not guessed).
2. Query evidence by filters; group by laptop; compute n, average rating, topic counts, sources.
3. If n is under 20: show "not enough evidence" with the count and no excerpts. Otherwise show excerpts (and an optional P4 summary).
4. Sort by rating then n. State that this is a lens, not a ranking of laptops.
5. If nothing matches: say so, never change a filter silently, and offer the filter whose removal shows the most reports.
6. Gate: recompute the same query and compare every count and rating; mismatch drops the block.
7. Log views for "most checked".
**Offline path (n8n).** Import reviews, run P8 on each, send low-confidence ones to a review queue, a person spot-checks a sample, then rows are marked verified and enter the table.

### Model
P1f (read), P8 (batch tag), P4 (optional summary). Gemini Flash-class.

### Knowledge
`evidence_excerpt` (topic, persona, months, rating, n_reports, source, date), `owner_submission` (approved ones become excerpts). No vectors in the first version.

### Eval loop
| Item | Plan |
|---|---|
| Golden set | At least 40 queries; plus a labelled sample of at least 100 reviews for the tagger |
| Test types | Persona only; topic only; months owned; time window; combined; no matches; unknown persona; fewer than 20 reports; a laptop not in the catalog; Hinglish; injection in a report |
| Metrics | Filter extraction accuracy; **counts match the data exactly (hard)**; **n shown on every rating (hard)**; tagger accuracy per field vs human labels; tagger low-confidence rate; summary faithful to rows (P4) |
| Judge, rubric | As F01, plus faithfulness of any summary |
| Proposed ship gate | Hard metrics met; tagger topic accuracy at least 0.85 on the labelled sample before bulk import |
| Rights | Settle data rights and retention before quoting any review text (to-do 6.6) |

## 3. Prompt contract summary
| | |
|---|---|
| **Input** | A question, or tagged rows with n |
| **Output** | Filters; or a restatement with n; or labels with confidence |
| **Guardrails** | Only filters the user said; summaries may add nothing; n is passed in and checked; low-confidence labels are reviewed |
| **Trade-offs** | Closed lists of six personas and seven topics keep counts honest but cannot answer odd cuts; verbatim excerpts are safer than summaries |

## 4. Autonomy and cost of being wrong
**Suggest.** Medium: a misleading count could sway a purchase. Hence n always shown and the gate recomputes.

## 5. Failure modes and fallbacks
| Failure | Behaviour |
|---|---|
| n under 20 | "Not enough evidence", count shown |
| Mixed topics in one excerpt | Tagger returns the main topic; low confidence goes to review |
| Source licence unclear | Row is not quoted until rights are settled |

## 5b. Questions for you (answered on your behalf in ../05_ANSWERS.md)
1. Should summaries ever be on by default?
2. Which sources are you allowed to quote, and with what limits?
3. India vs other-region reports: should region be a filter in the first version (to-do 3.9)?
