import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, withSetting } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { buildLinks, searchText } from '../supabase/functions/_shared/flows/buy.ts';
import { CASES } from './inputs.ts';

const TAGGED = [{ id: 'amazon_in', name: 'Amazon.in', search: 'https://www.amazon.in/s?k={q}', tag_param: 'tag', tag: 'lapfit-21' }, { id: 'flipkart', name: 'Flipkart', search: 'https://www.flipkart.com/search?q={q}', tag_param: 'affid', tag: 'lapfitaff' }, { id: 'croma', name: 'Croma', search: 'https://www.croma.com/searchB?q={q}%3Arelevance', tag_param: null, tag: '' }];
async function ask(body: any, settingsOverride?: (s: any) => void) {
  const { tools } = await getDb(); const settings: any = await loadSettings(tools); settingsOverride?.(settings);
  return handleQuery({ tools, model: null, settings, requestId: 'm' + Math.random().toString(36).slice(2) }, { session_hash: 'mon', ...body });
}
const where = (r: any) => r.blocks.find((b: any) => b.type === 'where_to_buy');

test('with no affiliate tags configured, links are plain shop searches and no disclosure is shown (nothing is earned, so nothing is claimed)', async () => {
  const w = where(await ask({ action: 'where_to_buy', variant_id: 'FKL-10' }));
  assert.ok(w.links.length >= 2); assert.ok(w.links.every((l: any) => l.affiliate === false)); assert.equal(w.disclosure, null);
  const a = w.links.find((l: any) => l.id === 'amazon_in'); assert.match(a.url, /^https:\/\/www\.amazon\.in\/s\?k=APPLE%202020%20Macbook/); assert.ok(!/tag=/.test(a.url));
});

test('with tags configured, only those shops get an affiliate tag, are marked affiliate, and the disclosure is shown', async () => {
  const w = where(await ask({ action: 'where_to_buy', variant_id: 'FKL-10' }, (s) => { s.RETAILERS = TAGGED; }));
  const by = Object.fromEntries(w.links.map((l: any) => [l.id, l])); assert.equal(by.amazon_in.affiliate, true); assert.match(by.amazon_in.url, /[?&]tag=lapfit-21$/); assert.equal(by.flipkart.affiliate, true); assert.match(by.flipkart.url, /affid=lapfitaff$/);
  assert.equal(by.croma.affiliate, false); assert.ok(!/affid|tag=/.test(by.croma.url)); assert.match(w.disclosure, /may earn LapFit a small commission/); assert.match(w.disclosure, /never changes which laptops are shown or in what order/);
});

test('the receipt says affiliate links are present only when the reply really carries them', async () => {
  const off = (await ask({ action: 'where_to_buy', variant_id: 'FKL-10' })).blocks.find((b: any) => b.type === 'provenance') as any; assert.equal(off.affiliate.links, false);
  const on = (await ask({ action: 'where_to_buy', variant_id: 'FKL-10' }, (s) => { s.RETAILERS = TAGGED; })).blocks.find((b: any) => b.type === 'provenance') as any; assert.equal(on.affiliate.links, true);
});

test('THE RULE: commission can never change what is shown or in what order. Every kind of request gives the same answer with and without affiliate tags', async () => {
  const sig = (r: any) => JSON.stringify(r.blocks.filter((b: any) => b.type !== 'provenance').map((b: any) => (b.type === 'cards' ? { t: b.type, ids: b.cards.map((c: any) => c.variant_id), reasons: b.cards.map((c: any) => c.reasons) } : b)));
  for (const c of CASES.filter((x) => x.text.trim())) {
    const a = await ask({ text: c.text }); const b = await ask({ text: c.text }, (s) => { s.RETAILERS = TAGGED; s.AFFILIATE_DISCLOSURE = 'x'; });
    assert.equal(sig(a), sig(b), `${c.id}: the answer changed when affiliate tags were configured`);
  }
});

