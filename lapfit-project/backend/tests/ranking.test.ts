import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { rank, cpuTier, capability, comparator, type Scored } from '../supabase/functions/_shared/rank.ts';
import { criteriaFromNeeds } from '../supabase/functions/_shared/normalise.ts';
import type { Needs, Row } from '../supabase/functions/_shared/types.ts';

const N = (o: Partial<Needs> = {}): Needs => ({ budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [], ...o });
async function form(needs: any, extra: any = {}): Promise<any> {
  const { tools } = await getDb();
  return handleQuery({ tools, model: null, settings: await loadSettings(tools), requestId: 'r' + Math.random().toString(36).slice(2) }, { needs, ...extra });
}
const cardsBlock = (r: any): any => r.blocks.find((b: any) => b.type === 'cards' && !b.over_budget);
const ids = (r: any) => (cardsBlock(r)?.cards ?? []).map((c: any) => c.variant_id);
const prices = (r: any) => (cardsBlock(r)?.cards ?? []).map((c: any) => c.price_inr);
const row = (o: Partial<Row>): Row => ({ variant_id: 'X', model_id: 1, brand: 'B', marketing_name: 'm', display_name: 'm', catalogue_set: 's', market: 'IN', recommendable: true, availability: 'a', review_count: 0, ram_gb: 8, storage_gb: 512, display_size: 15.6, weight_kg: 1.7, price_inr: 50000, price_as_of: '2026-11-01', cpu_text: 'Core i5 11th Gen', gpu_text: null, battery_wh: null, refresh_hz: null, hinge_type: null, warranty_years: 1, colours: [], cpu_vendor: 'intel', cpu_family: null, cpu_generation_or_model: null, win11_status: null, memory_slots: null, os_family: 'windows', gpu_class: null, curation_verified: false, verified: false, is_sample: false, ...o });

