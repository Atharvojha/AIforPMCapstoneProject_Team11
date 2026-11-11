# CHALLENGES — risk / blocker register

Updated whenever a meaningful challenge appears. Never delete resolved items; keep history.
Last updated: 2026-11-10 (Stage 0).

| ID | Date | Area | Severity | Status | Owner |
|---|---|---|---|---|---|
| CH-001 | 2026-11-10 | Product/Legal | High | Resolved (D-009) | Team |
| CH-002 | 2026-11-10 | Data | High | Open | Team / external |
| CH-003 | 2026-11-10 | Data | High | Open | Claude |
| CH-004 | 2026-11-10 | Data | High | Open | Team |
| CH-005 | 2026-11-10 | Data | Medium | Open | Claude |
| CH-006 | 2026-11-10 | Data | Medium | Mitigated | Claude |
| CH-007 | 2026-11-10 | AI/Hardware | Medium | Open | Claude |
| CH-008 | 2026-11-10 | Backend | Medium | Open | Claude |
| CH-009 | 2026-11-10 | Data/Legal | High | Open | Team |
| CH-010 | 2026-11-10 | Product/Data | High | Open | Claude + Team |
| CH-011 | 2026-11-10 | Process | Low | Resolved | Claude |
| CH-012 | 2026-11-10 | Data | Medium | Open | Claude |
| CH-013 | 2026-11-10 | Eval | High | Open | Claude + Team |
| CH-014 | 2026-11-10 | Eval/Data | High | Open | Team |
| CH-015 | 2026-11-10 | Data | High | Mitigated (partial) | Claude + Team |
| CH-016 | 2026-11-10 | Data/Process | Medium | Open | Team |
| CH-017 | 2026-11-10 | Product/Legal/AI | Critical | Mitigated (D-019 pending) | Claude + User |
| CH-018 | 2026-11-10 | Infra | High | Open | Claude |
| CH-019 | 2026-11-10 | Legal/Backend | High | Open | Claude + Team |
| CH-020 | 2026-11-10 | AI/Safety | High | Open | Claude |
| CH-021 | 2026-11-10 | AI/Quality | High | Open | Claude |
| CH-022 | 2026-11-10 | Engineering | Medium | Resolved | Claude |
| CH-023 | 2026-11-10 | Eval | High | Open | Team |
| CH-024 | 2026-11-11 | Data/Legal | Medium | Mitigated (untested vs real Tavily) | Claude |
| CH-025 | 2026-11-11 | AI/Data | High | Open | Claude + Team |

---

### CH-001 — PRD forbids score/ranking; new vision wants category ratings
- **Area:** Product / Legal-policy. **Severity:** High. **Status:** Open (decision needed at Gate 1).
- **Description:** Team 11 PRD FR8 = "no score, no rank, no verdict". Master prompt wants transparent category ratings / fit labels.
- **Evidence:** `team11_activity_extracted.txt` ("No ranking, no score, no verdict"); Master Prompt Part 2.
- **Options:** (a) qualitative labels only; (b) per-category transparent scores + coverage, no overall rank; (c) formally revise PRD to allow fit score.
- **Recommendation:** (b) with qualitative label as primary and numbers behind a "how this is computed" drawer; never an overall rank. Rationale: grader-visible depth without violating the "student decides" principle.
- **Status update:** Resolved by D-009 (option B). **Decision link:** D-009.

### CH-002 — Raw 97-review team set and original 3,300 extract not in pack
- **Area:** Data. **Severity:** High. **Status:** Open.
- **Evidence:** `CONTENTS_AND_LIMITATIONS.txt`. Only 6 `team_review_set` IDs + 3 `constructed_test` IDs appear in `review_id_index.csv`.
- **Impact:** Cannot reproduce the 40-case eval from the team's own reviews (R-IDs, FK-ADV-01).
- **Mitigation found:** The 3,300 Flipkart laptop subset was **regenerated** from Zenodo (see CH-006). The 90 collected + 7 constructed reviews still need to come from teammates (the parent folder `AIforPMCapstoneProject_Team11/data/` may already contain them — to be inspected after approval).
- **Update 2026-11-10:** the 97 reviews were found in `../02_golden_dataset_v1.xlsx` / `../data/golden_draft.jsonl` (90 team-pasted, provenance pending + 7 synthetic) — see CH-014.

