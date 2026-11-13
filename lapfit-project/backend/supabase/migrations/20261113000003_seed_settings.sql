-- One place for every threshold (decision D-11). Versioned; each answer records the version.
insert into settings (key, value) values
 ('data_mode', '"course"'),
 ('MIN_EVIDENCE_N', '20'),
 ('ROUTER_CONFIDENCE_MIN', '0.6'),
 ('MODEL_TIMEOUT_MS', '8000'),
 ('REASONS_TIMEOUT_MS', '2000'),
 ('SHORTLIST_FIRST', '3'),
 ('SHORTLIST_MAX', '5'),
 ('QUOTE_MAX_WORDS', '25'),
 ('WEIGHTS', '{"should":3,"nice":1,"price_headroom":0.5,"evidence":0.5}'),
 ('BUDGET_LIMITS', '{"min":5000,"max":1000000}'),
 ('MAX_REASON_WORDS', '40'),
 ('MODEL_ENABLED', 'true'),
 ('FEATURE_FLAGS', '{"shortlist":true,"second_opinion":true,"check_pitch":true,"used_check":true}'),
 ('BATTERY', '{"note_below":80,"check_below":70}'),
 ('USED_PRICE_BAND', '{"low":0.30,"high":0.75,"source":"sample"}'),
 ('WEIGHT_TOLERANCE_KG', '0.05'),
 ('LIGHT_WEIGHT_KG', '1.5')
on conflict (key) do nothing;
