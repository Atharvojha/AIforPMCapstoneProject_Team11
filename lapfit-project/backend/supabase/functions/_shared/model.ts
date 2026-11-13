// The only file that talks to a language model. Edge Functions only: the key never reaches the browser.
export interface ModelRequest { system: string; user: string; maxTokens?: number; temperature?: number; signal?: AbortSignal; image?: { media_type: string; data: string } | null; /** time limit for each model attempt, when it needs more than the default (photos) */ attemptMs?: number }
export interface ModelAttempt { model: string; ok: boolean; ms: number; error?: string }
export interface ModelClient { readonly name: string; generate(req: ModelRequest): Promise<string>; /** Attempts made since the last call, then cleared. Used for the request log. */ drain?(): ModelAttempt[] }
export class NoModelKey extends Error { constructor() { super('no_model_key'); } }

export function extractJson(text: string): any {
  const t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no_json');
  return JSON.parse(t.slice(a, b + 1));
}

export interface GeminiOptions { apiKey?: string; model?: string; style?: 'interactions' | 'generateContent'; apiRevision?: string; baseUrl?: string }

/**
 * Gemini client. NOT YET TESTED AGAINST THE LIVE API (no key was available when this was written).
 * Google's current docs show the Interactions API (POST /v1beta/interactions, header Api-Revision, fields
 * system_instruction, input, generation_config, response_format). The older generateContent shape is kept as a switch.
 * Newer Gemini models may ignore temperature, so nothing here relies on it: replies are validated in code.
 */
export class GeminiClient implements ModelClient {
  readonly name: string; private o: Required<Omit<GeminiOptions, 'apiKey'>> & { apiKey: string };
  constructor(opts: GeminiOptions) {
    if (!opts.apiKey) throw new NoModelKey();
    this.o = { apiKey: opts.apiKey, model: opts.model ?? 'gemini-3.1-flash-lite', style: opts.style ?? 'generateContent', apiRevision: opts.apiRevision ?? '2026-05-20', baseUrl: opts.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta' };
    this.name = `${this.o.model} (${this.o.style})`;
  }
  async generate(req: ModelRequest): Promise<string> {
    const { apiKey, model, style, apiRevision, baseUrl } = this.o;
    let res: Response;
    if (style === 'interactions' && !req.image) {
      res = await fetch(`${baseUrl}/interactions`, {
        method: 'POST', signal: req.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey, 'Api-Revision': apiRevision },
        body: JSON.stringify({ model, system_instruction: req.system, input: req.user,
          generation_config: { max_output_tokens: req.maxTokens ?? 1200 }, response_format: { type: 'text', mime_type: 'application/json' } }),
      });
    } else {
      res = await fetch(`${baseUrl}/models/${model}:generateContent`, {
        method: 'POST', signal: req.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: req.system }] }, contents: [{ role: 'user', parts: [{ text: req.user }, ...(req.image ? [{ inlineData: { mimeType: req.image.media_type, data: req.image.data } }] : [])] }],
          generationConfig: { temperature: req.temperature ?? 0, maxOutputTokens: req.maxTokens ?? 1200, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } } }),
      });
    }
    if (!res.ok) throw new Error(`model_http_${res.status}`);
    const data: any = await res.json();
    const text: string | undefined = data.output_text
      ?? (data.steps?.length ? [...data.steps].reverse().flatMap((s: any) => s.content ?? []).map((c: any) => c.text).filter(Boolean).join('') : undefined)
      ?? data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('');
    if (!text) throw new Error('model_empty');
    return text;
  }
}

/** For tests and demos: the reply comes from a function. */
export class FakeModel implements ModelClient {
  readonly name = 'fake'; calls: ModelRequest[] = [];
  constructor(private fn: (req: ModelRequest) => string | Promise<string>) {}
  async generate(req: ModelRequest) { this.calls.push(req); return this.fn(req); }
}

/** Tries each client in order; moves on when one fails (quota, overload, timeout). The last error is thrown if all fail. */
export class FallbackModel implements ModelClient {
  readonly name: string; private attempts: ModelAttempt[] = [];
  drain(): ModelAttempt[] { const a = this.attempts; this.attempts = []; return a; }
  constructor(private clients: ModelClient[], private perAttemptMs = 4000) { this.name = clients.map((c) => c.name).join(' > '); }
  async generate(req: ModelRequest): Promise<string> {
    let last: unknown;
    for (const c of this.clients) {
      if (req.signal?.aborted) break;
      // each model gets its own time limit so one slow model cannot use up the whole budget
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), req.attemptMs ?? this.perAttemptMs); const onAbort = () => ctl.abort(); req.signal?.addEventListener('abort', onAbort);
      // race against the timer as well: a client that ignores the abort signal must not hang the caller
      const limit = new Promise<never>((_, rej) => { ctl.signal.addEventListener('abort', () => rej(Object.assign(new Error('attempt_timeout'), { name: 'AbortError' }))); });
      const t0 = Date.now();
      try { const out = await Promise.race([c.generate({ ...req, signal: ctl.signal }), limit]); this.attempts.push({ model: c.name, ok: true, ms: Date.now() - t0 }); return out; }
      catch (e) { last = e; this.attempts.push({ model: c.name, ok: false, ms: Date.now() - t0, error: String((e as Error)?.message ?? e).slice(0, 80) }); } finally { clearTimeout(timer); req.signal?.removeEventListener('abort', onAbort); }
    }
    throw last instanceof Error ? last : new Error('all_models_failed');
  }
}
