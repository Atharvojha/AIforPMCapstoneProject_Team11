-- Tools: every tool is tool_<name>(args jsonb) returns jsonb. Server code calls them by RPC (Supabase) or SQL (tests).
-- Tools read data and count. They never decide a verdict; verdicts come only from approved ledger rows.

create or replace function norm_text(t text) returns text language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', ' ', 'g')) $$;

create or replace function shown(is_verified boolean, is_samp boolean) returns boolean language sql stable as $$
  select coalesce(is_samp, false) or coalesce(is_verified, false) or data_mode() = 'course' $$;

-- Trim a quote to at most n words (the quote limit for sources that allow short excerpts).
create or replace function trim_words(t text, n int) returns text language sql immutable as $$
  select case when array_length(regexp_split_to_array(trim(t), '\s+'), 1) <= n then trim(t)
    else array_to_string((regexp_split_to_array(trim(t), '\s+'))[1:n], ' ') || '...' end $$;

-- Quotes may be shown only if the source allows it and the data mode allows the source's rights status.
create or replace function quote_ok(src text) returns boolean language sql stable as $$
  select exists (select 1 from source s where s.id = src and s.quote_allowed
    and (data_mode() = 'course' or s.rights_status in ('confirmed','declared_cc_by_4'))
    and s.rights_status <> 'research_only') $$;

create or replace function tool_settings(args jsonb default '{}') returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) || jsonb_build_object('_version', coalesce(max(version), 1)) from settings $$;

-- Find candidate laptops for a mention (brand and line words). The caller decides ask-which logic.
create or replace function tool_resolve_laptop(args jsonb) returns jsonb language plpgsql stable as $$
declare q text; toks text[]; cand jsonb;
begin
  q := norm_text(coalesce(args->>'brand', '') || ' ' || coalesce(args->>'line', ''));
  toks := array(select t from unnest(string_to_array(q, ' ')) as t
                where t <> '' and t <> all (array['laptop','notebook','gb','ram','ssd','storage','the','a','an','and','with','new','for']));
  if coalesce(array_length(toks, 1), 0) = 0 then
    return jsonb_build_object('candidates', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'variant_id', x.variant_id, 'model_id', x.model_id, 'display_name', x.display_name, 'brand', x.brand,
      'price_inr', x.price_inr, 'ram_gb', x.ram_gb, 'storage_gb', x.storage_gb, 'recommendable', x.recommendable)
      order by x.recommendable desc, x.variant_id), '[]'::jsonb)
  into cand
  from (
    select s.* from variant_specs s join variant v on v.id = s.variant_id
    where shown(s.verified, s.is_sample)
      and not exists (select 1 from unnest(toks) t
                      where position(t in norm_text(s.brand || ' ' || s.display_name || ' ' || v.aliases_text)) = 0)
  ) x;
  return jsonb_build_object('candidates', cand);
end $$;

-- Filter recommendable variants by every criterion. Columns and kinds come only from filter_attribute.
-- An unknown value never satisfies a criterion; the count of unknowns per attribute is returned for transparency.
create or replace function tool_find_variants(args jsonb) returns jsonb language plpgsql stable as $$
declare
  crit jsonb; sql text; a record; op text; rows jsonb; unknown jsonb := '{}'::jsonb; n int; cnt int;
  allowed_ops text[] := array['>=','<=','=','>','<'];
begin
  sql := 'select coalesce(jsonb_agg(to_jsonb(s) order by s.price_inr, s.variant_id), ''[]''::jsonb) from variant_specs s '
      || 'where s.recommendable and shown(s.verified, s.is_sample)';
  if nullif(args->>'budget_max', '') is not null then sql := sql || format(' and s.price_inr <= %L::numeric', args->>'budget_max'); end if;
  if nullif(args->>'budget_min', '') is not null then sql := sql || format(' and s.price_inr >= %L::numeric', args->>'budget_min'); end if;
  if nullif(args->>'exclude_model_id', '') is not null then sql := sql || format(' and s.model_id <> %L::int', args->>'exclude_model_id'); end if;
  for crit in select * from jsonb_array_elements(coalesce(args->'criteria', '[]'::jsonb)) loop
    select * into a from filter_attribute where key = crit->>'attribute' and active;
    if not found then raise exception 'unknown filter attribute: %', crit->>'attribute'; end if;
    op := crit->>'operator';
    if a.kind = 'number' then
      if not (op = any (allowed_ops)) then raise exception 'operator not allowed: %', op; end if;
      sql := sql || format(' and s.%I %s %L::numeric', a.column_ref, op, crit->>'value');
    elsif a.kind = 'enum' then
      sql := sql || format(' and s.%I = any (array(select jsonb_array_elements_text(%L::jsonb)))', a.column_ref, (crit->'value')::text);
    else
      sql := sql || format(' and exists (select 1 from jsonb_array_elements_text(s.%I) c where lower(c) = any (array(select lower(x) from jsonb_array_elements_text(%L::jsonb) x)))', a.column_ref, (crit->'value')::text);
    end if;
    if a.kind = 'number' then
      execute format('select count(*) from variant_specs s where s.recommendable and shown(s.verified, s.is_sample) and s.%I is null', a.column_ref) into cnt;
      unknown := unknown || jsonb_build_object(a.key, cnt);
    end if;
  end loop;
  execute sql into rows;
  return jsonb_build_object('rows', rows, 'total', jsonb_array_length(rows), 'unknown_values', unknown);
