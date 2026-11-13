import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';

async function ask(body: any) { const { tools } = await getDb(); const settings: any = await loadSettings(tools); return handleQuery({ tools, model: null, settings, requestId: 'k' + Math.random().toString(36).slice(2) }, { session_hash: 'looks', ...body }); }

test('the catalog list carries screen, weight, battery, refresh rate and graphics type for every laptop (null when unknown)', async () => {
  const c = (await ask({ action: 'catalog' })).blocks.find((b: any) => b.type === 'catalog') as any; assert.ok(c.rows.length >= 14);
  for (const r of c.rows) for (const k of ['display_size', 'weight_kg', 'battery_wh', 'refresh_hz', 'gpu_class']) assert.ok(k in r, `${r.variant_id} lacks ${k}`);
  const mba = c.rows.find((r: any) => r.variant_id === 'FKL-10'); assert.equal(Number(mba.display_size), 13.3); assert.equal(Number(mba.weight_kg), 1.29);
});

test('a laptop card carries battery, refresh rate and graphics type in its specs; compare carries screen size and weight per laptop', async () => {
  const so = (await ask({ action: 'second_opinion', variant_id: 'FKL-10' })).blocks.find((b: any) => b.type === 'cards') as any; const s = so.cards[0].specs; for (const k of ['battery_wh', 'refresh_hz', 'gpu_class']) assert.ok(k in s);
  const cmp = (await ask({ action: 'compare', variant_ids: ['FKL-10', 'FKL-14'] })).blocks.find((b: any) => b.type === 'compare') as any;
  assert.equal(Number(cmp.laptops[0].screen_in), 13.3); assert.equal(Number(cmp.laptops[1].screen_in), 14); assert.ok(cmp.laptops.every((l: any) => 'weight_kg' in l && l.brand));
});
