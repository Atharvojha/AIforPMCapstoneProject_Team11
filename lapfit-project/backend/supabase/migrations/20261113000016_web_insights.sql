update settings set value = value || '{"web_insights": true}'::jsonb, version = version + 1, updated_at = now() where key = 'FEATURE_FLAGS';
insert into settings (key, value) values ('WEB_MAX_ITEMS','5'), ('WEB_SNIPPET_WORDS','32') on conflict (key) do nothing;
