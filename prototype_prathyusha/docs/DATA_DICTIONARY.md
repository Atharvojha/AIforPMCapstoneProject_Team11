# DATA_DICTIONARY — canonical schema (Stage 3 proposal)

Rules: preserve original text immutably; unknown is a value (`unknown`, `not_stated`), never a guess; every fact row carries a source and a `variant_match`; ingestion is idempotent via unique constraints; types shown are logical (SQLite now, Postgres-portable).

## Enums
| Enum | Values |
|---|---|
| `source_class` | manufacturer_spec, manufacturer_claim, independent_lab, spec_database, owner_review, forum, video, dataset, other |
| `variant_match` | exact_listing, exact_family, sibling_cpu, sibling_other, family_only, unknown |
| `validation_status` | verified_on_page, machine_validated, needs_human_spot_check, verified_by_human, rejected |
| `category` | performance, memory, gpu, battery, display, thermals_noise, portability, keyboard_trackpad, ports_connectivity, upgradeability, build_reliability, value, other |
| `polarity` | positive, negative, mixed, neutral, not_stated |
| `applicability` | applies, partly, not, unknown |
| `exclusion_reason` | different_variant, different_use, duplicate, promotional, off_topic, instruction_injection, unclear_context, spec_mismatch |
| `req_status` | met, not_met, unknown, spec_mismatch |
| `rating_label` | strong, good_with_tradeoffs, weak, not_enough_evidence |
| `verdict` | supported, contradicted, mixed, insufficient (+ sublabel `claimed_unverified`) |
| `claim_type` | spec_fact, measured, experiential, predictive, unsupported |
| `permission` | stored_full, stored_facts_only, link_only, blocked |

## Tables
**laptop_models**(id, brand, family, marketing_name, category, created_at) — UNIQUE(brand, marketing_name).
**laptop_variants**(id, model_id→, sku, listing_id, region, display_name, catalogue_set ∈{flipkart14, well_evidenced, live_researched}, aliases JSON, created_at) — one row per exact sellable configuration/listing. Wide spec columns are **not** stored here; facts live in `spec_facts`.
**spec_facts**(id, variant_id→, attribute, value_text, value_num, unit, source_id→, quote, variant_match, validation_status, retrieved_at) — attribute ∈ {cpu, gpu, ram_gb, ram_type, ram_soldered, ram_slots, storage_gb, storage_slots, display_panel, display_res, refresh_hz, battery_wh, weight_kg, price_inr, os, ports…}. UNIQUE(variant_id, attribute, source_id). Conflicting facts from different sources both kept; resolver picks by source class then recency and shows conflicts.
**sources**(id, url, publisher, source_class, author, published_at, retrieved_at, licence_status, permission, attribution_text, content_hash, recheck_after, notes) — UNIQUE(url, content_hash).
**documents**(id, source_id→, kind ∈{page, dataset_file, pdf}, raw_path, text_path, content_hash, bytes, fetched_at, fetch_status, robots_ok) — raw archive pointers; *no full text stored when permission is link_only*.
**reviews**(id, external_review_id, source_id→, variant_id→ nullable, rating, title, original_text, review_date, language, helpful_votes, verified_purchase, is_synthetic_test, dup_cluster_id→, content_hash, ingestion_version) — UNIQUE(source_id, external_review_id). Flipkart IDs: `FK-#####`.
**dup_clusters**(id, representative_review_id, size, method ∈{exact, normalised, near}).
**evidence_claims**(id, review_id→ nullable, document_id→ nullable, variant_id→, category, attribute, claim_text, polarity, usage_context, configuration_context, conditions JSON, quote, quote_start, quote_end, applicability, applicability_reason, extraction_confidence_label, model, prompt_version, validation_status, created_at) — `quote` MUST be an exact substring of the source text at the offsets.
**benchmarks**(id, variant_id→, source_id→, category, test_name, value_text, value_num, unit, conditions JSON{brightness_nits, workload, power_mode, refresh_hz, wifi, os, browser…}, methodology ∈{independent_lab_script, stress_test, noise_measurement, manufacturer_claim}, published_at, variant_match, validation_status, quote).
**exclusion_log**(id, review_id→, profile_hash, claim_id→ nullable, reason, rule, created_at) — powers "why set aside".
**embeddings**(id, owner_type ∈{review, evidence, document_chunk}, owner_id, model_name, model_version, dim, vector BLOB, created_at) — UNIQUE(owner_type, owner_id, model_name). Never mix models in one search.
**fts_reviews / fts_chunks** — FTS5 virtual tables.
**profiles**(id, label, workloads JSON, followups JSON, conditions JSON, hard_requirements JSON, preferences JSON, priorities JSON, weights JSON, free_text_note NULLABLE, created_at) — stored client-side by default; server copy only if the student saves/share.
**fit_analyses**(id, variant_id→, profile_hash, gate JSON, ratings JSON, coverage, dealbreakers JSON, watchouts JSON, summary_text, data_version, model, prompt_version, status, created_at).
**claim_checks**(id, variant_id→, claim_text, claim_type, context JSON, status, verdict, confidence_text, coverage, data_version, research_job_id→ nullable, created_at).
**claim_subclaims**(id, check_id→, text, claim_type, conditions JSON, verdict, rationale).
**claim_evidence_links**(id, subclaim_id→, evidence_ref_type ∈{review_claim, benchmark, spec_fact}, evidence_ref_id, stance ∈{for, against, not_applicable}, reason).
**research_jobs**(id, query, resolved_variant_id→, status, steps JSON, sources_found, fetched, link_only, rejected, credits_used, started_at, finished_at, error).
**jobs**(id, type, payload JSON, status, attempts, error, started_at, finished_at) — ingestion/embedding/eval.
**search_credits**(month, provider, used, budget) — Tavily budget guard.
**eval_sets / eval_items / eval_runs / eval_results**(…) — golden items with labels & status (draft/frozen), run metadata (model, prompt, embed model, data_version), per-item outputs and metric values.
**feedback**(id, target_type, target_id, kind, note, created_at, promoted_to_eval_item_id→).
**traces**(id, request_id, stage, started_at, ms, model, tokens_in, tokens_out, status, meta JSON).