### CH-003 — Flipkart data has no dates, no variant field, no verified flag
- **Area:** Data. **Severity:** High. **Status:** Open.
- **Impact:** Recency, "verified purchase" and per-variant filtering are impossible from Flipkart alone. Variant is only known at the **listing** level (14 listings), and sibling listings (e.g., RTX 3050 vs GTX 1650 HP Pavilion) must not be pooled.
- **Recommendation:** treat listing = variant; show "variant confidence: listing-level" honestly; Amazon'23 has timestamps/verified flags and can supply recency.

### CH-004 — Evidence classes beyond owner reviews are nearly empty
- **Area:** Data. **Severity:** High. **Status:** Open.
- **Description:** No independent-lab (RTINGS / Notebookcheck / LaptopMedia) data, no manufacturer spec records beyond what's parseable from Flipkart titles. Claim Checker for battery/thermals needs these.
- **Constraint:** LaptopMedia terms forbid bulk copying (short quotes + link only). RTINGS/Notebookcheck terms unchecked.
- **Options:** (a) hand-curate 10–20 laptops' measurements with links (small, factual, attributed); (b) manufacturer spec PDFs; (c) ask LaptopMedia for permission.
- **Recommendation:** (a)+(b), starting with the laptops that exist in our review corpus so evidence classes overlap.

### CH-005 — Flipkart skew and shortness
- **Evidence (verified 2026-11-10):** 3,300 reviews, median 9 words, 24.9% ≤3 words, 69.6% 5★ (PDF said ~65% on its snapshot), 1★ 5.0%, 2★ 1.6%.
- **Impact:** Few reviews contain conditions (workload, hours, config). Many cannot be classified as applicable → `unknown`. Extraction accuracy on 2-word reviews is inherently limited.
- **Mitigation:** treat "unknown" as first-class; use Amazon'23 (median 31 words) for richer evidence; show per-source metrics.

### CH-006 — Flipkart 3,300 subset reproduced (was blocker)
- **Status:** Mitigated. **Evidence:** `datasets/processed/flipkart_laptop_reviews.csv` — 3,300 rows / 14 listings; all 39 PDF-cited `FK-#####` ratings match exactly (script `lapfit_data_pack/build_laptop_extract.py`).
- **Residual:** current Zenodo file is the 189,874-row `flipkart_product.csv` snapshot (not the 194,276 in catalog text) — catalog count discrepancy to document. Licence field on record still unverified (see CH-009).

### CH-007 — Hardware: 16 GB unified memory, Apple M5
- **Evidence:** `sysctl`: Apple M5, 10 cores, 16 GB; Ollama 0.34 present with `llama3.1:latest` (8B, 4.9 GB) only.
- **Impact:** 7–9B Q4 models fit but leave ~8 GB for embeddings + DB + browser; no 14B+ models. Throughput ~tens of tok/s — extraction of 3,300+ reviews is a batch job (hours), not online.
- **Recommendation:** benchmark Qwen3-8B/Qwen2.5-7B, Gemma, Llama3.1-8B on a 40-review set; run extraction offline in batches with caching; consider small model (3–4B) for easy topic tagging, 8B only for hard cases.

### CH-008 — No Postgres/Docker on the machine; Python 3.9 default
- **Evidence:** `psql`, `docker` not found; `python3` = 3.9.6 (Homebrew has 3.14). pandas/requests installed; no sentence-transformers/torch/fastapi.
- **Options:** (a) `brew install postgresql@17 pgvector` local; (b) Supabase free; (c) SQLite + sqlite-vec + FTS5 for zero-ops demo, with Postgres schema kept portable.
- **Recommendation:** decide at Gate 3. Need a venv with Python ≥3.11.

