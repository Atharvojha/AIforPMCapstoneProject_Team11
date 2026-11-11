# FEATURE_FLOWS — personas, sitemap, entry points, journeys, states (Stage 2 draft for Gate 2)

> **Final state (2026-11-11, latest): read `FINAL_STATE_2026-11-11.md` first.** Product: five nav items (My needs · Find laptops · Check a listing · Check a claim · Compare; About in the footer). Headline feature: **Listing Lie Detector** (paste any listing; each claim checked or labelled "only the seller's word"; questions to ask the seller). Needs are a **needs sheet** (12 categories, levels, number scales, your edits win). AI = reads reviews, splits pasted listings, finds same-meaning reviews; every verdict is code. Evidence covers 14 Indian + 15 US evidence laptops. Team doubts and answers: `DOUBTS_AND_ANSWERS.md`.

> **Update 2026-11-11:** sitemap is now **Find laptops (home) · Check a claim · Compare**, plus laptop detail, live-research progress and an About page (footer). "My needs", "How it works" and "Can you trust it" are no longer separate pages. Journeys: (1) type needs → ranked laptops; (2) open a laptop → evidence; (3) type a claim with any scope; (4) compare; (5) look up an unknown laptop.

**Core scenarios (D-039) — the interface must serve all five; nothing else gets a screen**
1. **Tell me what I need.** Type your situation in plain words ("CS student, coding and some video editing, ₹60k, light, good battery"). LapFit saves it as your needs and shows laptops ranked, each with a rating for every category.
2. **I don't know the specs.** Say only what you do ("I want it fast"). LapFit recommends the numbers (RAM, storage, processor level, weight, battery) with a one-line reason each.
3. **Is this claim true? (no laptop chosen).** "ASUS laptops are bad at holding battery" → brand average vs the rest, every model best to worst, example owner words. "I want a laptop with good battery" → suggestions.
4. **Tell me about this laptop.** One laptop: its ratings, problems, sources, one click from any result.
5. **This or that.** Compare 2–4 laptops side by side.


Status: **Proposal** until Gate 2 approval. Evidence-backed facts are marked ✓ (verified in data); example values are illustrative.

## 1. Personas (hypothetical, to be validated in the 5 student sessions — CH/customer kit)
| Persona | Situation | Drives which features |
|---|---|---|
| **Aarav** — CS undergrad Y2, ₹55–70k | Codes (VS Code, Docker), 20+ tabs, carries daily, needs 16 GB and 6 h battery | Requirement gate, bottleneck explainer, battery claim check |
| **Meera** — Design/media student, ₹80k | Photoshop/Premiere, colour-sensitive, mostly plugged in | Display & GPU categories, "good for X" predictive claim |
| **Rohit** — Budget-first first-year, ₹30–40k | Browsing, docs, video lectures; parent co-pays | Shortlist compare, plain-language report, parent view (Next) |
| **Dr. Sunita** — Researcher/ML postgrad | Local models, CUDA, long jobs | "Good for machine learning" predictive claim, VRAM/thermals |
| **Parent (secondary)** | Pays, can't judge specs | Share report (Next); wants sources and "what to ask the seller" |

## 2. Jobs → features
J1 "Which reviews are about me?" → profile + applicability + excluded-review reasons. J2 "Is this claim true for me?" → Claim Checker. J3 "Defend my choice to my parent" → share report (Next), checklists.

## 3. Sitemap (smallest viable navigation)
```
LapFit
├─ Home (search laptops · "Check a claim" · "Build my profile")
├─ Laptops
│   ├─ Results / suggestions
│   └─ Laptop report  (?profile=…)
│        ├─ Category drill-down (panel)
│        ├─ Evidence drawer (panel; tabs: Quotes · Why excluded · Source)
│        └─ "Verify this" → Claim ledger
├─ Compare (2–3 variants)  ← persistent compare tray
├─ Check a claim → Claim ledger
├─ My profile (profile card; edit)
└─ How it works (methodology · sources · Trust page / eval metrics)
```
Not in MVP nav: Saved reports/history, settings (Next). Rationale: five top-level items fit a phone bottom bar; compare lives in a tray, not a page of its own until 2+ items picked.

