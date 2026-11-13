# B · Decision board (round 1 proposal)

Idea in one line: **every answer is a board with ONE hero pick, a compact comparable list under it, and every detail in a drawer.** On a phone it is a single column; at 1280px it becomes split panes (list left, detail right) so nothing ever needs a page jump. Style stays (glass cards, Fredoka/Nunito, Lappy, theme.css tokens).

What I saw today (shortlist, 560px): a yellow banner, an "understood" card with a histogram + slider + 3 text lines, then ONE laptop card that is ~1200px tall: picture, name, badge, price chip, 4 spec tiles, radar, ring, 3 reasons, 2 source chips, specs expander, 3 buttons, + Compare. About 28 visible elements per card, 5 cards = 5 screens of scrolling with nothing to compare against. Also a fixture shows "₹0" as price (unknown price must render "?" per honesty rule).

## 1. Principles
1. Answer first, workings second. The first screen after asking shows the pick, not what I understood.
2. Hierarchy = 1 hero (7 things), N rows (4 things each), drawers (everything else).
3. Comparison is the default shape of the list (same fields, same order), not an opt-in.
4. Trust is a single line on every card plus ONE "Why trust this?" drawer per answer. Never removed.
5. One primary action per screen, at most 2 secondary.

## 2. Ask screen (home, first load)
```
┌──────────────────────────┐ 390px
│ (Lappy) LapFit    [₹ ] ? │  header: logo + help only
│                          │
│  What will you use it    │
│  for?                    │
│ ┌────────┐┌────────┐     │
│ │ Study  ││ Coding │     │  vibe tiles, 2 cols, 56px
│ └────────┘└────────┘     │
│ ┌────────┐┌────────┐     │
│ │ Gaming ││ Editing│     │
│ └────────┘└────────┘     │
│  Budget  ₹ 60,000        │  one slider, no histogram
│  ──────────●─────        │
│ ┌──────────────────────┐ │
│ │  Show my best laptop │ │  PRIMARY (only filled button)
│ └──────────────────────┘ │
│  or type / speak / photo │  secondary text row (3 icons)
├──────────────────────────┤
│ Ask Explore Check Sell You│  tab bar
└──────────────────────────┘
```
Visible: headline, 4 tiles (+ "more" chip), budget, 1 CTA, 1 input row = 1 primary + 1 secondary group. Hidden: free-text box (opens on tap of "type"), voice, photo, tiles beyond 4 (sheet "All uses").
Desktop: left 480px column is this form; right pane shows a calm Lappy + "3 example boards" until a result exists.

## 3. Result: the Decision Board (the core)
```
┌──────────────────────────┐
│ <  Coding, up to ₹60,000 │  sticky summary chip = "what I understood"
│    [edit]      9 matches │  tap = Understood sheet (histogram, musts)
│                          │
│ BEST FOR YOU             │
│ ┌──────────────────────┐ │
│ │ [  picture 16:10   ] │ │ 1 picture (attribution as tiny overlay)
│ │ ASUS VivoBook 15     │ │ 2 name
│ │ ₹33,990 · 10 Nov     │ │ 3 price + date (price date stays)
│ │ Fits coding and has  │ │ 4 one-line verdict "why it fits"
│ │ ₹26k left in budget. │ │
│ │ 8GB · 512GB · 15.6"  │ │ 5 three key specs
│ │ ◔ 101 of 196 owners  │ │ 6 trust line: owners n + "Not human-
│ │ positive · Not human │ │   verified" (one line, tappable -> Why
│ │ -verified            │ │   trust this?)
│ │ [  See full check  ] │ │ 7 ONE primary action
│ └──────────────────────┘ │
│ ALSO WORTH A LOOK        │
│ ┌──────────────────────┐ │
│ │▢ Lenovo IdeaPad ₹41k │ │ row = thumb, name, price, 1 spec line,
│ │  Lighter, fewer owner│ │ delta vs hero ("+₹7k, 0.3kg lighter")
│ │  reviews (n=34)  [+] │ │ [+] = add to compare (44px)
│ ├──────────────────────┤ │
│ │▢ HP 15s       ₹38k   │ │
│ └──────────────────────┘ │
│ Show 2 more              │ expander, lists 5 total by default 3
│ ───────────────────────  │
│ Why trust this?  Receipt │  footer line: 2 text links
├──────────────────────────┤
│ [Compare 2] sticky bar   │ appears only after first [+]
└──────────────────────────┘
```
Hero = 7 things (budget met). Row = 4 things (thumb, name+price, one delta line, [+]). Prices on rows keep the date via the board header: "Prices as of 10 Nov 2026 (3 days old)" under the sticky chip. Unknown price shows "?" and the row sorts last.
Removed from default view: radar, ring, 4 spec tiles, 3 reason bullets, source chips, full specs list, 3-button row, banner (banner text moves into the "Not human-verified" trust line + Why trust this? drawer; if prices are stale >7 days the trust line turns amber, never hidden).
Desktop 1280: 3 panes. Left 380px = board list (hero pinned on top, rows). Center/right = detail pane of the selected item (opens the drawer content inline, no sheet). Selecting a row swaps the detail (crossfade 150ms). Compare tray sits at the bottom of the left pane.