### CH-009 — Licences unverified for Flipkart, PCBox; Amazon'23 has none stated
- **Severity:** High for anything beyond course use. **Status:** Open.
- **Evidence:** `LICENSE_AND_USAGE_NOTES.md`; McAuley/HF page states no licence.
- **Recommendation:** label prototype "course/research use only"; store `licence_status` per source; do not redistribute raw data; keep raw files out of any public repo.

### CH-010 — Amazon'23 laptop review sample is small and skewed to a few laptops
- **Evidence:** `amazon_laptop_reviews.csv`: 2,132 reviews / 44 laptops (28% of file scanned); median 15 reviews per laptop, max 1,257; 10/44 listings are Renewed/Refurbished; dates 2015–2023 (old hardware).
- **Impact:** Most laptops have too few reviews for per-attribute evidence; hardware is largely obsolete for a 2026 buyer.
- **Options:** finish scan (~22.6 GB, hours at ~1 MB/s); restrict to laptops with ≥N reviews; use as method demonstration + eval corpus rather than the buyer-facing catalogue.

### CH-011 — Master-prompt filename mismatch
- Prompt references `LapFit_Claude_Master_Prompt.md`; both `LapFit-Claude-Master-Prompt.md` and bundle copy exist and are byte-identical (82,608 bytes). **Resolved.**

### CH-012 — 21.5% duplicate review text in Flipkart subset
- **Evidence:** 710 of 3,300 texts are exact duplicates (2,590 unique) — mostly generic one-liners ("Good", "Nice product") but also potentially copied text.
- **Impact:** naive counts inflate evidence; the PRD says copied reviews count once.
- **Next action:** build dedup in ingestion (exact + normalized); report "N reviews, M distinct". Do not delete — cluster.

### CH-013 — Earlier golden set covers only Scenario A; none for Claim Checker, retrieval, variant resolution
- **Evidence:** `EARLIER_WORK_AUDIT.md` matrix; 40/40 items are fit/dealbreaker; no `claim` items.
- **Impact:** cannot evaluate half the product; master prompt Part 11 requires all.
- **Recommendation:** build claim (~30–40), retrieval, variant and extraction gold sets at Stage 3; port existing metrics. Human-adjudicate; freeze before scoring.

### CH-014 — Earlier golden labels AI-drafted; 90 reviews have unverified provenance; ship gate never passed
- **Evidence:** `04_iteration_log.csv` (best recall 56%, false-DB 25% at v0; v1 recall 19–31%); Review_Bank `provenance_note`; 0/97 texts in Flipkart.
- **Impact:** results from it must be labelled provisional; can't be the only validity evidence. CH-002 (missing raw set) is **resolved in part**: the 97 reviews exist in the xlsx/jsonl (CH-002 updated: raw 97 found in `../02_golden_dataset_v1.xlsx`).
- **Recommendation:** use as a stress fixture; get 2 teammates to human-verify ≥10 items + label a fresh Flipkart-native golden set.

### CH-015 — Independent lab evidence for the 14 budget Indian-market SKUs is sparse and mostly sibling-level
- **Evidence (curation run 2026-11-10, ~16 searches/fetches):** Exact-variant lab data found for **1 of 14** laptops (MacBook Air M1: Apple claim + Notebookcheck runtimes). Sibling-level lab data for IdeaPad 3 15ALC6 (Ryzen 3 5300U) and HP Pavilion Gaming 15 family (ec1177ng). Spec-only pages for TUF F15 and VivoBook 15. HP Pavilion 15-EC2145AX/EC2004AX, HP 14s: nothing primary. Notebookcheck "spec pages" contain no measurements; LaptopMedia returned 403 and tested a different GPU.
- **Impact:** Measured-claim and thermal verdicts for most listings will be "Insufficient / sibling-only" — the product must make that useful (D-012 strategy) and demos must pick claims accordingly (battery claim → MacBook Air M1; RAM-upgradeable → IdeaPad (partial) and VivoBook (unknown)).
- **Options:** (a) accept and showcase honest gaps; (b) team manually adds more sources (RTINGS, Notebookcheck full reviews found by hand); (c) request LaptopMedia permission; (d) add 2–3 *newer* laptops with rich lab coverage to the demo catalogue as a clearly labelled "well-evidenced example" set.
- **Recommendation:** (a)+(d) — decide at Gate 3. **Status:** Mitigated (partial): curated what exists, gap register in `datasets/curated/evidence_gaps.csv`.

