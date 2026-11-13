-- The code and the settings table had drifted apart (found while documenting). One name per setting, every setting the code reads exists here.
delete from settings where key in ('MODEL_TIMEOUT_MS', 'REASONS_TIMEOUT_MS', 'MAX_REASON_WORDS', 'LIGHT_WEIGHT_KG', 'MODEL_ENABLED', 'BUDGET_LIMITS');
insert into settings (key, value) values
 ('REASON_MAX_WORDS', '25'),
 ('LIGHT_KG', '1.5'),
 ('LIVE_PER_QUERY', '2'),
 ('MAX_ALTERNATIVES', '2'),
 ('FEATURE_FLAGS', '{"router_enabled":true,"model_enabled":true,"reasons_enabled":true,"live_reviews":true,"submissions_open":true}'),
 ('RESALE', '{"age":{"0":0.85,"1":0.72,"2":0.6,"3":0.5,"4":0.42,"5":0.35,"6":0.28},"condition":{"excellent":1,"good":0.92,"fair":0.8,"poor":0.6},"battery":{"below_80":0.93,"below_70":0.88},"cracked_screen":0.75,"spread_known":0.12,"spread_unknown":0.22,"fix_cost":{"battery":3500},"source":"sample assumptions, not real sales"}')
on conflict (key) do update set value = excluded.value, version = settings.version + 1, updated_at = now();
