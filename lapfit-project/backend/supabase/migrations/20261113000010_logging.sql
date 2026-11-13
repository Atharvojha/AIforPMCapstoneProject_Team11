-- Request logging: what was asked (scrubbed), what happened at each stage, and exactly where it failed.
-- Typed text is stored only after phone numbers, emails, ID numbers and links are removed, only if LOG_QUERY_TEXT is true,
-- and is deleted after LOG_RETENTION_DAYS. Switch the text off with: update settings set value = 'false' where key = 'LOG_QUERY_TEXT'.

alter table query_log
  add column if not exists visitor text,            -- salted daily hash, never an address
  add column if not exists input_kind text,         -- text | needs | action:<name> | owned | experience | client
  add column if not exists status int,              -- HTTP status the caller got
  add column if not exists error_stage text,        -- where a hard failure happened: wrapper | clean | router | action:x | flow:x | reasons | gate
  add column if not exists error_message text,
  add column if not exists text_scrubbed text,
  add column if not exists timings jsonb,           -- router_ms, flow_ms, reasons_ms, gate_ms, total_ms
  add column if not exists blocks text[],           -- block types in the reply
  add column if not exists detail jsonb;            -- failures[], model_attempts[], live[], reasons_mode, flow_corrected, matched, degraded...
create index if not exists query_log_ts on query_log (ts desc);
create index if not exists query_log_request on query_log (request_id);
create index if not exists query_log_outcome on query_log (outcome, ts desc);

insert into settings (key, value) values ('LOG_QUERY_TEXT', 'true'), ('LOG_RETENTION_DAYS', '30') on conflict (key) do nothing;

-- Deletes old rows. Runs now and then on its own (1 in 100 log writes); can also be called by hand.
create or replace function purge_logs() returns jsonb language plpgsql volatile as $$
declare days int := coalesce((setting('LOG_RETENTION_DAYS') #>> '{}')::int, 30); a int; b int; c int;
begin
  delete from query_log where ts < now() - make_interval(days => days); get diagnostics a = row_count;
  delete from gate_log where ts < now() - make_interval(days => days); get diagnostics b = row_count;
  delete from unhandled_request where ts < now() - make_interval(days => days); get diagnostics c = row_count;
  return jsonb_build_object('query_log', a, 'gate_log', b, 'unhandled_request', c, 'older_than_days', days);
end $$;

create or replace function tool_log_event(args jsonb) returns jsonb language plpgsql volatile as $$
declare keep_text boolean := coalesce((setting('LOG_QUERY_TEXT') #>> '{}')::boolean, true);
begin
  case args->>'kind'
    when 'query' then
      insert into query_log (request_id, flow, confidence, language, router_mode, duration_ms, outcome, text_len, settings_version, data_version,
                             visitor, input_kind, status, error_stage, error_message, text_scrubbed, timings, blocks, detail)
      values (args->>'request_id', args->>'flow', nullif(args->>'confidence','')::numeric, args->>'language', args->>'router_mode',
              nullif(args->>'duration_ms','')::int, args->>'outcome', nullif(args->>'text_len','')::int, args->>'settings_version', args->>'data_version',
              left(args->>'visitor', 40), left(args->>'input_kind', 60), nullif(args->>'status','')::int, left(args->>'error_stage', 60), left(args->>'error_message', 300),
              case when keep_text then left(args->>'text_scrubbed', 300) end, args->'timings',
              case when jsonb_typeof(args->'blocks') = 'array' then array(select jsonb_array_elements_text(args->'blocks')) end, args->'detail');
    when 'client' then
      -- a failure only the browser can see (network down, timeout, a crashed screen)
      if (args->>'what') <> all (array['network','timeout','server','auth','bad_request','too_large','ui_crash']) then raise exception 'unknown client event %', args->>'what'; end if;
      insert into query_log (request_id, input_kind, outcome, error_stage, error_message, visitor, status, detail)
      values (left(args->>'request_id', 40), 'client', 'client_' || (args->>'what'), left(coalesce(args->>'screen', 'unknown'), 40), left(args->>'message', 300), left(args->>'visitor', 40),
              nullif(args->>'status','')::int, jsonb_build_object('action', left(args->>'action', 40)));
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
  if random() < 0.01 then perform purge_logs(); end if;
  return jsonb_build_object('ok', true);
end $$;

-- A request that hit the limit is logged once, at the first request over the limit (not on every hammering request).
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
    if (m->>'count')::int = per_min + 1 then
      insert into query_log (input_kind, outcome, status, visitor, error_stage, error_message, detail)
      values ('limit', 'rate_limited', 429, left(args->>'visitor', 40), 'rate_gate', 'per_minute limit of ' || per_min, jsonb_build_object('minute', (m->>'count')::int, 'hour', (h->>'count')::int));
    end if;
    return jsonb_build_object('action', 'block', 'reason', 'too_many_per_minute', 'retry_after', (m->>'retry_after')::int, 'minute', (m->>'count')::int, 'hour', (h->>'count')::int);
  end if;
  if (h->>'count')::int > per_hr then
    if (h->>'count')::int = per_hr + 1 then
      insert into query_log (input_kind, outcome, status, visitor, error_stage, error_message, detail)
      values ('limit', 'rate_limited', 429, left(args->>'visitor', 40), 'rate_gate', 'per_hour limit of ' || per_hr, jsonb_build_object('minute', (m->>'count')::int, 'hour', (h->>'count')::int));
    end if;
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

-- Views for reading the log. They hold (scrubbed) typed text, so they are server-only.
create or replace view v_failures as
select ts, request_id, flow, outcome, error_stage, error_message, router_mode, duration_ms, status, input_kind, text_scrubbed,
       detail->'failures' as failures, detail->'model_attempts' as model_attempts
from query_log
where outcome not in ('ok', 'no_match', 'clarify', 'empty', 'not_laptop', 'out_of_scope', 'abusive', 'distressed')
   or router_mode = 'fallback' or jsonb_array_length(coalesce(detail->'failures', '[]'::jsonb)) > 0
order by ts desc;

create or replace view v_daily_summary as
select date_trunc('day', ts)::date as day, coalesce(flow, input_kind, '-') as flow, outcome, count(*) as requests,
       round(avg(duration_ms)) as avg_ms, percentile_cont(0.5) within group (order by duration_ms) as p50_ms, percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
       count(*) filter (where router_mode = 'fallback') as router_fallbacks
from query_log group by 1, 2, 3 order by 1 desc, 4 desc;

create or replace view v_stage_failures as
select f->>'stage' as stage, f->>'kind' as kind, count(*) as times, max(ts) as last_seen, min(f->>'message') as example
from query_log, jsonb_array_elements(coalesce(detail->'failures', '[]'::jsonb)) f group by 1, 2 order by 3 desc;

-- Nothing here is for the public keys. New objects in this schema no longer get public grants by default.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated;
    revoke all on v_failures, v_daily_summary, v_stage_failures from anon, authenticated;
    revoke all on query_log from anon, authenticated;
    revoke all on function purge_logs() from anon, authenticated;
  end if;
  revoke all on function purge_logs() from public;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function purge_logs() to service_role; end if;
end $$;