### CH-016 — Curated values extracted by an automated page reader need human verification
- **Evidence:** WebFetch returns model-summarised answers, not raw HTML; one earlier extract also returned truncated pages (262k-char Notebookcheck page read in 100k chunks).
- **Impact:** 9 benchmark rows are flagged `needs_human_spot_check`; Apple page and MacBook battery rows were verified against the page text returned.
- **Next action:** two teammates open the cited URLs and mark `validation_status=verified_by_human` (or correct). Until then UI labels them "unconfirmed".

### CH-017 — "Anything I type works" (D-015) is an open-world requirement with hard limits
- **Area:** Product / Legal / AI / Backend. **Severity:** Critical. **Status:** Open.
- **Description:** Arbitrary laptops and claims need live discovery, permission-gated fetching, and extraction from unseen pages, on a 16 GB laptop with an 8B local model, without bulk scraping.
- **Risks:** (1) Source terms: many review sites forbid automated reuse; Reddit/YouTube restricted; so live reports will mostly be specs + a few lab facts + links, rarely owner reviews. (2) Search needs a provider (Tavily free tier: 1,000 credits/month per the plan, to be re-verified) or a keyless fallback; **requires user approval of provider/account**. (3) Latency: fetch + 8B extraction may take minutes per laptop; needs progress UI and caching. (4) Quality: unseen page formats cause extraction errors → mandatory deterministic validation, `needs_review` states. (5) Hallucination: for unknown laptops, never fill specs from model memory — only from fetched pages. (6) SSRF/prompt-injection from fetched pages (Part 10).
- **Options:** (a) catalogue + live research with allowlist of domains (recommended); (b) open-ended crawl (reject: legal and safety); (c) catalogue only (conflicts with D-015).
- **Recommendation:** (a): official-manufacturer domains + a small allowlist of independent-lab domains whose terms we verify; everything else is link-only. Cache results with content hash and retrieval date. Decide search provider and domain allowlist at Gate 3.
- **Next action:** ask user to approve a search provider (e.g., Tavily free tier or a keyless option) and the domain-allowlist approach.

### CH-018 — Network throughput (~0.2–1 MB/s, frequent TLS timeouts) blocks large downloads
- **Evidence:** `ollama pull qwen3:8b` reached 98 MB/5.2 GB at 227 KB/s (ETA 6 h) then failed with "TLS handshake timeout"; pip retried on read timeouts; earlier Amazon'23 parallel download measured ~1 MB/s total.
- **Impact:** Model candidates beyond the installed `llama3.1:8b` cannot be benchmarked quickly; sentence-transformers/torch/model-weight downloads (hundreds of MB) are slow; live research latency partly network-bound.
- **Options:** (a) benchmark installed model first, queue other pulls in a resumable background loop (Ollama resumes); (b) use a better connection (user) for one-time model pulls; (c) pick smaller models (llama3.2:3b ≈2 GB).
- **Recommendation:** (a)+(b): ask user to run pulls on a faster network if available; design provider abstraction so the model choice is a config change.

