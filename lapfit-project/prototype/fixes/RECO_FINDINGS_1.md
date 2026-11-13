# RECO red-team critic 1: ORDER and BUDGET (14 Nov 2026)

Method: real `handleQuery` against the test DB (offline, model null), `needs` form and text, scripts in the session scratchpad (c2..c6.mts). Catalog facts: 14 recommendable INR variants (FKL-01..14, min 27,490, max 86,990); 15 US `AMZ-*` rows have no INR price and are `recommendable=false` (correctly never shown). Only FKL-09 (n=196, 101+), FKL-11 (n=119), FKL-10 (n=234) have owner evidence; 11 of 14 have n=0.
Cause of most ordering bugs (rank.ts `rank`): score = shoulds*3 + nices + useScore + price_headroom 0.5*(1-price/budget) + evidence 0.5*(pos/(pos+neg)-0.5). `price_headroom` rewards the CHEAPEST laptop; the study rule also subtracts price/200000; no rule exists for CPU class, GPU class, RAM beyond 8/16, or "stylish". Evidence term is at most +-0.25 and is skipped when n<20.

## Findings

### R1-1 (HIGH) Study/office/default: the cheapest, weakest laptop is #1 at every budget
Input: needs {budget 150000, use study}. Same at 60k, 87k, 1 lakh, 5 lakh, and text "study under ₹1.5 lakh", "best laptop for studying".
Observed top 3 (price): FKL-12 Celeron 8GB/256 (27,490, n=0) / FKL-09 i3 10th gen (33,990) / FKL-11 Ryzen 5 5500U (46,999). The Celeron beats Ryzen 5 and the M1 MacBook Air (86,990, 234 owner opinions, 90% positive, never in top 5 for study at any budget).
Expected: with 1.5 lakh to spend, a stronger laptop (Ryzen 5 / M1) should lead; the cheapest should only lead when the budget is tight (<= about 1.3x its price).
Why: study rule gives +1 (RAM>=8) +0.5 (screen>=14) for ANY 8GB laptop, so the only differentiator is price (headroom + price/200000), which always favours cheap. CPU, evidence and storage are ignored.
Rule: add a capability score (CPU tier from cpu_family/generation, RAM, SSD, display) that is price-independent; make price a tie-break and a "fit-to-budget" term that peaks near 60-100% of budget, not at 0%. Never let a negative price term exist.