test('shortlists and second opinions carry no shop links at all: links appear only when the user asks where to buy', async () => {
  for (const q of [{ text: 'laptop for coding under 60k' }, { action: 'second_opinion', variant_id: 'FKL-10' }, { action: 'compare', variant_ids: ['FKL-10', 'FKL-14'] }]) {
    const r = await ask(q, (s) => { s.RETAILERS = TAGGED; }); assert.ok(!JSON.stringify(r.blocks).includes('amazon.in') && !JSON.stringify(r.blocks).includes('lapfit-21'));
  }
});

test('structural guarantee: the ranking, filtering, gate, wording and evidence code never reads shop or affiliate settings', () => {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/%20/g, ' ')), '..', 'supabase', 'functions', '_shared');
  for (const f of ['rank.ts', 'normalise.ts', 'gate.ts', 'reasons.ts', 'cards.ts', 'lens.ts', 'soft.ts', 'router.ts', 'flows/shortlist.ts', 'flows/compare.ts', 'flows/pitch.ts', 'flows/team.ts', 'flows/owner.ts', 'flows/market.ts']) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8'); assert.doesNotMatch(src, /RETAILERS|AFFILIATE|affiliate|outbound|where_to_buy|buy\.ts|commission/i, `${f} must not know about shops or commission`);
  }
});

test('links are built safely: https only, the search text is encoded, bad entries are skipped, tags are encoded', () => {
  const links = buildLinks([...TAGGED, { id: 'evil', name: 'Evil', search: 'javascript:alert(1)//{q}', tag_param: 'x', tag: 'y' }, { id: 'http', name: 'Plain', search: 'http://insecure.test/{q}', tag_param: null, tag: '' }, { id: '', name: 'No id', search: 'https://a.test/{q}', tag_param: null, tag: '' } as any, null as any], 'Apple Macbook Air & "M1" <script>');
  assert.deepEqual(links.map((l) => l.id), ['amazon_in', 'flipkart', 'croma']); assert.ok(links.every((l) => l.url.startsWith('https://') && !/[<>" ]/.test(l.url)));
  assert.match(buildLinks([{ ...TAGGED[0], tag: 'a b&c' }], 'x')[0].url, /tag=a%20b%26c$/); assert.deepEqual(buildLinks(undefined, 'x'), []); assert.deepEqual(buildLinks('nonsense' as any, 'x'), []);
  assert.equal(searchText({ brand: 'APPLE', marketing_name: '2020 Macbook Air M1', display_name: 'x' } as any), 'APPLE 2020 Macbook Air M1');
  assert.equal(searchText({ brand: 'APPLE', marketing_name: 'APPLE 2020 Macbook Air M1', display_name: 'x' } as any), 'APPLE 2020 Macbook Air M1', 'the brand is not repeated when the model name already has it');
});

test('clicks are counted per shop, with no identity, for known shops only, and never break the page', async () => {
  const { db } = await getDb(); await db.query('delete from outbound_click');
  await ask({ action: 'outbound_click', variant_id: 'FKL-10', retailer: 'amazon_in', from: 'cards' }, (s) => { s.RETAILERS = TAGGED; });
  await ask({ action: 'outbound_click', variant_id: 'FKL-10', retailer: 'croma' }, (s) => { s.RETAILERS = TAGGED; });
  await ask({ action: 'outbound_click', variant_id: 'FKL-10', retailer: 'made_up_shop' }); await ask({ action: 'outbound_click', retailer: undefined as any });
  const rows = (await db.query('select * from outbound_click order by id')).rows; assert.equal(rows.length, 2); assert.deepEqual(rows.map((r: any) => [r.retailer, r.affiliate]), [['amazon_in', true], ['croma', false]]); assert.equal(rows[0].visitor, 'mon'); assert.equal(rows[0].from_flow, 'cards');
  const d = (await db.query('select * from v_clicks_daily')).rows; assert.ok(d.length >= 2); assert.ok((await db.query('select * from v_clicks_by_laptop')).rows.length >= 1);
  const r = await ask({ action: 'outbound_click', variant_id: 'FKL-10', retailer: 'amazon_in' }); assert.equal(r.ok, true); assert.equal(r.blocks[0].type, 'ack');
});

test('an unknown laptop gets a plain message, not links', async () => { assert.match(JSON.stringify((await ask({ action: 'where_to_buy', variant_id: 'NOPE' })).blocks), /not in the catalog/); });