### CH-019 — Live research can only auto-extract from a few manufacturer domains today
- **Evidence (robots/access check 2026-11-10, `docs/SOURCE_POLICY.md`):** Lenovo and MSI return HTTP 403 "Access Denied" to an automated client; Acer did not respond; lab sites (Notebookcheck, RTINGS, LaptopMedia) permit robots access but their Terms of Use were **not located/verified** (guessed URLs returned 404).
- **Impact:** For many laptops the live report will be: specs from Apple/ASUS/HP/Dell pages, lab evidence as link-only, and nothing automatic for Lenovo/MSI/Acer. Coverage will often be low and the UI must say so.
- **Options:** (a) accept (honest, safe); (b) team reads lab-site terms and, if permitted, promotes them to tier A; (c) request permission by email; (d) use Tavily's returned snippets as link-only context (not stored as facts).
- **Recommendation:** (a) now + (b)/(c) in parallel. Do not circumvent 403 blocks.
- **Next action:** teammate finds and reads the terms pages (30 min), reports allow/deny per site.

### CH-020 — Local 8B model obeyed an injected instruction (1 of 4 synthetic tests) and misquoted 3 of 106 quotes
- **Evidence:** `eval/results/llm_smoke_llama3.1_latest.json` (ADV-2 obeyed; quotes non-verbatim in FK-00393/00734/01809). JSON validity and schema compliance were 100%.
- **Impact:** A prompt alone cannot be trusted as the injection defence; quote fabrication occurs at ~3% of quotes on long reviews. Speed (p50 9.9 s, p95 31.9 s per review) makes bulk extraction an offline batch job.
- **Mitigations (design, to verify at Gate 4):** (1) rule-based instruction-pattern pre-filter flags/sets aside suspicious reviews before the LLM sees them; (2) deterministic quote validator rejects any claim whose quote is not an exact substring (already designed); (3) output sanity checks (no review-wide uniform polarity, no marker strings, claim must be entailed by quote via lexical overlap); (4) treat flagged reviews as `instruction_injection` exclusions; (5) bulk-extract only distinct non-trivial texts, in batches, resumable; (6) re-benchmark Qwen3/Qwen2.5 when downloads are possible.
- **Status:** Open; needs G-SAFE set and re-test with larger injection corpus (4 items is a smoke test, not a rate).

### CH-019 update (2026-11-11)
Terms researched myself (see SOURCE_POLICY): Notebookcheck verified (short quotes ≤100 words with link + name; copying needs permission; automated access not mentioned); RTINGS unreadable (SPA) and publicly anti-AI-scraping; LaptopMedia terms page returns 403. All three stay link-only pending user decision on Notebookcheck (Q-026). **Status: Mitigated.**

### CH-021 — 8B model labels (category, strength) are unreliable on multi-topic reviews
- **Evidence (pilot, `evidence_claims` after `reguard_stored`):** 25 of 110 category labels reassigned by keyword guard (23%); 'average'/'medium' remarks labelled clear; 7.6% of proposed quotes non-verbatim (rejected). Example: FK-02550 'speakers are good and high enough' labelled Display.
- **Impact:** Owner-based findings (dealbreakers/watch-outs/ratings) can be wrong even though every quote is real. This is the false-dealbreaker risk the PRD warns about.
- **Mitigations in place:** exact-quote validator; category + lukewarm-strength guards; partial analysis labelled provisional; numeric score withheld unless analysis complete (D-024); every finding opens its source review.
- **Still needed:** G-EXT gold set + measured precision/recall of model labels and of the guards; try Qwen3 8B / Qwen2.5 7B when downloadable (CH-018); consider splitting reviews into sentences before extraction; human spot-check of all displayed watch-outs for demo laptops.

### CH-022 — Rebuilding the database destroyed in-progress extraction results (my error, twice)
- **Evidence:** `lapfit.ingest` recreated `lapfit.db` while `lapfit.extraction` was writing to it; the running job kept writing to the deleted file. About 90 reviews (~35 min of GPU time) lost the first time; a smaller loss the second.
- **Resolution (D-028):** ingest now snapshots and restores `extraction_runs`/`evidence_claims`/`exclusion_log` by review id + content hash (test `test_rebuild_preserves_extraction_results`) and raises if extraction is running. **Status:** Resolved. Lesson: derived data that is expensive to compute must not live in a file that a cheap rebuild deletes.

