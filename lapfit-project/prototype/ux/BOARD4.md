# Board 4 (append only)

### Builder 4 (other screens) · 2026-11-13
Exports/expects: I keep every screen's props unchanged ({thread, compare, goto}; YouScreen {mine, share, compare, goto}). ExploreScreen embeds MarketScreen as segment [Map|List|Market] and keeps the heading "The laptop map". MarketScreen stays exported and standalone-capable, so builder 1 may keep or drop the #/market route; tell me if you remove it and I'll make #/market open Explore on the Market segment (I read location.hash 'market' only if the route still renders MarketScreen).
Re-labels I plan (tests updated minimally, will say so): "Show the list version" button becomes the List segment tab; Check button stays "Check it". Findings: I only touch the Findings function in Misc.tsx (verdict hero + 4 + "Show all"); heading text "What I found" kept.
Need from others: nothing. Not using ctx.openDetail.

### builder3 DETAIL · start
Exporting: `ctx.openDetail(card: DetailCard): void` (added to Ctx + noopCtx in src/components/ctx.ts; buildCtx gets a no-op, ThreadView overrides it with real state and renders <DetailSheet/>). Builder 2: just call `ctx.openDetail(c)` with the same card object you already render (fields as in Cards.tsx `Card`: name, price_text, as_of_text, specs, spec_lines, musts, reasons, evidence, unknown_fields, data_status, variant_id, image). Optional 2nd arg `tab?: 'fit'|'specs'|'trust'`.
Sheet = <BottomSheet> (reused), tabs Fit|Specs|Trust, pinned footer: primary "Where to buy" (Affiliate/Live tag read from the same reply's provenance block), secondary "Owners say"/"Full check" close the sheet then call ctx.action(...). Receipt: Trust tab embeds the reply's existing <Provenance/> ("How I built this answer").
I touch only: ctx.ts, Thread.tsx (provider+sheet), blocks/DetailSheet.tsx, detail.css. I expect from you: Cards.tsx keeps the three existing action bodies unchanged (I reuse them).

### Builder 2 (Results board) · start
- I EXPECT from builder 3 in src/components/ctx.ts: `openDetail(card: any): void` on the Ctx interface (+ noopCtx default `openDetail() {}`). I pass the whole card object from the cards block (shape of Card in Cards.tsx, unchanged backend shape). Until it exists I call it as optional (`ctx.openDetail?.(c)`), so no compile break either way.
- I EXPORT: `CardView` (kept name, still exported via Tables.tsx; now = the hero face), `CardsBlock`, `BoardHero`, `BoardRow` (Board*.tsx), `CompareBlock` (sheet). Card type exported from Cards.tsx as `Card` (builder 3 may import it).
- The card face no longer has "Owners say" / "Full check" / "Where to buy" buttons or radar/ring: those live only in your Detail sheet. Hero has ONE button "Details" + the photo "+ Compare" toggle (aria-label "Compare" kept). Row tap = openDetail.
- Tests I will touch (minimally): blocks.test.tsx cards tests, redesign.test.tsx lines ~48-60,137,142. Tell me if you also edit them.
- Compare tray (App.tsx, builder 1) is unchanged by me; compare results render as a sheet inside the compare block.

### 1 SHELL+ASK · start
Exports I add: src/components/TrustSheet.tsx (<TrustSheet open onClose notice footer reply goto/>), VibePicker now controlled via hook useVibes() (VibePicker.tsx). Composer gets optional prop variant="bar" (default unchanged, so Check/Sell/Explore unaffected).
I do NOT touch ctx.ts, Thread.tsx, blocks/*. Builder 3 owns ctx.openDetail; if its mount point needs App.tsx, tell me the one line, I will add it.
Shell tray (compare picks) stays in App.tsx, class .tray, unchanged contract (compare.ids / openCompare). Top-nav pills = Ask/Explore/Check/Sell/You; tab 'market' highlights Explore; Market + About reachable from the (i) Trust sheet (builder 4: put the Market segment in Explore; route #/market stays valid).
Tests I will edit minimally (will report): budget slider value index (steps now 20k,30k,45k,60k,80k,1L,1.5L,No limit), slider count text moves to aria-valuetext, Market/About tests open the Trust sheet first.

### builder3 DETAIL · done
Shipped: ctx.openDetail(card, tab?) live in ctx.ts (+ exported types DetailCard, DetailTab); ThreadView provides it and renders <DetailSheet/> (blocks/DetailSheet.tsx, detail.css). Fit | Specs | Trust, pinned Where to buy (Affiliate/Live tag only if the same reply's provenance says so) + Owners say / Full check (close sheet, fire the original action bodies). Trust tab embeds the reply's <Provenance/> receipt.
Relies on: builder 2 calling ctx.openDetail(c) from hero "Details" and row tap (not yet wired when I checked; Cards.tsx still had the old buttons). Added src/test/detail.test.tsx (5 tests), no existing tests edited.
Gap: Sell tests in app.test.tsx fail from builder 4's in-progress Sell rework, not from my files.

### Builder 4 (other screens) · done
Done: Explore [Map|List|Market] (list-version button became the List tab; Market actions share Explore's thread; MarketScreen/#/market still works standalone), Sell = 3 questions then worth hero (hero reads the sell_plan block; I hide SellPlan's duplicate range with CSS in screens.css, Tables.tsx untouched), Check verdict hero + 4 findings + "Show all" (Misc.tsx Findings only), You rows with swipe + "..." menu (Remove). Tests edited minimally in app.test.tsx: Explore "list version" button -> tab "List"; Sell tests click "Next" between questions.
Rely on: BottomSheet/TrustLine unchanged, buildCtx signature. Gap for builder 1: the (i) sheet's Market link can keep #/market. Remaining vitest failures are Cards tests (blocks/redesign), builder 2's area, not mine.

### Builder 2 (Results board) · done
- Shipped: Cards.tsx (CardsBlock), BoardHero.tsx (BoardHero, BoardRow, CompareToggle, useOpenDetail), BoardLogic.ts (Card type, deltaLine, isTie), BoardCompare.tsx (CompareBlock sheet, via portal), Tables.tsx (compare part removed, re-exports), board.css. CardView is now an alias of BoardHero.
- Relies on builder 3: `ctx.openDetail(card)` (card = whole Card object). I call it through a cast; if absent it falls back to a second_opinion action, so nothing is unreachable. Detail sheet MUST carry "Owners say", "Full check", "Where to buy": the card face no longer has them.
- Tests re-labelled/updated by me: blocks.test.tsx (cards: 3 articles + "Show 2 more"; compare toggle + Details; buttons-moved test; new compare sheet test), redesign.test.tsx (card/trust line/stale/hero/pictures), app.test.tsx (radar now behind "Shapes").
- Gaps: "What I understood" card (Misc.tsx, not mine) still sits above the chip, so result screen is taller than the budget. Compare accessible name stays "Compare" (not per-laptop). Tie rule: price within 2%, same RAM+storage, owner positive share within 3 points.

### 1 SHELL+ASK · done
Shipped: App.tsx (header, one-line trust chip + (i), no banner/footer, 5-item nav; market highlights Explore), TrustSheet.tsx (why trust, data line + counts, latest receipt via Provenance, Market/About links, voice language), VibePicker.tsx (useVibes + VibePicker + AskCta; steps 20k/30k/45k/60k/80k/1L/1.5L/No limit, stops 30/45/60/80/No limit), AskScreen, Composer variant="bar" (rotating Hinglish placeholder, opens on focus), shell.css.
Tests edited (app.test.tsx only): hint-chip clicks became typing in the bar; slider index 6->5 for 1 lakh; slider count text now aria-valuetext; Market/About tests open the (i) sheet first; +1 Trust sheet test.
Removed from first load: banner, footer, hero text, mascot, histogram, hint chips, 3 link rows. Ask count: brand, chip(+i), heading, 6 tiles, slider, stops strip, bar, CTA, nav = about 14 groups (18 if nav items and stops are counted singly).
Gap: Composer's voice language is now shared in localStorage (lapfit.voicelang). Check/Sell (builder 4) may still use their own Composer: unchanged default.
