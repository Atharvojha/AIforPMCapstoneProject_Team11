// LIVE REVIEWS: what the web says now, fetched on demand, cached, and kept apart from the dataset numbers.
// Rules: only the laptop name and a topic leave this system (never the user's text); results are labelled live, unverified and
// never counted in n, ranked, or used by the gate; every item must carry a URL the search actually returned.
import { findInjections, scrub, words } from './util.ts';
import type { Tools } from './tools.ts';
import type { Settings } from './types.ts';

export interface LiveItem { snippet: string; url: string; site: string; topic: string; kind: 'web_summary' | 'excerpt'; published?: string | null }
export interface LiveFetch { items: LiveItem[]; note?: string }
export interface LiveSource { readonly name: string; fetch(q: { laptop: string; topic?: string; signal?: AbortSignal }): Promise<LiveFetch> }
export interface LiveResult { status: 'ok' | 'cached' | 'off' | 'limit' | 'error' | 'empty'; provider: string | null; fetched_at: string | null; items: LiveItem[]; note: string }

const TOPIC_OF: [RegExp, string][] = [[/battery|charge|backup|hours/i, 'battery'], [/hot|heat|thermal|fan|noise|loud/i, 'heat_noise'], [/keyboard|typing|keys|trackpad/i, 'keyboard'], [/screen|display|bright|panel|colou?r/i, 'display'], [/lag|slow|fast|smooth|speed|performance|hang|gaming/i, 'performance'], [/hinge|build|plastic|sturdy|crack|flex/i, 'build'], [/service|support|warranty|repair/i, 'service']];
export const topicOf = (t: string) => TOPIC_OF.find(([re]) => re.test(t))?.[1] ?? 'general';

