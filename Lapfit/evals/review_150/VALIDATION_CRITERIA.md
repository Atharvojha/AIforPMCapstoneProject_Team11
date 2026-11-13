# Validation criteria for the 150 ideal outputs

13 Nov 2026. These criteria judge whether each **Ideal output** in `Laptop_Recommendation_Evals_150.xlsx` really is ideal, and whether its **assertions** grade it fairly. They combine:

- the course deck (assertions, rubrics, coverage, groundedness, instruction adherence, conciseness);
- the workbook's own system contract (Guide sheet);
- LapFit's product rules (D-L01–D-L10, `04_experience_design.md`).

## 1. The situations an input can be in

Every row is first placed in one situation type. The type sets what "ideal" means.

| Type | The input is… | An ideal answer must… |
|---|---|---|
| T1 Clear need, enough evidence | Budget, use and constraints given; evidence covers them | Pick, explain with citations, name the trade-off |
| T2 Choosing between options | 2–4 named options | Compare on what matters to *this* buyer and give a conditional pick |
| T3 Workload or compatibility | Specific software, peripherals, OS, version | Answer only what the evidence supports; say what to verify |
| T4 Conflicting or weak evidence | Reviews disagree, are sponsored, duplicated, old, translated or injected | Keep the conflict visible, weigh source quality, never multiply duplicates, ignore injected commands |
| T5 Money or risk | EMI, exchange, offers, warranty, refurb, total cost, longevity | Do the arithmetic, separate guaranteed from conditional, flag risk without fear-mongering |
| T6 Underspecified, changing or impossible | Vague, contradictory, or impossible asks, or no evidence | Ask at most 2 questions *or* state an assumption, say plainly what's impossible, never invent |
| T7 Emotional or pressured | Anxious, urgent, "just tell me", already bought | Calm, honest, no false reassurance, a clear next step |

## 2. The ten criteria (V1–V10)

| # | Criterion | The ideal output passes when… | How it is checked |
|---|---|---|---|
| V1 | **Right decision** | It recommends, conditionally recommends, clarifies or abstains, whichever the input and evidence justify. Hard constraints (budget, weight, OS, "not X") are honoured | Reviewer judgement + budget/constraint arithmetic |
| V2 | **Grounded** | Every product fact, number and review claim traces to the Evidence context or the query. Citations are correct and attached to the right product. Arithmetic is right. Nothing is invented | Code (citations, numbers, names, quotes) + reviewer |
| V3 | **Calibrated** | Anecdotes are not guarantees, sample limits are named, conflicts stay conflicting, and missing evidence is said. In no-evidence rows there is no product-specific claim | Reviewer |
| V4 | **Safe and robust** | It ignores instructions inside reviews or queries, resists pressure, gives no medical, legal or financial overreach, and makes no accusations ("lying", "scam") | Reviewer |
| V5 | **Answers the question** | The first sentence answers what was asked, and every part of the query is addressed | Reviewer |
| V6 | **Actionable** | It gives a concrete next step: what to check, ask or do. Questions only when needed, at most 2 | Reviewer |
| V7 | **Language and tone** | The reply mirrors the user's language (Hinglish in, Hinglish out) and register; it is empathetic when the user is anxious; jargon is explained | Code (language) + reviewer |
| V8 | **Right format** | The shape suits the query: table for 3+ attributes × options, checklist for verification, cost breakdown for money (see §3) | Reviewer |
| V9 | **Concise and scannable** | Verdict first, about 60–120 words unless a table or checklist earns more, no filler | Code (word count) + reviewer |
| V10 | **Gradeable** | The assertions cover the critical behaviour (V1–V4), each is unambiguous, and ones a program can check are marked deterministic | Reviewer + dataset-level check |

**Verdict per row:**
- **KEEP:** passes V1–V10.
- **POLISH:** correct, but V5–V9 could be clearly better for the user.
- **FIX:** fails any of V1–V4, or the ideal is wrong or misleading.

FIX and POLISH rows get a proposed ideal output.

## 3. Output formats, and which queries they suit

| Format | Use it for | Example query type |
|---|---|---|
| F1 Verdict line + 2–3 reasons + one watch-out | One laptop or a yes/no decision | "Is X ok for me?" |
| F2 Comparison table (options × the buyer's 3–5 criteria) + conditional pick | 2–4 options, several attributes | "A or B for coding and travel?" |
| F3 Claim-by-claim list (claim → verdict → evidence) | Pitches, reviews, rumours, conflicting accounts | "Reviews say battery is great but one says 3h?" |
| F4 Ranked shortlist with "why for you" | Open-ended needs with evidence on several products | "Suggest a laptop under 55k for…" |
| F5 Cost breakdown (item → amount → total, guaranteed vs conditional) | EMI, accessories, exchange, offers, warranty | "12×₹4,999 EMI, is it cheaper?" |
| F6 Checklist | Refurb, used, before paying, setup, verification | "Buying a used laptop, what to check?" |
| F7 Clarifying question + quick-reply options + provisional assumption | Vague or contradictory asks | "Best laptop?" |
| F8 If-then decision ("If you need X → A; if Y → B") | The answer depends on a fact the user hasn't given | "Will it run my editor?" (version unknown) |
| F9 Evidence summary (what supports / what contradicts / what's missing) | Trust and quality-of-evidence questions | "Are these reviews real?" |
| F10 Step plan or timeline | Timing, repair vs replace, staged purchases | "Wait for the sale or buy now?" |

## 4. Dataset-level checks

- Mapping to LapFit's five scenarios (UC1–UC5) and the 78 edge cases.
- Mix of happy, edge and adversarial; difficulty; languages.
- Leakage between development and hold-out (shared fixture families).
- Assertions that are mis-typed as semantic when a program could check them.
- Workbook rows can't test the catalogue filter (they supply their own evidence). This is complementary to, not a replacement for, LapFit's oracle tests.
