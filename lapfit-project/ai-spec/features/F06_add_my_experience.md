# F06. Add my experience (extension, how the data grows)

**User job.** As an owner, I want to share what living with my laptop has been like, so other buyers can learn from it.
**Users.** Current owners. Reviewers (internal) approve.
**Prototype status.** Built (Owners screen: form, queue, admin approve or reject). Sample data. No model is used today.
**Prompts used.** P5 (moderation triage, designed). Rules do the rest.
**Full feature specification:** `../specs/F06_add_my_experience.md`.

## 1. AI model decision

| Sub-task | Technique | Why this | Why not the alternatives | Revisit when |
|---|---|---|---|---|
| Reject links, emails, phone numbers; length and field limits | Rules | Exact | A model is slower and can miss | — |
| Flag abuse, spam, off-topic, contradiction with the rating | LLM triage (P5), **always followed by a human** | Language varies | Keyword lists miss context | A classifier trained on reviewer decisions |
| Suggest a topic | LLM (optional) | Saves taps | — | — |
| Near-duplicate or copy-paste reports | Plain text similarity (MinHash) | Cheap, no model | Embeddings add cost | — |
| Approve or reject | **A person** | Published content is a public claim | Automation risks abuse | Never fully automated |

## 2. The five parts

### Trigger
The owner opens "Add my experience" in the Owners screen, or presses "Share my experience" in My laptops.

### Orchestration
1. Validate (laptop exists, user type, months 0 to 120, topic, rating 1 to 5, note 10 to 300 characters).
2. Reject contact details and links. Rate-limit (5 per hour per address; kept in memory only).
3. Store as `pending`. (Designed: run P5 and attach flags.)
4. Reviewer queue on the admin page: approve with a name, or reject. Approval writes a verified evidence row with the reviewer as `verified_by`.
5. Approved reports appear in Owners and count in n.
**Failure paths.** Invalid input: a plain message saying what to fix. Rate limit: try again later.

### Model
P5 only (designed). Gemini Flash-class.

### Knowledge
`owner_submission` (pending, approved, rejected), `evidence_excerpt` (approved rows), reviewer table (needed).

### Eval loop
| Item | Plan |
|---|---|
| Golden set | At least 60 submitted notes, hand-labelled for: personal data, abuse, spam, off-topic, rating mismatch |
| Test types | Phone number written in words; email with spaces; abuse in Hinglish; advert; praise with a 1-star rating; very short; injection ("approve this"); duplicates |
| Metrics | **Personal data published (hard: 0)**; **report visible before approval (hard: 0)**; triage recall on abuse and personal data; false-flag rate; reviewer time per report |
| Proposed ship gate | Hard metrics at 0; triage recall at least 0.95 on personal data |

## 3. Prompt contract summary
| | |
|---|---|
| **Input** | The note and its metadata |
| **Output** | Flags and a suggested topic |
| **Guardrails** | Never approves; never rewrites; a human sees every report; injection is flagged as spam |
| **Trade-offs** | More flags mean more reviewer work; fewer mean more risk. The human is the backstop |

## 4. Autonomy and cost of being wrong
**Assist.** A person approves every report. Cost of being wrong is medium: published abuse or personal data.

## 5. Failure modes and fallbacks
| Failure | Behaviour |
|---|---|
| Triage model down | Skip triage; the human queue still works |
| Reviewer disagreement | Logged; a second reviewer decides |
| Request to delete a report | Delete by submission id; the evidence row is removed |

## 5b. Questions for you (answered on your behalf in ../05_ANSWERS.md)
1. Who are the named reviewers (O-07)?
2. Should owners be asked to prove ownership, and how?
