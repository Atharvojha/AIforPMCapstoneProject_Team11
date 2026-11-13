-- The model chain is now Gemini, Gemini, then Claude (own 6.5 s slot): the router's total budget grows from 8 s to 13 s so a slow Gemini does not use up the time Claude needs.
update settings set value = '13000'::jsonb, version = version + 1, updated_at = now() where key = 'ROUTER_TIMEOUT_MS';
