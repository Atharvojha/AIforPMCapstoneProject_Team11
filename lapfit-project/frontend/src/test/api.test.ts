import { describe, it, expect, vi } from 'vitest';
import { sendQuery, readConfig } from '../lib/api';
import { fx, okResponse, cfg } from './helpers';

const res = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const call = (impl: () => Promise<Response> | Response, opts: any = {}) => sendQuery(cfg, { text: 'x' }, { fetchImpl: (async () => impl()) as any, ...opts });

describe('api client', () => {
  it('sends the public key in both headers and posts JSON to the query function', async () => {
    const f = vi.fn(async () => okResponse(fx('help')));
    await sendQuery(cfg, { text: 'hi' }, { fetchImpl: f as any });
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('https://example.supabase.co/functions/v1/query'); expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer public-anon'); expect(init.headers.apikey).toBe('public-anon'); expect(JSON.parse(init.body)).toEqual({ text: 'hi' });
  });
  it('returns the reply on success', async () => { const r = await call(() => okResponse(fx('shortlist'))); expect(r.ok).toBe(true); if (r.ok) expect(r.reply.flow).toBe('shortlist'); });
  it('429 carries the wait time from Retry-After', async () => {
    const r = await call(() => res(429, { ok: false, message: 'Slow down' }, { 'retry-after': '17' })); expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.kind).toBe('rate_limited'); if (r.error.kind === 'rate_limited') expect(r.error.retryAfter).toBe(17); }
  });
  it('429 falls back to the body then to 30 seconds', async () => {
    const a = await call(() => res(429, { retry_after: 9 })); if (!a.ok && a.error.kind === 'rate_limited') expect(a.error.retryAfter).toBe(9);
    const b = await call(() => res(429, {})); if (!b.ok && b.error.kind === 'rate_limited') expect(b.error.retryAfter).toBe(30);
  });
  it.each([[413, 'too_large'], [401, 'auth'], [403, 'auth'], [400, 'bad_request'], [500, 'server'], [502, 'server']])('HTTP %i becomes %s', async (status, kind) => {
    const r = await call(() => res(status, { ok: false, message: 'm' })); expect(r.ok).toBe(false); if (!r.ok) expect(r.error.kind).toBe(kind);
  });
  it('an HTML or empty error page does not crash', async () => { const r = await call(() => new Response('<html>bad gateway</html>', { status: 502 })); expect(!r.ok && r.error.kind).toBe('server'); });
  it('a 200 with the wrong shape is treated as a server error, never shown', async () => { const r = await call(() => res(200, { hello: 'world' })); expect(!r.ok && r.error.kind).toBe('server'); });
  it('a network failure is a plain "no connection" message', async () => { const r = await call(() => { throw new TypeError('Failed to fetch'); }); expect(!r.ok && r.error.kind).toBe('network'); });
  it('times out and says so', async () => {
    const hang = (_u: any, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    const r = await sendQuery(cfg, {}, { fetchImpl: hang as any, timeoutMs: 20 }); expect(!r.ok && r.error.kind).toBe('timeout');
  });
  it('caller abort is reported as aborted, not as an error', async () => {
    const c = new AbortController(); const hang = (_u: any, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    const p = sendQuery(cfg, {}, { fetchImpl: hang as any, signal: c.signal }); c.abort(); const r = await p; expect(!r.ok && r.error.kind).toBe('aborted');
  });
  it('readConfig needs both values and trims a trailing slash', () => {
    expect(readConfig({})).toBeNull(); expect(readConfig({ VITE_SUPABASE_URL: 'https://a.b' })).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: 'https://a.b/', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'https://a.b', key: 'k' });
  });
});
