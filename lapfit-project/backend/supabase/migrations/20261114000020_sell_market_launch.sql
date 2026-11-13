-- Catalog rows carry the market ('IN' or 'US') and the processor text, from which code derives the launch year (null when not known, never invented).
-- Sample resale factors for the sell plan flags are documented in settings.RESALE.flags (SAMPLE assumptions, code defaults apply when a key is missing).
create or replace function tool_list_names(args jsonb default '{}') returns jsonb language sql stable as $$
  select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object('variant_id', s.variant_id, 'model_id', s.model_id, 'display_name', s.display_name,
    'brand', s.brand, 'price_inr', s.price_inr, 'ram_gb', s.ram_gb, 'storage_gb', s.storage_gb, 'recommendable', s.recommendable,
    'display_size', s.display_size, 'image_url', s.image_url, 'image_site', s.image_site, 'image_page', s.image_page, 'weight_kg', s.weight_kg, 'battery_wh', s.battery_wh, 'refresh_hz', s.refresh_hz, 'gpu_class', s.gpu_class,
    'market', s.market, 'cpu_text', s.cpu_text,
    'text', norm_text(s.brand || ' ' || s.display_name || ' ' || v.aliases_text))), '[]'::jsonb))
  from variant_specs s join variant v on v.id = s.variant_id where shown(s.verified, s.is_sample) $$;
revoke all on function tool_list_names(jsonb) from public;

update settings set value = value || '{"flags":{
  "cracked_screen":{"label":"Cracked screen","factor":0.75},
  "dead_pixels":{"label":"Dead pixels on the screen","factor":0.9},
  "keys_missing":{"label":"Missing or broken keys","factor":0.95},
  "hinge_loose":{"label":"Loose or cracked hinge","factor":0.9},
  "battery_replaced":{"label":"Battery replaced (new battery)","factor":1.04},
  "battery_swollen":{"label":"Swollen battery","factor":0.7},
  "water_damage":{"label":"Water or liquid damage","factor":0.65},
  "scratches_dents":{"label":"Scratches or dents on the body","factor":0.95},
  "no_charger":{"label":"Original charger missing","factor":0.93},
  "has_box":{"label":"Original box available","factor":1.02},
  "has_bill":{"label":"Original bill available","factor":1.03},
  "warranty_left":{"label":"Warranty still left","factor":1.05},
  "ssd_upgraded":{"label":"SSD upgraded","factor":1.02},
  "ram_upgraded":{"label":"RAM upgraded","factor":1.02},
  "repaired":{"label":"Repaired before (board or part)","factor":0.95},
  "need_fast":{"label":"You need to sell fast","factor":0.92,"spread_add":0.06}}}'::jsonb
where key = 'RESALE';
