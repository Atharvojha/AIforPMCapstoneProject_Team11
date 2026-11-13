import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';

async function cardsFor(needs: any) { const { tools } = await getDb(); const settings: any = await loadSettings(tools); const r: any = await handleQuery({ tools, model: null, settings, requestId: 'm' + Math.random().toString(36).slice(2) }, { session_hash: 'match', needs: { budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [], ...needs } }); return r.blocks.filter((b: any) => b.type === 'cards' && !b.over_budget).flatMap((b: any) => b.cards); }

test('every recommended card carries a match percentage between 0 and 100 with plain reasons, and the first is the highest for "best" order', async () => {
  const cards = await cardsFor({ budget_max_inr: 150000, use_cases: ['study'] }); assert.ok(cards.length >= 3);
  for (const c of cards) { assert.ok(c.match, c.name); assert.ok(Number.isInteger(c.match.pct) && c.match.pct >= 0 && c.match.pct <= 100); assert.match(c.match.label, /^\d+% match$/); assert.ok(c.match.basis.length >= 2); assert.match(c.match.basis.join(' '), /Strength for study: \d+% of the strongest laptop I have/); }
  assert.ok(cards[0].match.pct >= cards[cards.length - 1].match.pct); assert.ok(new Set(cards.map((c: any) => c.match.pct)).size > 1, 'percentages are not all the same');
});

test('unknown values are listed and not counted; Shoulds blend into the percentage', async () => {
  const none = await cardsFor({ budget_max_inr: 90000, use_cases: ['coding'] }); assert.ok(none.some((c: any) => c.match.basis.some((l: string) => /Not recorded, so not counted: /.test(l))));
  const withShould = await cardsFor({ budget_max_inr: 90000, use_cases: ['coding'], shoulds: [{ attribute: 'ram_gb', operator: '>=', value: 16, label: '16 GB RAM or more' }] });
  assert.ok(withShould[0].match.basis.some((l: string) => /Meets \d+ of 1 Shoulds? and 0 of 0 Nices/.test(l)));
});

test('free-form uses beyond the tiles are understood, "stock trading" is a laptop request, and an unrecognised use is said out loud', async () => {
  const { tools } = await getDb(); const settings: any = await loadSettings(tools); const ask = (text: string) => handleQuery({ tools, model: null, settings, requestId: 'u' + Math.random() }, { session_hash: 'u', text }) as Promise<any>;
  const uses = async (t: string) => (await ask(t)).blocks.find((b: any) => b.type === 'understood')?.needs?.use_cases ?? [];
  assert.deepEqual(await uses('laptop for architecture student using AutoCAD under 80k'), ['study', 'cad']); assert.ok((await uses('data science and machine learning laptop 1 lakh')).includes('data science')); assert.ok((await uses('music production laptop')).includes('music'));
  const trade: any = await ask('stock trading with multiple monitors under 60k'); assert.equal(trade.flow, 'shortlist'); assert.ok(trade.blocks.some((b: any) => b.type === 'cards'));
  const odd: any = await ask('laptop for bird watching under 60k'); assert.ok(odd.blocks.some((b: any) => b.type === 'notice' && /can't rank by "bird watching" directly/.test(b.text)), JSON.stringify(odd.blocks.filter((b: any) => b.type === 'notice')));
  const known: any = await ask('laptop for video editing under 90k'); assert.ok(!known.blocks.some((b: any) => b.type === 'notice' && /can't rank by/.test(b.text)));
});
