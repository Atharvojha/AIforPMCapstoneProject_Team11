# D · Auditor: LapFit as it is today (round 1)

No layout proposed here. Evidence: screenshots in `.../scratchpad/shots/D/` (ask, explore, check, sell, you, market, about, w_* at 500px, g_* galleries, ask_1280, short_1280) + code read (AskScreen, layout.css, theme.css). Lenses: design-critique, accessibility-review, first-time-buyer walk.
CAVEAT: headless Chrome will not go below ~500px wide, so the 390px shots are clipped on the right (banner, buttons, 5th tab cut). All "phone" findings use the 500px shots; a true 390px pass (devtools emulation) is still owed. Viewport assumed 390x844.

## 1. Clutter inventory (what is visible at first sight, no interaction)
Counted = distinct things a person must parse. Budget from brief: card <= 7, screen <= 1 primary + 2 secondary.

| Screen | Visible elements | Tappable | Primary competing? | Verdict |
|---|---|---|---|---|
| Ask (home) | ~32: banner, mascot, H2, lead, "What's it for?", 6 vibe tiles, budget label+value, 9-bar histogram, slider, count line, CTA, divider, 4 hint chips, 3 quick links, textarea, camera, mic, language select, Ask, footer (2 lines + 2 links) | 20 + 5 nav = 25 | YES: "Show me laptops" vs "Ask" send vs 4 chips | FAIL (target 3) |
| Result: shortlist | understood panel (chip, budget again with slider+histogram, link, jargon paragraph) ~10, then cards | per card 7 + Compare | no clear single next step | FAIL |
| Result card (rank 1) | ~28 (below) | 7 | "Where to buy" is filled, but Compare, Owners say, Full check, Full specs, 2 chips all compete | FAIL (target 7) |
| Compare | radar + 3 legend items + 3 mini cards + 12-row x 3-col table + 2 footnotes + receipt | 3 | none (no verdict by design) | HEAVY |
| Owner voice | header, ring/bar per topic, 3 quotes each repeating a 2-line source, empty "Reports from owners" card, live-web panel, receipt | ~4 | none | HEAVY |
| Explore | title, lead, slider+histogram, scatter ~13 dots, 5+ brand chips, hint line, 2 buttons, list link | ~25 | Compare (disabled) vs "Show what fits" | MEDIUM |
| Check | title, lead, dashed drop zone, divider, textarea, "add details" link, disabled CTA | 4 | single CTA, ok | BEST screen |
| Sell / You / Market / About | not clutter; You is empty (2 tabs + "Add a laptop") then ~700px of blank | few | ok | LOW clutter, low value |
Global chrome on every screen: amber snapshot banner (~90px = ~11% of an 844px phone), footer disclaimer + "Market / Sources, privacy and limits" links, floating bottom nav (covers the last ~80px of content).

### Result card anatomy (rank 1 shortlist, 500px shot) = ~28 items
rank badge, Compare pill, photo (330px tall = 39% of the phone viewport), photo attribution, name, "8 GB / 512 GB" subtitle, "Not human-verified" pill, price, "as of 10 Nov 2026 . 3 days old" chip, 4 spec tiles (icon+value+label each = 12 sub-items), radar (6 axis labels + polygon), ring "196" + 4-line caption, 3 reason bullets, 2 source chips, "Full specs" expander (OPEN by default, 6 lines), 3 action buttons.
Duplication in ONE card: owner opinions said 4x (ring, bullet, chip, Full specs); RAM/storage 4x (subtitle, tiles, bullet, Full specs); price 2x; screen/weight 3x. Text sizes in body: >= 5 (name, price, tile value, tile label, bullets, chip, caption, axis labels). Brief allows 2.
Fold test: at 844px tall the first card's PHOTO is mid-screen; name at ~y=1010, price at ~y=1100, ring and verdict at ~1300+. The user sees the "What I understood" panel (370px, repeats slider+histogram they just set) and a picture before any price.

