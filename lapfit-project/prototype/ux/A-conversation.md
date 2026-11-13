# A · Conversation: "Lappy asks, you tap" (round 1 proposal)

Idea: LapFit stops being a dashboard and becomes ONE question at a time. Lappy (mascot) speaks in a bubble, you answer with big tiles or a few words, and the answer arrives as ONE laptop at a time. Same soft-playful style, same theme.css tokens, same blocks and backend reply shapes. Only layout, order and what is shown by default change.

Evidence from the current app (screenshots A_ask.png and A_short.png in scratchpad/shots):
- Ask home shows 12+ things before the first answer: yellow banner (3 lines), mascot, headline, lead paragraph, 6 vibe tiles, budget histogram + slider + count, big CTA, 4 hint chips, 3 quick links, composer (textarea, Photo, Speak, language, Ask), footer text, 5-tab bar. Three competing inputs (tiles, chips, composer).
- A laptop card shows about 22 things (rank badge, Compare, picture, credit, name, verified pill, RAM/storage line, price, date pill, 4 spec tiles, radar, ring, 3 reasons, 2 source chips, "Full specs" with 6 lines, 3 action buttons) and the action row sits under the fold, hidden behind the tab bar.
- The "What I understood" panel repeats the budget slider before any laptop appears.
- Fixture shortlist shows price "₹0"; an unknown price must render "₹?" (honesty rule).

## 1. Principles
1. One question per screen. Never two inputs of equal weight.
2. One laptop per screen in the answer. The list exists, but as a "stack" you move through, plus a one-tap "See all 5".
3. Chat-like: Lappy bubbles on the left, your answers as small chips on the right ("Code", "Up to 60k"). Your choices become a readable trail you can tap to change (edit-in-place).
4. Chrome is minimal: top bar = logo + trust pill + menu. No banner. Bottom nav stays (5 spaces) but is calm: icons and labels, no filled pill; hides while you type.
5. Trust is ONE persistent line, never removed: `Saved prices · 10 Nov 2026 · not human-verified  (i)`. Tapping opens the "Why trust this?" sheet (all honesty details, receipt link).

## 2. User journey (first-time buyer, mid-range phone, Hindi-English)
```
Open -> Q1 "What will you use it for?" (tap 1 tile)        ~3 s
     -> Q2 "How much can you spend?" (slider, Next)         ~5 s
     -> Lappy "thinking" 1-2 s (real progress words)
     -> PICK 1 of 5 (card, 7 things)                        first answer at ~10 s, 2 taps
     -> [Show me the next one] / [Why this?] / [Compare]
     -> After 3 picks Lappy offers: "Want me to put these side by side?"
```
Typing, speaking, photo are always one tap away via the "Or just tell me" bar (section 3.1), so the guided path is never a cage. Language toggle (English / Hindi-English) lives inside that bar.

## 3. Screens (390px phone). Each shows primary (P) and secondary (s) actions.

### 3.1 Home / Q1  (1 primary-ish tap, 2 secondary)
```
+--------------------------------------+
| (logo) LapFit      [i Saved prices ] |  <- trust pill (tap = Why trust this?)
|                                      |
|   ( Lappy 72px )                     |
|  +--------------------------------+  |
|  | Hi! I'll find a laptop you can |  |
|  | trust. What will you use it    |  |
|  | for?                           |  |
|  +--------------------------------+  |
|                                      |
|  [ Study ] [ Code ] [ Game ]         |  <- 6 tiles, 2 cols x 3, 88px high
|  [Create ] [Travel ] [Stylish]       |     tap = answer, auto-advance (P)
|                                      |
|  --------------------------------    |
|  [ Or just tell me...   mic  cam ]   |  <- s1: one-line bar, expands on focus
|                                      |
|  (Ask)(Explore)(Check)(Sell)(You)    |  <- s2: nav (always there, quiet)
+--------------------------------------+
```
Removed from first load: yellow 3-line banner (becomes trust pill), headline + lead paragraph (replaced by the Lappy bubble), histogram and slider (moved to Q2), 4 hint chips (become rotating placeholder text in the bar), 3 quick-link cards (they already exist as nav tabs), the big textarea + language select (collapsed into the bar), footer text (moves into the Why trust this sheet and About).
Count at load: bubble, 6 tiles, bar, nav = well inside budget. 1 primary = tiles.

