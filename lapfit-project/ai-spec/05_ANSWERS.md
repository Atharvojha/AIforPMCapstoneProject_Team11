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

### Facts checked for the remaining specs (13 Nov 2026)

| # | Fact | Source | What it means for LapFit |
|---|---|---|---|
| C11 | India's **Digital Personal Data Protection Rules, 2025** were notified in November 2025 (13 or 14 Nov, sources differ) and phase in over about 18 months; the main duties start around **May 2027**. A **notice** must accompany or precede a consent request. For anyone **under 18**, **verifiable parental consent** is required, and tracking, behavioural monitoring and targeted advertising aimed at children are prohibited. The Rules set retention and erasure timelines for certain classes of fiduciary (one secondary source mentions one year of inactivity; not verified) | [Storyboard18](https://www.storyboard18.com/amp/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm), [Baker Botts](https://ourtake.bakerbotts.com/post/102lund/india-notifies-final-rules-for-digital-data-protection-act), [AZB](https://www.azbpartners.com/bank/update-indias-digital-personal-data-protection-framework-comes-into-effect/) | Every form that collects anything shows a notice. The owner-report form asks for confirmation that the person is 18 or older. LapFit does not track people. Deletion works by receipt code. **Not legal advice; confirm with the Gazette text** |
| C12 | One secondary source says a breach must be reported to the Data Protection Board within **72 hours**; another said one-year inactivity limits apply to some categories (**corrected in C22**: the 72 hours is confirmed by several sources; the erasure rule is three years for very large platforms, not one year). I found no primary text in these results | [TaxGuru](https://taxguru.in/?p=1064181), [Legal 500](https://www.legal500.com/developments/?p=53484) | An incident process is a launch task. Treat both figures as unverified |

Because the dates differ by a day or two across sources and the primary text was not in the results, **do not quote any DPDP date or number in the PRD without checking the Gazette.**

### Facts checked for the backend plan and AI PRDs (13 Nov 2026)

| # | Fact | Source | What it means for LapFit |
|---|---|---|---|
| C13 | Make.com webhook response timing: **no official figure in the results.** Community answers most often say a webhook response must be sent within **40 seconds**; one third-party guide says 180 seconds and Apify's help says 10 seconds. Nothing found on free-plan operation limits. The common workaround is to respond early and do slow work afterwards | [Make community](https://community.make.com/t/timeout-error/37183.md), [Make community thread on responses](https://community.make.com/t/main-scenario-helper-scenario-webhook-response-timeout-problem/41102), [Apify help](https://help.apify.com/en/articles/11169468-troubleshooting-webhook-timeouts-when-running-actors-in-make) | Treat the limit as unknown. Keep the live path in Edge Functions (D-16); use Make for jobs |
| C14 | Gemini paid-tier prices per 1M tokens as shown on the pricing page: `gemini-3.1-flash-lite` $0.25 in, $1.50 out; `gemini-3.5-flash-lite` $0.30 / $2.50; `gemini-2.5-flash-lite` $0.10 / $0.40; `gemini-3.8-flash` $0.75 / $3.75 until 31 Dec 2026, then $1.50 / $7.50. Output includes thinking tokens. Batch is 50% cheaper. Free-tier content is used to improve Google's products. (I read the first 100,000 of 114,586 characters of the page.) | [Gemini pricing](https://aistudio.google.com/docs/pricing) | Basis of the cost sections. **Verify before relying on them** |
| C15 | **Lovable Secrets** are for backend values used by Edge Functions and never reach the browser; anything prefixed `VITE_` is exposed to the browser. For Gemini I found only third-party guidance that the same pattern applies | [Lovable docs: Secrets](https://docs.lovable.dev/features/secrets) | The Gemini key goes in Secrets, never in a `VITE_` variable |
| C16 | **Existing database inventory** (queried directly): 28 models, 29 variants, 173 spec facts, 12 benchmarks, 10 sources, 3,987 reviews (3,300 Flipkart, 687 Amazon), 1,316 extracted opinions (all machine-validated, none human-verified; usage context empty), 3,987 embeddings of 384 numbers, 458 duplicate clusters, 4,514 topic opinions in a vote file. No review has a date. Price rows (14) carry one retrieval date, 2026-11-10 | `prototype_prathyusha/backend/data/lapfit.db`, `votes.db`, `docs/DATA_AUDIT.md` | The data layer plan; the time-based features cannot run on this data |


### Facts researched on 13 Nov 2026 to settle the open items

| # | Fact | Source | What it means for LapFit |
|---|---|---|---|
| C17 | The **Flipkart Review Dataset** record (Zenodo 17612521; 194,276 rows; created 14 Nov 2025; author field "None") states the licence **CC BY 4.0**: re-use and redistribution allowed if the creator is credited. *Your earlier data audit recorded the licence field as blank; open the record yourself to confirm it still says CC BY 4.0* | [Zenodo record](https://zenodo.org/records/17612521) | Usable with attribution. The licence is declared by the uploader; Flipkart's and its customers' own rights are not established by it |
| C18 | **Amazon Reviews 2023**: the maintainers say they cannot assign a licence or dictate terms, that the data is **made available primarily for research purposes**, and that users must follow ethical and legal standards. A secondary source says Amazon's Customer Reviews terms bind redistribution | [Hugging Face discussion](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/discussions/1), [dataset page](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023) | Research and evaluation only. Never shown publicly |
| C19 | **Gemini embeddings:** `gemini-embedding-2` (stable, multimodal, 8,192-token input, 3,072 dimensions by default, selectable 128 to 3,072 with 768, 1,536 or 3,072 recommended, "over 100 languages"; Hindi, Telugu and Tamil are **not named**); `gemini-embedding-001` (text only, 2,048 tokens, `task_type`). **Prices per 1M input tokens:** embedding-2 $0.20 standard, $0.10 batch; embedding-001 $0.15 standard, $0.075 batch. Free tier exists (and is used to improve Google's products) | [Embeddings docs](https://aistudio.google.com/docs/embeddings), [pricing](https://aistudio.google.com/docs/pricing) | Re-embedding about 4,000 short reviews costs cents. Language quality for Hinglish, Telugu and Tamil must be tested, not assumed |
| C20 | **Supabase:** Free plan $0 with 500 MB database, **paused after 1 week of inactivity**, 500,000 Edge Function invocations, 5 GB egress; Pro from **$25 a month** with 8 GB, never paused, 2 million invocations. **Edge Functions:** 150 s wall clock on Free, 400 s on paid; **2 s CPU per request**; 256 MB memory; 150 s idle timeout. **pgvector** is supported (extension `vector`; filtered searches should use iterative index scans). **Supabase Cron** (`pg_cron`) runs SQL or calls an Edge Function at any interval; recommended at most 8 jobs at once and 10 minutes each | [Pricing](https://supabase.com/pricing), [Edge limits](https://supabase.com/docs/guides/functions/limits), [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector), [Cron](https://supabase.com/docs/guides/cron) | Our data is small, so Free is enough to build; the 1-week pause matters for demos; scheduled jobs need no extra tool |
| C21 | **Make.com:** Free plan **1,000 credits a month** (official pricing page); third-party pages list 2 active scenarios, a 15-minute minimum interval and a 5-minute execution limit; Make's help says it processes up to **300 incoming webhook requests per 10 seconds**. **A webhook-response time limit is still not documented anywhere I could read** | [Make pricing](https://www.make.com/en/pricing), [Make webhooks help](https://help.make.com/webhooks), [CostBench](https://costbench.com/software/ai-automation/make/free-plan/) | Make's free plan cannot carry many scheduled jobs; keep it for connectors only |
| C22 | **India's DPDP Rules (corrections to C11 and C12):** notified 13 Nov 2025; main duties from about **13 May 2027**. **Breach (Rule 7):** tell affected people without delay and send a **detailed report to the Board within 72 hours**, with no materiality threshold (several law-firm sources agree). **Erasure:** for e-commerce entities with **2 crore or more registered users**, online gaming and social media, personal data is erased **three years after the person's last interaction**, with **48 hours' notice** before erasure. The "one year" in my earlier text was wrong for this: a **one-year minimum retention of certain logs** for investigation is mentioned by one source, unverified. The gazette text (G.S.R. 846(E)) was not available to me | [Mondaq](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified), [Rule 7 summary](https://dpdp.myndsolution.com/wiki/rules/rule-7-intimation-of-personal-data-breach/), [Business Standard (draft)](https://www.business-standard.com/india-news/digital-data-protection-draft-rules-data-deletion-125010400238_1.html), [JSA](https://www.jsalaw.com/wp-content/uploads/2025/11/JSA-Prism-InfoTech-November-2025-DPDP-Rules.Final_.pdf) | LapFit is far below the 2-crore-user threshold, but the 72-hour breach duty and the notice and consent duties will apply. Keep short retention anyway |
| C23 | **Windows 11 supported processors (Microsoft's own lists):** Intel **Core 8th generation and later** (8th to 14th), plus listed Celeron and Pentium series; AMD lists include the Ryzen 5 4600H, 5500U and 5600H and the Ryzen 7 4800H. Microsoft says later generations that meet the same principles are supported, and tells customers to use **PC Health Check** | [Intel list](https://learn.microsoft.com/en-us/windows-hardware/design/minimum/supported/windows-11-supported-intel-processors), [AMD list](https://learn.microsoft.com/en-us/windows-hardware/design/minimum/supported/windows-11-supported-amd-processors), [Processor requirements](https://learn.microsoft.com/en-us/windows-hardware/design/minimum/windows-processor-requirements) | The Windows 11 rule can use the processor, not the model year |
| C24 | **Battery:** Apple's service pages say a MacBook battery is designed to keep **up to 80% of its original capacity at 1,000 complete charge cycles**; it is a design target, not a cut-off. Apple's one-year warranty covers a defective battery. No authority gives 70% | [Apple battery service](https://www.apple.com/ug/batteries/service/), [MacRumors](https://www.macrumors.com/guide/applecare-macbook-battery-replacement/) | The 80% note line has a manufacturer anchor; 70% stays a labelled rule of thumb |
| C25 | **Warranty in India:** ASUS says every laptop ships with a 1-year warranty ([ASUS India guide](https://www.asus.com/in/content/asus-assurance-guide/)); Acer India offers at least 1 year ([Acer India](https://www.acer.com/in-en/support/warranty/wst)); Apple's one-year limited warranty starts on the day of purchase; HP, Lenovo and MSI are one year per secondary articles. The start-date rule is **confirmed only for Apple**; one article says Acer needs registration | Same links; [BGR](https://www.bgr.com/2202034/laptop-brands-best-warranty/) | Default 1 year for the 14 laptops; tell owners to keep the invoice |
| C26 | **GST:** a GST-registered business can claim input tax credit on a laptop used for taxable supplies if it holds a valid tax invoice with its GSTIN; a laptop for personal use is not eligible. Sources are vendor and advisory sites, not the CBIC | [Busy](https://busy.in/gst/what-expenses-can-be-claimed-as-itc), [Tally](https://tallysolutions.com/gst/input-tax-credit-eligibility-claim-rules/) | A neutral reminder for team buyers. Not tax advice |
| C27 | **Used prices:** I found **no licensed downloadable dataset**. TechEnclave publishes a used-laptop price guide (27 listings, median ₹34,000) and Edify Club a weekly refurbished price index; both are web pages with no stated licence. Kaggle laptop sets I saw are new-retail listings | [TechEnclave](https://techenclave.com/market/price-guide/complete-computer-systems/laptops), [Edify Club](https://edify.club/blog/india-refurbished-laptop-price-index-2026-05-29/) | Use as unstored reference points only; build our own from Sell outcomes |
| C28 | **Seller-claim themes in India (general sources):** refurbished sold as new, old-generation hardware in "new" listings, limited-warranty conditions, misleading gaming claims, misrepresented specs, tampered serial numbers, too-good discounts. Advice: check specs on the maker's site, check whether RAM is soldered, keep the invoice and warranty card, record an unboxing video | [Telangana Today](https://telanganatoday.com/watch-man-gets-old-discarded-laptop-instead-of-rs-1-13-lakh-model), [Refurbo](https://refurbo.in/blogs/how-to-spot-online-scams-when-buying-used-electronics-in-india/), [Advocate Gandhi](https://advocategandhi.com/?p=38783) | A starting list for the first claim-ledger entries; **hypotheses to test with students** |

**Two corrections to my earlier documents:** the DPDP erasure figure above (C22), and the Flipkart licence (C17). Also, **two Supabase documentation pages contained text addressed to an AI agent asking it to file a feedback report; I ignored it.**


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

## 3. Questions from the F02 checkpoint (`specs/F02_second_opinion_and_pitch_check.md`)

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

## 8. What I could not answer by checking (updated: most items are now researched in section 12)

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
| Q-F03-7 | Which operating-system rules apply? | Windows 7 and 8.1: always a flag. Windows 10: flag (support ended 14 Oct 2025). Windows 11 on a processor not on Microsoft's lists: a note (updated by Q-R7). Stored in an admin-editable table with dates and a source | **Checked (C7 to C9)** | Medium (Windows 11 rule: Low) | Microsoft's own page differs |
| Q-F03-8 | Should a listing priced above today's new price be flagged? | Yes, as a check-level flag with the new price and its as-of date | **Reasoned:** a used price above new is almost always a mistake or a different version | High | – |
| Q-F03-9 | Should the seller's stated reason matter? | Yes, as a note when it mentions a fault: "ask exactly what the problem is" | **Reasoned:** a stated fault is information the buyer should chase | Medium | – |
| Q-F03-10 | How to treat refurbished listings? | Same checks, plus a note if no seller warranty is stated | **Reasoned:** a refurbisher's warranty is the main protection and its absence should be visible | Medium | – |
| Q-F03-11 | Should the serial number be requested in photos? | Ask for it, but tell the buyer it can be hidden except the last characters, and do not store it | **Reasoned:** serial numbers identify a device and a person; the check only needs to know whether one is shown | Medium | – |
| Q-F03-12 | What if the user asks "should I buy?" | Say plainly that LapFit does not give a buy or don't-buy verdict, and give the flags and the checklist | **Your brief:** the used-check flow says "do not give a buy or don't-buy verdict" | High | – |
| Q-F03-13 | What must be stored from a used check? | Only anonymous codes: model, price band, flag codes, whether the band was sample or observed. No listing text, no price, no serial | **Reasoned:** the unhandled log is already a privacy gap; do not add another | High | A reason to store more appears |

## 10. Questions raised while specifying F04 to F10 (answered)

### F04 Buy for others or a team

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F04-3 | Which team-table formats are accepted? | Role, number of people, use, optional budget each; separated by pipes, tabs or commas; header row optional; up to 30 roles. A bad line is named back | **Prototype:** it already parses these separators. **Reasoned:** people paste from spreadsheets, which give tabs or commas | Medium | Real pastes fail |
| Q-F04-4 | Per-role budget when none is given? | Remaining total divided by the people in roles without a budget, rounded down | **Prototype:** this is what it does. **Reasoned:** simple and explainable | Medium | Teams want weighted shares |
| Q-F04-5 | Should it handle business needs such as a GST invoice or on-site warranty? | Only a neutral reminder: "Ask the seller whether a GST invoice is available if your business needs one." Not a claim | **Cannot check:** I did not verify the tax rules, and the data holds neither invoice nor on-site warranty | Low | You verify the rule |
| Q-F04-6 | Recipients other than parent, child or team? | Treated as "other": ask only the use; no persona defaults | **Reasoned:** defaults for a spouse or friend would be guesses | Medium | – |
| Q-F04-7 | What if the team is over budget? | State by how much; V1 adds computed savings (the next cheaper qualifying laptop per role) | **Reasoned:** gives a way back under budget without inventing figures | Medium | – |
| Q-F04-8 | Limits? | 30 roles, 500 people per role, as settings | **Reasoned:** keeps the table readable and the request fast | Low | Real teams exceed them |

### F05 Owner voice

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F05-4 | Region default? | "All regions", every excerpt labelled, with a one-tap "India only" | **Your brief:** "India vs US" is a lens view you asked for. **Reasoned:** hiding other regions by default would hide evidence | Medium | Buyers find other regions misleading |
| Q-F05-5 | What is "people like you"? | Only reports from the user type that matches the buyer's stated use, shown separately with n; never blended silently; under 20 shows the wider view with a note | **Your brief:** your to-do 3.10 asks for ratings that count only reviewers whose situation matches | Medium | Tests show it confuses |
| Q-F05-6 | Tagging thresholds? | Model confidence at or above 0.80 is "tagged"; below goes to review; one in ten tagged rows is audited by a person; a batch is released only if the audit agrees on at least 85% of fields | **Reasoned:** starting values; settings. **Cannot check:** no real batch yet | Low | The first audit |
| Q-F05-7 | Use-to-user-type mapping? | Coding → developer; gaming → gamer; study → student; editing → creator; office → office; buying for a parent → parent | **Prototype:** the six user types and uses already exist. **Reasoned:** the obvious pairings | Medium | Interviews show otherwise |
| Q-F05-8 | Let people report a bad excerpt? | Yes in V1, with a reason and no account | **Reasoned:** the cheapest route to catch errors | Medium | Abuse of the report link |

### F06 Add my experience

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F06-3 | Review turnaround? | Target 48 hours for the oldest pending report; shown to admins | **Reasoned:** a small team can keep up; adjust to staffing | Low | Reviewers cannot keep up |
| Q-F06-4 | How to honour deletion without accounts? | A receipt code shown once; only its hash is stored; it gives status and deletion | **Checked (C11):** erasure on request is part of the new law's direction. **Reasoned:** avoids accounts and personal data | Medium | Legal review |
| Q-F06-5 | Age check? | A required "I am 18 or older" confirmation | **Checked (C11):** under-18s need verifiable parental consent. **Reasoned:** a checkbox is not verifiable, but it avoids knowingly collecting children's data; get legal advice | Low | Legal review |
| Q-F06-6 | What does the notice say? | What is collected (the note and ratings, no name or contact), why (to help other buyers), how long it is kept, how to delete it with the code, and the notice version | **Checked (C11):** a notice must accompany or precede consent | Medium | Legal review |
| Q-F06-7 | Can owners edit a published report? | No: delete and resubmit | **Reasoned:** editing would bypass review | High | – |
| Q-F06-8 | Can owners check status? | Yes, by code | **Reasoned:** closes the loop with no personal data | Medium | – |

### F07 Market pulse

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F07-3 | How to count distinct viewers without tracking people? | A random id per browser tab session, hashed; one view per laptop per session per day | **Reasoned:** limits gaming; links to no person. Also fits the rule against tracking people | Medium | Gaming appears |
| Q-F07-4 | Which price series for drops? | The lowest price per day among verified sellers | **Reasoned:** buyers care about the best price they can get; one seller's error is excluded by "verified" | Medium | Sellers differ in reliability |
| Q-F07-5 | Live or pre-computed? | Pre-computed nightly; computed on demand if older than 36 hours | **Reasoned:** steady numbers and speed | Medium | – |
| Q-F07-6 | Time zone? | Calendar days in Indian time | **Reasoned:** the users are in India | High | – |

### F08 My laptops

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F08-2 | When does the warranty start? | From the purchase date the owner enters, with the catalog text shown alongside | **Cannot check:** I did not verify brands' terms; many start from the invoice date, which is usually the purchase date | Low | A brand differs |
| Q-F08-3 | Is price paid required? | No, optional | **Reasoned:** less friction and less data | High | – |
| Q-F08-4 | Privacy for the on-device list? | Say "Saved on this device only"; the list is sent only to compute and is not logged | **Checked (C11):** a notice is needed before collecting; legal check for accounts in V2 | Medium | Legal review |
| Q-F08-5 | Backup? | V1: download and load a file on the device | **Reasoned:** protects against cleared browser data without accounts | Medium | – |
| Q-F08-6 | Reminder channel? | V2: email first; no WhatsApp until a consent flow exists | **Cannot check:** channel rules and costs not checked | Low | You decide channels |

### F09 Sell plan

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F09-4 | How to capture sale outcomes without accounts? | An optional "Did it sell?" form tied to a receipt code, with consent | **Reasoned:** same pattern as owner reports; no personal data | Medium | – |
| Q-F09-5 | When can the sample factors be changed? | Compare at 30 outcomes per segment; if more than 30% fall outside the range, propose a change for review; at about 1,000 outcomes, test a learned model. Target: sale prices inside the range at least 70% of the time | **Reasoned:** rules of thumb, as in decision D-06 | Low | The first outcomes |
| Q-F09-6 | Can sellers enter their own repair quote? | Yes in V1 | **Reasoned:** a real quote beats a sample cost | Medium | – |
| Q-F09-7 | Minimum net gain for "Do this"? | ₹500, or any non-negative gain for a free step | **Prototype:** this is the current rule | Medium | Real data shows another line |
| Q-F09-8 | How wide is the range? | 8% either side, plus 1.5 points per unknown field, up to 20% | **Prototype:** current values; sample assumptions | Low | Real outcomes |
| Q-F09-9 | What are "quick" and "best price"? | Quick: list at the middle, accept down to the low. Best price: list at the high, accept down to the middle | **Prototype:** current definitions; assumptions | Low | Real outcomes |

### F10 Brand insights

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-F10-3 | How are brands authenticated and limited? | Supabase Auth with a role and brand id, and row-level security so the database enforces the scope | **Reasoned:** scope in the database, not only in code | Medium | – |
| Q-F10-4 | What will a brand pay? | **Cannot answer.** Plan: show the view to three contacts and ask what decision it changes and what they would pay | **Cannot check:** needs real conversations | – | You name contacts |
| Q-F10-5 | Minimum group sizes? | Hide cells under 5 reports; show 5 to 19 as early signals; demand cells need at least 20 searches | **Reasoned:** consistent with the product's evidence rule of 20; protects against identifying one person | Medium | – |
| Q-F10-6 | Do buyers need to be told their anonymous searches inform brands? | Yes, in the privacy notice: budget band, use and must-haves are used in aggregate | **Checked (C11):** a notice is required before collecting | Medium | Legal review |
| Q-F10-7 | Label sample data? | Always | **Reasoned:** the demand figures are invented in the prototype | High | – |
| Q-F10-8 | What if one source supplies a whole cell? | Show the number of sources for that cell | **Reasoned:** one source can skew an average | Low | – |

## 11. Questions raised while planning the build (answered)

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-BUILD-1 | Should the live path use Make.com webhooks, as in your earlier project? | **Edge Functions for the live path; Make for offline jobs and connectors.** Make on the live path only as a shortcut behind an Edge Function | **Checked (C13):** the response limit is unconfirmed. **Reasoned:** the 8-second budget and the need to test the gate favour code | Medium | Make's limits are verified |
| Q-BUILD-2 | Can we use the existing databases? | **Yes: import the data, not the old service** | **Checked (C16) by querying the files.** The schema has provenance, permissions and quotes that match our data model | High | Rights cannot be confirmed |
| Q-BUILD-3 | Which data is missing for the core features? | Hinge type, colours, warranty, model year and memory slots for the 14 India laptops; a claim ledger; used prices | **Checked (C16)** against each feature's needs | High | – |
| Q-BUILD-4 | Can "last 30 days" and "owned 6+ months" work on existing data? | **No.** No review has a date or months owned, and usage context is empty. They work only on new owner reports and sample data | **Checked (C16)** | High | A dated source is found |
| Q-BUILD-5 | Which topic list should we use? | The existing 14 categories, with our seven as a grouping | **Checked (C16):** 1,316 opinions already use them. Re-labelling would cost time and risk | Medium | Users find them confusing |
| Q-BUILD-6 | Rating or polarity for imported opinions? | Polarity counts for imported opinions; ratings for new owner reports | **Checked (C16):** imported rows have polarity only | High | – |
| Q-BUILD-7 | How do we embed queries if the stored vectors use a local model? | Re-embed once with a hosted Gemini embedding model; keep old vectors for a side-by-side test; text search first | **Reasoned:** vectors from different models cannot be compared; the volume is small. **Not checked:** the embedding model name and price | Medium | Text search proves enough |
| Q-BUILD-8 | Where do API keys go? | Server only: Edge Function secrets for Gemini and the service key; the browser holds only the public key | **Checked (C15)** | High | – |
| Q-BUILD-9 | Which model? | Start with `gemini-3.1-flash-lite`; compare with the next tier on the golden set | **Checked (C14):** lowest price among the current Flash-Lite options | Medium | The first scored run |
| Q-BUILD-10 | Can the review text be shown publicly? | Not yet. `course` mode only; `production` mode needs confirmed rights | **Checked (C16):** Flipkart licence blank (a team PDF says CC BY 4.0), Amazon none stated | High | Rights are confirmed |
| Q-BUILD-11 | Is the compare function frontend-only? | The backend should return the aligned values and pass them through the gate; the frontend only arranges them | **Reasoned:** the rule that the frontend never computes a fact | Medium | – |
| Q-BUILD-12 | Without training, how do we get the most accurate results? | The twelve-technique stack in `../build-plan/02_ACCURACY_WITHOUT_TRAINING.md`: facts from data, code decides, constrained outputs, retrieval, gate, abstention, human approval, measured loop | **Reasoned, plus your own measured results** (reader precision 0.88, recall 0.83; earlier model arm 56% against 85%) | Medium | Measured results disagree |
| Q-BUILD-13 | Do the specs describe screens? | No: functional requirements only; UI notes kept as drafts | **Your instruction** | High | – |

## 12. Open items researched and settled (13 Nov 2026)

You said you cannot check anything, so I researched each open item and decided. Where research could not settle it, I say so and give the working decision.

| ID | Question | Answer | How I arrived | Conf. | Revisit if |
|---|---|---|---|---|---|
| Q-R1 | May Flipkart review text be shown? | **Yes, as short excerpts (up to 25 words) with attribution and a link to the dataset record. Never republish the dataset.** Status `declared_cc_by_4`. Legal review before public launch | **Researched (C17):** the record declares CC BY 4.0. **Reasoned:** the uploader's licence does not prove Flipkart's or customers' rights, so keep excerpts short and attributed | Medium | Legal review says otherwise |
| Q-R2 | May Amazon 2023 text be shown? | **No.** Research and evaluation only; excluded from `production` mode. Status `research_only` | **Researched (C18):** the maintainers assign no licence and describe research use | High | Amazon grants permission |
| Q-R3 | Which embedding model and size? | `gemini-embedding-2` at **768 dimensions**, tested against `gemini-embedding-001` and the old vectors on English, Hinglish, Telugu and Tamil queries. Re-embedding about 4,000 reviews costs about **$0.05** (about $0.02 in batch) | **Researched (C19):** names, sizes, prices. **Reasoned:** Hindi, Telugu and Tamil are not named in the docs, so test | Medium | The test fails; use full-text search only |
| Q-R4 | Which Supabase plan? | **Free to build; Pro (from $25 a month) for the demo and pilot.** On Free, keep the project active (it pauses after a week of inactivity) | **Researched (C20)** | Medium | Data or traffic grows |
| Q-R5 | Where do offline jobs run? | **Supabase Cron plus Edge Functions** (no extra tool); Make.com only for connectors | **Researched (C20, C21):** Cron runs any interval and can call functions; Make's free plan is 1,000 credits, 2 scenarios, 15-minute minimum | High | A job needs a connector Supabase lacks |
| Q-R6 | Make's webhook response limit? | **Still unknown.** Not needed: the live path is not on Make | **Researched (C21):** nothing documented | – | You put Make on the live path |
| Q-R7 | How should the Windows 11 rule work? | By **processor**: Intel Core 8th generation or later is supported; AMD models on Microsoft's list are supported; anything else gets "check with PC Health Check". The model-year rule is dropped. For the 14 catalog laptops: **12 supported, 1 macOS, 1 unknown (the Celeron)** | **Researched (C23)** and computed in `data-model/curation/catalog_curation_14.csv` | High | Microsoft changes its lists |
| Q-R8 | Battery thresholds? | Note under 80%, check under 70%, as settings. **80% has a manufacturer anchor; 70% is a labelled rule of thumb** | **Researched (C24)** | Medium | A better source appears |
| Q-R9 | Warranty defaults? | 1 year for all 14, with the source per brand; start date is the purchase date the owner enters; show "keep the invoice" | **Researched (C25)** | Medium | A brand differs |
| Q-R10 | Business-buyer reminder? | One neutral line for team buyers: "If your business is GST-registered, ask for a tax invoice with your GSTIN." No tax advice | **Researched (C26):** secondary sources | Medium | A tax professional objects |
| Q-R11 | Which DPDP duties apply to LapFit? | Notice, consent, 18+ confirmation, deletion by receipt code, **72-hour breach reporting**, grievance handling. The 3-year inactivity erasure applies only to very large platforms, but keep our own shorter limits | **Researched (C22):** gazette text not read | Medium | Legal review |
| Q-R12 | Can the 14-laptop data gaps be filled? | **Partly, in `catalog_curation_14.csv`:** processor split into vendor, family and generation; Windows 11 status; hinge `clamshell` (assistant knowledge, **unverified**); warranty 1 year; memory slots as known (2 partial, rest unknown). **Colours are not collected: they are optional in version 1** | **Researched** and computed from your database | Medium | You verify hinge types |
| Q-R13 | What are the first 10 claim-ledger candidates? | See the list below | **Researched (C28)** plus product knowledge; **hypotheses to test with students** | Low | Student sessions |
| Q-R14 | Where do real used prices come from? | **No licensed dataset exists.** Use published price pages as unstored reference points; build our own from the Sell outcome form with consent; hand-collect numbers only from a few public listings after reading their terms | **Researched (C27)** | Low | A partner appears |
| Q-R15 | What cannot be researched? | **The submission due date, named reviewers, brand contacts, native speakers and real-student sessions.** I made each non-blocking with a working assumption (see section 8) | **Cannot research:** they are people and dates | – | You supply them |

**The ten claim-ledger candidates** (each needs evidence and a named approver before any verdict is shown):

| # | Claim a seller may make | How it would be checked |
|---|---|---|
| 1 | "RAM is upgradable" | Catalog memory-slot fact (soldered or slot) |
| 2 | "Latest generation processor" | Processor generation in the catalog |
| 3 | "512 GB SSD" | Storage and storage type in the catalog |
| 4 | "Brand new, sealed" | Cannot be checked from data; ledger entry gives the checks (serial, invoice, unboxing video) |
| 5 | "Gaming laptop" | Graphics: dedicated or integrated |
| 6 | "Battery lasts 10 hours or a full day" | Benchmark rows and owner battery opinions |
| 7 | "1-year warranty" | Manufacturer vs shop warranty; keep the invoice |
| 8 | "50% off, biggest discount" | Price history |
| 9 | "Runs Windows 11 / free upgrade" | Processor lists (Q-R7) |
| 10 | "Never heats up, silent" | Thermals-and-noise owner opinions |
