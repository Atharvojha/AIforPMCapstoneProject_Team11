import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { FakeLive } from '../supabase/functions/_shared/live.ts';
import { launchYearOf, checkPurchaseDate } from '../supabase/functions/_shared/launch.ts';
import { FLAG_KEYS, resale, resaleCfg, DEFAULT_RESALE } from '../supabase/functions/_shared/flows/sell.ts';

const NOW = () => new Date('2026-11-14T10:00:00Z');
const web = (n = 2) => ({ items: Array.from({ length: n }, (_, i) => ({ snippet: `Used laptops resell for less after two years, owners say ${i}.`, url: `https://forum.example.test/r${i}`, site: 'forum.example.test', topic: '', kind: 'excerpt' as const })) });
async function sell(body: any, live: FakeLive | null = null, mut?: (s: any) => void) {
  const { tools, db } = await getDb(); await db.query("delete from live_review_cache where topic = 'resale'"); await db.query('delete from live_usage');
  const settings: any = await loadSettings(tools); mut?.(settings);
  const r: any = await handleQuery({ tools, model: null, live, settings, requestId: 's' + Math.random().toString(36).slice(2), now: NOW }, { session_hash: 's', action: 'sell_plan', ...body });
  return { r, plan: r.blocks.find((b: any) => b.type === 'sell_plan') as any };
}
const ids = async () => { const { db } = await getDb(); const us = (await db.query("select id from variant where market = 'US' and spec_num(id,'price_inr') is null order by id limit 1")).rows[0] as any; const inn = (await db.query("select id from variant where market = 'IN' and spec_num(id,'price_inr') is not null order by id limit 1")).rows[0] as any; return { us: us.id as string, inn: inn.id as string }; };

test('a US laptop with no rupee price asks what you paid and never invents a price; paid_inr gives an estimate', async () => {
  const { us } = await ids();
  const a = await sell({ variant_id: us, age_years: 2, condition: 'good' }); assert.equal(a.plan.needs_paid_price, true); assert.equal(a.plan.range, null); assert.equal(a.plan.new_price, null); assert.match(a.plan.message, /what you paid/);
  assert.ok(Array.isArray(a.plan.checklist) && typeof a.plan.copy_text === 'string');
  const b = await sell({ variant_id: us, age_years: 2, condition: 'good', paid_inr: 40000 }); assert.equal(b.plan.needs_paid_price, undefined); assert.equal(b.plan.price_basis, 'paid');
  const f = 40000 * 0.6 * 0.92; assert.ok(b.plan.range.low < f && f < b.plan.range.high); assert.match(b.plan.price_note, /what you paid/);
});

test('a laptop not in the catalog works through custom_name and paid_inr, and asks for the price without it', async () => {
  const a = await sell({ custom_name: 'My Old Toshiba Satellite', age_years: 4, condition: 'fair' }); assert.equal(a.plan.needs_paid_price, true); assert.equal(a.plan.custom, true);
  const b = await sell({ custom_name: 'My Old Toshiba Satellite', age_years: 4, condition: 'fair', paid_inr: 30000 }); assert.ok(b.plan.range.low > 0); assert.equal(b.plan.laptop, 'My Old Toshiba Satellite');
});

test('each flag changes the number in the documented direction; unknown flags are ignored; all are sample assumptions', async () => {
  const { inn } = await ids(); const base = (await sell({ variant_id: inn, age_years: 2, condition: 'good', battery_health_pct: 90 })).plan;
  for (const k of FLAG_KEYS) {
    const p = (await sell({ variant_id: inn, age_years: 2, condition: 'good', battery_health_pct: 90, flags: [k] })).plan; const fx = DEFAULT_RESALE.flags[k].factor;
    const fac = p.factors.find((x: any) => x.factor === fx && x.sample === true); assert.ok(fac, k);
    if (k === 'need_fast') { assert.ok(p.range.low < base.range.low); assert.ok(p.range.high - p.range.low >= base.range.high - base.range.low); assert.equal(p.list_at, p.range.low); }
    else if (fx < 1) assert.ok(p.range.high <= base.range.high && p.range.low <= base.range.low, k); else assert.ok(p.range.high >= base.range.high, k);
  }
  const bogus = (await sell({ variant_id: inn, age_years: 2, condition: 'good', flags: ['made_up'] })).plan; assert.ok(!bogus.factors.some((f: any) => /made_up/.test(f.label)));
  assert.ok(base.disclaimers.some((d: string) => /sample assumptions/.test(d)));
});

test('a swollen battery carries a safety note; the battery fix is plain arithmetic', async () => {
  const { inn } = await ids(); const p = (await sell({ variant_id: inn, age_years: 2, condition: 'good', flags: ['battery_swollen'] })).plan;
  assert.ok(p.safety.some((s: string) => /Stop using/.test(s))); assert.match(p.checklist[0], /Stop using/); const fx = p.fixes[0]; assert.equal(fx.net, fx.adds - fx.cost); assert.ok(fx.adds > 0);
  assert.ok(p.boosters.some((b: any) => b.source === 'rule' && b.title === 'Replace the battery' && /net/.test(b.gain_text)));
});

