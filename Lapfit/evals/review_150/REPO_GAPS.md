# Where the repo spec and the prototype code disagree (found while writing the v3 evals)

13 Nov 2026. In each case the eval ideal follows the **spec** unless marked "ideal follows the code". The affected rows say so in their Review notes. These are product/engineering fixes for the team, not eval problems.

## F01 Shortlist / F04 Buy for others (G1)

1. `MAX_SHORTLIST` 5 shows five cards; spec says three, expandable to five (Q-F01-2).
2. `relaxOptions` returns up to 2 offers; spec says name the one Must to relax.
3. The colour table lacks "midnight blue" and "graphite", so the code falls back to black, not navy (SL-04). Each wanted colour is checked separately (BO-03).
4. `buyForOthers` handles only parent and child. For "someone else" it re-asks the recipient, while spec Q-F04-6 says ask only the use (BO-06, BO-10, BO-12).
5. Team parsing problems:
   - No model fallback for messy tables (BO-07, BO-08).
   - `ROLE_USE` ignores the use column (BO-13).
   - Per-role Musts are dropped (BO-04).
6. Any non-normal tone skips the flow and returns a fixed empathy text with no laptops (SL-06, BO-11). The same issue appears in RG-13 and UC-10.
7. The budget question is asked only when everything is empty, so a use-only ask runs uncapped (SL-08).
8. "light" is treated as a travel use, not as a Should ≤1.5 kg (the vague-term map is still "New").
9. Model: `settings.js` uses `claude-haiku-5-5`; spec D-03 says a Gemini Flash-class model.
10. **Count requests are ignored (D-L14):** P1a has no field for "just one" or "only two", and `MAX_SHORTLIST` always shows the default. Add `needs.max_results` to P1a and have the card builder honour it (SL-07, RG-12).

11. `rank()` gives the GPU use-fit bonus even for a minor use ("thoda Valorant"), so it outranks the stated priority (SL-02).
12. x86/ARM, Linux support and RAM slots are not filterable, so ruled-out laptops still appear as cards (SL-09).
13. Brand exclusions ("no Bayro", "Daksh nahi") are not a P1 attribute, so excluded brands are ranked and linked (SL-10, BO-02).
14. Fixed questions and choices are English-only (F01.21/D-12); review 2 wants them in the user's language (SL-12, BO-12).
15. No provisional state: when a compulsory Must can't be verified, cards still read as matches with buy links (SL-13, RG-11, BO-04, BO-08).

## F02 Second opinion / Check the pitch (G2)

