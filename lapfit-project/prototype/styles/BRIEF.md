# LapFit style sample brief (shared by all agents)

LapFit helps laptop buyers in India get an honest second opinion. Owner wants a delightful, creative, intuitive UI; one option may be comic style (maybe too funky). Owner will PICK one style from your samples.

## Build
One self-contained HTML file (inline CSS+JS, Google Fonts allowed, no other external libs), mobile-first, works at 390px and 1200px, light mode. Save as: /Users/klprathyusha/Sem 3/AI for PM/project/AIforPMCapstoneProject_Team11/lapfit-project/prototype/styles/<your-style>.html

## Same content in every sample (so styles are comparable)
1. Header: logo "LapFit", 5 tabs: Ask, Explore, Check, Sell, You.
2. Hero prompt: "What will you use it for?" with 5 vibe tiles (Coding, Study, Gaming, Editing, Everyday) and a budget slider (₹20,000 to ₹1,50,000, shows "up to ₹60,000", plus "9 laptops fit").
3. Results grid of 3 laptop cards (first one featured/wide on desktop). Each card: picture, rank badge, "＋ Compare" chip, name, version "8 GB / 512 GB", price, "as of 10 Nov 2026 · 3 days old", badge "Not human-verified", 4 spec tiles (RAM, Storage, Screen, Weight), a ring "196 owner opinions, 101 positive", and 3 equal action tiles: "💬 Owners say", "🔎 Full check", "🛒 Where to buy" (main one filled).
4. A small honest footnote: "Pictures are from the web and may not show this exact version."
Use real data from /private/tmp/claude-501/-Users-klprathyusha-Sem-3-AI-for-PM-project/b7323b9f-a5bf-45a2-bc79-b06eb695b213/scratchpad/pics.json (image url, site) and these laptops: ASUS VivoBook 15 (2022) Core i3 10th Gen ₹28,170 8GB/512GB 15.6" 1.8kg (FKL-09); Lenovo IdeaPad 3 Ryzen 5 5500U ₹38,952 8GB/512GB 15.6" 1.65kg (FKL-11); HP Ryzen 5 5500U ₹38,944 8GB/512GB 15.6" 1.69kg (FKL-13). If an image fails to load show a drawn fallback.

## Rules that never bend
- Honesty: never invent numbers, unknown shows "?", "Not human-verified" stays visible. No fake urgency, no fake ratings.
- Accessible: contrast 4.5:1, 44px touch targets, visible focus, prefers-reduced-motion respected, real buttons/labels.
- Follow Emil Kowalski's skill (read /private/tmp/claude-501/-Users-klprathyusha-Sem-3-AI-for-PM-project/b7323b9f-a5bf-45a2-bc79-b06eb695b213/scratchpad/emil/emil-design-eng.md and ui-cheatsheet.md): animate only transform/opacity, ease-out custom curves, 150-250ms for UI, never scale(0) (start .95 + opacity), buttons press to scale(.97), no transition:all, :active feedback, hover effects behind @media (hover:hover), no layout shift, stagger entrances 30-50ms. Also /private/tmp/claude-501/-Users-klprathyusha-Sem-3-AI-for-PM-project/b7323b9f-a5bf-45a2-bc79-b06eb695b213/scratchpad/emil/mobile-native.md (tap highlight, safe areas, 16px inputs).

## Coordination (agents must talk to each other)
Shared board: /Users/klprathyusha/Sem 3/AI for PM/project/AIforPMCapstoneProject_Team11/lapfit-project/prototype/styles/BOARD.md (append-only; start each entry with "### <your-style> · <time>"). Before building, read the board. Post: your palette tokens, one signature idea, and any shared-content decision (e.g. how you show the unknown "?"). Mid-way and at the end, read the others' entries and post: one thing you borrowed or will adapt, and one concrete critique of another style. Keep entries under 12 lines.

## Deliver
Final reply under 8 lines: file path, the style in one sentence, signature interaction, honest weaknesses. Do not take screenshots of the user's browser; headless Chrome is fine for self-checking: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=FILE --window-size=560,1500 file://HTML (width>=500).
