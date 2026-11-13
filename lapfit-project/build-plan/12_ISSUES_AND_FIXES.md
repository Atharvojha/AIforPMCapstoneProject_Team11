# Issues and fixes log (13 Nov 2026 and the build before it)

This is the history of what went wrong, or was found wanting, in LapFit since the beginning, up to 14 Nov 2026: what the problem was, how it was found, why it happened, how it was fixed, how the fix was checked, and what is still open. It was asked for by the owner: "since the beginning, whatever you have fixed, what is the problem, why it is caused, how you have fixed it".

**Sources.** `ai-spec/02_DECISIONS.md` (D-01 to D-72, many are reversals), `build-plan/05` to `11`, `ai-spec/01_TODO.md`, the READMEs, `prototype/ux/*.md`, the git log (13 commits from 28 Oct to 14 Nov 2026), and the session transcript (owner messages and assistant reports). Each entry cites its source. Where no document or message records a root cause, the entry says "Cause not recorded" or states that the cause was not established; nothing here is guessed. Entries come from the owner's tests, automated tests, reviewing agents, and the assistant's own checks.

**Dates.** Almost all the work happened on 13 Nov 2026 (git dates). "Rounds": 1 prototype; 2 specs, data and decisions; 3 backend build; 4 deployment and real services, first frontend; 5 redesigns, logging, owner tests; 6 owner user-testing list (at the end of this file, filled in by the lead).

**Severity** is the effect on a buyer or on trust: High (wrong or misleading on screen, security, blocks use), Medium (degrades use), Low (cosmetic or tooling).

**Status words.** Fixed; Mitigated (works round it); Open; Accepted gap or Decided (a recorded decision).

## Summary table

| ID | Area | Severity | Status | Issue |
|---|---|---|---|---|
| F-001 | product / honesty | High | Fixed (positioning); proof pending | The product felt like "a chatbot you could replace with ChatGPT" |
| F-002 | tooling | Low | Worked around | The browser could not open the local prototype |
| F-003 | tooling | Low | Cleared | Tool session errors: a 403 from a security page and a request to log in |
| F-004 | tooling | Medium | Fixed each time | Scripted edits that silently did not apply |
| F-005 | process | Medium | Fixed | Folder name collision with the existing Lapfit folder |
| F-006 | process | Low | Fixed | Documents and code scattered in many direct child folders |
| F-007 | data | Medium | Fixed in the rules (D-25) | Prototype logic used the model year for the Windows 11 rule |
| F-008 | honesty | Medium | Fixed in the backend | Prototype used-check flow lacked a model-down form, gate and seller-reason flags |
| F-009 | data / process | Medium | Fixed (D-04 revised) | Reuse of the team repo: first rejected, then reversed |
| F-010 | process | Medium | Fixed | The owner could not answer the open questions |
| F-011 | process | Low | Fixed (D-24) | Feature specs mixed in screens |
| F-012 | process | Low | Open | Course material not available: cost-of-being-wrong worksheet and V x F x D x R anchors |
| F-013 | process | Low | Followed each push | Commits and pushes must carry the owner's name, not the assistant's |
| F-014 | privacy | High | Open until a paid plan | Free-tier model terms forbid real user text |
| F-015 | data / legal | High | Open (managed) | Review text licences are unverified |
| F-016 | data | Medium | Open (labelled) | Opinion labels were machine-read, not human-verified |
| F-017 | data / honesty | Medium | Open (labelled) | Dataset reviews carry no dates, user types or months owned |
| F-018 | data | Medium | Worked around | The catalog has no design data, colours or review dates |
| F-019 | data | Low | Decided; not built | Old embeddings cannot be queried with a new embedding model |
| F-020 | honesty / router | High | Fixed | "A stylish laptop in India": style silently ignored and the title said "meet every Must" |
| F-021 | router | Medium | Fixed | Multi-line team table read as one line |
| F-022 | honesty / gate | High | Fixed | Single-person buy-for-others cards skipped the reasons writer and the gate |
| F-023 | rate limit | High | Fixed | Every anonymous submission shared one rate-limit bucket |
| F-024 | router | Medium | Fixed | Topic words polluted laptop names |
| F-025 | router | Low | Fixed | Typos such as "macbok" were not recognised |
| F-026 | data / live | High | Fixed (layer added) | Owner needed live, relevant reviews, not only the saved dataset |
| F-027 | live reviews | Medium | Fixed | Video chapter lists and markdown noise came back as "reviews" |
| F-028 | live reviews / model | Medium | Worked around | Gemini Google Search grounding returned HTTP 429 |
| F-029 | security | High | Fixed | Two tool functions callable with the public key |
| F-030 | rate limit | High | Fixed (limits tunable) | Public endpoint with paid calls behind it and no limit |
| F-031 | model / latency | High | Mitigated; still open | Model replies were slow, 5 to 20 seconds, and one attempt could use the whole budget |
| F-032 | model | Medium | Mitigated | Model availability: the faster model failed and an older one was gone |
| F-033 | model | Low | Fixed (design) | Spec assumed temperature 0; newer models may ignore it |
| F-034 | model / latency | High | Fixed | Fallback wrapper could hang forever |
| F-035 | router / model | High | Fixed | Gemini dropped "not HP" from a Hinglish request |
| F-036 | router / model | Medium | Fixed | Owner-voice question sent to brand insights |
| F-037 | latency | Low | Fixed | Gate and lookups ran one after another |
| F-038 | honesty / router | Low | Fixed | A "style: stylish" criterion from the model appeared as an unsupported item |
| F-039 | honesty / data | High | Fixed | The code read settings under names the database did not have |
| F-040 | honesty / router | Medium | Fixed | Spec-like claims labelled "service" skipped the catalog check |
| F-041 | monetization | Low | Fixed | Shop search text repeated the brand ("APPLE APPLE 2020 Macbook...") |
| F-042 | security / images | Medium | Verified (kept as regression) | Hidden instructions inside a picture (check that passed) |
| F-043 | data / honesty | Medium | Open (labelled) | Used and sell prices are sample assumptions; no stale-price warning |
| F-044 | tooling | Low | Resolved | Gemini and Supabase setup steps that needed the owner, not the assistant |
| F-045 | tooling | Medium | Accepted gap (D-44) | Migrations applied with db query leave no migration history |
| F-046 | tooling / process | High | Fixed; lesson recorded | Deployed backend was older than the code |
| F-047 | frontend | Medium | Fixed | A second request left the first turn stuck on "pending" |
| F-048 | frontend | Low | Fixed | Find screen had no brand list unless another screen had loaded the catalog |
| F-049 | tooling | Low | Fixed | Dev server unreachable: listening on IPv6 only |
| F-050 | rate limit / tooling | Low | Worked around | Own test traffic exhausted the rate limit during the live frontend check |
| F-051 | rate limit / frontend | Medium | Fixed | The rate-limit message repeated itself and showed minutes as seconds |
| F-052 | logging | High | Fixed | The request log said "ok" for requests that had failed softly |
| F-053 | privacy / logging | Medium | Reversed by decision (D-52) | Typed text was not stored, so failures could not be reproduced |
| F-054 | privacy / logging | Medium | Reversed by decision (D-71) | Owner needs to hear everything users type during testing |
| F-055 | honesty / frontend | High | Fixed | Banner said "Course project / sample data" and the dataset's role was invisible |
| F-056 | monetization | Medium | Built; nothing earned yet | No visible way the product earns money |
| F-057 | images / voice | Medium | Built; partly unproven | Multimodal input and output were missing |
| F-058 | frontend | Low | Fixed | Radar label cut off and the voice-consent box took space |
| F-059 | frontend layout | High | Fixed (version 3) | First redesign only changed colours; too many fields |
| F-060 | frontend layout / images | High | Fixed (version 4) | Result cards were not intuitive, did not use the space, and had no laptop images |
| F-061 | data / live | Medium | Fixed | Market pulse and Brand insights used only the app's own data |
| F-062 | frontend style / process | Low | Fixed | UI style direction unclear; four-agent styling collided |
| F-063 | frontend layout | High | Fixed (version 6) | Layouts judged cluttered and the experience "the worst" |
| F-064 | honesty / frontend | Medium | Fixed in the design | Design critique: swipe-only or one-at-a-time results hide comparison |
| F-065 | honesty / frontend | High | Fixed | Trust labels were buried in the proposals |
| F-066 | honesty / frontend | High | Fixed | Price counted up from "₹0" |
| F-067 | process | Low | Resolved | Parallel builders left the suite red while work was in flight |
| F-068 | images / frontend | Medium | Fixed (version 7) | Photos of mid-range laptops all look alike |
| F-069 | tests / model | Medium | Mitigated | Tests on a fake model missed real-service behaviour |
| F-070 | tests | Low | Fixed | Test-side mistakes mistaken for product bugs |
| F-071 | model / latency | High | Open (mitigated by fallbacks) | Log review before user testing: Gemini timeouts and slow typed requests |
| F-072 | images / rate limit | Medium | Open | Picture reading through the live endpoint is unproven |
| F-073 | tooling | Low | Worked around | Log commands and live tail misbehaved in the session |
| F-074 | frontend | High | Fixed | Details button crashed the screen (hooks order) |
| F-075 | monetization / frontend | High | Fixed (button); tags still empty | Where to buy hidden in the sheet that crashed, so affiliate links looked removed |
| F-076 | router / frontend | High | Fixed | Follow-up questions had no context ("Will this last for 8 years?" got "Which laptop?") |
| F-077 | honesty | Low | Fixed | Follow-up web results included the maker's advertising; one spec showed raw text |
| F-078 | images / process | Medium | Fixed (pushed in 03ff4d3) | Teammates' copies had no Show photo button |
| F-079 | privacy / process | High | Prevented | Secrets and raw inputs could have been pushed with the shared repo |
| F-080 | deployment | Medium | Open | Frontend is not online and ALLOWED_ORIGIN is open |
| F-081 | process / honesty | Low | Open (decided, D-42) | No reviewer notification or admin screen for owner reports and claim verdicts |

## By theme

| Theme | Count | IDs |
|---|---|---|
| Data and sources | 11 | F-007, F-009, F-015, F-016, F-017, F-018, F-019, F-026, F-027, F-043, F-061 |
| Frontend layout and UX | 7 | F-047, F-048, F-058, F-059, F-062, F-063, F-074 |
| Honesty and trust | 13 | F-001, F-008, F-020, F-022, F-038, F-039, F-040, F-055, F-064, F-065, F-066, F-077, F-081 |
| Images | 5 | F-057, F-060, F-068, F-072, F-078 |
| Logging and privacy | 5 | F-014, F-052, F-053, F-054, F-079 |
| Model and latency | 8 | F-028, F-031, F-032, F-033, F-034, F-037, F-069, F-071 |
| Monetization | 3 | F-041, F-056, F-075 |
| Process and documentation | 7 | F-005, F-006, F-010, F-011, F-012, F-013, F-067 |
| Rate limit and security | 6 | F-023, F-029, F-030, F-042, F-050, F-051 |
| Router and reading | 6 | F-021, F-024, F-025, F-035, F-036, F-076 |
| Tooling and environment | 10 | F-002, F-003, F-004, F-044, F-045, F-046, F-049, F-070, F-073, F-080 |

Total: 81 entries. Severity: High 26, Medium 32, Low 23.

## Entries (in time order)

### F-001. The product felt like "a chatbot you could replace with ChatGPT"

