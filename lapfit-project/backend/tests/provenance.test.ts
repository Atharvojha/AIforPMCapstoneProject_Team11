import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { handleQuery, dataNotice } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { buildProvenance } from '../supabase/functions/_shared/provenance.ts';
import { FakeLive } from '../supabase/functions/_shared/live.ts';

async function ask(body: any, deps: any = {}) { const { tools } = await getDb(); return handleQuery({ tools, model: null, settings: await loadSettings(tools), requestId: 'p' + Math.random(), ...deps }, body); }
const prov = (r: any) => r.blocks.find((b: any) => b.type === 'provenance');

test('the banner tells the truth: saved snapshot with its date, not live, specs not checked by a person; no "course project" wording', async () => {
  const r = await ask({ text: 'laptop for coding under 60k' });
  assert.match(r.notice, /saved snapshot from 10 Nov 2026, not live/); assert.match(r.notice, /no person has checked/); assert.doesNotMatch(r.notice, /[Cc]ourse project|sample data/);
  const { tools } = await getDb(); const s = await loadSettings(tools); s.data_mode = 'production'; assert.equal((await ask({ text: 'hi' }, { settings: s })).notice, '');
  s.DATA_STATUS = { ...s.DATA_STATUS, verified_variants: 5 }; assert.match(dataNotice(s), /Some specs are checked by a person/);
});

test('data_status states what the product holds: snapshot date, counts, review sources, and that reviews have no dates', async () => {
  const r = await ask({ action: 'data_status' }); const d = r.blocks[0] as any;
  assert.equal(d.type, 'data_status'); assert.equal(d.prices_as_of, '2026-11-10'); assert.equal(d.laptops_with_price, 14); assert.equal(d.reviews, 3987); assert.equal(d.opinions, 1316); assert.equal(d.reviews_with_dates, 0); assert.equal(d.verified_variants, 0);
  assert.ok(d.review_sources.some((s: any) => s.id === 'S-AMAZON-REVIEWS-23' && s.quotable === false));
  assert.ok(!r.blocks.some((b: any) => b.type === 'provenance'), 'the status call needs no receipt');
});

test('a shortlist carries a receipt: catalog snapshot date, dataset opinions counted, rules reader, and the gate ran', async () => {
  const p = prov(await ask({ text: 'laptop for coding under 60k' }));
  assert.equal(p.catalog.used, true); assert.equal(p.catalog.prices_as_of, '2026-11-10'); assert.equal(p.catalog.live, false); assert.equal(p.catalog.verified, false);
  assert.equal(p.dataset.used, true); assert.ok(p.dataset.opinions > 0); assert.equal(p.dataset.machine_read, true); assert.equal(p.dataset.dated, false);
  assert.equal(p.live.used, false); assert.equal(p.ai.reader, 'rules'); assert.equal(p.checks.gate, true);
});

test('the dataset count in the receipt equals the sum of the opinion counts shown on the cards', async () => {
  const r = await ask({ text: 'laptop for coding under 60k' }); const shown = r.blocks.filter((b: any) => b.type === 'cards').flatMap((b: any) => b.cards).reduce((n: number, c: any) => n + c.evidence.n, 0);
  assert.equal(prov(r).dataset.opinions, shown);
});

test('live results appear in the receipt only when used, with provider and count; a stylish request names the looks lens', async () => {
  const live = new FakeLive(() => ({ items: [{ snippet: 'An example excerpt.', url: 'https://example.test/a', site: 'example.test', topic: '', kind: 'excerpt' as const }] }));
  const p = prov(await ask({ text: 'a stylish laptop under 2 lakhs' }, { live }));
  assert.equal(p.live.used, true); assert.ok(p.live.items >= 1); assert.equal(p.live.provider, 'fake-live'); assert.deepEqual(p.dataset.lenses, ['looks']);
});

test('direct actions get a receipt too, and a fallback or degraded reader is stated plainly', async () => {
  const p = prov(await ask({ action: 'compare', variant_ids: ['FKL-10', 'FKL-14'] })); assert.equal(p.catalog.used, true); assert.ok(p.dataset.opinions > 0);
  const d = prov(await ask({ text: 'laptop under 50k' }, { degraded: 'heavy_use' })); assert.equal(d.ai.degraded, 'heavy_use');
});

test('no data used means no receipt; the builder never claims a source the reply did not use', () => {
  const s = { DATA_STATUS: { prices_as_of: '2026-11-10' } } as any;
  assert.equal(buildProvenance({ blocks: [{ type: 'text', text: 'hi' }], routerMode: 'offline', settings: s, gateRan: false }), null);
  const p = buildProvenance({ blocks: [{ type: 'live_reviews', status: 'ok', items: [{}, {}], fetched_at: '2026-11-13T10:00:00Z' }], routerMode: 'model', settings: s, gateRan: false })!;
  assert.equal(p.catalog.used, false); assert.equal(p.dataset.used, false); assert.equal(p.live.items, 2);
});
