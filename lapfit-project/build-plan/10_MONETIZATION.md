# How LapFit earns money, and how it stays trustworthy while doing it

Written 13 Nov 2026. **Today LapFit earns nothing.** Affiliate links were planned from the start (tables `offer`, `affiliate_click`, `conversion`; the rule "commission never changes ranking") but had never been built or shown anywhere. They are now built, **switched off until you add affiliate tags**, and this document says what is real, what is assumed, and what you must do.

## 1. What is built

| Piece | Status |
|---|---|
| **"Where to buy"** on every laptop card and answer: search links to Amazon.in, Flipkart and Croma for that exact laptop | **Built and live.** Plain links today |
| **Affiliate tags**: if you configure a tag for a shop, its link carries it, is marked "Affiliate link", gets `rel="sponsored"`, and a plain disclosure appears | **Built, no tags configured**, so nothing is earned and no disclosure is shown (nothing is claimed that is not true) |
| **Click counts** per shop, per laptop, per day, affiliate or not (no identity; visitors are a salted daily hash) | Built (`outbound_click`, views `v_clicks_daily`, `v_clicks_by_laptop`, `npm run logs -- clicks`) |
| **Neutrality proof**: shop and commission data cannot change what is shown or in what order | Built and tested (section 3) |
| Affiliate accounts, real commission data, conversions | **Not built. Needs you** (section 5) |
| B2B brand insights, referrals, premium features | Planned only (section 4) |

## 2. Where links appear

Only where a person asks: the **Where to buy** button on a laptop card, which shows the shops, a note that *the price at the shop can differ from my saved price (with its date)*, and, when any link is an affiliate link, this disclosure:

> Links marked "Affiliate link" may earn LapFit a small commission if you buy, at no extra cost to you. Commission never changes which laptops are shown or in what order.

Shortlists, comparisons, second opinions, owner voice and the sell plan carry **no shop links at all** (tested). The answer receipt says "Shop links may be affiliate links" only on an answer that really contains them.

## 3. The independence rule, and how it is enforced

The product's promise is a second opinion you can trust. If commission could influence results, that promise would be false. So it is enforced three ways:

1. **Structure:** the ranking, filtering, pre-send check, wording, evidence and lens code never read shop or affiliate settings. A test reads those source files and fails if they mention retailers, affiliates, commission or the shop-link module.
2. **Behaviour:** a test runs every one of the 75 kinds of request twice, once with no affiliate tags and once with tags configured for two shops, and requires the answers to be **identical**.
3. **Disclosure:** an affiliate link is always labelled on the button, marked `sponsored` for search engines, and explained in plain words. No label when there is no affiliate link.

What we will not do: paid placement, boosted ranking, hiding shops that do not pay us, hiding a bad review of a sponsor, or showing a price we cannot date.

## 4. Revenue streams

| Stream | How it earns | Status | What it needs |
|---|---|---|---|
| **Affiliate commission** on purchases through "Where to buy" | A percentage of the sale from the shop | Built, off | Affiliate accounts and tags; real product links; confirmed rates and price-display rules |
| **Brand and retailer insights** (F10) | Subscription for demand and complaint data, aggregated, with small groups hidden | Planned (specs and AI PRD exist) | Real traffic and owner reports; a first brand contact; sign-in |
| **Team and bulk purchase leads** (F04) | Referral fee from a business seller | Planned | Sellers; a lead form; consent |
| **Used and resale leads** (F03, F09) | Referral from refurbishers or resale partners | Planned | Partners; consent; no pressure |
| **Financial referrals** (EMI, warranty, insurance) | Referral fee | Idea only (scored low in the JTBD analysis) | Partners; regulatory care |
| **Premium conveniences** (price alerts, saved needs) | Subscription | Idea only | Accounts; fresh prices |

## 5. Rough economics (assumptions, not measurements)

There is no revenue data yet. These numbers only show how to think about it. **Commission rates are unconfirmed**: third-party guides disagree (for laptops, about 1 to 4 percent for Amazon India and 0.8 to 5 percent for Flipkart, with different cookie windows), and neither programme's own schedule has been read. To-do 11.2 stays open.

Working assumptions: average laptop price on the catalog about ₹50,000; commission 2 percent, so about ₹1,000 per sale; 15 percent of monthly users open a shop link; 3 percent of those buy within the window.

| Monthly users | Shop link opens | Sales | Commission | Typical fixed costs |
|---|---|---|---|---|
| 1,000 | 150 | 4 to 5 | about ₹4,500 | Supabase Pro about $25, Tavily paid tier, Gemini paid plan |
| 10,000 | 1,500 | 45 | about ₹45,000 | same, plus model use that grows with traffic |
| 100,000 | 15,000 | 450 | about ₹450,000 | scale-up of all of the above |

Read it as: affiliate income is small until there is real traffic, so the product has to earn trust first. Costs scale with typed and picture requests (each model call costs money, which is why the rate limits exist), so do not assume revenue covers a free tier of heavy use. Measure the real click rate (`npm run logs -- clicks`) and the real conversions in the affiliate dashboards before planning on these figures.

## 6. Rules and terms to check before turning it on

Not verified in this build; each needs reading the current text.

- **The programmes' own terms** (Amazon Associates India, Flipkart affiliate): who may join, how prices may be shown and how stale they may be, which link formats are allowed, what disclosure they require, and the commission schedule. Amazon's terms in particular are commonly understood to restrict displaying prices not obtained through their own feeds; **our prices are a saved snapshot, so check this before putting tags on links**.
- **Advertising disclosure rules in India** (for example the Advertising Standards Council of India's guidance and consumer-protection rules on misleading advertising): confirm what wording and placement are required for affiliate content.
- **Data protection:** click counts hold no identity; keep it that way.

## 7. How to turn on affiliate links (when you have accounts)

1. Join the programmes with your own account and bank details (this cannot be done from here). Note each tag or ID.
2. Read their terms (section 6). If our saved prices conflict with them, keep links plain until prices come from an allowed feed.
3. Set the tags, with no redeploy. For example for Amazon.in:
   `update settings set value = jsonb_set(value, '{0,tag}', '"your-tag-21"') where key = 'RETAILERS';` (index 0 is Amazon.in, 1 is Flipkart, 2 is Croma; the parameter names are `tag` and `affid`, which you should confirm against each programme).
4. Open the app, tap **Where to buy**, and check: the right shops show "Affiliate link", the disclosure appears, and a link works and carries the tag.
5. Watch `npm run logs -- clicks`; reconcile with each programme's dashboard (clicks there should be close to clicks here).
6. Run the tests (`npm test`): the neutrality tests must stay green.

The shop links are **search links** (for example `amazon.in/s?k=…`), not product pages, because the catalog has no product URLs. Product deep links would convert better and need either the affiliate programmes' own link tools or a reviewed list of URLs.

## 8. Tests

`backend/tests/monetization.test.ts` (9): plain links and no disclosure without tags; tags only on the configured shops with the disclosure; the receipt flags affiliate links only when present; **identical answers with and without tags across all 75 inputs**; no shop links anywhere except on request; the structural source check; safe link building (https only, encoded, bad entries skipped); click counting for known shops only; unknown laptop. Frontend (`redesign.test.tsx`): plain links carry `noopener`; affiliate links carry `sponsored` plus a visible tag and disclosure; a click is counted once and a failing count never blocks the link; non-https links are never shown.
