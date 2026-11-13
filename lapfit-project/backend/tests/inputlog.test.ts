import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './helpers.ts';
import { inputRecord, kindOf } from '../supabase/functions/_shared/inputlog.ts';

test('typed text is recorded in full, with other inputs kept as structured data', () => {
  const r = inputRecord(JSON.stringify({ text: 'laptop for coding under 60k, call me on 9876543210', session_hash: 'x' }))!;
  assert.equal(r.kind, 'text'); assert.equal(r.text, 'laptop for coding under 60k, call me on 9876543210'); assert.equal(r.payload, null);
  const n = inputRecord(JSON.stringify({ needs: { budget_max_inr: 60000, use_cases: ['coding'] }, session_hash: 'x' }))!; assert.equal(n.kind, 'needs'); assert.deepEqual((n.payload as any).needs.use_cases, ['coding']);
  const a = inputRecord(JSON.stringify({ action: 'sell_plan', variant_id: 'FKL-10', age_years: 2, condition: 'good' }))!; assert.equal(a.kind, 'action:sell_plan'); assert.equal((a.payload as any).age_years, 2);
  const e = inputRecord(JSON.stringify({ experience: { laptop: 'FKL-10', comment: 'battery is great' } }))!; assert.equal(e.kind, 'experience'); assert.equal((e.payload as any).experience.comment, 'battery is great');
});

test('pictures are never stored, automatic calls are skipped, and a malformed body is still recorded', () => {
  const img = inputRecord(JSON.stringify({ action: 'read_image', image: 'data:image/png;base64,' + 'A'.repeat(30000), kind: 'listing' }), true)!;
  assert.equal(img.kind, 'action:read_image'); assert.match(String((img.payload as any).image), /picture not stored/); assert.ok(JSON.stringify(img).length < 1000);
  for (const action of ['client_log', 'data_status', 'catalog', 'outbound_click']) assert.equal(inputRecord(JSON.stringify({ action })), null);
  assert.equal(inputRecord('{}'), null); assert.equal(inputRecord(''), null);
  const bad = inputRecord('not json at all')!; assert.equal(bad.kind, 'unparseable'); assert.equal(bad.text, 'not json at all');
  assert.equal(kindOf({ owned: [] }), 'owned');
});

test('very long text is cut to 5000 characters and large payloads are marked truncated', () => {
  assert.equal(inputRecord(JSON.stringify({ text: 'x'.repeat(9000) }))!.text.length, 5000);
  const big = inputRecord(JSON.stringify({ action: 'compare', notes: 'y'.repeat(12000) }))!; assert.equal((big.payload as any).truncated, true);
});

test('the log tool stores raw text by default, scrubs when raw is off, stops when disabled, and never stores an address', async () => {
  const { db, tools } = await getDb(); await db.query('delete from input_log');
  await tools.call('log_input', { request_id: 'r1', visitor: 'v1', kind: 'text', text: 'mail me a@b.com or 98765 43210? see https://x.test/p', payload: { needs: { note: 'call 9876543210' } }, raw_len: 60 });
  let row = (await db.query("select * from input_log where request_id = 'r1'")).rows[0]; assert.match(row.text_input, /a@b\.com/); assert.equal(row.scrubbed, false); assert.equal(row.visitor, 'v1');
  await db.query(`update settings set value = '{"enabled": true, "raw": false}'::jsonb where key = 'LOG_INPUTS'`);
  await tools.call('log_input', { request_id: 'r2', visitor: 'v1', kind: 'text', text: 'mail me a@b.com or 9876543210 see https://x.test/p', payload: { needs: { note: 'call 9876543210 or c@d.org' } } });
  row = (await db.query("select * from input_log where request_id = 'r2'")).rows[0]; assert.equal(row.scrubbed, true); assert.match(row.text_input, /\[email\]/); assert.match(row.text_input, /\[phone\]/); assert.match(row.text_input, /\[link\]/); assert.doesNotMatch(JSON.stringify(row.payload), /9876543210|c@d\.org/);
  await db.query(`update settings set value = '{"enabled": false, "raw": true}'::jsonb where key = 'LOG_INPUTS'`);
  const off = await tools.call<any>('log_input', { request_id: 'r3', visitor: 'v1', kind: 'text', text: 'hello' }); assert.equal(off.stored, false); assert.equal((await db.query("select count(*)::int n from input_log where request_id = 'r3'")).rows[0].n, 0);
  await db.query(`update settings set value = '{"enabled": true, "raw": true}'::jsonb where key = 'LOG_INPUTS'`);
});

test('inputs are purged after their own retention and the table is closed to the public keys', async () => {
  const { db, tools } = await getDb(); await db.query('delete from input_log');
  await tools.call('log_input', { request_id: 'old', kind: 'text', text: 'old one' }); await tools.call('log_input', { request_id: 'new', kind: 'text', text: 'new one' });
  await db.query("update input_log set ts = now() - interval '40 days' where request_id = 'old'"); const r: any = (await db.query('select purge_logs() as r')).rows[0].r; assert.equal(r.input_log, 1);
  assert.deepEqual((await db.query('select request_id from input_log')).rows.map((x: any) => x.request_id), ['new']);
  const g = await db.query("select count(*)::int n from information_schema.role_table_grants where table_name = 'input_log' and grantee in ('anon','authenticated','PUBLIC')"); assert.equal(g.rows[0].n, 0);
});
