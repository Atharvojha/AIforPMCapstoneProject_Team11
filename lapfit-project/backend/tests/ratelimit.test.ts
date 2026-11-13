import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, withSetting } from './helpers.ts';
import { guardRequest, visitorId } from '../supabase/functions/_shared/guard.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { FakeModel } from '../supabase/functions/_shared/model.ts';
import { FakeLive } from '../supabase/functions/_shared/live.ts';

const LIMITS = { per_minute: 5, per_hour: 12, soft_per_hour: 8, global_daily_model: 1000, body_max_chars: 20000 };
async function reset() { const { db } = await getDb(); await db.query('delete from rate_bucket'); return db; }
async function gate(visitor: string, bodyLength = 10) { const { tools } = await getDb(); return guardRequest({ tools, visitor, bodyLength }); }

test('allow: normal use passes untouched', async () => {
  const db = await reset();
  await withSetting(db, 'RATE_LIMITS', LIMITS, async () => { const g = await gate('a'); assert.equal(g.action, 'allow'); assert.equal(g.degraded, false); assert.equal(g.status, 200); });
});

test('block: the request after the per-minute limit gets 429 with a sensible Retry-After; other visitors are unaffected', async () => {
  const db = await reset();
  await withSetting(db, 'RATE_LIMITS', LIMITS, async () => {
    for (let i = 0; i < 5; i++) assert.equal((await gate('burst')).action, 'allow');
    const g = await gate('burst'); assert.equal(g.status, 429); assert.equal(g.reason, 'too_many_per_minute'); assert.ok(g.retry_after! >= 1 && g.retry_after! <= 60);
    assert.equal((await gate('someone-else')).action, 'allow');
  });
});

test('window reset: after the minute passes the visitor is allowed again', async () => {
  const db = await reset();
  await withSetting(db, 'RATE_LIMITS', LIMITS, async () => {
    for (let i = 0; i < 6; i++) await gate('w'); assert.equal((await gate('w')).status, 429);
    await db.query("update rate_bucket set window_start = window_start - interval '2 minutes' where key = 'v:w:m'");
    assert.equal((await gate('w')).action, 'allow');
  });
});

test('degrade: after the soft hourly limit the visitor still gets answers but no model and no live search', async () => {
  const db = await reset();
  await withSetting(db, 'RATE_LIMITS', { ...LIMITS, per_minute: 100 }, async () => {
    for (let i = 0; i < 8; i++) assert.equal((await gate('heavy')).action, 'allow');
    const g = await gate('heavy'); assert.equal(g.action, 'degrade'); assert.equal(g.reason, 'heavy_use'); assert.equal(g.status, 200); assert.equal(g.degraded, true);
    for (let i = 0; i < 3; i++) await gate('heavy');
    assert.equal((await gate('heavy')).status, 429, 'past the hard hourly limit it is blocked');
  });
});

test('global daily budget: when the paid-call budget is spent, everyone is degraded, not blocked', async () => {
  const db = await reset();
  await withSetting(db, 'RATE_LIMITS', { ...LIMITS, global_daily_model: 3, per_minute: 100 }, async () => {
    for (let i = 0; i < 3; i++) assert.equal((await gate('g' + i)).action, 'allow');
    const g = await gate('g9'); assert.equal(g.action, 'degrade'); assert.equal(g.reason, 'daily_budget');
  });
});

test('blocked requests are still counted, so hammering gets no cheaper', async () => {
  const db = await reset();
  await withSetting(db, 'RATE_LIMITS', LIMITS, async () => {
    for (let i = 0; i < 9; i++) await gate('count');
    const c = (await db.query("select sum(count)::int n from rate_bucket where key = 'v:count:m'")).rows[0].n; assert.equal(c, 9);
  });
});

test('oversized body is refused before any database or model work', async () => {
  const calls: string[] = []; const spy = { call: async (n: string) => { calls.push(n); return {}; } };
  const g = await guardRequest({ tools: spy as any, visitor: 'x', bodyLength: 50000 });
  assert.equal(g.status, 413); assert.deepEqual(calls, ['log_event'], 'only the log write: no rate counting, no model, no data work');
});

test('if the limiter itself fails the service stays up but spends nothing (degraded)', async () => {
  const g = await guardRequest({ tools: { call: async () => { throw new Error('db down'); } } as any, visitor: 'x', bodyLength: 10 });
  assert.equal(g.status, 200); assert.equal(g.degraded, true); assert.equal(g.reason, 'limiter_unavailable');
});

test('visitor id: stable per address and day, different across addresses and days, and never contains the address', async () => {
  const a = await visitorId('203.0.113.7', 'salt', '2026-11-13'); const b = await visitorId('203.0.113.7', 'salt', '2026-11-13');
  assert.equal(a, b); assert.notEqual(a, await visitorId('203.0.113.8', 'salt', '2026-11-13')); assert.notEqual(a, await visitorId('203.0.113.7', 'salt', '2026-11-14'));
  assert.ok(!a.includes('203')); assert.match(a, /^[0-9a-f]{24}$/);
});

test('degraded visitors cost nothing: no model call, no live call, and they are told', async () => {
  const { tools } = await getDb(); const model = new FakeModel(() => '{}'); const live = new FakeLive(() => ({ items: [] }));
  // the wrapper passes model = null and live = null when degraded; the handler adds the notice and still answers fully
  const r = await handleQuery({ tools, model: null, live: null, degraded: 'heavy_use', settings: await loadSettings(tools), requestId: 'dg' }, { text: 'laptop for coding under 60k' });
  assert.equal(r.flow, 'shortlist'); assert.ok(r.blocks.some((b: any) => b.type === 'cards')); assert.ok(/simpler reader without live web results/.test(JSON.stringify(r.blocks)));
  assert.equal(model.calls.length, 0); assert.equal(live.calls.length, 0);
});

test('migration seeds sensible defaults and the Tavily-sized live limit', async () => {
  const { tools } = await getDb(); const s: any = await loadSettings(tools);
  assert.ok(s.RATE_LIMITS.per_minute <= 20 && s.RATE_LIMITS.per_hour >= s.RATE_LIMITS.soft_per_hour); assert.equal(Number(s.LIVE_DAILY_LIMIT), 30);
});

test('rate tables and functions are not reachable with the public keys', async () => {
  const { db } = await getDb();
  const r = (await db.query("select count(*) n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and (p.proname like 'tool\\_%' or p.proname='rate_hit')")).rows[0].n;
  assert.ok(Number(r) >= 20);
});
