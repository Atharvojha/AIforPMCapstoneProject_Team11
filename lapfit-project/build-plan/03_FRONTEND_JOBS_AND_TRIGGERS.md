# What the frontend must do, and what triggers each job

This is **not** a screen specification. It lists the jobs the frontend has to perform, the trigger point that starts each job, and what it needs from the backend. Screen design comes after, once these jobs exist.

For each job: the **surface** (a place in the product that carries the job), the **trigger**, what the frontend **collects**, which **backend call** it makes, and what it must **present**, described by meaning and not by layout.

**Frontend platform:** Lovable. It calls one public entry point (`query`) plus a few small endpoints; it holds only the public key (see `01_BACKEND_BUILD_PLAN.md`, section 7).

---

## 1. The surfaces the frontend needs

| # | Surface | Job it carries | Features |
|---|---|---|---|
| S1 | **Entry** | Start any request: free text (photo later), a few examples, links to the other surfaces | All |
| S2 | **Needs finder** | Enter needs without typing; see results change as needs change | F01, F04 |
| S3 | **Results** | Show recommended laptops with the evidence behind each | F01, F02, F04 |
| S4 | **Compare** | Put two to four laptops side by side | F01, F02, F04 |
| S5 | **Check** | Paste a seller pitch or a used listing and see what checks out | F02, F03 |
| S6 | **Owner reports** | Filter what owners say and read it with counts | F05 |
| S7 | **Share an experience** | Submit an owner report and look up its status | F06 |
| S8 | **Market** | See trends, complaints and price falls | F07 |
| S9 | **My laptops** | Keep owned laptops and see warranty, price, value | F08 |
| S10 | **Sell** | Describe a laptop to sell and see the plan | F09 |
| S11 | **Brand insights** | Sign in and see insights for a brand | F10 |
| S12 | **Admin and review** | Approve reports and verdicts, import data, change settings | F02, F05, F06, F09 |
| S13 | **Trust information** | Explain sources, what is sample data, limits and privacy notice | All |

---

## 2. Jobs and trigger points

### 2.1 Core jobs (every feature uses these)

| ID | Job | Trigger point | Collects | Backend call | Must present (meaning only) |
|---|---|---|---|---|---|
| J1 | **Send a request** | The user submits free text from the Entry, or from a text field on any surface | Text up to 4,000 characters; recent earlier messages (up to 6); photo (later) | `POST query` with text | The response's items; a notice if the text contained instructions that were ignored |
| J2 | **Answer one clarifying question** | The response contains a question with choices | The chosen choice (or typed answer) | `POST query` with the choice and the thread | The next response; never more than one question at a time |
| J3 | **Show and correct understood needs** | The response contains understood needs | Edits: change a need's tier (Must, Should, Nice), remove it, change the budget | `POST query` with the edited needs | The new results; "cannot check yet" needs shown as such |
| J4 | **Show results with evidence** | The response contains result items | Nothing | None | For each: name, version, price with date, reasons, owner rating with n, which Musts are met or not, specs, colours |
| J5 | **Offer the next step** | The response contains an offer (relax a Must, show better options, open the form) | The user's acceptance | `POST query` with the offered payload | The result of that step; nothing changes unless the user accepts |
| J6 | **Fallback when the model is unavailable** | The response says the model failed, or a timeout of about 10 seconds passes | The structured needs | `POST query` with the structured form | The same kind of results, with a short notice |
| J7 | **Always show honesty notices** | Every response | Nothing | Reads `config` | The sample-data notice; the commission line; "not enough evidence (n = …)"; "machine-read, not human-verified" where it applies |
| J8 | **Handle failure and waiting** | A request is in flight, fails, is rate limited, or the device is offline | Nothing | Retry on request | A waiting state, a plain error, "try again later", and the user's text kept |
| J9 | **Send an anonymous session id** | The user opens any surface that counts views | A random id kept for the browser session | Included in view events | Nothing visible |
| J10 | **Honour feature switches** | App start | Nothing | `GET config` | A feature hidden or limited if the backend says its model path is off |

### 2.2 Feature jobs

