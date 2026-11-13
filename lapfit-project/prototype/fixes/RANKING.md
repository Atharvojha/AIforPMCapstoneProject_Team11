# Ranking and sorting (items 6 and 20)

Code: `backend/supabase/functions/_shared/rank.ts`, `flows/shortlist.ts`. Tests: `backend/tests/ranking.test.ts`.

## Why the cheapest came first
The old score paid a "price headroom" bonus (cheaper = higher), subtracted price in the study rule, and had no processor or graphics tier. Every 8 GB laptop tied on capability, so price decided and the Celeron won.

## Default order ("best")
1. Qualifying set = every Must met (SQL plus code; an unknown value never meets a Must), sold in India (market IN) and with a rupee price above 0. Sorting never changes this set.
2. Fit score, 0-100, from recorded values only: RAM, storage, processor tier (read from the recorded processor text: M-series 4, i9 5, i7/R7 4, i5/R5 3, i3/R3 2, Celeron/Pentium/Athlon 1, plus a small generation step; unreadable = no points), graphics (RTX 1.0, other separate 0.8, none 0; unknown 0), screen size band, weight, battery Wh (if recorded), form factor (convertible/detachable, when notes or drawing is asked). A missing value earns nothing and is never guessed.
3. Weights start from a base (RAM 3, CPU 3, storage 1.5, ...) and each stated use adds to them: study (RAM, CPU, battery), coding (RAM, CPU, storage), gaming (graphics 7), creating, travel (weight 4, battery 2.5). "value" (cheap words) adds a lower-price term, the only case where cheaper wins on purpose.
4. Plus: 6 per met Should, 2 per met Nice, owner-opinion lens bonus, and owner evidence only when n >= the minimum (sentiment plus a small has-evidence bonus). Thin evidence counts for nothing.
5. Only a budget given (no use, Should, Nice or non-budget Must): "more laptop for your money". The same capability score applies, and price proximity to the budget (up to 6 points, price / budget) is the documented secondary factor. It is used only in this case, so raising the budget does not reshuffle ordinary asks.
6. Ties: fit score, then price low first, then id. Fully deterministic.

## Sorts
`best`, `budget` (highest price first, i.e. closest from below; falls back to best with a note when no budget), `price_low`, `price_high`, `light` (unknown weight last), `reviews` (owner opinion count). Each sort is applied to the whole qualifying pool, then one variant per model is kept in that order, then the top 5. The cards block carries `sort {key,label,note}`, `sorts [{key,label}]`, `tie` (top two level on the ordering key), `budget_note`.

## Other behaviour
- Budget above the highest price: `budget_note` (also on `understood`). Below the cheapest: note plus the existing no-match with relax offers.
- Budget 0, negative, NaN, Infinity or unreadable text is dropped with a visible notice ("I ignored the budget you sent..."), numeric text and "1.5 lakh" are parsed in code, nothing but numbers reach SQL. Min above max says so.
- Fewer than 3 fit: a separate cards block `over_budget: true`, "A little over your budget (up to 15% more)", never mixed in, each card says how much over, not counted in `cards` returned for context.
- Gaming never fills the list with laptops without separate graphics when at least 3 have it (otherwise a notice).
- A same-model sibling variant that is not shown is named in the reasons ("Also sold as ... with RTX 3050 at ...").
- Reasons: the #1 line says which recorded specs it ranks on; the "N under your budget" saving line is replaced by "uses N% of your budget". A weight reason only at 1.5 kg or less. Unknown use words ("stylish") get a notice and no "for stylish" line.
- A Should none of the shown laptops meets gets a notice. A no-match lists "Blocked by: <Must>. On its own it leaves N laptops." plus the highest/lowest value for numbers; up to 3 relax offers.
- Title: "Top 5 of the 9 laptops within your budget".

## Findings rejected or deferred
- R1-4 (budget 0 = nothing fits): rejected. An empty slider or 0 means "no budget"; the page says it ignored it, and the title says nothing was filtered only when that is true. Budgets of 1 and 10,000 do say nothing fits.
- R1-12 reshuffle with budget: fixed by confining the proximity term to budget-only asks.
- R1-9 "travel" weight reason 1.7 kg: fixed (<= 1.5 kg only).
- R1-8: not renaming cards (catalog name text belongs to the catalog); the sibling line plus keeping the stronger variant under the stated use covers it. BE-A owns ask_laptop labels.
- R1-3, R2-1, R2-3..R2-7, R2-10..R2-12, R2-13 (form `needs: {}` crash in handler): parsing/router, BE-A. R2-2 parsing part: BE-A; the "no shown laptop meets your Should" and "Blocked by" messages are here.
- R1-11 "See all N": the title now says Top N of M; a see-all list is a frontend decision.