- **When:** 13 Nov, round 1 (prototype)
- **Theme and area:** Honesty and trust / product / honesty
- **Severity and status:** High; Fixed (positioning); proof pending
- **What the problem was:** Owner: "what is the USP? right now, it is very confusing and I can do all of this using chatgpt as well", and later "this looks like just a chatbot".
- **How it was found:** Owner review of the first prototype.
- **Why it happened:** Five products (shortlist, second opinion, pitch check, used check, buy for others) sat behind one text box, so the only real difference, the trust design, was invisible.
- **How it was fixed:** The assistant named the real edge: every spec, price and ranking comes from a database, each Must gets a computed tick or cross, and no buy verdict is given. The owner then asked for broader jobs (JTBD expansion, trends and filters, sell plan, extensions D-02), and the app became multi-screen with a sell flow.
- **How it was verified:** Prototype tests grew from 51 to 67 as screens were added. No head-to-head test against ChatGPT was run.
- **What remains:** The suggested test (same 10 deliberately wrong pitches given to both and counted) was proposed, not run.
- **Source:** transcript (owner messages on USP); jtbd-analysis/

### F-002. The browser could not open the local prototype

- **When:** 13 Nov, round 1
- **Theme and area:** Tooling and environment / tooling
- **Severity and status:** Low; Worked around
- **What the problem was:** Chrome showed an error page for localhost:3111 and 127.0.0.1:3111 although the server answered 200 to curl.
- **How it was found:** My own check, trying to screenshot the home screen.
- **Why it happened:** Not established. The assistant's guess was that the browser tool was on a different machine or Chrome blocked local addresses. The same limit came back when the frontend was built (three tries) and in headless runs.
- **How it was fixed:** Pages were checked in a simulated browser at first. From the frontend build on, screens were photographed with headless Chrome at phone width, and a development-only gallery route (#/gallery/<fixture>) renders every reply type.
- **How it was verified:** Headless screenshots; gallery excluded from the production build (0 matches checked).
- **What remains:** Dark mode, a real phone and animation playing were never seen by eye (11_FRONTEND_DESIGN.md, section 5).
- **Source:** transcript; 11_FRONTEND_DESIGN.md s5

### F-003. Tool session errors: a 403 from a security page and a request to log in

- **When:** 13 Nov, round 1
- **Theme and area:** Tooling and environment / tooling
- **Severity and status:** Low; Cleared
- **What the problem was:** One assistant turn ended with "Please run /login. API Error: 403 Attention Required! | Cloudflare".
- **How it was found:** Seen in the session output.
- **Why it happened:** Cause not recorded.
- **How it was fixed:** Session was continued; no project file changed.
- **How it was verified:** Work resumed in the same session.
- **What remains:** None.
- **Source:** transcript

### F-004. Scripted edits that silently did not apply

- **When:** 13 Nov, rounds 1 to 4
- **Theme and area:** Tooling and environment / tooling
- **Severity and status:** Medium; Fixed each time
- **What the problem was:** Examples: new API routes never got added because a text replacement did not match; a sed command broke and Python was used; a link update failed on shell quoting; spaces in a folder path were URL-encoded and broke the import; a card file was not written because a path was mistyped (components/ folder).
- **How it was found:** Tests or a re-read of the file showed the change was missing.
- **Why it happened:** String-replace and shell edits on long paths with spaces and quotes. Root cause per case: the pattern did not match, or the path was quoted wrongly.
- **How it was fixed:** Redid each edit with a more careful method (Python, correct path, path handling for spaces).
- **How it was verified:** Tests re-run after each redo (for example 51 then 67 prototype tests; backend import counts matched).
- **What remains:** The folder path contains spaces and will cause this again; use absolute, quoted paths.
- **Source:** transcript

### F-005. Folder name collision with the existing Lapfit folder

- **When:** 13 Nov, round 1
- **Theme and area:** Process and documentation / process
- **Severity and status:** Medium; Fixed
- **What the problem was:** A new prototype folder needed a name next to a team folder called Lapfit.
- **How it was found:** My own check of the directory before moving the prototype.
- **Why it happened:** macOS file names are case-insensitive by default, so Lapfit and a new lapfit would be the same folder.
- **How it was fixed:** The prototype folder was named lapfit-prototype. Later everything was consolidated under one folder, lapfit-project. The untracked Lapfit/ folder (five older markdown files, not authored in this work) was never pushed.
- **How it was verified:** Prototype tests passed from the new location (67). Push contained only lapfit-project/.
- **What remains:** Lapfit/ remains untracked in the shared repo; the owner has not said whether to push it.
- **Source:** transcript; git b087afe

### F-006. Documents and code scattered in many direct child folders

- **When:** 13 Nov, round 2
- **Theme and area:** Process and documentation / process
- **Severity and status:** Low; Fixed
- **What the problem was:** Owner: "keep all the important documents in single folder... I need only one direct child".
- **How it was found:** Owner instruction.
- **Why it happened:** Separate folders (lapfit-prototype, lapfit-data-model, lapfit-ai-spec and others) had been created one by one.
- **How it was fixed:** All moved under lapfit-project/ (prototype, data-model, jtbd-analysis, ai-spec, then build-plan, backend, frontend, ai-prd).
- **How it was verified:** Folder listing; the root README table lists each folder.
- **What remains:** None.
- **Source:** lapfit-project/README.md

### F-007. Prototype logic used the model year for the Windows 11 rule

- **When:** 13 Nov, round 1 to 2
- **Theme and area:** Data and sources / data
- **Severity and status:** Medium; Fixed in the rules (D-25)
- **What the problem was:** The Windows 11 check was called "the weakest rule" by the assistant: it used a stand-in based on model year.
- **How it was found:** My own review at the end of the used-check spec.
- **Why it happened:** Microsoft's support list is by processor, and the catalog had no reliable year-to-processor mapping.
- **How it was fixed:** D-25: Intel Core 8th generation or later and the AMD models on Microsoft's list are supported; others say "check with PC Health Check".
- **How it was verified:** Research answers C23 and Q-R7 in 05_ANSWERS.md; used-check tests.
- **What remains:** Depends on Microsoft's lists staying current.
- **Source:** 02_DECISIONS.md D-25; 05_ANSWERS.md

### F-008. Prototype used-check flow lacked a model-down form, gate and seller-reason flags

- **When:** 13 Nov, round 1 to 2
- **Theme and area:** Honesty and trust / honesty
- **Severity and status:** Medium; Fixed in the backend
- **What the problem was:** The assistant listed prototype gaps: no model-down form for this flow, no pre-send gate on used checks, no low-battery or seller-reason flags.
- **How it was found:** My own gap list while writing the F03 spec.
- **Why it happened:** The prototype was written quickly as a reference; these were left out.
- **How it was fixed:** The deployed backend's used check compares the listing with the catalog, flags low battery health and a missing bill, always gives a checklist and never a verdict, and runs through the gate.
- **How it was verified:** Backend flow tests (16 core-flow tests at that stage).
- **What remains:** Price band is a sample (see the sell and used price entry).
- **Source:** 05_BACKEND_BUILD_LOG.md s3

### F-009. Reuse of the team repo: first rejected, then reversed

- **When:** 13 Nov, round 2
- **Theme and area:** Data and sources / data / process
- **Severity and status:** Medium; Fixed (D-04 revised)
- **What the problem was:** Owner first said the repo was bad and to reuse nothing, then asked to "find ways to use the existing databases".
- **How it was found:** Owner instructions in sequence.
- **Why it happened:** The first view was about the old code and labels; the database itself (29 laptops, about 4,000 reviews, 1,316 opinions with exact quotes, provenance, permissions) had not been inspected.
- **How it was fixed:** Assistant inspected the database; D-04 revised to reuse the data, not the old code, AI-drafted labels or older documents as specifications. The old Python service is not deployed (D-22).
- **How it was verified:** Import counts equal the SQLite file exactly (3,987 reviews, 1,316 opinions, 29 variants, 173 spec facts, 14 prices) locally and on the live project.
- **What remains:** Rights on review text unconfirmed (see licences entry).
- **Source:** 02_DECISIONS.md D-04, D-22; 05_BACKEND_BUILD_LOG.md s3

### F-010. The owner could not answer the open questions

- **When:** 13 Nov, round 2
- **Theme and area:** Process and documentation / process
- **Severity and status:** Medium; Fixed
- **What the problem was:** Owner: "I don't know any of the answers, you have to check and answer for me" and later "I can't check anything, you do the research and answer your own questions".
- **How it was found:** Owner instructions.
- **Why it happened:** The specs raised questions (rights, laws, limits, prices) that needed research, not product opinion.
- **How it was fixed:** Assistant researched and recorded each answer with how it was reached in 05_ANSWERS.md (C-numbers and Q-R numbers); items nobody can check carry a labelled working assumption (O-01 to O-07). Decisions D-25 to D-31 came from this.
- **How it was verified:** Sources are cited per answer.
- **What remains:** Open decisions O-01 to O-07 remain; the due date, grading weights, named approvers and the paid-vs-free choice need the owner.
- **Source:** 05_ANSWERS.md; 02_DECISIONS.md open decisions

### F-011. Feature specs mixed in screens

- **When:** 13 Nov, round 2
- **Theme and area:** Process and documentation / process
- **Severity and status:** Low; Fixed (D-24)
- **What the problem was:** Owner: "the specs should have only functional requirements, it shouldn't say which screen".
- **How it was found:** Owner instruction.
- **Why it happened:** Earlier UI notes were drafted inside the specs.
- **How it was fixed:** Feature specs kept functional; the frontend's jobs and triggers moved to 03_FRONTEND_JOBS_AND_TRIGGERS.md; screens specified after the build.
- **How it was verified:** Document structure (D-15, D-24).
- **What remains:** None.
- **Source:** 02_DECISIONS.md D-24

### F-012. Course material not available: cost-of-being-wrong worksheet and V x F x D x R anchors

- **When:** 13 Nov, round 2
- **Theme and area:** Process and documentation / process
- **Severity and status:** Low; Open
- **What the problem was:** The assistant had not seen these slides and refused to guess them.
- **How it was found:** My own gap check.
- **Why it happened:** The slides were never shared.
- **How it was fixed:** D-10 holds the assistant's own cost-of-being-wrong table; the anchors were left blank.
- **How it was verified:** Listed in 01_TODO.md (5.3) and 05_ANSWERS.md.
- **What remains:** The owner must supply them (O-04).
- **Source:** 01_TODO.md; 02_DECISIONS.md O-04

### F-013. Commits and pushes must carry the owner's name, not the assistant's

- **When:** 13 Nov, rounds 2 to 5
- **Theme and area:** Process and documentation / process
- **Severity and status:** Low; Followed each push
- **What the problem was:** Owner: "push the folders in my name not claude" (repeated).
- **How it was found:** Owner instruction.
- **Why it happened:** Default tool attribution would have put the assistant on the commits.
- **How it was fixed:** Commits were authored under the owner's GitHub identity with no assistant co-author line; the owner's git settings were not changed. Pushes after the first were confirmed with the owner before the shared repo was updated.
- **How it was verified:** Commit b087afe and later ones in git log.
- **What remains:** The shared repo belongs to a teammate; pushes went straight to main.
- **Source:** git log; transcript

### F-014. Free-tier model terms forbid real user text

- **When:** 13 Nov, round 2
- **Theme and area:** Logging and privacy / privacy
- **Severity and status:** High; Open until a paid plan
- **What the problem was:** Checked terms: on the unpaid tier Google may use inputs to improve its products and humans may read them.
- **How it was found:** My own research (C1 to C4).
- **Why it happened:** Free tier terms, not a bug.
- **How it was fixed:** D-14 and D-03: free tier for sample data and test queries only; paid tier before any real user text or photo; scrub phone numbers, emails and IDs before sending where cheap.
- **How it was verified:** Terms read and cited in 05_ANSWERS.md.
- **What remains:** The app currently sends typed text to a free-tier model; the paid-tier move is on the pre-launch list (06_OPERATIONS_RUNBOOK.md s12).
- **Source:** 02_DECISIONS.md D-03, D-14; 05_BACKEND_BUILD_LOG.md s9

### F-015. Review text licences are unverified

- **When:** 13 Nov, round 2
- **Theme and area:** Data and sources / data / legal
- **Severity and status:** High; Open (managed)
- **What the problem was:** Flipkart reviews are declared CC BY 4.0 on a Zenodo record; the Amazon 2023 dataset has no licence and is research-only.
- **How it was found:** Data inspection and research (C17, C18).
- **Why it happened:** Licences came from dataset pages, not from the shops.
- **How it was fixed:** D-20 (course and production modes), D-26 (declared_cc_by_4: excerpts up to 25 words with attribution; research_only: never public; facts_only), D-43 (imported laptops labelled Sample data). Test: Amazon text is never quoted.
- **How it was verified:** Data test and rights rule on the source table.
- **What remains:** Legal review or permission is still needed before real use.
- **Source:** 02_DECISIONS.md D-20, D-26, D-43; 08_DATA_AND_SOURCES.md

### F-016. Opinion labels were machine-read, not human-verified

- **When:** 13 Nov, round 2
- **Theme and area:** Data and sources / data
- **Severity and status:** Medium; Open (labelled)
- **What the problem was:** The 1,316 imported opinions were read by a model; the team's own figures were precision 0.88 and recall 0.83 against AI-written keys, about 1 in 8 wrong.
- **How it was found:** Reading the old dataset's README and evaluation.
- **Why it happened:** Labels were produced by an AI model, and the keys it was scored against were AI-drafted as well.
- **How it was fixed:** D-21: always labelled "machine-read, not human-verified"; counts only shown with n of 20 or more; evidence ring says "collecting" below that.
- **How it was verified:** Cards show the label; 0 of 29 variants verified is displayed on the banner.
- **What remains:** An audit by a person has not been done.
- **Source:** 02_DECISIONS.md D-21; 08_DATA_AND_SOURCES.md

### F-017. Dataset reviews carry no dates, user types or months owned

- **When:** 13 Nov, rounds 2 to 5
- **Theme and area:** Data and sources / data / honesty
- **Severity and status:** Medium; Open (labelled)
- **What the problem was:** None of the 3,987 reviews has a date, a persona or months owned; most are first-week reviews. So "last 30 days" or "what students say after six months" cannot be answered.
- **How it was found:** Data inspection; again when the owner asked what the dataset is used for.
- **Why it happened:** The source datasets simply did not record them.
- **How it was fixed:** The product says so (D-51); persona and months filters were not built; recent information comes only from the separate live web layer (D-36).
- **How it was verified:** 08_DATA_AND_SOURCES.md states it; no screen shows a made-up date.
- **What remains:** Needs a new data source or user-contributed reports.
- **Source:** 08_DATA_AND_SOURCES.md s2; 02_DECISIONS.md D-36, D-51

### F-018. The catalog has no design data, colours or review dates

- **When:** 13 Nov, round 3
- **Theme and area:** Data and sources / data
- **Severity and status:** Medium; Worked around
- **What the problem was:** Looks ("stylish") are a top buying reason but nothing in the catalog describes them; colours are optional.
- **How it was found:** First real output (see the stylish entry).
- **Why it happened:** Imported listing data has specs and prices only.
- **How it was fixed:** D-29 colours optional; D-35 soft-word registry: a count of owners who praised the design in their reviews (keyword match, labelled not verified).
- **How it was verified:** soft.ts and lens.ts tests.
- **What remains:** Needs curated design data.
- **Source:** 02_DECISIONS.md D-29, D-35

### F-019. Old embeddings cannot be queried with a new embedding model

- **When:** 13 Nov, round 2
- **Theme and area:** Data and sources / data
- **Severity and status:** Low; Decided; not built
- **What the problem was:** The existing vectors came from a local model.
- **How it was found:** Planning the data layer.
- **Why it happened:** A query must be embedded with the same model as the stored vectors.
- **How it was fixed:** D-19 and D-27: text search first; re-embed with a hosted model (768 dimensions) when needed and keep old vectors for a side-by-side test.
- **How it was verified:** Not built in this round (embedding search column exists).
- **What remains:** Test still to do.
- **Source:** 02_DECISIONS.md D-19, D-27; 05_BACKEND_BUILD_LOG.md s7

### F-020. "A stylish laptop in India": style silently ignored and the title said "meet every Must"

- **When:** 13 Nov, round 3 (first backend output)
- **Theme and area:** Honesty and trust / honesty / router
- **Severity and status:** High; Fixed
- **What the problem was:** The first real output listed 5 of 14 laptops (3 shown) under "3 laptops that meet every Must" although there were no Musts, ordered only by price headroom and owner positivity, with no note that "stylish" cannot be checked. Owner: "see how bad your backend is".
- **How it was found:** Owner asked for the output of that sentence; the assistant ran it offline and read it.
- **Why it happened:** "Stylish" is not a catalog field, so the filter ran on nothing; the title was a fixed string, and the reply never told the buyer that style was not used.
- **How it was fixed:** D-35: soft-word registry (soft.ts) so words such as stylish, durable, fast, light become a visible editable Should, an owner-evidence lens (owners who praised the design) or a plain "not in the catalog" notice, never a Must and never silently ignored; honest titles ("Laptops in the catalog" when no Musts); notices. A 75-input matrix and 30 targeted tests were then built to cover every input type.
- **How it was verified:** inputs.test.ts (108 tests by the end). Live: the stylish and good-battery query under 2 lakh returned a shortlist through the deployed endpoint.
- **What remains:** Style evidence is a keyword count, labelled not verified; design data is not curated.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #1; 02_DECISIONS.md D-35

### F-021. Multi-line team table read as one line

- **When:** 13 Nov, round 3
- **Theme and area:** Router and reading / router
- **Severity and status:** Medium; Fixed
- **What the problem was:** A pasted role table for buy-for-a-team gave wrong budgets.
- **How it was found:** Reading real output.
- **Why it happened:** The text cleaner kept newlines inconsistently so rows merged.
- **How it was fixed:** Cleaner preserves newlines; unreadable lines are named in the reply.
- **How it was verified:** Test in the inputs matrix.
- **What remains:** Parser is deterministic; the model is only a fallback.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #2

### F-022. Single-person buy-for-others cards skipped the reasons writer and the gate

- **When:** 13 Nov, round 3
- **Theme and area:** Honesty and trust / honesty / gate
- **Severity and status:** High; Fixed
- **What the problem was:** One path produced cards that were never re-checked before display.
- **How it was found:** Reading real output.
- **Why it happened:** The single-person branch built cards directly instead of going through the common wording and gate steps.
- **How it was fixed:** Cards from that branch pass through both the reasons writer and the pre-send gate.
- **How it was verified:** Flow tests; gate test removes a card whose price was changed.
- **What remains:** Gate has the last word (D-34); add checks as new fact types appear.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #3

### F-023. Every anonymous submission shared one rate-limit bucket

- **When:** 13 Nov, round 3
- **Theme and area:** Rate limit and security / rate limit
- **Severity and status:** High; Fixed
- **What the problem was:** One person could block everyone (all anonymous requests were counted under the same key, anon).
- **How it was found:** A test.
- **Why it happened:** No per-visitor identifier was derived.
- **How it was fixed:** The Edge wrapper derives a salted daily hash of the network address; the handler honours it.
- **How it was verified:** Rate-limit tests (12) and a live burst test.
- **What remains:** Shared networks (a classroom) share one limit; limits are settings.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #4

### F-024. Topic words polluted laptop names

- **When:** 13 Nov, round 3
- **Theme and area:** Router and reading / router
- **Severity and status:** Medium; Fixed
- **What the problem was:** "Battery" and similar words stayed in the name so the laptop was not found.
- **How it was found:** The 75-input matrix.
- **Why it happened:** The name extractor did not strip topic words.
- **How it was fixed:** Topic words are cut from names; unmatched names drop trailing words.
- **How it was verified:** Matrix and tests.
- **What remains:** Fuzzy name matching is rules only.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #5

### F-025. Typos such as "macbok" were not recognised

- **When:** 13 Nov, round 3
- **Theme and area:** Router and reading / router
- **Severity and status:** Low; Fixed
- **What the problem was:** Misspelt brand or product words returned nothing.
- **How it was found:** The 75-input matrix.
- **Why it happened:** Exact matching only.
- **How it was fixed:** One-letter typo correction for brand and product words and fuzzy name matching.
- **How it was verified:** Matrix and tests.
- **What remains:** Two-letter typos are not corrected.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #6

### F-026. Owner needed live, relevant reviews, not only the saved dataset

- **When:** 13 Nov, round 3
- **Theme and area:** Data and sources / data / live
- **Severity and status:** High; Fixed (layer added)
- **What the problem was:** Owner: "don't just go by dataset, I need live relevant reviews as well".
- **How it was found:** Owner instruction.
- **Why it happened:** The dataset is a snapshot without dates (see the undated reviews entry).
- **How it was fixed:** D-36: a separate live layer (source interface, 24-hour cache, daily cap of 30, sanitiser), labelled "Live, not verified", never counted in owner numbers, never ranked, never used by the gate; only the laptop name and a topic leave the system. D-37: Tavily preferred, Gemini Google Search grounding as fallback; no retailer scraping or Reddit.
- **How it was verified:** 11 live tests with a fake source; real Tavily returned LaptopMag, ITPro and Flipkart results.
- **What remains:** Web excerpts can be low quality; paid and sponsored articles may appear; the site list is a judgement.
- **Source:** 08_DATA_AND_SOURCES.md; 02_DECISIONS.md D-36, D-37

### F-027. Video chapter lists and markdown noise came back as "reviews"

- **When:** 13 Nov, round 4
- **Theme and area:** Data and sources / live reviews
- **Severity and status:** Medium; Fixed
- **What the problem was:** Tavily returned video chapter timestamps and snippets full of markdown.
- **How it was found:** Reading real Tavily results.
- **Why it happened:** Raw search excerpts were passed on.
- **How it was fixed:** Results with several timestamps are skipped; markdown noise cleaned. Later, page boilerplate (menus, shop disclaimers) was also stripped for market and brand panels.
- **How it was verified:** Live tests and one real Tavily check of two searches.
- **What remains:** Quality of excerpts still varies.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #15

### F-028. Gemini Google Search grounding returned HTTP 429

- **When:** 13 Nov, round 4
- **Theme and area:** Model and latency / live reviews / model
- **Severity and status:** Medium; Worked around
- **What the problem was:** The first real live-search call failed with "quota exceeded".
- **How it was found:** First real-service call.
- **Why it happened:** Grounding needs a paid Google plan; the account was on the free tier.
- **How it was fixed:** Tavily became the preferred source; grounding code stays as a fallback written from the documentation.
- **How it was verified:** Tavily returned relevant results.
- **What remains:** Grounding itself is untested.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #8, s7

### F-029. Two tool functions callable with the public key

- **When:** 13 Nov, round 4
- **Theme and area:** Rate limit and security / security
- **Severity and status:** High; Fixed
- **What the problem was:** After the first apply, two database tool functions could be called with the public anon key, which ships in the browser.
- **How it was found:** My own check on the live database.
- **Why it happened:** Supabase grants public roles on new objects by default; two functions were not locked.
- **How it was fixed:** Migration 06 re-applies the lock to every tool and removes table grants from public roles (D-41). Later D-55 does the same for log tables and views.
- **How it was verified:** After migration 06: 0 tool functions and 0 tables accessible to anon or authenticated; re-check after every migration.
- **What remains:** No user sign-in; the public key still reaches the endpoint (rate limited).
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #7; 06_OPERATIONS_RUNBOOK.md s10

### F-030. Public endpoint with paid calls behind it and no limit

- **When:** 13 Nov, round 4
- **Theme and area:** Rate limit and security / rate limit
- **Severity and status:** High; Fixed (limits tunable)
- **What the problem was:** Once a Gemini key was set, every call to the public function could cost money; anyone with the public key could drain the free quotas.
- **How it was found:** My own risk review after deploying; recommended before any key was set.
- **Why it happened:** No per-visitor limit existed.
- **How it was fixed:** D-40: runs first, before paid work: 10 a minute and 60 an hour block (HTTP 429 with Retry-After), over 30 an hour degrades to the rules reader, a global daily cap of 1,500 model calls, bodies over 20,000 characters get 413, a failing limiter degrades not fails; visitor is a salted daily hash; blocked requests still count.
- **How it was verified:** 12 tests; live burst of 14 simultaneous requests: 10 answered, 4 got 429; a 30,000-character body got 413.
- **What remains:** Limits by network address only; shared addresses are limited unfairly; fixed windows can briefly double; real protection needs sign-in.
- **Source:** 06_OPERATIONS_RUNBOOK.md s6; 02_DECISIONS.md D-40

### F-031. Model replies were slow, 5 to 20 seconds, and one attempt could use the whole budget

- **When:** 13 Nov, round 4
- **Theme and area:** Model and latency / model / latency
- **Severity and status:** High; Mitigated; still open
- **What the problem was:** Gemini took 5 to 20 seconds on some calls; the first router call on a tiny request took about 4.7 s.
- **How it was found:** Real timings on the live endpoint.
- **Why it happened:** Free-tier latency and a single attempt that could consume the full 8 s budget. A "minimal" thinking setting was slower and erratic (median 11 s).
- **How it was fixed:** D-38: gemini-3.1-flash-lite with low thinking as primary (median 3.2 s, valid 6 of 6), gemini-3.5-flash-lite as fallback, then the rules reader; 4 s per attempt, 8 s for the whole read, 3.5 s for the reasons writer.
- **How it was verified:** Per-stage timings on every reply; live measurements in 05_BACKEND_BUILD_LOG.md s6.
- **What remains:** Later log review still showed 12 timed-out attempts and shortlist medians of about 7.7 s (see the Gemini timeout log entry).
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #9, s6; 02_DECISIONS.md D-38

### F-032. Model availability: the faster model failed and an older one was gone

- **When:** 13 Nov, round 4
- **Theme and area:** Model and latency / model
- **Severity and status:** Medium; Mitigated
- **What the problem was:** gemini-3.5-flash-lite had median 1.7 s but returned 503 and 429 on the free tier; gemini-2.5-flash-lite was no longer available to new users.
- **How it was found:** Real API tests.
- **Why it happened:** Free-tier capacity and model retirement.
- **How it was fixed:** Primary and fallback chosen as above; model names are optional secrets (GEMINI_MODEL, GEMINI_FALLBACK_MODEL).
- **How it was verified:** Measurements table.
- **What remains:** Single runs on a free tier; indicative only.
- **Source:** 05_BACKEND_BUILD_LOG.md s6

### F-033. Spec assumed temperature 0; newer models may ignore it

- **When:** 13 Nov, round 4
- **Theme and area:** Model and latency / model
- **Severity and status:** Low; Fixed (design)
- **What the problem was:** The original brief required temperature 0.
- **How it was found:** My own note at the first backend build ("the temperature caveat") and during model checks.
- **Why it happened:** Newer model families may ignore the temperature setting.
- **How it was fixed:** D-38: nothing relies on temperature; schema validation, retry and code cross-checks carry correctness.
- **How it was verified:** Tests use a fake model.
- **What remains:** Specs and prompts still mention temperature in places.
- **Source:** 02_DECISIONS.md D-38

### F-034. Fallback wrapper could hang forever

- **When:** 13 Nov, round 4
- **Theme and area:** Model and latency / model / latency
- **Severity and status:** High; Fixed
- **What the problem was:** If a model client ignored the abort signal, the fallback would never return.
- **How it was found:** A test the assistant wrote.
- **Why it happened:** The wrapper relied on the client honouring its time limit.
- **How it was fixed:** Each attempt races its own timer.
- **How it was verified:** Test with a client that ignores abort.
- **What remains:** None known.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #10

### F-035. Gemini dropped "not HP" from a Hinglish request

- **When:** 13 Nov, round 4
- **Theme and area:** Router and reading / router / model
- **Severity and status:** High; Fixed
- **What the problem was:** An exclusion in the user's words was lost by the model.
- **How it was found:** Real Gemini output.
- **Why it happened:** Model reading is not exhaustive.
- **How it was fixed:** D-39: code re-adds brand, OS, processor maker, graphics and refresh-rate wishes the model missed, with a notice; the model's other needs are never overridden.
- **How it was verified:** Live check: 6 laptops under 60,000 excluding HP matched local tests.
- **What remains:** Only listed attribute types are re-checked.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #11; D-39

### F-036. Owner-voice question sent to brand insights

- **When:** 13 Nov, round 4
- **Theme and area:** Router and reading / router / model
- **Severity and status:** Medium; Fixed
- **What the problem was:** "What do owners say about the Macbook Air M1 battery" was routed to brand insights.
- **How it was found:** Real Gemini output.
- **Why it happened:** One prompt covers many flows (D-07) and the model misread the intent.
- **How it was fixed:** Prompt rule plus a code guard that trusts the rules reader on clear compare and owner-voice requests.
- **How it was verified:** Live: 234 MacBook opinions returned.
- **What remains:** Router accuracy per flow not measured at scale.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #12

### F-037. Gate and lookups ran one after another

- **When:** 13 Nov, round 4
- **Theme and area:** Model and latency / latency
- **Severity and status:** Low; Fixed
- **What the problem was:** The safety gate was slow on several cards.
- **How it was found:** Timings.
- **Why it happened:** Sequential checks.
- **How it was fixed:** Cards and lookups are checked in parallel; per-stage timings added.
- **How it was verified:** Gate about 0.6 s, database part about 1.1 s.
- **What remains:** Gemini dominates the total.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #13

### F-038. A "style: stylish" criterion from the model appeared as an unsupported item

- **When:** 13 Nov, round 4
- **Theme and area:** Honesty and trust / honesty / router
- **Severity and status:** Low; Fixed
- **What the problem was:** The model emitted a style attribute that showed as an unsupported line next to the looks stand-in.
- **How it was found:** Real Gemini output.
- **Why it happened:** Model emitted a non-catalog attribute.
- **How it was fixed:** Style attributes are dropped; the looks lens handles them.
- **How it was verified:** Tests.
- **What remains:** None.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #14

### F-039. The code read settings under names the database did not have

- **When:** 13 Nov, round 4 (found while writing docs)
- **Theme and area:** Honesty and trust / honesty / data
- **Severity and status:** High; Fixed
- **What the problem was:** A 65 percent battery was not flagged as a warning in the used-laptop check, and several limits silently used code defaults.
- **How it was found:** Writing the settings table of the runbook and comparing with the code.
- **Why it happened:** The code looked up setting names that migration data never created (for example the battery thresholds), and a missing key silently fell back to a default.
- **How it was fixed:** Code reads the stored names; migration 09 aligns the table and removes unused settings (D-46); a test fails if the code reads a setting that does not exist; regression tests for 65 and 75 percent.
- **How it was verified:** Applied to the live project and redeployed; 162 tests passed at that time.
- **What remains:** None known.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #16; D-46

### F-040. Spec-like claims labelled "service" skipped the catalog check

- **When:** 13 Nov, round 5
- **Theme and area:** Honesty and trust / honesty / router
- **Severity and status:** Medium; Fixed
- **What the problem was:** A claim such as "3 year warranty" tagged "service" by the reader was not checked against the catalog.
- **How it was found:** Real picture test.
- **Why it happened:** The check keyed on the reader's label.
- **How it was fixed:** Spec-like wording is checked whatever label the reader gave it.
- **How it was verified:** Tests; real model on a mock WhatsApp chat found 4 claims, one contradicted (16 GB claimed, 8 GB listed).
- **What remains:** Real-image accuracy across many images is unmeasured.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #25; 09_MULTIMODAL.md

### F-041. Shop search text repeated the brand ("APPLE APPLE 2020 Macbook...")

- **When:** 13 Nov, round 5
- **Theme and area:** Monetization / monetization
- **Severity and status:** Low; Fixed
- **What the problem was:** Where-to-buy links searched for a doubled brand name.
- **How it was found:** Live test of where-to-buy.
- **Why it happened:** Name already contained the brand; it was prefixed again.
- **How it was fixed:** Search text built without the duplicate.
- **How it was verified:** Tested.
- **What remains:** Links are search links, not product pages.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #24; 10_MONETIZATION.md

### F-042. Hidden instructions inside a picture (check that passed)

- **When:** 13 Nov, round 5
- **Theme and area:** Rate limit and security / security / images
- **Severity and status:** Medium; Verified (kept as regression)
- **What the problem was:** A mock listing carrying "IGNORE ALL PREVIOUS INSTRUCTIONS" was flagged and ignored by the vision model.
- **How it was found:** Real-model test.
- **Why it happened:** Not a failure; recorded as evidence.
- **How it was fixed:** The picture prompt says the picture is data, never instructions; kept as a regression test with a fake model.
- **How it was verified:** Real model, three images; 15 image tests.
- **What remains:** Accuracy on real images is unmeasured; the live end-to-end picture call is unproven.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #23; 09_MULTIMODAL.md

### F-043. Used and sell prices are sample assumptions; no stale-price warning

- **When:** 13 Nov, rounds 3 to 5
- **Theme and area:** Data and sources / data / honesty
- **Severity and status:** Medium; Open (labelled)
- **What the problem was:** The used-price band (30 to 75 percent of new) and resale factors are samples; a price recorded on 10 Nov 2026 is shown without any staleness warning.
- **How it was found:** My own gap lists.
- **Why it happened:** No real used-sale data; one price snapshot.
- **How it was fixed:** Labelled as sample assumptions; a freshness chip shows price age (D-56); the banner states the snapshot date.
- **How it was verified:** Settings USED_PRICE_BAND and RESALE are labelled; tests.
- **What remains:** A real staleness warning and real sale data are not built.
- **Source:** 05_BACKEND_BUILD_LOG.md s7; 06_OPERATIONS_RUNBOOK.md s5

### F-044. Gemini and Supabase setup steps that needed the owner, not the assistant

- **When:** 13 Nov, round 4
- **Theme and area:** Tooling and environment / tooling
- **Severity and status:** Low; Resolved
- **What the problem was:** supabase login failed when run with the ! prefix; the database password and keys could not be pasted in chat.
- **How it was found:** My own attempt.
- **Why it happened:** The login opens a browser and needs a real terminal; secrets must never be printed in chat.
- **How it was fixed:** Owner logged in from the Terminal app; the project was linked with the login only; migrations applied with supabase db query (no password); keys saved in a gitignored backend/.env and copied into Supabase secrets without printing, temporary files deleted; a random SESSION_SALT generated.
- **How it was verified:** Live endpoint answered; counts matched.
- **What remains:** See the migration history entry.
- **Source:** 06_OPERATIONS_RUNBOOK.md s2, s3

### F-045. Migrations applied with db query leave no migration history

- **When:** 13 Nov, round 4
- **Theme and area:** Tooling and environment / tooling
- **Severity and status:** Medium; Accepted gap (D-44)
- **What the problem was:** Supabase's migration history has no record of the migrations; a later supabase db push may try to re-apply them.
- **How it was found:** My own note when applying.
- **Why it happened:** Chosen route to avoid asking for the database password; data loaded through a CLI-based import adapter.
- **How it was fixed:** Documented; instruction to repair history if db push is used. Rule: new migrations are new files, old applied ones are not edited.
- **How it was verified:** Runbook s2 and s4.
- **What remains:** The history has not been repaired.
- **Source:** 02_DECISIONS.md D-44; 06_OPERATIONS_RUNBOOK.md s2

### F-046. Deployed backend was older than the code

- **When:** 13 Nov, round 4 (frontend build)
- **Theme and area:** Tooling and environment / tooling / process
- **Severity and status:** High; Fixed; lesson recorded
- **What the problem was:** Every direct action in the frontend's live check returned a generic "what do you want to do?".
- **How it was found:** Running the frontend API client against the live endpoint.
- **Why it happened:** The new direct actions had been written locally but the function had not been redeployed.
- **How it was fixed:** Redeployed; all nine request types returned renderable blocks. Rule: deploy after every backend change and run the live check.
- **How it was verified:** Live check of all actions; direct actions 1 to 2.5 s.
- **What remains:** Same class of problem later explained teammates' missing photos.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #17; 06_OPERATIONS_RUNBOOK.md s11

### F-047. A second request left the first turn stuck on "pending"

- **When:** 13 Nov, round 4
- **Theme and area:** Frontend layout and UX / frontend
- **Severity and status:** Medium; Fixed
- **What the problem was:** If a new request started while one was running, the first stayed pending forever.
- **How it was found:** A frontend test.
- **Why it happened:** The thread hook did not replace a running turn.
- **How it was fixed:** A new request replaces any failed or still-running one.
- **How it was verified:** Test plus timer handling.
- **What remains:** None.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #18

### F-048. Find screen had no brand list unless another screen had loaded the catalog

- **When:** 13 Nov, round 4
- **Theme and area:** Frontend layout and UX / frontend
- **Severity and status:** Low; Fixed
- **What the problem was:** The brand picker was empty on first load.
- **How it was found:** A frontend test.
- **Why it happened:** The catalog was loaded by a different screen.
- **How it was fixed:** The screen loads the catalog itself.
- **How it was verified:** Test.
- **What remains:** None.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #19

### F-049. Dev server unreachable: listening on IPv6 only

- **When:** 13 Nov, round 4
- **Theme and area:** Tooling and environment / tooling
- **Severity and status:** Low; Fixed
- **What the problem was:** The browser could not reach the dev server; also port 5173 was already used by something else.
- **How it was found:** Trying to open the app.
- **Why it happened:** The server bound to IPv6 only.
- **How it was fixed:** Bound to 127.0.0.1 (not exposed to the network) on port 5199.
- **How it was verified:** App opened.
- **What remains:** None.
- **Source:** 05_BACKEND_BUILD_LOG.md s5 #20; transcript

### F-050. Own test traffic exhausted the rate limit during the live frontend check

- **When:** 13 Nov, round 4
- **Theme and area:** Rate limit and security / rate limit / tooling
- **Severity and status:** Low; Worked around
- **What the problem was:** 18 requests in under a minute from one address were limited while checking the app against the live endpoint.
- **How it was found:** The check itself.
- **Why it happened:** The limiter did its job; all test traffic came from one address.
- **How it was fixed:** Waited for the window, paced the checks; a development-only mock mode (?mock) preloads the catalog so screen reviews make no live request.
- **How it was verified:** Live check passed paced.
- **What remains:** Classroom or group demo needs higher limits (runbook s6).
- **Source:** transcript; 11_FRONTEND_DESIGN.md s0

### F-051. The rate-limit message repeated itself and showed minutes as seconds

- **When:** 13 Nov, round 5
- **Theme and area:** Rate limit and security / rate limit / frontend
- **Severity and status:** Medium; Fixed
- **What the problem was:** Owner saw the hourly-limit screen: "Please wait 682 seconds... You can try again in 672 seconds". Owner asked what it was.
- **How it was found:** Owner's own use after the assistant's testing had used the hour's 60 requests from the same address.
- **Why it happened:** Two messages were joined, and the wait was shown in seconds. The limit itself was correct (60 an hour per visitor; testing traffic shared the address).
- **How it was fixed:** New copy: "You have sent a lot of requests from this device, so I need a short break. You can ask again in 11 min 22 s. What you typed is kept."; a countdown button "Wait 11 min 22 s"; backend message redeployed.
- **How it was verified:** 209 backend and 183 frontend tests passed.
- **What remains:** Limits not loosened by the assistant (permission check blocked it; the owner can change them with the SQL in the runbook).
- **Source:** transcript; 06_OPERATIONS_RUNBOOK.md s6

### F-052. The request log said "ok" for requests that had failed softly

- **When:** 13 Nov, round 5
- **Theme and area:** Logging and privacy / logging
- **Severity and status:** High; Fixed
- **What the problem was:** Of the first 44 logged requests none showed a problem even though Gemini had timed out, the reasons writer had fallen back to template text and live search had errored.
- **How it was found:** Owner asked for a log of queries and failures; the assistant read the existing table.
- **Why it happened:** One thin row per request recorded flow, outcome and time only, and soft failures were swallowed.
- **How it was fixed:** D-53: stage tracking, error_stage and error_message for hard failures, detail.failures and model attempts for soft ones, request_id on every reply, views (v_failures, v_stage_failures), a command-line viewer (npm run logs), 30-day retention. D-54: browser-side failures (no connection, timeout, crashed screen) reported without typed text; an error boundary replaces a blank page. D-55: log tables and views are server-only; rate-limit hits logged once per window.
- **How it was verified:** 15 backend and 10 frontend logging tests; later live log review found 12 timed-out Gemini attempts through the new fields.
- **What remains:** No alerting, no dashboard, 401s rejected before the function are not logged here.
- **Source:** 07_LOGGING_GUIDE.md; 02_DECISIONS.md D-53 to D-55

### F-053. Typed text was not stored, so failures could not be reproduced

- **When:** 13 Nov, round 5
- **Theme and area:** Logging and privacy / privacy / logging
- **Severity and status:** Medium; Reversed by decision (D-52)
- **What the problem was:** With no text in the log, a failure could not be reproduced and the reader's mistakes could not be found.
- **How it was found:** Owner's request for a log.
- **Why it happened:** Earlier stance: no typed text in logs.
- **How it was fixed:** D-52: scrubbed text (phones, emails, 12-digit IDs, links removed; 300 characters), 30 days, LOG_QUERY_TEXT switch; the About page says so.
- **How it was verified:** Logging tests: PII and links never stored.
- **What remains:** Pattern scrubbing can miss names or addresses; legal review pending.
- **Source:** 02_DECISIONS.md D-52; 07_LOGGING_GUIDE.md

### F-054. Owner needs to hear everything users type during testing

- **When:** 13 Nov, round 5
- **Theme and area:** Logging and privacy / privacy / logging
- **Severity and status:** Medium; Reversed by decision (D-71)
- **What the problem was:** Owner: "is the data getting saved? the inputs from the users getting saved??" and then "you need to listen and keep log of everything the users are typing". The assistant replied that only scrubbed text was kept and that nothing from real users existed yet (102 rows, almost all from testing).
- **How it was found:** Owner question and instruction.
- **Why it happened:** The scrubbed, truncated log hid exactly what testers typed.
- **How it was fixed:** D-71: a separate input_log table with the full text, written before rate limits, 30 days, never pictures; query_log stays scrubbed; the app says so; an npm run logs commands: inputs, isearch, export, tail (live tail with outcome line); exports go to a git-ignored folder, so raw inputs cannot be pushed.
- **How it was verified:** 229 backend tests; one end-to-end live test with a marked test message; logs exported before restart with counts matching (124 query_log, 15 input_log, 1 outbound_click, 27 demand_signal).
- **What remains:** Consent and legal review are open; people may type less honestly once told.
- **Source:** 07_LOGGING_GUIDE.md s8; 02_DECISIONS.md D-71

### F-055. Banner said "Course project / sample data" and the dataset's role was invisible

- **When:** 13 Nov, round 5
- **Theme and area:** Honesty and trust / honesty / frontend
- **Severity and status:** High; Fixed
- **What the problem was:** Owner: "why it says course project? we are showing real data and realtime data only right?? where are we using the dataset reviews?"
- **How it was found:** Owner question.
- **Why it happened:** The banner was vague. In fact only web reviews are live; prices are one snapshot of 10 Nov 2026 for 14 laptops, 0 of 29 versions are verified, and the 3,987 reviews have no dates.
- **How it was fixed:** D-56: the banner states the real situation, built from the DATA_STATUS setting refreshed by the import; each answer ends in a collapsible receipt (catalog snapshot, dataset opinions with a count, live web, AI used, re-checked); each price has a freshness chip; 08_DATA_AND_SOURCES.md explains where the dataset is used.
- **How it was verified:** No "Course project" wording left anywhere (checked); provenance tests (7).
- **What remains:** Banner depends on the data status setting being refreshed after imports.
- **Source:** 08_DATA_AND_SOURCES.md; 02_DECISIONS.md D-56; 05_BACKEND_BUILD_LOG.md #22

### F-056. No visible way the product earns money

- **When:** 13 Nov, round 5
- **Theme and area:** Monetization / monetization
- **Severity and status:** Medium; Built; nothing earned yet
- **What the problem was:** Owner: "where are you showing affiliate links? how are we earning money??"
- **How it was found:** Owner question.
- **Why it happened:** Affiliate revenue had been planned but no link surface existed.
- **How it was fixed:** D-60: Where-to-buy links for Amazon.in, Flipkart and Croma, labelled, counted, switched off for money until tags are set; never in ranking; identical answers with and without tags across all 75 inputs; structural test that ranking code never reads shop settings.
- **How it was verified:** 10_MONETIZATION.md; 9 monetization tests.
- **What remains:** Tag fields are empty; programme rates and terms unconfirmed (to-do 11.2).
- **Source:** 10_MONETIZATION.md; D-60

### F-057. Multimodal input and output were missing

- **When:** 13 Nov, round 5
- **Theme and area:** Images / images / voice
- **Severity and status:** Medium; Built; partly unproven
- **What the problem was:** Owner: "the whole product to be able to take multimodal inputs and outputs".
- **How it was found:** Owner request.
- **Why it happened:** Only typed text was supported.
- **How it was fixed:** D-57 to D-59: pictures read by Gemini vision into fields, validated in code, shown back, then checked against the catalog (never stored or logged; 6 an hour, 200 a day, 700 KB); browser voice in and out; WhatsApp, copy and Save-as-picture sharing.
- **How it was verified:** 15 image tests; real model on three images.
- **What remains:** Live end-to-end picture call unproven (blocked by own rate limit); accuracy on real images unmeasured.
- **Source:** 09_MULTIMODAL.md; 05_BACKEND_BUILD_LOG.md s7

### F-058. Radar label cut off and the voice-consent box took space

- **When:** 13 Nov, round 5
- **Theme and area:** Frontend layout and UX / frontend
- **Severity and status:** Low; Fixed
- **What the problem was:** The radar's left label ("Owner mood") was clipped; the consent checkbox filled the screen before anyone used the mic.
- **How it was found:** Headless Chrome screenshots of the first redesign.
- **Why it happened:** No margin on the chart; consent shown up front.
- **How it was fixed:** Label shortened and margin added; consent now appears when the mic is first tapped.
- **How it was verified:** Re-photographed.
- **What remains:** Dark mode and Hindi, Telugu and Tamil interface text unseen.
- **Source:** 11_FRONTEND_DESIGN.md s5

### F-059. First redesign only changed colours; too many fields

- **When:** 13 Nov, round 5
- **Theme and area:** Frontend layout and UX / frontend layout
- **Severity and status:** High; Fixed (version 3)
- **What the problem was:** Owner: "I asked you to change the frontend, you changed just the colors... too many fields". Nine tabs and 31 form fields remained.
- **How it was found:** Owner review.
- **Why it happened:** The first pass restyled screens instead of rethinking structure (the assistant's own words: the wrong fix).
- **How it was fixed:** D-63: five spaces (Ask, Explore, Check, Sell, You), tap tiles, a budget slider with histogram, faces, stars, chips, a picture drop-zone and a laptop map; one structured request per interaction; visible fields per screen cut (Check 10 to 1, Find 8 to 0, Share 8 to 3, Sell 5 to 1).
- **How it was verified:** 187 frontend tests; headless screenshots found and fixed an overflowing picker, a misaligned checkbox and wasted space on the map.
- **What remains:** Share now has one consent box covering 18+ and the notice; legal advice may require two.
- **Source:** 11_FRONTEND_DESIGN.md s0; D-63

### F-060. Result cards were not intuitive, did not use the space, and had no laptop images

- **When:** 13 Nov, round 5
- **Theme and area:** Images / frontend layout / images
- **Severity and status:** High; Fixed (version 4)
- **What the problem was:** Owner (with a screenshot): "Show the laptop images in the outputs... this is not at all intuitive and the output is not using the whole space".
- **How it was found:** Owner review.
- **Why it happened:** The catalog had no image URLs; card actions were three loose pills; results sat in a narrow column with a hidden Show more.
- **How it was fixed:** D-64 and D-65: pictures found once per model by Tavily image search and stored with site and "unverified licence" in laptop_image (13 models, 3 pictures each, all 14 variants), verified to be images naming the brand and model, shown with attribution, never fetched per request; drawn fallback; web_images kill switch. Responsive grid up to 1120 px with a featured top pick, spec tiles, three equal action tiles.
- **How it was verified:** 216 backend and 194 frontend tests; headless screenshots at phone and desktop widths.
- **What remains:** Hotlinked third-party images carry copyright and reliability risk; replace with licensed or affiliate-programme images before real users.
- **Source:** 11_FRONTEND_DESIGN.md s0b; D-64, D-65

### F-061. Market pulse and Brand insights used only the app's own data

- **When:** 13 Nov, round 5
- **Theme and area:** Data and sources / data / live
- **Severity and status:** Medium; Fixed
- **What the problem was:** Owner: they "should run through everything in the web and not just based on the data we have within the app".
- **How it was found:** Owner instruction.
- **Why it happened:** Both views were SQL counts over the dataset.
- **How it was fixed:** D-66: a separate "Live, not verified" panel from Tavily (India laptop market news from a trusted list; per-brand owner-experience pages with social media, the brand's own site and shop boilerplate removed); never counted, never ranked, cached 24 hours, counted against the daily limit, switchable with FEATURE_FLAGS.web_insights.
- **How it was verified:** 222 backend tests; one real check of two Tavily searches (India-relevant, dated).
- **What remains:** Web panel not visually reviewed (test data has web search off); excerpts unverified.
- **Source:** D-66; 08_DATA_AND_SOURCES.md

### F-062. UI style direction unclear; four-agent styling collided

- **When:** 13 Nov, round 5
- **Theme and area:** Frontend layout and UX / frontend style / process
- **Severity and status:** Low; Fixed
- **What the problem was:** Owner asked for a comic style sample and a choice, using named design skills. During the four-agent styling pass, one agent's run showed a failing media test ("Copy is blocked" wording) caused by another agent's copy change.
- **How it was found:** Agent reports on the shared board.
- **Why it happened:** Four agents edited related files at once.
- **How it was fixed:** Four samples built (comic-pop, sticker-zine, neo-brutal, soft-playful); owner chose soft playful (D-67); the later full run passed 196 of 196.
- **How it was verified:** Type check clean, 196 tests, build 80 KB gzip JS.
- **What remains:** Dark mode, a real phone, motion playing and the page transition were not confirmed.
- **Source:** 11_FRONTEND_DESIGN.md s0c; prototype/styles/

### F-063. Layouts judged cluttered and the experience "the worst"

- **When:** 13 Nov, round 5
- **Theme and area:** Frontend layout and UX / frontend layout
- **Severity and status:** High; Fixed (version 6)
- **What the problem was:** Owner: "I don't like the UI at all. It is very cluttered. Change the layouts... The UI style is okay". Audit baseline: Ask about 37 visible elements, result screen about 40, one card 28; scores Ask 21/35, card 16, compare 15.5.
- **How it was found:** Owner review, then an auditor agent.
- **Why it happened:** Style was applied to a structure that kept every element visible (card face carried radar, ring, three actions, source chips).
- **How it was fixed:** Three agents proposed different designs, an auditor scored them, they critiqued each other; the merge (prototype/ux/DECISION.md): one-screen Ask with 6 tiles and quick budget stops, a decision board with one hero plus compact rows, one tabbed Details sheet, a 3-column Compare with Hide same, trust line on every result, a one-line trust chip with an (i) sheet.
- **How it was verified:** Type check, 204 frontend tests, build (85 KB gzip JS), phone and desktop screenshots of Ask, results and compare; Ask about 14 groups against a budget of 16.
- **What remains:** Detail and Trust sheets, Explore, Sell later steps, You swipe, dark mode, a real phone not seen; Affiliate tag in the Detail sheet only shows when the receipt says so; language switch is voice only.
- **Source:** 11_FRONTEND_DESIGN.md s0d; prototype/ux/DECISION.md; D-68

### F-064. Design critique: swipe-only or one-at-a-time results hide comparison

- **When:** 13 Nov, round 5
- **Theme and area:** Honesty and trust / honesty / frontend
- **Severity and status:** Medium; Fixed in the design
- **What the problem was:** Proposals A and C used a one-at-a-time deck; the critics said you cannot compare five laptops blind.
- **How it was found:** Reviewer agents' cross-critique (A, B, C and the auditor all conceded).
- **Why it happened:** Those layouts favoured thumb reach over comparison.
- **How it was fixed:** Decision board kept all results visible; swipe-only decks rejected.
- **How it was verified:** DECISION.md records the agreement.
- **What remains:** None.
- **Source:** 11_FRONTEND_DESIGN.md s0d; prototype/ux/BOARD3.md

### F-065. Trust labels were buried in the proposals

- **When:** 13 Nov, round 5
- **Theme and area:** Honesty and trust / honesty / frontend
- **Severity and status:** High; Fixed
- **What the problem was:** Auditor: B's rows had no date, C's receipt was three taps away, A's trust pill was easy to ignore; the word "hero" or "Pick this one" could read as a buy verdict.
- **How it was found:** Auditor agent's risk list.
- **Why it happened:** Compact layouts removed labels to reduce clutter.
- **How it was fixed:** Trust line (price date, n, not human-verified) on every hero, card and row; hero labelled "Best fit for what you said"; receipt within two taps.
- **How it was verified:** Tests for the trust line.
- **What remains:** Not tested with buyers (D-68 revisit condition).
- **Source:** prototype/ux/BOARD3.md; D-68

### F-066. Price counted up from "₹0"

- **When:** 13 Nov, round 5 (reviewing agents)
- **Theme and area:** Honesty and trust / honesty / frontend
- **Severity and status:** High; Fixed
- **What the problem was:** Three reviewing agents reported a result card showing "₹0"; one also noted the shortlist fixture showed "₹0" where an unknown price should be "?".
- **How it was found:** Three reviewing agents; the assistant checked it directly.
- **Why it happened:** The count-up animation started at ₹0, so an intermediate number that is not a real price was on screen; the fixture issue for an unknown price is recorded by the agents.
- **How it was fixed:** D-69: the price is shown exactly as sent from first paint; the count-up was removed; unknown price is "?".
- **How it was verified:** All 196 tests passed after the fix.
- **What remains:** None.
- **Source:** D-69; transcript (agent reports)

### F-067. Parallel builders left the suite red while work was in flight

- **When:** 13 Nov, round 5
- **Theme and area:** Process and documentation / process
- **Severity and status:** Low; Resolved
- **What the problem was:** Builder 4 reported 16 failing tests (cards, Home/Ask, banner, Market link, Explore radar) that were not in its own files.
- **How it was found:** Agent reports.
- **Why it happened:** Four builders each owned separate files but tests spanned them while cards and shell were still being rewritten.
- **How it was fixed:** The assistant waited for all builders, then ran the full suite once; the final run had 204 of 204 passing, with tests rewritten where intent had changed.
- **How it was verified:** 204 tests green, type check clean.
- **What remains:** Not applicable.
- **Source:** transcript (agent reports)

### F-068. Photos of mid-range laptops all look alike

- **When:** 13 Nov, round 5
- **Theme and area:** Images / images / frontend
- **Severity and status:** Medium; Fixed (version 7)
- **What the problem was:** Owner: "all the images kind of look the same so add a visual element to actually understand the visual differences" and asked for an artifact before integrating.
- **How it was found:** Owner review.
- **Why it happened:** Silver lid on a white background; the data carries differences, the photos do not.
- **How it was fixed:** D-70 and section 0e: difference tags ("Lighter than 7 of 13"), a spec-driven portrait (lid width from screen size, base thickness from weight, vents for dedicated graphics, Hz badge), same-scale screens next to A4 in Compare, weight in one-litre bottles and position strips in Detail. A preview artifact was shown first. Tags need at least 5 laptops with a value; the 16:9 assumption and the not-drawn list are on screen.
- **How it was verified:** 11 frontend and 2 backend tests; hero card and Compare sheet seen in headless screenshots.
- **What remains:** Detail sheet strips and bottles not seen on screen (they were the sheet that later crashed); mid-range laptops with equal screen size still look alike.
- **Source:** 11_FRONTEND_DESIGN.md s0e; D-70

### F-069. Tests on a fake model missed real-service behaviour

- **When:** 13 Nov, rounds 3 to 4
- **Theme and area:** Model and latency / tests / model
- **Severity and status:** Medium; Mitigated
- **What the problem was:** All early tests passed (30, then 145, then 148) yet the first real Gemini and Tavily calls exposed misroutes, dropped exclusions, timeouts, a 429 and a hang risk.
- **How it was found:** First real-service tests.
- **Why it happened:** D-33 chose in-memory Postgres with a fake model and a fake live source (no network, no keys, no cost); fakes do not reproduce provider behaviour. D-33 itself named this as its revisit condition.
- **How it was fixed:** Real-service runs were added to the build order, and each finding became a code guard plus a test (see the router and model entries).
- **How it was verified:** Live checks of four real queries; 14-request burst test; real model on three images.
- **What remains:** Latency under load and cross-language accuracy are measured once or by a few manual checks only.
- **Source:** 02_DECISIONS.md D-33; 05_BACKEND_BUILD_LOG.md s3, s7

### F-070. Test-side mistakes mistaken for product bugs

- **When:** 13 Nov, round 3
- **Theme and area:** Tooling and environment / tests
- **Severity and status:** Low; Fixed
- **What the problem was:** Failures from an ambiguous laptop name in a test, a flagged-note test sharing a rate-limited session, a test that expected the old log row, and tests too crude after the About page repeated "never your text".
- **How it was found:** Test runs.
- **Why it happened:** The tests, not the product, were wrong (the assistant's own diagnosis in each case).
- **How it was fixed:** Tests corrected.
- **How it was verified:** Suites green (145, 15 logging, 209 final backend).
- **What remains:** None.
- **Source:** transcript

### F-071. Log review before user testing: Gemini timeouts and slow typed requests

- **When:** 13 Nov, round 5
- **Theme and area:** Model and latency / model / latency
- **Severity and status:** High; Open (mitigated by fallbacks)
- **What the problem was:** Across 102 requests (almost all the owner's and the assistant's testing): shortlist median about 7.7 s (worst 16.4 s), owner voice about 7.5 s, market pulse about 8.5 s; 12 timed-out attempts on gemini-3.1-flash-lite; four times the wording step fell back to template text; twice the rules reader answered.
- **How it was found:** Assistant ran the log commands on the live database when the owner asked to "run and check the logs".
- **Why it happened:** Free-tier or slow-model latency (assistant's stated most likely cause); the 3.5 s writer limit often expires. Not isolated further.
- **How it was fixed:** Answers stayed correct and honest through fallbacks. Recommended moving to a paid plan and comparing models; not done.
- **How it was verified:** Log review itself; no change in speed measured since.
- **What remains:** Owner decision: paid tier or model comparison before user testing.
- **Source:** transcript; 07_LOGGING_GUIDE.md

### F-072. Picture reading through the live endpoint is unproven

- **When:** 13 Nov, round 5
- **Theme and area:** Images / images / rate limit
- **Severity and status:** Medium; Open
- **What the problem was:** The one live attempt returned image_unavailable in 1 ms with degraded: heavy_use.
- **How it was found:** Log review.
- **Why it happened:** The assistant's own testing had used the hourly allowance.
- **How it was fixed:** Not fixed; the real model had been tested locally on three images.
- **How it was verified:** None yet.
- **What remains:** Run one real image test once the limit clears.
- **Source:** transcript; 05_BACKEND_BUILD_LOG.md s7

### F-073. Log commands and live tail misbehaved in the session

- **When:** 13 Nov, round 5
- **Theme and area:** Tooling and environment / tooling
- **Severity and status:** Low; Worked around
- **What the problem was:** The failures, slow and client commands printed only usage text; a ! cd backend line failed because the shell was already in backend/; the live tail ended without warning twice.
- **How it was found:** Running them.
- **Why it happened:** The command and its number were passed as one quoted argument; the working folder had carried over; ! commands time out at 120 seconds and background runs were ended by the session.
- **How it was fixed:** Re-ran commands properly; advised running the tail in a separate Terminal window with npm run logs -- tail; added a file-writing tail (exports/live-tail-<time>.log).
- **How it was verified:** Tail worked when run properly.
- **What remains:** This session cannot hold a long-running process.
- **Source:** transcript; 07_LOGGING_GUIDE.md s8

### F-074. Details button crashed the screen (hooks order)

- **When:** 13 Nov, round 5 (owner test)
- **Theme and area:** Frontend layout and UX / frontend
- **Severity and status:** High; Fixed
- **What the problem was:** Owner screenshot: clicking Details, or the recommended-laptop links, showed the app's crash screen.
- **How it was found:** Owner test; then the assistant read the app's own crash reports in the log.
- **Why it happened:** When the "where it sits" strips were added to the detail sheet, one hook call was placed after an early return. The sheet starts empty and gets a laptop only on click, so React saw a different number of hooks between renders: "Rendered more hooks than during the previous render", three times at the owner's clicks. Earlier tests always opened the sheet with a laptop already set.
- **How it was fixed:** Moved the call before the early return; two regression tests: a component test (empty, then laptop arrives, then closed and reopened) and an app test following the owner's steps. Confirmed they fail on the old order.
- **How it was verified:** 217 frontend tests passed; the two new ones fail on the old code. Not clicked through by hand in a browser.
- **What remains:** Gap: no test opened the sheet from empty before; hooks lint rule not mentioned as added.
- **Source:** transcript; 07_LOGGING_GUIDE.md s5 (client reports)

### F-075. Where to buy hidden in the sheet that crashed, so affiliate links looked removed

- **When:** 13 Nov, round 5
- **Theme and area:** Monetization / monetization / frontend
- **Severity and status:** High; Fixed (button); tags still empty
- **What the problem was:** Owner thought the affiliate links had been removed.
- **How it was found:** Owner question after the crash.
- **Why it happened:** Two causes: (1) in the layout redesign the assistant moved Where to buy from the card face into the Details sheet, a design choice the owner never agreed to, and that sheet then crashed; (2) the tag fields for Amazon.in and Flipkart in settings are empty, so links are plain shop searches and the Affiliate label appears only when a tag is set.
- **How it was fixed:** A Where to buy button next to Details on the best-fit card (Owners say and Full check stay in the sheet); the test that asserted the hidden state was updated. No tag was invented.
- **How it was verified:** 217 tests.
- **What remains:** Owner must sign up (Amazon Associates India, Flipkart Affiliate) and supply the IDs; nothing earns until then.
- **Source:** transcript; 10_MONETIZATION.md

### F-076. Follow-up questions had no context ("Will this last for 8 years?" got "Which laptop?")

- **When:** 13 Nov, round 5 (owner test)
- **Theme and area:** Router and reading / router / frontend
- **Severity and status:** High; Fixed
- **What the problem was:** After a recommendation, "Will this last for 8 years?" and "The one you showed" were answered with "Which laptop?".
- **How it was found:** Owner test with a screenshot.
- **Why it happened:** Every request was stateless: the app sent only the new text, so "this" and "the one you showed" had nothing to point at.
- **How it was fixed:** D-72: the app attaches focus and shown (ids and names only, never what was typed); the server re-checks them against the catalog; a rule, not the model, decides if text is a follow-up (lifespan, why this one, upgrade, problems, suitability); the answer comes from catalog facts, owner counts and a labelled web search, never predicts years, never says buy, laptops only, says what "this" was taken to mean; "Asking about: <laptop> ✕" chip, a limits line and a "What I can and cannot say" note; buttons when several laptops are shown and none is in focus.
- **How it was verified:** 11 backend tests (detection table from the screenshot, context validation, no promise of years, web question text never leaves, ambiguity) and 14 frontend; live with the exact question; 239 backend, 232 frontend then 233.
- **What remains:** Only five question types; after a Compare there is no focus; each new laptop and topic costs one web search a day; clearing the chip loses the requirement context (raised again in Round 6).
- **Source:** 11_FRONTEND_DESIGN.md s0f; D-72

### F-077. Follow-up web results included the maker's advertising; one spec showed raw text

- **When:** 13 Nov, round 5
- **Theme and area:** Honesty and trust / honesty
- **Severity and status:** Low; Fixed
- **What the problem was:** A live test returned an asus.com marketing result for a lifespan question; memory_slots appeared as "not stated (slot count unknown)".
- **How it was found:** Live test and a failing backend test.
- **Why it happened:** The search did not filter the brand's own site; the stored value is text.
- **How it was fixed:** The maker's site is dropped for lifespan, problems and upgrade questions; unknowns are shown consistently as "?".
- **How it was verified:** Tests pass (238, then 239).
- **What remains:** Excerpt quality still varies.
- **Source:** 11_FRONTEND_DESIGN.md s0f; transcript

### F-078. Teammates' copies had no Show photo button

- **When:** 13 Nov, round 5
- **Theme and area:** Images / images / process
- **Severity and status:** Medium; Fixed (pushed in 03ff4d3)
- **What the problem was:** Owner: "why others who pulled the repo are not getting the show photo button".
- **How it was found:** Owner question; the assistant checked what was in the repo.
- **Why it happened:** The button appears only when the reply carries a photo. The 42 photo rows lived only in the owner's own Supabase laptop_image table (put there by a script needing the owner's Tavily key); a git pull does not bring a database, keys or a deployed function, and an older deployed function omits newer fields. With no photo the app showed only a drawing and gave no hint why.
- **How it was fixed:** Seed migration 20261114000019_seed_laptop_images.sql (the same 42 rows, insert only for laptops that exist, idempotent; applied to the live database, still 42 rows); drawing caption now "No photo on file for this laptop"; README "Set up your own copy" lists migrations, deployed function, keys and data imports, with a quick check.
- **How it was verified:** 239 backend and 233 frontend tests, including a no-photo test; seed re-run safe.
- **What remains:** Teammates must apply migrations, deploy and set keys; third-party image licences unverified.
- **Source:** git 03ff4d3; lapfit-project/README.md

### F-079. Secrets and raw inputs could have been pushed with the shared repo

- **When:** 13 Nov, round 5
- **Theme and area:** Logging and privacy / privacy / process
- **Severity and status:** High; Prevented
- **What the problem was:** Before pushing, the assistant had to make sure keys, .env files and raw-input exports did not go to the teammate-owned repo.
- **How it was found:** My own pre-push check.
- **Why it happened:** Raw log exports contain typed text; the frontend folder had never been committed so the push was large.
- **How it was fixed:** Everything staged was scanned for keys (none); .env is git-ignored; exports/ folder git-ignored; a Supabase project reference appears in a doc (an identifier, not a secret; owner told). A stray frontend/.vite cache folder was not pushed.
- **How it was verified:** Scan before staging; commit 1cd2bf5 and later pushes.
- **What remains:** Owner may want the project reference removed from the docs.
- **Source:** transcript; 07_LOGGING_GUIDE.md s8; 06_OPERATIONS_RUNBOOK.md s3

### F-080. Frontend is not online and ALLOWED_ORIGIN is open

- **When:** 13 Nov, rounds 4 to 5
- **Theme and area:** Tooling and environment / deployment
- **Severity and status:** Medium; Open
- **What the problem was:** Testers can only reach the backend through a locally run dev server; ALLOWED_ORIGIN defaults to any.
- **How it was found:** My own gap list.
- **Why it happened:** No public frontend deployment has been set up; waiting for the owner's go-ahead.
- **How it was fixed:** Not fixed. Runbook step to set ALLOWED_ORIGIN after deploying.
- **How it was verified:** None.
- **What remains:** Deploy the frontend, set ALLOWED_ORIGIN, raise rate limits for group sessions, move Gemini to a paid plan.
- **Source:** 06_OPERATIONS_RUNBOOK.md s11, s12

### F-081. No reviewer notification or admin screen for owner reports and claim verdicts

- **When:** 13 Nov, rounds 3 to 5
- **Theme and area:** Honesty and trust / process / honesty
- **Severity and status:** Low; Open (decided, D-42)
- **What the problem was:** Owner questioned why no webhooks or n8n were used; a new owner report would sit unseen.
- **How it was found:** Owner question ("why didn't you use any webhooks?").
- **Why it happened:** Nothing in scope pushes events and no reviewer channel is chosen; building automation without a destination adds cost and risk.
- **How it was fixed:** D-42: no webhooks in version 1; planned database webhook on a new report; D-16: offline jobs on Supabase Cron, Make only for connectors. Diagrams in 04_ARCHITECTURE_DIAGRAMS.md explain this.
- **How it was verified:** Documents.
- **What remains:** Reviewer queue, admin screen and scheduled jobs are not built; no alerting on failures.
- **Source:** D-42; D-16; 07_LOGGING_GUIDE.md s7

## Round 6: user testing of 14 Nov 2026

Found by real users in a test session (screenshots), plus two red-team critic agents for the recommendation items. Each entry: problem, cause, fix, check. Files are under `backend/supabase/functions/_shared` (B) or `frontend/src` (F). Everything below is deployed (backend) and built (frontend); tests: 301 backend, 263 frontend.

| # | Item | Cause (short) | Fix (short) |
|---|---|---|---|
| 1 | Cannot edit typed inputs or slider values | Sliders had no number field; sent messages were read-only | `SliderInput` (slider + typed field, accepts "80k", "1.5 lakh"); "Edit" on a sent message replaces that turn and drops later replies |
| 2 | The ask box was a sticky popup covering the reading area | Fixed full-width panel | A small "Ask a follow-up" pill that expands on click, focus or hover, collapses on Escape, outside click or after send |
| 3 | Clearing "Asking about" lost the needs; "change the budget to 80000" answered "That sounds stressful" | One state for focus; needs derived from the last reply; the router's distress rule and the model's tone label fired on a calm sentence; refinements only worked when the router chose shortlist | Three saved parts (needs, recommendations, selection) in session storage, sent with each request; `refineNeeds` re-runs the shortlist with "Updated: budget up to ₹80,000"; tone is honoured only when a code regex confirms it |
| 4 | Picture only: the same question forever | Two catalog laptops share one display name (FKL-02 and FKL-07), choice buttons only re-sent the name text, so it re-resolved to the same ambiguity | `ask_laptop` block: labels include price and id, choices carry `variant_id`, a typed name is accepted, and the original task (the listing in `base`) continues; an unresolved name goes to the web fallback, never the same question again |
| 5 | "Not in catalog" and nothing else | No fallback path | `web_laptop`: web search (name + fixed phrase only), a model reads specs into whitelisted fields and CODE keeps only numbers found in the snippet text within bounds, labelled "not verified". Found live: a one-year/India-only search returned nothing and an empty result was cached for 24 h; fixed (no date limit for spec lookups, empties never cached). Also a typed model number (3520) must appear in the match, else it is not that laptop (it had matched "Inspiron 15 5000 Series") |
| 6 | "Under 1.5 lakh" showed the cheapest first | `rank` paid a cheapness bonus and had no processor or graphics tier | Fit score from recorded RAM, storage, processor tier, graphics, screen, weight, battery, owner evidence (n >= 20), weighted by the stated uses; strongest in budget first, closeness to budget secondary; six sorts (Best fit, Closest to budget, Lowest/Highest price, Lightest, Most reviewed) with a plain note; `budget_note` when the budget is above or below everything; a small "a little over your budget" group only when little fits. Live check: study under 1.5 lakh now leads with the Ryzen 7 (₹66,990), then the MacBook M1 |
| 7 | A drawing shown instead of the photo | My own earlier change made the drawing the default | Photo is the default; the drawing is the fallback and one tap away |
| 8 | Details pane could not scroll | The docked desktop pane had no bottom edge, so it grew past the screen while the page behind was locked | `bottom: 0; height: 100dvh` and a flex child that may shrink and scroll |
| 9 | The laptop map was not understood | Raw scatter without plain axes or a purpose | Explore opens on a browsable board (budget field, brand and spec chips, sort, cards with tags); the map is a secondary "Value map" with plain axes, a labelled "more for your money" region and a visible list |
| 10 | Could not compare my own laptop | Compare accepted catalog ids only | `custom` laptops (bounded numbers, "(yours, as you entered)", "?" for blanks) and an "Add my laptop" form or saved laptops |
| 11 | A brand question was answered about the laptop on screen | The follow-up detector treated "reliable" as a laptop question | Brand, maker and general-laptop questions are never follow-ups |
| 12 | Check page layout bad ("I know more" beside the box) | Inline link in a flex row | Three steps (add the listing, which laptop, what you know); details collapsed below |
| 13 | "Which laptop are you asking about?" with nowhere to answer | A plain text reply | `ask_laptop` with buttons and a text box |
| 14 | Could only choose, not type, a laptop | Plain `select` | Type-ahead combobox with free text (India-only in Sell) |
| 15 | A slider and emoji faces together on one Sell step | Two unrelated controls on one step | Separate steps: age as a typed stepper capped by the launch year, condition as four described choices |
| 16 | Only "cracked screen" as a condition | Short fixed list | 16 labelled flags (sample factors) plus typed battery %, "what did you pay?" and a free-text note that is echoed and never priced |
| 17 | No price in Sell; checklist was tick boxes | The picker listed US catalog items with no rupee price; the checklist had state that did nothing | `needs_paid_price` and `paid_inr`; India-only picker; a bulleted checklist with "Copy list" and "Copy the whole plan" |
| 18 | No advice on how to get more money | Not built | `boosters` from rules (arithmetic in code), owner review counts (n >= 20 and >= 30% negative) and a labelled web search on resale trends |
| 19 | A purchase date of 2003 for a 2020 laptop | No date validation | `launchYearOf` from a year in the name or the processor generation (approximate); purchase date must not be future or before launch (one year of tolerance); a clear reason per laptop |
| 20 | Weak sorting and many recommendation loopholes | Found by two red-team agents (31 findings) | Fixed: cheapness bias, dropped RTX variant of a duplicate name, budget ranges ("between", "above", "50 to 70k"), "under 1.4 kg" read as a budget, budget 0/negative/NaN/strings reaching SQL, silent demotion of stated specs, no-match messages naming the blocking Must, a form with empty needs crashing. Rejected: budget 0 means no budget and says so. Open: brand-only phrasing and parent presets overriding typed values |

### Found while integrating
- Sort chips sent no needs (the cards block does not carry them): the server now uses the saved needs when only `sort` arrives.
- Catalog rows had no photo fields, so the Explore board showed drawings: added to the catalog list.
- The My laptops date message used a different field name from the one the screen reads: aligned.
- Launch years from processor generations are approximate (10th gen Intel is 2019 or 2020): one year of tolerance.

### Follow-up requests (14 Nov 2026, after the first round)
| # | Request | Cause | Fix |
|---|---|---|---|
| 21 | "First recommendation 90%, others 60%": show how well each satisfies the needs | Only an internal rank score existed; nothing was shown | `match` on every card: capability for the stated use measured against the strongest laptop in the whole catalog for that use (recorded values only; unknown earns nothing and is listed), blended 65/35 with the Shoulds/Nices met; shown as "NN% match" with a "Why?" list on the best fit and each row. The order also weighs owner opinions and budget closeness, so percentages are not strictly descending |
| 22 | Search is limited to the categories | A fixed list of 7 uses; unknown uses silently dropped, "architecture student using AutoCAD" read as plain "study", "stock trading... under 60k" rejected as not about laptops (the word "stock" in the off-topic list) | 10 more real-world uses with documented capability profiles (CAD, 3D/animation, data science, trading, music, streaming, online classes, accounting, kids, medical); "stock trading" is a laptop request while other stock questions are still declined; an unrecognised use ("bird watching") is said out loud: "I can't rank by ... directly, so I used general performance and your budget" |
| 23 | Selling should show my laptops automatically | The picker only offered the catalog or typing | The laptops saved in You appear as quick picks on step 1 of Sell; tapping one fills the laptop, the age from the purchase date and the price paid |

### Round 7: user testing, second session (14 Nov 2026)
| # | What the user saw | Cause | Fix |
|---|---|---|---|
| 24 | Explore: "Apple laptops under 1.5 kg" showed 0 of 14; confusing filters | The catalog list was cached in the browser from before weight, screen, market and photos existed, so the weight filter saw nothing; the layout never said which filter emptied the list or why filters exist | Cache key `lapfit.catalog.v2`, and a saved list is trusted only when its rows carry the new fields; Explore redesigned: purpose line, search box, filter bar with live counts and disabled empty options, removable active filters, a zero-result message naming the blocking filter with one-tap removal, unknown values never dropped silently ("N laptops have no recorded weight, so they are left out", with an "Include them" button) |
| 25 | Explore cards showed drawings, no photos | Same stale cache (no image fields) | Fixed by the cache version; the board reads `image_url` through `picOf` |
| 26 | Recommendations limited to the 14 catalog laptops | By design the catalog is small | `web_picks`: a live Tavily search (our fixed phrase, a budget rounded down and labels from our fixed use list, never the user's text) read by a model into candidates that CODE validates (name and every number must appear in the page text, over-budget and in-catalog items dropped, https links only, max 5, cached 24 h, never cached when empty); shown after the catalog results as "More from the live web (not in my catalog, not verified)"; Explore has "Search the web too" (`web_search_laptops`). Checked live: 5 real items in 7.6 s. Known gap: a Chromebook can appear for coding; the shared daily limit of 30 live searches is low for real users |
| 27 | Sorting did nothing and ran as a separate chat message; "Tell me what you need, or pick one" | The sort chips posted `{sort}` without needs, and every action appended a new chat turn | The cards block carries the cleaned `needs`; `replaceTurn` re-requests and replaces that reply in place (no new turn or bubble, scroll kept); the Understood panel's update and budget edits do the same; the server also uses saved needs when only `sort` arrives. Checked live: price, lightest and closest-to-budget reorder |
| 28 | Scrolling Details jumped to the Ask home after a few seconds | Not reproduced. Three real causes fixed: the sheet restored focus to its opener on every parent re-render; the chat scrolled to the end on first paint; and the most likely one, a dev-server full reload wiping React state | The sheet keeps `onClose` in a ref and restores focus only on a real close; the chat follows only new turns; chats (last 6 turns), route and the open Detail card are saved in session storage and restored on load; "New search" and "Start over" clear them |
| 29 | "Check a laptop I am considering" checked the MacBook Air M1 by itself | The four starter buttons sent canned example sentences ("Should I buy the Macbook Air M1?", "Suggest a laptop under 60k") | Each starter starts a guided step: pick or type the laptop, pick a budget, paste the seller's words, tick laptops to compare; nothing runs a canned example |
| 30 | Check page, step 3: misaligned fields, "years" wrapped to "yea / rs", "Check it" off-centre | The details grid had uneven label heights and a wrapping unit; the button sat outside the cards' column | One centred column for cards and button; units never wrap; fields and yes/no rows aligned |
| 31 | "Will I get this for a cheaper price later?" re-ran the search with a 15% lower budget ("Cheaper read as a budget of ₹51,000") | The budget-change reader ran before the follow-up reader and treated "cheaper" as an instruction | Questions about the laptop on screen are answered first; a new `price` follow-up answers with the one saved price (and says there is no history), a labelled general note on India's sale seasons (Big Billion Days, Great Indian Festival, Republic Day; "a pattern, not a promise"), and a live web search for current deals and price changes; it never predicts a price or says when to buy; "make it cheaper" and "show cheaper ones" still change the budget; a "Will the price drop?" chip was added |
| 32 | Compare with a laptop not in the catalog showed "?" in every cell, and the catalog laptops showed "not in catalog" for battery and more | Compare showed only what was typed or stored; the web search and the AI key were not used for the blanks | Gap filling: for the laptops you type, and for catalog laptops with blanks, a web search (deeper for typed laptops, cached 24 h per name) is read by the model and every number is checked against the page text by code; found values show "(from the web, not verified)" and the sources appear below; nothing found shows "not found online", a name with no model number says "name too general: add the model number", a paused search says "web search unavailable right now", and rows that cannot be searched for your own laptop say so. No number is ever invented. Checked with the real keys: the Zenbook's price and an MSI's battery (52.4 Wh) were found. Known limits: only the compare table is gap-filled so far (cards, Detail and Explore still show "?" where the catalog lacks a value), and snippets rarely list batteries |
| 33 | Compare table cramped; the first laptop column clipped | Fixed-width calculations tied to a 440px width let the label column cover the first laptop | Columns share the sheet's width equally and it scrolls sideways only when 120px per laptop does not fit |
| 34 | Gemini's free tier is limited (timeouts, 429 and 503 seen in the logs; inputs may be used by the provider) | One provider | `AnthropicClient` (Claude Messages API, pictures supported) added after the two Gemini models in the chain; it is used only when both Gemini attempts fail and only if `ANTHROPIC_API_KEY` is set; each attempt is logged with its model; the About page and the picture consent name Claude as the backup reader. Tests: request shape, picture block, error codes, fallback order, Claude untouched while Gemini works |
| 35 | First real call to Claude failed with HTTP 400 | The tests used a fake; the real API rejects `temperature` for the current Claude models ("temperature is deprecated for this model") | Removed it; a test now asserts it is never sent. Verified with the real key: with Gemini deliberately broken, Claude read a Hinglish request correctly in about 3 s |
| 36 | Claude would almost never get a turn | The logs show Gemini fails by being slow (4 s timeouts), and two slow attempts used the router's whole 8 s | Claude has its own 6.5 s time slot, Gemini attempts are 3.5 s, and the router budget is 13 s (migration 21). Cost: when Gemini is failing, a request can take up to about 13 s instead of falling back to the plain rules reader at 8 s |
| 37 | "Why are there only 14 laptops? There are hundreds or thousands on the web" | The catalog came from one review dataset (14 India laptops with dated prices and owner opinions); live web search added at most 5 extra items after the list | A second, clearly labelled tier: table `web_laptop` (migration 22) filled by a seeding script (brands x price bands x uses, Tavily search, a model reads pages into fields, code checks every name and number against the page text, restartable and credit-capped) and by every live search; recommendations take up to 8 stored web laptops first (ranked with the same fit score and match %) and search live only when fewer than 5 fit; Explore has "Catalog" and "From the web" tabs with real counts, paging, filters and Compare across both; every web laptop shows its source, price date and "not verified". First dry runs: 2 of 3 searches failed in the reading step (a reply cut off mid-list, an empty reply); fixed with a tolerant JSON reader and one retry with a shorter prompt (0 failures in the next 6 searches, 37 checked laptops for 6 credits) |
