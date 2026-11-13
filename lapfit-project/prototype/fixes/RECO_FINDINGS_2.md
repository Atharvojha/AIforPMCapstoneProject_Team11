# RECO red-team critic 2: constraints, follow-ups, edge cases

Method: real handleQuery, test DB, model null (offline rules reader) and the form `needs` path. Scripts: scratchpad t1..t5.mts. "Catalog" has 14 laptops, cheapest 27,490.

## Findings

### R2-1 HIGH. "under 1.4 kg" is read as a budget of INR 1,400
Input: `lightweight laptop under 1.4 kg`, `laptop under 1.4 kg`, `weight must be under 1.2 kg and budget 60k` (budget became 1,200).
Observed: budget_max_inr=1400 / 1200, zero matches, "cheapest laptop is 27,490, above your budget of 1,400", offer to raise the budget to 27,490. The weight is lost (lightweight became the fixed 1.5 kg Should). In the third input the real 60k budget is lost too.
Expected: "under N kg" is a weight constraint (Must when "must"/hard word, else Should); budget stays 60k. Why: a unit-less "under <number>" parse swallows kg, GB, inch.
Fix: in the offline budget regex require no following unit (kg|gb|tb|inch|"|hours|hrs|wh|hz) and parse "<n> kg" into weight_kg <= n; reject any budget under ~5,000 with a question instead of searching.

### R2-2 HIGH. Hard specs typed as text are silently dropped or demoted
Inputs and observed (offline reader):
- `laptop with 32 GB RAM under 30k` -> RAM is a Should, shows the 8 GB laptop, no sentence saying nothing has 32 GB.
- `16 GB RAM under 50k` -> 5 laptops, all 8 GB, listed as a result (cheapest first). Only the Should label hints at it.
- `laptop where RAM must be 16 GB under 50k` -> RAM constraint missing entirely from Understood; 8 GB laptops shown.
- `laptop under 40k weight must be under 1.2 kg` -> weight missing entirely, 3 laptops (1.7 kg) shown, no notice.
- `laptop under 50k with 15.6 inch screen`, `8+ hours battery`, `OLED`, `Linux`: silently ignored, no "I cannot check" notice (touchscreen and numpad do get one).
- Contrast: `32 GB RAM must, under 30k` works (Must, no match, offers).
Expected: a spec number the person states is either a Must/Should that shows in Understood, or an explicit "I could not read this: ..." notice. Never a silent drop. A Should that NO shown laptop meets should say so ("none of these has 16 GB").
Fix: spec parser accepts "must be", "needs", "RAM of N", "N GB RAM" as a requirement (Should at minimum), a final pass lists every number in the text that was not consumed and notices it.

### R2-3 HIGH. Budget ranges and "above" are wrong
- `laptop 50 to 70k` and `laptop between 40000 and 60000`: min lost (budget_min null), max 70000 / 40000 (the LOWER number for "between"!). Shows 27,490 laptops to someone who wants 50-70k; the 40-60k case caps at 40k and hides everything 40-60k.
- `above 70k laptop`: budget_max=70000 (inverted). Shows laptops under 70k.
- `laptop under 50k and over 80k`: silently keeps 50k, ignores the contradiction.
Expected: min/max parsed ("50 to 70k", "between", "50-70k", "above/over/minimum 70k" -> min), contradiction asked back.
Why: budget_min_inr exists in the schema and is never set offline.

### R2-4 HIGH. Weird/short budget phrasings fail
- `upto 55,000` -> clarify menu (not understood). `under 60 thousand rupees laptop` -> budget null, "tell me a budget" despite it being given. `mujhe 16 GB RAM chahiye 60 hazaar tak` -> budget 60000 OK but 16 GB shown only as Should and 27k 8 GB laptop first. `50k ke andar` works. Hinglish "bhai sasta laptop dikhao" ok.
- `laptop under -5000` / `under 0` -> budget null, falls to all laptops with a quiet "tell me budget"; `under 99999999999` -> budget 9,999,999 (clamped silently).
Fix: add "upto", "up to", "thousand", "hazaar", "hazar", "k tak", "lakh"/"lac" variants; negative/zero -> ask.

### R2-5 HIGH. Short refinements fall into the generic menu even with prior_needs
With prior_needs present: `lighter`, `something lighter`, `make it 80000`, `make it 80k`, `80000`, `80k`, `show me thinner ones`, `better battery`, `something with better display`, `not so heavy`, `actually for gaming`, `what if I spend 20% more` all return flow=clarify "What would you like to do?" (4 unrelated buttons). `I need a lighter laptop` works. The MODS regex needs fixed phrases and the router runs before them.
Expected: with prior_needs, a bare number is the new budget; comparatives (lighter, thinner, cheaper, faster, better battery) edit needs.
Fix: when prior_needs exists and offline route is clarify/unknown, try MODS + a bare-budget parse before the menu; add MODS for battery, display, "more budget", "remove the limit", "+N%".

### R2-6 HIGH. Distress classifier hijacks a calm budget change
Input (prior_needs set): `I can't take this, my budget keeps failing, change the budget to 80000` and `it's hopeless to find one under 30k, change budget to 80000` -> "That sounds stressful. Take your time..." flow=clarify, needs not changed. Regex `can't take (it|this)|hopeless|panic` in router.ts:224 fires with no check for an actionable request in the same sentence.
Expected: if text also contains a parseable budget/spec/command, act on it (optionally add a kind line). Distress-only replies only when nothing actionable remains. (Item 3 reported the same bug for a different wording; the regex path is still live.)
Fix: in offlineRoute and in handler line 205 skip the early return when parseBudget/spec parse found something; keep tone as a note.

### R2-7 MED. Budget words that do nothing are silent
With prior_needs (60k): `a bit more budget`, `remove the budget limit`, `I am worried about my budget, make it 70000` -> same 60k, same results, no notice. "remove the limit" should clear budget_max or ask. "make it 70000" with the word "worried" ignored the number.
Fix: every refinement must produce either a changed Understood or a notice "I did not change anything because...".

### R2-8 MED. Cheapest-first on vague or budget-only asks; sorting hides capability
`laptop around 60k` -> first card 27,490, 60k is not near-target. `maximum 1 lakh laptop` shows 27k first and the 86,990 MacBook last. `50k ke andar`, `16 GB RAM under 50k`, `laptop between 40000 and 60000`, `budget 1.2 lakh` all lead with the 27,490 Celeron. Same as item 6. Also bare `laptop` and `best laptop` put the 86,990 MacBook first with no reason (and "best" is not explained).
Note "around 60k" is parsed as a hard cap of 60k (fine) but no tolerance (e.g. 54-66k) is applied.

### R2-9 MED. No-match message does not say which Must blocked, and "closest" offers can be wrong
- `only Dell under 40k`: offer is `Drop "Brand: Dell". This adds 3 laptops` (it removes the brand; the real blocker is Dell's laptops cost more than 40k; raising the budget is the closest option and is missing). `only apple under 50k`: two offers, ok. `32 GB RAM must under 30k`: only offer is RAM 8 GB, i.e. dropping the requirement to the catalog floor; no "the most RAM in the catalog is 16 GB" honest line. `weight must be under 1.2 kg` from form: offer to 1.41 kg, good.
- Message "Nothing in the catalog meets every Must" does not name which Must reduces the pool to zero or give counts (e.g. "40 per cent of laptops are under 40k, only none are Dell").
Fix: add a one-line "Blocked by: <Must> (N laptops pass it alone)" and offer to relax the budget first when a brand Must is the only thing failing with price.

### R2-10 MED. "Brand" and contradiction handling
- `Lenovo only, and no Lenovo` -> keeps "Not Lenovo" silently (no contradiction question).
- `MacBook only under 1 lakh` -> flow second_opinion, "I could not find MacBook MacBook only in the LapFit catalog" (junk name, wrong flow; the MacBook Air M1 IS in the catalog and "only X" means a brand Must).
- `macbook under 50k` -> second_opinion card of the 86,990 MacBook with a failed budget Must row, then 2 unrelated cards; no sentence "this is above your budget".
- `Dell XPS 13 under 1 lakh` -> "I could not find Dell Dell XPS 13" (brand doubled). Web fallback is item 5.
Fix: brand-only words ("only X", "X only") with no model number -> shortlist brand Must. Remove duplicated brand in message. When the single shown laptop fails a Must, say so in text.

### R2-11 MED. Invented context in refinements
`cheaper and lighter` / `I need a lighter laptop` (prior needs coding) adds use case "travel" the person never said (Understood shows travel). "lightweight" the same (`use_cases:["travel"]`). The needs sheet then claims "Use: travel". Violates "never invent needs".
Fix: do not push a use case for a weight word; keep it as the Should only.

### R2-12 MED. "for my dad, 15.6 inch" overridden by the parent preset
`laptop for my dad, 15.6 inch, under 35000` -> notice "For a parent I assumed 14 inch or more and weight up to 1.8 kg" and Understood shows "Screen 14 inch or more". The typed 15.6 inch is lost (or at least not shown), Should "weight 1.8 kg" is a guess. `laptops for my team of 10 employees under 50k each` -> normal shortlist, team size ignored; `laptop for my parents and my team of 5` -> only asks the parent budget (the second recipient and count vanish). `gift for my sister under 60k` -> plain shortlist (not buy_for_others, no note). No tables per person.
Fix: user-stated values win over presets; list recipients; ask per recipient.

### R2-13 MED. Understood / form roundtrip leaks bad values
Form `needs` with budget_max_inr:-5, min 90000: handled but text says "budget of ₹-5". `budget_max_inr:"80000"` (string) accepted as-is and shows "b":"80000". `value:"abc"` Must -> shown as Must label "ram_gb abc" then dropped to notice (ok). `needs: {}` (missing arrays) -> "Something went wrong on my side" and a TypeError `reading 'filter'` in logs (500-like). Budget_min > budget_max not rejected.
Fix: run needs through cleanNeeds on the form path as well: coerce numbers, drop negatives, swap or reject min>max, default arrays.

### R2-14 LOW. Unsupported specs partly hidden
`laptop with OLED display`, `Linux`, `8+ hours battery`, `15.6 inch` give no "not in catalog" notice, whereas `touchscreen` and `numpad` do ("touchscreen yes" label is odd text). `dedicated graphics` is only a Should even though people say "I need". Phrases "must/need/have to" are the Must signal and are missing for RAM and weight.

### R2-15 LOW. First card claims
`under 40k` result for `laptop for coding` shows ASUS i3 first because of ranking, with `reasons`; not verified here. Prices "as_of" shown (10 Nov 2026), "Imported listing data, not human-verified" shown: OK. No US-market laptop appeared in any shortlist (all are India listings) — good. Determinism: identical input gives identical order (checked twice).

## Checked and fine
brand exclusion single/multiple (`not HP`, `no Apple`, `not HP and not Dell`), `only Lenovo`, `Lenovo or Dell`, `windows only`, `maximum 1 lakh`, `1.2 lakh`, `2 lakh`, `50k ke andar`, `increase/change the budget to 80000` (also the long sentence; prior Must kept), `make it cheaper` (15 per cent, said so), chips roundtrip needs->form needs gives same list, determinism, form weight Must with unknown values explains.

## Top 10 (rank order)
1. R2-1 "under 1.4 kg" read as a Rs 1,400 budget (wrong number, dead end).
2. R2-3 ranges and "above": min dropped, "between" uses the lower number, "above 70k" inverted.
3. R2-2 stated specs (16 GB, 32 GB, weight must) silently dropped or demoted with no notice.
4. R2-6 calm budget change treated as distress (regex fires before the request is read).
5. R2-5 short refinements ("lighter", "make it 80k", "80000") go to the generic menu.
6. R2-4 "upto 55,000", "60 thousand", negative/zero budgets mishandled.
7. R2-9 no-match message does not name the blocking Must; "drop brand" offer instead of raise budget.
8. R2-7 refinements that change nothing say nothing ("remove the limit", "a bit more budget").
9. R2-10 brand-only and MacBook phrasing routed to second_opinion with junk name.
10. R2-13 form needs validation (string/negative/min>max/missing arrays gives error).
(R2-8 sort-by-cheapest is item 6 already assigned; R2-11 invented "travel" use case and R2-12 parent preset overriding typed values follow.)