1. `ledgerLookup` has no expiry or status check, so stale verdicts would still show (PC-05).
2. `checkPitch` scores every claim against the first laptop named; spec Q-F02-2 says flag "this looks like a different laptop" (PC-07, PC-12).
3. Unknown version in a pitch: spec step 4 (ask) and F02.9 (compare with all versions) disagree. **The ideal follows the code and F02.9** (PC-15).
4. "1000GB" vs 1 TB = 1024 GB shows "Does not match the specs". **Review 2: the ideal now normalises 1000 GB ↔ 1 TB** ("Matches after unit normalisation"); the code needs that rule (PC-09).
5. `parseSpecClaim` has no rule for processor, GPU, refresh rate or panel ("Not in catalog"). It reads only the English word "year" ("2 saal" fails). `CLAIM_TOPIC` misses typos ("battry").
6. Alternatives are filtered only on the Musts the code supports, so an alternative without a GPU can pass a "GPU" Must (SO-11).
7. Name matching: the spec uses aliases plus trigram similarity; the code uses substring matching (SO-12).
8. Ledger matching takes the first hit, not the best match. The weight tolerance applies to pitch claims but not to Musts (SO-05). P3 (photos) is V1 only (PC-06, PC-14, PC-15).
9. `parseSpecClaim` has no processor or graphics rule although both are catalog columns; review 2 ideals match them from the catalog (PC-01, PC-14). The GPU Must (#6) is now a must-fix (SO-11).
10. New claim labels used by review 2 and missing from `flows.js`: "Does not match available evidence" (ledger verdict that contradicts) and "Not fully verified" (price claim with no MRP), plus "Matches after unit normalisation" (PC-01, PC-09).

## F03 Used check / Router (G3)

1. Rules R9–R11, R13, R14 and R19 are missing from `flows.js`. R4 only produces R5's text.
2. The code puts OS before price; the spec order is combos, price, battery, serial, OS.
3. Wording and level drift:
   - R5–R7 lack the "(sample range)" tag.
   - R12 lacks the middle-digits sentence.
   - R17 is "Check" in the code but "Note" in the spec.
4. Regexes that misread listings:
   - "serial: on request" counts as a stated serial.
   - "71% antunnaru" fails the battery check.
   - "cycle count" counts as battery health.
   - "Win 10" and spelled numbers are missed.
   - Text read from images skips the weight and OS checks.
5. `handler.js` drops the follow-up button after `not_laptop` and `out_of_scope_laptop` (RG-04, RG-06).
6. Links:
   - A link with other words goes to the router, and the user is never told the link was not read (RG-10).
   - A bare link skips the router with `meta.flow` "unreadable" (RG-09).
7. D-12 makes fixed flag text English-only, while rule 8 says reply in the user's language. The ideal uses a lead line in the user's language and English flags.
8. No rule flags advance payment to a remote or unverified seller; review 2 makes it the first critical flag (UC-07, UC-15).

## F05 Owner voice / F10 Brand insights (G4)

1. Heatmap: the spec hides cells under 5 and shows 5–19 as an early signal. `insights.js` and `app.js` hide nothing.
2. Demand: the spec suppresses groups under 20 searches (F10.8, F10.9); `demandSummary()` has no floor.
3. `normTopic` and `normPersona` silently map words ("sturdy" → hinge, "senior" → parent). The spec says unknown values are reported back (F05.3).
4. `ownerVoice` silently drops the laptop filter when a name matches more than one model, breaking F05.7.
5. P1f has no city or region field, and the region filter (F05.10) isn't built.
6. P7 output has no `ignored_instructions` field, and there is no brand-insights flow.
7. The filter bar offers only fixed windows and months, but `normFilters` accepts any number.

## F05 Review tagger / F06 Moderation (G5)

1. Neither P8 nor P5 has an `ignored_instructions` field. **Review 2 schema v2 adds** `prompt_injection_detected` (P8, P5), `taggable` + `rejection_reason` (P8) and `underage_or_consent_risk` (P5); `03_SYSTEM_PROMPTS.md` and the code need the same fields (RT-08, RT-11, MD-08, MD-12). Injection can only show up as P5 `spam` plus `reason`, or as P8's low confidence.
2. P8 has no "none" topic, so delivery or seller complaints have no honest label. The rows use null with low confidence (RT-11).
3. **Personal data gets past the code:** the `submissions.js` regex only matches 10 contiguous digits. Spaced numbers, numbers written in words and "at gmail dot com" all reach P5 (MD-02, MD-03, MD-15).
4. P5 has no field for duplicates, under-18 hints, health claims or very short notes. These go in `reason`.

## F09 Sell plan (G6)

1. All-unknown spread: the spec says 20%; `sell.js` counts 7 fields, giving 18.5%. **The ideal follows the code** (SP-02).
2. The timing note shows only the current as-of date; F09.11 asks for the fall and both dates.
3. The spec's own F09.7 example is off by ₹50 (it is ₹550, not ₹500).
4. The "It is barely used" note fires for any "not using" reason (SP-15). Review 2: the ideal no longer follows the code here.
5. "Find the original bill and box" fires even when the seller said there's no box (SP-13).

6. The default age of 24 months is applied silently; review 2 wants it labelled "Temporary assumption" and the range called a low-confidence placeholder (SP-02).
