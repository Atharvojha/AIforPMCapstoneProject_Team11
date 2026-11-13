import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, withSetting } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { FakeModel, FallbackModel } from '../supabase/functions/_shared/model.ts';
import { FakeLive } from '../supabase/functions/_shared/live.ts';
import { guardRequest } from '../supabase/functions/_shared/guard.ts';
import { CASES } from './inputs.ts';

let n = 0; const rid = () => `lg${Date.now().toString(36)}${n++}`;
async function run(body: any, deps: any = {}) {
  const { tools, db } = await getDb(); const requestId = rid();
  const t = deps.tools ? deps.tools(tools) : tools;
  const reply = await handleQuery({ model: null, settings: await loadSettings(tools), requestId, ...deps, tools: t }, { session_hash: 'vis123', ...body });
  const row = (await db.query('select * from query_log where request_id = $1', [requestId])).rows[0];
  return { reply, row, requestId, db, tools };
}
const failing = (name: string, msg = 'boom') => (real: any) => ({ call: async (n: string, a: any) => { if (n === name) throw new Error(msg); return real.call(n, a); } });
const ROUTER_OK = JSON.stringify({ flow: 'shortlist', confidence: 0.95, language: 'English', needs: { budget_max_inr: 60000, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: ['coding'] }, laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null });

test('every successful request writes one row: flow, outcome, input kind, scrubbed text, block types, stage timings', async () => {
  const { row, reply } = await run({ text: 'laptop for coding under 60k' });
  assert.equal(row.flow, 'shortlist'); assert.equal(row.outcome, 'ok'); assert.equal(row.input_kind, 'text'); assert.equal(row.status, 200); assert.equal(row.visitor, 'vis123');
  assert.equal(row.text_scrubbed, 'laptop for coding under 60k'); assert.equal(row.text_len, 27); assert.ok(row.blocks.includes('cards'));
  for (const k of ['router_ms', 'flow_ms', 'gate_ms', 'total_ms']) assert.equal(typeof row.timings[k], 'number', k);
  assert.equal(row.duration_ms, row.timings.total_ms); assert.deepEqual(row.detail.failures, []); assert.ok(row.detail.matched >= 1); assert.equal(reply.ok, true);
});

test('input kind distinguishes text, form needs and direct actions', async () => {
  assert.equal((await run({ needs: { budget_max_inr: 50000, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] } })).row.input_kind, 'needs');
  assert.equal((await run({ action: 'compare', variant_ids: ['FKL-10', 'FKL-14'] })).row.input_kind, 'action:compare');
  assert.equal((await run({ owned: [{ variant_id: 'FKL-10' }] })).row.input_kind, 'owned');
});

test('personal details and links never reach the log; long text is cut; the text can be switched off', async () => {
  const a = (await run({ text: 'call me on 9876543210, mail me@example.com, see https://x.test/a laptop under 50k' })).row.text_scrubbed;
  assert.ok(!/9876543210|me@example\.com|x\.test/.test(a), a);
  assert.ok(((await run({ text: 'laptop for coding under 60k. '.repeat(100) })).row.text_scrubbed as string).length <= 300);
  const { db } = await getDb();
  await withSetting(db, 'LOG_QUERY_TEXT', false, async () => { const r = (await run({ text: 'laptop under 50k' })).row; assert.equal(r.text_scrubbed, null); assert.equal(r.text_len, 16); });
});

test('a hard failure records the stage and the message, the user gets a calm reply, and the row still exists', async () => {
  const a = await run({ text: 'laptop for coding under 60k' }, { tools: failing('find_variants', 'boom in find') });
  assert.equal(a.row.outcome, 'error'); assert.equal(a.row.error_stage, 'flow:shortlist'); assert.match(a.row.error_message, /boom in find/); assert.match(JSON.stringify(a.reply.blocks), /Something went wrong on my side/);
  const b = await run({ text: 'laptop for coding under 60k' }, { tools: failing('get_price', 'price lookup down') });
  assert.equal(b.row.error_stage, 'gate'); const c = await run({ action: 'compare', variant_ids: ['FKL-10', 'FKL-14'] }, { tools: failing('get_variant') });
  assert.equal(c.row.error_stage, 'action:compare');
});

