# LapFit experience design: the journey from query to decision

13 Nov 2026 · Written from four seats: UX (flow), UI (screens), experience design (feelings and trust), and interaction design (what each tap does). Simulation: `sim/` (run `sim/serve.sh`, then open http://localhost:8765).

## 1. What a buyer is really doing

Nobody wants a laptop table. They want to **stop worrying and decide**. Every query carries a goal, a fear and a next step:

| Goal we infer | Typical words | Underlying fear | The next step they need | What LapFit offers (asked, one tap) |
|---|---|---|---|---|
| **Decide now** | "worth it", "good buy", "for 58k" | Overpaying, regret | Buy with confidence, or switch | Buy links (sources shown); "Draft the questions for the seller?" |
| **Check what I was told** | "salesman said", "is it true" | Being fooled | Know which claims to push back on | "Draft a polite reply to the seller?" |
| **Find options** | a situation, no laptop | Missing a better option | A short list to compare | "Compare your top 2 side by side?" |
| **Buy for someone** | "for my father" | Getting it wrong for someone I love | Get their agreement | "Make a simple summary to send to your father?" |
| **Used deal** | refurb, 16k, Grade A | Being cheated | Check before paying | "Make this a checklist for the shop visit?" |
| **Already bought** | "bought yesterday" | Regret | Reassurance or a return | "Show the return window steps?" |

**Behaviour principle:** answer first, then offer the one most likely next step as a question. Never more than three offers, and never one that only helps us.

## 2. Things that are always there, not offered

Trust is built by default, not on request (Sri, 13 Nov):

1. **Sources on every fact**, as a small line under each section: "Source: Flipkart listing title (2022) · 754 owner reviews (Zenodo 17612521)".
2. **Exact owner quotes**, word for word, with stars, the reviewer type when known, and "Read full review". A quote is never paraphrased into quote marks.
3. **Counts with every rating:** "61 of 90 owners happy (n=90)", shown as dots, so the sample size is *seen*, not read.
4. **Dates on every price**, with "check live price" when old.
5. **Buy links** whenever the goal is buying, labelled plainly (in the product, affiliate links that never change the order).
6. **What we could not check**, said in the same place ("Warranty type isn't in our data: ask in writing").

## 3. Visual language: show, don't tabulate

| Instead of… | Show | Why it works |
|---|---|---|
| "Weight 2.3 kg" | **Water-bottle scale**: 2.3 × 1-litre bottles, beside your Must line | Everyone has carried a 1 L bottle; weight becomes physical |
| "15.6 inch" | **Screen outlines drawn to scale**, overlaid when comparing; an A4 sheet as reference | Size differences are seen instantly |
| "8 GB RAM" | A **fill bar against the suggested number for your use** (red below, green at or above) | Ties the spec to the person's job |
| "Battery 6/10" | A **day strip, 8 am to 8 pm**, with owner reports marked as dots | "Will it last my college day?" answered at a glance |
| "Rating 4.1" | A **people-dot grid** (one dot per owner: green happy, red unhappy, grey mixed), with an "Owners like you" switch | Sample size and split are visible; Zomato-style relevance |
| A price | A **price strip**: your price against the listing price, with dates | Instantly shows whether it's above or below |
| Claim verdicts in rows | **Verdict stamps** (✓ ≠ ½ ?) on cards that flip to show the source and quote | Scannable, then provable |
| A product name | **Laptop render in its real colour**, drawn at its real screen size (illustration until licensed photos are wired in) | Recognition and focus; colours match the variant |

Photos: the product uses licensed images only (maker press kits or affiliate feeds). Until then the simulation draws each laptop from its data (screen size, colour, gaming keyboard), labelled "illustration".

## 4. The journey (same stages for every scenario)

| Stage | User feels | We show | Interaction |
|---|---|---|---|
| 1 Arrive | Unsure where to start | One box, three example prompts, and a trust strip ("Every claim has a source · quotes are word for word · ranking is never paid") | Tap an example or type |
| 2 Ask | Hopeful | Their words stay visible at the top | Enter |
| 3 Understood | "Did it get me?" | A plain sentence plus chips (Must, Should, Not) | Tap a chip to edit or remove; re-runs instantly |
| 4 Answer | Relief, if the answer comes first | **One-line answer**, then the visual hero (render, key visuals), then evidence | Scroll; tap to flip any verdict |
| 5 Proof | "Can I trust it?" | Quotes, dots, sources inline | "Owners like you" switch; Read full review |
| 6 Explore | Curious | Alternatives as mini renders; Compare overlay | Tick 2–4 → Compare |
| 7 Next step | Ready to act | One question plus up to 3 offers based on the goal | Yes → drafted message, links or summary, with Copy |
| 8 Leave | Confident | Saved answer; review status updates within 24 h | Save or Share |

## 5. Interaction rules

- **No modes**, as in Task 2. The goal is inferred from the words, and offers adapt to it.
- **One answer per turn**; sections appear together. Edits re-run in place, with no new card.
- **Questions only about facts**, at most two, with quick replies plus free typing.
- **Everything verifiable is one tap away**, never hidden behind a menu.
- **No dark patterns:** no fake urgency, no "only 2 left" unless it comes from a dated live stock check, and no pre-ticked offers.
- **Same visual vocabulary everywhere:** verdict stamps, dots, bottles, day strip.

## 6. What the simulation covers (honest scope)

- **Real data:** the 14 Flipkart laptops and 3,300 owner reviews (2022-era listings). Specs come from listing titles, and quotes are exact.
- **Not real:** prices are from the 2022 listings, not today. Topic and reviewer-type tagging uses keyword matching, not the product's model reader. Verdicts are computed by code and shown as "not yet reviewed by a person" (D-L09). Buy links are store *search* links.
- **Goal inference and parsing** are simple rules in the browser; the product uses the model parser.
