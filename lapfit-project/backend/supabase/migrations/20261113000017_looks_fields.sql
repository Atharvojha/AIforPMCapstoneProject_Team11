-- The catalog list also carries the numbers the "look" visuals need (screen, weight, battery, refresh rate, graphics type), so the app can show where a laptop sits among all of them.
create or replace function tool_list_names(args jsonb default '{}') returns jsonb language sql stable as $$
  select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object('variant_id', s.variant_id, 'model_id', s.model_id, 'display_name', s.display_name,
    'brand', s.brand, 'price_inr', s.price_inr, 'ram_gb', s.ram_gb, 'storage_gb', s.storage_gb, 'recommendable', s.recommendable,
    'display_size', s.display_size, 'weight_kg', s.weight_kg, 'battery_wh', s.battery_wh, 'refresh_hz', s.refresh_hz, 'gpu_class', s.gpu_class,
    'text', norm_text(s.brand || ' ' || s.display_name || ' ' || v.aliases_text))), '[]'::jsonb))
  from variant_specs s join variant v on v.id = s.variant_id where shown(s.verified, s.is_sample) $$;
revoke all on function tool_list_names(jsonb) from public;
