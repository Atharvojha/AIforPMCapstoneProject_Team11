# LapFit experience design (v0)

Design reasoning for `ui/index.html`, written so the team can defend each choice in the presentation and in the AI-in-UX discussion. Sources: Emil Kowalski's design-engineering rules and Apple's fluid-interface and design-principles talks, applied to a review-reading tool.

## The one idea
**Show evidence, never a verdict.** The student's problem is trust: "which reviews are about me, and what am I not seeing?" So the product never ranks laptops. Every claim opens the exact words reviewers wrote. This is Apple's *Agency* and *Responsibility* applied to AI: the student stays in control, and the AI's work is inspectable.

## Decisions
| Decision | Principle | Where it shows |
|---|---|---|
| No "best laptop", no score, no ranking | Agency, Responsibility, Purpose | Footer line; no sort or winner anywhere |
| Every claim is a button that opens the quotes behind it, with the used words highlighted | Understanding; verify before trust (course rule: no AI output used until verified) | Evidence sheet |
| "Dealbreaker" defined in plain words on the page (2+ applicable reviewers); a single complaint is a **watch-out** | Clarity; encodes the HMW ("dropped a good option over one unverified complaint") | "How we read the reviews", section headings |
| Same section order in every column | Familiarity, grouping and mapping | Comparison columns |
| Evidence strength meter + a strip with one tick per review (applies / partly / doesn't) | Show the state; make thin evidence visible, not hidden | Top of each card |
| "None found in these reviews" instead of "No problems" | Honesty about absence | Dealbreakers block |
| Different-config reviews are visibly marked and dimmed, with the reason | Wayfinding: why is this review ignored? | Evidence sheet |
| Source toggle: **Rules engine** vs **AI**, with a note on what each can and can't do; AI is disabled until it has really been generated | Disclose that it is AI; no fake demo data | Header, note under section 3 |
| Meaning is never colour alone: each tone has an icon and a word | Accessibility | Dealbreaker / watch-out / strength / disagree / gap |
| State lives in the URL (`#p=…&l=…&s=…`) | Forgiveness: refresh or share and keep your picks | `sync()` / `restore()` |

## Motion (every animation answers: how often, why, how)
| Element | What it does | Numbers | Reason |
|---|---|---|---|
| Buttons and chips | `scale(.97)` on press | 140ms ease-out | Respond on press, not release |
| Evidence sheet, open | Spring from off-screen to rest, no overshoot | response .42s, damping 1 | Occasional action: a real entrance, critically damped |
| Evidence sheet, close | Same path out, **faster** | response .30s | Exit leaves quicker than it arrived; spatial consistency |
| Sheet drag (phones) | Tracks the finger 1:1 from where it was grabbed; pointer capture; one pointer only | n/a | Direct manipulation |
| Sheet release | Release velocity goes into the spring; the flick is projected forward (`v/1000 · 0.998/(1−0.998)`) to choose open or close; light bounce (damping .8) only after a fast flick; resistance (rubber band) when pulled up | measured: 0 px overshoot at rest, 2 px after a flick | Interruptible, momentum-aware |
| Grab mid-flight | A new drag cancels the spring and starts from the live position | n/a | Never lock input during a transition |
| Result update | Old columns fade with 2px blur (140ms), new sections rise 8px and fade in, 45ms stagger | transform + opacity only | Blur hides the swap so it reads as one thing changing |
| Source toggle | The thumb slides between segments | 260ms ease-in-out | Moving on screen uses ease-in-out |
| Header | Translucent blur; content scrolls under it | `backdrop-filter` | Material hierarchy |
| Profile row | Fades at an edge only when more content is hidden there | scroll-driven | Scroll edge effect instead of a hard divider |

Rules held throughout: no `ease-in`, nothing grows from `scale(0)`, only `transform` and `opacity` animate, hover effects are gated to real pointers, no animation on things keyboard users trigger (they get a 120–140ms fade, no travel), and a timer cap forces any spring to its end state so the UI can't be left stuck.

## Typography and layout
System font stack. Size-specific tracking: −0.028em on the headline, −0.012em on section titles, 0 on body, +0.06em on small uppercase labels. Line height tightens as size grows. Spacing in `rem`. Tap targets are at least 44px (the review strip and the close button use padding or a hit-area pseudo-element).

## States and edge cases handled
No laptop selected; fourth pick replaces the first; thin evidence; a section with nothing in it is omitted (and "none found" is shown for dealbreakers); data failed to load (retry); AI view requested before AI data exists; long names wrap; narrow screens swipe between laptops with scroll-snap; wide screens put up to three side by side; evidence opens as a bottom sheet on phones and a side panel on desktop.

## Accessibility
Landmarks, one `h1`, radio groups with arrow keys and a roving tab stop, a labelled modal dialog with focus trap, focus returned to the opener, `inert` on the page behind, Escape closes, one polite live region for result changes, review text inserted with `textContent` only (no markup injection). Honours `prefers-color-scheme`, `prefers-reduced-motion` (fade only), `prefers-reduced-transparency` (solid header) and `prefers-contrast`.

## Checked and not checked
Checked in the in-app browser: narrow layout, 1280px layout (via an iframe), dark mode, sheet open/close by click, scrim, Escape and drag, focus return, URL state, the empty state, console errors, role and label audit, spring maths run offline.
**Not checked:** a real phone (touch and iOS Safari), a screen reader, a slow-flick gesture (the browser tool can't produce one), reduced-motion and high-contrast emulation, and any real customer. These belong in the customer sessions.

## Known gaps (honest)
- Sections are not row-aligned across columns, so a short column leaves white space. Aligning rows (subgrid) would speed comparison.
- Conflict views show whole reviews; the key sentence is not highlighted yet.
- Profiles are the 12 presets. A custom profile needs the live AI path.
- The AI view stays disabled until `lapfit.py` has been run with credentials.
- The rules engine over-calls problems (for example it reads "average" as negative). That is expected, and it is the baseline the AI has to beat.