### CH-023 — Claim-checker agreement (14/14) is against labels I drafted from the same evidence
- **Evidence:** `eval/results/claim_eval_latest.json`; gold `g_claim_v0_draft.jsonl` status `draft_ai_unverified`. After the first run showed 13/14, the disagreement (GC03) traced to my own curated wording ("no (not stated…)"), which I corrected in the DATA, not the gold labels.
- **Impact:** 14/14 shows the engine behaves as designed; it is NOT independent validation and says nothing about unseen claims or laptops.
- **Needed:** 2 human adjudicators; a held-out claim set written before looking at the engine; claims on laptops with live-researched evidence.

### CH-024 — A tier-A manufacturer (Apple) refuses our bot: HTTP 429 even with an honest user agent
- **Evidence (2026-11-11):** `support.apple.com/en-in/111883` returned 429 to `LapFitResearchBot/0.1` via httpx and curl, on repeated polite requests; the same page was readable earlier through a different fetch service. ASUS's regional spec page fetched fine (real run: 1 page, 7.6 s).
- **Decision:** we do **not** spoof a browser. Fallback (D-029): for transient refusals (429/5xx/timeouts) on allowlisted pages, use the search provider's licensed copy of the page text (Tavily `raw_content`), with the same quote validation and a visible disclosure. Never for 403, robots disallow or policy blocks. **Untested against real Tavily** (no key yet).

### CH-025 — Rule-based spec extraction is accurate but narrow, and manufacturer pages are regional/multi-configuration
- **Evidence:** first real run produced a wrong fact (screen size 12.3 in = laptop *width*), a one-sided weight, a mislabelled peak-HDR brightness and no RAM/battery/storage. After tuning on that page: weight 1.28 kg, battery 75 Wh, RAM options 16/32 GB, storage options 512/1024 GB, peak brightness labelled, no false screen size. Tuned on **one** page; other brands will differ.
- **Impact:** live reports will often be thin, and some facts will be missing (shown as "can't tell yet"). Multi-version pages yield "comes in several versions", never a guess.
- **Needed:** G-LIVE set (15 held-out laptops, facts verified by humans against pages) to measure precision/recall; per-brand pattern tuning; possibly LLM-assisted extraction behind the same quote validator.

### CH-021 update — self-audit of the IdeaPad's displayed owner findings (2026-11-11, by Claude; NOT independent)
Read the source review behind each of 10 displayed findings (2 serious: battery ×2, memory ×2; 6 worth-checking: build, touchpad, LAN port, buzzing noise, fan noise …): **0 fabricated quotes; 8 clearly valid; 2 borderline** — FK-02640 "Better backup is too bed" (ambiguous typo counted as the second battery owner) and FK-02614/FK-02684 (memory: owners say usable RAM is 4–6 GB of 8, but both gave 5★; a real limitation, not a clear complaint). So "Serious problem: memory" on the IdeaPad rests on two borderline items. A human adjudicator is still needed.

### CH-026 — First real Tavily runs: pipeline works; accuracy needed three rounds of fixes; credit accounting is local only
- **Evidence:** 6 real research runs (ASUS Zenbook 14 OLED UX3405, Apple MacBook Air M2) with the real key; Apple support pages returned 429 and the disclosed fallback to Tavily's page text worked. Fixes made from real output: stricter page identity (model codes must be in title/URL), only real spec pages can be exact, noise filters (external display, power frequency, device dimensions, test footnotes), complete option lists, merge of conflicting facts into "comes in several versions". Final gate-usable facts: ASUS weight 1.28 kg, battery 75 Wh, RAM 16 GB, storage 1024 GB, 14 in, 120 Hz (exact pages are regional; other regions list 32 GB); Apple weight 1.24 kg, RAM options 8/16/24, storage options partial.
- **Credits:** Tavily's `/usage` endpoint showed 0 after ~15 credits of my own searches (lagging or not updated), and the search response carries no usage field. The local guard (persisted when run via the API) is the only enforced cap. By my count about 15 credits were used.
- **Remaining:** tuned on 2 brands; no held-out accuracy measure (G-LIVE).

