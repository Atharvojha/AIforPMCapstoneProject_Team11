-- LapFit schema. Runs on Supabase Postgres and on PGlite (used for local tests).
-- Rules: only verified or sample rows are shown (in `course` mode, imported rows are allowed and labelled);
-- every price has an as-of date; sources carry rights; nothing here stores typed user text except the scrubbed unhandled log.

create extension if not exists vector;

-- ---------- settings (versioned thresholds; one place) ----------
create table settings (
  key text primary key,
  value jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
create or replace function setting(k text) returns jsonb language sql stable as $$ select value from settings where key = k $$;
-- 'course' lets unverified imported rows show (labelled); 'production' shows only verified or sample rows.
create or replace function data_mode() returns text language sql stable as $$ select coalesce(setting('data_mode') #>> '{}', 'course') $$;

-- ---------- sources and rights ----------
create table source (
  id text primary key,
  publisher text, source_name text,
  source_class text not null check (source_class in ('manufacturer_spec','manufacturer_claim','independent_lab','spec_database','owner_review','forum','video','dataset','other')),
  url text, licence_status text,
  rights_status text not null default 'unverified_course_use'
    check (rights_status in ('confirmed','declared_cc_by_4','research_only','facts_only','unverified_course_use')),
  permission text not null default 'stored_facts_only' check (permission in ('stored_full','stored_facts_only','link_only','blocked')),
  quote_allowed boolean not null default false,
  attribution_text text,
  region text not null default 'UNKNOWN' check (region in ('IN','US','OTHER','UNKNOWN')),
  notes text
);

-- ---------- catalog ----------
create table laptop_model (
  id int primary key,
  brand text not null, marketing_name text not null, category text not null default 'laptop',
  unique (brand, marketing_name)
);
create table variant (
  id text primary key,
  model_id int not null references laptop_model(id),
  listing_title text, display_name text not null,
  catalogue_set text not null,
  market text not null default 'IN' check (market in ('IN','US','OTHER')),
  recommendable boolean not null default false,        -- only these appear in shortlists
  availability text not null default 'unknown',
  aliases_text text not null default '',                 -- aliases joined for simple matching
  review_count int not null default 0,
  verified boolean not null default false, verified_by text, verified_at timestamptz,
  is_sample boolean not null default false
);
create table model_alias (
  id bigint generated always as identity primary key,
  variant_id text not null references variant(id) on delete cascade,
  alias text not null,
  unique (variant_id, alias)
);
create table spec_fact (
  id bigint generated always as identity primary key,
  variant_id text not null references variant(id) on delete cascade,
  attribute text not null, value_text text, value_num numeric, unit text,
  source_id text not null references source(id),
  quote text,
  variant_match text not null check (variant_match in ('exact_listing','exact_family','sibling_cpu','sibling_other','family_only','unknown')),
  validation_status text not null check (validation_status in ('verified_on_page','machine_validated','needs_human_spot_check','verified_by_human','rejected')),
  retrieved_at date,
  unique (variant_id, attribute, source_id)
);
create index spec_fact_variant_attr on spec_fact (variant_id, attribute);
-- Curated fields the imported data lacks (see data-model/curation/README.md). Unverified rows are labelled.
create table variant_curation (
  variant_id text primary key references variant(id) on delete cascade,
  hinge_type text check (hinge_type in ('clamshell','convertible_360','detachable')),
  hinge_basis text,
  warranty_years int check (warranty_years between 0 and 10), warranty_basis text,
  colours jsonb not null default '[]'::jsonb,
  cpu_vendor text, cpu_family text, cpu_generation_or_model text,
  win11_status text, win11_basis text,
  memory_slots text,
  verified boolean not null default false, verified_by text, verified_at timestamptz
);
create table price_history (
  id bigint generated always as identity primary key,
  variant_id text not null references variant(id) on delete cascade,
  seller text, price_inr int not null check (price_inr > 0),
  observed_at date not null,
  source_id text references source(id),
  verified boolean not null default false
);
create index price_history_variant on price_history (variant_id, observed_at);

-- Helpers over the attribute-value table (prefer human-verified, exact listing, then oldest id).
create or replace function spec_num(vid text, attr text) returns numeric language sql stable as $$
  select value_num from spec_fact where variant_id = vid and attribute = attr and validation_status <> 'rejected'
  order by (validation_status = 'verified_by_human') desc, (variant_match = 'exact_listing') desc, id limit 1 $$;
create or replace function spec_text(vid text, attr text) returns text language sql stable as $$
  select value_text from spec_fact where variant_id = vid and attribute = attr and validation_status <> 'rejected'
  order by (validation_status = 'verified_by_human') desc, (variant_match = 'exact_listing') desc, id limit 1 $$;

-- Wide row used for filtering and display.
create view variant_specs as
select v.id as variant_id, v.model_id, m.brand, m.marketing_name, v.display_name, v.catalogue_set, v.market,
  v.recommendable, v.availability, v.review_count,
  spec_num(v.id,'ram_gb')::int as ram_gb,
  spec_num(v.id,'storage_gb')::int as storage_gb,
  spec_num(v.id,'display_size_in') as display_size,
  spec_num(v.id,'weight_kg') as weight_kg,
  spec_num(v.id,'price_inr')::int as price_inr,
  (select max(retrieved_at) from spec_fact f where f.variant_id = v.id and f.attribute = 'price_inr') as price_as_of,
  spec_text(v.id,'cpu') as cpu_text, spec_text(v.id,'gpu') as gpu_text,
  spec_num(v.id,'battery_wh') as battery_wh, spec_num(v.id,'refresh_hz') as refresh_hz,
  c.hinge_type, c.warranty_years, coalesce(c.colours, '[]'::jsonb) as colours,
  c.cpu_vendor, c.cpu_family, c.cpu_generation_or_model, c.win11_status, c.memory_slots,
  (c.variant_id is not null and c.verified) as curation_verified,
  v.verified, v.is_sample
from variant v
join laptop_model m on m.id = v.model_id
left join variant_curation c on c.variant_id = v.id;

-- Which attributes can be filtered, and how. Column names in filters come only from here.
create table filter_attribute (
  key text primary key, label text not null, unit text,
  kind text not null check (kind in ('number','enum','colour')),
  default_operator text not null check (default_operator in ('>=','<=','=','in')),
  column_ref text not null, allowed_values jsonb, active boolean not null default true
);
insert into filter_attribute (key, label, unit, kind, default_operator, column_ref, allowed_values) values
 ('ram_gb','RAM','GB','number','>=','ram_gb',null),
 ('storage_gb','Storage','GB','number','>=','storage_gb',null),
 ('weight_kg','Weight','kg','number','<=','weight_kg',null),
 ('price_inr','Price','INR','number','<=','price_inr',null),
 ('display_size','Screen','inch','number','>=','display_size',null),
 ('warranty_years','Warranty','years','number','>=','warranty_years',null),
 ('hinge_type','Hinge type',null,'enum','in','hinge_type','["clamshell","convertible_360","detachable"]'),
 ('colour','Colour',null,'colour','in','colours',null);

-- ---------- evidence ----------
create table review (
  id text primary key,
  source_id text not null references source(id),
  variant_id text references variant(id),
  rating int, title text, original_text text not null,
  language text, review_date date, helpful_votes int, verified_purchase text,
  dup_cluster_id int, flag text, config_mismatch_hint text, content_hash text,
  region text not null default 'UNKNOWN',
  fts tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || original_text)) stored
);
create index review_fts on review using gin (fts);
create index review_variant on review (variant_id);