test('notes are echoed back and never change the number', async () => {
  const { inn } = await ids(); const a = (await sell({ variant_id: inn, age_years: 2, condition: 'good' })).plan; const b = (await sell({ variant_id: inn, age_years: 2, condition: 'good', notes: 'Has a sticker on the lid and a rattling fan' })).plan;
  assert.deepEqual(a.range, b.range); assert.match(b.notes_echo, /^I did not price this: Has a sticker/); assert.match(b.copy_text, /I did not price this/); assert.equal(a.notes_echo, null);
});

test('settings can override a flag factor, and unknowns still widen the range', async () => {
  const { inn } = await ids(); const norm = (await sell({ variant_id: inn, age_years: 2, condition: 'good', flags: ['dead_pixels'] })).plan; const ov = (await sell({ variant_id: inn, age_years: 2, condition: 'good', flags: ['dead_pixels'] }, null, (s) => { s.RESALE = { ...s.RESALE, flags: { dead_pixels: { factor: 0.5 } } }; })).plan;
  assert.ok(ov.range.high < norm.range.high); assert.equal(resaleCfg({ flags: { dead_pixels: { factor: 0.5 } } }).flags.hinge_loose.factor, 0.9);
  const unk = resale(60000, { condition: 'good' }); const kn = resale(60000, { condition: 'good', age_years: 2, battery_health_pct: 90 }); assert.ok(unk.spread > kn.spread);
});

