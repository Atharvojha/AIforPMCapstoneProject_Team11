-- Measured on the real Gemini API (13 Nov 2026): the router takes 3 to 6 seconds, so each model attempt gets 4 seconds, then the fallback model, then the rules reader.
insert into settings (key, value) values ('ROUTER_TIMEOUT_MS', '8000'), ('WRITER_TIMEOUT_MS', '3500'), ('LIVE_SNIPPET_WORDS', '25')
on conflict (key) do update set value = excluded.value, version = settings.version + 1, updated_at = now();
