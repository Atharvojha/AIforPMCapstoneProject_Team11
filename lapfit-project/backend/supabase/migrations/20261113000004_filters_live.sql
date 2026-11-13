-- More filterable attributes, brand exclusion, and the live-reviews cache and budget.

-- Extra derived columns appended to the wide view (appended last so create or replace works).
create or replace view variant_specs as
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
  v.verified, v.is_sample,
  case when m.brand ilike 'apple' then 'macos' else 'windows' end as os_family,
  case when spec_text(v.id,'gpu') is null then null
       when spec_text(v.id,'gpu') ~* 'nvidia|geforce|rtx|gtx|radeon rx|arc a' then 'dedicated' else 'integrated' end as gpu_class
from variant v
join laptop_model m on m.id = v.model_id
left join variant_curation c on c.variant_id = v.id;

insert into filter_attribute (key, label, unit, kind, default_operator, column_ref, allowed_values) values
 ('brand','Brand',null,'enum','in','brand',null),
 ('cpu_vendor','Processor maker',null,'enum','in','cpu_vendor','["intel","amd","apple"]'),
 ('os_family','Operating system',null,'enum','in','os_family','["windows","macos"]'),
 ('gpu_class','Graphics',null,'enum','in','gpu_class','["dedicated","integrated"]'),
 ('battery_wh','Battery','Wh','number','>=','battery_wh',null),
 ('refresh_hz','Refresh rate','Hz','number','>=','refresh_hz',null)
on conflict (key) do nothing;

-- find_variants again, now with: enum "not_in" (exclusion), enum compare case-insensitive, null never matches.
create or replace function tool_find_variants(args jsonb) returns jsonb language plpgsql stable as $$
declare
  crit jsonb; sql text; a record; op text; rows jsonb; unknown jsonb := '{}'::jsonb; cnt int;
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
      if op = 'not_in' then
        sql := sql || format(' and s.%I is not null and lower(s.%I) <> all (array(select lower(x) from jsonb_array_elements_text(%L::jsonb) x))', a.column_ref, a.column_ref, (crit->'value')::text);
      elsif op = 'in' or op is null then
        sql := sql || format(' and lower(s.%I) = any (array(select lower(x) from jsonb_array_elements_text(%L::jsonb) x))', a.column_ref, (crit->'value')::text);
      else raise exception 'operator not allowed: %', op; end if;
    else
      sql := sql || format(' and exists (select 1 from jsonb_array_elements_text(s.%I) c where lower(c) = any (array(select lower(x) from jsonb_array_elements_text(%L::jsonb) x)))', a.column_ref, (crit->'value')::text);
    end if;
    execute format('select count(*) from variant_specs s where s.recommendable and shown(s.verified, s.is_sample) and s.%I is null', a.column_ref) into cnt;
    unknown := unknown || jsonb_build_object(a.key, cnt);
  end loop;
  execute sql into rows;
  return jsonb_build_object('rows', rows, 'total', jsonb_array_length(rows), 'unknown_values', unknown);
end $$;

-- ---------- live reviews: cache and daily budget ----------
create table live_review_cache (
  id bigint generated always as identity primary key,
  variant_id text not null, topic text not null default '', provider text not null,
  fetched_at timestamptz not null default now(), items jsonb not null default '[]'::jsonb, note text
);
create index live_review_cache_key on live_review_cache (variant_id, topic, fetched_at desc);
create table live_usage (day date not null, provider text not null, calls int not null default 0, primary key (day, provider));
alter table live_review_cache enable row level security;
alter table live_usage enable row level security;

create or replace function tool_live_cache_get(args jsonb) returns jsonb language plpgsql stable as $$
declare ttl int := coalesce((setting('LIVE_TTL_HOURS') #>> '{}')::int, 24); r record;
begin
  select * into r from live_review_cache where variant_id = args->>'variant_id' and topic = coalesce(args->>'topic','')
    and fetched_at > now() - make_interval(hours => ttl) order by fetched_at desc limit 1;
  if not found then return jsonb_build_object('hit', false); end if;
  return jsonb_build_object('hit', true, 'fetched_at', r.fetched_at, 'items', r.items, 'provider', r.provider, 'note', r.note);
end $$;

create or replace function tool_live_cache_put(args jsonb) returns jsonb language plpgsql volatile as $$
begin
  insert into live_review_cache (variant_id, topic, provider, items, note)
  values (args->>'variant_id', coalesce(args->>'topic',''), args->>'provider', coalesce(args->'items','[]'::jsonb), args->>'note');
  return jsonb_build_object('ok', true);
end $$;

-- Reserve one live call against today's limit. Returns allowed=false when the limit is reached.
create or replace function tool_live_reserve(args jsonb) returns jsonb language plpgsql volatile as $$
declare lim int := coalesce((setting('LIVE_DAILY_LIMIT') #>> '{}')::int, 50); used int;
begin
  insert into live_usage (day, provider, calls) values (current_date, args->>'provider', 0) on conflict do nothing;
  select calls into used from live_usage where day = current_date and provider = args->>'provider' for update;
  if used >= lim then return jsonb_build_object('allowed', false, 'used', used, 'limit', lim); end if;
  update live_usage set calls = calls + 1 where day = current_date and provider = args->>'provider';
  return jsonb_build_object('allowed', true, 'used', used + 1, 'limit', lim);
end $$;

insert into settings (key, value) values ('LIVE_TTL_HOURS','24'), ('LIVE_DAILY_LIMIT','50'), ('LIVE_MAX_ITEMS','4'), ('LIVE_TIMEOUT_MS','9000')
on conflict (key) do nothing;

-- grants for the new tools (same rule as the others)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'tool\_live%' loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;
