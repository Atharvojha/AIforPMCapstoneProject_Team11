# PRODUCT_BRIEF — LapFit (Stage 1 draft for Gate 1)

> **Final state (2026-11-11, latest): read `FINAL_STATE_2026-11-11.md` first.** Product: five nav items (My needs · Find laptops · Check a listing · Check a claim · Compare; About in the footer). Headline feature: **Listing Lie Detector** (paste any listing; each claim checked or labelled "only the seller's word"; questions to ask the seller). Needs are a **needs sheet** (12 categories, levels, number scales, your edits win). AI = reads reviews, splits pasted listings, finds same-meaning reviews; every verdict is code. Evidence covers 14 Indian + 15 US evidence laptops. Team doubts and answers: `DOUBTS_AND_ANSWERS.md`.

> **Update 2026-11-11:** the product is now organised around five core scenarios.

**Core scenarios (D-039) — the interface must serve all five; nothing else gets a screen**
1. **Tell me what I need.** Type your situation in plain words ("CS student, coding and some video editing, ₹60k, light, good battery"). LapFit saves it as your needs and shows laptops ranked, each with a rating for every category.
2. **I don't know the specs.** Say only what you do ("I want it fast"). LapFit recommends the numbers (RAM, storage, processor level, weight, battery) with a one-line reason each.
3. **Is this claim true? (no laptop chosen).** "ASUS laptops are bad at holding battery" → brand average vs the rest, every model best to worst, example owner words. "I want a laptop with good battery" → suggestions.
4. **Tell me about this laptop.** One laptop: its ratings, problems, sources, one click from any result.
5. **This or that.** Compare 2–4 laptops side by side.


## Promise
> Find the laptop that fits the way you work, with evidence you can verify.

## Target user
A student / early-career buyer in India with 2–4 shortlisted laptops, a budget (~₹30k–₹1L), buying within weeks. Secondary: parent/co-payer who reads the report. (Source: Team 11 PDF.)

## Problem
Reviews are short, mixed-config, mixed-use and contradictory. The student can't tell (1) which experiences apply to them, (2) whether a claim is actually backed by evidence, (3) what is unknown. Missing a real dealbreaker costs ₹35k–₹1L; a false alarm drops a good laptop.

## Jobs-to-be-done
1. When I've shortlisted laptops, I want to know what owners **like me** ran into, so I can choose without rereading hundreds of reviews.
2. When someone (seller, YouTube, friend) makes a claim, I want to know if it's true **for how I'll use it**, so I don't buy on marketing.
3. When I must justify the choice to a parent, I want an explanation with sources, so the decision is defensible.

## Two core scenarios
- **A — Personalised fit & comparison** (profile → fit report per laptop → evidence → compare).
- **B — Claim Checker** (claim → router → verdict ladder → evidence ledger → what would change it).

## Differentiators (why not Amazon "Customers say" / a ChatGPT summary)
1. Applicability to *my* workload and exact variant, with an explanation for every excluded review.
2. Evidence classes kept separate (spec / lab / owner) with test conditions.
3. Deterministic rules for counts, thresholds, scores and quote checks; LLM only reads.
4. "Unknown" is a first-class result; silence ≠ good.
5. Reproducible evaluation harness shown in-product.

## Non-goals (MVP)
Training models; universal ranking or overall score (D-009); crawling Reddit/YouTube; price comparison/affiliate; fake-review detection at scale; general chatbot; community submissions.

## Success criteria (targets from PRD, to be *measured*, not assumed)
Dealbreaker recall ≥85%; false-dealbreaker rate ≤10%; 100% verbatim quotes and valid citations; correct "insufficient" handling; claim-verdict accuracy vs adjudicated set (target set at Gate 3).

## Decisions in force
D-001…D-011 (see PRODUCT_DECISIONS.md). Notable: rating policy B; adaptive interview; spec mismatch separate from review dealbreakers; Flipkart-14 backbone; one deep vertical slice.
