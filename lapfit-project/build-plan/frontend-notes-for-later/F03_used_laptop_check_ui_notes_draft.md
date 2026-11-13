# F03_used_laptop_check: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

### A. Screens and navigation

| Screen | Purpose | Entry points | Exit points |
|---|---|---|---|
| S1 Check, Used listing tab | Paste and check | Bottom tab "Check"; Home ask box | Result below; Find; Owners |
| S2 Result (inline) | Flags, checklist, limits | After "Check it" | Check another; Find; Sell (if they own one) |
| S3 Which-one chooser | Choose model or version | When several match | Back to S2 |
| S4 Rules-only form | Fallback | Model failure | S2 |

### B and C. Components and interactions

| Component | Purpose | User action | Data required | API dependency | UI states |
|---|---|---|---|---|---|
| Mode tabs | Pitch or listing | Tap | — | — | Initial: Seller pitch; selecting "Used listing" shows its help text |
| Help text | States the rules ("no buy or don't-buy verdict") | Read | — | — | Always |
| Listing textarea | Input | Paste or type | Text up to 4,000 | — | Initial placeholder and example; Disabled while running; Error over limit |
| "Use an example" | Fills a sample | Tap | — | — | Enabled |
| Photo button (V1) | Attach a screenshot | Choose | Image 1280 px | — | Hidden in the first version |
| "Check it" | Run | Tap | Text | `POST /query` | Disabled when empty or running |
| Laptop header | Names the matched laptop | — | Laptop | — | Matched; Not in catalog |
| Price line | New price with as-of date and the band with its source | — | Band | — | "(sample range)" or "(from N used prices)" |
| Flag row | One flag with a level label, text and "Ask for" | Expand | Flag | — | Fine (✓), Check (▲), Note (i) |
| Checklist | Things to inspect | Tick | Items | — | Unticked; ticked (kept for the session) |
| Cannot-judge list | Limits | Read | List | — | Always shown |
| Choice buttons | Choose a version | Tap | Choices | `POST /query` | Loaded |
| Rules-only form | Fallback | Fill; submit | Laptop picker, numbers | `POST /query` (form) | Initial; Submitting |
| Offline notice | Network lost | Retry | — | — | Offline |

**Sorting:** fixed by rule. **Pagination:** none. **Real-time:** none.

### D. UI states

| State | Behaviour |
|---|---|
| Initial | Empty textarea, example button, help text |
| Loading | Button disabled, "Working on it" |
| Success | Banner, laptop header, price line, flags, checklist, cannot-judge list, footer |
| Empty | Not applicable; if nothing is flagged, the list shows "Fine" lines and the checklist |
| Error | Plain message and the rules-only form |
| Disabled | "Check it" with no text |
| Partial data | Missing fields shown as "Not stated in the listing" with an "Ask for" line |
| Offline | "You seem to be offline. Your text is kept." |
| Permission denied | Not applicable |

### E. Validation

| Field | Rule | Message |
|---|---|---|
| Listing text | 1 to 4,000 characters | "Please paste the listing (up to 4,000 characters)." |
| Form: price | ₹1,000 to ₹10,00,000 | "That price looks wrong. Please check it." |
| Form: battery % | 0 to 100 | "Battery health must be between 0 and 100." |
| Form: RAM, storage | Positive whole numbers; storage in GB or TB | — |
| Form: age | 0 to 20 years | — |

