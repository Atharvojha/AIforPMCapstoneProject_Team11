-- What data the product actually holds and how fresh it is, kept in one setting so every answer can say so honestly.
create or replace function refresh_data_status() returns jsonb language plpgsql volatile as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'prices_as_of', (select max(retrieved_at)::text from spec_fact where attribute = 'price_inr'),
    'laptops_with_price', (select count(distinct variant_id) from spec_fact where attribute = 'price_inr'),
    'variants', (select count(*) from variant),
    'verified_variants', (select count(*) from variant where verified),
    'reviews', (select count(*) from review),
    'reviews_with_dates', (select count(*) from review where review_date is not null),
    'opinions', (select count(*) from evidence_claim),
    'review_sources', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'region', region, 'reviews', n, 'quotable', q) order by id)
                                 from (select s.id, s.region, count(r.id) n, s.quote_allowed q from source s join review r on r.source_id = s.id group by s.id, s.region, s.quote_allowed) x), '[]'::jsonb),
    'refreshed_at', now()::text) into v;
  insert into settings (key, value) values ('DATA_STATUS', v)
  on conflict (key) do update set value = excluded.value, version = settings.version + 1, updated_at = now();
  return v;
end $$;
select refresh_data_status();
revoke all on function refresh_data_status() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function refresh_data_status() from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function refresh_data_status() to service_role; end if;
end $$;