### 3.2 Q2, budget  (1 primary)
```
|  (you)                  [Code] (edit) |  <- your answer as a chip, tappable
|  ( Lappy )                           |
|  +--------------------------------+  |
|  | Nice. What is your budget?     |  |
|  +--------------------------------+  |
|                                      |
|            Up to  Rs 60,000          |  <- one big number, Fredoka
|   ▂ ▃ ▅ ▅ █ ▓ ▂ ▁ ▁   (bars)         |  <- existing histogram, 40px tall
|   ----------O-------------           |
|   9 laptops fit  .  [No limit]       |
|                                      |
|  [        Show me laptops  ->      ] |  <- P, sticky bottom, 52px
+--------------------------------------+
```
Hidden: the "Musts / Shoulds / Nice" legend and "No budget limit" link text (one small "No limit" chip stays). Keyboard stepper: slider has +/- 5k buttons (44px) for accuracy and accessibility.

### 3.3 Thinking
```
|  ( Lappy bobbing, eyes scanning )     |
|  "Looking at 9 laptops under 60k..."  |  <- real step text from the reply stream
|  [ Cancel ]                           |
```
Skeleton of the pick card fades in behind so layout does not jump.

### 3.4 The Pick (the heart). 7 things: picture, name, price, why-it-fits, 3 key specs, trust line, ONE primary action.
```
|  (you) [Code] [<=60k]    (edit)       |  <- trail, 1 line, scrolls horizontally
|  ( Lappy ) "Here is my #1 of 5."      |
| +----------------------------------+ |
| | [        laptop picture        ]  | |  1 picture (credit "Photo: 5.imimg.com"
| |                          1 of 5   | |    stays as 10px caption on the image)
| | ASUS VivoBook 15 (2022)           | |  2 name (Fredoka 18)
| | Rs 33,990      as of 10 Nov . 3d  | |  3 price + date (date = same row)
| | Good for coding: 8 GB RAM and     | |  4 verdict, one line (Nunito 15)
| | 512 GB SSD, Rs 26,010 under budget| |
| | 8 GB . 512 GB . 15.6" . 1.8 kg   | |  5 specs: max 3-4 inline, no tiles
| | machine-read . not human-verified | |  6 trust line (tap = sheet)
| |  [ Show me the next one  ->     ] | |  7 P
| +----------------------------------+ |
|   (Details)   (Compare +)   (Save)    |  <- s: 3 quiet text buttons below card
+--------------------------------------+
```
Rule: card body uses 2 type sizes only (18 Fredoka for name+price, 15 Nunito for everything else; captions 12 are labels, not body).
HIDDEN behind "Details" (a bottom sheet, 3.5): radar, owner-opinion ring and n, all reasons, musts met/missed, source chips, full specs, Owners say, Full check, Where to buy.
Swipe left/right (and the primary button) moves through picks; a dot row "o o o o o" shows position; "See all 5" is a small link in the Lappy bubble and opens a plain list (name, price, one verdict) for people who want to scan.

### 3.5 Details sheet (bottom sheet, 85% height, drag handle, ESC/back closes)
```
+--------------------------------------+
|              ---- (handle)           |
| ASUS VivoBook 15       Rs 33,990     |
| [Fit] [Owners] [Specs] [Trust]       |  <- 4 tabs, 44px, one visible at a time
|--------------------------------------|
| FIT:  radar (140px) + 3 reasons      |
|       Musts: 3 of 3 met              |
| OWNERS: ring "101 of 196 positive"   |
|       [ Owners say ... ]  (n shown)  |
| SPECS: full list, "?" when unknown   |
| TRUST: Catalog . 196 owner opinions  |
|        Not human-verified . price    |
|        10 Nov 2026 . photo credit    |
|        [ How I built this answer ]   |  <- receipt, still reachable
|--------------------------------------|
| [ Full check ]        [ Where to buy ]|  <- the two other actions live here
+--------------------------------------+
```
Nothing in the old card is deleted; every item has a home in one of the four tabs.