## 4. Entry points — every feature
| Feature | Where it starts | CTA label | Context passed | No profile? | Already viewing a laptop? | Shared link? | Exit / back | Next best action |
|---|---|---|---|---|---|---|---|---|
| Build profile | Home hero; banner on report; nav "My profile" | "Tell us how you'll use it" | none (or laptop being viewed) | this *is* the flow | returns to that report | prompts profile then opens report | Home / report | "See fit for [laptop]" |
| Laptop search | Home search; nav "Laptops" | "Search laptops" | query | shows results with a "personalise" nudge (non-blocking) | n/a | n/a | Home | open a report |
| Laptop report | result card; compare card; share link | "View fit report" | laptop id, profile id | report shows **generic view** (specs, evidence by topic, no fit labels) + "Personalise" | n/a | open generic view, offer profile | Results | Compare or Verify |
| Compare | tray after 2nd "Add to compare"; report header | "Compare (2)" | variant ids, profile | works; fit rows say "no profile" | current laptop pre-added | read-only | report | open a dealbreaker |
| Claim Checker (global) | Home second CTA; nav | "Check a claim" | none | works; predictive claims ask for use | n/a | n/a | Home | "Add to my notes"/share (Next) |
| Claim Checker (from report) | "Verify this" beside any sentence/chip | "Verify this" | laptop id, sentence → claim text, profile | works | **default** | n/a | back to the sentence in report (scroll restored) | return + next claim |
| Evidence drawer | any quote/count/claim chip | "See the reviews" | claim id | works | **default** | deep link `#evidence=ID` | closes to same scroll position | "Why were others excluded?" |
| Why excluded | tab in drawer; "N set aside" chip | "Why set aside?" | review ids | works | works | — | drawer | — |

## 5. Journeys (13 required) — happy path, then states
**J1 Onboarding & profile (adaptive interview, D-010).** Home → "Tell us how you'll use it" → pick 1–3 workloads (6 presets) → 2–4 follow-ups per workload (e.g., Programming: IDE/containers? tabs? local DBs?; AI/ML: local model size? GPU needed? cloud vs local?) → usage conditions (plugged vs unplugged, carry, quiet rooms, session length) → hard requirements (budget, RAM, storage, weight, battery h) vs priorities (rank top 3) → optional free text ("I also edit 1080p video on weekends") → LLM parses into profile card → **student edits/confirms** → saved to this browser. *States:* LLM unavailable → skip free text, presets still work; unparsable → show raw note beside card, don't guess; no hard requirement → warns that the gate will be empty.
**J2 Needs-first discovery (Next).** Profile → "Find candidates" → budget filter → catalogue shortlist. (MVP: browse the 14-laptop catalogue filtered by budget/RAM/GPU.)
**J3 Direct search.** Home search → typeahead on model/SKU/alias → results with identity chips (CPU/GPU/RAM/storage/price, **variant confidence**: listing-level / sibling / unknown) → open report. *States:* no match → suggest closest family and say "not in our catalogue"; ambiguous model name → ask to pick exact listing; pasted URL (Next).
**J4 Results & filters.** Filters: budget, RAM, GPU, weight, evidence coverage ("well-evidenced only"); sort: price, coverage, **no "best" sort**. Empty/partial states explained.
**J5 Open a fit report** (order from MVP_SCOPE §2): identity → requirement gate → dealbreakers & watch-outs → category ratings + coverage → owner experience & disagreements → independent tests & specs → what we don't know + checklist. *States:* analysis running (skeleton per section; spec/gate appear first because they are deterministic); AI failed → deterministic sections + raw reviews list, banner "AI analysis unavailable"; <3 reviews → "Not enough evidence" per category.
**J6 Compare 2–3.** Add to compare → tray → Compare page: same row order; rows = gate results, dealbreakers, category labels with coverage, "what you gain/lose vs the first". Different coverage is shown as a coverage bar per column; **no winner highlight**. *States:* one missing laptop data → column shows "not analysed" not blank.
**J7 Open a dealbreaker → evidence.** Click chip → drawer: claim, why it matters for *this* profile, N supporting reports (applicable, distinct), exact quotes highlighted, source link/ID, config & conditions, "what is unknown". Close returns to same scroll.
**J8 Why a review was excluded.** In drawer tab "Set aside (N)": each review with reason code (different variant · different use · duplicate · promotional · off-topic · instruction-like content · unclear context) and a "this is wrong" feedback action (→ eval candidate queue, F18 Next).
**J9 Claim Checker from blank.** "Check a claim" → laptop picker → claim text (examples chips: the five headline claims) → **clarify** (only if ambiguity changes the answer; e.g., "12 hours of what? video / browsing / coding"; brightness?) → router + decomposition shown ("We'll check: ① battery under video ② under browsing ③ under coding") → ledger. *States:* unsupported claim type → honest message + closest supported check; no laptop → asks; long-running → progressive sections.
**J10 Claim Checker from a report sentence.** "Verify this" on a sentence → pre-filled laptop/claim/profile → ledger → "Back to report" restores position.
**J11 Live research (MVP, D-015).** Any laptop not in the catalogue, or any claim needing newer evidence, offers "Research this laptop": identify exact SKU → search → permission/allowlist check → fetch or link-only → extract with validation → build the same report labelled "researched live" with fetched-vs-link-only counts and retrieval date. Progress shows per step; sections appear as they finish (specs first); Cancel always available. Offline/no key → clear message and catalogue-only results.
**J12 Hard states.** Low evidence ("Not enough evidence — here's what would settle it" + checklist); conflicting ("Two groups report different things — shown side by side with conditions"); unsupported claim; failed analysis (raw evidence fallback); model offline; empty catalogue match.
**J13 Share with parent (Next).** Report → "Share summary" → read-only page with plain-language summary, sources, seller questions; no private profile fields beyond what student chooses.

