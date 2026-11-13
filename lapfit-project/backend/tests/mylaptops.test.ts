import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';

test('my laptops: a date before the model launched or in the future gets a clear reason, not a warranty line', async () => {
  const { tools } = await getDb(); const settings = await loadSettings(tools);
  const r: any = await handleQuery({ tools, model: null, settings, requestId: 'ml2', now: () => new Date('2026-11-14T10:00:00Z') }, { owned: [
    { name: 'Macbook Air M1', purchase_date: '2003-03-11' }, { name: 'Macbook Air M1', purchase_date: '2027-02-01' }, { name: 'Macbook Air M1', purchase_date: '2021-06-01', price_paid: 80000 }] });
  const it = r.blocks[0].items;
  assert.equal(it[0].warranty.status, 'invalid'); assert.match(it[0].warranty.note, /launched in 2020, so 11 Mar 2003 cannot be right/); assert.equal(it[0].date_check.kind, 'before_launch'); assert.equal(it[0].launch_year, 2020); assert.equal(it[0].resale, undefined); assert.equal(it[0].warranty.ends, undefined);
  assert.equal(it[1].warranty.status, 'invalid'); assert.match(it[1].warranty.note, /in the future/); assert.equal(it[1].date_check.kind, 'future');
  assert.equal(it[2].warranty.status, 'expired'); assert.ok(it[2].resale.low > 0); assert.equal(it[2].date_check, undefined);
});