## Provenance rules
1. A displayed fact/quote/number must resolve to a row with `source_id` and `validation_status ∈ {verified_on_page, machine_validated, verified_by_human}`; `needs_human_spot_check` renders as "unconfirmed".
2. Only `variant_match ∈ {exact_listing, exact_family}` may be presented as "this laptop's"; others appear in the sibling lane.
3. Synthetic/test reviews (`is_synthetic_test`) never enter user-facing corpora.
4. `permission=link_only` ⇒ no text stored beyond title/url/short fact with quote ≤ 25 words.

## Seed mapping from existing files
`flipkart_laptop_listings.csv` → laptop_variants + spec_facts (source: title parse, status `machine_validated`, class `dataset`); `flipkart_laptop_reviews.csv` → reviews; `curated/*.csv` → sources, spec_facts, benchmarks (validation preserved); `amazon_laptop_*` → reviews (secondary corpus).

## Added 2026-11-11: `data/votes.db`
`topic_votes(review_id, variant_id, topic, opinion, quote, model, version, PK(review_id, topic))` — topic ∈ performance, memory, battery, display, thermals_noise, portability, keyboard_trackpad, build_reliability, value, ports_connectivity; opinion ∈ positive, negative, mixed; quote is an exact sentence of the review. `topic_done(review_id, variant_id, n, secs, version)` records that a review was read even when it yielded no topic.

## Added 2026-11-11: well_evidenced catalogue
`laptop_variants.catalogue_set = 'well_evidenced'` = Amazon US laptops (id `AMZ-nn`), reviews `AM-nn-nnn` (source `S-AMAZON-REVIEWS-23`), specs `price_usd`, `ram_gb`, `storage_gb`, `display_size_in` parsed from the listing. No INR price: they are never ranked. Hidden from the laptop list and name search.


## Final state notes (2026-11-11)
- **Databases:** `backend/data/lapfit.db` (reviews, listings, spec facts, benchmarks, evidence claims; rebuildable, backed up to `backend/data/backups/` before any rebuild, D-047) and `backend/data/votes.db` (separate on purpose so a rebuild cannot erase hours of reading).
- **`votes.db`:** `topic_votes(review_id, variant_id, topic, opinion, quote, model, version)` with `opinion` in positive / negative / mixed (none is not stored) and `topic` in performance, memory, battery, display, thermals_noise, portability, keyboard_trackpad, build_reliability, value, ports_connectivity; `topic_done(review_id, version)`. Current version `topics-v3`: 4,514 opinions (3,091 positive, 1,366 negative, 57 mixed) from 2,819 reviews (2,155 Flipkart, 664 Amazon).
- **`laptop_variants.catalogue_set`:** `flipkart14` (14, recommended), `well_evidenced` (15 US Amazon laptops, ids `AMZ-nn`, reviews `AM-nn-nnn`, evidence only, USD prices, hidden from `/laptops` and `/search`), `live_researched`.
- **Not stored:** pasted listings and needs text are not saved on the server; the needs sheet is stored only in the browser (`lapfit.needs.sheet.v1`, listing text `lapfit.listing.text.v1`).
- **Known gaps:** battery_wh missing for 9 of 14 laptops; ram_upgradeable mostly "not stated"; weight and screen present for most; no fields for Linux, OLED, Thunderbolt, webcam, audio.
