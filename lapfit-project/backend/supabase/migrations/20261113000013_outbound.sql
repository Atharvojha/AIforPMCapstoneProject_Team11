-- "Where to buy": links to shops, optionally affiliate links, and a click count. Links never influence what is shown or in what order.
insert into settings (key, value) values
 ('RETAILERS', '[
   {"id":"amazon_in","name":"Amazon.in","search":"https://www.amazon.in/s?k={q}","tag_param":"tag","tag":""},
   {"id":"flipkart","name":"Flipkart","search":"https://www.flipkart.com/search?q={q}","tag_param":"affid","tag":""},
   {"id":"croma","name":"Croma","search":"https://www.croma.com/searchB?q={q}%3Arelevance","tag_param":null,"tag":""}
 ]'),
 ('AFFILIATE_DISCLOSURE', '"Links marked Affiliate link may earn LapFit a small commission if you buy, at no extra cost to you. Commission never changes which laptops are shown or in what order."')
on conflict (key) do nothing;

create table outbound_click (
  id bigint generated always as identity primary key, ts timestamptz not null default now(),
  variant_id text, retailer text not null, affiliate boolean not null default false, visitor text, from_flow text
);
create index outbound_click_ts on outbound_click (ts desc);
alter table outbound_click enable row level security;

create or replace function tool_log_click(args jsonb) returns jsonb language plpgsql volatile as $$
begin
  insert into outbound_click (variant_id, retailer, affiliate, visitor, from_flow)
  values (left(args->>'variant_id', 40), left(args->>'retailer', 40), coalesce((args->>'affiliate')::boolean, false), left(args->>'visitor', 40), left(args->>'from_flow', 40));
  return jsonb_build_object('ok', true);
end $$;

create or replace view v_clicks_daily as
select date_trunc('day', ts)::date as day, retailer, affiliate, count(*) as clicks, count(distinct variant_id) as laptops, count(distinct visitor) as visitors
from outbound_click group by 1, 2, 3 order by 1 desc, 4 desc;
create or replace view v_clicks_by_laptop as
select o.variant_id, v.display_name, o.retailer, o.affiliate, count(*) as clicks
from outbound_click o left join variant v on v.id = o.variant_id group by 1, 2, 3, 4 order by 5 desc;

do $$ begin
  revoke all on function tool_log_click(jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function tool_log_click(jsonb) from anon, authenticated; revoke all on outbound_click, v_clicks_daily, v_clicks_by_laptop from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function tool_log_click(jsonb) to service_role; end if;
end $$;
