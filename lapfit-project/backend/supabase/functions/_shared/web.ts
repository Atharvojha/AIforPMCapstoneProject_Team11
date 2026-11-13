// WEB-WIDE CONTEXT for Market pulse and Brand insights: what the wider web says about the Indian laptop market or a brand.
// Same rules as live laptop reviews: only a fixed search phrase and a brand name leave this system, never the user's text; results are
// labelled live and unverified, kept apart from the dataset numbers, never counted, ranked or used by the gate, and every item carries
// a URL the search actually returned. Cached 24 h and counted against the same daily live limit.
import { sanitizeItems, type LiveItem, type LiveSource } from './live.ts';
import type { Deps } from './types.ts';

export interface WebResult { status: 'ok' | 'cached' | 'off' | 'limit' | 'error' | 'empty'; provider: string | null; fetched_at: string | null; items: LiveItem[]; note: string; scope: string; error?: string }

const MSG: Record<WebResult['status'], string> = {
  ok: 'From across the web, fetched just now. Not verified, and not part of the dataset numbers.',
  cached: 'From across the web, fetched earlier today. Not verified, and not part of the dataset numbers.',
  off: 'Web-wide context is not switched on in this version, so only the recorded dataset is shown.',
  limit: 'Web-wide context is paused for today to stay within the search budget. Only the recorded dataset is shown.',
  error: 'I could not reach the web just now, so only the recorded dataset is shown.',
  empty: 'The web search found nothing usable for this.',
};

export type WebScope = { kind: 'market' } | { kind: 'brand'; brand: string } | { kind: 'brands' };

const QUERIES = (s: WebScope): { key: string; query: string; news: boolean; need: string[] } => {
  if (s.kind === 'market') return { key: 'WEB:market', query: 'India laptop market this month: price changes, discounts, new launches, demand', news: true, need: [] };
  if (s.kind === 'brands') return { key: 'WEB:brands', query: 'which laptop brands are reliable in India after-sales service owner experience', news: false, need: [] };
  const b = s.brand.replace(/[^a-zA-Z0-9 ]+/g, ' ').trim().slice(0, 30);
  return { key: `WEB:brand:${b.toLowerCase()}`, query: `${b} laptops India reliability build quality after-sales service owner experience`, news: false, need: [b] };
};

export async function webInsight(deps: Deps, scope: WebScope): Promise<WebResult> {
  const { tools, settings } = deps; const source: LiveSource | null | undefined = deps.live; const q = QUERIES(scope); const label = scope.kind === 'brand' ? scope.brand : scope.kind;
  const res = (status: WebResult['status'], items: LiveItem[] = [], fetched_at: string | null = null, provider: string | null = source?.name ?? null): WebResult => ({ status, items, fetched_at, provider, note: MSG[status], scope: label });
  if (!source?.web || settings.FEATURE_FLAGS?.live_reviews === false || settings.FEATURE_FLAGS?.web_insights === false) return res('off');
  const maxItems = Number(settings.WEB_MAX_ITEMS ?? 5); const words = Number(settings.WEB_SNIPPET_WORDS ?? 32);
  try {
    const hit = await tools.call<any>('live_cache_get', { variant_id: q.key, topic: '' });
    if (hit.hit) return res(hit.items.length ? 'cached' : 'empty', sanitizeItems(hit.items, maxItems, words), hit.fetched_at, hit.provider);
    const slot = await tools.call<any>('live_reserve', { provider: source.name });
    if (!slot.allowed) return res('limit');
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), Number(settings.LIVE_TIMEOUT_MS ?? 9000));
    let got; try { got = await source.web({ query: q.query, news: q.news, need: q.need, signal: ctl.signal }); } finally { clearTimeout(timer); }
    const items = sanitizeItems(got.items, maxItems, words).map((i) => ({ ...i, topic: i.topic || 'market' }));
    await tools.call('live_cache_put', { variant_id: q.key, topic: '', provider: source.name, items, note: got.note ?? null });
    return res(items.length ? 'ok' : 'empty', items, new Date().toISOString());
  } catch (e) { const r = res('error'); r.error = String((e as Error)?.message ?? e).slice(0, 80); r.note = `${r.note} (${r.error})`; return r; }
}
