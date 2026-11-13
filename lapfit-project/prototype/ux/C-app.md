# C · Thumb-first app (round 1 proposal)

Idea in one line: LapFit stops being a long scrolling page and becomes a phone app. A short Ask screen, results as ONE swipeable deck of cards, everything else in bottom sheets, and one sticky action bar that always holds the single next step. Visual style (glass, Fredoka/Nunito, pastels, Lappy, theme.css tokens) is untouched.

Seen in the current app (390-500px shots): banner (4 lines) + hero + 6 tiles + slider + histogram + CTA + 4 chips + 3 link rows + textarea + camera/mic/language/Ask + footer = about 30 things before the first answer. A result card has about 22 (photo, credit, badge, name, spec line, price, date chip, 4 stat tiles, radar, ring, 3 reasons, 2 source chips, Full specs expander, 3 buttons, Compare). The "What I understood" panel eats a screen before card 1.

## Principles
1. Thumb zone: every primary control lives in the bottom 40% of the screen. Top of the screen is for reading only.
2. One screen = one primary action, held in a sticky action bar (56px, safe-area padded).
3. Depth through sheets, not scroll. Sheet = drag handle + title + content, 3 detents (peek 40%, half 60%, full 92%), swipe down or tap scrim to close.
4. Cards swipe sideways (native scroll-snap, not JS), one card per screen, next card peeking 16px so users know it swipes.
5. Honest by default: ONE trust line on every card plus a "Why trust this?" sheet. Nothing deleted, only moved.

## Shell (all screens)
```
+--------------------------+  header 48px: logo + "Ask" title, "i" (Trust) right
| (Lappy) LapFit        (i)|  the long amber banner becomes the "i" sheet + a
+--------------------------+  one-line chip on cards: "Snapshot 10 Nov 2026"
|                          |
|        screen            |
|                          |
+--------------------------+  sticky action bar (only when there is a next step)
| [   Primary action   ]   |
+--------------------------+  tab bar 56px, 5 tabs, icon + label, safe-area
|  Ask Explore Check Sell You |
+--------------------------+
```
Banner removed from the top; the "i" opens "How LapFit is honest" (price snapshot date, specs not human-verified, web reviews live, sources/privacy/limits, Market, About). The first-load first-time user sees it once as a dismissible toast-sized chip, then it lives in "i" and on every card as the trust line. Market and About move into the "i" sheet (no screen lost).

## Screen 1: Ask (first load)
```
+--------------------------+
| (L) LapFit            (i)|
|                          |
|   What will you use it   |
|   for?                   |
|  [Study ][Code  ][Game ] |  tiles, 56px tall, single select
|  [Create][Travel][Style] |  (selecting one is the whole step 1)
|                          |
|  (or type / speak)       |
|                          |
+--------------------------+
| [ Next: budget  ->  ]    |  PRIMARY (sticky, disabled until a vibe
+--------------------------+   OR free text exists)
| Ask Explore Check Sell You|
+--------------------------+
```
- Secondary actions (max 2): the "type or speak" row below the tiles opens the Ask sheet (camera, mic, language, textarea); "i".
- Budget is step 2, same screen, a bottom sheet slid up after tile tap:
```
+--------------------------+
|  ====  (handle)          |
|  Budget up to   Rs 60,000|
|  [histogram + big thumb  |
|   slider, 44px handle]   |
|  [30k][45k][60k][80k][No limit] quick stops
|  9 laptops fit           |
|  [ Show me laptops -> ]  |  PRIMARY
+--------------------------+
```
- Free text path: tapping the "type or speak" row opens a keyboard-first sheet: textarea, mic, camera, language pill; Ask button sits above the keyboard (interactive-widget=resizes-content). The 4 example chips live inside this sheet as horizontally scrolling suggestions, not on Ask.
- REMOVED from first load: banner (-> "i"), hero paragraph, histogram (-> budget sheet), 3 link rows Explore/Check/Sell (they are already tabs, duplicates), example chips (-> text sheet), footer disclaimer (-> "i" + each card), second Ask button. Count: 1 primary + 2 secondary (type/speak, i). Passes the budget.

## Screen 2: Results = the deck
```
+--------------------------+
| <  coding · <=Rs 60k  (i)|  context chip row: tap opens "What I understood" sheet
| 1 of 5  o o o o o        |  dots
|+------------------------+|
||     [ photo 16:10 ]    ||  1 picture
||                    (+) ||  compare toggle sits ON the photo corner (44px)
|| ASUS VivoBook 15       ||  2 name
|| Rs 33,990  as of 10 Nov||  3 price + date together
|| "Good for coding: 8 GB ||  4 verdict (why it fits), 1 line
||  RAM, 512 GB SSD"      ||
|| 8GB · 512GB · 1.8kg    ||  5 key specs, 3 max, one line
|| Not human-verified ·   ||  6 trust line (single line, tap -> Why trust)
|| 196 owners, 101 pos.   ||
+------------------------+ |
|   (next card peeks ->)   |
+--------------------------+
| [ See the full picture ] |  7 PRIMARY, in sticky bar (opens Detail sheet)
+--------------------------+
```
Card = 7 things exactly (photo, name, price+date, verdict, key specs, trust line, primary). Two type sizes in the body: 16 Nunito regular for lines, 20 Fredoka for name/price (price reads as the name size, bold).
- Swipe left/right moves card; the action bar's content updates per card (cross-fade 120ms).
- Photo credit: 10px overlay "Photo: 5.imimg.com" on the picture bottom-left (stays visible, only smaller and on the image).
- Unknown price shows "Price ?" (never Rs 0; the shortlist fixture currently shows Rs 0 with a date chip, which this design must render as "?").
- Long-press or tap the (+) compare; after 2 picked, the sticky bar becomes "Compare 2 ->" (primary swaps), "See the full picture" moves to a secondary link on the card.
- 3 secondary actions are NOT on the card: Owners say, Full check, Where to buy all live inside the Detail sheet as a segmented row.

