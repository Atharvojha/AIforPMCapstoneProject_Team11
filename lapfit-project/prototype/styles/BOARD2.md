# Board 2 (append only)
### MOTION · start
Shipping src/motion.css (import after theme.css). It re-declares keyframes rise/float/grow/stamp/barin/fall/shimmer with Emil curves (transform+opacity only) and overrides durations on existing classes, so no one needs to change class names.
Classes for others: `.reveal` + `style={{--i:n}}` = stagger entrance; `.page-enter` on a screen root = page-change fade/slide; `.skeleton` (+ `.skeleton-line`) = shimmer placeholder; `.pop` = spring-free scale-in .96->1; `.press` = :active scale(.97) for custom buttons (.btn/.chip/.tile/.act/.starter already covered).
Tokens I define (fallbacks, theme may override): --ease-out, --ease-in-out, --dur-fast 150ms, --dur 220ms.
Lappy: I will touch Thread.tsx only for moodOf/Waiting/ErrorBanner (mood: thinking while pending, happy on cards/compare/sell_plan, oops on error, listening on mic). LAYOUT: please add `page-enter` class on the screen root, keyed by route.

### UX+COPY · start
Class names I add (please style in theme.css / layout.css): `.src-tag` with modifiers `.src-dataset` (machine-read owner opinions), `.src-web` (live, not verified), `.src-catalog` (saved snapshot); one small pill, 44px not needed (not interactive).
`.next-steps` = row under a result block: `.next-steps .next-hint` (text) + chip buttons using existing `.chip action`. `.lead` = first-read sentence at top of a block (bigger, plain).
I touch only blocks/*, ReplyActions, lib/summary. Honesty labels unchanged.

### VISUAL SYSTEM · start
theme.css is live (imported after styles.css; fonts linked in index.html: Fredoka headings via var(--font-head), Nunito body).
Tokens: --ease, --ease-spring, --dur-fast/--dur/--dur-slow (150/200/260ms), --radius(24) --radius-m(18) --radius-s(14), --glass, --glass-line, --tap(44px), --space-1..6, --focus, pastel set --pastel-lav/mint/peach/sky/lemon.
Classes: .btn (+.ghost .soft .danger .small), .chip, .card/.glass (+.tint-lav/mint/peach/sky), .badge, .pill; all use hover only in @media (hover:hover), press scale(.97), 44px targets, 16px inputs.
Accent darkened to #5b3fe0 / grad ends #0a8f86 so white-on-gradient is >=4.5:1. Please use var(--ease) in motion.css and do not redefine .btn/.card transitions.

### UX+COPY · done
Added blocks/Source.tsx (`.src-tag .src-dataset|.src-web|.src-catalog`), used in Evidence/Live/Web panels; `.next-steps/.next-hint` and `.empty-note` added in Cards/Findings (need styling by VISUAL agent). Copy softened for empty/error states. No tests changed. Suggestion for LAYOUT: Thread.tsx ErrorBanner copy could add a next step ("Try a shorter question").

### VISUAL SYSTEM · end
Added .src-tag(.src-dataset/.src-web/.src-catalog), .next-steps/.next-hint, .block-lead styles in theme.css. Relies on: layout.css for nav/screens, motion.css for entrance/skeleton.
Gap: media.test "copy ... Copy is blocked" fails, ReplyActions copy text (UX+COPY owns it) - please restore the /Copy is blocked/ wording or update that test. Suggestion to LAYOUT: set .app max-width wider on desktop; cards already min-width:0 so grids won't overflow on long names.
### MOTION · end
Done: src/motion.css (imported after theme.css), Thread.tsx (moodOf: happy on non-empty cards/compare/sell_plan, oops on empty cards, key-remount so mood change re-animates; skeleton under the waiting steps). tsc clean, vitest 196/196 at my run.
Relies on: theme.css tokens (--line, --solid, --surface, --radius); LAYOUT for `.page-enter` on screen roots.
Gap: Composer mic never sets Lappy to `listening` (Composer is LAYOUT's): render <Lappy mood="listening"> when recording. Hover lifts in styles.css are bare :hover; I neutralise them under (hover:none) in motion.css.
Suggestion to LAYOUT: key the screen root by tab and add className="page-enter" for the page transition; to UX+COPY: after a result put `.reveal` stagger index i on next-steps so they land last.

### LAYOUT+MOBILE · mid/end
layout.css imported last in main.tsx (after theme, motion). Added `page-enter` on every screen section (MOTION), `.screen-lead`, `.empty-state`, `.tray-count/.tray-names`, nav `.nav-label`. Tokens: --nav-h 68px, --gutter. Sticky stack on phone: bottom nav > tray > composer/map-actions, all offset by --nav-h + safe-area.
Relies on: theme.css .btn/.chip/--tap, motion.css .page-enter. Gap: media.test "Copy is blocked" failed earlier (UX+COPY wording); it passes now (196/196).
Suggestion for MOTION: bottom-nav icon bump and tray-in are in layout.css with reduced-motion guards; do not duplicate. For UX+COPY: ErrorBanner next-step text is yours to add.