### CH-027 — Regex prompt-injection detection does not generalise (held-out 1/20; false alarms 3/20)
- **Evidence:** `docs/RAG_EVALUATION.md` rows 2026-11-11; end-to-end: 3/20 unseen attacks produced a fake positive owner claim.
- **Impact:** We cannot claim "injection detected". We can claim bounded impact (≤1 report per review; ≥2 owners for a Serious Problem; no model writes the report; exact quotes only).
- **Options:** (a) accept the bounded risk and say so; (b) LLM classifier on suspicious/untrusted text (slow: ~10 s/review on this laptop; fine for live pages and claims, too slow for bulk reviews); (c) outlier/duplicate screens. **Recommendation:** (a)+(b) for live-researched pages and user claims; keep the regex as a cheap known-string screen. **Status:** Open (accepted residual risk, D-034).

### CH-028 — Embedding model config pointed at a model that was never downloaded
- **Evidence:** `.env` (copied from `.env.example`) named `intfloat/multilingual-e5-base` (216 KB of 1.1 GB cached) while stored vectors are MiniLM; hybrid search would have silently degraded to keyword-only.
- **Fix:** `.env` and `.env.example` now name the MiniLM model; e5-base download restarted in the background for a proper A/B later. **Status:** Mitigated. Lesson: a startup check that stored-vector model == configured model should fail loudly (to do).

### CH-029 — Real-network bugs only visible with real DNS/sites (fixed)
- NAT64 addresses (`64:ff9b::/96`) were rejected as non-public, blocking Dell and HP; blocked attempts consumed the reading budget; Notebookcheck articles share the URL shape of spec pages; Apple rate-limits bots. All fixed or mitigated with tests. **Status:** Resolved.

### CH-030 — Every fresh test set exposed new gaps; AI-drafted gold remains unverified
- **Evidence:** claim verdict first-run held-out 26/35 then 19/41; extraction F1 0.675 held-out vs 0.75 tuned; injection 1/20 held-out. Frozen gold file `g_claim_v2_heldout.jsonl` has a label error (K39 `injection: true`). Owner-opinion truths in v2 come from the pipeline's own stored extraction counts (partly circular).
- **Impact:** current "100% on dev sets" must not be quoted as accuracy. 
- **Next action:** a third fresh held-out claim set and a fresh extraction set; human adjudication of at least 50 items (Claude cannot provide independent labels).

### CH-031 — Prototype built around one laptop at a time; claim page looked dead
- **Evidence:** user: "prototype seems of no use… checking a claim shows nothing". The button stayed disabled until a laptop was chosen. Needs required a form; no recommended numbers; brand claims impossible.
- **Impact:** the main value (decide which laptop; test real claims) was not reachable.
- **Resolution:** D-039…D-044, PIVOT doc. **Lesson:** run the five core scenarios end to end before each demo, not just feature tests.

### CH-032 — Reading speed vs coverage
- **Evidence:** deep reader ≈ 25 s/review (hours per laptop); only 3 of 14 laptops had ratings. Fast reader ≈ 2.6 s/review. Held-out check: precision 0.89, **recall 0.46**, opinion 30/30.
- **Impact:** every rating rests on fewer owners than actually wrote about the topic; recall may differ by topic (value and keyboard mentions are likelier to be dropped).
- **Next action:** improve recall (looser sentence matching, second pass for dropped topics), then re-test on a fresh set.

### CH-033 — Brand claims are only as wide as the catalogue
- **Evidence:** 14 laptops, 5 brands (Apple has 1 model). Lab battery hours exist for 3 laptops. Unused: Amazon 2023 laptop sample and 87 PCBox listings.
- **Impact:** "ASUS laptops are bad at battery" really means "the 4 ASUS laptops we have, per 2022-era Flipkart reviews". The page says so.
- **Next action:** widen the catalogue (Q-027); keep the limit sentence visible meanwhile.

