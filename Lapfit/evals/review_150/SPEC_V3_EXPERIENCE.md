# v3.1 addendum: ideal outputs = the best user experience (Sri, 13 Nov)

The ideal output is **the reference the AI product is judged against**, so it must show the experience a user should actually get. It must not read like a log of what the system did. The repo rules in SPEC_V3 §3 still hold: facts only from the evidence context, under 20 reports means "not enough evidence", code status labels, no buy/don't-buy on used laptops, verdicts only from approved ledger rows, no "!".

Design sources: `Lapfit/04_experience_design.md` (goal → fear → next step, trust defaults, visual language) and the repo's UI conventions in `lapfit-project/ai-spec/04_FEATURE_SPECS.md` (cards with ticks, price with as-of date, n on every rating, affiliate footer).

## 1. Evidence context must carry what a great answer shows

The model never supplies a fact, so **links and images must be in the evidence context** before the ideal can show them. Add these to every catalog and evidence row, and keep everything fictional:

- **Catalog row:**
  - `image: https://lapfit.in/img/<name>-<colour>.jpg` (press image, licensed)
  - `colours: Silver, Midnight Blue`
  - `buy:` 1–3 offers as `<Store> ₹<price> (as of <date>) https://lapfit.in/go/<name>?s=<store>`, using LapFit's disclosed affiliate redirect.
  - Use fictional store names (StoreOne, StoreTwo, CityMart) or generic "Online store A". Never a real retailer domain.
- **Evidence row:**
  - `source: <SampleForum/owner report> https://lapfit.in/r/<id>` and `date`;
  - **one exact short owner quote** in double quotes, which the ideal may copy word for word.
- **Ledger row:** approver, date, sample size, and a link `https://lapfit.in/ledger/<id>`.

## 2. Shape of a user-facing ideal (SL, SO, BO, PC, UC, OV, SP, RG)

Write it as the rendered answer in light markdown, in this order. Leave out any part that doesn't apply.

1. **Answer first:** one or two warm, plain sentences that answer the question for *this* persona, in their language. Use no meta phrases ("as you asked", "in LapFit's order", "router", "flow", "chips", "too general to change").
2. **What I understood:** one short line the user can correct ("Budget up to ₹90,000 · for college and coding · light preferred · *tap to change*").
3. **The cards** (shortlist, second opinion, buy for others):
   ```
   ![Kadam14 in Silver](https://lapfit.in/img/kadam14-silver.jpg)
   **1. Kadam14** · Silver, Blue · **₹64,990** (as of 1 Nov 2026)
   16 GB · 512 GB · 1.4 kg · 14" ✓ budget ✓ 16 GB ✓ under 1.5 kg
   Owners: ★ 4.3/5 from 41 owners · "Battery easily lasts my college day" — student, 8 months ([source](…))
   Why for you: <≤25 words tied to their need> · Watch out: <one line with source>
   [Buy at StoreOne ₹64,990 ↗](…) · [StoreTwo ₹65,499 ↗](…)
   ```
4. **Proof:** exact quotes only when n ≥ 20; otherwise "Not enough owner reports yet (n = 7)". At least one source link per evidence claim.
5. **Flow-specific blocks:**
   - **PC:** a claim table (claim → status → why, with a source link).
   - **UC:** flags by level, the in-person checklist, and what can't be judged.
   - **OV:** filter chips, per-laptop counts with n, quotes, and a loosen offer.
   - **SP:** a value table, Do/Skip fixes with ₹, then the listing text in a quote block.
   - **BO:** a per-person or per-role card plus a total line.
   - **RG:** a friendly decline or clarify with 2–4 tappable choices.
6. **Next step:** at most 3 offers that fit the user's goal, written as buttons: `[Compare top 2] [Questions to ask the seller] [Share with Papa]`. For a clarify row, the choices are the next step.
7. **Footer:** "Prices change; check before paying. Links may earn LapFit a commission; it never changes the order."

- **Tone:** like a knowledgeable friend. Calm, specific and kind, with no jargon for novices, precise detail for developers, and reassurance plus honesty for anxious buyers.
- **Length:** 80–320 words, set by the content. Tables and cards are fine.
- **JSON rows (RT, MD, BI):** these are internal outputs, not user screens. Keep them schema-exact and correct, and review them for label accuracy only. A BI note should read like a sharp analyst's 2–4 sentences.
- **RG:** keep the final `EXPECTED ROUTER:` line. **SP:** keep the `EXTRACTION:` line.

## 3. Assertion hooks to add where relevant

- `[code] every shown card has an image URL and ≥1 buy link present in the evidence context`
- `[code] every URL in the answer appears in the evidence context (critical)`
- `[code] every quoted owner sentence is an exact substring of the evidence context`
- `[code] the answer includes the affiliate footer when buy links are shown`
- `[judge] the answer leads with a direct answer for this persona and offers a goal-fitting next step`
