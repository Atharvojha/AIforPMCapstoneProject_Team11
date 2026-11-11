# DESIGN_SYSTEM — LapFit (Stage 2 draft)

Direction: **an evidence instrument, not an AI dashboard.** Calm, legible, methodology-led (cf. RTINGS test pages, Notebookcheck measurement tables; Linear/Stripe for hierarchy; shadcn/ui primitives, restyled). We reuse the earlier team's design principles: evidence-first, no verdict, honest absence, never colour-alone, state in the URL. We do not copy any reference's identity.

## 1. Principles
1. **Evidence before opinion** — every claim is a control that opens its proof.
2. **Classes never mix** — spec, lab, owner, manufacturer-claim are visually distinct everywhere.
3. **Unknown is a designed state**, not an empty one.
4. **Meaning is never colour alone** — shape + word + icon.
5. **Density with hierarchy** — summary first, detail on demand.
6. **No verdict chrome** — no trophies, no rank badges, no "best".

## 2. Tokens (light / dark; contrast checked ≥4.5:1 text, ≥3:1 UI at implementation)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F5F6F8 (cool paper) | #0F1216 | page |
| `--surface` | #FFFFFF | #171B21 | cards/panels |
| `--line` | #D9DDE3 | #2A3039 | borders |
| `--ink` | #14181F | #E8EBF0 | text |
| `--ink-2` | #4A5260 | #A5ADBA | secondary |
| `--accent` | #1F4FD8 (ultramarine) | #7FA2FF | actions, focus |
| `--ok` Supported/Met | #1B7F4B | #5FD39A | |
| `--bad` Contradicted/Not met | #B3261E | #FF8A80 | |
| `--mix` Mixed/Watch-out | #9A5B00 | #F2B84B | |
| `--unk` Insufficient/Unknown | #5B6578 | #9AA4B5 | hatch fill |
Semantic colours are separate from `--accent`. Dark values redefine tokens only.
**Type:** body *IBM Plex Sans*; data/IDs/conditions *IBM Plex Mono*; display (page titles only) *IBM Plex Sans Condensed* 600. Scale 12/14/16/20/28/40; line-height 1.5 body, 1.2 headings; ≤68ch lines; tabular numerals in tables. Fallback stacks: system-ui / ui-monospace.
**Space:** 4-pt scale (4,8,12,16,24,32,48). **Radius:** 4 (controls), 8 (panels); no pill-everything. **Elevation:** 0 (flat), 1 (drawer shadow). **Motion:** 120–200 ms ease-out; sheet spring critically damped; none for keyboard-triggered; honour reduced-motion.

## 3. Evidence-status encoding (never colour alone)
| Status | Icon | Word | Fill |
|---|---|---|---|
| Supported / Met | ✓ in circle | "Supported" / "Met" | solid --ok tint |
| Contradicted / Not met | ✕ in circle | "Contradicted" / "Not met" | solid --bad tint |
| Mixed / Watch-out | ◐ | "Mixed" / "Watch-out" | --mix tint |
| Insufficient / Unknown | ? in dashed circle | "Insufficient" / "Unknown" | **hatched** --unk |
| Dealbreaker | ! in triangle | "Dealbreaker (n reports)" | --bad outline + count |
| Spec mismatch | ≠ | "Spec mismatch (from spec sheet)" | --bad outline, dashed |

## 4. Source-class encoding (consistent glyph + label everywhere)
| Class | Glyph | Label | Notes |
|---|---|---|---|
| Manufacturer spec | ■ square | "Spec" | official fact |
| Manufacturer claim | ■ outlined + quote mark | "Claimed" | never independent |
| Independent lab | ◆ diamond | "Lab" | shows conditions chip |
| Owner report | ● circle | "Owner" | count + distinct count |
| Sibling / related variant | same glyph, dashed outline | "Sibling" | always labelled, separate lane |
Variant confidence badge: **Exact listing · Sibling · Family-only · Unknown**.