end $$;

create or replace function tool_get_variant(args jsonb) returns jsonb language plpgsql stable as $$
declare r jsonb; facts jsonb;
begin
  select to_jsonb(s) into r from variant_specs s where s.variant_id = args->>'variant_id' and shown(s.verified, s.is_sample);
  if r is null then return jsonb_build_object('found', false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('attribute', f.attribute, 'value_text', f.value_text, 'value_num', f.value_num, 'unit', f.unit,
      'source_id', f.source_id, 'source', src.source_name, 'url', src.url, 'variant_match', f.variant_match,
      'validation_status', f.validation_status, 'retrieved_at', f.retrieved_at) order by f.attribute), '[]'::jsonb)
  into facts from spec_fact f join source src on src.id = f.source_id
  where f.variant_id = args->>'variant_id' and f.validation_status <> 'rejected';
  return jsonb_build_object('found', true, 'specs', r, 'facts', facts);
end $$;

create or replace function tool_get_price(args jsonb) returns jsonb language plpgsql stable as $$
declare cur jsonb; hist jsonb;
begin
  select jsonb_build_object('price_inr', s.price_inr, 'as_of', s.price_as_of) into cur
  from variant_specs s where s.variant_id = args->>'variant_id' and s.price_inr is not null and s.price_as_of is not null;
  select coalesce(jsonb_agg(jsonb_build_object('price_inr', h.price_inr, 'observed_at', h.observed_at, 'seller', h.seller) order by h.observed_at), '[]'::jsonb)
  into hist from price_history h where h.variant_id = args->>'variant_id';
  if cur is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'price_inr', cur->'price_inr', 'as_of', cur->'as_of', 'history', hist);
end $$;

