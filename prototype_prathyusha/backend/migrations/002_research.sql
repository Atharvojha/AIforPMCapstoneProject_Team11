-- Live research: jobs, discovered links, search credit budget. Live-researched laptops reuse laptop_variants/spec_facts/sources.
CREATE TABLE research_jobs (
  id TEXT PRIMARY KEY, query TEXT NOT NULL, query_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
  variant_id TEXT, steps TEXT NOT NULL DEFAULT '[]', counts TEXT, error TEXT, credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT
);
CREATE INDEX idx_research_key ON research_jobs(query_key, created_at);
CREATE TABLE research_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES research_jobs(id), url TEXT NOT NULL, title TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('fetched','link_only','blocked','rejected','failed')), tier TEXT, reason TEXT, snippet TEXT
);
CREATE TABLE search_credits (
  month TEXT NOT NULL, provider TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, budget INTEGER NOT NULL, PRIMARY KEY (month, provider)
);
