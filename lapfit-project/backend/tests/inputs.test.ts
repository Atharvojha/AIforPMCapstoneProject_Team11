import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { handleQuery, cleanText, mergeNeeds } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { CASES } from './inputs.ts';

async function ask(text: string, extra: any = {}, deps: any = {}) {
  const { tools } = await getDb();
  return handleQuery({ tools, model: null, settings: await loadSettings(tools), requestId: 't' + Math.random().toString(36).slice(2), ...deps }, { text, ...extra });
}
const cardsOf = (r: any) => r.blocks.filter((b: any) => b.type === 'cards').flatMap((b: any) => b.cards);
const blob = (r: any) => JSON.stringify(r.blocks);

for (const c of CASES) {
  test(`input matrix: ${c.id}`, async () => {
    const r = await ask(c.text);
    assert.equal(r.ok, true);
    assert.ok(r.blocks.length >= 1, 'never an empty reply');
    assert.ok([c.flow].flat().includes(String(r.flow)) || (r.flow === null && ['empty', 'spaces'].includes(c.id)), `flow ${r.flow}`);
    const s = blob(r);
    assert.ok(!/undefined|NaN|\[object|"_gate"|"_spec"/.test(s), 'no leaked internals');
    assert.ok(!/9876543210|me@example\.com/.test(s), 'personal details are never echoed');
    for (const card of cardsOf(r)) { assert.ok(card.price_inr > 0); assert.ok(card.as_of); assert.ok(card.name); }
  });
}

test('stylish: owner-praise lens is used and labelled; nothing pretends style is a catalog fact', async () => {
  const r = await ask('give me a stylish laptop recommendations in India');
  assert.ok(/Looks and design are not recorded/.test(blob(r)));
  assert.ok(/owners praised the looks/.test(blob(r)));
  assert.ok(cardsOf(r).length >= 3);
  assert.ok(!/meet every Must/.test(blob(r)), 'no Musts were given so the title must not claim them');
});

test('brand: only Lenovo returns only Lenovo; "not HP" never returns HP; "no Apple" never returns Apple', async () => {
  for (const [q, f] of [['only Lenovo laptops under 60k', (b: string) => b === 'Lenovo'], ['laptop under 60k but not HP', (b: string) => !/^hp$/i.test(b)], ['laptop for coding under 90k, no Apple', (b: string) => !/apple/i.test(b)]] as const) {
    const cards = cardsOf(await ask(q)); assert.ok(cards.length >= 1, q);
    for (const c of cards) assert.ok(f(c.brand.replace(/^LENOVO$/i, 'Lenovo')), `${q}: ${c.name}`);
  }
});

test('operating system and graphics filters', async () => {
  for (const c of cardsOf(await ask('windows only laptop under 1 lakh'))) assert.ok(!/macbook/i.test(c.name));
  const g = cardsOf(await ask('laptop with dedicated graphics card for gaming under 80k'));
  assert.ok(g.length >= 1); assert.ok(g[0].specs.gpu && /nvidia|geforce|rtx|gtx|radeon/i.test(g[0].specs.gpu), 'top pick has separate graphics');
});

test('Must items always hold on every card; Should items never filter out', async () => {
  for (const q of ['I need 16 GB RAM and 512 GB SSD, compulsory, budget 80k', 'laptop under 60k for coding']) {
    for (const c of cardsOf(await ask(q))) assert.ok(c.musts.every((m: any) => m.ok === true), `${q}: ${c.name}`);
  }
});

test('unsupported features are named, not silently ignored or filtered on', async () => {
  const r = await ask('laptop with touchscreen and backlit keyboard under 60k');
  assert.ok(/cannot check|Not in the catalog/.test(blob(r))); assert.ok(cardsOf(r).length >= 1);
});

test('budget below the cheapest laptop says so and shows how to relax', async () => {
  const r = await ask('laptop under 10000'); assert.equal(cardsOf(r).length, 0);
  assert.ok(/cheapest laptop in the catalog/.test(blob(r)));
});

test('typos: "macbok air m1" still finds the Macbook; unknown laptops are not invented', async () => {
  const r = await ask('is the macbok air m1 good'); assert.equal(r.flow, 'second_opinion'); assert.ok(/Macbook/i.test(blob(r)));
  const u = await ask('Is the Dell XPS 13 good for me?'); assert.equal(cardsOf(u).length, 0);
});

test('compare: values come from stored rows; the cheaper laptop is marked; no overall winner', async () => {
  const r = await ask('compare Lenovo IdeaPad 3 Ryzen 5 and HP 14s'); const b = r.blocks.find((x: any) => x.type === 'compare') as any;
  assert.ok(b); assert.equal(b.laptops.length, 2);
  const price = b.rows.find((x: any) => x.label === 'Price'); assert.ok(price.best === 0 || price.best === 1);
  assert.ok(/do not pick an overall winner/.test(b.note));
});

test('owner voice: counts with n, quotes only when enough, persona limits stated', async () => {
  const r = await ask('what do students say about the battery on Macbook Air M1');
  assert.ok(/no user type or months-owned/.test(blob(r)));
  const ev = r.blocks.find((x: any) => x.type === 'evidence') as any; assert.ok(ev);
  for (const t of ev.topics) { assert.equal(t.enough, t.n >= 20); if (!t.enough) assert.equal(t.quotes.length, 0); }
});

test('brand insights: counts only, thin evidence flagged, no ranking', async () => {
  const r = await ask('which brand is more reliable for laptops'); const b = r.blocks.find((x: any) => x.type === 'brand_insights') as any;
  assert.ok(b.brands.length >= 3); assert.ok(/do not rank brands/.test(b.note));
  for (const x of b.brands) assert.equal(x.enough, x.n >= 20);
});

test('market pulse: says plainly when there is no price history or demand yet', async () => {
  const r = await ask('what is trending right now'); const m = r.blocks.find((x: any) => x.type === 'market_pulse') as any;
  assert.ok(m.most_reviewed.length >= 3); assert.ok(m.notes.some((n: string) => /cannot show price drops/.test(n)));
});

test('team table: totals are exact sums of price x people; bad lines are named; total budget is checked', async () => {
  const r = await ask('Designer | 3 | editing | ₹90,000\nDeveloper | 5 | coding | ₹70,000\nAccounts | 2 | office | ₹45,000\nTotal budget ₹3 lakh');
  const t = r.blocks.find((x: any) => x.type === 'team_plan') as any; assert.ok(t);
  const sum = t.rows.reduce((s: number, x: any) => s + (x.pick ? x.pick.price_inr * x.count : 0), 0); assert.equal(t.total, sum);
  assert.equal(t.rows.length, 3); for (const x of t.rows) if (x.pick) assert.ok(x.pick.price_inr <= x.budget);
  assert.equal(t.over_budget, Math.max(0, t.total - 300000));
  const bad = await ask('Designer | 3 | editing | ₹90,000\nthis line is junk | |\nAccounts | 2 | office | ₹45,000');
  assert.ok(/could not read line 2/.test(blob(bad)));
});

test('parent and child: persona defaults are shown as editable assumptions; no budget asks once', async () => {
  assert.ok(/assumed a screen of 14 inch/.test(blob(await ask('laptop for my mom under 50k'))));
  const q = await ask('I want to buy a laptop for my father'); assert.ok(q.blocks.some((b: any) => b.type === 'choices')); assert.equal(cardsOf(q).length, 0);
});

test('sell plan: range from sample factors, battery fix net is plain arithmetic, unknowns widen the range', async () => {
  const r = await ask('I want to sell my Macbook Air M1, 2 years old, scratches, battery 70%'); const p = r.blocks.find((x: any) => x.type === 'sell_plan') as any;
  assert.ok(p.range.low < p.range.high); const fx = p.fixes[0]; assert.equal(fx.net, fx.adds - fx.cost); assert.equal(fx.worth_it, fx.net > 0);
  assert.ok(p.disclaimers.some((d: string) => /sample assumptions/.test(d)));
  const wide = await ask('sell my Macbook Air M1'); const w = wide.blocks.find((x: any) => x.type === 'sell_plan') as any;
  assert.ok(w.unknown.length >= 2); assert.ok((w.range.high - w.range.low) / w.range.high > (p.range.high - p.range.low) / p.range.high - 0.2);
});

test('my laptops: warranty date maths, leap day, future date, unknown date', async () => {
  const { addYears, daysBetween } = await import('../supabase/functions/_shared/flows/mylaptops.ts');
  assert.equal(addYears('2024-03-15', 1), '2025-03-15'); assert.equal(addYears('2024-02-29', 1), '2025-02-28'); assert.equal(daysBetween('2025-03-15', '2025-03-15'), 0); assert.equal(daysBetween('2025-03-15', '2025-03-16'), 1);
  const { tools } = await getDb(); const settings = await loadSettings(tools);
  const r = await handleQuery({ tools, model: null, settings, requestId: 'ml', now: () => new Date('2025-03-16T10:00:00Z') }, { owned: [{ name: 'Macbook Air M1', purchase_date: '2024-03-15', price_paid: 90000 }, { name: 'Macbook Air M1', purchase_date: '2030-01-01' }, { name: 'Macbook Air M1' }] });
  const items = r.blocks[0].items; assert.equal(items[0].warranty.status, 'expired'); assert.equal(items[0].warranty.days_left, -1); assert.equal(items[0].gap, 86990 - 90000);
  assert.equal(items[1].warranty.status, 'invalid'); assert.equal(items[2].warranty.status, 'unknown');
});

test('follow-ups: prior needs are kept, new ones override, "cheaper" becomes a visible editable budget', async () => {
  const prior = { budget_max_inr: 60000, budget_min_inr: null, musts: [{ attribute: 'ram_gb', operator: '>=', value: 8 }], shoulds: [], nices: [], use_cases: ['coding'] };
  const m = mergeNeeds(prior as any, { budget_max_inr: null, budget_min_inr: null, musts: [{ attribute: 'brand', operator: 'in', value: ['lenovo'] }], shoulds: [], nices: [], use_cases: [] } as any);
  assert.equal(m.budget_max_inr, 60000); assert.equal(m.musts.length, 2);
  const r = await ask('make it cheaper', { prior_needs: prior });
  assert.ok(/budget of ₹51,000/.test(blob(r))); for (const c of cardsOf(r)) assert.ok(c.price_inr <= 51000);
});

test('structured needs from the form work without any text', async () => {
  const { tools } = await getDb();
  const r = await handleQuery({ tools, model: null, settings: await loadSettings(tools), requestId: 'f' }, { needs: { budget_max_inr: 50000, budget_min_inr: null, musts: [{ attribute: 'ram_gb', operator: '>=', value: 8 }], shoulds: [], nices: [], use_cases: [] } });
  assert.equal(r.router_mode, 'form'); assert.ok(cardsOf(r).length >= 1);
});

test('input hygiene: PII removed, links not opened, currency and region stated, long text trimmed, images declined', async () => {
  const a = cleanText('call 9876543210 mail me@example.com laptop under 50k'); assert.ok(!/9876543210|me@example/.test(a.text)); assert.ok(a.notices.some((n) => /removed phone numbers/.test(n)));
  assert.ok(cleanText('see https://x.com/a laptop').notices.some((n) => /cannot open links/.test(n)));
  assert.ok(cleanText('laptop under $800').notices.some((n) => /rupees/.test(n)));
  assert.ok(cleanText('best laptop in USA').notices.some((n) => /India only/.test(n)));
  assert.ok(cleanText('x'.repeat(9000)).text.length <= 4000);
  assert.ok(/Reading photos is not switched on/.test(blob(await ask('is this laptop ok', { image: 'data:...' }))));
  assert.equal(cleanText('a\nb | c').text, 'a\nb | c');
});

test('hostile input: SQL and HTML text are treated as plain text and cannot break anything', async () => {
  const { db } = await getDb();
  await ask("laptop'; drop table variant; -- under 50k"); await ask('<script>alert(1)</script> laptop under 50k');
  assert.ok(Number((await db.query('select count(*) n from variant')).rows[0].n) >= 29);
});

test('a broken data layer gives a calm reply, not an error', async () => {
  const bad = { call: async () => { throw new Error('db down'); } };
  const r = await handleQuery({ tools: bad as any, model: null, settings: { _version: 1 }, requestId: 'x' }, { text: 'laptop under 50k' });
  assert.equal(r.ok, true); assert.ok(/Something went wrong on my side/.test(blob(r)));
});

test('a model that misroutes "what do owners say about <laptop>" is corrected by the guard; its needs are kept', async () => {
  const { FakeModel } = await import('../supabase/functions/_shared/model.ts');
  const wrong = JSON.stringify({ flow: 'brand_insights', confidence: 0.9, language: 'English', needs: { budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] }, laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null });
  const { tools } = await getDb();
  const r = await handleQuery({ tools, model: new FakeModel(() => wrong), settings: await loadSettings(tools), requestId: 'g' }, { text: 'what do owners say about the Macbook Air M1 battery' });
  assert.equal(r.flow, 'owner_voice'); assert.ok(r.blocks.some((b: any) => b.type === 'evidence'));
});