## 2. Top 10 UX failures, ranked (impact x frequency)
1. **No answer above the fold.** After "Show me laptops" the screen shows an echo panel + a 330px photo; price, name and "why it fits" need a scroll. First-answer is a picture, not a pick. (Ask -> result)
2. **Result card is a dashboard, not a verdict.** 28 items, 4 restatements of the same fact, Full specs open by default; the one thing a buyer wants ("is this the one for me? why?") is bullet 2 of 3, visually equal to chips.
3. **"What I understood" re-renders the whole budget control** (histogram + slider + count + jargon "Must filters, Should ranks higher, Nice is a small bonus") above every result. Edit-in-place is good; showing it open is noise. Must/Should/Nice is internal vocabulary.
4. **Home asks four ways at once**: 6 vibe tiles + slider + CTA, 4 sample chips, 3 side-quest links, then a free-text/voice/photo composer. Two "go" buttons (Show me laptops / Ask), no order. Honest-but-visual hierarchy is flat: everything is a rounded white pill.
5. **Trust information is loud AND scattered.** Banner (global, 3 sentences), "Not human-verified" pill per card, "as of" chip, "machine-read" in bullets, "Pictures are from the web..." footnote, receipt open dashed box, 3x repeated Zenodo/CC BY source line per quote. Honest, but repeated rather than organised; users learn to ignore all of it, which is the opposite of the goal.
6. **Compare table is desktop-in-a-phone**: 12 rows x 3 columns at 500px wraps words ("clamshel / l", "Not / enough / evidence"), radar + legend + cards + table are four views of one thing, "best" marks are tiny. No "what differs" summary; identical rows (RAM 8/8/8, Warranty 1yr x3, Type) are shown anyway.
7. **Owner voice is evidence without a headline.** Bars + n = 45 are good, but quotes are truncated stubs ("Battery...") each carrying a 2-line citation; an empty "Reports from owners on LapFit" card is shown; no one-line takeaway ("Most praise battery; 2 of 45 negative").
8. **Chrome eats the phone**: sticky banner (~90px) + floating bottom nav (~80px, overlays card actions: see shortlist 500px shot, rank-2 Compare hidden behind it) + composer on result pages leaves ~55% of 844px for content. Market/About exist only behind a 24px text link in the footer.
9. **Empty/short screens are unfinished.** You = two tabs + one button then ~700px blank; Check/Explore leave the footer floating mid-screen (disclaimer at y~1180 on an 1900px page); no first-use guidance, no example output ("what will I get?").
10. **Jargon and language**: "clamshell", "machine-read", "n = 0", "Lightness", "Must/Should", "Zenodo record", "Owners ?" on a radar axis. Hindi-English users get one Hinglish chip and a tiny unlabeled `English` dropdown; all UI text is English. First-time Indian buyer thinks in budget, RAM, brand, "is it good for my kid's college", battery, service centre.

## 3. Accessibility pass (WCAG 2.1 AA, from code + shots; contrast values are estimates, verify with a tool)
| Finding | Where | Sev |
|---|---|---|
| Disabled CTAs use white text on pale pastel gradient (~2:1): "Check it", "Ask", "Compare" | Check, composer, Explore | High |
| `.link{min-height:24px}`: footer links ("Market", "Sources, privacy and limits"), "Show the list version", "No budget limit" are < 44px | footer, Explore, understood panel | High (brief: 44px) |
| Scatter dots ~24-28px, adjacent/overlapping (4 near 60k); out-of-budget dots pastel-faded ~1.5:1; list version exists but is a small text link | Explore | High |
| Colour as only meaning: brand dots, radar series colours in compare (legend ok), green/red owner bars (text counts present: good) | Explore, compare | Med |
| Small grey text: axis labels (~11px), spec tile labels, `.tray-names` .78rem, ring caption | cards | Med |
| Bottom nav floats over content with no scroll padding visible at end of long results | all | Med |
| Reduced-motion handled in theme/layout/motion/styles (good). Focus outline set on `main` only; ring visibility on tiles/chips not verified | all | Check |
| Slider + histogram: label "Budget up to ₹60,000" present; histogram bars decorative (should be aria-hidden) | Ask, Explore | Low |
| Positives: 16px inputs (no iOS zoom), 44px minimums on .btn/.chip/composer/nav, emoji aria-hidden, sr-only page h2s | | |

## 4. First-time buyer in India, mid-range phone, low patience (walk)
- 0-3 s: sees an amber paragraph of caveats before the product's promise. Reads "Find a laptop you can actually trust": good line, but sits below the banner and mascot (112px). Mid-range Android: glass blur + gradients + 5 simultaneous animations (page-enter, skeleton, reveal) are paint-heavy; no evidence collected on jank, test on a 3 GB device.
- 3-15 s: picks "Study", slider already at 60k (default, he may not notice it is a filter). Taps "Show me laptops". Cost to first result: 2 taps, good. But "Code"/"Game" ambiguity: which tile means "college + Excel"? Tiles are 3 words total of context.
- 15-40 s: results arrive: understood panel, then photo. Scrolls. Price at ~1100px. Radar: no legend for what the shape means except a footnote 700px below ("The shapes compare these laptops with each other"). Ring says 196, caption says 101 of 196 positive: which number matters?
- 40-90 s: wants "which of the 5?" Needs Compare: taps "+ Compare" on two cards (pill at top right, scrolled away from tray?), a tray appears; table is a long wrap. No pick is named, honest by design but no "if you care about X choose Y" shortcut.
- Trust: the honesty mechanics work (dates, n, "?") but the user cannot tell which warning matters (price is 3 days old vs specs unverified vs opinions machine-read). Result: either distrust everything or skip everything.
- Hindi/Hinglish: can type Hinglish in free text (chip proves it) but UI never says "Hindi chalega". Language picker is an unlabeled select. Prices in ₹ with western grouping (₹33,988); lakh grouping would only matter above 1,00,000 (Macbook shows ₹86,990, fine).
- Drop-off risk points: (a) banner wall, (b) result fold, (c) card length (a 5-laptop result is ~6,000px tall), (d) compare table wrap.

