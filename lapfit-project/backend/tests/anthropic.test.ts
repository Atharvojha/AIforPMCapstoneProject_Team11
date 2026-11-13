import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicClient, GeminiClient, FallbackModel, NoModelKey, extractJson } from '../supabase/functions/_shared/model.ts';

type Call = { url: string; init: any };
function mockFetch(handler: (url: string, init: any) => Response | Promise<Response>) { const calls: Call[] = []; const real = globalThis.fetch; globalThis.fetch = (async (u: any, init: any) => { calls.push({ url: String(u), init }); return handler(String(u), init); }) as any; return { calls, restore: () => { globalThis.fetch = real; } }; }
const claudeOk = (text: string) => new Response(JSON.stringify({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text }] }), { status: 200 });

test('the Claude client sends the Messages API request (key and version headers, system prompt with the JSON instruction, user text) and returns only the text blocks', async () => {
  const m = mockFetch(() => claudeOk('{"flow":"shortlist"}'));
  try {
    const out = await new AnthropicClient({ apiKey: 'sk-test' }).generate({ system: 'You read requests.', user: 'laptop under 60k', maxTokens: 300 });
    assert.equal(out, '{"flow":"shortlist"}'); assert.deepEqual(extractJson(out), { flow: 'shortlist' });
    const { url, init } = m.calls[0]; assert.equal(url, 'https://api.anthropic.com/v1/messages'); assert.equal(init.headers['x-api-key'], 'sk-test'); assert.equal(init.headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(init.body); assert.equal(body.model, 'claude-haiku-5-5'); assert.equal(body.max_tokens, 300); assert.ok(!('temperature' in body), 'the current Claude models reject temperature'); assert.match(body.system, /^You read requests\./); assert.match(body.system, /single JSON object and nothing else/); assert.equal(body.messages[0].role, 'user'); assert.deepEqual(body.messages[0].content, [{ type: 'text', text: 'laptop under 60k' }]);
  } finally { m.restore(); }
});

test('a picture goes as a base64 image block, so reading listing screenshots works through Claude too', async () => {
  const m = mockFetch(() => claudeOk('{}'));
  try { await new AnthropicClient({ apiKey: 'k', model: 'claude-sonnet-5-5' }).generate({ system: 's', user: 'Read this image.', image: { media_type: 'image/png', data: 'AAAA' } }); const body = JSON.parse(m.calls[0].init.body); assert.equal(body.model, 'claude-sonnet-5-5'); assert.deepEqual(body.messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }); } finally { m.restore(); }
});

test('errors are short codes the log understands: http status, empty reply, and no key at all', async () => {
  assert.throws(() => new AnthropicClient({}), NoModelKey);
  let m = mockFetch(() => new Response('{}', { status: 429 })); try { await assert.rejects(() => new AnthropicClient({ apiKey: 'k' }).generate({ system: 's', user: 'u' }), /model_http_429/); } finally { m.restore(); }
  m = mockFetch(() => new Response(JSON.stringify({ content: [] }), { status: 200 })); try { await assert.rejects(() => new AnthropicClient({ apiKey: 'k' }).generate({ system: 's', user: 'u' }), /model_empty/); } finally { m.restore(); }
});

test('when both Gemini models fail, the chain falls back to Claude and the log shows all three attempts', async () => {
  const m = mockFetch((url) => (url.includes('generativelanguage') ? new Response('{}', { status: 503 }) : claudeOk('{"ok":true}')));
  try {
    const model = new FallbackModel([new GeminiClient({ apiKey: 'g', model: 'gemini-3.1-flash-lite' }), new GeminiClient({ apiKey: 'g', model: 'gemini-3.5-flash-lite' }), new AnthropicClient({ apiKey: 'c' })]);
    const out = await model.generate({ system: 's', user: 'u' }); assert.equal(out, '{"ok":true}');
    const a = model.drain(); assert.deepEqual(a.map((x) => x.ok), [false, false, true]); assert.match(a[0].error!, /model_http_503/); assert.match(a[2].model, /anthropic/);
  } finally { m.restore(); }
});

test('Claude is not called while Gemini works', async () => {
  const m = mockFetch((url) => (url.includes('generativelanguage') ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"g":1}' }] } }] }), { status: 200 }) : claudeOk('{"c":1}')));
  try { const model = new FallbackModel([new GeminiClient({ apiKey: 'g' }), new AnthropicClient({ apiKey: 'c' })]); assert.equal(await model.generate({ system: 's', user: 'u' }), '{"g":1}'); assert.ok(!m.calls.some((c) => c.url.includes('anthropic'))); } finally { m.restore(); }
});

test('Claude gets its own, longer time slot, so two slow Gemini attempts do not use up the time it needs', async () => {
  const slow = (name: string) => ({ name, generate: (req: any) => new Promise<string>((_, rej) => req.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))) });
  const claude = new AnthropicClient({ apiKey: 'c' }); assert.ok(claude.attemptMs! > 4000);
  const m = mockFetch(async () => { await new Promise((r) => setTimeout(r, 150)); return claudeOk('{"late":true}'); });
  try { const model = new FallbackModel([slow('g1'), slow('g2'), claude], 40); const out = await model.generate({ system: 's', user: 'u' }); assert.equal(out, '{"late":true}'); assert.deepEqual(model.drain().map((a) => [a.ok, a.error ?? '']), [[false, 'attempt_timeout'], [false, 'attempt_timeout'], [true, '']]); } finally { m.restore(); }
});

test('the Claude client turns thinking off, so hidden thinking cannot use up max_tokens and cut the JSON short', async () => {
  const m = mockFetch(() => claudeOk('{}'));
  try { await new AnthropicClient({ apiKey: 'k' }).generate({ system: 's', user: 'u' }); assert.deepEqual(JSON.parse(m.calls[0].init.body).thinking, { type: 'disabled' }); } finally { m.restore(); }
});

test('an empty reply stopped by the token limit is logged as model_max_tokens, not model_empty', async () => {
  const m = mockFetch(() => new Response(JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '' }] }), { status: 200 }));
  try { await assert.rejects(() => new AnthropicClient({ apiKey: 'k' }).generate({ system: 's', user: 'u' }), /model_max_tokens/); } finally { m.restore(); }
});
