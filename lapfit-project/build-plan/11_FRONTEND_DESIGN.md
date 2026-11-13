# Frontend design: delight without dishonesty

Written 13 Nov 2026, **rebuilt the same day (version 3)** after feedback that the first redesign only changed colours and still had too many fields.

## 0f. Follow-up questions with context and guardrails (13 Nov 2026)

Problem (user test): after a recommendation, "Will this last for 8 years?" and "The one you showed" were answered with "Which laptop?" because every request was stateless.

How it works: the app attaches `focus` (the laptop on screen: the best fit, a laptop opened in Details, or the subject of the last answer) and `shown` (up to 6 laptops) to typed text: ids and names only, never what was typed. The server checks the ids against the catalog and takes names from it. A rule (no AI model, so no extra delay) decides if the text is a follow-up: lifespan, why this one, upgrade, problems, suitability. New searches ("show lighter ones"), other laptops named, sales and statements are not follow-ups and route as before. If several laptops are shown and none is in focus it asks "Which laptop do you mean?" with their names as buttons.
The answer (`laptop_answer`) has sections, each with a source tag: Catalog (recorded facts, unknowns as "?"), Dataset (owner opinion counts, machine-read), Web (live search, "Live, not verified", links, dates). The question text is not sent to the web search, only the laptop name and a fixed topic phrase; the maker's own website is dropped for lifespan, problems and upgrade questions because it is advertising.
Guardrails and how the app says them: it only talks about laptops; it never predicts or promises years ("Nobody can tell you how many years a laptop will last, and I will not guess"); it never tells you to buy; it shows "I took this to mean <laptop>"; a visible chip "Asking about: <laptop> ✕" above the input lets the person see and clear the context; a line under the input states the limits; every answer ends with "What I can and cannot say"; the About page has a "Follow-up questions" section.
Tests: 11 backend (detection table from the screenshot, context validation, no promise of years, web question text never leaves, "why this one" uses only the person's needs, choices when ambiguous, no change without context) and 14 frontend. Verified on the live system with the exact question from the user test.
Known limits: only five question types are recognised, other free-form questions still go through the normal router; after a Compare there is no focus until a laptop is opened; web results are search excerpts and can still be low quality; each new laptop and topic costs one web search per day (cached 24 hours, shared daily limit).

## 0e. Version 7: showing how laptops really differ (13 Nov 2026)

Problem: the photos of mid-range laptops all look alike (silver lid, white background). Research (true-scale overlays such as WhatIsMyScreenSize, small multiples on one shared scale, highlight what differs, avoid glyphs whose parts have different ranges) led to four visuals, previewed first as a private artifact and then integrated:

| Visual | Where | Drawn from |
|---|---|---|
| Difference tags ("Lighter than 7 of 13", "Lightest of the 8") | Hero card under the price | Counts over laptops that have the value |
| Spec portrait (lid width from screen size, base thickness from weight, vents and glow for dedicated graphics, Hz badge) | Hero card picture; "Show photo" switches to the web photo | Recorded specs; colour is the brand's, labelled "Drawn from the specs, not a photo" |
| Screens at the same scale next to A4 paper | Top of the Compare sheet | Recorded diagonal, assumed 16:9 (stated) |
| Weight as one-litre water bottles, and position strips (price, weight, screen, RAM among all laptops) | Detail sheet, Fit tab | Weight (1 L of water is about 1 kg); recorded values |

Rules: nothing is invented (unknown stays "?", a tag or strip needs at least 5 and 3 laptops with the value), the 16:9 assumption and the not-drawn list (thickness, bezel, real colour, ports) are written on the screen. Rows in the list keep the photo thumbnail. Code: `lib/looks.ts` (all logic), `components/viz/{SpecPortrait,ScaleScreens,Looks}.tsx`, `looks.css`, `state/useLooks.ts`. Backend: card specs gain battery, refresh rate and graphics type; the catalog list gains screen, weight, battery, refresh and graphics (migration 17); compare laptops gain screen and weight.
Tests: 11 frontend and 2 backend. Not checked visually: the Detail sheet strips and bottles on screen (covered by tests), dark mode, a real phone. Known limit: mid-range laptops with the same screen size still look alike in the portrait; the tags and strips carry the difference there.

## 0d. Version 6: new layouts and flow (13 Nov 2026)

Owner feedback: "very cluttered... the layouts and the user experience are the worst" (style was fine). Process: three agents each proposed a full alternative (A one-question-at-a-time conversation, B decision board, C thumb-first app with sheets), a fourth audited the current UI (baseline clutter: Ask first load about 37 visible elements, result screen about 40, a card 28; scores Ask 21/35, card 16, compare 15.5). Each then critiqued the others and scored them on the audit rubric (A 29, B 27 to 28, C 28 to 29 of 35, all within noise). They agreed on a merge, written in `prototype/ux/DECISION.md`; four builders implemented it (board in `prototype/ux/BOARD4.md`).

What changed: Ask is one screen (6 tiles, budget with quick stops, a collapsed "Or just tell me" bar, one sticky button); the banner became a one-line trust chip plus an (i) sheet holding the receipt, Market and About; results are one hero ("Best fit for what you said", ties show two) plus compact rows with data-only deltas, every one with the trust line; details in one tabbed sheet (Fit, Specs, Trust); compare is a 3-column sheet with "Hide same"; Explore has Map, List and Market segments; Sell asks one question at a time and ends in a worth hero; Check shows a verdict plus 4 findings; "What I understood" folds to one line.
Rules kept: swipe-only decks were rejected (hide comparison); the trust line (price date, n, not human-verified) is on every hero, card and row; unknown price is "?"; the price no longer counts up from "₹0" (a displayed number that did not exist).
Checked: type check, 204 frontend tests, build (85 KB gzip JS, 17 KB CSS), phone and desktop screenshots of Ask, results and compare. Not checked visually: the Detail and Trust sheets open, Explore, Sell later steps, You swipe, dark mode, a real phone, the 1024 px docked pane, clutter counts by a tool (the Ask builder counted about 14 groups, 18 individually, against a budget of 16).
Known gaps: the Affiliate tag in the Detail sheet only shows when the reply carries a receipt that says so; the language switch is voice language only (the app has no translation); the card face no longer has Owners say, Full check or Where to buy (they are in the Detail sheet).

## 0c. Version 5: soft-playful style, built by four coordinating agents (13 Nov 2026)

You asked for a comic style sample and a choice. Four samples were built (`prototype/styles/`: comic-pop, sticker-zine, neo-brutal, soft-playful) from one shared brief; you chose **soft playful**. Four agents then applied it to the real app, each owning separate files and talking through `prototype/styles/BOARD2.md`, following Emil Kowalski's skills (transform/opacity only, ease-out curves 150 to 250 ms, press to .97, hover only where hover exists, reduced-motion safe, 44 px targets, 16 px inputs, safe areas).

| Role | Files | Result |
|---|---|---|
| Visual system | `theme.css`, `index.html` | Fredoka and Nunito, glass cards, 24 px radii, pastel tints, pill buttons, dark-mode tokens, source labels |
| Motion | `motion.css`, `Thread.tsx` | 50 ms entrance stagger, press states, bars and rings drawing in, shimmer loading card, Lappy happy or oops by result, reduced-motion safe |
| Layout and mobile | `layout.css`, `App.tsx`, `screens/*` | Sticky glass header, floating bottom bar on phones, picks tray, wider desktop layout, empty states |
| UX and copy | `blocks/*`, `ReplyActions.tsx`, `Source.tsx` | Dataset, Web and Catalog labelled the same way everywhere, next-step hints, friendlier empty and error text |

Checked by me after the agents finished: type check clean, 196 frontend tests pass, production build 80 KB gzip JS and 13 KB CSS, screenshots of Ask (phone), results (desktop) and Market. **Not checked:** dark mode, a real phone, the motion playing, stress cases (very long names, one result, huge counts), contrast with a tool, and the web panel in Market (the test data has the web search off). The page-to-page transition and Lappy "listening" on the mic were requested on the board but not confirmed.
## 0b. Version 4: picture-first results (13 Nov 2026)

You said the card buttons were not intuitive, the output did not use the whole space, and laptops had no images. Changes:

- **Laptop pictures.** Each card leads with a large picture. Pictures are found once per model (Tavily image search, `backend/scripts/fetch-images.ts`), checked to be real images whose description names the brand and model, and stored in the table `laptop_image` with the site. They are never fetched per request. 13 models, 3 pictures each, all 14 variants covered.
- **Honesty about pictures.** Each shows "Photo: <site>" (linking to the source page when known). The hover text and the answer receipt say they are from the web, may not show this exact version, and have an unverified licence. If a picture is missing or fails to load, a drawn laptop (brand colour, recorded screen size and weight) is shown, labelled "Illustration".
- **Switch off.** `FEATURE_FLAGS.web_images = false` removes every picture from every reply (tested). A single picture can be hidden with `rejected = true`.
- **Buttons.** The three loose pills became a tray of three equal tiles with an icon and a plain label: 💬 Owners say, 🔎 Full check, 🛒 Where to buy (the main one, filled). "Compare" moved onto the picture as a "＋ Compare / ✓ Picked" chip.
- **Whole space.** The page is up to 1120 px wide. Results are a grid: 1 column on a phone, 2 on a tablet, 3 on a desktop, with the top pick shown as a wide featured card (picture left, details right). All results show at once; the hidden "Show more" is gone. Forms and text stay at a readable 780 px.
- **Spec tiles.** RAM, storage, screen and weight as four tiles instead of a text line; "?" for unknown values.
- **Compare** shows a picture above each laptop's column.
- **Still to do before real users:** replace web pictures with licensed or affiliate-programme images (hotlinking third-party images has copyright and reliability risks).

## 0. Version 3: a different structure, not a different paint job

**Before:** nine tabs; the main screens (Find, Check, Sell, Share, My laptops) were forms with 31 fields between them.
**Now:** five spaces and almost no typing. Fields were replaced by things you tap, drag and look at.

| Space | Was | Now |
|---|---|---|
| **Ask** (home) | A text box and example buttons | Six **vibe tiles** (Study, Code, Game, Create, Travel light, Look stylish) and **one budget slider with a histogram** of the catalog behind it, then one button. The text box, voice and camera stay below for people who prefer to say it |
| **Explore** | Find (8 fields) and Compare (a picker) | **The laptop map**: every laptop with a price is a dot (price across, RAM up, size = storage, colour = brand). Drag the budget and the affordable area is shaded; hide brands with chips; tap dots to pick two to four; Compare opens an **overlay radar** plus the tug-of-war table. A list version is offered for screen readers |
| **Check** | 10 fields | **A big drop-zone for a picture** and **one text box** for "what the seller said". Details (laptop, battery slider, bill and serial yes or no) are hidden behind "I know more" |
| **Sell** | 5 fields | A laptop choice, an **age slider**, four **condition faces**, an optional battery slider and two toggles. No text typing |
| **You** | My laptops (2 fields) and Share (8 fields) | One space with two tabs. Share is **stars, a topic chip and one sentence**; months owned and your type of user are optional; one checkbox covers 18+ and the notice |
| Market, About | Tabs | Links in the footer |

"What I understood" on an answer is no longer a text field and three dropdowns: needs are **chips you tap** (Should, then Must, then Nice) with a cross to remove, and the budget is the same slider.

New graphs: the price map; the budget histogram; the overlay radar for compare (alongside the per-laptop radar, rings, tug bars and range track); a **flag strip** on checks (3 to ask about, 3 look fine, 0 notes); **factor bars** on the sell plan showing how each assumption moves the estimate.

Visible fields per screen (text boxes, selects, number boxes, before any optional section is opened): Check 10 to 1, Find 8 to 0 (Explore has a slider and a map), Share 8 to 3 (laptop, one sentence, one checkbox), Sell 5 to 1 (laptop), My laptops 2 to 0 until you tap Add.

Honesty rules still apply: the map and the budget histogram draw the catalog list the server sent, and a count such as "9 laptops in the catalog at or under ₹60,000" is only a preview; **the results always come from the server**. The map shows only laptops that have a recorded price. The overlay radar scales each axis against the laptops shown and leaves unknown values at the centre.

Development review: `npm run dev -- --host 127.0.0.1`, then open `http://127.0.0.1:5173/?mock#/explore` (also `#/ask`, `#/check`, `#/sell`, `#/you`). The `?mock` switch preloads the catalog from fixtures so no live request is made; `#/gallery/<fixture>` still shows every kind of reply. Both are development only.

What the screenshots found while building version 3 (all fixed): a laptop picker that was two stacked controls and overflowed the screen; a misaligned checkbox label; too much empty space above the dots on the map. Not seen: dark mode, a real phone, the screens with animation playing.

---

## Version 2 notes (still true for the answer cards and blocks)

The frontend was rebuilt to be intuitive, playful and memorable, under one hard rule: **every visual is drawn from real values the backend sent, and never makes a claim the data cannot back**.

## 1. Ideas and what they show

| Idea | What the user sees | What it is drawn from |
|---|---|---|
| **Lappy**, a small laptop mascot | Floats on the home screen; thinks while you wait; hops when there are results; looks sheepish on an error; listens while you speak. Hidden from screen readers | Moods follow the app state; it carries no information |
| **Laptop DNA** | A six-axis shape per laptop: lower price, RAM, storage, lightness, screen size, owner positivity | Recorded values, scaled **against the other laptops on screen only**; an unknown value stays at the centre with a "?" |
| **Evidence ring** | A ring that fills as owner voices accumulate ("Collecting owner voices: 12 of 20"), turning green at 20 | Evidence count and the minimum from the backend |
| **Count-up price** | The price counts up, then lands on the exact backend text | Price text from the backend |
| **Freshness chip** | "as of 10 Nov 2026 · 3 days old", green, amber or red by age | The recorded date |
| **Swipeable deck** | Cards slide sideways with dots; rank badges; "Compare" ticks fill a tray | The ranked results |
| **Tug-of-war compare** | A coloured bar per laptop under each number, a "✓ best" tag on the winner | Compare values (bars only size the text the backend sent) |
| **Vibe meter** | Topic by topic: emoji, positive and negative bar, speech-bubble quotes, a ghost ring where evidence is thin | Owner opinions with counts |
| **Claim stamps** | A rotated MATCH, MISMATCH, UNCHECKED or OPINION stamp that slams down on each seller claim | The claim's status |
| **Picture-read panel** | "Here's what I saw": chips for each thing read from a photo, then the checks | The vision reading, validated |
| **Answer receipt** | A dashed paper-receipt strip, "How I built this answer": catalog snapshot, dataset opinions, live web, AI used, re-checked | The reply's provenance |
| **Confetti** | A short burst when every Must you set is met | Whether the backend marked them met |
| **Voice, picture, share** | Mic with a language choice; camera, paste or drag a picture; "Read to me", "WhatsApp", "Save as picture" | Browser features, built from the answer's text |
| **Share card** | A 1080 px picture of the top picks, dates and an honest footer | The answer's text |

## 2. Rules that keep it honest

1. No score, grade or "best" is invented. Charts show recorded values; the compare marker only says lower price, lower weight, or higher RAM, storage or battery.
2. A picture of data says what it compares ("The shapes compare these laptops with each other") and marks the unknown.
3. Thin evidence is shown as **collecting**, never as a percentage.
4. Animation never changes a fact (the price always ends on the backend's text) and is switched off for people who ask for reduced motion.
5. Backend text is rendered as text; only `https` links are clickable; shop links say when they earn money.
6. Every notice from the backend is shown.

## 3. Intuitive by design

Plain words, one text box; examples that fill it; voice and camera as ordinary buttons beside it; what you asked appears as a bubble; the system explains what it understood and lets you change it (Must, Should, Nice, remove); a waiting state that lists what the app does; every failure explains itself and keeps what you typed; a mobile bottom bar with five choices and a "More" page.

## 4. Accessibility and performance

Skip link and landmarks; every control has a text label; ticks and stamps are backed by words for screen readers; charts have text alternatives; visible focus; 44 px touch targets; light and dark themes; reduced-motion support. **76 KB of JavaScript and 7 KB of CSS, gzipped.** No external fonts or images.

## 5. How the design was reviewed, and what that found

The browser tool could not open local pages, so the screens were captured with headless Chrome: a **development-only gallery** (`#/gallery/<fixture>`, left out of the production build; checked) renders every kind of real backend reply with the real components, and was photographed at phone width. Issues the screenshots found, now fixed:

- The radar's left label ("Owner mood") was cut off, so the label was shortened and the chart given margin.
- The voice-consent checkbox took a lot of space before anyone had touched the microphone; it now appears when the mic is first tapped.

Seen and judged fine: the home screen, shortlist deck, compare table, seller-claim check, picture-read panel, and shop links with disclosure. **Not seen:** dark mode, a real phone, very long laptop names, Hindi, Telugu or Tamil text in the interface (the interface text is English; user text in those languages works), and animation as it plays (screenshots are still frames).

To re-check: run the app (`npm run dev -- --host 127.0.0.1`), open `http://127.0.0.1:5173/#/gallery/shortlist` (or any fixture name; `#/gallery/moods` shows the mascot), and resize the window to a phone width.

## 6. Tests

187 frontend tests: every backend reply type renders; charts, rings, count-up and confetti; the laptop card; the receipt; shop links and disclosure; the picture flow through the whole app; voice and picture preparation; sharing; the composer; accessibility labels; failure and rate-limit handling.
