-- Tools for: term mentions (looks lens), brand stats, trending, owner reports (F06).

-- Distinct owners (duplicate clusters collapsed) who used any of the fixed terms. Terms are letters and spaces only.
create or replace function tool_term_mentions(args jsonb) returns jsonb language plpgsql stable as $$
declare pat text; minr int := coalesce((args->>'min_rating')::int, 0); out jsonb; t text;
begin
  for t in select jsonb_array_elements_text(args->'terms') loop
    if t !~ '^[a-z ]{2,30}$' then raise exception 'bad term %', t; end if;
  end loop;
  select '\y(' || string_agg(x, '|') || ')\y' into pat from jsonb_array_elements_text(args->'terms') x;
  select coalesce(jsonb_agg(jsonb_build_object('variant_id', variant_id, 'n', n, 'of', total) order by n desc), '[]'::jsonb) into out
  from (
    select r.variant_id,
      count(distinct coalesce(r.dup_cluster_id::text, r.id)) filter (where r.original_text ~* pat and coalesce(r.rating, 0) >= minr) as n,
      count(distinct coalesce(r.dup_cluster_id::text, r.id)) as total
    from review r join variant v on v.id = r.variant_id
    where shown(v.verified, v.is_sample) and (nullif(args->>'variant_id','') is null or r.variant_id = args->>'variant_id')
    group by r.variant_id
  ) q;
  return jsonb_build_object('rows', out, 'label', 'keyword match in review text, not human-verified');
end $$;

