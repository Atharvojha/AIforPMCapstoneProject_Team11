// Supabase Edge Function (Deno). Thin wrapper: all logic lives in ../_shared and is covered by the Node tests.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { handleQuery } from '../_shared/handler.ts';
import { RpcTools } from '../_shared/tools.ts';
import { loadSettings } from '../_shared/settings.ts';
import { GeminiClient, FallbackModel, NoModelKey } from '../_shared/model.ts';
import { GeminiGroundedSource, TavilySource } from '../_shared/live.ts';
import { guardRequest, visitorId, BLOCK_MESSAGE } from '../_shared/guard.ts';
import { newRequestId } from '../_shared/util.ts';

const CORS = { 'access-control-allow-origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*', 'access-control-allow-headers': 'content-type, authorization, apikey', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-expose-headers': 'retry-after' };
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const requestId = newRequestId();
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const tools = new RpcTools(supabase as any);

    // 1. Size check and rate limit BEFORE anything expensive happens.
    const raw = await req.text();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const visitor = await visitorId(ip, Deno.env.get('SESSION_SALT') ?? 'lapfit');
    const guard = await guardRequest({ tools, visitor, bodyLength: raw.length });
    if (guard.status === 413) return json({ ok: false, request_id: requestId, error: 'too_large', message: 'That message is too large. Please shorten it.' }, 413);
    if (guard.status === 429) return json({ ok: false, request_id: requestId, error: 'rate_limited', retry_after: guard.retry_after, message: BLOCK_MESSAGE(guard.retry_after ?? 60) }, 429, { 'retry-after': String(guard.retry_after ?? 60) });

    // 2. Services. A degraded visitor gets the rules reader only: no model call, no live search.
    const settings = await loadSettings(tools);
    const apiKey = Deno.env.get('GEMINI_API_KEY'); const tavilyKey = Deno.env.get('TAVILY_API_KEY');
    let model = null;
    if (!guard.degraded && settings.FEATURE_FLAGS?.model_enabled !== false) {
      try { model = new FallbackModel([new GeminiClient({ apiKey, model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite' }), new GeminiClient({ apiKey, model: Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite' })]); }
      catch (e) { if (!(e instanceof NoModelKey)) throw e; }
    }
    // Tavily is preferred (real page excerpts, predictable cost). Gemini grounding is the fallback and needs a paid Google plan.
    const live = guard.degraded || settings.FEATURE_FLAGS?.live_reviews === false ? null : tavilyKey ? new TavilySource({ apiKey: tavilyKey, country: 'india' }) : apiKey ? new GeminiGroundedSource({ apiKey, model: Deno.env.get('GEMINI_MODEL') ?? undefined }) : null;

    let body: any = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { return json({ ok: false, request_id: requestId, error: 'bad_json', message: 'Please send valid JSON.' }, 400); }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) body = {};
    return json(await handleQuery({ tools, model, live, settings, requestId, degraded: guard.degraded ? guard.reason : undefined }, { ...body, session_hash: visitor }));
  } catch (e) {
    console.error(requestId, e);
    return json({ ok: false, request_id: requestId, error: 'internal', message: 'Something went wrong. Please try again.' }, 500);
  }
});