test('router fallback is a soft failure: the user is answered, and the log says which model attempts failed and why', async () => {
  const bad = new FakeModel(() => { throw new Error('model_http_503'); }); const junk = new FakeModel(() => 'not json');
  const { row, reply } = await run({ text: 'laptop for coding under 60k' }, { model: new FallbackModel([bad, junk]) });
  assert.equal(reply.router_mode, 'fallback'); assert.equal(row.router_mode, 'fallback'); assert.equal(row.outcome, 'ok');
  assert.ok(row.detail.failures.some((f: any) => f.stage === 'router' && f.kind === 'fallback'));
  const attempts = row.detail.model_attempts; assert.ok(attempts.length >= 2); assert.equal(attempts[0].ok, false); assert.match(attempts[0].error, /503/);
  assert.ok(row.detail.failures.some((f: any) => f.stage === 'model' && /503/.test(f.message)));
});

test('a reasons-writer failure is logged as a soft failure (template wording was used)', async () => {
  const model = new FakeModel((req) => { if (req.system.startsWith('You are the reading step')) return ROUTER_OK; throw new Error('writer_timeout'); });
  const { row } = await run({ text: 'coding laptop under 60k' }, { model });
  assert.equal(row.detail.reasons_mode, 'template'); assert.ok(row.detail.failures.some((f: any) => f.stage === 'reasons' && /writer_timeout/.test(f.message)));
  const ok = new FakeModel((req) => (req.system.startsWith('You are the reading step') ? ROUTER_OK : JSON.stringify({ cards: [] })));
  assert.equal((await run({ text: 'coding laptop under 60k' }, { model: ok })).row.detail.reasons_mode, 'model');
});

test('a failed live search is logged with its reason', async () => {
  const live = new FakeLive(() => { throw new Error('tavily_http_429'); });
  const { row } = await run({ action: 'owner_voice', variant_id: 'FKL-10', topic: 'battery' }, { live });
  assert.ok(row.detail.failures.some((f: any) => f.stage === 'live' && f.kind === 'error' && /tavily_http_429/.test(f.message)));
});

test('cards dropped by the pre-send gate are counted, logged, and linked to the gate log by request id', async () => {
  const wrong = (real: any) => ({ call: async (n: string, a: any) => { const r = await real.call(n, a); return n === 'get_price' && r.found ? { ...r, price_inr: r.price_inr + 1 } : r; } });
  const { row, db, requestId } = await run({ text: 'laptop for coding under 60k' }, { tools: wrong });
  assert.equal(row.outcome, 'gate_dropped'); assert.ok(row.detail.gate_dropped >= 1); assert.ok(row.detail.failures.some((f: any) => f.stage === 'gate' && f.kind === 'dropped'));
  assert.ok(Number((await db.query('select count(*) n from gate_log where request_id = $1', [requestId])).rows[0].n) >= 1);
});

test('rate limiting logs once at the first blocked request, not on every hammering request', async () => {
  const { db, tools } = await getDb(); await db.query('delete from rate_bucket'); await db.query("delete from query_log where input_kind = 'limit'");
  await withSetting(db, 'RATE_LIMITS', { per_minute: 3, per_hour: 100, soft_per_hour: 90, global_daily_model: 1000, body_max_chars: 20000 }, async () => {
    for (let i = 0; i < 12; i++) await guardRequest({ tools, visitor: 'hammer', bodyLength: 5 });
    const rows = (await db.query("select * from query_log where input_kind = 'limit' and visitor = 'hammer'")).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].outcome, 'rate_limited'); assert.equal(rows[0].status, 429); assert.match(rows[0].error_message, /per_minute limit of 3/);
  });
});

test('an oversized request is logged by the guard', async () => {
  const { tools, db } = await getDb(); await guardRequest({ tools, visitor: 'big', bodyLength: 90000 });
  const r = (await db.query("select * from query_log where visitor = 'big' and outcome = 'too_large'")).rows[0]; assert.equal(r.status, 413); assert.equal(r.error_stage, 'guard'); assert.equal(r.text_len, 90000);
});