-- Topic groups (decision D-17): the 14 imported categories map onto our seven topics.
create or replace function topic_group(cat text) returns text language sql immutable as $$
  select case cat
    when 'battery' then 'battery' when 'keyboard_trackpad' then 'keyboard' when 'build_reliability' then 'hinge'
    when 'display' then 'display' when 'performance' then 'performance' when 'gpu' then 'performance' when 'memory' then 'performance'
    when 'thermals_noise' then 'heat_noise' when 'delivery_or_seller' then 'service' else 'other' end $$;

create table evidence_claim (
  id bigint primary key,
  review_id text not null references review(id) on delete cascade,
  variant_id text not null references variant(id),
  category text not null, topic text generated always as (topic_group(category)) stored,
  claim_text text not null,
  polarity text not null check (polarity in ('positive','negative','mixed','neutral','not_stated')),
  strength text, usage_context text,
  quote text not null, quote_start int, quote_end int,
  model text, prompt_version text,
  validation_status text not null check (validation_status in ('machine_validated','needs_human_spot_check','verified_by_human','rejected')),
  source_id text not null references source(id),
  region text not null default 'UNKNOWN'
);
create index evidence_variant_cat on evidence_claim (variant_id, category);
create index evidence_variant_topic on evidence_claim (variant_id, topic);

create table review_embedding (
  review_id text not null references review(id) on delete cascade,
  model_name text not null, dim int not null, embedding vector(384),
  primary key (review_id, model_name)
);

-- ---------- reviewers and the claim ledger (verdicts only with a named approver) ----------
create table reviewer (
  id bigint generated always as identity primary key,
  name text not null unique, role text not null default 'reviewer' check (role in ('reviewer','admin')),
  active boolean not null default true
);
create table claim_ledger (
  id text primary key,
  claim_text text not null,
  scope text not null default 'general',          -- 'general', a variant id, or a model id as text
  match_terms text[] not null default '{}',
  verdict text, sample_size int, evidence_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  approver text, approved_at timestamptz,
  is_sample boolean not null default false,
  constraint approved_needs_approver check (status <> 'approved' or (approver is not null and verdict is not null))
);

-- ---------- logs (no typed text except the scrubbed unhandled log) ----------
create table query_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(), request_id text, flow text, confidence numeric, language text,
  router_mode text, duration_ms int, outcome text, text_len int, settings_version text, data_version text
);
create table unhandled_request (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(), text_scrubbed text, guessed_flow text, reason text
);
create table gate_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(), request_id text, variant_id text, check_name text, detail text
);
create table demand_signal (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(), budget_band text not null, use_cases jsonb not null default '[]'::jsonb,
  musts jsonb not null default '[]'::jsonb, matched int not null, is_sample boolean not null default false
);
create table view_event (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(), variant_id text, kind text not null default 'view', session_hash text, is_sample boolean not null default false
);

-- Row-level security: the browser never reads these tables directly. Server code uses the service role.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