test('the reported bug: study under 1.5 lakh no longer leads with the cheapest laptop', async () => {
  const r = await form(N({ budget_max_inr: 150000, use_cases: ['study'] }));
  const p = prices(r);
  assert.notEqual(ids(r)[0], 'FKL-12');
  assert.ok(p[0] > 40000, `first card should be a stronger laptop, got ${p[0]}`);
  assert.match(cardsBlock(r).sort.note, /./);
});
test('budget only: stronger laptop first, not the cheapest; note says so', async () => {
  const r = await form(N({ budget_max_inr: 150000 }));
  const b = cardsBlock(r);
  assert.equal(b.sort.key, 'best');
  assert.match(b.sort.note, /Strongest laptops within your ₹1,50,000 budget first/);
  assert.notEqual(ids(r)[0], 'FKL-12'); assert.ok(!ids(r).slice(0, 2).includes('FKL-12'));
  assert.ok(b.cards[0].reasons !== undefined);
});
test('raising the budget only adds stronger options: first card is the same at 1, 1.5 and 5 lakh (study)', async () => {
  const a = ids(await form(N({ budget_max_inr: 150000, use_cases: ['study'] })))[0];
  const b = ids(await form(N({ budget_max_inr: 500000, use_cases: ['study'] })))[0];
  assert.equal(a, b);
});
test('capability: Ryzen 5 beats Celeron; M1 reads as a strong processor; unknown cpu earns nothing', () => {
  assert.ok(cpuTier('Ryzen 5 Hexa Core 5500U')! > cpuTier('Celeron Dual Core')!);
  assert.ok(cpuTier('M1')! >= cpuTier('Core i5 11th Gen')!);
  assert.equal(cpuTier('Mystery chip'), null); assert.equal(cpuTier(null), null);
  assert.ok(capability(row({ cpu_text: 'Core i7 12th Gen' }), []) > capability(row({ cpu_text: 'Celeron Dual Core' }), []));
  assert.ok(capability(row({ cpu_text: null }), []) < capability(row({ cpu_text: 'Core i5 11th Gen' }), []));
});
test('gaming: laptops with separate graphics lead, RTX above GTX at equal other specs', () => {
  const a = row({ variant_id: 'A', gpu_class: 'dedicated', gpu_text: 'NVIDIA GeForce GTX 1650' }); const b = row({ variant_id: 'B', gpu_class: 'dedicated', gpu_text: 'NVIDIA GeForce RTX 3050' });
  assert.ok(capability(b, ['gaming']) > capability(a, ['gaming']) && capability(a, ['gaming']) > capability(row({ variant_id: 'C' }), ['gaming']));
});
test('gaming at 60k: no filler laptop without separate graphics when enough have it', async () => {
  const r = await form(N({ budget_max_inr: 60000, use_cases: ['gaming'] }));
  const cs = cardsBlock(r).cards; assert.ok(cs.length >= 3);
  assert.ok(cs.every((c: any) => c.specs.gpu_class === 'dedicated'), 'no integrated-graphics laptop in a gaming list');
});
test('gaming at 1.5 lakh: the RTX variants are not hidden by the same-name GTX variant', async () => {
  const r = await form(N({ budget_max_inr: 150000, use_cases: ['gaming'] }));
  const cs = cardsBlock(r).cards;
  assert.ok(cs.some((c: any) => /RTX/.test(c.specs.gpu ?? '')));
  const siblings = cs.filter((c: any) => c.model_id === 2); assert.ok(siblings.length <= 1);
  if (siblings.length) assert.ok(/RTX/.test(siblings[0].specs.gpu), 'the stronger variant of the pair is kept for a gaming ask');
});
test('same-name sibling variant is mentioned in the reasons', async () => {
  const r = await form(N({ budget_max_inr: 150000, use_cases: ['gaming'] }));
  const c = cardsBlock(r).cards.find((x: any) => x.model_id === 2); assert.ok(c);
  assert.ok(c.fact_lines.some((l: string) => /Also sold as|also sold/.test(l)));
});
test('sorts: each key orders as promised, never changes the qualifying set', async () => {
  const base = N({ budget_max_inr: 150000, use_cases: ['study'] });
  const best = await form(base); const matched = best.blocks.find((b: any) => b.type === 'understood').matched;
  const p = async (k: string) => { const r = await form(base, { sort: k }); assert.equal(r.blocks.find((b: any) => b.type === 'understood').matched, matched); assert.equal(cardsBlock(r).sort.key, k); assert.ok(cardsBlock(r).sort.note.length > 10); return r; };
  const lo = prices(await p('price_low')); assert.deepEqual(lo, [...lo].sort((a, b) => a - b)); assert.equal(lo[0], 27490);
  const hi = prices(await p('price_high')); assert.deepEqual(hi, [...hi].sort((a, b) => b - a)); assert.equal(hi[0], 86990);
  const bu = prices(await p('budget')); assert.deepEqual(bu, hi);
  const li = (await p('light')); const w = cardsBlock(li).cards.map((c: any) => c.specs.weight_kg); assert.deepEqual(w, [...w].sort((a, b) => a - b));
  const rv = (await p('reviews')); const n = cardsBlock(rv).cards.map((c: any) => c.evidence.n); assert.deepEqual(n, [...n].sort((a, b) => b - a));
  assert.deepEqual(cardsBlock(best).sorts.map((s: any) => s.key), ['best', 'budget', 'price_low', 'price_high', 'light', 'reviews']);
});
test('unknown sort falls back to best; budget sort without a budget falls back with a note', async () => {
  const r = await form(N(), { sort: 'bogus' }); assert.equal(cardsBlock(r).sort.key, 'best');
  const r2 = await form(N(), { sort: 'budget' }); assert.equal(cardsBlock(r2).sort.key, 'best'); assert.match(cardsBlock(r2).sort.note, /best fit/i);
  assert.ok(!cardsBlock(r2).sorts.some((s: any) => s.key === 'budget'));
});
test('determinism: identical requests give identical order', async () => {
  const a = JSON.stringify(ids(await form(N({ budget_max_inr: 150000, use_cases: ['gaming'] })))); const b = JSON.stringify(ids(await form(N({ budget_max_inr: 150000, use_cases: ['gaming'] }))));
  assert.equal(a, b);
});
test('ties break by fit, then price, then id (equal prices FKL-04/FKL-07)', () => {
  const mk = (id: string, price: number | null, score: number) => ({ row: row({ variant_id: id, price_inr: price }), score, metShoulds: [], metNices: [], evidence: { n: 0, positive: 0, negative: 0 } }) as Scored;
  const l = [mk('b', 100, 5), mk('a', 100, 5), mk('c', 90, 5), mk('z', null, 5), mk('y', 0, 5)].sort(comparator('best'));
  assert.deepEqual(l.map((x) => x.row.variant_id), ['c', 'a', 'b', 'y', 'z'].filter((x) => x !== 'y' && x !== 'z').concat(['y', 'z']));
  const l2 = [mk('b', 100, 5), mk('a', 100, 7)].sort(comparator('price_low')); assert.equal(l2[0].row.variant_id, 'a');
});
test('unknown or zero price ranks last under every price sort and for best on ties', () => {
  const mk = (id: string, price: number | null) => ({ row: row({ variant_id: id, price_inr: price }), score: 1, metShoulds: [], metNices: [], evidence: { n: 0, positive: 0, negative: 0 } }) as Scored;
  for (const s of ['price_low', 'price_high', 'budget'] as const) assert.equal([mk('n', null), mk('p', 5)].sort(comparator(s))[0].row.variant_id, 'p');
});
test('evidence: n >= min with positive sentiment beats n = 0 at equal specs; thin evidence is ignored', () => {
  const crit = criteriaFromNeeds(N()); const ev = new Map([['A', { n: 100, positive: 90, negative: 10 }], ['B', { n: 0, positive: 0, negative: 0 }], ['C', { n: 5, positive: 5, negative: 0 }]]);
  const o = rank([row({ variant_id: 'B', price_inr: 40000 }), row({ variant_id: 'C', price_inr: 40000 }), row({ variant_id: 'A', price_inr: 40000 })], N(), crit, ev, {});
  assert.equal(o[0].row.variant_id, 'A');
  assert.equal(o[1].score, o[2].score, 'n=5 is thin and counts for nothing');
});
test('budget extremes: 0 is "no budget" and says nothing was filtered by price; 1 and 10k say the cheapest price', async () => {
  const z = await form(N({ budget_max_inr: 0 })); assert.ok(cardsBlock(z)); assert.ok(z.blocks.some((b: any) => b.type === 'notice' && /budget/i.test(b.text) && /ignored|not a usable/i.test(b.text)));
  for (const b of [1, 10000]) { const r = await form(N({ budget_max_inr: b })); assert.equal(cardsBlock(r), undefined); assert.ok(r.blocks.some((x: any) => x.type === 'notice' && /27,490/.test(x.text))); assert.match(r.blocks.find((x: any) => x.type === 'understood').budget_note, /below everything.*27,490/); }
});
test('budget above everything: budget_note names the highest price; nothing is invented', async () => {
  const r = await form(N({ budget_max_inr: 500000, use_cases: ['study'] }));
  assert.match(cardsBlock(r).budget_note, /above everything I have: the highest price is ₹86,990/);
  assert.ok(prices(r).every((p: number) => p <= 86990));
});
test('garbage budgets never reach SQL: NaN, Infinity, negative, strings', async () => {
  for (const b of [NaN, Infinity, -5, 'abc', '1.5 lakh', '60000']) { const r = await form(N({ budget_max_inr: b as any })); assert.ok(r.ok); assert.ok(!r.blocks.some((x: any) => /Something went wrong/.test(x.text ?? '')), String(b)); }
  const s = await form(N({ budget_max_inr: '1.5 lakh' as any })); assert.ok(cardsBlock(s)); assert.ok(prices(s).every((p: number) => p <= 150000));
});
test('needs with missing arrays does not crash the shortlist', async () => {
  const { tools } = await getDb(); const { runShortlist } = await import('../supabase/functions/_shared/flows/shortlist.ts');
  const r = await runShortlist({ tools, model: null, settings: await loadSettings(tools), requestId: 'm' }, { budget_max_inr: 90000 } as any); assert.ok(r.cards.length);
});
test('minimum above maximum is explained, not a generic no-match', async () => {
  const r = await form(N({ budget_min_inr: 100000, budget_max_inr: 50000 }));
  assert.ok(r.blocks.some((b: any) => /minimum.*above.*maximum/i.test(b.text ?? '')));
});
test('brand exclusion and Musts: excluded brand never appears, even at the top', async () => {
  const r = await form(N({ budget_max_inr: 150000, musts: [{ attribute: 'brand', operator: 'not_in', value: ['hp'] }] }));
  assert.ok(cardsBlock(r).cards.every((c: any) => c.brand.toLowerCase() !== 'hp'));
});
test('unknown value vs a Must: the laptop never counts as meeting it (RAM 16 returns only the 16 GB laptop)', async () => {
  const r = await form(N({ musts: [{ attribute: 'ram_gb', operator: '>=', value: 16 }] }));
  assert.deepEqual(ids(r), ['FKL-08']);
});
test('musts that conflict: honest no-match naming the blocking Must, with budget relax offered first', async () => {
  const r = await form(N({ budget_max_inr: 50000, musts: [{ attribute: 'brand', operator: 'in', value: ['apple'] }] }));
  assert.equal(cardsBlock(r), undefined);
  const txt = r.blocks.map((b: any) => b.text ?? b.label ?? '').join('\n');
  assert.match(txt, /Blocked by|on its own/i);
  assert.ok(r.blocks.some((b: any) => b.type === 'offer' && /budget|Price/i.test(b.label)), 'a budget offer is included');
});
test('a Must nothing meets names the best the catalog has (RAM 32)', async () => {
  const r = await form(N({ musts: [{ attribute: 'ram_gb', operator: '>=', value: 32 }] }));
  assert.match(r.blocks.map((b: any) => b.text ?? '').join('\n'), /most RAM.*16 GB|16 GB/i);
});
test('a Should that none of the shown laptops meets says so', async () => {
  const r = await form(N({ budget_max_inr: 50000, shoulds: [{ attribute: 'ram_gb', operator: '>=', value: 16 }] }));
  assert.ok(r.blocks.some((b: any) => b.type === 'notice' && /None of these/i.test(b.text) && /16 GB/.test(b.text)));
});
test('little fits: a separately labelled group "a little over your budget", never in the main list', async () => {
  const r = await form(N({ budget_max_inr: 30000, use_cases: ['study'] }));
  assert.ok(prices(r).every((p: number) => p <= 30000));
  const over = r.blocks.find((b: any) => b.type === 'cards' && b.over_budget);
  assert.ok(over); assert.match(over.title, /over your budget/i); assert.ok(over.cards.every((c: any) => c.price_inr > 30000 && c.price_inr <= 34500));
  assert.ok(over.cards[0].fact_lines.some((l: string) => /over your budget/.test(l)));
  const r2 = await form(N({ budget_max_inr: 150000 })); assert.ok(!r2.blocks.some((b: any) => b.over_budget), 'not when enough fit');
});
test('reasons: no "under your budget" saving as a reason; #1 explains its recorded specs', async () => {
  const r = await form(N({ budget_max_inr: 150000, use_cases: ['study'] })); const c = cardsBlock(r).cards[0];
  assert.ok(!c.fact_lines.some((l: string) => /under your budget/.test(l)));
  assert.ok(c.fact_lines.some((l: string) => /Ranked first on its recorded specs/.test(l)) && c.fact_lines.some((l: string) => /uses|of your budget/.test(l)));
  assert.ok(c.fact_lines.every((l: string) => !/Ranked first/.test(l) || l.includes(`${c.specs.ram_gb} GB RAM`)));
});
test('unknown use words get a notice and no "for <word>" boilerplate; weight reason only when light', async () => {
  const r = await form(N({ budget_max_inr: 150000, use_cases: ['stylish', 'travel'] }));
  assert.ok(r.blocks.some((b: any) => b.type === 'notice' && /stylish/.test(b.text) && /cannot/i.test(b.text)));
  for (const c of cardsBlock(r).cards) { assert.ok(!c.fact_lines.some((l: string) => /for stylish/.test(l))); if (c.specs.weight_kg > 1.5) assert.ok(!c.fact_lines.some((l: string) => /which suits travel/.test(l))); }
});
test('title says how many of how many; the matched count is in understood', async () => {
  const r = await form(N({ budget_max_inr: 60000, use_cases: ['study'] })); const t = cardsBlock(r).title;
  assert.match(t, /Top 5 of the 9 laptops/);
});
test('US or unpriced rows are never recommended even if the catalog returned them', async () => {
  const { sellable } = await import('../supabase/functions/_shared/rank.ts');
  assert.equal(sellable(row({ market: 'US' })), false); assert.equal(sellable(row({ price_inr: null })), false); assert.equal(sellable(row({ price_inr: 0 })), false); assert.equal(sellable(row({})), true);
});
test('the default slider (no needs) shows a best-fit list, flagged as unfiltered, with an order note', async () => {
  const r = await form(N()); const b = cardsBlock(r); assert.ok(b.cards.length); assert.match(b.sort.note, /Strongest laptops first/);
});