/** Clean whatever a source returned. Anything that looks like an instruction, or has no usable URL, is dropped. */
export function sanitizeItems(items: LiveItem[], maxItems: number, maxWords = 25): LiveItem[] {
  const seen = new Set<string>(); const out: LiveItem[] = [];
  for (const it of items ?? []) {
    if (!it || typeof it.snippet !== 'string' || typeof it.url !== 'string') continue;
    if (!/^https:\/\//i.test(it.url)) continue;
    const snippet = scrub(it.snippet).replace(/#{1,6}\s*/g, '').replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '').replace(/[*_`]{1,3}/g, '').replace(/^[\s…\-–:]+/, '').replace(/\s+/g, ' ').trim();
    if (!snippet || findInjections(snippet).length) continue;
    const trimmed = words(snippet) > maxWords ? snippet.split(/\s+/).slice(0, maxWords).join(' ') + '…' : snippet;
    if (seen.has(it.url + trimmed)) continue; seen.add(it.url + trimmed);
    out.push({ snippet: trimmed, url: it.url, site: String(it.site ?? '').slice(0, 80), topic: it.topic || topicOf(trimmed), kind: it.kind === 'excerpt' ? 'excerpt' : 'web_summary', published: it.published ?? null });
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Google Search grounding through Gemini. NOT TESTED AGAINST THE LIVE API (no key here).
 * Shape follows the documented generateContent grounding response: groundingMetadata.groundingChunks[].web{uri,title} and
 * groundingSupports[].segment.text with groundingChunkIndices. Billed per search query on Gemini 3 models (about $14 per 1,000
 * after a monthly free allowance, per Google's pricing page when checked on 13 Nov 2026).
 * Grounding cannot be combined with forced JSON on some models, so this asks for plain bullets and uses the support segments.
 */
export class GeminiGroundedSource implements LiveSource {
  readonly name = 'gemini-google-search';
  constructor(private o: { apiKey: string; model?: string; baseUrl?: string }) {}
  async fetch(q: { laptop: string; topic?: string; signal?: AbortSignal }): Promise<LiveFetch> {
    const model = this.o.model ?? 'gemini-3.1-flash-lite'; const base = this.o.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    const prompt = `Find recent owner reviews and discussions (forums, review sites, video comments; last 12 months, India where possible) about the laptop "${q.laptop}"` +
      `${q.topic ? ` focusing on ${q.topic}` : ''}. Write at most 5 plain bullet lines. Each line is one thing real owners report, about one topic ` +
      `(battery, heat, keyboard, display, performance, build, service). Report only what the pages say. No advice, no recommendation, no marketing language.`;
    const res = await fetch(`${base}/models/${model}:generateContent`, {
      method: 'POST', signal: q.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': this.o.apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 700 } }),
    });
    if (!res.ok) throw new Error(`live_http_${res.status}`);
    const data: any = await res.json(); const cand = data.candidates?.[0]; const gm = cand?.groundingMetadata;
    const chunks: { uri?: string; title?: string }[] = (gm?.groundingChunks ?? []).map((c: any) => c.web ?? {});
    const items: LiveItem[] = [];
    for (const s of gm?.groundingSupports ?? []) {
      const text = s?.segment?.text; const idx = (s?.groundingChunkIndices ?? [])[0]; const c = chunks[idx];
      if (text && c?.uri) items.push({ snippet: String(text).replace(/^[\s*•\-]+/, ''), url: c.uri, site: c.title ?? '', topic: '', kind: 'web_summary' });
    }
    return { items, note: 'Summaries written from Google Search results; open the link to read the original.' };
  }
}

/**
 * Tavily web search. Returns real page snippets with their URLs (not model-written summaries), 1 credit per basic search
 * (Tavily docs, checked 13 Nov 2026). Only the laptop name and topic are sent. Results must actually mention the laptop.
 */
export class TavilySource implements LiveSource {
  readonly name = 'tavily';
  constructor(private o: { apiKey: string; baseUrl?: string; country?: string | null }) {}
  async fetch(q: { laptop: string; topic?: string; signal?: AbortSignal }): Promise<LiveFetch> {
    const query = `${q.laptop} owner review ${q.topic && q.topic !== 'design' ? q.topic : q.topic === 'design' ? 'design looks build' : 'problems'} experience`;
    const res = await fetch(`${this.o.baseUrl ?? 'https://api.tavily.com'}/search`, {
      method: 'POST', signal: q.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${this.o.apiKey}` },
      body: JSON.stringify({ query, search_depth: 'basic', max_results: 8, topic: 'general', include_answer: false, include_raw_content: false, ...(this.o.country ? { country: this.o.country } : {}) }),
    });
    if (!res.ok) throw new Error(`tavily_http_${res.status}`);
    const data: any = await res.json();
    const need = String(q.laptop).toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !['gen', 'core', 'the', 'and', 'with'].includes(w)).slice(0, 4);
    const items: LiveItem[] = [];
    for (const r of data.results ?? []) {
      const text = `${r.title ?? ''} ${r.content ?? ''}`.toLowerCase();
      if (need.filter((w) => text.includes(w)).length < Math.min(2, need.length)) continue;       // off-topic result
      if ((String(r.content ?? '').match(/\[\d{1,2}:\d{2}/g) ?? []).length >= 3) continue;      // video chapter lists are not reviews
      let host = ''; try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
      items.push({ snippet: String(r.content ?? '').replace(/\s+/g, ' ').trim(), url: String(r.url), site: host, topic: '', kind: 'excerpt', published: r.published_date ?? null });
    }
    return { items, note: 'Excerpts from web search results; open the link to read the original.' };
  }
}

/** Test and demo source: items come from a function. */
export class FakeLive implements LiveSource {
  readonly name = 'fake-live'; calls: { laptop: string; topic?: string }[] = [];
  constructor(private fn: (q: { laptop: string; topic?: string }) => LiveFetch | Promise<LiveFetch>) {}
  async fetch(q: { laptop: string; topic?: string }) { this.calls.push({ laptop: q.laptop, topic: q.topic }); return this.fn(q); }
}

const MSG: Record<LiveResult['status'], string> = {
  ok: 'Live web results, fetched just now. Not verified, and not counted in the owner numbers above.',
  cached: 'Live web results fetched earlier today. Not verified, and not counted in the owner numbers above.',
  off: 'Live reviews are not switched on in this version, so I am showing only the recorded dataset.',
  limit: 'Live reviews are paused for today to stay within the search budget. The recorded dataset is shown instead.',
  error: 'I could not reach live sources just now, so I am showing only the recorded dataset.',
  empty: 'The live search found nothing usable for this laptop.',
};

export async function liveReviews(o: { tools: Tools; source: LiveSource | null; settings: Settings; variantId: string; laptop: string; topic?: string }): Promise<LiveResult> {
  const { tools, source, settings, variantId, laptop } = o; const topic = o.topic ?? '';
  const res = (status: LiveResult['status'], items: LiveItem[] = [], fetched_at: string | null = null, provider: string | null = source?.name ?? null): LiveResult => ({ status, items, fetched_at, provider, note: MSG[status] });
  if (!source || settings.FEATURE_FLAGS?.live_reviews === false) return res('off');
  const maxItems = Number(settings.LIVE_MAX_ITEMS ?? 4); const snipWords = Number(settings.LIVE_SNIPPET_WORDS ?? 25);
  try {
    const hit = await tools.call<any>('live_cache_get', { variant_id: variantId, topic });
    if (hit.hit) return res(hit.items.length ? 'cached' : 'empty', sanitizeItems(hit.items, maxItems, snipWords), hit.fetched_at, hit.provider);
    const slot = await tools.call<any>('live_reserve', { provider: source.name });
    if (!slot.allowed) return res('limit');
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), Number(settings.LIVE_TIMEOUT_MS ?? 9000));
    let got: LiveFetch;
    try { got = await source.fetch({ laptop, topic: topic || undefined, signal: ctl.signal }); } finally { clearTimeout(timer); }
    const items = sanitizeItems(got.items, maxItems, snipWords);
    await tools.call('live_cache_put', { variant_id: variantId, topic, provider: source.name, items, note: got.note ?? null });
    return res(items.length ? 'ok' : 'empty', items, new Date().toISOString());
  } catch (e) { const r = res('error'); r.note = `${r.note} (${String((e as Error)?.message ?? e).slice(0, 80)})`; return r; }
}