test('browser-side failures are recorded through client_log, are not counted as queries, and only known kinds are accepted', async () => {
  const { db } = await getDb(); const before = Number((await db.query("select count(*) n from query_log where input_kind = 'client'")).rows[0].n);
  const a = await run({ action: 'client_log', client: { what: 'network', screen: 'ask', message: 'Failed to fetch', action: 'text' } });
  assert.equal(a.reply.flow, 'client_log'); assert.equal(a.row.input_kind, 'client', 'a log call produces one client row, not an ordinary query row');
  assert.equal(Number((await db.query("select count(*) n from query_log where request_id = $1", [a.requestId])).rows[0].n), 1);
  const r = (await db.query("select * from query_log where input_kind = 'client' order by id desc limit 1")).rows[0]; assert.equal(r.outcome, 'client_network'); assert.equal(r.error_stage, 'ask'); assert.equal(r.error_message, 'Failed to fetch'); assert.equal(r.detail.action, 'text');
  await run({ action: 'client_log', client: { what: 'drop table', screen: 'x', message: 'y' } });
  await run({ action: 'client_log', client: { what: 'ui_crash', screen: 'find', message: 'x'.repeat(2000) } });
  const after = (await db.query("select * from query_log where input_kind = 'client' order by id")).rows; assert.equal(after.length, before + 2); assert.ok(after.every((x: any) => x.outcome.startsWith('client_'))); assert.ok(after.at(-1).error_message.length <= 300);
});

test('a broken log writer never breaks an answer', async () => {
  const { reply } = await run({ text: 'laptop for coding under 60k' }, { tools: failing('log_event', 'log down') });
  assert.equal(reply.ok, true); assert.ok(reply.blocks.some((b: any) => b.type === 'cards'));
});

test('retention: old rows are deleted, recent ones kept, and the number of days is a setting', async () => {
  const { db } = await getDb();
  await db.query("insert into query_log (request_id, outcome, ts) values ('old1', 'ok', now() - interval '40 days'), ('old2', 'ok', now() - interval '10 days'), ('fresh', 'ok', now())");
  await db.query("insert into gate_log (request_id, check_name, ts) values ('old1', 'x', now() - interval '40 days')");
  const out = (await db.query('select purge_logs() r')).rows[0].r; assert.ok(out.query_log >= 1); assert.ok(out.gate_log >= 1);
  const left = (await db.query("select request_id from query_log where request_id in ('old1','old2','fresh')")).rows.map((r: any) => r.request_id).sort(); assert.deepEqual(left, ['fresh', 'old2']);
  await withSetting(db, 'LOG_RETENTION_DAYS', 5, async () => { await db.query('select purge_logs()'); assert.deepEqual((await db.query("select request_id from query_log where request_id in ('old2','fresh')")).rows.map((r: any) => r.request_id), ['fresh']); });
});

test('views: failures, daily summary with percentiles, and failures by stage', async () => {
  const { db } = await getDb();
  const f = (await db.query("select * from v_failures where outcome = 'error' or router_mode = 'fallback'")).rows; assert.ok(f.length >= 2); assert.ok(f.every((r: any) => r.request_id || r.input_kind));
  const d = (await db.query('select * from v_daily_summary')).rows; assert.ok(d.length > 0); assert.ok(d.some((r: any) => r.p95_ms != null && Number(r.requests) >= 1));
  const s = (await db.query('select * from v_stage_failures')).rows; assert.ok(s.some((r: any) => r.stage === 'router' && r.kind === 'fallback')); assert.ok(s.some((r: any) => r.stage === 'live'));
});

test('exactly one log row per request across all 75 kinds of input', async () => {
  const { db, tools } = await getDb(); const settings = await loadSettings(tools); await db.query('delete from rate_bucket');
  const before = Number((await db.query('select count(*) n from query_log')).rows[0].n);
  for (const c of CASES) await handleQuery({ tools, model: null, settings, requestId: `all-${c.id}` }, { text: c.text, session_hash: 'matrix' });
  const rows = (await db.query("select request_id from query_log where request_id like 'all-%'")).rows; assert.equal(rows.length, CASES.length);
  assert.equal(new Set(rows.map((r: any) => r.request_id)).size, CASES.length); assert.equal(Number((await db.query('select count(*) n from query_log')).rows[0].n) - before, CASES.length);
});
