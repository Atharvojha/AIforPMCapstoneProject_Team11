# F01_shortlist: draft UI notes (NOT a specification)

These notes were taken out of the functional spec. Screen specifications are written only after the frontend is built (see `../03_FRONTEND_JOBS_AND_TRIGGERS.md`). Keep them as input, not as requirements.

## Phase 4. Frontend specification

### A. Screens and navigation

| Screen | Purpose | Entry points | Exit points |
|---|---|---|---|
| S1 Find | Structured filters with live results | Bottom tab "Find"; Home "Choose" tile | Compare; Owners; Check |
| S2 Home ask box and answer panel | Free-text start | Home | Find; chips; compare |
| S3 "What I understood" chips panel | Edit the reading | Above any result from text | Re-runs results |
| S4 No-match panel | Recovery | When no match | Relax buttons; chips |
| S5 Compare drawer | Final comparison | Bottom bar | Closes to results |
| S6 Rules-only form | Fallback | Model failure | Results |
| S7 Clarify chooser | One question | Low confidence, no budget | Results |

### B and C. Components and interactions (Find, results, chips)

| Component | Purpose | User action | Data required | API dependency | UI states |
|---|---|---|---|---|---|
| Sample-data banner | Honesty | None | Config | `GET /config` | Always shown |
| Budget slider and output | Set the maximum | Drag; arrows (keyboard) | ₹20,000 to ₹1,50,000, step ₹5,000 (settings) | `POST /query` (needs) | Initial ₹60,000; Disabled while loading |
| Use pills (multi-select) | Choose uses | Tap to toggle | Use list | same | Pressed or not |
| RAM, storage, weight, type selects | Musts | Choose | Option lists | same | Initial "Any" |
| Colour select | Nice | Choose | Colour list | same | Initial "Any" |
| "Only in stock" toggle | Availability | Toggle | — | same | Off by default (New) |
| Helper text | States what is a Must | None | — | — | Always |
| Loading note | Progress | None | — | — | "Working on it" |
| Understood chips | Edit the reading | Tap to cycle Must, Should, Nice; × to remove; edit budget; Update | Needs | `POST /query` | Normal; "cannot check yet" (dashed); Empty group "None" |
| Colour note | Colour fallback | None | Note | — | Hidden unless needed |
| Result cards (3, then "Show two more") | The shortlist | Expand Musts and Specs; add to compare | Card JSON | — | Loaded; Partial (rating "not enough evidence") |
| Relax buttons | One-tap recovery | Tap | Needs payload | `POST /query` | Shown only when no match |
| Compare bar and drawer | Compare 2 to 4 | Tick; open; clear | Cards | — | Hidden; "Pick 1 more"; Ready |
| Clarify buttons | One question | Tap | Choices | `POST /query` | Loaded |
| Rules-only form | Fallback | Fill; submit | — | `POST /query` (form) | Initial; Submitting |
| Offline notice | Network lost | Retry | — | — | Offline |

**Sorting and filtering:** order is set by code (the user cannot re-sort in the first version). **Pagination:** "Show two more" up to five. **Real-time:** results update as controls change (debounced). **Selection:** compare up to four. **Editing and deletion:** chips are edited or removed; nothing is saved.

### D. UI states

| State | Behaviour |
|---|---|
| Initial | Controls at defaults; first results load on open |
| Loading | Previous results dimmed, "Working on it" |
| Success | Banner, chips (text path), colour note if any, three cards, footer line about commission |
| Empty | No-match message with relax buttons |
| Error | Plain message and the rules-only form |
| Disabled | Controls disabled while a request is running (not the slider drag) |
| Partial data | A card with "not enough evidence" for rating; "cannot check yet" chips |
| Offline | "You seem to be offline. Your choices are kept." |
| Permission denied | Not applicable (anonymous screens) |

### E. Validation

| Field | Rule | Message |
|---|---|---|
| Ask text | 1 to 4,000 characters | "Please tell me a little about what you need (up to 4,000 characters)." |
| Typed budget (chip) | ₹5,000 to ₹10,00,000; accepts "60k", "1 lakh" | "I could not read that budget. Try 60k or 60000." |
| Slider | ₹20,000 to ₹1,50,000 | — |
| Chip move or remove | None | — |
| Compare | Maximum four | "You can compare up to 4 laptops." |