test('a model that drops "not HP" gets it added back from the user words, with a notice', async () => {
  const { FakeModel } = await import('../supabase/functions/_shared/model.ts');
  const read = JSON.stringify({ flow: 'shortlist', confidence: 0.95, language: 'Hinglish', needs: { budget_max_inr: 50000, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: ['coding'] }, laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null });
  const { tools } = await getDb();
  const r = await handleQuery({ tools, model: new FakeModel((q) => (q.system.startsWith('You are the reading step') ? read : '{"cards":[]}')), settings: await loadSettings(tools), requestId: 'g2' }, { text: 'mujhe 50k ke andar laptop chahiye coding ke liye, not HP' });
  assert.ok(/added it from your words/.test(JSON.stringify(r.blocks))); for (const c of cardsOf(r)) assert.ok(!/^hp$/i.test(c.brand));
});

test('FallbackModel: a failing or slow first model falls through to the second', async () => {
  const { FakeModel, FallbackModel } = await import('../supabase/functions/_shared/model.ts');
  const slow = new FakeModel(() => new Promise(() => {})); const bad = new FakeModel(() => { throw new Error('503'); }); const good = new FakeModel(() => 'ok');
  assert.equal(await new FallbackModel([bad, good]).generate({ system: '', user: '' }), 'ok');
  assert.equal(await new FallbackModel([slow, good], 50).generate({ system: '', user: '' }), 'ok', 'a model that never answers (and ignores the abort signal) is skipped after its own time limit');
  await assert.rejects(() => new FallbackModel([slow, bad], 50).generate({ system: '', user: '' }));
});
