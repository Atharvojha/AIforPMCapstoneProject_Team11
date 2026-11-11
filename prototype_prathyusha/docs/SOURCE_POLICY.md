# SOURCE_POLICY — live-research allowlist and fetch rules (Stage 3 proposal; D-pending-04)

Checked 2026-11-10 with `curl` using a self-identifying user agent. **robots.txt permission is necessary, not sufficient**: terms of use and copyright still apply. Where terms are unverified, the default is **link-only**.

## Observed robots.txt / access behaviour
| Domain | robots.txt | Relevant rules (summary) | Terms verified? | Tier |
|---|---|---|---|---|
| apple.com | HTTP 200 | `*` blocks only shop overlays/cn paths; support pages fine | No | **A** (fetch + extract facts) |
| asus.com | HTTP 200 | `*` blocks search/filter URLs (`*SearchKey`, `*Spec=`, `*Series=`…); product/techspec pages not blocked | No | **A**, product/techspec URLs only; never filter/search URLs |
| hp.com | HTTP 200 (750 lines) | explicit `Allow: /` for GPTBot, ClaudeBot, Google-Extended, PerplexityBot; large `*` block list to honour | No | **A**, honour every Disallow |
| dell.com | HTTP 200 (1,253 lines) | many Disallow incl. `/en-in/shop/pdr/`, `*/api/`, some support paths | No | **A**, with full robots parser; skip disallowed paths |
| notebookcheck.net | HTTP 200 | only `/nbcbattery/` and `/cdn-cgi/` disallowed | **No** (terms page not located) | **B: link-only** until terms verified |
| rtings.com | HTTP 200 | `/user_reviews/`, `/admin/` disallowed | **No** (terms page not located) | **B: link-only** |
| laptopmedia.com | HTTP 200 | `/wp-admin/` disallowed | Partially: earlier plan notes terms say content/results are copyrighted, short quotes with a link allowed, contact for more | **B: link-only** (manual curated facts only) |
| lenovo.com | **HTTP 403 "Access Denied"** to automated client | technical block | — | **C: link-only** — do not circumvent |
| msi.com | **HTTP 403 "Access Denied"** | technical block | — | **C: link-only** |
| acer.com | no response (timeout) | unknown | — | **C: link-only** until reachable |
| reddit.com, youtube.com | not touched | platform API terms | No | **C: never fetched** |
| everything else (retailers, blogs, aggregators) | — | — | — | **C: link-only**, never used as evidence for specs/benchmarks |

## Terms of use — researched 2026-11-11 (by Claude; no teammate needed)
| Site | What I could verify | Decision |
|---|---|---|
| **Notebookcheck** (enabled for spec pages 2026-11-11, D-033) | Legal notice (Contact page), quoted: "It is not allowed to copy any content (e.g. text and photos) … without explicit permission." Exception: "short quotations (up to a maximum of 100 words) accompanied with a well visible link" and "The name Notebookcheck must be mentioned." **Automated access, scraping and AI use: not stated.** robots.txt allows (only `/nbcbattery/`, `/cdn-cgi/` disallowed) | Stays **link-only** for automatic reading (policy requires "clearly permitted"; automated access is silent). Manual curation of short facts + link + name stays allowed (≤25-word quotes, well inside the 100-word limit). **Decision needed from user:** promote to fetch-for-short-facts? (Q-026) |
| **RTINGS** | Terms of Use page exists (`/company/terms-of-use`) but its text is not in the HTML (JavaScript app), so it cannot be read without a browser. RTINGS has publicly stated concern about AI scraping of its test results (membership-programme post) | **Link-only.** Do not automate. |
| **LaptopMedia** | Terms of Use live inside `/in/privacy-policy/#terms-of-use`; that page returns **HTTP 403** to automated requests (home page 200). Earlier plan note (unverified by me now): copyright-protected, short extracts with a link allowed, contact for more | **Link-only.** Do not circumvent. |

## Findings from implementation (2026-11-11)
- Apple's support page returned **HTTP 429** to our bot (honest user agent, polite rate). We do not disguise the client. For 429/5xx/timeouts on allowlisted pages the pipeline may use the search provider's own copy of the page text (Tavily `raw_content`), validated identically and disclosed in the source note. It is **not** used after 403, robots disallow, policy blocks or off-allowlist redirects.
- ASUS regional spec pages fetch fine; they are region/configuration specific, so multi-value facts are stored as `*_options`.

## Tier definitions
- **A — fetch + extract:** HTTPS only; robots-parsed per path; fetch ≤2 MB, 15 s timeout; extract short facts with verbatim quote (≤25 words) + units + conditions; store facts and hash, not full article; attribution + link kept.
- **B — link-only:** show title, URL, snippet returned by the search API (as given), no storage of page text. Manually curated facts (short, attributed, with conditions) may exist for specific pages (as in `datasets/curated/`), recorded as human/assisted curation.
- **C — link-only or never:** blocked/unknown/platform-restricted.

## Fetch guard (all tiers)
1. `https` scheme only; no credentials in URL; no ports other than 443.
2. Resolve DNS before connecting; reject loopback, private (10/8, 172.16/12, 192.168/16), link-local (169.254/16), multicast, and IPv6 equivalents; re-resolve on every redirect hop; max 3 redirects; final host must remain on the allowlist.
3. Content-Type must be `text/html`/`text/plain`/`application/pdf` (PDF only on tier A); size/time limits enforced while streaming.
4. `User-Agent: LapFitResearchBot/0.1 (student project; contact in README)`; per-domain rate limit 1 request/2 s; global concurrency 3.
5. Cache by (URL, content hash); do not refetch within 7 days unless user forces and budget allows.
6. Fetched text is **untrusted data**: delimited in prompts; instruction-like content flagged; model output validated before storage.
7. Tavily budget: hard stop at 800 of 1,000 monthly credits; `include_domains` limited to the allowlist for fact-finding queries; broader queries (for link discovery only) allowed on `basic` depth.

## Open items
- Locate and read the actual Terms of Use for notebookcheck.net, rtings.com and laptopmedia.com (the URLs I guessed returned 404 / not-the-terms-page); move to tier A only if automated fact extraction with short quotes is clearly permitted.
- Ask LaptopMedia/Notebookcheck for permission if systematic extraction is desired.
- Re-run the robots check at implementation time (rules change); implement `urllib.robotparser`-based gate with a daily cache.
- Add more manufacturers (Acer, Samsung, Microsoft, Framework, Razer, Gigabyte) after checking their robots/access.
