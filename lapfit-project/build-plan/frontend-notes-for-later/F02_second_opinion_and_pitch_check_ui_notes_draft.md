# F02_second_opinion_and_pitch_check: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

### A. Screens and navigation

| Screen | Purpose | Entry points | Exit points |
|---|---|---|---|
| S1 Check (pitch tab) | Paste or photograph a pitch and run the check | Bottom tab "Check"; Home chips | Result below; links to Find, Owners |
| S2 Result (inline on S1 and Home) | Shows second opinion and claim rows | After "Check it" | Compare drawer; Owners; Find |
| S3 Which-one chooser | Choose model or version | When the router finds several | Returns to S2 |
| S4 Compare drawer | Compare 2 to 4 laptops | "Add to compare" on a card | Closes to S2 |
| S5 Rules-only form | Fallback | Model failure | Returns to S2 |
| A1 Claim ledger | Create, edit, approve, retire verdicts | Admin menu | Admin |
| A2 Import | CSV import and verification | Admin menu | Admin |
| A3 Unhandled, A4 Gate log, A5 Settings | Operations | Admin menu | Admin |

### B and C. Components and interactions (S1 and S2)

| Component | Purpose | User action | Data required | API dependency | UI states |
|---|---|---|---|---|---|
| Mode tabs ("Seller pitch", "Used listing") | Choose the check | Tap | None | None | Initial: Seller pitch selected |
| Pitch textarea | Input | Type or paste | Text up to 4,000 | None | Initial: placeholder and example; Disabled while running; Error: over limit |
| Photo button and preview | Attach a photo | Choose, remove | Image resized to 1280 px | None | Initial; Loaded; Error "I could not open that photo" |
| "Use an example" | Fills a sample | Tap | None | None | Always enabled |
| "Check it" button | Run | Tap | Text or photo | `POST /query` | Disabled when empty or running |
| Loading note | Progress | None | None | — | Loading: "Working on it" |
| Sample-data banner | Honesty | None | Config | `GET /config` | Always shown |
| Choice buttons | Ask one question | Tap | Choices | `POST /query` (continues) | Loaded; tap disables the others |
| Laptop card | Shows specs, price, reasons, rating | Expand Musts and Specs; add to compare | Card JSON | — | Loaded; Partial (rating "not enough evidence") |
| Must list | Ticks and crosses with text | Expand | Musts | — | ✓ Met, ✗ Not met, ? Unknown |
| Owner evidence list | Topics with n and sources | Expand | Evidence | — | Enough; Not enough evidence; Empty |
| Alternatives list | Up to two cards | Add to compare | Cards | — | Loaded; none ("No other laptop meets every Must at the same or a lower price") |
| Claim row | One claim with a badge | None | Claim row | — | Matches the catalog; Does not match the specs; Not in catalog; Checked by a person; Not checked yet; Can't be checked |
| Follow-up button | Offer the second flow | Tap | Offer | `POST /query` with force flow | Loaded |
| Compare bar and drawer | Compare | Select 2 to 4; open; clear | Cards | — | Hidden; Needs more picks; Ready |
| Offline notice | Network failure | Retry | None | — | Offline |
| Permission-denied | Not applicable to anonymous screens | — | — | — | — |

**Sorting and filtering:** none on S2 (order is set by code). **Pagination:** none; a result holds at most one card, two alternatives and the claim list. **Real-time updates:** none.

### D. UI states

| State | Behaviour |
|---|---|
| Initial | Empty textarea, example button, tabs |
| Loading | Button disabled, "Working on it" |
| Success | Blocks shown; footer "Links may earn LapFit a commission; it never changes the order." |
| Empty | "No owner reports are on file for this laptop yet." |
| Error | Plain message naming what failed and what to do next |
| Disabled | "Check it" when no text and no photo |
| Partial data | A claim says "Not in catalog" or "Not checked yet" while others show |
| Offline | Notice; text preserved |
| Permission denied | Admin screens: sign-in or "not allowed" |

### E. Validation

| Field | Rule | Message |
|---|---|---|
| Pitch text | 1 to 4,000 characters | "Please paste what the seller said (up to 4,000 characters)." |
| Photo | JPEG, PNG or WebP; resized to 1280 px | "I could not open that photo." |
| Laptop choice | Must pick one of the offered | — |
| Admin: ledger claim text | Required, up to 300 characters | — |
| Admin: approve | Reviewer name required; verdict text required | "A named reviewer must approve." |

