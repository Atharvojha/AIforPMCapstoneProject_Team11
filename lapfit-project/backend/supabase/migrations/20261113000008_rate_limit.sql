-- Rate limiting: per-visitor burst and hourly limits, a "degrade" step before blocking, and a global daily cap on paid model calls.
create table rate_bucket (
  key text not null, window_start timestamptz not null, count int not null default 0,
  primary key (key, window_start)
);
alter table rate_bucket enable row level security;

insert into settings (key, value) values
 ('RATE_LIMITS', '{"per_minute": 10, "per_hour": 60, "soft_per_hour": 30, "global_daily_model": 1500, "body_max_chars": 20000}'),
 ('LIVE_DAILY_LIMIT', '30')   -- Tavily free plan is 1,000 credits a month, about 33 a day
on conflict (key) do update set value = excluded.value, version = settings.version + 1, updated_at = now();

-- Count one request against a window and return the new count and the seconds until the window ends.
create or replace function rate_hit(k text, window_seconds int) returns jsonb language plpgsql volatile as $$
declare ws timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds); c int;
begin
  insert into rate_bucket (key, window_start, count) values (k, ws, 1)
  on conflict (key, window_start) do update set count = rate_bucket.count + 1 returning count into c;
  return jsonb_build_object('count', c, 'retry_after', greatest(1, ceil(extract(epoch from (ws + make_interval(secs => window_seconds) - now())))::int));
end $$;

-- One round trip decides: allow, degrade (no model, no live search) or block.
-- Blocked requests are still counted, so hammering does not get cheaper.
create or replace function tool_rate_gate(args jsonb) returns jsonb language plpgsql volatile as $$
declare
  cfg jsonb := coalesce(setting('RATE_LIMITS'), '{}'::jsonb);
  v text := 'v:' || coalesce(nullif(args->>'visitor', ''), 'unknown');
  per_min int := coalesce((cfg->>'per_minute')::int, 10); per_hr int := coalesce((cfg->>'per_hour')::int, 60);
  soft int := coalesce((cfg->>'soft_per_hour')::int, 30); gcap int := coalesce((cfg->>'global_daily_model')::int, 1500);
  m jsonb; h jsonb; g jsonb;
begin
  m := rate_hit(v || ':m', 60); h := rate_hit(v || ':h', 3600);
  if random() < 0.01 then delete from rate_bucket where window_start < now() - interval '2 days'; end if;
  if (m->>'count')::int > per_min then
    return jsonb_build_object('action', 'block', 'reason', 'too_many_per_minute', 'retry_after', (m->>'retry_after')::int, 'minute', (m->>'count')::int, 'hour', (h->>'count')::int);
  end if;
  if (h->>'count')::int > per_hr then
    return jsonb_build_object('action', 'block', 'reason', 'too_many_per_hour', 'retry_after', (h->>'retry_after')::int, 'minute', (m->>'count')::int, 'hour', (h->>'count')::int);
  end if;
  if (h->>'count')::int > soft then
    return jsonb_build_object('action', 'degrade', 'reason', 'heavy_use', 'minute', (m->>'count')::int, 'hour', (h->>'count')::int);
  end if;
  g := rate_hit('g:model', 86400);
  if (g->>'count')::int > gcap then
    return jsonb_build_object('action', 'degrade', 'reason', 'daily_budget', 'minute', (m->>'count')::int, 'hour', (h->>'count')::int, 'global', (g->>'count')::int);
  end if;
  return jsonb_build_object('action', 'allow', 'minute', (m->>'count')::int, 'hour', (h->>'count')::int, 'global', (g->>'count')::int);
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'tool\_%' or p.proname = 'rate_hit') loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on rate_bucket from anon, authenticated; end if;
end $$;
