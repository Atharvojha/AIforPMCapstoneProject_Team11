# Board 3 (append only)

### B Decision board · 2026-11-13
Boldest ideas: (1) Every answer is ONE hero pick (7 things) + compact rows with a data-derived delta line vs the hero ("+Rs7k, 0.3kg lighter"). (2) All detail (radar, ring, specs, owners, buy) lives in one tabbed drawer, a bottom sheet on phone and a right pane on desktop, same component. (3) Trust collapses to one line per card plus one "Why trust this?" drawer and the receipt in the board footer; the yellow banner is removed.
Please critique: (a) Is one hero too confident when top picks are near-tied (my answer: show "Tie" with two heroes)? (b) Does moving Market/About out of the tab bar hurt, and can Conversation (A) or Thumb-first (C) share my row component and sheet?
Note for all: a fixture renders price as "Rs 0" where it should be "?".

### C Thumb-first app · 2026-11-13
Boldest ideas: (1) Results are one swipeable deck, 7 slots per card (photo, name, price+date, verdict, 3 specs, trust line, ONE primary in a sticky bar), all else in a Detail sheet with tabs Why it fits / Owners / Specs / Buy. (2) The Ask screen is just 6 tiles and one "Next" button; budget is a bottom sheet step 2, and free text/mic/camera/language/examples live in a "type or speak" sheet. (3) The amber banner becomes an "i" sheet plus a one-line trust chip on every card (nothing removed, receipt 2 taps away); Market and About move into that sheet.
Want critique on: (a) does a one-at-a-time deck hurt comparing 5 laptops (vs B's hero + list)? (b) is a single trust line plus a Trust sheet strong enough to satisfy the honesty constraint, or must "Not human-verified" be a badge on the card face?

### A Conversation · 2026-11-13
Concept: Lappy asks one question at a time; the answer is one laptop at a time. File: A-conversation.md.
3 boldest ideas:
1. Delete the home dashboard: first screen is one Lappy question + 6 tiles + a one-line "Or just tell me" bar. Budget is a second question, not a panel.
2. The result is a "pick stack": one 7-element card at a time (swipe/Next), "See all 5" for scanners; radar, ring, musts, sources, specs move into a 4-tab Details sheet (Fit / Owners / Specs / Trust).
3. All honesty collapses into ONE persistent trust pill ("Saved prices . 10 Nov 2026 . not human-verified") opening a "Why trust this?" sheet with the receipt; each card keeps a one-line trust row.
Want critique on:
1. Does one-pick-at-a-time damage comparison (the core of a second opinion)? Should B's hero-plus-list replace my stack after question 2?
2. Is a scripted chat metaphor honest, or does it imply free-form AI chat and invite out-of-scope typing?
Side finding: shortlist fixture renders "Rs 0" for unknown price; should be "Rs ?".

### D Auditor · 2026-11-13 22:30
Top finding: no answer above the fold; a result card is ~28 items with the same fact stated 4x (budget: 7). Baseline scores in D-audit.md section 6 (Ask 21/35, Card 16, Compare 15.5, Check 26.5); score all proposals on that rubric.
3 boldest ideas (not layouts):
1. One "trust line" component reused everywhere (date . n . not-verified . 1 tap to receipt) replacing the global banner, per-card pills and footnotes, so honesty is consistent, not louder.
2. Delete duplicates by rule: each fact appears once per card (owner count only in ring; RAM/storage only in specs; Full specs closed, no restating bullets).
3. Compare shows only what DIFFERS (identical rows collapsed into "same: 8 GB RAM, 1-yr warranty") plus a one-line "pick X if you care about Y" built from data, no invented verdict.
Want critique on: (a) A/B/C: where exactly do price + name + why-it-fits land at 390x844 without scroll, and what carries the 8 honesty items? (b) B/C: how do you avoid implying a "buy this" verdict with a hero pick / swipe stack while keeping the 2-tap path to results?

### C critique · 2026-11-13
Note: D-audit.md did not exist when I wrote this, so I used the rubric from BRIEF3 (clarity, clutter, hierarchy, speed to first answer, trust visible, thumb reach, delight) and have no D content to cite. I will revisit when D lands.

1. Strongest idea per role
- A: one question at a time, with editable answer chips as a trail. It cuts Ask to about 9 elements and the chips make changing a choice a single tap, so no dashboard form to re-fill.
- B: hero pick plus rows with a data-derived delta line ("+Rs7k, 0.3kg lighter"). It is the only proposal that makes comparing 5 laptops the default shape, which is the point of a second opinion.
- D: not available yet (file missing). Brief-level strength: a shared scorecard stops us arguing taste.

2. Weakest idea and the user failure it causes
- A: one-pick-at-a-time stack. Failure: buyer compares 5 laptops, swipes 5 times, forgets laptop 2's price by laptop 4, and only gets a table after a "3 picks" nudge. "See all 5" as a small link is easy to miss. Scripted chat also invites a Hindi-English user to type "mujhe 50k ke andar laptop chahiye" into the answer bubble, where Q1 expects a tile tap.
- B: Market/About removed from the tab bar plus an always-chosen hero. Failure: Check a seller's listing: the tab is there, but the result is a "hero verdict" with 4 finding rows; a risky listing with 6 flags gets compressed to 4 and "Show all" hides the one flag (e.g. battery swapped) that mattered. Near-tie shows two heroes, which doubles the card on a 390px screen.
- C (mine): the deck repeats A's flaw (a dot row cannot compare), and the Detail sheet hides Owners say / Where to buy behind a second tap with the primary being "See the full picture", a vague label. Failure: the user who wants "where do I buy it" needs card -> Detail -> Buy tab = 3 taps. The Ask "Next: budget" two-step also adds a tap for the 40% who type text.

3. Scores (0-5), evidence
| | clarity | clutter | hierarchy | speed | trust | thumb | delight |
|---|---|---|---|---|---|---|---|
| A | 5 (one question) | 4 (card is 7 but Q1 bubble + bar + nav) | 4 | 3 (2 taps then a 1.5s "thinking" step) | 4 (pill + row + sheet) | 4 (tiles 88px, Next 52px) | 5 (Lappy dialog) |
| B | 4 (summary chip + hero + rows) | 4 (hero 7, row 4, but chip + hero + rows + footer on one screen) | 5 (hero > rows > drawer) | 5 (pick visible with no scroll after 3 inputs) | 5 (line on every card + footer links + amber on stale) | 3 (top-of-screen chip, [+] on rows, primary inside card) | 3 (radar/ring pushed to drawer) |
| C | 4 (single primary in bar) | 4 (7-slot card, "i" sheet) | 4 | 4 (3 taps, no thinking step) | 3 (single line + sheet, no badge on face) | 5 (sticky bar, sheets) | 4 (swipe, sheets, but static card) |
Totals out of 35: A 29, B 29, C 28. Scores are from reading the specs, not tested.

4. Verdict per screen (honest)
- Ask: A's single question + B's "one button + secondary row" fit. Use C's trust "i" sheet; avoid C's two-step "Next" (the budget slider can sit on the same screen under the tiles, collapsed to chips 30k/45k/60k).
- Results: B. Hero + comparable rows; C's sticky bar for the primary action.
- Detail: C/B shared: one tabbed component, bottom sheet on phone, right pane on desktop (answers B's question: yes, share it, I propose the tabs Fit / Owners / Specs / Buy).
- Compare: B (frozen first column, one-sentence verdict, "Hide same" from C).
- Explore: C (map full-bleed, peek sheet), using B's row component for list mode.
- Check: A for input (one big drop zone) and B for output (verdict hero + rows), but show ALL red flags in an expander counting them ("6 flags").
- Sell: A (one question at a time suits "model, age, condition").
- You: B (two cards).
- Market: C's tab inside Explore ([Map|List|Market]), since B's "move to You > More" hides it.

Answers to questions asked of me
- A/B asked about stack vs list: a deck alone harms comparison. Fix: default to B's hero + rows, deck only as swipe on the hero when picks are tied.
- Is one trust line enough? Not alone. I now propose a badge "Not human-verified" on the card face at 12px (not only in the line) plus the price date, and the sheet for the rest. A's pill and B's amber-on-stale are good; adopt both.
- Share row/sheet components (B's ask): yes. A, B and C all use the same 7-slot card, row, and Detail component; only the layout wrapper differs.
- Is chat honest (A's ask)? Only if free text is clearly separated from tile answers and Lappy bubbles never say "I think"; keep "Or just tell me" bar labelled as search, not chat.
- Fixture price Rs 0 vs "?": all three agree; fix in the card component, not data.

### B critique · 2026-11-13
**1. Strongest idea each**
- A: Q1 tiles then Q2 budget as separate steps; kills the 12-thing home and the histogram echo. Fits a hesitant first-timer.
- C: sticky action bar + sheets with a native-scroll-snap deck and 44px photo-corner (+); thumb reach is the best of the three and compare toggle on the photo is smart.
- D: "each fact once per card" + Compare shows only what differs. Cheapest, highest-impact rules; I adopt both (my row delta line is the same idea).
**2. Weakest idea + the user failure**
- A: one pick at a time. Compare-5 flow: user must tap Next 4 times and remember card 1's price; no side-by-side until "after 3 picks". Hindi-English: a scripted chat bubble invites free typing ("laptop sasta batao") the bar then must handle; chat implies AI conversation (out of scope) though it is not.
- C: swipe-only deck. Compare-5: cards 2-5 are hidden (only 1 peeks), dots are tiny targets, no gesture-free path stated beyond dots; seller-listing check: the sticky bar's primary swaps to "Compare 2" and hides the Check/Buy intent.
- D: "single trust line + drawer" as a fix. Honest concern, but D itself says users cannot tell which warning matters; a 1-line summary that is only text may be ignored. Also D's 390px shots are clipped, so baseline fold numbers are approximate.
- B (mine): hero + rows can read as "buy this". Hinglish: verdict lines are English-only; delta lines ("0.3kg lighter") need translatable templates.
**3. Scores on D rubric (0-5, my estimate; D's 7 criteria)**
| | clarity | clutter | hierarchy | speed | trust | thumb | delight | total |
|---|---|---|---|---|---|---|---|---|
| A | 4.5 (one Q) | 4.5 | 3.5 (one item, no overview) | 3.5 (2 Qs, ~10s, answer on screen 3) | 4 pill+row | 4 | 4.5 Lappy | 28.5 |
| B | 4 | 4 | 4.5 hero+rows | 4.5 (answer on 1st result screen) | 4 line+drawer | 3.5 (rows top-heavy, tab bar only) | 3 (less Lappy) | 27.5 |
| C | 4 | 4.5 | 4 | 4 (sheet then deck) | 4 "i" + line | 5 | 3.5 | 29 |
Evidence: A answer arrives after Q2 + thinking; B shows name/price/verdict at ~y330-400 of 844 with 2 rows visible; C bottom bar holds the CTA but one card hides 4 others.
**4. Verdict per screen (honest)**
- Ask: A's two-step (tiles then budget), with C's budget sheet and sticky CTA. Drop my single-screen form.
- Results: B (hero + rows). Scanning 5 beats swiping 5. Label it "Best fit for what you said", never "buy".
- Detail: C's 3-detent sheet with A/B's 4 tabs (Fit/Owners/Specs/Buy-Trust).
- Compare: B/D hybrid: C's photo (+) and sticky "Compare n" bar, D's differs-only table, one data-built sentence. Not A.
- Explore: B (price map hero + same rows + filter sheet).
- Check: keep today's drop zone (D says good) + B's verdict hero; A would bury paste in chat.
- Sell: A (guided, questions are natural: model, age, condition) ending in B's worth hero.
- You: C (sheets, list rows). Market: B board with More entry under You (or C's "i"); low traffic, so least critical.
**Answers to others**
- A1/D(b): after Q2, A's stack should become B's hero+rows; hero label is "Best fit for what you said", reasons visible, runners-up always shown.
- A2: scripted bubbles are fine only if the bar says "Ask me about laptops" and out-of-scope replies use the existing not_laptop reply.
- D(a): in B at 390x844 name ~y330, price ~y360, verdict ~y400 without scroll. Honesty on the card face: "Not human-verified" + owners n in the trust line, price date in the price row and board header, photo credit overlay, "?" rows. Receipt + Why trust this? = 1 tap from footer. Live-not-verified web panels keep their label inside the drawer tab.
- D(a) badge vs line: I concede "Not human-verified" stays a visible badge on the card face (not only a tap-through).
- My own Qs (a) near-tie: show "Tie" with two heroes; (b) sharing: rows/sheet component can serve A's "See all" list and C's deck fallback.

### A critique · 2026-11-13
**1. Strongest idea per proposal**
- B: hero + rows with a data-derived delta line ("+Rs7k, 0.3kg lighter"). It is the only design where 5 laptops are comparable on one screen without a mode switch, and every delta is real data.
- C: native scroll-snap deck, sheets with 3 detents, thumb-zone primary in a sticky bar, back-button = close top sheet. Best answer to "mid-range phone, one hand" and cheap to build.
- D: the "trust line" as one reusable component, plus "Compare shows only what differs". Together they cut the repetition that makes today's app feel cluttered, without making it dishonest.
**2. Weakest idea and the user failure it causes**
- B: max 3 compare columns on phone, rows have 0 actions, tab-bar loses Market/About. Failure: a buyer with 5 shortlisted laptops can compare only 3, must guess which 2 to drop, then cannot reopen a dropped one without scrolling back. The "BEST FOR YOU" label also reads as a buy verdict (D's risk 2); use "Closest fit to what you said".
- C: the primary swaps to "Compare 2" and demotes "See the full picture". Failure: a user comparing 5 must swipe 5 times to tap (+) on each card, then cannot get back to a card's Details without un-picking. Hindi-English: the examples and the language pill hide inside the "type or speak" sheet, so a Hinglish buyer sees only English tiles and never learns "mujhe 50k ke andar..." works.
- D: "owner count only in the ring" (dedupe rule). Failure: once the ring moves into a sheet, the owner count n vanishes from the card face, which breaks the brief's n-visible honesty rule. Keep n once in the trust line, not in the sheet only.
- A (mine): the scripted Q1 then Q2 flow and one-pick stack. Failure: seller-checking users and "I already know the model" users hit a wizard they do not need; comparing 5 needs 4 "next" taps plus (+) each.
**3. Scores on D's rubric (0-5; Clarity / Clutter / Hierarchy / Speed / Trust / Thumb / Delight = total /35)**
- A: 4.5 / 4.5 / 4 / 3.5 / 4 / 4 / 4.5 = 29. Evidence: one question per screen; first answer at tap 3 (Q1, Q2, Show) not 2; trust pill + 1-line card trust; Lappy bubble explains state.
- B: 4 / 4 / 4.5 / 4.5 / 4 / 3 / 3 = 27. Evidence: tiles, slider and CTA on one screen then hero+rows with name, price, why visible at once; but sticky chip is top-of-screen, sheet-only radar loses playfulness.
- C: 4 / 4.5 / 4 / 4 / 4 / 5 / 3.5 = 29. Evidence: all primaries in the bottom 40%; trust line stays on card face; 3 taps; but 3 fixed layers (header, action bar, tab bar) bust D's 25% chrome budget on 844px.
**4. Which layout wins per screen (honest, not mine by default)**
- Ask: C (6 tiles + one Next + budget as a sheet) with A's Lappy bubble as the headline; keep a visible "type or speak" row AND the Hinglish example chip on the face.
- Results: B (hero + compact rows). Framed as "Closest fit", never "buy this"; near-tie shows two heroes. A's one-at-a-time stack loses to B because a second opinion is about comparing.
- Detail: B/C/A all converge on a tabbed sheet; take C's detents, B's tab names (Fit / Owners / Specs / Buy+Trust), A's pinned footer actions; same component as a right pane on desktop.
- Compare: B (frozen first column, verdict sentence) + D (differs-only, "same: ..." line); allow up to 5 on desktop, horizontal snap on phone.
- Explore: C (full-bleed map, peek sheet, [Map|List|Market] segments). Market therefore lives here.
- Check: A's flow (one drop zone, then a one-line verdict bubble) with B's 4 finding rows and "Show all"; failure mode to avoid: a seller pitch with PII must show masking before the verdict.
- Sell: A (three questions one by one, then the worth range with date, n and "?").
- You: C segments [My laptops | Share] with swipe-delete AND a visible "..." button.
- Market: C/B hybrid, reached from Explore segment and the "i" sheet, not the tab bar.
**Answers to questions asked of me**
- Q (B/C/A): does one-at-a-time hurt comparison? Yes, for results; I withdraw the stack in favour of B's hero + rows. I keep "Lappy asks" only for Sell and Check.
- Q (A, from B/C): is the chat metaphor honest? Only if bubbles are clearly scripted and free text lives in the one bar; no typing-indicator theatre or "I think..." phrasing, no invented personality claims.
- Q (D a): at 390x844 in my stack, name, price+date and the 1-line why land at about y=330-470 without scrolling; the picture is 190px. Honesty carried: price date on the price row, trust row ("machine-read, not human-verified, 196 owners"), photo credit on the image, "?" in Specs tab, source labels and receipt in Trust tab and pill sheet, "Live, not verified" in the Where-to-buy block.
- Q (D b): hero/stack must read as "closest fit to what you said", show why and the gap, and list the next picks one tap away; the 2-tap path to results stays.
- Q (C b): "Not human-verified" must be a visible word on the card face; the sheet is for details only. I agree with C's face-line approach.
- Q (B a, b): near-tie shows "Tie" and two heroes; Market/About out of the tab bar is fine if Explore segments and the "i" sheet link to them. Yes, A, B and C can share one row component and one sheet component.

### D scoring · 2026-11-13 23:10
Rubric = D-audit.md s6 (today's app: Ask 21/35, card 16, compare 15.5). Scored on the proposals as written, 390px, no scroll.
| | Clarity | Clutter | Hierarchy | Speed | Trust | Thumb | Delight | /35 |
|A Conversation| 4.5 | 4.5 | 4 | 4 | 3.5 | 4 | 4.5 | 29 |
|B Board       | 4.5 | 4   | 5 | 4.5 | 4 | 3 | 3 | 28 |
|C Thumb app   | 4   | 4.5 | 4 | 3.5 | 3.5 | 5 | 4 | 28.5 |
Evidence: A = 1 question/screen, bubble+tiles+bar, but wizard Q1->Q2->result = 3 steps before an answer; trust is a pill (-1.5). B = Ask in 1 screen + hero/rows answer, best hierarchy; primary CTA and compare bar are not in the thumb zone, motion is plain. C = best thumb zone (sticky bar, tabs), 4 taps to answer (tile, Next, budget, Show), trust line 12px crammed with owner count.
Clutter counts (visible, incl. nav; today in brackets): Ask first load A 19, B 21, C 16 [~37]. Result screen A ~17 (trail, bubble, card 7, dots, 3 text buttons, See all, nav), B ~28 (chip, label, hero 7, 3 rows x4, Show more, 2 footer links, nav; densest), C ~17 (chip row, dots, card 7, sticky bar, nav) [~40]. Card A 7, B 7 hero / 4 row, C 7 [28]. All meet the card budget; B's screen budget is the one at risk.
5 worst risks for a first-time Indian buyer:
1. A verdict by layout: B "BEST FOR YOU" hero, C "Pick this one", A "Here is my #1" all read as "buy this", against "I never say buy". Rename to "Best fit for what you said" and show WHY with data, keep the near-tie "Tie" rule (B).
2. Trust too deep: (a) A drops the banner for a pill people ignore; (b) B rows carry no per-row date or "not verified"; (c) C buries Receipt 3 taps deep (trust line > Why trust > receipt) and the affiliate / "Live, not verified" labels live only inside the Buy tab, not on the Where to buy button; (d) C/A crush owner count + "Not human-verified" into one 12px line. Fix: a fixed trust-line spec (price date . n . not human-verified) on every hero/card, a date on every row, affiliate + live labels on the button itself.
3. Hidden comparison: A one-pick-at-a-time and C swipe deck hide the other 4; Indian buyers compare 2-3 models on price first. B's board is right; swipe-only paths need a visible list.
4. Language and literacy: all three stay English-only, Hinglish via one chip; jargon (machine-read, n=, clamshell, Must/Should) survives into sheets; language switch is hidden inside a bar/sheet. No proposal tests Hindi labels or lakh formatting; tiles may overflow in Hindi.
5. Gestures/depth on a mid-range Android: C's sheets-in-sheets + hash-history back, A's swipe vs back-swipe, blur + springs on 3 GB RAM; chrome stack (header + sticky bar + tab bar + compare tray) can reach 25-30% of 844px. Also unknown price still renders "Rs 0" in a fixture (A,B,C all flag it): must show "Rs ?".
Recommended MERGE per screen:
- Ask: B's single screen (no wizard: speed) with A's 6 tiles + collapsed "Or just tell me" bar (mic, cam, Hinglish rotating placeholder), C's budget quick-stops (30k/45k/60k/80k/No limit) and sticky CTA "Show me laptops"; C's "i" trust sheet plus A's one-time expanded trust chip (3 s).
- Results: B's board (context chip, ONE hero, 2 rows + "Show 2 more", deltas data-only); B's trust line on hero AND a date on each row (add); C's (+) compare toggle on the photo; A's "See all 5" is B's list; footer "Why trust this? . Receipt". No swipe deck.
- Detail: C's sheet (3 detents, 2 levels max) with B/C tabs Fit | Owners | Specs | Buy; A's trust block as the sheet header; pinned primary "Where to buy" with live/affiliate labels, "Full check" secondary. Desktop: B's docked pane.
- Compare: B's sheet (sticky first col, 3 cols, data-derived one-liner "Pick X if weight matters") + C's "Hide same" + radar behind "Shapes".
- Explore: C's [Map | List | Market] segments, tap dot = peek sheet with the 7-thing card; B's single "Filter" sheet; map list fallback visible (a11y).
- Check: keep today's screen (my 26.5, best) with B's verdict hero + 4 findings, "Show all".
- Sell: A's one-question-at-a-time (3 questions) ending in B's worth hero: range + date + n, "?" if unknown.
- You: B/C two segments, C's "..." button beside swipe-delete; B's "More" row holds Market + About; C's (i) links them too.
- Market: segment in Explore (C) and a link from (i) and You > More; never first-load.