## 6. Claim Checker interaction detail (ledger)
Header: claim restated (scope + conditions) · verdict chip (Supported / Contradicted / Mixed / Insufficient) · evidence coverage · "Checked [date] against corpus vN".
Body per sub-claim: row with its own chip → For lane · Against lane · Not applicable lane (with reasons) → **Conditions table** (claim conditions vs each evidence's conditions; ✓ comparable / ✗ not comparable / ? unknown) → "What this doesn't prove" → "What would change this verdict" → checklist/seller questions → copy report. A line always states: "Counter-evidence search: ran; found N / none".
**Worked example (✓ real data, MacBook Air M1):** Claim "12 hours of battery life." Sub-claims: video playback — Apple claims up to 18 h (manufacturer; brightness 8 clicks from bottom); web browsing — Apple claims 15 h; Notebookcheck measured 16 h at 150 nits, **8.5 h at ~400 nits**; coding/campus day — **no independent test**. Verdict: **Mixed (condition-dependent)** — supported at moderate brightness web use, contradicted at max brightness, unknown for coding.

## 7. Edge cases (and handling)
Laptop <3 reviews; two listings same model (never pooled); Hinglish/shorthand ("Battery 5/5"); user asks to hide negatives (PDF ex. 09 → still shown, banner explains); review that instructs the AI (ex. 10 → flagged, set aside); claim about unmeasured attribute; no profile; LLM offline; very long review; duplicate text cluster ("1 of 14 identical reviews"); manufacturer-only evidence ("claimed, unverified"); sibling-only lab data (shown in a labelled sibling lane).

## 8. Analytics events (privacy-light, local logging in MVP)
`profile_started/completed(workloads,n_followups)`, `profile_edited(field)`, `search(query,n_results)`, `report_opened(laptop,has_profile)`, `gate_viewed(n_met,n_not_met,n_unknown)`, `evidence_opened(aspect)`, `excluded_opened`, `exclusion_disputed`, `compare_added/opened(n)`, `claim_started(entry)`, `claim_clarified`, `claim_verdict_shown(type,verdict,coverage)`, `counter_evidence_run`, `fallback_shown(reason)`, `share_clicked(Next)`. No review text or free-text profile content logged.