## 4. Detail drawer (tap hero card or a row)
Bottom sheet on phone (88% height, drag to dismiss, scroll inside); right pane on desktop. Tabs as a segmented control, one visible at a time:
```
 ── ASUS VivoBook 15  ₹33,990 ──
 [ Fit ][ Owners ][ Specs ][ Buy ]
 Fit:    radar + 3 reasons + musts met/missed
 Owners: ring + topics + "101 of 196, machine-read"
 Specs:  full list, sources chips, picture credit
 Buy:    where to buy (price date, link labels)
 [ Full check ]          primary in sheet
```
Maps old actions: Owners say -> Owners tab, Full check -> sticky primary, Where to buy -> Buy tab. Nothing lost; each is 1 tap from the board.

## 5. Compare
Tapping the sticky "Compare 2" bar opens a full sheet. Table with first column frozen, "Winner" highlighted per row only when difference is meaningful; radar moves behind a "Show chart" toggle. Max 3 columns on phone (swipe snap), 4 on desktop. Top line: one sentence verdict "Pick Lenovo if weight matters; ASUS if price does."

## 6. Other spaces (same board language)
- Explore: price map is the hero (chart, one sentence), browse = same row component, compare = same tray. Filters in one "Filter" sheet.
- Check: one big paste/upload box + ONE button "Check this". Result = a verdict hero (Fair / Overpriced / Risky + 1 line) then finding rows (4 max, "Show all"), with a "Why trust this?" line.
- Sell: input -> a worth hero ("about ₹X-Y", "?" if unknown) + plan rows.
- You: two cards only: My laptops (list rows), Share experience (primary). Market and About live under a "More" row on You, not in the tab bar.
- Clarify/no-match/degraded: one hero-style message with ONE button; never a form plus banner.

## 7. User journey (first-time buyer)
1. Open -> tap Coding -> drag budget -> "Show my best laptop" (3 actions, under 15 s).
2. Board appears with pick + 2 rows (answer within 1 screen, no scroll).
3. Glance at trust line; tap [+] on a row, see "+Rs7k, 0.3kg lighter" delta.
4. Compare sheet -> verdict sentence -> "See full check" on the winner.
5. Detail -> Buy tab. Receipt reachable from board footer at any point.
Hindi-English mix: all labels short, numbers in lakh format (33,990), verdict lines max 12 words; room for a language toggle in header later.

## 8. Clutter budget check
| Element | Today | Proposed default |
|---|---|---|
| Card visible items | ~28 | 7 (hero), 4 (row) |
| First-load actions (Ask) | 8+ (tiles, slider, text, voice, photo, send...) | 1 primary + 1 secondary group |
| Board first screen | banner + understood card + 1 card | chip + hero + 2 rows |
| Card body type sizes | 4+ | 2 (name 17px/600, body 14px/400; price uses the name size) |
| Result actions | 4 per card | 1 per hero, 0 per row (tap row) |

## 9. Motion (Emil rules: ease-out under 300ms, nothing from scale(0), origin at trigger)
- Board entry: hero fades+rises 8px with blur(2px)->0, 220ms; rows stagger 40ms, max 3 steps.
- Sheet: translateY 100%->0, 260ms cubic-bezier(.32,.72,0,1); swipe-down follows finger, velocity > 0.11 closes; backdrop fades 200ms.
- [+] press: scale .97 on :active, check icon swaps with 120ms opacity+scale from .25 (no scale 0). Compare bar slides up 200ms.
- Row -> hero promotion on desktop: shared-element is skipped; crossfade only (frequent action, keep it fast).
- Numbers use tabular-nums. Hover styles behind @media (hover:hover). Inputs 16px (no iOS zoom), 100dvh for sheets, safe-area padding for tab bar and sticky compare bar. prefers-reduced-motion: opacity only, no translate.

## 10. Accessibility
44px targets on rows, [+], tabs, chips; row is one button with an aria-label "ASUS VivoBook 15, Rs 33,990, add to compare" kept separate from open action (two 44px zones). Sheet is role=dialog with focus trap, Esc closes, focus returns to trigger. Verdict and trust text min 4.5:1 on glass (add a solid scrim under text on pastel gradients). Compare winner not by colour alone (label "Best"). Order of the DOM = reading order: hero before rows.

## 11. Risks
1. One hero implies certainty: mitigated by the trust line, "Why trust this?" and showing the delta of runners-up; ranking logic must be explained in the receipt. If top two are near-tied, show "Tie" and two heroes side by side.
2. Hiding radar/ring may drop the app's playful look: keep Lappy states, a small ring glyph in the trust line, radar in Fit tab and compare toggle.
3. Sticky summary chip + sticky compare bar + tab bar can eat 150px of a small phone: compare bar replaces, not adds to, the chip when scrolled.
4. Split panes at 1280 duplicate the sheet content: build detail as one component rendered in sheet or pane.
5. Rows hide per-row verdict: delta line must always be data-derived (price, weight, owner n), never invented; if no delta data show specs line only.
6. Unknown price ("?") currently renders as Rs 0 in at least one fixture; fix before any redesign ships.
7. Moving Market/About out of the tab bar may reduce their discovery: measure after launch.
8. Hindi-English users may prefer voice: keep the voice entry visible in the secondary row.

## 12. Skills to run next
design:design-critique on a built mock of section 3; design:accessibility-review on the sheet and compare tray; design:ux-copy for verdict lines and trust-line wording.
