# AI PRD: F03 Used laptop check

Core feature. Shared assumptions in `00_SHARED_ASSUMPTIONS.md`. Functional spec: `../ai-spec/specs/F03_used_laptop_check.md`. Prompts: `../ai-spec/03_SYSTEM_PROMPTS.md` (P1, P1d draft; P3 designed).

## 01 Problem and user

| | |
|---|---|
| **Who** | Used and refurbished buyers, often on a tight budget, including parents buying for a student |
| **What breaks today** | A listing cannot be inspected. Buyers miss impossible specs, a missing battery report, a missing serial number, an unsupported operating system or a price that is too high or too low |
| **Evidence** | Desk research; the team's earlier listing checker was evaluated on Claude-written sets (68%, 91%, 100% across three sets, each fixed after the last), so its strength on real listings is **unproven**. **No real-user sessions yet** |

## 02 Why AI, not rules

| Question | Answer |
|---|---|
| What is open-ended? | Reading a pasted listing or a screenshot, in any style, into stated fields (model, RAM, storage, price, OS, battery health, serial shown, seller reason, stated issues) |
| What stays rule-based? | All flags: impossible RAM, unlisted RAM and storage pairs, weight mismatch, price vs the usual range, battery, serial, bill, operating system for the date. **No buy or don't-buy verdict exists at all** |
| Cost of being wrong | **High**: a wrong "fine" could lead to a bad purchase. So only values stated in the listing are read ("null if not stated"), and all judgements are code |

## 03 AI objective and metrics

**Objective:** *Read a used listing into stated fields without guessing, so that code can flag what does not add up and the buyer knows what to check in person.*

| Type | Metric | Baseline | Target |
|---|---|---|---|
| User | Buyers who say they asked the seller for something because of a flag | Not measured | Set in sessions |
| Business | Check-to-shortlist or check-to-sell follow-ups | Not measured | Set after pilot |
| Model | Listing field extraction accuracy | Not measured | At least 0.90 |
| Model | Flag recall / precision (against hand-labelled flags) | Not measured | At least **0.90 / 0.85** |
| Hard | Buy or don't-buy language; an invented value; a flag that differs from recomputation | — | **0** |
| Hard | Unreadable input guessed instead of named | — | **0** |

## 04 Approach options

| Option | Speed | Cost | Accuracy | Verdict |
|---|---|---|---|---|
| Rules only on typed fields | Fastest | $0 | Exact but needs structured input | **Fallback form** |
| Prompted reader + rules | About 2.5 s | About $0.0008 | Reading good; flags exact | **Chosen** |
| Vision model on screenshots | About 4 to 5 s | About $0.0016 | Small text may be misread | V1, paid tier only |
| OCR plus rules | Fast | Low | Predictable on clear images | Alternative if vision proves unreliable |
| Learned used-price model | Fast | Needs about 1,000 prices per segment | Better than a band | Later |
| Anomaly or scam detection | — | Needs labelled cases | Unknown | Future |
**Trade-off:** a sample price band (30% to 75% of the new price) is crude, so price flags are tagged "sample range" until real used prices exist.

## 05 Data

| Data | Source and rights | Coverage | Labelling plan |
|---|---|---|---|
| Catalog and new prices | Existing database (14 India laptops); licence unverified, course use only | 14 laptops | Curate year and memory slots |
| Operating-system rules | Microsoft lifecycle (Windows 10 support ended 14 Oct 2025; Windows 7 and 8.1 ended earlier). Windows 11 rule follows Microsoft's processor lists (Intel Core 8th generation or later; listed AMD models) | Windows only; no macOS | Dated rules with source links; verify the Windows 11 rule on Microsoft's page |
| **Used prices** | **None.** Routes: Sell-form outcomes, hand-collected public prices (numbers only), a refurbisher partner | 0 | Verified by a named person; 20 or more per bucket |
| Listing test set | Team-written, then real listings | Needs Hinglish and screenshots (V1) | Two raters |

## 06 Eval plan