## 5. Components (variants / states / a11y)
- **VerdictChip** (4 states + dealbreaker/spec mismatch); role=status; text always present.
- **RequirementRow**: label, requirement, laptop value, status chip, source tag. Unknown never styled as pass.
- **CategoryRating**: headline label, coverage bar (0–100% with tick at 60% threshold), "how computed" button → MethodologyDrawer. No bare number outside drawer.
- **CoverageMap**: grid categories × {Spec, Lab, Owner}; cell = filled (n) / hatched (none). Keyboard: grid navigation, each cell announces "Battery, Lab: 2 measurements".
- **EvidenceLane** (For / Against / Not applicable): count header, list of EvidenceCards.
- **QuoteBlock**: exact text, highlighted span, source ID + date + variant badge; copy; "open source".
- **ConditionsTable**: rows = attributes (brightness, workload, refresh, power mode, Wi-Fi…); columns = claim, evidence; cell = value + ✓ comparable / ✗ not comparable / ? unknown.
- **EvidenceDrawer**: side panel ≥1024px, bottom sheet on phones; focus trap, ESC closes, returns focus to opener, `inert` background.
- **CompareTray / CompareTable**: sticky first column; no winner styling.
- **SkeletonBlock, EmptyState (says what would appear and why it's empty), ErrorState (retry + raw fallback)**.
- **ProfileCard**: editable chips and inputs; "how we read your note" diff.
Built on shadcn/ui primitives (Dialog/Sheet, Tabs, Table, Tooltip, Badge, Command for search) with these tokens; custom components for lanes, conditions, coverage.

## 6. Responsive & accessibility rules
Breakpoints 360 / 768 / 1024 / 1280. Mobile bottom nav (Home, Laptops, Claim, Profile, How it works). Tap targets ≥44 px. Contrast per WCAG 2.2 AA; focus ring 2 px `--accent` + 2 px offset; all drawers labelled; charts have text alternatives and tables; language attributes set for Hinglish quotes (`lang="en-IN"`; transliteration left unaltered). URL holds state (`?laptop=…&profile=…#evidence=ID`).

## 7. Content rules
Plain words ("Set aside" not "excluded by classifier"); name what it did ("3 of 8 applicable owners report short battery life"); never "AI says"; label AI-drafted text "Summary drafted by a model; every sentence links to evidence"; dates absolute (e.g., 27 Nov 2020); units always shown; no exclamation marks.

## 8. Open items
Logo/wordmark; illustration style (none planned); dark-mode review of hatch patterns; print/share stylesheet (Next).

## Added 2026-11-11
**Rating bar** (`components/bits.tsx`): 8 px track, fill colour by tone (ok ≥75% happy, mix 50–74%, bad <50%), value text `NN% · n owners`; with fewer than 3 owners show text only ("2 owners so far"). **Rank badge**: dark circle with the position. **Large text box**: 16 px, min height 110 px.


## Final state additions (2026-11-11)
New components, all built from existing tokens (`--accent`, `--ok`, `--mix`, `--bad`, `--unk`, `--line`, `--surface`, `--ink`, `--ink2`): **Segmented level control** (`.seg`, four buttons, `aria-pressed`) for Don't care / Nice to have / Important / Must have; **Number scale** (`ScaleBar`, `.scale`: red below our minimum, amber to comfortable, green beyond, a black tick for the chosen number, `role="img"` with a spoken label); **Stepper** (− / + buttons with `aria-label`, "Back to our suggestion"); **Listing claim card** (`.claim`: kind tag, verdict chip, exact claim in quotes, headline, details, owner quote, vendor links, source line, "Ask" box); **Save bar** (`.savebar`, sticky, slim); toggle chips use `aria-pressed`. Verdict chips reuse the evidence encoding: ok = checks out, bad = doesn't add up, mix = partly, dashed unk = only the seller's word. Phone width (390 px) checked: the nav wraps to two lines, no sideways scroll on any main screen; tables scroll inside their own container.