test('boosters from rules, owner topics and the web, each labelled; checklist and copy text', async () => {
  const { inn } = await ids(); const live = new FakeLive(() => web(2));
  const { plan } = await sell({ variant_id: inn, age_years: 2, condition: 'good', battery_health_pct: 70, flags: ['no_charger'] }, live);
  const rules = plan.boosters.filter((b: any) => b.source === 'rule'); assert.ok(rules.some((b: any) => b.title === 'Replace the battery') && rules.some((b: any) => /charger/.test(b.title)) && rules.some((b: any) => /Sell sooner/.test(b.title)));
  const w = plan.boosters.find((b: any) => b.source === 'web'); assert.equal(w.items.length, 2); assert.match(w.why, /not verified/); assert.ok(w.items.every((i: any) => /^https:\/\//.test(i.url))); assert.equal(live.calls[0].topic, 'resale'); assert.doesNotMatch(live.calls[0].laptop, /charger|70/);
  assert.ok(plan.checklist.every((x: any) => typeof x === 'string')); assert.match(plan.copy_text, /Estimated range: .*to/); assert.match(plan.copy_text, /Checklist:/); assert.match(plan.copy_text, /14 Nov 2026/); assert.match(plan.copy_text, /forum\.example\.test/); assert.match(plan.copy_text, /not verified/);
});

test('web booster says so when off, at the limit, on error, and a second ask is cached', async () => {
  const { inn } = await ids(); const off = (await sell({ variant_id: inn, age_years: 2, condition: 'good' }, null)).plan.boosters.find((b: any) => b.source === 'web'); assert.match(off.why, /not switched on/); assert.deepEqual(off.items, []);
  const bad = (await sell({ variant_id: inn, age_years: 2, condition: 'good' }, new FakeLive(() => { throw new Error('x'); }))).plan.boosters.find((b: any) => b.source === 'web'); assert.match(bad.why, /could not reach/);
  const { db, tools } = await getDb(); await db.query('delete from live_usage'); await db.query("delete from live_review_cache where topic = 'resale'"); await db.query("insert into live_usage (day, provider, calls) values (current_date, 'fake-live', 100000)");
  const settings: any = await loadSettings(tools); const lim: any = await handleQuery({ tools, model: null, live: new FakeLive(() => web(1)), settings, requestId: 'lim', now: NOW }, { action: 'sell_plan', variant_id: inn, age_years: 1, condition: 'good' } as any); assert.match(lim.blocks.find((b: any) => b.type === 'sell_plan').boosters.find((b: any) => b.source === 'web').why, /paused/);
  await db.query('delete from live_usage'); const live = new FakeLive(() => web(1)); const a = await sell({ variant_id: inn, age_years: 1, condition: 'good' }, live); const settings2: any = await loadSettings(tools);
  const b: any = await handleQuery({ tools, model: null, live, settings: settings2, requestId: 'c2', now: NOW }, { action: 'sell_plan', variant_id: inn, age_years: 1, condition: 'good' } as any); assert.equal(live.calls.length, 1); assert.ok(a.plan); assert.equal(b.blocks.find((x: any) => x.type === 'sell_plan').boosters.find((x: any) => x.source === 'web').items.length, 1);
});

test('owner-topic boosters need the minimum evidence count and quote the counts', async () => {
  const { tools, db } = await getDb(); const rows = (await db.query("select variant_id, n, neg from (select variant_id, count(*) n, count(*) filter (where polarity='negative') neg from evidence_claim where topic='battery' group by 1) x order by neg desc limit 1")).rows as any[];
  const vid = rows[0].variant_id; const ev: any = await tools.call('evidence_summary', { variant_id: vid, topic: 'battery' }); const t = ev.topics[0];
  const lo = (await sell({ variant_id: vid, age_years: 2, condition: 'good' }, null, (s) => { s.MIN_EVIDENCE_N = 100000; })).plan; assert.ok(!lo.boosters.some((b: any) => b.source === 'owners'));
  const hi = (await sell({ variant_id: vid, age_years: 2, condition: 'good' }, null, (s) => { s.MIN_EVIDENCE_N = 1; })).plan; const o = hi.boosters.find((b: any) => b.source === 'owners' && /battery/i.test(b.title));
  if (t.negative / t.n >= 0.3) { assert.ok(o); assert.ok(o.why.includes(`${t.negative} of ${t.n}`)); } else assert.ok(!o);
});

test('launch years: year in the name, processor generation, unknown', () => {
  assert.equal(launchYearOf('ASUS VivoBook 15 (2022) Core i3 10th Gen', null), 2022); assert.equal(launchYearOf('APPLE 2020 Macbook Air M1', 'M1'), 2020);
  assert.equal(launchYearOf('HP Pavilion', 'Core i5 10th Gen'), 2020); assert.equal(launchYearOf('X', 'Core i5 11th Gen'), 2021); assert.equal(launchYearOf('X', 'Intel Core i7 12th Gen'), 2022); assert.equal(launchYearOf('X', 'Core i5 13th Gen'), 2023);
  assert.equal(launchYearOf('X', 'Ryzen 7 Octa Core AMD R7-4800H'), 2020); assert.equal(launchYearOf('X', 'Ryzen 5 Hexa Core 5500U'), 2021); assert.equal(launchYearOf('X', 'Ryzen 5 6600H'), 2022);
  assert.equal(launchYearOf('MacBook Pro', 'M2'), 2022); assert.equal(launchYearOf('Dell Inspiron, 8th Gen Intel i5-8250U, 8GB', null), 2018); assert.equal(launchYearOf('HP 14 i5-1135G7 16GB', null), 2021);
  assert.equal(launchYearOf('Lenovo IdeaPad 3 Celeron Dual Core', 'Celeron Dual Core'), null); assert.equal(launchYearOf('Core i5 1000 GB SSD', null), null);
});

test('age cannot exceed the years since launch: capped, noted and widened, not rejected', async () => {
  const { db } = await getDb(); const v = (await db.query("select id from variant where display_name like 'APPLE 2020 Macbook Air M1%' limit 1")).rows[0] as any;
  const p = (await sell({ variant_id: v.id, age_years: 12, condition: 'good', battery_health_pct: 90 })).plan; assert.match(p.date_notes[0], /launched in 2020/); assert.ok(p.factors[0].label.startsWith('Age 6')); assert.ok(p.unknown.includes('age'));
  assert.equal((await sell({ variant_id: v.id, age_years: 3, condition: 'good' })).plan.date_notes.length, 0);
});

test('catalog rows carry market and launch_year; US rows have no rupee price', async () => {
  const { tools } = await getDb(); const settings: any = await loadSettings(tools); const r: any = await handleQuery({ tools, model: null, settings, requestId: 'cat', now: NOW }, { action: 'catalog' });
  const rows = r.blocks.find((b: any) => b.type === 'catalog').rows; assert.ok(rows.every((x: any) => 'market' in x && 'launch_year' in x));
  assert.ok(rows.some((x: any) => x.market === 'US') && rows.some((x: any) => x.market === 'IN')); assert.ok(rows.filter((x: any) => x.market === 'US').every((x: any) => x.price_inr == null));
  assert.equal(rows.find((x: any) => /2020 Macbook Air/.test(x.name)).launch_year, 2020); assert.ok(rows.some((x: any) => x.launch_year == null) || rows.every((x: any) => typeof x.launch_year === 'number'));
});

test('purchase date check', () => {
  assert.match((checkPurchaseDate('2003-03-11', 2020, '2026-11-14') as any).reason, /launched in 2020, so 11 Mar 2003 cannot be right/);
  assert.equal(checkPurchaseDate('2027-01-01', 2020, '2026-11-14').ok, false); assert.equal(checkPurchaseDate('2020-01-01', 2020, '2026-11-14').ok, true); assert.equal(checkPurchaseDate('2011-06-01', null, '2026-11-14').ok, false); assert.equal(checkPurchaseDate('2013-06-01', null, '2026-11-14').ok, true); assert.equal(checkPurchaseDate('2021-02-30', null, '2026-11-14').ok, false);
});
