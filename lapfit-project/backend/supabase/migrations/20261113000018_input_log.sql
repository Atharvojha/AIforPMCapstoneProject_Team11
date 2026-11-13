-- INPUT LOG: everything a person types or taps, kept apart from query_log (which stays scrubbed and short).
-- It is written by the edge function BEFORE rate limiting and size checks, so blocked and oversized requests are recorded too.
-- Pictures are never stored (only that one was sent). Visitor is the daily salted hash, never an address.
-- LOG_INPUTS = {"enabled": true, "raw": true}: raw=false scrubs phone numbers, emails and links before storing; enabled=false stops it.
create table input_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  request_id text, visitor text, kind text not null,
  text_input text,                -- what was typed in the free text box (also pasted listings, pitches, voice transcripts)
  payload jsonb,                  -- every other input: form choices, budget, tiles, Sell answers, owner report fields, laptop ids
  raw_len int, scrubbed boolean not null default false
);
create index input_log_ts on input_log (ts desc); create index input_log_request on input_log (request_id);
alter table input_log enable row level security;

insert into settings (key, value) values ('LOG_INPUTS', '{"enabled": true, "raw": true}'::jsonb), ('LOG_INPUT_RETENTION_DAYS', '30'::jsonb) on conflict (key) do nothing;

create or replace function scrub_text(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(coalesce(t,''), 'https?://\S+|www\.\S+', '[link]', 'gi'), '[[:alnum:]._+-]+@[[:alnum:]-]+\.[[:alnum:].]+', '[email]', 'g'), '(\+?91[ -]?)?\m[6-9][0-9]{9}\M', '[phone]', 'g') $$;

create or replace function tool_log_input(args jsonb) returns jsonb language plpgsql volatile as $$
declare cfg jsonb := coalesce(setting('LOG_INPUTS'), '{}'::jsonb); keep boolean := coalesce((cfg->>'enabled')::boolean, true); rawmode boolean := coalesce((cfg->>'raw')::boolean, true);
  t text := left(args->>'text', 5000); p jsonb := args->'payload';
begin
  if not keep then return jsonb_build_object('ok', true, 'stored', false); end if;
  if not rawmode then
    t := scrub_text(t);
    if p is not null then begin p := scrub_text(p::text)::jsonb; exception when others then p := jsonb_build_object('scrubbed', true); end; end if;
  end if;
  insert into input_log (request_id, visitor, kind, text_input, payload, raw_len, scrubbed)
  values (args->>'request_id', left(args->>'visitor', 40), left(coalesce(args->>'kind', 'unknown'), 60), nullif(t, ''), p, nullif(args->>'raw_len', '')::int, not rawmode);
  return jsonb_build_object('ok', true, 'stored', true);
end $$;

-- old rows go after their own retention (default 30 days)
create or replace function purge_logs() returns jsonb language plpgsql volatile as $$
declare days int := coalesce((setting('LOG_RETENTION_DAYS') #>> '{}')::int, 30); idays int := coalesce((setting('LOG_INPUT_RETENTION_DAYS') #>> '{}')::int, 30); a int; b int; c int; d int;
begin
  delete from query_log where ts < now() - make_interval(days => days); get diagnostics a = row_count;
  delete from gate_log where ts < now() - make_interval(days => days); get diagnostics b = row_count;
  delete from unhandled_request where ts < now() - make_interval(days => days); get diagnostics c = row_count;
  delete from input_log where ts < now() - make_interval(days => idays); get diagnostics d = row_count;
  return jsonb_build_object('query_log', a, 'gate_log', b, 'unhandled_request', c, 'input_log', d, 'older_than_days', days, 'input_older_than_days', idays);
end $$;

revoke all on input_log from public; revoke all on function tool_log_input(jsonb), scrub_text(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on input_log from anon, authenticated; revoke all on function tool_log_input(jsonb), scrub_text(text) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function tool_log_input(jsonb), purge_logs() to service_role; end if;
end $$;
