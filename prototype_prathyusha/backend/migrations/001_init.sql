-- LapFit schema v1 (SQLite; Postgres-portable names/types). See docs/DATA_DICTIONARY.md.
PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  url TEXT, publisher TEXT, source_name TEXT,
  source_class TEXT NOT NULL CHECK (source_class IN ('manufacturer_spec','manufacturer_claim','independent_lab','spec_database','owner_review','forum','video','dataset','other')),
  author TEXT, published_at TEXT, retrieved_at TEXT,
  licence_status TEXT, permission TEXT NOT NULL DEFAULT 'stored_facts_only'
    CHECK (permission IN ('stored_full','stored_facts_only','link_only','blocked')),
  attribution_text TEXT, content_hash TEXT, recheck_after TEXT, exact_variant_note TEXT, notes TEXT
);

CREATE TABLE laptop_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL, marketing_name TEXT NOT NULL, category TEXT DEFAULT 'laptop',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (brand, marketing_name)
);

CREATE TABLE laptop_variants (
  id TEXT PRIMARY KEY,                      -- e.g. FKL-11
  model_id INTEGER NOT NULL REFERENCES laptop_models(id),
  listing_title TEXT NOT NULL,
  display_name TEXT NOT NULL,
  catalogue_set TEXT NOT NULL CHECK (catalogue_set IN ('flipkart14','well_evidenced','live_researched')),
  aliases TEXT NOT NULL DEFAULT '[]',        -- JSON array
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE spec_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id TEXT NOT NULL REFERENCES laptop_variants(id),
  attribute TEXT NOT NULL,
  value_text TEXT, value_num REAL, unit TEXT,
  source_id TEXT NOT NULL REFERENCES sources(id),
  quote TEXT,
  variant_match TEXT NOT NULL CHECK (variant_match IN ('exact_listing','exact_family','sibling_cpu','sibling_other','family_only','unknown')),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('verified_on_page','machine_validated','needs_human_spot_check','verified_by_human','rejected')),
  retrieved_at TEXT,
  UNIQUE (variant_id, attribute, source_id)
);

CREATE TABLE benchmarks (
  id TEXT PRIMARY KEY,                       -- e.g. BM-003
  variant_id TEXT NOT NULL REFERENCES laptop_variants(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  category TEXT NOT NULL, test_name TEXT NOT NULL,
  value_text TEXT, value_num REAL, unit TEXT,
  conditions TEXT,                           -- free text (curated) / JSON later
  methodology TEXT NOT NULL,
  published_at TEXT, source_url TEXT, retrieved_at TEXT,
  variant_match TEXT NOT NULL CHECK (variant_match IN ('exact_listing','exact_family','sibling_cpu','sibling_other','family_only','unknown')),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('verified_on_page','machine_validated','needs_human_spot_check','verified_by_human','rejected'))
);

CREATE TABLE dup_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  representative_review_id TEXT, size INTEGER NOT NULL, method TEXT NOT NULL
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,                       -- FK-00001 ...
  external_review_id TEXT, source_id TEXT NOT NULL REFERENCES sources(id),
  variant_id TEXT REFERENCES laptop_variants(id),
  rating INTEGER, title TEXT, original_text TEXT NOT NULL,
  review_date TEXT, language TEXT, helpful_votes INTEGER, verified_purchase TEXT,
  is_synthetic_test INTEGER NOT NULL DEFAULT 0,
  dup_cluster_id INTEGER REFERENCES dup_clusters(id),
  word_count INTEGER NOT NULL, content_hash TEXT NOT NULL,
  flag TEXT,                                 -- instruction_like | NULL (rule-based prefilter)
  config_mismatch_hint TEXT,                 -- rule-based: 'hardware_modified' (set aside) | 'upgrade_mentioned' (kept; upgradeability evidence)
  ingestion_version TEXT NOT NULL,
  UNIQUE (source_id, external_review_id)
);
CREATE INDEX idx_reviews_variant ON reviews(variant_id);
CREATE INDEX idx_reviews_cluster ON reviews(dup_cluster_id);

CREATE VIRTUAL TABLE fts_reviews USING fts5(text, review_id UNINDEXED, variant_id UNINDEXED, tokenize='unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE fts_variants USING fts5(text, variant_id UNINDEXED, tokenize='unicode61 remove_diacritics 2');

CREATE TABLE embeddings (
  owner_type TEXT NOT NULL, owner_id TEXT NOT NULL,
  model_name TEXT NOT NULL, dim INTEGER NOT NULL, vector BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_type, owner_id, model_name)
);

CREATE TABLE evidence_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id TEXT NOT NULL REFERENCES reviews(id),
  variant_id TEXT NOT NULL REFERENCES laptop_variants(id),
  category TEXT NOT NULL, claim_text TEXT NOT NULL,
  polarity TEXT NOT NULL CHECK (polarity IN ('positive','negative','mixed','neutral','not_stated')),
  strength TEXT NOT NULL DEFAULT 'unclear' CHECK (strength IN ('clear','mild','unclear')),
  usage_context TEXT,
  quote TEXT NOT NULL, quote_start INTEGER NOT NULL, quote_end INTEGER NOT NULL,
  model TEXT NOT NULL, prompt_version TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('machine_validated','needs_human_spot_check','verified_by_human','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_claims_variant_cat ON evidence_claims(variant_id, category);

CREATE TABLE extraction_runs (
  review_id TEXT PRIMARY KEY REFERENCES reviews(id),
  status TEXT NOT NULL CHECK (status IN ('done','skipped_trivial','skipped_flagged','failed')),
  model TEXT, prompt_version TEXT, n_claims INTEGER DEFAULT 0, n_rejected INTEGER DEFAULT 0,
  secs REAL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE exclusion_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id TEXT NOT NULL REFERENCES reviews(id),
  reason TEXT NOT NULL CHECK (reason IN ('different_variant','different_use','duplicate','promotional','off_topic','instruction_injection','unclear_context','spec_mismatch')),
  rule TEXT NOT NULL, profile_hash TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT, stage TEXT NOT NULL,
  ms REAL, model TEXT, status TEXT, meta TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
