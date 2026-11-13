# LapFit: questions, answers and how each answer was reached

You said you do not know the answers and asked me to check and answer for you. This file keeps every open question from the other documents, the answer I chose, **how I arrived at it**, how sure I am, and what would change it.

**Dated:** 13 Nov 2026. These are my answers on your instruction; change any you disagree with and the dependent documents follow.

## How I arrived: the method labels

| Label | Meaning |
|---|---|
| **Checked** | I looked at a source today; see "Facts I checked" |
| **Your brief** | Taken from something you wrote earlier (your first message or your to-do list) |
| **Prototype** | Taken from how the working prototype behaves |
| **Reasoned** | My judgement from the product's rules; no outside evidence |
| **Cannot check** | Only you or other people can supply it; I give a clearly labelled working assumption |

**Confidence:** High, Medium or Low. Low means: test it early.

---

## 1. Facts I checked

| # | Fact | Source | What it means for LapFit |
|---|---|---|---|
| C1 | On Gemini's **unpaid tier**, Google uses submitted content to "provide, improve, and develop Google products and services and machine learning technologies". Human reviewers "may read, annotate, and process your API input and output". The terms say: "Do not submit sensitive, confidential, or personal information to the Unpaid Services." On the **paid tier** Google says it does not use prompts or responses to improve its products, and keeps logs for a limited period to detect and prevent violations. In the EEA, Switzerland and the UK the paid-tier terms apply to unpaid use as well | [Gemini API terms](https://aistudio.google.com/docs/terms) (the old ai.google.dev link redirects here) | The free tier is fine for **sample data and made-up test text only**. Anything real from users (pasted listings, photos, text that may hold phone numbers) needs the paid tier |
| C2 | Rate limits are applied **per project**, can change, are **not guaranteed**, and are shown in Google AI Studio. The page I fetched did not list free-tier numbers for a fast model | [Gemini rate limits](https://aistudio.google.com/docs/rate-limits) | I cannot give you a requests-per-minute number. Check your project's limits in AI Studio, and treat a "limit exceeded" error as a normal case that shows the rules-only form |
| C3 | **Structured output** with a JSON schema is supported. The result is guaranteed to be valid JSON, but **values are not guaranteed to be correct**. Some schema limits (such as `minLength`, `maxLength`) are **ignored**; `minItems` and `maxItems` are enforced | [Gemini structured output](https://aistudio.google.com/docs/structured-output) | Keep validating every reply in our own code (as the prototype does with a schema). Do not rely on the API to enforce lengths |
| C4 | **Image input** is supported as base64 inline data (PNG, JPEG, WebP, HEIC, HEIF). Inline data counts toward a 20 MB request limit. The page recommends clear, non-blurry images, says small details and fine text can be harder to read, and advises checking that images are rotated correctly | [Gemini image understanding](https://aistudio.google.com/docs/image-understanding) | Resizing photos to 1280 px (what the prototype does) is well inside the limit, but small text on a spec board may be misread. Keep the "could not read" path and the code check on every field |
| C5 | In the 2011 Census, **Hindi** was the mother tongue of **43.63%** of Indians. **Telugu** is about **6.7%** and **Tamil** about **5.7%** (some outlets give slightly different figures; the Census tables are the authority) | [Wikipedia list from the Census](https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers_in_India), [The Quint](https://www.thequint.com/news/india/dravidian-languages-lose-mother-tongue-share-to-hindi) | Mother tongue is not the same as the language used for online shopping, and the census says nothing about code-mixing. It supports putting Hindi (Hinglish) ahead of Telugu and Tamil, nothing more |
| C6 | A 2010 meta-analysis of 63 conditions from 50 experiments (5,036 people) found the "too many choices" effect was **close to zero on average, with large differences between studies** | [Scheibehenne et al., Journal of Consumer Research 2010](https://econpapers.repec.org/RePEc:oup:jconrs:v:37:y:2010:i:3:p:409-425) | There is no strong evidence for any one list length. Pick a small default, make it expandable, and test it with real users |

**Not verified:** the exact name of the current free-tier model (the pages I fetched showed model names I could not confirm), any pricing, and any numeric limit. Check these in AI Studio before building.

### Facts checked for F03 (13 Nov 2026)

| # | Fact | Source | What it means for LapFit |
|---|---|---|---|
| C7 | Microsoft ended support for **Windows 10 on 14 October 2025**: no more technical assistance, feature updates or security updates (one secondary report mentions a paid one-year extension for consumers; I found no Microsoft source for it) | [Microsoft support page](https://support.microsoft.com/en-US/Windows/Deployment/updates-lifecycle/windows-10-support-has-ended-on-october-14-2025) | A used laptop still on Windows 10 has no regular updates. The rule says so and tells the buyer to ask about Windows 11 |
| C8 | **Windows 7**: support ended 14 Jan 2020, paid extended updates ended 10 Jan 2023. **Windows 8.1**: support ended 10 Jan 2023 | [Trusted Reviews](https://www.trustedreviews.com/news/microsoft-officially-ditches-windows-7-and-8-4294042), [SecurityWeek](https://www.securityweek.com/windows-7-extended-security-updates-windows-81-reach-end-support) | Windows 7 or 8.1 in a listing is always a flag |
| C9 | Windows 11 officially supports **Intel 8th generation or newer and AMD Ryzen 2000 or newer**; a manual install on older chips is possible but not officially supported. These are secondary sources; Microsoft's own page was not checked | [Pureinfotech](https://pureinfotech.com/windows-11-25h2-system-requirements/), [Laptop Mag](https://www.laptopmag.com/news/windows-11-cpu-requirements-revealed-intel-and-amd-processors-youll-need), [PC Gamer](https://pcgamer.com/windows-11-cpu-compatibility-amd-intel) | The catalog stores the processor as free text, so the first version uses **model year 2018 or later** as a rough stand-in. It is a "note", never a verdict. Structured processor generation is a data gap (data model, section 4.3) |
| C10 | On Windows, `powercfg /batteryreport` produces a report showing **Design Capacity** (new) and **Full Charge Capacity** (now); health is roughly full charge divided by design. Sources disagree on when a battery is "bad": one vendor page says below 40% of design is significantly degraded; another source gives about 70% as a rule of thumb | [Dell support](https://www.dell.com/support/kbdoc/en-us/000130117), [Tom's Hardware](https://www.tomshardware.com/how-to/battery-health-report-windows) | There is no authoritative cut-off. The thresholds are settings, labelled as a rule of thumb. The checklist can name this report as the way to get the number |

Treat the Windows 11 processor rule and the battery cut-offs as the least certain of these; check Microsoft's own page before building.

---

## 2. Open decisions from `02_DECISIONS.md`

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| O-01 | Submission due date and format | **Cannot answer.** Working assumption: Markdown documents plus a working demo, finished at least a week before the last class | **Cannot check.** Your to-do list item 12.4 says the final demo and 10-minute presentation are in the last class | – | You tell me the date |
| O-02 | Grading weights | Problem and PRD 15%, eval rigour 30%, iteration 20%, customer learning 15%, demo 20% | **Your brief:** your to-do list, item 12.6, states these weights | High | The instructor changes them |
| O-03 | Go/no-go bar per segment | Accept the proposed gates in each feature document. Hard metrics (invented spec or price, verdict without an approver, a Must violated) must be **0**; quality metrics start at the numbers proposed (for example 0.90 for reading needs). Segments for the gates: language (English, Hinglish, Telugu-English, Tamil-English) and user type (student, parent, performance seeker) | **Reasoned:** the cost of a wrong answer is a wrong purchase, so anything the code controls must be perfect; reading accuracy of 0.90 is a common starting bar that you can move after the first run | Medium | The first measured run shows the bar is too strict or too loose |
| O-04 | The V × F × D × R anchors and the cost-of-being-wrong worksheet | **Cannot answer.** I have not seen those slides, so I did not invent anchors. My own cost-of-being-wrong ratings are in decision D-10 | **Cannot check** | – | You send the slides |
| O-05 | Which languages first | **English and Hinglish first.** Telugu-English and Tamil-English are in the tests from day one and must pass the same hard (code-enforced) gates, but their wording-quality gate is softer until a native speaker has checked them (to-do 2.8) | **Checked (C5)** plus **Your brief:** all four languages are in your brief. Hindi is by far the largest first language, so English and Hinglish give the widest reach. The safety rules are enforced in code, so they do not depend on language | Medium | Real users show a different mix |
| O-06 | Free tier or paid tier | **Develop on the free tier with sample data only. Move to the paid tier before any real user text or photo is processed** | **Checked (C1):** the free tier lets Google use inputs and human reviewers read them, and tells you not to submit personal information | High | The terms change, or you choose a different provider |
| O-07 | Who approves claims and reports | **Cannot name people.** Working assumption: two team members as named reviewers, plus one person outside the team for a second opinion on a sample | **Cannot check.** Reasoned: approvals need a name and a second look to be credible | Low | You nominate people |

---

## 3. Questions from the F02 checkpoint (`04_FEATURE_SPECS.md`)

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F02-1 | Is the named-reviewer model (approve with a name, versions, retire) the right accountability level? | **Yes.** Every verdict shows the approver's name, the date and the number of reports behind it. Entries can be retired. Two named reviewers are enough for the course | **Prototype:** it already refuses to show a verdict without an approver. **Reasoned:** a verdict is the one place where LapFit tells someone a seller's claim is true or not; a named person is the minimum accountability | High | Reviewers disagree often: add a second-approver rule |
| Q-F02-2 | A claim about a different laptop than the one named: flag it or ignore it? | **Flag it** ("This looks like a different laptop") and offer to check it against that laptop | **Reasoned:** pitches often mix laptops. Silently checking against the wrong one would produce a wrong "does not match"; ignoring it hides what the buyer was told | Medium | Tests show too many false flags |
| Q-F02-3 | Is photo intake in the first version? | **No: text is the first version; photos are V1** | **Checked (C1, C4):** the free tier is not safe for real photos, and the image guidance says small text can be misread. **Reasoned:** photos are not needed to prove the three core use cases | High | You move to the paid tier early and the photo test passes |
| Q-F02-4 | Is a laptop picker plus typed claims an acceptable fallback when the model is down? | **Yes, and it must be built.** The prototype's current fallback is the budget form, which does not serve this flow | **Prototype:** I checked its fallback; it is the budget slider form. **Checked (C2):** limits can be hit at any time, so a working fallback is needed | High | – |

## 4. Questions from the F01 document

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F01-1 | Should "light" with no number become a Should or stay only a use? | **A Should: "weight up to 1.5 kg", shown as an editable chip** with the user's own word "light" as its source. It never becomes a Must on its own | **Prototype:** "light" currently only nudges ranking through the travel use. **Reasoned:** the app's rule is that nothing is dropped or invented silently; a visible chip makes the guess checkable and editable. The sample catalog's lighter laptops are 0.9 to 1.4 kg, so 1.5 kg is a sensible first line | Medium | Interviews show "light" means something else (for example under 1.2 kg) |
| Q-F01-2 | Is five the right shortlist size? | **Show three, with "Show two more" up to five** | **Checked (C6):** the evidence for any particular number is weak, so choose a small default that can be expanded. **Prototype:** the compare drawer holds two to four laptops, so three fits in it | Low | Customer sessions show people want more or fewer |
| Q-F01-3 | Which languages first? | English and Hinglish first; see O-05 | **Checked (C5)** | Medium | – |

## 5. Questions from `03_SYSTEM_PROMPTS.md`

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-P1-1 | Is 0.6 the right confidence cut, and is one clarifying question the maximum? | **Yes to both** | **Your brief:** you wrote "If confidence is below 0.6, use flow = clarify" and "Never ask more than one question at a time". The first measured run will show whether 0.6 is right | High (as specified) | The measured run shows too many or too few questions |
| Q-P1-2 | Which languages first? | See O-05 | **Checked (C5)** | Medium | – |
| Q-P1-3 | How should the app word a refusal for "my laptop is slow, fix it"? | "LapFit helps you choose and check laptops before you buy, so I cannot fix or set up a laptop you already own." plus a button for the closest flow | **Your brief:** you asked for one sentence saying LapFit helps you choose and check laptops before you buy, plus the closest flow. **Prototype:** this is the wording already in use | High | – |
| Q-P1a | Should "light" with no number become a Should? | See Q-F01-1 | – | Medium | – |
| Q-P1c | Claim about another laptop: flag or ignore? | See Q-F02-2 | – | Medium | – |
| Q-P1d | Which red flags show first in a used listing? | Order: (1) impossible spec combination, (2) price far from the usual range, (3) missing battery health, (4) missing serial number, (5) operating system not supported for its age | **Your brief:** these are the five flags you listed. **Reasoned:** ordered by how much money a buyer could lose and by how checkable the flag is from the listing alone | Medium | Real listings show another flag is more common |
| Q-P2 | What tone should reasons use in Hinglish, Telugu-English and Tamil-English? | Short, plain, polite, no slang, Roman script, English technical words kept as English (RAM, SSD, battery). Sample, for native-speaker checking: Hinglish "Isme 16 GB RAM hai, jo aapki zaroorat ke hisaab se theek hai."; Telugu-English "Idi 16 GB RAM tho vastundi, mee budget lo undi."; Tamil-English "Idhu 16 GB RAM-oda varudhu, ungal budget kulla irukku." | **Reasoned:** the app's tone rules are calm, plain and no jargon. **Cannot check:** I cannot confirm that these are natural, so they are samples only (to-do 2.8) | Low | A native speaker edits them |
| Q-P3 | Is the first version allowed to read photos? | **No.** Photos wait for the paid tier, consent and retention rules | See Q-F02-3 | High | – |
| Q-P4 | Should owner-report summaries be shown by default? | **No.** Show excerpts verbatim by default; add a "Summarise" tap that is optional | **Reasoned:** a summary can soften a complaint, and the product's promise is that every claim is traceable. Verbatim is the safest default | Medium | Tests show the summary stays faithful to the rows |

## 6. Questions from the per-feature documents

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F03-1 | Red flags first? | See Q-P1d | – | Medium | – |
| Q-F03-2 | Where could real used prices come from, with what permission? | Three routes, in this order: (1) prices from LapFit's own Sell form and its reported outcomes (the seller consents); (2) prices you collect by hand from a few public listings, only for numbers and not copying listing text; (3) a refurbisher partner who shares sold prices under an agreement. Do not scrape sites without reading their terms | **Reasoned.** **Cannot check:** I did not read any marketplace's terms | Low | Legal or partner checks |
| Q-F03-3 | Is a photo of a listing in scope for the first version? | **No** (V1) | See Q-F02-3 | High | – |
| Q-F04-1 | Are the persona defaults right (parent: 14 inch or more, 1.5 kg or less; child: 2-year warranty)? | **Keep them as defaults but show them as editable chips**, not hidden rules | **Reasoned:** they are assumptions. Showing them lets the buyer correct them, and customer sessions can test them (to-do 9.1) | Low | Interviews contradict them |
| Q-F04-2 | Should a team pick one model per role, or allow mixing versions? | **Allow the same model for several roles and different versions per role** | **Prototype:** it already chooses the best fit per role under that role's cap, which can repeat a model. **Reasoned:** the same model across roles can simplify support, and versions differ mainly by RAM and storage | Medium | A buyer wants the fewest models |
| Q-F05-1 | Should summaries be on by default? | **No** | See Q-P4 | Medium | – |
| Q-F05-2 | Which sources may be quoted, and with what limits? | **Only (1) LapFit's own consented owner reports, and (2) short excerpts from a source whose terms allow it, with attribution and a link.** Everything else is linked to, not copied. Treat quoting any review text as blocked until rights are checked (to-do 6.6) | **Reasoned.** **Cannot check:** I did not read any site's terms | Low | The rights check says otherwise |
| Q-F05-3 | Should region (India vs elsewhere) be a filter? | **Yes, as an optional filter, with a new `region` column on evidence** | **Your brief:** your first message lists "India vs US" as one of the lens views. **Prototype:** it has no region column yet | High | – |
| Q-F06-1 | Who are the named reviewers? | See O-07 | – | Low | – |
| Q-F06-2 | Should owners prove ownership? | **Not in the first version.** Label reports "owner-reported, not verified" and rely on human review and the minimum count (20). A model-sticker photo could be added later | **Reasoned:** proof adds friction and collects more personal data; fake reports are limited by approval and by the count requirement | Medium | A spam or fake-review problem appears |
| Q-F07-1 | Are 3% (price drop) and 5 reports (rising complaint) right? | **Keep them as settings, and calibrate after four weeks of real data.** For the price rule, set the threshold above the normal day-to-day price noise | **Prototype:** these are the current values. **Cannot check:** I have no real price data to calibrate against | Low | Real data arrives |
| Q-F07-2 | Show "most checked" to the public or only to brands? | **Public, but only items with at least 20 distinct checks, and count one view per session per laptop per day** | **Reasoned:** public trends help buyers; the minimum and the de-duplication limit gaming. Needs a session identifier that is not linked to a person (not built) | Medium | Gaming appears |
| Q-F08-1 | Are accounts and reminders in the course scope? | **No.** Keep the on-device version. Accounts are V2 | **Your brief:** your grading weights put evals (30%), iteration (20%) and customer learning (15%) ahead of extra features. **Reasoned:** accounts add privacy and security work | High | – |
| Q-F09-1 | Where will real used prices and sale outcomes come from? | See Q-F03-2 | – | Low | – |
| Q-F09-2 | Is selling inside the course scope? | **No: it is a demonstrated extension** | **Your answer:** you chose shortlist, second opinion plus pitch check and used check as core | High | – |
| Q-F09-3 | Listing text generation (P6) in the first version? | **No** (V1) | **Reasoned:** it adds a model risk and does not help prove a core use case | High | – |
| Q-F10-1 | First brand or retailer to test with? | **Cannot answer.** Suggestion: ask your instructor or mentor for one introduction, or a local laptop retailer | **Cannot check** | – | You name someone |
| Q-F10-2 | Competitor comparisons in scope? | **No** | **Reasoned:** it needs data from other brands we do not have, and it is outside the core three | High | – |

## 7. Decisions I confirmed on your behalf

| Decision | Result | How I arrived |
|---|---|---|
| D-05 to D-14 | Marked **Decided (assistant, on your instruction)** in `02_DECISIONS.md` | Each follows from the product's own rules, your brief, or the facts above |
| D-06 AI type per scenario | Confirmed | **Reasoned:** each choice follows the rule table; rules and SQL where the answer is a lookup or calculation, a model only to read or to write. The thresholds for adding classic ML are rules of thumb and say so |
| D-03 free-tier risks | Updated with C1 to C4 | **Checked** |

## 8. What I could not answer by checking

| Item | Why | Working assumption |
|---|---|---|
| Submission due date (O-01) | Only you or the course know it | Finish a week before the last class |
| Slides: V × F × D × R anchors, cost-of-being-wrong worksheet (O-04) | Not provided | Use decision D-10 until you send them |
| Named reviewers (O-07) | They are people | Two team members plus one outsider for a sample |
| First brand contact (Q-F10-1) | A relationship | Ask the instructor |
| Real used prices, real review rights (Q-F03-2, Q-F05-2) | I did not read any site's terms | Use only consented and hand-collected data |
| Native-speaker wording (Q-P2) | I cannot confirm naturalness | Samples only |
| Affiliate commission rate (to-do 11.2) | Comes from the programme's own schedule | Do not quote a rate until checked |
| Real-user sessions, measured accuracy, latency, cost | No users or model key here | All gates are proposals |

## 9. Questions raised while specifying F03 (answered)

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F03-4 | How should a price flag look while the used-price band is only a sample? | Show it, tagged "sample range", at level "note" (not "check") until the band comes from real observed prices | **Reasoned:** a flag built on made-up numbers should not read as a warning. **Prototype:** it currently shows the band as a warning | Medium | Real prices exist |
| Q-F03-5 | What is the "usual range" once real data exists? | The middle half (25th to 75th percentile) of observed used prices for the same version, age group and condition; if fewer than 20 observations, widen to the same version, then the same model; if still under 20, use the sample band and say so | **Reasoned:** the middle half ignores extremes; the minimum of 20 matches the product's evidence rule | Medium | Real data shows a different spread |
| Q-F03-6 | What battery health counts as low? | Note under 80%, check under 70%, both settings; always show the number and say where it came from | **Checked (C10):** no authoritative cut-off; sources disagree | Low | You find a better source |
| Q-F03-7 | Which operating-system rules apply? | Windows 7 and 8.1: always a flag. Windows 10: flag (support ended 14 Oct 2025). Windows 11 on a model older than 2018: a note. Stored in an admin-editable table with dates and a source | **Checked (C7 to C9)** | Medium (Windows 11 rule: Low) | Microsoft's own page differs |
| Q-F03-8 | Should a listing priced above today's new price be flagged? | Yes, as a check-level flag with the new price and its as-of date | **Reasoned:** a used price above new is almost always a mistake or a different version | High | – |
| Q-F03-9 | Should the seller's stated reason matter? | Yes, as a note when it mentions a fault: "ask exactly what the problem is" | **Reasoned:** a stated fault is information the buyer should chase | Medium | – |
| Q-F03-10 | How to treat refurbished listings? | Same checks, plus a note if no seller warranty is stated | **Reasoned:** a refurbisher's warranty is the main protection and its absence should be visible | Medium | – |
| Q-F03-11 | Should the serial number be requested in photos? | Ask for it, but tell the buyer it can be hidden except the last characters, and do not store it | **Reasoned:** serial numbers identify a device and a person; the check only needs to know whether one is shown | Medium | – |
| Q-F03-12 | What if the user asks "should I buy?" | Say plainly that LapFit does not give a buy or don't-buy verdict, and give the flags and the checklist | **Your brief:** the used-check flow says "do not give a buy or don't-buy verdict" | High | – |
| Q-F03-13 | What must be stored from a used check? | Only anonymous codes: model, price band, flag codes, whether the band was sample or observed. No listing text, no price, no serial | **Reasoned:** the unhandled log is already a privacy gap; do not add another | High | A reason to store more appears |