-- Owner opinions by topic with counts after removing duplicate reviews. n counts distinct duplicate clusters, not rows.
create or replace function tool_evidence_summary(args jsonb) returns jsonb language plpgsql stable as $$
declare min_n int := coalesce((setting('MIN_EVIDENCE_N') #>> '{}')::int, 20); topics jsonb; total jsonb;
begin
  with base as (
    select e.topic, e.category, e.polarity, e.source_id, e.region, coalesce(r.dup_cluster_id::text, r.id) as unit
    from evidence_claim e join review r on r.id = e.review_id
    where e.variant_id = args->>'variant_id' and e.validation_status <> 'rejected' and e.topic <> 'other'
      and (nullif(args->>'topic','') is null or e.topic = args->>'topic')
      and (nullif(args->>'region','') is null or e.region = args->>'region')
  ), per as (
    select topic, count(distinct unit) as n,
      count(distinct unit) filter (where polarity = 'positive') as positive,
      count(distinct unit) filter (where polarity = 'negative') as negative,
      count(distinct unit) filter (where polarity in ('mixed','neutral','not_stated')) as other_polarity,
      array_agg(distinct source_id) as sources, array_agg(distinct region) as regions
    from base group by topic
  )
  select coalesce(jsonb_agg(jsonb_build_object('topic', topic, 'n', n, 'positive', positive, 'negative', negative,
      'other_polarity', other_polarity, 'enough', n >= min_n, 'sources', sources, 'regions', regions) order by n desc, topic), '[]'::jsonb)
  into topics from per;
  select jsonb_build_object('n', coalesce(sum((t->>'n')::int), 0), 'positive', coalesce(sum((t->>'positive')::int), 0),
      'negative', coalesce(sum((t->>'negative')::int), 0))
  into total from jsonb_array_elements(topics) t;
  return jsonb_build_object('min_n', min_n, 'topics', topics, 'total', total,
    'label', 'machine-read, not human-verified');
end $$;

-- Short quotes with their source. Only where the source allows quoting; trimmed to the word limit.
create or replace function tool_evidence_quotes(args jsonb) returns jsonb language plpgsql stable as $$
declare lim int := least(coalesce((args->>'limit')::int, 5), 20); maxw int := coalesce((setting('QUOTE_MAX_WORDS') #>> '{}')::int, 25); out jsonb;
begin
  select coalesce(jsonb_agg(x), '[]'::jsonb) into out from (
    select jsonb_build_object('claim_id', e.id, 'topic', e.topic, 'category', e.category, 'polarity', e.polarity,
        'quote', trim_words(e.quote, maxw), 'source_id', e.source_id, 'source', s.source_name, 'attribution', s.attribution_text,
        'region', e.region, 'machine_read', e.validation_status <> 'verified_by_human') as x
    from evidence_claim e join source s on s.id = e.source_id
    where e.variant_id = args->>'variant_id' and e.validation_status <> 'rejected' and quote_ok(e.source_id)
      and (nullif(args->>'topic','') is null or e.topic = args->>'topic')
      and (nullif(args->>'polarity','') is null or e.polarity = args->>'polarity')
      and (nullif(args->>'region','') is null or e.region = args->>'region')
    order by (e.strength = 'clear') desc, length(e.quote), e.id
    limit lim) q;
  return jsonb_build_object('quotes', out);
end $$;

-- Full-text search over reviews for one laptop. Returns ids and short snippets only where quoting is allowed.
create or replace function tool_search_reviews(args jsonb) returns jsonb language plpgsql stable as $$
declare lim int := least(coalesce((args->>'limit')::int, 5), 20); maxw int := coalesce((setting('QUOTE_MAX_WORDS') #>> '{}')::int, 25); out jsonb;
begin
  select coalesce(jsonb_agg(x), '[]'::jsonb) into out from (
    select jsonb_build_object('review_id', r.id, 'rating', r.rating, 'source_id', r.source_id,
        'snippet', case when quote_ok(r.source_id) then trim_words(r.original_text, maxw) else null end) as x
    from review r
    where r.flag is null and (nullif(args->>'variant_id','') is null or r.variant_id = args->>'variant_id')
      and r.fts @@ plainto_tsquery('simple', args->>'q')
    order by ts_rank(r.fts, plainto_tsquery('simple', args->>'q')) desc, r.id
    limit lim) q;
  return jsonb_build_object('results', out);
end $$;

-- A verdict exists only if a person approved it. Match by terms inside the claim; prefer the narrower scope.
create or replace function tool_lookup_claim_verdict(args jsonb) returns jsonb language plpgsql stable as $$
declare c text := lower(coalesce(args->>'claim_text', '')); scopes text[] := array(select jsonb_array_elements_text(coalesce(args->'scopes', '["general"]'::jsonb))); r record;
begin
  select l.id, l.claim_text, l.scope, l.verdict, l.sample_size, l.approver, l.approved_at,
         (select count(*) from unnest(l.match_terms) t where position(lower(t) in c) > 0) as hits,
         (l.scope <> 'general') as specific
  into r
  from claim_ledger l
  where l.status = 'approved' and l.approver is not null and l.verdict is not null
    and l.scope = any (scopes)
    and shown(true, l.is_sample)
    and exists (select 1 from unnest(l.match_terms) t where position(lower(t) in c) > 0)
  order by (select count(*) from unnest(l.match_terms) t where position(lower(t) in c) > 0) desc, (l.scope <> 'general') desc, l.id
  limit 1;
  if r.id is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'ledger_id', r.id, 'claim_text', r.claim_text, 'scope', r.scope, 'verdict', r.verdict,
    'sample_size', r.sample_size, 'approver', r.approver, 'approved_at', r.approved_at);
end $$;

create or replace function tool_log_event(args jsonb) returns jsonb language plpgsql volatile as $$
begin
  case args->>'kind'
    when 'query' then
      insert into query_log (request_id, flow, confidence, language, router_mode, duration_ms, outcome, text_len, settings_version, data_version)
      values (args->>'request_id', args->>'flow', nullif(args->>'confidence','')::numeric, args->>'language', args->>'router_mode',
              nullif(args->>'duration_ms','')::int, args->>'outcome', nullif(args->>'text_len','')::int, args->>'settings_version', args->>'data_version');
    when 'unhandled' then
      insert into unhandled_request (text_scrubbed, guessed_flow, reason) values (left(args->>'text', 2000), args->>'guessed_flow', args->>'reason');
    when 'gate' then
      insert into gate_log (request_id, variant_id, check_name, detail) values (args->>'request_id', args->>'variant_id', args->>'check_name', left(args->>'detail', 500));
    when 'demand' then
      insert into demand_signal (budget_band, use_cases, musts, matched) values (args->>'budget_band', coalesce(args->'use_cases','[]'::jsonb), coalesce(args->'musts','[]'::jsonb), (args->>'matched')::int);
    when 'view' then
      insert into view_event (variant_id, kind, session_hash) values (args->>'variant_id', coalesce(args->>'view_kind','view'), args->>'session_hash');
    else raise exception 'unknown log kind %', args->>'kind';
  end case;
  return jsonb_build_object('ok', true);
end $$;

-- Tools are for server code only: the browser's public key must not call them directly.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'tool\_%' loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;

-- All variants of one model (used when a seller's claim must be checked against every version).
create or replace function tool_model_variants(args jsonb) returns jsonb language sql stable as $$
  select jsonb_build_object('rows', coalesce(jsonb_agg(to_jsonb(s) order by s.variant_id), '[]'::jsonb))
  from variant_specs s where s.model_id = (args->>'model_id')::int and shown(s.verified, s.is_sample) $$;
revoke all on function tool_model_variants(jsonb) from public;