### 3.6 Follow-up replies as chat turns
"Owners say", "Full check", "Where to buy", "Compare" each append a Lappy bubble + one block, with a back-to-pick chip. Example "Owners say":
```
|  (you) [Owners say]                   |
|  ( Lappy ) "196 owners, 101 positive. |
|  Most mention: battery, keyboard."    |
|  +- topic list (3 shown) ----------+  |
|  | Battery   | 62% positive (n=71) |  |
|  | Keyboard  | 55% positive (n=48) |  |
|  | [ See all 7 topics ]            |  |
|  +---------------------------------+  |
|  [Back to the pick]  [Where to buy]   |
```
Compare: after the user taps Compare on 2+ picks, Lappy asks "Side by side?" and shows a 2-column mini table (price, RAM, storage, weight, owner positive %) with winner dots; radar is behind "Show shape".
Second opinion, where-to-buy, receipt and live web panels follow the same pattern: bubble (what it means) then a block (default collapsed to the top 3 rows) then at most 2 chips.

### 3.7 Free text / voice / photo (the bar)
```
focus ->  +--------------------------------+
          | laptop for coding under 60k... |
          | (cam) (mic)  [EN | Hinglish] (Send)|
          +--------------------------------+
```
On send, the request is a chat bubble from you; Lappy's "What I understood" becomes ONE line of chips ("coding", "<= 60k", "not HP") you can tap to edit, instead of the full panel with slider. Unclear input -> clarify.json: Lappy asks ONE follow-up with 2-3 tap answers. No match -> Lappy says so and offers "Raise budget by 10k" / "Drop one must" chips.

### 3.8 The other spaces, same grammar
- Explore: Lappy "Want to browse? Pick how." chips [By price map] [By brand] [Everything]. Price map is full-bleed; tap a dot = mini pick card (the 7-thing card).
- Check: Lappy "Paste a listing or a seller pitch, or snap it." One big drop zone (P), "Paste text" s. Findings arrive as: verdict bubble (one line, "Looks fair / Be careful"), then 3 findings, then "See all 9". 
- Sell: Lappy asks 3 questions one by one (model, age, condition) then shows the value as a range with its date and n.
- You: two big rows "My laptops" and "Share my experience"; PII-safe notices stay inline.
- Market and About: reachable from the menu (top right) and the Why trust this sheet, not on the home screen.

## 4. Desktop (1280px)
Centered conversation column 640px wide on a soft gradient (it stays a conversation, not a form). Right side, 360px, a quiet "My shortlist" rail appears after the first pick: thumbnails of picks seen, compare checkboxes, receipt link. The Details sheet becomes a right-side drawer (400px) instead of bottom sheet. Q1 tiles go 3 x 2. Nav moves from bottom to a slim left rail. Keyboard: Left/Right arrows move picks, 1-6 choose a vibe tile, / focuses the bar.

## 5. Removed or hidden by default (summary)
| Thing | Now |
|---|---|
| Yellow banner (3 lines) | one-line trust pill + sheet |
| Hero headline, lead paragraph | Lappy bubble |
| 4 hint chips | rotating placeholder in the bar |
| 3 quick-link cards | removed (nav already has them) |
| Footer disclaimer | Why trust this sheet + About |
| "What I understood" slider panel | 1 line of editable chips |
| Budget histogram on results | only in Q2 |
| Radar, ring, reasons (3), musts, sources, full specs | Details sheet tabs |
| 4 spec tiles | one inline spec line |
| 3 action buttons on card | 1 primary on card; others in sheet |
| List of 5 cards stacked | one pick at a time + "See all 5" |
| Receipt | Trust tab + Why trust this sheet (never gone) |

