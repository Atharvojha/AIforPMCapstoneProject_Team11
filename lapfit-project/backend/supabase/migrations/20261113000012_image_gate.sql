-- Reading a photo costs far more than a text request, so it has its own, tighter limits.
insert into settings (key, value) values ('IMAGE_LIMITS', '{"per_hour": 6, "global_daily": 200, "max_bytes": 700000, "max_b64_chars": 950000}')
on conflict (key) do update set value = excluded.value, version = settings.version + 1, updated_at = now();

create or replace function tool_image_gate(args jsonb) returns jsonb language plpgsql volatile as $$
declare cfg jsonb := coalesce(setting('IMAGE_LIMITS'), '{}'::jsonb); v text := 'v:' || coalesce(nullif(args->>'visitor', ''), 'unknown');
  per_hr int := coalesce((cfg->>'per_hour')::int, 6); gcap int := coalesce((cfg->>'global_daily')::int, 200); h jsonb; g jsonb;
begin
  h := rate_hit(v || ':img', 3600);
  if (h->>'count')::int > per_hr then return jsonb_build_object('allowed', false, 'reason', 'too_many_photos', 'retry_after', (h->>'retry_after')::int); end if;
  g := rate_hit('g:img', 86400);
  if (g->>'count')::int > gcap then return jsonb_build_object('allowed', false, 'reason', 'daily_photo_budget', 'retry_after', 3600); end if;
  return jsonb_build_object('allowed', true);
end $$;
revoke all on function tool_image_gate(jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function tool_image_gate(jsonb) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function tool_image_gate(jsonb) to service_role; end if;
end $$;
