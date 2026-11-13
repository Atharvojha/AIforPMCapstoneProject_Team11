-- LapFit schema for Supabase (Postgres). Mirrors the SQLite tables used by the local prototype.
-- Every fact table carries verified, verified_by, verified_at and is_sample.
-- Only rows with verified = true OR is_sample = true may be shown.
-- Turn on row level security and allow the server (service role) only; the browser never reads these tables.

create table laptop_model (
  id text primary key, brand text not null, line text not null, year int not null,
  processor text, gpu text, display_size numeric, weight_kg numeric,
  hinge_type text not null check (hinge_type in ('clamshell','convertible_360','detachable')),
  ram_slots_or_soldered text, warranty text, warranty_years int,
  verified boolean not null default false, verified_by text, verified_at timestamptz, is_sample boolean not null default false);

create table variant (
  id text primary key, model_id text not null references laptop_model(id),
  ram_gb int not null, storage_gb int not null, colours jsonb not null,
  price_inr int not null, price_as_of date not null, availability text,
  verified boolean not null default false, verified_by text, verified_at timestamptz, is_sample boolean not null default false);

create table price_history (
  id bigserial primary key, variant_id text not null references variant(id),
  seller text, price_inr int not null, "timestamp" timestamptz not null,
  verified boolean not null default false, verified_by text, verified_at timestamptz, is_sample boolean not null default false);

create table evidence_excerpt (
  id text primary key, laptop_id text not null references laptop_model(id), topic text not null,
  text text not null, source_name text, source_url text, date date, reviewer_type text,
  ownership_months int, n_reports int not null default 1, rating numeric,
  verified boolean not null default false, verified_by text, verified_at timestamptz, is_sample boolean not null default false);

create table claim_ledger (
  id text primary key, claim_text text not null, scope text not null, match_terms text,
  verdict text, sample_size int, evidence_ids jsonb, approver text, date date,
  verified boolean not null default false, verified_by text, verified_at timestamptz, is_sample boolean not null default false);

create table query_log (
  id bigserial primary key, ts timestamptz not null default now(), flow text, confidence numeric,
  language text, router_mode text, duration_ms int, outcome text, text_len int);

create table unhandled_requests (
  id bigserial primary key, text text not null, guessed_flow text, reason text, ts timestamptz not null default now());

create table gate_log (
  id bigserial primary key, ts timestamptz not null default now(), laptop_id text, variant_id text, check_name text, detail text);

alter table laptop_model enable row level security;
alter table variant enable row level security;
alter table price_history enable row level security;
alter table evidence_excerpt enable row level security;
alter table claim_ledger enable row level security;
alter table query_log enable row level security;
alter table unhandled_requests enable row level security;
alter table gate_log enable row level security;
