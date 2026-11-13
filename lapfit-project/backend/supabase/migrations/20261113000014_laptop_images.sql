-- Laptop pictures: catalog data with provenance. They are web images found for each model (licence not verified), shown with attribution,
-- never used for any fact, and switchable off with FEATURE_FLAGS.web_images = false. Replace with licensed images before launch.
create table laptop_image (
  id bigint generated always as identity primary key,
  variant_id text not null references variant(id) on delete cascade,
  url text not null check (url ~ '^https://'), page_url text, site text, description text,
  source text not null default 'tavily', licence_status text not null default 'unverified_web',
  rejected boolean not null default false, position int not null default 0, fetched_at timestamptz not null default now(),
  unique (variant_id, url)
);
alter table laptop_image enable row level security;
create index laptop_image_variant on laptop_image (variant_id, position);

-- The wide row again, with the first usable picture appended as the last columns.
create or replace view variant_specs as
select v.id as variant_id, v.model_id, m.brand, m.marketing_name, v.display_name, v.catalogue_set, v.market,
  v.recommendable, v.availability, v.review_count,
  spec_num(v.id,'ram_gb')::int as ram_gb, spec_num(v.id,'storage_gb')::int as storage_gb,
  spec_num(v.id,'display_size_in') as display_size, spec_num(v.id,'weight_kg') as weight_kg,
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
       when spec_text(v.id,'gpu') ~* 'nvidia|geforce|rtx|gtx|radeon rx|arc a' then 'dedicated' else 'integrated' end as gpu_class,
  img.url as image_url, img.site as image_site, img.page_url as image_page, img.description as image_desc
from variant v
join laptop_model m on m.id = v.model_id
left join variant_curation c on c.variant_id = v.id
left join lateral (select url, site, page_url, description from laptop_image i where i.variant_id = v.id and not i.rejected order by i.position, i.id limit 1) img on true;

revoke all on laptop_image from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on laptop_image from anon, authenticated; revoke all on variant_specs from anon, authenticated; end if;
end $$;