### Detail sheet (tap "See the full picture")  half-height first, drag to full
```
+--------------------------+
|  ====                    |
| ASUS VivoBook 15     [x] |
| [Why it fits|Owners|Specs|Buy]  segmented tabs, swipeable
|--------------------------|
| Why it fits:             |  3 reasons, musts met (ticks), radar,
|  * 8 GB RAM ...          |  owner ring with "101 of 196 (n=196)"
|  * ...                   |
| [radar]   (196 ring)     |
|--------------------------|
| Why trust this?  >       |  opens Trust sheet (stacked, 2nd level max)
+--------------------------+
| [ Where to buy ->]       |  PRIMARY of the sheet
+--------------------------+
```
- Owners tab = owner-voice topics with counts n, pros/cons as stacked rows. Specs tab = full specs, each with "?" when unknown and source label (Catalog / listing). Buy tab = where-to-buy list with price date, "Live, not verified" label, affiliate disclosure if any. "Full check" = second opinion + findings at the bottom of Why it fits ("Second opinion" row).
- Trust sheet: Not human-verified, price snapshot date, sources chips (Catalog, owner opinions), picture attribution, machine-read note, and "How I built this answer" (the receipt) as the last, always-visible row. Receipt stays reachable from every card in 2 taps (card trust line -> receipt).

### Compare (after 2-3 picked)
Full-screen sheet: sticky first column (laptop names, horizontal swipe for the rest, scroll-snap per column), rows = Price, RAM, SSD, Weight, Owners; radar overlay behind a "Shapes" toggle (hidden by default). Primary: "Pick this one" -> opens its Detail sheet. Winner row highlighted, differences only toggle ("Hide same").

## Screen 3: Explore
```
+--------------------------+
| Explore             (i)  |
| [Map | List]  segmented  |  default: Map
|  price map, full-bleed   |  pinch/drag; tap a dot -> peek sheet
|  .  .   . .              |
+--------------------------+
|  ==== peek sheet 40%     |  tapping a laptop shows its mini card
|  ASUS VivoBook  Rs 33,990|   + [ Open ] primary
+--------------------------+
| Ask Explore Check Sell You|
```
List mode = single column of compact rows (photo 56px, name, price, 1 spec), filter chips (budget, brand) as a horizontally scrolling row, "Filters" sheet for the rest. Brands and Market pulse = a segmented tab in Explore: [Map|List|Market]. Primary: "Compare 2" appears in the sticky bar after selecting.

## Screen 4: Check
```
+--------------------------+
| Check a listing      (i) |
| Paste, upload or snap    |
|                          |
|  +--------------------+  |
|  | paste link or text |  |  big drop area, 120px
|  +--------------------+  |
|  [camera] [upload]       |  2 secondary actions
+--------------------------+
| [   Check it   ]         |  PRIMARY
+--------------------------+
```
Findings come back as a vertical list of 3 cards max by default: "Verdict" (one line + traffic dot with shape and word), "Red flags (n)", "Fair price?". Each card is tappable to open a sheet with details and evidence. PII is masked before display (existing pii behavior). Primary after result: "Share / Save to You".

## Screen 5: Sell
Step list in a sheet-wheel feel: 1) Brand+model (searchable list sheet), 2) Age/condition (3 big chips), 3) Result: big number "Worth about Rs X-Y" with date, "?" if unknown, "Why this number" sheet. Primary per step: "Next", last: "Show my laptop's worth". Plan lives in a second card "What to do next" (collapsed to 1 line).

## Screen 6: You
Two segments [My laptops | Share]. My laptops = swipeable cards with swipe-to-reveal Delete (always also a visible "..." button for keyboard/assistive users). Share experience = a 3-step sheet with star/emoji tap rows. Primary: "Add a laptop".

