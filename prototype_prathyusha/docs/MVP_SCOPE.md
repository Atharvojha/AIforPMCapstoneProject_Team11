# MVP_SCOPE — for Gate 1 approval (all numbers are **Proposals** unless marked)

> **Final state (2026-11-11, latest): read `FINAL_STATE_2026-11-11.md` first.** Product: five nav items (My needs · Find laptops · Check a listing · Check a claim · Compare; About in the footer). Headline feature: **Listing Lie Detector** (paste any listing; each claim checked or labelled "only the seller's word"; questions to ask the seller). Needs are a **needs sheet** (12 categories, levels, number scales, your edits win). AI = reads reviews, splits pasted listings, finds same-meaning reviews; every verdict is code. Evidence covers 14 Indian + 15 US evidence laptops. Team doubts and answers: `DOUBTS_AND_ANSWERS.md`.

> **Superseded in part by the 2026-11-11 pivot (see PIVOT_2026-11-11.md).**

**Core scenarios (D-039) — the interface must serve all five; nothing else gets a screen**
1. **Tell me what I need.** Type your situation in plain words ("CS student, coding and some video editing, ₹60k, light, good battery"). LapFit saves it as your needs and shows laptops ranked, each with a rating for every category.
2. **I don't know the specs.** Say only what you do ("I want it fast"). LapFit recommends the numbers (RAM, storage, processor level, weight, battery) with a one-line reason each.
3. **Is this claim true? (no laptop chosen).** "ASUS laptops are bad at holding battery" → brand average vs the rest, every model best to worst, example owner words. "I want a laptop with good battery" → suggestions.
4. **Tell me about this laptop.** One laptop: its ratings, problems, sources, one click from any result.
5. **This or that.** Compare 2–4 laptops side by side.


## 1. Entry points (MVP)
| Entry | Trigger | Required input | Next |
|---|---|---|---|
| Home → "Build my profile" | New/returning user | none | Adaptive interview |
| Home → "Check a claim" | Has a claim to verify | claim text + laptop (laptop optional → asks) | Claim ledger |
| Laptop search (direct) | Knows model | name/alias | Laptop report (uses saved profile if any) |
| Compare | 2–3 shortlisted | picks | Compare view |
| "Verify this" on any sentence in a report | Reading a report | context auto-passed (laptop, profile, sentence) | Claim ledger |
Needs-first search, profile dashboard and URL-paste: **Next**.

## 2. Result-page information architecture (Scenario A) — decided: option "Gate-first"
Alternatives considered: (1) fit-breakdown-first; (2) split "works / may fail"; **(3) Gate-first (recommended)**.
Order: ① Identity + variant confidence → ② **Requirement gate** (Met / Not met / Unknown + Spec mismatch flags) → ③ Dealbreakers & watch-outs (counts, quotes) → ④ Category ratings with coverage (label headline; numbers in drawer) → ⑤ Owner experience & disagreements → ⑥ Independent tests & specs (separate lane) → ⑦ What we don't know + seller/in-store checklist. Rationale: a missed dealbreaker costs most; evidence classes never mix.

## 3. Claim Checker IA — decided: "Evidence ledger" with verdict header
Header: status chip + one-line scope + coverage. Body: sub-claims, each with For / Against / Not applicable lanes, conditions table (claim vs evidence), "what this doesn't prove", "what would change this", checklist, share/copy.

## 4. Rules (deterministic; LLM never decides these)
**Review-evidence rules (from PRD):** dealbreaker = ≥2 independent, clear, applicable complaints on a stated priority; 1 = watch-out; <3 applicable reviews on a top priority → "Not enough evidence"; copies count once; disagreement shown, never averaged.
**Spec mismatch (D-011):** hard requirement vs spec source → Met / Not met / Unknown; Unknown never implies pass.
**Category rating engine (D-009):** categories = performance(CPU), memory, GPU, battery, display, thermals/noise, portability, keyboard/trackpad, ports, upgradeability, build/reliability, value. Per category: spec→score via requirement mapping; lab→score via thresholds with conditions; owner→Wilson lower bound of positive share over independent applicable reports (n≥3 else no score). Weights come from the profile (workload presets, student-editable). `Coverage = Σw(scored)/Σw(all)`. Headline label: Strong / Good with trade-offs / Weak / Not enough evidence; numeric shown only in drawer and only when coverage ≥ 60% (Proposal). Hard-requirement Not met overrides any label with a warning. No overall rank across laptops.
**Claim verdict ladder:**
- *Spec fact:* Supported/Contradicted by exact spec source; Insufficient if no source; "Manufacturer-claimed, unverified" sub-label if only OEM marketing.
- *Measured:* Supported only if ≥1 independent measurement under comparable conditions meets claim; Contradicted if comparable measurement falls short; Mixed if comparable measurements disagree; non-comparable conditions → Insufficient with explicit gap ("video playback ≠ coding").
- *Experiential:* needs ≥3 independent applicable reports; Supported/Contradicted if ≥ 2/3 agree and no strong counter-cluster; Mixed otherwise; Insufficient if <3.
- *Predictive:* decomposed; overall = weakest sub-claim, shown per sub-claim.
Confidence = rubric text (coverage, source diversity, variant match, recency), **not** a probability.

