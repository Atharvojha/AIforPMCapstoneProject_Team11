// Supabase Edge Function (Deno). Thin wrapper: all logic lives in ../_shared and is covered by the Node tests.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { handleQuery } from '../_shared/handler.ts';
import { RpcTools } from '../_shared/tools.ts';
import { loadSettings } from '../_shared/settings.ts';
import { GeminiClient, FallbackModel, NoModelKey } from '../_shared/model.ts';
import { GeminiGroundedSource, TavilySource } from '../_shared/live.ts';
import { guardRequest, visitorId, BLOCK_MESSAGE } from '../_shared/guard.ts';
import { newRequestId } from '../_shared/util.ts';
import { inputRecord } from '../_shared/inputlog.ts';

const CORS = { 'access-control-allow-origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*', 'access-control-allow-headers': 'content-type, authorization, apikey, x-lapfit-image', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-expose-headers': 'retry-after' };
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const requestId = newRequestId(); let tools: RpcTools | null = null; let visitor = '';
  // failures before the handler runs are logged here (the handler logs everything after that)
  const logFail = async (stage: string, message: string, status: number) => { try { await tools?.call('log_event', { kind: 'query', request_id: requestId, input_kind: 'wrapper', outcome: 'error', status, visitor, error_stage: stage, error_message: message.slice(0, 300) }); } catch { /* the database may be the problem */ } };
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    tools = new RpcTools(supabase as any);

    // 1. Size check and rate limit BEFORE anything expensive happens.
    const raw = await req.text();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    visitor = await visitorId(ip, Deno.env.get('SESSION_SALT') ?? 'lapfit');
    // a picture is a bigger body than text; only the read_image action may be that large (checked again after parsing)
    const wantsImage = req.headers.get('x-lapfit-image') === '1';
    // 0. Record what the person typed or tapped BEFORE any limit can turn it away. Never allowed to break the request.
    try { const rec = inputRecord(raw, req.headers.get('x-lapfit-image') === '1'); if (rec) await tools.call('log_input', { request_id: requestId, visitor, kind: rec.kind, text: rec.text, payload: rec.payload, raw_len: rec.raw_len }); } catch { /* logging never breaks an answer */ }
    const guard = await guardRequest({ tools, visitor, bodyLength: raw.length, bodyMax: wantsImage ? 1_000_000 : undefined });
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

    let body: any = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { await logFail('parse', 'request body was not valid JSON', 400); return json({ ok: false, request_id: requestId, error: 'bad_json', message: 'Please send valid JSON.' }, 400); }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) body = {};
    if (raw.length > 20000 && body.action !== 'read_image') { await logFail('guard', `body of ${raw.length} characters for a non-image request`, 413); return json({ ok: false, request_id: requestId, error: 'too_large', message: 'That message is too large. Please shorten it.' }, 413); }
    return json(await handleQuery({ tools, model, live, settings, requestId, degraded: guard.degraded ? guard.reason : undefined }, { ...body, session_hash: visitor }));
  } catch (e) {
    console.error(requestId, e);
    await logFail('wrapper', String((e as Error)?.message ?? e), 500);
    return json({ ok: false, request_id: requestId, error: 'internal', message: 'Something went wrong. Please try again.' }, 500);
  }
});