## Gesture and navigation map
```
Ask -> (tile) -> Budget sheet -> Results deck -> Detail sheet -> Trust sheet -> Receipt
                                     |-> Compare sheet -> Detail sheet
(i) -> Trust sheet -> Market / About / Sources / Privacy
```
Back: the device back button and swipe-from-edge close the top sheet first, then leave the screen (history entry per sheet via hash, e.g. #/ask/results?d=asus-vivobook).

## User journey (first-time buyer, 3 taps to the first answer)
1. Opens app, sees 6 tiles. 2. Taps "Code" (haptic-like 100ms scale). 3. Budget sheet rises, taps "60k". 4. "Show me laptops" -> Lappy "thinking" 600ms max, then deck. 5. Reads one verdict, swipes. 6. Taps "See the full picture" only for the one they like.
Hindi-English: the text sheet keeps the language pill; tile labels stay short; example chip "mujhe 50k ke andar laptop chahiye" is the first suggestion.

## What is removed or hidden (explicit)
| Was visible by default | Now |
|---|---|
| Amber banner, 4 lines | "i" sheet + 1-line trust chip on each card |
| Hero text + Lappy big | Lappy 32px in header; big Lappy only in empty/loading |
| Histogram + budget slider on Ask | Budget sheet (step 2) |
| 4 example chips, textarea, camera, mic, language | "Type or speak" sheet |
| 3 link rows (Explore/Check/Sell) | Removed (duplicates of tabs) |
| Footer disclaimer, Market, Sources | "i" sheet |
| "What I understood" big panel | Chip row on results; tap opens sheet |
| Card: radar, ring, 4 stat tiles, 3 reasons, source chips, Full specs, 3 buttons | Detail sheet tabs |
| Compare button on every card | Photo-corner toggle (+) |

## Motion (Emil: only what earns it)
- Sheet: translateY from 100% to 0, 280ms `cubic-bezier(0.32,0.72,0,1)` (drawer curve), exit 220ms; scrim 0 to 0.4 opacity 200ms; drag follows finger 1:1, release uses velocity (>0.11 px/ms closes), rubber-band 0.35 past top.
- Deck: native scroll-snap-type x mandatory, no JS spring; dots update on scroll; the sticky bar label cross-fades 120ms + blur(2px).
- Press: scale(0.97) on :active, 100ms ease-out, all targets; hover only under (hover:hover) and (pointer:fine).
- Compare toggle: icon swap with scale/opacity/blur 0.25 to 1, 160ms.
- Entry: cards stagger 40ms translateY(8px), only first load of results; never replay on swipe.
- Loading: Lappy bobs, skeleton card in the same 7-slot shape (no layout shift).
- prefers-reduced-motion: no translate or scale, opacity crossfades only, snap unchanged.
- Never animate keyboard-driven actions (tab switching with keyboard is instant).

## Platform layer (mobile-native checklist)
viewport-fit=cover + env(safe-area-inset-bottom) on tab bar, action bar and sheets; 100dvh shell; inputs 16px; `-webkit-tap-highlight-color: transparent` with :active states; touch-action: manipulation; overscroll-behavior: none on html, contain on sheets; user-select none on controls only; per-scheme theme-color; the sheet handle has touch-action: none, the deck pan-y.

## Accessibility
- 44px minimum targets (tiles 56px, tabs 56px, action bar 56px, handle area 44px high though visually 4px).
- Sheets: role="dialog" aria-modal, focus moves to the title, trap focus, Esc and a visible close button (swipe is never the only way), focus returns to the trigger.
- Deck: each card is a `region` labelled "Laptop 2 of 5"; Prev/Next buttons appear at 1280px and for keyboard (arrow keys) so swiping is never required.
- Status never colour-only (traffic dot + word + shape). Contrast 4.5:1 for 10px photo credit overlay via dark pill background.
- Sticky bar does not cover content: scroll-padding-bottom equals bar height; screen readers get the primary action first in the landmark `navigation`/`toolbar` order.

## Desktop (1280px)
Phone shell becomes 3 columns: left rail replaces tab bar (labels shown), centre = the deck as a list of cards with the selected one large, right pane = the Detail sheet as a docked panel (not a sheet; same tabs). Budget and text input sit inline on Ask in a 2-column layout. Sticky action bar becomes a pinned footer inside the right pane. Hover states enabled, arrow keys move the deck.

## Risks
1. A deck hides comparison: users cannot see all 5 at once. Mitigation: dot row with price on long-press, a "See all 5 as a list" toggle at the top of results (hidden-by-default, 1 secondary action).
2. Honesty buried: the trust line must stay on the card face at 12px minimum, not only in a sheet. Test that users can find "Not human-verified" in 5 seconds.
3. Sheets stacking (Detail -> Trust -> Receipt) may feel deep; cap at 2 levels, receipt opens as a full screen route.
4. Swipe discoverability: peeking card + dots + a first-use 600ms nudge once.
5. Sticky bar content changing per card can confuse screen readers; use aria-live polite on label only when the card changes.
6. Browser back vs sheet history needs real-device testing (iOS Safari swipe-back conflicts with the deck's edge swipe: start the deck gesture 24px inset).
7. Scope: sheets + deck + sticky bar is a large refactor of Cards.tsx, BlockView.tsx and App.tsx; Detail sheet can reuse the current blocks (Evidence, Source) as content, so the data layer is unchanged.
8. Rs 0 / "?" rendering must be enforced in the card component, not by data.
9. Emulation cannot validate sticky hover, safe areas, keyboard and swipe; needs a real mid-range Android test.