### CH-034 — Recommended numbers are not sourced
- **Evidence:** `SPEC_RULES` in `advisor.py` are common rules of thumb written by Claude. Not validated against published requirements.
- **Next action:** attach a source to each rule (Adobe Premiere, Android Studio, Docker, Steam hardware survey…) or mark it "our judgement" (Q-028).

### CH-035 — Data-loss incident: a failed rebuild deleted the deep-reading results (my error)
- **Evidence:** I rebuilt the live database with new, untested Amazon-loading code. It crashed on duplicate review ids after the old file had been deleted; the in-memory snapshot of extraction results died with the process. `evidence_claims` and `extraction_runs` for FKL-09/10/11 (about 540 reviews, hours of model time) were gone. This is the same class of mistake as CH-022.
- **Recovery:** the previously started API process still held the deleted file open, so I read every claim back through its `/evidence/review/{id}` endpoint and re-inserted 1,316 claims. Reading status matches the old API exactly (FKL-09 266/266, FKL-11 128/128, FKL-10 152/679). Battery counts match the earlier records except FKL-09 happy owners 10 vs 9 recorded earlier; 2 reviews that had a "failed" status now show as read with no claims; `usage_context` was not recoverable (unused).
- **Fix:** D-047 automatic backup before any rebuild; rebuild new code into a scratch path first (`ingest --db`), only then replace the live file. **Lesson:** never run unproven loaders against the only copy of expensive data.

### CH-032 (update)
Recall resolved by D-046: fresh held-out check **precision 0.81, recall 0.95, F1 0.87, opinion right 68/72** (was 0.89 / 0.46). Cost: about 3 s per review instead of 2.6 s, and more false topics (generic praise mentioning "price" can become a value opinion).

### CH-033 (update)
Widened to 29 laptops: 14 Indian (ranked) + 15 US Amazon (evidence only). Still thin: most US laptops have 15–40 reviews; Apple has 1 Indian model and no US MacBook Air that passed the filters; lab battery hours still exist for 3 laptops only.

### CH-036 — Critic pass found 21 issues in a 'working' product
See `docs/CRITIC_REVIEW_2026-11-11.md`. Lesson: run the personas on COMPLETE data and read the answers as a sceptic; green tests and 32/32 end-to-end checks had not caught a crash ("gaming laptops"), a wrong-direction verdict ("throttles"), or contradictory copy.

## CH-037 (2026-11-11): Closed catalogue vs general chatbots
Everything in the app comes from a local database of 29 laptops. Any other laptop or question gets no answer, and a chatbot would. Not a bug, but a product-level risk for the capstone argument. See Q-032 and D-053.

## CH-038 (2026-11-11): Model too slow for a form
First version asked the model for claim plus kind per item: 18 s. Asking only for exact quotes, one fact per item, cut it to 5–9 s. Kind is decided by code. The page tells the student to expect about 10 seconds. If Ollama is down a cheap check (cached 20 s) skips the model, so the page never waits on a timeout.
## CH-039 (2026-11-11): Splitting hides meaning
Splitting "40Wh battery, up to 20 hours" at the comma left "up to 20 hours" with no battery word, so the arithmetic never ran (caught by the new end-to-end check 6e). Fix: an hours piece counts as battery when the listing mentions battery anywhere. The model also grouped items ("8 GB RAM, 512 GB SSD") so code re-splits them. A claim whose words are not in the pasted text is dropped.

## CH-040 (2026-11-11): Evaluating the Lie Detector with no real listings and no teammate
Copying real seller listings in bulk breaks marketplace terms and copyright, and there is no teammate to write an independent key. Chosen: real published spec numbers retyped into listing style plus stress cases, rubric written before running, first runs saved as history, three sets so at least some numbers come from code not yet fixed against, my own key mistakes logged. Cost: not independent, not real prose. Lesson (again): the first run was 68% and the product had been "done" the day before; the worst bug (matching a 2024 MacBook to a 2020 one and calling its true specs wrong) was invisible to unit tests.
