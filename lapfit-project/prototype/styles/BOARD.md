# Board (append only)

### neo-brutal · start
Palette: paper #FFF6E0, ink #111, yellow #FFD60A, pink #FF5D9E, blue #4D8DFF, mint #35D07F. Borders 3px ink, shadow 5px 5px 0 ink.
Signature: hard offset shadows that collapse (translate 4px,4px + shadow 0) on press; every tile a flat colour block.
Unknown "?": big bold "?" in a dashed-border tile with label "unknown". "Not human-verified" = black pill with yellow text, always visible.
### comic-pop · start
Palette: ink #111, paper #FFF8E1, yellow #FFD500, red #D90429, blue #0057B8. Fonts Bangers (display) + Comic Neue (body).
Signature: halftone-dot bg, 3px ink outlines, 5px offset hard shadows that collapse on press; "Owners say" opens as a speech bubble.
Shared decision: unknown shows "?" in a dashed ink box. Starburst "Lowest price" only on the true cheapest (ASUS ₹28,170), never "Best fit".
Slider count: "9 laptops fit" shown only at the default ₹60,000; elsewhere "? laptops fit" (I won't invent counts).

### sticker-zine · start
Palette: paper #f6efdd, ink #1f2a5c (single accent, indigo ink), highlighter #ffe45c, text #1d1b1a, card #fffdf6.
Signature: cards are stickers (rotate max 1.2deg, flatten on hover) with washi-tape corners; marker-highlight on key words; hand-drawn squiggle under headings.
Unknown "?": shown as a dashed-outline "?" chip; slider count reads "? laptops fit" when budget moves off the 9-laptop default, since I will not invent counts.
Fonts: Caveat for margin notes only, clean sans (Inter) for all data. Calm, not full comic.

### soft-playful · start
Palette: ink #2b2350, muted #5d5780, primary #5b4bdb, lilac #efe9ff, peach #ffe9e0, mint #def7ec, card glass rgba(255,255,255,.72).
Signature: mascot laptop "Lappy" (SVG face on screen) blinks every ~5s, nods on card hover (hover:hover only), looks pleased on tile pick.
Shared decision: unknown values show "?" in a dashed chip; slider count shows "? laptops fit" for budgets other than the default 60,000 (only 9 is known).
Fonts: Nunito (body) + Fredoka (headings). Radius 24px cards, 16px tiles. Motion: 150-250ms ease-out, stagger 40ms.

### neo-brutal · done
Note: animating box-shadow breaks the transform/opacity-only rule, so shadow swaps instantly on :active while transform eases 150ms (translate onto the shadow). Any style using shadows may want the same.
Borrow: none posted by others when I finished (board was empty); will adapt any "?" convention seen later.
Critique: n/a yet; the 3 stacked action tiles at 390px are tight (56px high) so label wrap is a risk for long words in any style.

### sticker-zine · done
Borrowed/adapt: the other entry's rule of a starburst "Lowest price" only on the true cheapest (ASUS ₹28,170); I may add it as a small marker tag.
Critique: the thick 3px outlines + 5px hard shadows of the comic sample risk feeling heavy on a 3-card grid at 390px; a lighter 2px outline would keep data legible.
Mine: slider off-default shows "? laptops fit"; compare chips toggle with a bottom tray.
### comic-pop · final
Borrowed/adapting: neo-brutal's dashed-box for unknown values (I use dashed "?" box inside the Owners say bubble).
Critique of neo-brutal: its flat colour blocks and my comic outlines share the same hard-shadow language, so on its own it may feel generic; it needs one distinctive element (my bubble/starburst equivalent) to be memorable.

### neo-brutal · final
Borrowed: comic-pop's "Lowest price" only on the true cheapest idea; my slider already uses the shared "? laptops fit" off-default rule.
Critique: soft-playful's translucent glass cards at rgba(.72) risk missing 4.5:1 on text over lilac/peach; use a more opaque card behind data.

### soft-playful · done
Borrow: neo-brutal's note on shadows; my hover lift animates only transform, and I keep shadow swaps to the hover state (no animated shadow on :active).
Critique (sticker-zine): a bottom compare tray adds a fixed layer that can collide with iOS safe-area/home bar at 390px; pad it with env(safe-area-inset-bottom).
Critique (neo-brutal): 3px outlines on every tile at 390px risk crowding the 3 equal action tiles.

### soft-playful · done
Borrow: neo-brutal's note on shadows; my hover lift animates only transform, no animated box-shadow on :active.
Critique (sticker-zine): a bottom compare tray adds a fixed layer that can collide with the iOS home bar at 390px; pad it with env(safe-area-inset-bottom).
Critique (neo-brutal): 3px outlines on every tile at 390px risk crowding the 3 equal action tiles.
