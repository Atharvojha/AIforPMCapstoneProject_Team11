update settings set value = value || '{"web_images": true}'::jsonb, version = version + 1, updated_at = now() where key = 'FEATURE_FLAGS';
