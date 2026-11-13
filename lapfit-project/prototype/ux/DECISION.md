# LapFit UX decision (merged from A, B, C and the audit; all four agents' critiques agreed on these)

## What the debate settled
- NO swipe-only deck and NO one-pick-at-a-time results (A, B, C all conceded: buyers compare 2-3 models; hidden comparison fails).
- Results = a BOARD: context chip, ONE hero ("Best fit for what you said", never "buy this"/"best for you"), 2 compact rows + "Show N more". Near tie shows "Tie" with two heroes. Deltas on rows are data-derived only ("₹4,000 cheaper · 0.2 kg lighter").
- Detail lives in ONE tabbed sheet (Fit | Specs | Trust), a bottom sheet on phones (max 2 levels, no sheet-in-sheet), a docked right pane at >= 1024px. The card face keeps 7 things only.
- Trust never hides: every hero/card shows the TRUST LINE (price date · n owner opinions · Not human-verified) via <TrustLine/>; every compact row shows its price date; "Where to buy" button itself carries "Affiliate" / "Live" labels when they apply; the receipt is reachable in <= 2 taps ("Why trust this?" > "How I built this answer"). The yellow banner becomes a one-line chip, expanded for 3 s on first visit, then an (i) button that opens the Trust sheet (also holds Market, About).
- Unknown price shows "?" (never "₹0").
- Ask = ONE screen (no wizard): 6 vibe tiles, budget slider with quick stops (30k / 45k / 60k / 80k / No limit), one sticky primary "Show me laptops", and a collapsed "Or just tell me" bar (type, mic, photo, language, Hinglish rotating placeholder). Banner, hero text, histogram, link rows, footer removed from first load.
- Nav: bottom bar on phone (Ask, Explore, Check, Sell, You), top pills on desktop. Market is a segment inside Explore [Map | List | Market] and a link in the (i) sheet; About in the (i) sheet.
- Check: keep the screen's input; output = verdict hero + 4 findings + "Show all". Sell: one question at a time (3 questions) ending in a "worth" hero: range + date + n, "?" if unknown. You: two segments [My laptops | Share experience], "..." button beside swipe-delete.
- Compare: sheet, max 3 columns, sticky first column, "Hide same" toggle, one data-derived line "Pick X if weight matters", radar behind "Shapes".
- Language: plain words; no "machine-read/n=/clamshell/Must/Should" jargon on the face (move into Trust sheet with plain explanation). Hindi/Hinglish must not overflow tiles.
- Phone perf: no blur on mid-range devices needed (use opaque fallbacks via @supports/prefers-reduced-transparency), chrome stack (header + sticky bar + tab bar) <= 25% of viewport height.

## Clutter budget (checked in the final review)
Ask first load <= 16 visible elements incl. nav. Result screen <= 20. Card/hero = 7 things. Row = 4 things.

## Shared building blocks (already written; use, don't rewrite)
- src/components/BottomSheet.tsx (props: open, onClose, title, children; class names .sheet, .sheet-backdrop, .sheet-head, .sheet-body; styles in src/sheet.css)
- src/components/TrustLine.tsx (props: asOf text, owners n, verified boolean, extra?)
Keep soft-playful style tokens in theme.css; Emil Kowalski rules (transform/opacity, ease-out, press .97, hover only inside (hover:hover), reduced motion).