### R1-2 (HIGH) "Under budget" is rewarded as a reason; reasons say "₹1,22,510 under your budget"
Input: study, 1.5 lakh. First card reasons: "Costs ₹27,490, ₹1,22,510 under your budget of ₹1,50,000" and "8 GB RAM and a 15.6 inch screen for study". Every laptop gets the identical RAM/screen line, so reasons do not explain the order (#1 vs #3 have the same text but #3 is Ryzen 5).
Expected: reasons name what makes #1 better than #2 (processor class, storage, owner evidence). Saving money is not a reason for someone with a 1.5 lakh budget.
Rule: replace the savings line by a budget-fit line ("uses 18% of your budget" is neutral) and generate the use-case reason from the features that scored, including CPU.

### R1-3 (HIGH) Budget range in text is read as a max of the FIRST number
Input text: "laptop between 40000 and 60000 for coding". Observed: budget 40,000; top 3 FKL-09 33,990 / FKL-12 27,490 / FKL-14 38,990. The 51-59k laptops and the 27,490 below the 40k floor are both wrong.
Input "80k to 1 lakh" -> budget 80,000, top FKL-12 27,490 (floor ignored). "around 45000" -> hard cap 45,000, shows 27k first.
Expected: min 40k, max 60k (or for "around X": roughly 0.85X to 1.15X). The `needs` form with budget_min works (min 60k/max 150k returned 63.6k..86.9k), so the text parser (normalise/router offline path) drops the second number.
Rule: parse "A to B", "between A and B", "A-B", "around/about X".

### R1-4 (HIGH) Budget 0, 1 and negative: 0 is treated as "no budget"
Input needs.budget_max_inr = 0, text "laptop under 0". Observed: "5 laptops from the catalog (nothing was filtered)": M1 MacBook 86,990 first. Budget 1 / 10k / 20k correctly returns nothing + "cheapest is ₹27,490" notice. 
Expected: 0 must behave like 1 (nothing fits, say the cheapest is 27,490). It says "nothing was filtered", which is a false statement about a request that had a budget.
Why: `needs.budget_max_inr` is truthiness-tested in rank.ts, shortlist.ts (`open`, `if (needs.budget_max_inr)`), so 0 is falsy.
Rule: test `!= null` and `> 0` separately; budget <= 0 or NaN/Infinity -> ask for a valid budget, never "nothing filtered".

### R1-5 (MED) Garbage budgets: -5 prints "₹-" and an empty page; NaN/Infinity silently become "no budget"; string "1.5 lakh" crashes
Inputs: -5 -> notice "above your budget of ₹-"; 0.5 -> "₹0" then relax offers; NaN and Infinity -> 5 laptops "(nothing was filtered)"; "1.5 lakh" (string) -> SQL error `invalid input syntax for type numeric` surfaced as "Something went wrong on my side" (numeric string "60000" works).
Expected: validate type and range at the edge (finite number, 1..10,000,000), otherwise a calm "I did not understand the budget" with the field highlighted.

### R1-6 (HIGH) No near-budget or stretch visibility; tight budgets show 1 laptop
Input: study/any, budget 28,000 or 30,000. Observed: exactly one card, FKL-12 Celeron 27,490. Hidden: FKL-09 i3 + 512GB SSD at 33,990 (13% over a 30k budget, 196 owner opinions) and FKL-14 at 38,990. Budget 60k hides FKL-06 RTX 63,600 (6% over) and FKL-01/02/08 at 63,990-67,490; budget 45k hides FKL-11/13 at 46,9xx (4% over).
Expected: a clearly labelled secondary group "A little over budget (up to +15%)" with 1-2 stronger laptops and "₹3,990 over", never ranked above in-budget picks, never mixed in silently.
Rule: after the main list, query rows with price in (budget, budget*1.15], label them as over budget, show how much.

### R1-7 (HIGH) Gaming ranking ignores GPU class; better GPU hidden; weak laptop in a gaming top 5
(a) Input gaming, 60k: #5 is FKL-12 Celeron (no GPU, 27,490) filling the list because only four gaming laptops fit. A gaming query is showing a Celeron as a recommendation with "8 GB RAM and 256 GB storage for gaming".
(b) Input gaming, 1.5 lakh: top 5 = FKL-08 (66,990), FKL-03, FKL-05, FKL-04, FKL-07 (all GTX 1650-class). FKL-06 MSI RTX 3050-class (63,600) and FKL-02 HP RTX (67,490) are absent although RTX > GTX.
Why: `hasDedicatedGpu` is binary (+4) and the cheaper GTX wins on price_headroom (0.5*(1-p/b)).
Expected: RTX tier above GTX tier at similar price; a non-gaming machine should not appear under gaming, or at least must be flagged "not a gaming laptop".
Rule: gpu_class tier score (rtx3xxx=3, rtx2xxx/gtx16xx=2, other dedicated=1, none=0); for gaming use-case drop none-GPU rows unless fewer than 3 remain and then say so.

### R1-8 (HIGH) onePerModel silently hides the better variant of FKL-02 / FKL-07 (same name, different GPU and price)
FKL-02 and FKL-07 both display as "HP Pavilion Ryzen 5 Hexa Core AMD R5-5600H · 8 GB / 512 GB" (model_id 2). FKL-07 = 59,990, GTX; FKL-02 = 67,490, RTX 3xxx. `onePerModel` keeps whichever scores higher (always the cheaper FKL-07) and drops the other. In gaming 1.5 lakh the RTX variant is invisible, and in gaming 60k FKL-07 shows with no hint that a stronger sibling exists. The name on the card does not show the GPU, so if both are ever shown (compare, picked, "shown" context) the buttons are indistinguishable (this is the cause of the item-4 loop).
Rule: card name must include the differentiator (GPU or price) when two variants share a name; dedupe per model must prefer the higher capability for the use case, or show "also available with RTX 3050 (₹67,490)".

### R1-9 (MED) Unknown use cases are echoed as if understood: "stylish"
Input: use_cases ['stylish'], 1.5 lakh. Observed top 3: FKL-11 Ryzen 46,999 / FKL-10 MacBook / FKL-12 Celeron; reason text "8 GB RAM and a 15.6 inch screen for stylish". No USE_RULE matches, so the order is pure price headroom plus noise. No notice says "I cannot judge style yet". Similarly "travel": FKL-12 (1.7 kg) and FKL-13 (1.69 kg) get "Weighs 1.7 kg, which suits travel" while FKL-10 is 1.29 kg; 1.7 kg is not light.
Expected: unrecognised use -> notice "I cannot rank for 'stylish', ranking by general fit"; weight reason only when <= 1.5 kg.
Rule: whitelist use cases; unsupported ones produce a notice (as unsupported musts already do) and no "for <word>" boilerplate.

### R1-10 (MED) Thin evidence: n=0 laptops lead while the MacBook with 234 opinions never leads; evidence barely matters
Study 1.5 lakh: #1 FKL-12 has n=0, "Not enough owner evidence yet". FKL-10 (n=234, 210 positive) is outside the top 5. Evidence term max is +0.2 for a 90% positive laptop vs the price term spread of about 0.3 between the cheapest and a mid laptop. FKL-09 with 101 of 196 positive (53%) gets a bonus; n=0 laptops get neutral 0 so "no data" ties with "average".
Expected: with equal capability, a laptop with reviewed evidence >= 20 ranks above n=0, and the card says so. Never let n=0 beat n>=20 with positive sentiment.
Rule: evidence confidence multiplier min(1, n/50) on sentiment, plus a small "has evidence" bonus; surface "owner evidence: 234" on card 1.

### R1-11 (MED) Count in the title is the cards shown, not the matches
Input study 60k: title "5 laptops within your budget" while `understood.matched` = 9 (4 hidden), and for 87k+ matched=14. Title is accurate for what is shown but implies the list is complete; people reading "within your budget" cannot see that 9 fit.
Expected: "Top 5 of the 9 laptops within your budget", with a "See all 9" or sort chips.
Also: with budget 150k vs 87k vs 500k the SET changes (the MacBook enters at 100k for study, then drops out at 150k); the list is unstable when the budget grows (see R1-12).

### R1-12 (MED) Order flips as budget grows while nothing else changes
Study, #1..#5 by budget: 87k = 12,09,14,11,13; 100k = 12,09,14,11,13; 1.5 lakh = 12,09,11,14,13; (stylish) 100k includes FKL-10 5th, 1.5 lakh has FKL-11 first and 5 lakh FKL-10 first. Travel: M1 first at 87k-1.5 lakh, then at 5 lakh the 5th place flips 12/13. The price_headroom term is a ratio to the budget, so a bigger budget re-ranks laptops that never changed.
Expected: raising the budget should only ADD stronger options, not reshuffle the weak ones.
Rule: use the budget only as a filter and a fit band, not as a score slope.

### R1-13 (LOW) Ties: deterministic, but break by lowest price then id
Five identical runs (gaming 60k) give the identical order. Ties (FKL-04 and FKL-07, both 59,990) break by variant_id. Deterministic, good, but tie-break toward the cheaper contradicts "stronger first"; prefer capability, then evidence n, then price.

### R1-14 (MED) `sort` is ignored (current build)
With `sort` = best, budget, price_low, price_high, light, reviews the order is identical (12,09,11,14,13) and no chip/echo block is returned. Contract item 6 not yet implemented; BE-B to cover, test each sort including price_high (must put FKL-10 first) and that the title says which sort is active.

### R1-15 (LOW) Inverted min/max budget gives a confusing message
needs budget_min 100,000 > budget_max 50,000: "Nothing in the catalog meets every Must" and relax offers. Expected: "your minimum is above your maximum, did you mean 50k-100k?".

### R1-16 (LOW) Unknown price handling is untested in the live catalog
All recommendable rows have a price; US rows are filtered (recommendable=false) so they never appear. In code, `row.price_inr ?? 0` makes an unknown price sort as the CHEAPEST in the tie-break, and `price_headroom` is skipped (neutral) so an unpriced laptop would not rank last. Rule: unpriced rows are excluded from budgeted results or ranked last with "price unknown".

## Checked and fine
- US/no-INR variants are never recommended (market IN + recommendable=true filter), including with a 5 lakh or null budget.
- Budget 1/10k/20k: honest "cheapest is ₹27,490" notice and relax offers.
- Identical runs return identical order; "STUDY" is case-folded; duplicate use cases are not double counted.
- Must filters hold (RAM >= 16 returns only FKL-08; Apple under 50k returns nothing with offers).

## Ranked top 10 for BE-B
1. R1-1 cheapest/weakest first for study (capability score, price-independent)
2. R1-7 gaming: GPU tiers, no non-GPU filler
3. R1-3 text budget ranges ("between A and B", "A to B", "around X")
4. R1-6 near-budget (+15%) labelled section
5. R1-8 same-name variants (FKL-02/07): show GPU in the name, dedupe by capability
6. R1-4 budget 0 and invalid budgets must not mean "no budget"
7. R1-2 reasons must explain the order (CPU/evidence), drop "under your budget" as a reason
8. R1-10 evidence weighting (n>=20 outranks n=0 at equal capability)
9. R1-12 stop budget-slope re-ranking
10. R1-9 unknown use cases ("stylish") need a notice; travel reason only at <= 1.5 kg
(then R1-11 count wording, R1-14 sort, R1-5 string budget crash, R1-13/15/16.)