| Item | Plan |
|---|---|
| Golden set | At least 100 listings; 30 to 50 hand-labelled with the flags that must and must not fire |
| Mix | Impossible RAM; unlisted combination; unsupported OS; missing battery; missing serial; price far above, far below and in range; price above new; laptop not in catalog; Hinglish; seller reason mentions a fault; "should I buy?"; injection inside the listing; screenshot and blurry photo (V1) |
| Rubric | Accuracy, honesty about limits, usefulness of the checklist, tone |
| Assertions | No verdict words; "cannot be judged" list present; unreadable input named |
| Thresholds | As section 03; hard metrics at 0 |
| Held-out | A set from real listings no one tunes against |

## 07 Failure modes and fallback

| Failure | Detected by | What the user sees |
|---|---|---|
| Laptop not in catalog | Match fails | "I could not match the laptop to the catalog, so I cannot compare its specs." Generic checklist only |
| Price missing | Field is null | "The listing does not show a price, so I cannot compare it." |
| Band is a sample | Band source flag | Price flag tagged "sample range", at note level |
| Blurry photo (V1) | Reader flag | Names what could not be read and asks for the model name |
| Link only | URL pattern | "I cannot open links. Type the model name or paste the text." |
| "Should I buy?" | Intent | "LapFit gives no buy or don't-buy verdict" and the flags |
| Model down | Timeout | The typed form: laptop, RAM, storage, price, age, OS, battery, serial |

## 08 Human-in-the-loop

| Point | Human role | Capacity and time |
|---|---|---|
| Checklist content | A reviewer approves each item and version | One-off, about 1 hour [A] |
| Operating-system rules | Admin checks against Microsoft pages when they change | As needed |
| Used-price import | A named verifier marks rows verified | Per batch |
| Failed or unreadable listings | Team reviews weekly and adds test rows | About 1 hour per week [A] |
There is no human in the loop on individual checks; the buyer is the final inspector.

## 09 Responsible AI

- **Fairness:** accuracy of reading by language; no flag depends on brand or price tier except through stated rules.
- **Privacy:** listing text is not stored; the log keeps only model, price band, flag codes and whether the band was sample; serial numbers are never stored; photos (V1) only with consent.
- **Transparency:** every price flag states its source (sample or observed, with the count).
- **Safety:** wording never says "scam", "fraud" or "lying"; a very low price is "ask why", not an accusation.
- **Abuse:** injection treated as data; rate limit.

## 10 Cost and token economics

| Path | Calls | Cost per request |
|---|---|---|
| Pasted text | R | **$0.000775** |
| Screenshot (V1) | P + R | $0.00156 |
| Typed form | none | $0 |
Monthly at a 10% share of 500 / 5,000 / 50,000: about **$0.04 / $0.39 / $3.90**. Cost per user (10 requests, 1 on F03) about $0.0008. Versus today: no equivalent.

## 11 Latency budget

p95 target **3.5 s** for text (network 0.5, router 2.5 incl. reading, tools 0.3, gate 0.2); about 5.5 s with a screenshot. If exceeded: the router at 8 s uses the typed form. No writer call, so no second timeout. Not yet measured.

## 12 Launch plan and guardrails

Shared phases apply. **Specific gates:** real used prices (at least 20 per bucket for the main laptops) before the price flag loses its "sample" tag; Windows 11 rule checked on Microsoft's page before phase 2; photos only after the paid tier and consent. Monitors: share of checks ending with a "sample range" flag; unreadable rate; "should I buy?" rate (shows demand for a verdict we deliberately do not give).

## 13 Open questions

| Question | Owner | Resolve by (proposed) |
|---|---|---|
| Where do real used prices come from, with what permission? | Product owner | 4 Dec 2026 |
| ~~Is the Windows 11 stand-in good enough?~~ **Resolved:** the rule now uses Microsoft's processor lists | Resolved 13 Nov 2026 | – |
| Battery cut-offs (70% and 80%) have no authoritative source: acceptable? | Product owner | 27 Nov 2026 |
| Which red flag do buyers care about first? | Product owner, student sessions | 4 Dec 2026 |
| Is a screenshot in scope for the first public version? | Product owner | After paid-tier decision |

**Status of these questions (researched 13 Nov 2026):** see `OPEN_QUESTIONS_STATUS.md`.