## 5. MVP features and acceptance criteria
| ID | Feature | Acceptance criteria (testable) |
|---|---|---|
| F12 | Adaptive interview + profile card | 6 workload presets; 2–4 follow-ups each; free-text → Pydantic profile; student can edit every field; invalid LLM JSON → fallback to presets; unit tests on parser |
| F06 | Requirement gate + SKU-trap | Every hard requirement shows Met/Not met/Unknown with source; sibling-listing reviews never pooled (test: HP Pavilion RTX3050 vs GTX1650); "upgraded RAM" review flagged as config mismatch |
| F03/F10 | Evidence ledger & disagreements | Every claim opens quotes; 100% quotes exact-substring; excluded reviews show reason; conflicting battery reports shown as two sides with conditions, no averaged number |
| F07/F08 | Category ratings + coverage map | Score reproducible from stored inputs (golden test); no score when n<3 or coverage<60%; empty cells visibly "no evidence"; methodology drawer lists weights |
| F09 | Bottleneck explainer | Names top-2 bottlenecks for profile with the evidence behind each; says "unknown" if no evidence |
| F15 | Compare 2–3 | Same section order; "what you gain/lose" derived from structured diffs; unequal coverage shown |
| F01/F02/F04/F05 | Claim Checker (5 attributes) | Router tags type; sub-claims listed; verdict from ladder; conditions table present for measured claims; ≥1 counter-evidence search always executed and reported (even if none found); "what would change" + checklist present; unsupported claim types return honest message |
| F11 | Dedup | Duplicate clusters computed; counts say "N reviews, M distinct" |
| — | Safety | Injection review (FK-ADV-01-style) ignored and flagged; AI failure → raw reviews fallback, never partial answer |
| — | Eval harness | Golden sets for fit, claims, retrieval, variant, extraction; metrics logged per run; regression gate (see Gate 3) |
**Headline demo claims (D-014):** "12 hours battery", "doesn't heat up", "RAM is upgradeable", "good for machine learning", "fan too loud for a library".

## 6. Journeys (to be mapped at Stage 2) & edge cases
Onboarding→profile; direct search→report; compare; open dealbreaker→evidence; why-excluded; Claim Checker blank vs from-report; low/conflicting/insufficient/failed states; share report (Next).
Edge cases: laptop with <3 reviews; two listings same model; review in Hinglish/shorthand ("Battery 5/5"); user asks to hide negatives (PDF ex. 09); review containing instructions (ex. 10); claim about unmeasured attribute; no profile yet; model offline.

## 6b. Open-world requirement (D-015, added after approval)
F16 Live research is MVP. Acceptance criteria: (1) any typed laptop name resolves to catalogue / live-research / not-found with a stated reason; (2) a live report shows which sources were fetched vs link-only, retrieval date, and never contains a spec not present in a fetched page; (3) fetches only from allowlisted domains, HTTPS, no private-network access (SSRF test); (4) injected instructions in a fetched page are ignored (test); (5) results cached by content hash; (6) offline/no-search-key → clear message, catalogue still works; (7) a non-laptop query gets a helpful scope message; (8) a claim about an un-held laptop triggers live research before a verdict, and the verdict shows 'researched live' + coverage.

## 7. Next / Later / Rejected
Next: parent share report, Trust page, correction loop, needs-first search. Later: answer-change tracing, community reports. Rejected: chat assistant, overall leaderboard.

## 8. Data readiness vs scope (honest)
Ready: owner reviews (14 listings, 3,300). Not ready: official specs & lab data (curation approved D-013), claim gold set, retrieval gold set (Stage 3). Risk: Claim Checker battery/thermal verdicts will often be Insufficient until curation lands (CH-004).

## 9. Reference reading (verified in master prompt / known official)
RTINGS methodology https://www.rtings.com/laptop/learn/how-we-test · RTINGS battery https://www.rtings.com/laptop/tests/performance/battery · Notebookcheck https://www.notebookcheck.net/ · Supabase hybrid search https://supabase.com/docs/guides/ai/hybrid-search · pgvector https://supabase.com/docs/guides/database/extensions/pgvector · SBERT retrieve & rerank https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html · Ragas metrics https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/ · Anthropic Contextual Retrieval https://www.anthropic.com/news/contextual-retrieval · Ollama https://docs.ollama.com/ · shadcn/ui https://ui.shadcn.com/docs · WCAG https://www.w3.org/WAI/standards-guidelines/wcag/
