// LIVE REVIEWS: what the web says now, fetched on demand, cached, and kept apart from the dataset numbers.
// Rules: only the laptop name and a topic leave this system (never the user's text); results are labelled live, unverified and
// never counted in n, ranked, or used by the gate; every item must carry a URL the search actually returned.
import { findInjections, scrub, words } from './util.ts';
import type { Tools } from './tools.ts';
import type { Settings } from './types.ts';

export interface LiveItem { snippet: string; url: string; site: string; topic: string; kind: 'web_summary' | 'excerpt'; published?: string | null }
export interface LiveFetch { items: LiveItem[]; note?: string }
export interface WebQuery { query: string; news?: boolean; anyTime?: boolean; need?: string[]; signal?: AbortSignal }
export interface LiveSource { readonly name: string; fetch(q: { laptop: string; topic?: string; signal?: AbortSignal }): Promise<LiveFetch>; web?(q: WebQuery): Promise<LiveFetch> }
export interface LiveResult { status: 'ok' | 'cached' | 'off' | 'limit' | 'error' | 'empty'; provider: string | null; fetched_at: string | null; items: LiveItem[]; note: string; error?: string }

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
  web(q: WebQuery) { return tavilyWeb(this.o, q); }
  async fetch(q: { laptop: string; topic?: string; signal?: AbortSignal }): Promise<LiveFetch> {
    const PHRASE: Record<string, string> = { design: 'design looks build', longevity: 'long term durability after 1 2 years', problems: 'common problems issues', upgrade: 'RAM SSD upgrade slots', performance: 'performance' };
    const query = `${q.laptop} owner review ${q.topic ? (PHRASE[q.topic] ?? q.topic) : 'problems'} experience`;
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
      // for lifespan, problems and upgrade questions a maker's own website is advertising, not evidence
      if (['longevity', 'problems', 'upgrade'].includes(q.topic ?? '') && host.split('.').includes(String(q.laptop).toLowerCase().split(/\s+/)[0])) continue;
      items.push({ snippet: String(r.content ?? '').replace(/\s+/g, ' ').trim(), url: String(r.url), site: host, topic: '', kind: 'excerpt', published: r.published_date ?? null });
    }
    return { items, note: 'Excerpts from web search results; open the link to read the original.' };
  }
}

/** Sites used for market news: established Indian business and gadget press, plus a few global tech sites. Social media, forums of unknown quality and shops are not on it. */
export const MARKET_SITES = ['livemint.com', 'economictimes.indiatimes.com', 'business-standard.com', 'moneycontrol.com', 'financialexpress.com', 'thehindubusinessline.com', 'hindustantimes.com', 'timesofindia.indiatimes.com', 'indianexpress.com', 'gadgets360.com', 'digit.in', '91mobiles.com', 'smartprix.com', 'techradar.com', 'notebookcheck.net', 'tomshardware.com', 'counterpointresearch.com', 'idc.com', 'canalys.com'];
const NOT_SOURCES = ['facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'pinterest.com', 'x.com', 'twitter.com', 'tavily.com', 'linkedin.com'];
const INDIA = /india|₹|\brs\.?\s?\d|\binr\b|flipkart|amazon\.in|croma|reliance digital|diwali|festive/;
const OWNER_WORDS = /owner|review|reliab|service|support|build|issue|problem|experience|warranty|durab|after-sales|complain/;
const BOILERPLATE = /subscribe|newsletter|\beditions?\b.*\bmagazine|cookie|as is\b.*subject to change|content that appears on this site|affiliate commission|we may earn|sign in|log in/i;
const isoDate = (d: unknown) => { const t = d ? new Date(String(d)) : null; return t && !isNaN(+t) ? t.toISOString().slice(0, 10) : null; };

/** Market and brand search across the web (not about one laptop). Used by Market pulse and Brand insights. */
export async function tavilyWeb(o: { apiKey: string; baseUrl?: string; country?: string | null }, q: WebQuery): Promise<LiveFetch> {
  const res = await fetch(`${o.baseUrl ?? 'https://api.tavily.com'}/search`, {
    method: 'POST', signal: q.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${o.apiKey}` },
    body: JSON.stringify({ query: q.query, search_depth: 'basic', max_results: q.news ? 10 : 12, topic: q.news ? 'news' : 'general', include_answer: false, include_raw_content: false,
      ...(q.news ? { time_range: 'month', include_domains: MARKET_SITES } : { ...(q.anyTime ? {} : { time_range: 'year' }), exclude_domains: NOT_SOURCES, ...(o.country && !q.anyTime ? { country: o.country } : {}) }) }),
  });
  if (!res.ok) throw new Error(`tavily_http_${res.status}`);
  const data: any = await res.json(); const items: LiveItem[] = []; const need = (q.need ?? []).map((w) => w.toLowerCase());
  for (const r of data.results ?? []) {
    let host = ''; try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (NOT_SOURCES.some((d) => host === d || host.endsWith('.' + d))) continue;
    if (need.some((w) => host.includes(w.replace(/\s+/g, '')))) continue;                              // a brand's own website is advertising, not evidence
    const text = `${r.title ?? ''} ${r.content ?? ''}`.toLowerCase();
    if (!/laptop|notebook|\bpcs?\b/.test(text)) continue;                                              // must be about laptops
    if (q.news && !INDIA.test(text)) continue;                                                          // market news must be about India
    if (need.length && !need.some((w) => text.includes(w))) continue;                                   // must name the brand when one was asked about
    if (need.length && !OWNER_WORDS.test(text)) continue;                                               // and talk about experience, not specs or deals
    if ((String(r.content ?? '').match(/\[\d{1,2}:\d{2}/g) ?? []).length >= 3) continue;
    if (BOILERPLATE.test(String(r.content ?? '').slice(0, 160))) continue;                                 // page menus and shop disclaimers are not content
    items.push({ snippet: String(r.content ?? '').replace(/\s+/g, ' ').trim(), url: String(r.url), site: host, topic: '', kind: 'excerpt', published: isoDate(r.published_date) });
  }
  return { items, note: 'Excerpts from web search results; open the link to read the original.' };
}

/** Test and demo source: items come from a function. */
export class FakeLive implements LiveSource {
  readonly name = 'fake-live'; calls: { laptop: string; topic?: string }[] = []; webCalls: WebQuery[] = [];
  constructor(private fn: (q: { laptop: string; topic?: string }) => LiveFetch | Promise<LiveFetch>, private webFn?: (q: WebQuery) => LiveFetch | Promise<LiveFetch>) {}
  async web(q: WebQuery) { this.webCalls.push(q); if (!this.webFn) throw new Error('no_web'); return this.webFn(q); }
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
  } catch (e) { const r = res('error'); r.error = String((e as Error)?.message ?? e).slice(0, 80); r.note = `${r.note} (${r.error})`; return r; }
}
