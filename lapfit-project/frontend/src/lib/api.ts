import type { ApiResult } from './types';

export interface ApiConfig { url: string; key: string; /** the Supabase region to run the function in; set to '' to let Supabase choose */ region?: string }
/** Most users are in India: running the function in Mumbai took about 0.4 s per call against about 0.8 s on the default route (measured 14 Nov 2026). */
export const DEFAULT_REGION = 'ap-south-1';
export function readConfig(env: Record<string, string | undefined> = import.meta.env as any): ApiConfig | null {
  const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''); const key = env.VITE_SUPABASE_ANON_KEY ?? '';
  return url && key ? { url, key } : null;
}

/** One call to the backend. Never throws: every failure becomes a plain, typed error the screen can show. */
export async function sendQuery(cfg: ApiConfig, body: Record<string, unknown>, opts: { signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<ApiResult> {
  const f = opts.fetchImpl ?? fetch; const ctl = new AbortController();
  const isImage = body.action === 'read_image';   // pictures are a bigger body and a slower model call
  const timer = setTimeout(() => ctl.abort('timeout'), opts.timeoutMs ?? (isImage ? 70000 : 40000));
  const onAbort = () => ctl.abort('aborted'); opts.signal?.addEventListener('abort', onAbort);
  try {
    const region = cfg.region ?? ((import.meta as any).env?.MODE === 'production' ? DEFAULT_REGION : '');
    const call = (withRegion: boolean) => f(`${cfg.url}/functions/v1/query`, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}`, apikey: cfg.key, ...(isImage ? { 'x-lapfit-image': '1' } : {}), ...(withRegion && region ? { 'x-region': region } : {}) }, body: JSON.stringify(body) });
    // if the pinned region cannot be reached, try once more on the default route so a regional problem never takes the app down
    let res: Response; try { res = await call(true); if (region && res.status >= 500 && !ctl.signal.aborted) res = await call(false); } catch (err) { if (!region || ctl.signal.aborted) throw err; res = await call(false); }
    let data: any = null; try { data = await res.json(); } catch { /* not json */ }
    if (res.ok && data?.ok && Array.isArray(data.blocks)) return { ok: true, reply: data };
    if (res.status === 429) { const ra = Number(res.headers.get('retry-after') ?? data?.retry_after ?? 30) || 30; return { ok: false, error: { kind: 'rate_limited', retryAfter: ra, message: data?.message ?? `Too many requests. Please wait ${ra} seconds.` } }; }
    if (res.status === 413) return { ok: false, error: { kind: 'too_large', message: data?.message ?? 'That message is too large. Please shorten it.' } };
    if (res.status === 401 || res.status === 403) return { ok: false, error: { kind: 'auth', message: 'The app could not authenticate with the server. Check the public key in the app settings.' } };
    if (res.status === 400) return { ok: false, error: { kind: 'bad_request', message: data?.message ?? 'The request could not be read.' } };
    return { ok: false, error: { kind: 'server', message: data?.message ?? 'Something went wrong on the server. Please try again.' } };
  } catch (e) {
    if (opts.signal?.aborted) return { ok: false, error: { kind: 'aborted', message: 'Cancelled.' } };
    if (ctl.signal.aborted) return { ok: false, error: { kind: 'timeout', message: 'This is taking too long. Please try again.' } };
    return { ok: false, error: { kind: 'network', message: 'No connection to the server. Check your internet and try again.' } };
  } finally { clearTimeout(timer); opts.signal?.removeEventListener('abort', onAbort); }
}
