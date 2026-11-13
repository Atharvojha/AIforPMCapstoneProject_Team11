-- WEB CATALOG: a second, clearly labelled tier of laptops read from web pages (not verified), kept apart from the 14 catalog laptops.
-- Every row came from a page the search returned; the numbers were checked against that page's text by code before they got here.
-- Rows are merged by a normalised name key: a known value is never overwritten by null; the price follows the newest page.
create table web_laptop (
  id bigint generated always as identity primary key,
  key text not null unique,
  name text not null, brand text,
  price_inr int check (price_inr is null or price_inr > 0), price_as_of timestamptz,
  ram_gb int, storage_gb int, display_size numeric, weight_kg numeric, battery_wh numeric, cpu text, gpu text,
  source_url text not null check (source_url ~ '^https://'), site text,
  snippet text check (snippet is null or char_length(snippet) <= 400), query text,
  first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
  hits int not null default 1, rejected boolean not null default false
);
alter table web_laptop enable row level security;
create index web_laptop_brand on web_laptop (lower(brand));
create index web_laptop_price on web_laptop (price_inr);

-- Merge a list of validated items: {items:[{key,name,brand,price_inr,ram_gb,storage_gb,display_size,weight_kg,battery_wh,cpu,gpu,source_url,site,snippet}], query}
create or replace function tool_web_catalog_upsert(args jsonb) returns jsonb language plpgsql volatile as $$
declare it jsonb; k text; n_new int := 0; n_upd int := 0; fresh boolean; q text := left(args->>'query', 120);
begin
  for it in select * from jsonb_array_elements(case when jsonb_typeof(args->'items') = 'array' then args->'items' else '[]'::jsonb end) loop
    k := left(regexp_replace(lower(coalesce(it->>'key', '')), '\s+', ' ', 'g'), 120);
    if k = '' or coalesce(it->>'name', '') = '' or coalesce(it->>'source_url', '') !~ '^https://' then continue; end if;
    insert into web_laptop as w (key, name, brand, price_inr, price_as_of, ram_gb, storage_gb, display_size, weight_kg, battery_wh, cpu, gpu, source_url, site, snippet, query)
    values (k, left(it->>'name', 100), nullif(left(it->>'brand', 40), ''), nullif(it->>'price_inr', '')::int, case when it->>'price_inr' is not null then now() end,
      nullif(it->>'ram_gb', '')::int, nullif(it->>'storage_gb', '')::int, nullif(it->>'display_size', '')::numeric, nullif(it->>'weight_kg', '')::numeric, nullif(it->>'battery_wh', '')::numeric,
      nullif(left(it->>'cpu', 60), ''), nullif(left(it->>'gpu', 60), ''), it->>'source_url', left(it->>'site', 80), left(it->>'snippet', 400), q)
    on conflict (key) do update set
      brand = coalesce(w.brand, excluded.brand),
      price_inr = coalesce(excluded.price_inr, w.price_inr),
      price_as_of = case when excluded.price_inr is not null then now() else w.price_as_of end,
      ram_gb = coalesce(w.ram_gb, excluded.ram_gb), storage_gb = coalesce(w.storage_gb, excluded.storage_gb),
      display_size = coalesce(w.display_size, excluded.display_size), weight_kg = coalesce(w.weight_kg, excluded.weight_kg),
      battery_wh = coalesce(w.battery_wh, excluded.battery_wh), cpu = coalesce(w.cpu, excluded.cpu), gpu = coalesce(w.gpu, excluded.gpu),
      source_url = case when excluded.price_inr is not null then excluded.source_url else w.source_url end,
      site = case when excluded.price_inr is not null then excluded.site else w.site end,
      snippet = coalesce(w.snippet, excluded.snippet), query = coalesce(w.query, excluded.query),
      hits = w.hits + 1, last_seen = now()
    returning (xmax = 0) into fresh;
    if fresh then n_new := n_new + 1; else n_upd := n_upd + 1; end if;
  end loop;
  return jsonb_build_object('new', n_new, 'updated', n_upd, 'total', (select count(*) from web_laptop where not rejected));
end $$;

-- Filtered, paged list. Budget filters keep only rows with a price; rows without a price show only when no budget was given.
create or replace function tool_web_catalog_list(args jsonb default '{}') returns jsonb language plpgsql stable as $$
declare b text := nullif(btrim(coalesce(args->>'brand', '')), ''); q text := nullif(btrim(coalesce(args->>'q', '')), '');
  bmin numeric := nullif(args->>'budget_min', '')::numeric; bmax numeric := nullif(args->>'budget_max', '')::numeric;
  lim int := least(60, greatest(1, coalesce(nullif(args->>'limit', '')::int, 24))); off int := greatest(0, coalesce(nullif(args->>'offset', '')::int, 0));
begin
  return (with f as (
    select * from web_laptop w where not w.rejected
      and (b is null or lower(w.brand) = lower(b))
      and (q is null or not exists (select 1 from regexp_split_to_table(q, '\s+') t where t <> '' and w.name not ilike '%' || regexp_replace(t, '[%_\\]', '', 'g') || '%'))
      and ((bmin is null and bmax is null) or (w.price_inr is not null and (bmin is null or w.price_inr >= bmin) and (bmax is null or w.price_inr <= bmax)))
  ), page as (select * from f order by hits desc, last_seen desc, id limit lim offset off)
  select jsonb_build_object('total', (select count(*) from f), 'rows', coalesce((select jsonb_agg(to_jsonb(p) - 'id' - 'rejected' - 'query' order by p.hits desc, p.last_seen desc, p.id) from page p), '[]'::jsonb)));
end $$;

revoke all on web_laptop from public; revoke all on function tool_web_catalog_upsert(jsonb), tool_web_catalog_list(jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on web_laptop from anon, authenticated; revoke all on function tool_web_catalog_upsert(jsonb), tool_web_catalog_list(jsonb) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function tool_web_catalog_upsert(jsonb), tool_web_catalog_list(jsonb) to service_role; end if;
end $$;