create or replace function tool_brand_stats(args jsonb) returns jsonb language plpgsql stable as $$
declare out jsonb;
begin
  with b as (
    select s.brand, count(*) variants, min(s.price_inr) min_price, max(s.price_inr) max_price, round(avg(s.ram_gb)) avg_ram, array_agg(s.variant_id) vids
    from variant_specs s where s.recommendable and shown(s.verified, s.is_sample)
      and (nullif(args->>'brand','') is null or lower(s.brand) = lower(args->>'brand')) group by s.brand
  ), e as (
    select b.brand,
      count(distinct coalesce(r.dup_cluster_id::text, r.id)) filter (where ec.topic <> 'other') n,
      count(distinct coalesce(r.dup_cluster_id::text, r.id)) filter (where ec.topic <> 'other' and ec.polarity = 'positive') positive,
      count(distinct coalesce(r.dup_cluster_id::text, r.id)) filter (where ec.topic <> 'other' and ec.polarity = 'negative') negative
    from b join evidence_claim ec on ec.variant_id = any (b.vids) and ec.validation_status <> 'rejected'
      join review r on r.id = ec.review_id group by b.brand
  ), neg as (
    select b.brand, ec.topic, count(distinct coalesce(r.dup_cluster_id::text, r.id)) n,
      row_number() over (partition by b.brand order by count(distinct coalesce(r.dup_cluster_id::text, r.id)) desc) rk
    from b join evidence_claim ec on ec.variant_id = any (b.vids) and ec.polarity = 'negative' and ec.topic <> 'other' and ec.validation_status <> 'rejected'
      join review r on r.id = ec.review_id group by b.brand, ec.topic
  )
  select coalesce(jsonb_agg(jsonb_build_object('brand', b.brand, 'laptops', b.variants, 'min_price', b.min_price, 'max_price', b.max_price,
    'avg_ram', b.avg_ram, 'n', coalesce(e.n,0), 'positive', coalesce(e.positive,0), 'negative', coalesce(e.negative,0),
    'top_complaints', coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'n', n) order by n desc) from neg where neg.brand = b.brand and rk <= 3), '[]'::jsonb))
    order by b.brand), '[]'::jsonb) into out
  from b left join e on e.brand = b.brand;
  return jsonb_build_object('brands', out, 'min_n', coalesce((setting('MIN_EVIDENCE_N') #>> '{}')::int, 20), 'label', 'machine-read, not human-verified');
end $$;

create or replace function tool_trending(args jsonb) returns jsonb language plpgsql stable as $$
declare days int := coalesce((args->>'days')::int, 30); needs jsonb; views jsonb; drops jsonb; samples int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('budget_band', budget_band, 'requests', c) order by c desc), '[]'::jsonb) into needs
    from (select budget_band, count(*) c from demand_signal where ts > now() - make_interval(days => days) group by 1) q;
  select coalesce(jsonb_agg(jsonb_build_object('variant_id', variant_id, 'name', name, 'views', c) order by c desc), '[]'::jsonb) into views
    from (select e.variant_id, v.display_name name, count(*) c from view_event e join variant v on v.id = e.variant_id
          where e.ts > now() - make_interval(days => days) group by 1, 2 order by c desc limit 5) q;
  select coalesce(jsonb_agg(jsonb_build_object('variant_id', variant_id, 'name', name, 'from_inr', first_p, 'to_inr', last_p, 'from_date', d1, 'to_date', d2)), '[]'::jsonb) into drops
    from (select p.variant_id, v.display_name name,
            (array_agg(p.price_inr order by p.observed_at asc))[1] first_p, (array_agg(p.price_inr order by p.observed_at desc))[1] last_p,
            min(p.observed_at) d1, max(p.observed_at) d2
          from price_history p join variant v on v.id = p.variant_id group by 1, 2 having count(*) >= 2) q where last_p < first_p;
  select count(*) into samples from demand_signal where is_sample;
  return jsonb_build_object('days', days, 'requests_by_budget', needs, 'most_viewed', views, 'price_drops', drops,
    'total_requests', (select count(*) from demand_signal where ts > now() - make_interval(days => days)));
end $$;

-- ---------- owner reports (F06): nothing is visible until a named reviewer approves ----------
create table owner_report (
  id bigint generated always as identity primary key,
  receipt_hash text not null unique, variant_id text not null references variant(id),
  months_owned int check (months_owned between 0 and 120), persona text, topic text, rating int check (rating between 1 and 5),
  note text not null check (length(note) between 10 and 800), session_hash text, flags jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by text, reject_reason text, created_at timestamptz not null default now(), decided_at timestamptz,
  constraint decided_needs_reviewer check (status = 'pending' or reviewed_by is not null)
);
alter table owner_report enable row level security;

create or replace function tool_report_submit(args jsonb) returns jsonb language plpgsql volatile as $$
declare lim int := coalesce((setting('SUBMIT_RATE_PER_HOUR') #>> '{}')::int, 5); recent int; code text;
begin
  if coalesce((setting('FEATURE_FLAGS') ->> 'submissions_open')::boolean, true) = false then
    return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  select count(*) into recent from owner_report where session_hash = args->>'session_hash' and created_at > now() - interval '1 hour';
  if recent >= lim then return jsonb_build_object('ok', false, 'reason', 'rate_limit'); end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  insert into owner_report (receipt_hash, variant_id, months_owned, persona, topic, rating, note, session_hash, flags)
  values (md5(code), args->>'variant_id', nullif(args->>'months_owned','')::int, args->>'persona', args->>'topic',
          nullif(args->>'rating','')::int, args->>'note', args->>'session_hash', coalesce(args->'flags','[]'::jsonb));
  return jsonb_build_object('ok', true, 'receipt', code);
end $$;

create or replace function tool_report_status(args jsonb) returns jsonb language sql stable as $$
  select coalesce((select jsonb_build_object('found', true, 'status', status, 'reject_reason', reject_reason) from owner_report where receipt_hash = md5(upper(args->>'receipt'))),
                  jsonb_build_object('found', false)) $$;

create or replace function tool_report_delete(args jsonb) returns jsonb language plpgsql volatile as $$
declare n int;
begin delete from owner_report where receipt_hash = md5(upper(args->>'receipt')); get diagnostics n = row_count;
  return jsonb_build_object('deleted', n > 0); end $$;

create or replace function tool_report_decide(args jsonb) returns jsonb language plpgsql volatile as $$
begin
  if not exists (select 1 from reviewer where name = args->>'reviewer' and coalesce(active, true)) then raise exception 'not a named reviewer'; end if;
  update owner_report set status = args->>'decision', reviewed_by = args->>'reviewer', reject_reason = args->>'reason', decided_at = now()
  where id = (args->>'id')::bigint;
  return jsonb_build_object('ok', true);
end $$;

create or replace function tool_owner_reports(args jsonb) returns jsonb language sql stable as $$
  select jsonb_build_object('n', count(*), 'rows', coalesce(jsonb_agg(jsonb_build_object('topic', topic, 'persona', persona, 'months_owned', months_owned,
    'rating', rating, 'note', note) order by decided_at desc) filter (where true), '[]'::jsonb), 'label', 'owner-reported, reviewed by a person, not verified')
  from owner_report where status = 'approved' and variant_id = args->>'variant_id'
    and (nullif(args->>'persona','') is null or persona = args->>'persona') and (nullif(args->>'topic','') is null or topic = args->>'topic') $$;

insert into settings (key, value) values ('SUBMIT_RATE_PER_HOUR','5'), ('LOOKS_MIN_RATING','4') on conflict (key) do nothing;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname ~ '^tool_(term_|brand_|trending|report_|owner_)' loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;

-- All visible laptop names, for typo-tolerant matching in code.
create or replace function tool_list_names(args jsonb default '{}') returns jsonb language sql stable as $$
  select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object('variant_id', s.variant_id, 'model_id', s.model_id, 'display_name', s.display_name,
    'brand', s.brand, 'price_inr', s.price_inr, 'ram_gb', s.ram_gb, 'storage_gb', s.storage_gb, 'recommendable', s.recommendable,
    'text', norm_text(s.brand || ' ' || s.display_name || ' ' || v.aliases_text))), '[]'::jsonb))
  from variant_specs s join variant v on v.id = s.variant_id where shown(s.verified, s.is_sample) $$;
revoke all on function tool_list_names(jsonb) from public;
