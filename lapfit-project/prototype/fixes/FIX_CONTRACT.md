# User-testing fixes (14 Nov 2026): contract between agents

Product: LapFit (backend: Supabase Edge + Postgres, code in backend/supabase/functions/_shared, tests in backend/tests, run `cd backend && npm test`; frontend: React+TS in frontend/src, run `cd frontend && npx tsc --noEmit && npx vitest run`). Read prototype/ux/DECISION.md and build-plan/11_FRONTEND_DESIGN.md for the style and honesty rules. Soft playful style, Emil Kowalski motion rules (/private/tmp/claude-501/-Users-klprathyusha-Sem-3-AI-for-PM-project/b7323b9f-a5bf-45a2-bc79-b06eb695b213/scratchpad/emil/*.md).

## Rules that never bend
- Honesty: unknown stays "?"; web content is labelled "Live, not verified" with links; LLM/model output is never a fact: a model may read text into whitelisted fields and the CODE validates and labels them ("from the web, not verified"); no invented numbers; "Not human-verified" stays; never say "buy".
- Typed text may contain personal data: never log it anywhere new; the input log already records everything typed.
- Do NOT deploy, do NOT apply migrations to the remote database, do NOT commit or push. The lead does that. New SQL goes in backend/supabase/migrations/ with the next free number (BE-C owns 20261114000020, BE-A owns 20261114000021, BE-B owns 20261114000022 if needed); tests apply migrations automatically.
- Existing tests may change only where behaviour intentionally changes; say so on the board. Leave `npm test` and `vitest` green.
- Accessible: 44px targets, labels, contrast, keyboard, reduced motion. Mobile first (390px) and 1280px.
- Never edit another agent's files; ask on the board prototype/fixes/BOARD.md (append-only, header "### <role> · <time>", under 12 lines). Read the board before editing a shared contract and again before your final test run.

## The 20 items (owner in brackets)
1 Edit any typed input or selection, including sliders: every slider gets a number field you can type in; a sent message can be edited and resent [FE-A for Ask/Understood/messages, FE-C for Sell/Check/You sliders]
2 The ask box is a sticky popup covering content: make it unobtrusive like Grammarly (a small pill that expands on click, hover or focus; collapses on Escape, outside click, after send; never covers reading) [FE-A]
3 Clearing the "Asking about" chip must NOT drop the needs. Keep three saved parts: my needs, the recommendations, my selection; follow-ups update them; "change the budget to 80000" re-runs the search with the updated needs (the bug: a budget-change sentence was misread as distress and answered "That sounds stressful") [BE-A + FE-A]
4 Image only, nothing else: it asked the same question again and again (cause: two catalog variants have identical names, the choice buttons only re-send the name text, so it re-asks forever) [BE-A + FE-A]
5 Laptop not in the catalog: do not stop at "not in catalog": show web search results and, labelled unverified, specs the model read from them, validated by code [BE-A, UI FE-B]
6 "under 1.5 lakh" showed the cheapest first: sort so that more capable laptops near the budget come first, plus sort chips, and say why [BE-B, UI FE-B]
7 Show the photo by default, the drawing only as fallback (DONE by lead)
8 Details pane not scrollable (DONE by lead)
9 The laptop map is not intuitive: redesign Explore [FE-C]
10 Compare must accept the user's own laptop (not in the catalog) [BE-A backend, FE-B UI]
11 Brand question answered about the laptop on screen (DONE by lead: brand/general questions are never follow-ups)
12 Check page layout bad ("I know more" link beside the textbox) and not intuitive [FE-C]
13 "Which laptop are you asking about?" gives no way to answer: need an input [BE-A + FE-A + FE-C]
14 Instead of choosing from a list, I must be able to type the laptop [BE-A + FE-A + FE-C]
15 Sell: both a slider and emoji faces on one step is confusing [FE-C]
16 Sell: more options than "cracked screen"; and a way to type [BE-C backend, FE-C UI]
17 Sell: price missing (US catalog items have no rupee price; picker must be India-only, and ask what you paid when no price); checklist must be a copyable bulleted list, not tick boxes [BE-C + FE-C]
18 Sell: recommend what else the seller can do to get more money, from reviews and market trends [BE-C + FE-C]
19 My laptops: purchase date cannot be before the model launched or in the future [BE-C + FE-C]
20 Sorting and many loopholes in the recommendation scenario: red-team agents find them, BE-B fixes [critics + BE-B]

## Interfaces (fixed)
REQUEST additions (all optional, from the browser; ids are checked against the catalog server-side, never trusted):
- `prior_needs` (exists), `focus` (exists), `shown` (exists), NEW `recommended: string[]` (ids of the last recommendation list, max 10), NEW `picked: string[]` (compare picks, max 4).
- NEW `sort`: 'best' | 'budget' | 'price_low' | 'price_high' | 'light' | 'reviews', sent with `needs` (the form request) to re-order a recommendation.
- NEW `variant_id` / `laptop_text` on any flow that needs a laptop: the answer to an `ask_laptop` question (below). `laptop_text` is free text the person typed to name a laptop; the server resolves it, or shows the web fallback.
- compare: `{action:'compare', variant_ids: string[], custom?: CustomLaptop[]}` with `CustomLaptop = {name: string(<=80), price_inr?: number, ram_gb?: number, storage_gb?: number, display_size?: number, weight_kg?: number, battery_wh?: number, cpu?: string(<=60)}` (max 2, numbers validated and bounded by code, shown as "(yours, as you entered)").
- sell: `{action:'sell_plan', variant_id? , custom_name?, paid_inr?, age_years, condition: 'excellent'|'good'|'fair'|'poor', battery_health_pct?, flags?: string[], notes?: string(<=300)}`. Allowed flag keys: cracked_screen, dead_pixels, keys_missing, hinge_loose, battery_replaced, battery_swollen, water_damage, scratches_dents, no_charger, has_box, has_bill, warranty_left, ssd_upgraded, ram_upgraded, repaired, need_fast.
- my laptops: `{owned: [{name, purchase_date}]}` (exists); purchase_date validated against launch_year and today.
REPLY additions:
- `ask_laptop` block (replaces every dead-end "Which laptop... type its name" text): `{type:'ask_laptop', question: string, base: object /* the original request body WITHOUT the laptop, to be re-sent with variant_id or laptop_text */, choices: {variant_id: string, label: string /* always distinguishable: includes price or variant detail */}[], placeholder: string}`. The UI shows the choices AND a text input. Sending = POST `{...base, variant_id}` or `{...base, laptop_text}` (plus the usual context fields). The server must continue the ORIGINAL task (used_check with its listing, check_pitch with its claims, owner_voice with its topic, second_opinion, sell_plan, compare slot) and never ask the same question twice in a row for the same input: if it still cannot resolve, it falls to the web fallback instead of asking again.
- `web_laptop` block (laptop not in the catalog): `{type:'web_laptop', query: string, status:'ok'|'cached'|'off'|'limit'|'error'|'empty', note: string, fields?: {price_inr?: number, ram_gb?: number, storage_gb?: number, display_size?: number, weight_kg?: number, cpu?: string, battery_wh?: number, launch_year?: number}, fields_note: 'Read from the web pages below by an AI model and checked against their text. Not verified, may be wrong.', items: {snippet,url,site,published?}[], can_compare: boolean}`.
- shortlist `cards` block gains `sort: {key, label, note}` (note says in one plain sentence how it is ordered and why) and `sorts: {key, label}[]`; `budget_note?: string` when the budget is above or below everything in the catalog.
- `catalog` rows gain `market: 'IN'|'US'` and `launch_year: number|null` (null when not known; derived in code from a year in the name, or the processor generation, never invented).
- `sell_plan` gains `boosters: {title: string, why: string, source: 'rule'|'owners'|'web', gain_text?: string, items?: {snippet,url,site}[]}[]` (what else the seller can do for a better price: from the person's inputs, owner review topics and a labelled web search on resale trends), `checklist: string[]` (plain bullet strings) and `copy_text: string` (the whole plan as plain text for copying), and `needs_paid_price?: true` when the laptop has no rupee price on file (the UI then asks "What did you pay?").
- `laptops` entries in `compare` gain `custom?: true`.