| ID | Job | Surface | Trigger point | Collects | Backend call | Must present |
|---|---|---|---|---|---|---|
| F1 | **Structured needs entry with live results** | S2 | Any change to budget, uses, RAM, storage, weight, type, colour, in-stock | The needs object | `POST query` (needs), debounced, with a request id | Results for the latest request only; older responses ignored |
| F2 | **Add a laptop to compare** | S3, S5, S6 | The user marks a result item for comparison | Variant id | Local selection; optionally `GET compare?ids=` | A count of picked laptops and how many more are needed (minimum 2, maximum 4) |
| F3 | **Open the comparison** | S4 | The user opens comparison with 2 to 4 picked laptops | Variant ids | `GET compare?ids=` (recommended: the backend returns aligned values and passes them through the gate) | Side-by-side values: price with date, RAM, storage, screen, weight, type, processor, graphics, memory, warranty, colours, owner rating with n; which differ |
| F4 | **Pick which one** | S3, S5 | A response asks which model or version | The chosen item | `POST query` with the choice | The checked result |
| F5 | **Check a seller pitch** | S5 | The user submits pasted pitch text (photo later) | Text | `POST query` with a force-flow `check_pitch` | Each claim with its status: matches, does not match, not in catalog, checked by a person (with approver, date, n), not checked yet, cannot be checked; the laptop's second-opinion result |
| F6 | **Check a used listing** | S5 | The user submits pasted listing text (photo later) | Text, or the structured fallback fields | `POST query` with force-flow `used_check` | Ordered flags with level and "ask for"; the in-person checklist; what cannot be judged; no buy or don't-buy words |
| F7 | **Track a checklist** | S5 | The user ticks an item | Item id | None (kept on the device) | Progress; nothing stored on the server |
| F8 | **Filter owner reports** | S6 | Any change to who, topic, months, window, laptop, region | Filters | `POST query` (ownerFilters) | Per laptop: n, rating or polarity share, topics, sources; excerpts only if n is at least 20; a loosen suggestion if empty |
| F9 | **Open owner reports for a laptop** | From any result, claim row, market item, owned laptop | The laptop id (and the user's stated use) | `POST query` (ownerFilters) | Reports filtered to that laptop; the "people like you" group preselected when a use is known |
| F10 | **Submit an owner report** | S7 | The user starts "share my experience" | Notice acknowledged; "18 or older" confirmed; laptop, use, months, topic, rating, note | `POST submit-report` | A receipt code shown once; a plain error naming what to fix |
| F11 | **Check report status or request deletion** | S7 | The user enters the receipt code | Code | `POST report-status`, `POST report-delete` | Pending, approved, or rejected with a reason; confirmation of deletion |
| F12 | **Market pulse** | S8 | Surface opens; the user changes the window (7, 30, 90 days) | Window | `POST query` (trending) | Three lists with counts and dates, and the minimums stated; empty lists say so |
| F13 | **Keep owned laptops** | S9 | The user adds, edits or removes a laptop | Version, purchase date, optional price paid | Local storage on the device; `POST garage` to compute | Warranty days left, price now vs paid, rough resale range (labelled sample), rating with n, rising complaints; a note if storage is blocked |
| F14 | **Start a sale from an owned laptop** | S9 → S10 | The user chooses "sell this" | Version, months owned | Prefill | The sell form prefilled |
| F15 | **Describe a laptop to sell** | S10 | The user submits the form, or free text | Version, age, body, screen, battery %, keyboard, bill and box, warranty left, software, reason, urgency (each may be "not sure") | `POST query` (sellerForm) or text with force-flow | Value range; fixes marked do or skip with the numbers; pricing pair; timing; what to disclose; missing details; how it was worked out |
| F16 | **Add missing sell details** | S10 | The user accepts the offer to add missing details | The same form, prefilled | Same | A tighter range |
| F17 | **Buy for someone else** | S1, S3 | The response asks "who will use it" or "what for" | Choice | `POST query` | A recommendation with editable defaults; for a team, a table of one laptop per role with totals |
| F18 | **Paste a team table** | S1 | The user pastes roles, people, uses, budgets | Text | `POST query` | The table, totals against budget, roles with no fit |
| F19 | **Brand sign-in and insights** | S11 | The user signs in; chooses a model | Credentials (via the auth provider); model id | `GET brand/insights`, `GET brand/demand` | The brand's own models only; matrix with n and early-signal labels; price series; weekly counts; complaints; demand; unmet demand; suppressed cells hidden |
| F20 | **Review queue** | S12 | A reviewer opens the queue | Decision, reviewer name, reason | Admin endpoints | Pending reports with flags; approve or reject; conflicts shown |
| F21 | **Manage the claim ledger** | S12 | A reviewer creates, approves or retires an entry | Claim, scope, terms, verdict, sample size | Admin endpoints | Entries with status and approver |
| F22 | **Import and settings** | S12 | An admin uploads a file or changes a threshold | File; key and value | Admin endpoints | Import result with rejected rows; settings with versions |
| F23 | **Show trust information** | S13 | The user opens it from a footer or an info link | Nothing | `GET methodology` | Sources and their permissions, what is sample, what is machine-read, limits, privacy notice and version |

---

## 3. Trigger points that connect features

| From | Action | To |
|---|---|---|
| Any result item | "What owners say" | Owner reports for that laptop (F9) |
| Any result item | "Add to compare" | Compare (F2, F3) |
| A claim row or the laptop header in Check | "Show better options" | Results from the shortlist flow (J5) |
| Market list item | "See owner reports" | Owner reports (F9) |
| Owned laptop | "What owners say", "Share my experience" (after one month), "Sell this laptop" | Owner reports, Share an experience, Sell (F9, F10, F14) |
| Response asks a question | Choice | The same thread continues (J2) |
| No match | A relax offer | Results with the relaxed need (J5) |
| Sell plan with missing details | "Add details" | Sell form prefilled (F16) |
| Any surface | A footer link | Trust information (F23) |

---

## 4. Rules the frontend must follow (functional)

1. **Never compute a fact.** Prices, ticks, ratings, totals and verdicts come from the backend. The frontend only arranges them.
2. **Show every notice the response carries**, including counts (n) and "not enough evidence".
3. **Never hold a secret.** Only the public key.
4. **Send a request id**; ignore responses to older requests.
5. **Keep user text in place** if a request fails.
6. **Do not store user data on the server**: owned laptops and checklist progress stay on the device.
7. **Tell the user when something is sample data**, machine-read, or unverified.
8. **Never show a verdict** the backend did not return.
9. **Ask for notice and age confirmation** before the owner-report submission is sent.

---

## 5. What the frontend needs from the backend before it starts

| Need | Provided by |
|---|---|
| A working `query` entry point with the response block types: understood needs, notice, choices, offer, result items, claims, used-check flags, owner-voice rows, trending lists, sell plan, team table, form fallback | Backend steps B4 to B10 |
| `config` (notice text, limits, feature switches) | B4 |
| `compare`, `submit-report`, `report-status`, `report-delete`, `garage`, brand endpoints | B10 |
| Sample data loaded and labelled | B1, B2 |
| Contract tests for each job above | B12 |

When the frontend exists and works against these calls, write the screen specifications from what was built, not before.