## 5. What is good (keep; do not break)
Check screen (one drop zone, one CTA, honest lead "I never say buy / don't buy"); the vibe tile idea; Lappy mascot + gradient type; "n = ..." owner bars; "?" for unknown; photo attribution; receipt content; 44px intent across CSS; reduced-motion handling; `You` list is local-only and says so; "Show the list version" fallback for the map.

## 6. Scorecard rubric (0-5; score every round-1 proposal on these, and re-score the build)
Score what a first-time buyer sees at 390px WITHOUT scrolling or tapping unless stated. Half points allowed.

| Dimension | 0 | 3 | 5 | Test |
|---|---|---|---|---|
| Clarity | cannot say what screen is for | purpose clear after reading | purpose clear in 3 s, one sentence | 5-second test: "what can you do here?" |
| Clutter | > 25 visible elements per screen/card | ~10-15 | card <= 7, screen <= 1 primary + 2 secondary | count per brief budget; deduct 1 per extra primary, 0.5 per repeated fact |
| Hierarchy | all equal weight | main item distinct, rest noisy | exactly 3 levels, eye path obvious, <= 2 type sizes in card body | squint test |
| Speed to first answer | > 4 taps or answer below fold | 3 taps, answer after scroll | <= 2 taps AND name+price+why visible without scroll | tap count + fold check at 844px |
| Trust visible | trust info absent or hidden | present but scattered/ignored | one consistent trust line per answer + 1-tap "Why trust this?" with date, n, source, not-verified, receipt reachable | checklist of brief's honesty items; any missing = max 2 |
| Mobile thumb reach | key actions top of screen, < 44px | actions reachable, some < 44px | primary + nav in lower 40% (thumb zone), all >= 44px, no overlap with fixed bars | reach map + target audit |
| Delight | decor only | friendly tone | motion/mascot explains state, respects reduced-motion, adds no clutter | Emil checklist (ease-out, < 300ms, interruptible) |
Bonus/penalty: +0.5 per removal that is explicitly named; -1 if a hard constraint (honesty, features reachable, 44px, no invented data) is violated; -0.5 for any invented copy/data in wireframes.

### Baseline: today's app scored on the same rubric
| Dimension | Ask home | Result card | Compare | Check | Avg note |
|---|---|---|---|---|---|
| Clarity | 3.5 | 2.5 | 2.5 | 4.5 | good headline, mixed purpose on home |
| Clutter | 1.5 | 1 | 1.5 | 4 | cards 28 items |
| Hierarchy | 2 | 1.5 | 2 | 4 | too many equal pills |
| Speed to first answer | 3.5 (2 taps) | 1.5 (below fold) | 2 | 3.5 | |
| Trust visible | 3 | 3.5 | 3 | 3.5 | thorough but scattered |
| Thumb reach | 3.5 | 3 | 2.5 | 3.5 | nav good, actions buried |
| Delight | 4 | 3 | 2 | 3.5 | mascot + gradients keep |
| **Total /35** | **21** | **16** | **15.5** | **26.5** | target for redesign >= 28 on Ask/Card/Compare |

## 7. Questions every proposal must answer (use as review checklist)
1. What is the single primary action on each screen at first load, and what is hidden?
2. Where do price, name, and the "why it fits" sentence land at 390x844 with no scroll?
3. How does each honesty item (not human-verified, price date, n, "?", source labels, live-not-verified, photo credit, receipt) appear, and in how many taps?
4. How many taps from home to a named shortlist, and to a compare view of 2 items?
5. Where do Market, About, My laptops, Share experience, Sell live now that nav is reduced?
6. What happens on 390px AND 1280px, with long names, empty results, `degraded`, `nomatch`, `clarify`, `not_laptop` fixtures?
7. Does anything rely on gesture-only (swipe) with no button equivalent; does anything animate on keyboard-triggered actions?
8. What is the language story (Hindi-English), and which words from the jargon list (Must/Should/clamshell/machine-read/Lightness) are replaced by what?

## 8. Risks for any redesign (auditor's view)
- Moving trust into a drawer risks users never opening it: keep a one-line visible trust summary per answer (date + "not verified" + n).
- One hero pick contradicts the product's "I never say buy" posture: framing must be "best fit for what you said", with reasons, not a verdict.
- Bottom sheets + sticky bars + floating nav can stack three fixed layers on 844px: budget total fixed chrome <= 25% of viewport.
- Swipeable cards hide the other 4 results; keep a visible count and non-gesture alternative.
- Conversation flow adds taps for the experienced; keep a one-shot path (type or vibe + budget -> results).
- Tests: the 390px screenshot method is broken (clamped to ~500); use device emulation before scoring pass 2.