## 6. Motion (Emil: purposeful, fast, interruptible)
- Choreography: tile tap -> tile scales to 0.97 on press (100ms), selected tile lifts, others fade to 40% (150ms), your answer chip slides to the trail (220ms ease-out-quint), Lappy bubble enters from below 8px + fade (200ms), staggered next tiles 30ms apart. Nothing over 300ms.
- Pick-to-pick: card exits with a 24px horizontal translate + fade (160ms), next enters (220ms). Swipe is drag-follow with velocity threshold, interruptible mid-flight.
- Details sheet: transform-only slide-up 280ms ease-out, backdrop fade, drag-to-dismiss with rubber-band; focus trapped and returned.
- Lappy: idle blink every ~5 s, "thinking" eyes scan, "happy" bounce once on first pick. No looping animation while the user reads.
- prefers-reduced-motion: no translate or scale; cross-fade 120ms only; Lappy static.
- Mobile-native: inputs 16px (no iOS zoom), `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, hover styles under `(hover:hover)`, `dvh` for the sheet, safe-area padding for the sticky button, bar hides nav when keyboard is up.

## 7. Accessibility
Each Lappy bubble is `role="status"` and announced once; tiles are a radio group with 44px+ targets (they are 88px); the trail chips are buttons ("Change: Code"); sheet is `role="dialog" aria-modal`; swipe always has a visible Next button and arrow-key support; the dot row is decorative with "Pick 2 of 5" text for screen readers; contrast stays on existing theme tokens (check the 12px captions are at least 4.5:1 on glass).

## 8. Clutter budget check
| Screen | Primary | Secondary | Elements visible |
|---|---|---|---|
| Q1 | tiles (1 tap) | bar, nav | ~9 |
| Q2 | Show me laptops | No limit, edit chip | ~7 |
| Pick card | Show next | Details, Compare, Save (outside card) | 7 inside card |
| Details sheet | Where to buy | Full check, tabs | one tab at a time |

## 9. Risks
1. Linear flow can feel slow to expert buyers and to people who arrive knowing the model. Mitigation: the "Or just tell me" bar on every screen, and a "See all 5" list.
2. One-pick-at-a-time hides comparison, the point of a second opinion. Mitigation: Compare nudge after 3 picks, "See all" list, desktop shortlist rail. B (board) is stronger here; worth merging.
3. Chat metaphors imply a free-form LLM. Users may type anything. Mitigation: bubbles are clearly scripted; free text goes to the bar with the same "understood" chips.
4. Trust pill may be ignored where the old banner was loud. Mitigation: first session shows the pill expanded once (a 3 s "Saved prices from 10 Nov, not live" line), and the trust line stays on every card.
5. Hiding the radar and owner ring behind Details lowers delight; mitigation: the verdict line carries one owner fact ("101 of 196 owners positive") when it is the strongest signal, with n.
6. Bottom sheet tabs add a tap before Full check or Where to buy. Mitigation: the two are pinned as footer buttons in the sheet.
7. State: trail chips must replay the request correctly (edit Q1 after a result); needs a rerun with the old budget. Engineering cost medium (Thread already holds turns).
8. Hindi-English: tile labels and Lappy copy need Hinglish variants; keep copy short so translation does not overflow tiles.
9. Fixture bug found: price shows "₹0" when unknown; must show "₹?" and hide the "under budget" sentence.
10. Swipe conflicts with browser back-swipe and horizontal scroll of the trail; use edge dead-zones of 20px and `touch-action: pan-y` on the card.

## 10. Implementation sketch (files)
AskScreen becomes a small state machine (`step: vibe | budget | thinking | picks`), reusing VibePicker (as 2x3 grid), the budget block, Composer (collapsed bar mode), and Thread turns. New: `PickStack` (wraps Cards.tsx laptop card in "lite" mode + `DetailsSheet`), `TrustPill` + `WhyTrustSheet` (moves banner, footer, receipt link). CSS: layout.css only for the column and sheet; theme.css untouched.
