import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, withSetting } from './helpers.ts';
import { handleQuery, stripImages } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { imageOf } from '../supabase/functions/_shared/cards.ts';

async function seed() {
  const { db } = await getDb(); await db.query('delete from laptop_image');
  await db.query("insert into laptop_image (variant_id, url, site, description, position) values ('FKL-10', 'https://img.example.test/mba-1.jpg', 'img.example.test', 'A silver MacBook Air', 0), ('FKL-10', 'https://img.example.test/mba-2.jpg', 'img.example.test', 'second', 1), ('FKL-14', 'https://img.example.test/hp14.jpg', 'img.example.test', 'An HP 14s', 0)");
}
async function ask(body: any, mut?: (s: any) => void) { const { tools } = await getDb(); const settings: any = await loadSettings(tools); mut?.(settings); return handleQuery({ tools, model: null, settings, requestId: 'i' + Math.random().toString(36).slice(2) }, { session_hash: 'img', ...body }); }
const cards = (r: any) => r.blocks.filter((b: any) => b.type === 'cards').flatMap((b: any) => b.cards);
const so = (id: string, mut?: (s: any) => void) => ask({ action: 'second_opinion', variant_id: id }, mut);

test('a laptop card carries its first picture (by position) with attribution; laptops without one carry null', async () => {
  await seed(); const mba = cards(await so('FKL-10')).find((c: any) => c.variant_id === 'FKL-10'); const hp = cards(await so('FKL-14')).find((c: any) => c.variant_id === 'FKL-14');
  assert.deepEqual(mba.image, { url: 'https://img.example.test/mba-1.jpg', site: 'img.example.test', page: null, alt: 'A silver MacBook Air' }); assert.equal(hp.image.url, 'https://img.example.test/hp14.jpg');
  const other = cards(await so('FKL-11')).find((c: any) => c.variant_id === 'FKL-11'); assert.equal(other.image, null);
});

test('compare carries a picture per laptop', async () => {
  await seed(); const c = (await ask({ action: 'compare', variant_ids: ['FKL-10', 'FKL-14'] })).blocks.find((b: any) => b.type === 'compare') as any;
  assert.equal(c.laptops[0].image.url, 'https://img.example.test/mba-1.jpg'); assert.equal(c.laptops[1].image.site, 'img.example.test');
});

test('the kill switch removes every picture from every kind of reply without touching anything else', async () => {
  await seed(); const on = await so('FKL-10'); const off = await so('FKL-10', (s) => { s.FEATURE_FLAGS = { ...s.FEATURE_FLAGS, web_images: false }; });
  assert.ok(cards(on).some((c: any) => c.image)); assert.ok(cards(off).every((c: any) => c.image === null)); assert.deepEqual(cards(on).map((c: any) => c.variant_id), cards(off).map((c: any) => c.variant_id));
  const cmpOff = (await ask({ action: 'compare', variant_ids: ['FKL-10', 'FKL-14'] }, (s) => { s.FEATURE_FLAGS = { web_images: false }; })).blocks.find((b: any) => b.type === 'compare') as any; assert.ok(cmpOff.laptops.every((l: any) => l.image === null));
  const sh = await ask({ text: 'laptop under 90k' }, (s) => { s.FEATURE_FLAGS = { web_images: false }; }); assert.ok(cards(sh).length > 0); assert.ok(cards(sh).every((c: any) => c.image === null));
});

test('a rejected picture is never shown, and the next one takes its place', async () => {
  await seed(); const { db } = await getDb(); await db.query("update laptop_image set rejected = true where url like '%mba-1%'");
  assert.equal(cards(await so('FKL-10')).find((c: any) => c.variant_id === 'FKL-10').image.url, 'https://img.example.test/mba-2.jpg');
  await db.query("update laptop_image set rejected = true where variant_id = 'FKL-10'"); assert.equal(cards(await so('FKL-10')).find((c: any) => c.variant_id === 'FKL-10').image, null);
});

test('only https pictures can exist: the table refuses anything else, and the code ignores odd values', async () => {
  const { db } = await getDb(); await assert.rejects(() => db.query("insert into laptop_image (variant_id, url) values ('FKL-10', 'http://insecure.test/a.jpg')")); await assert.rejects(() => db.query("insert into laptop_image (variant_id, url) values ('FKL-10', 'javascript:alert(1)')"));
  assert.equal(imageOf({ image_url: 'javascript:alert(1)', display_name: 'X' } as any), null); assert.equal(imageOf({ image_url: null, display_name: 'X' } as any), null);
  assert.equal(imageOf({ image_url: 'https://a.test/p.jpg', image_page: 'http://bad.test', display_name: 'Brand · 8 GB' } as any)!.page, null); assert.equal(imageOf({ image_url: 'https://a.test/p.jpg', display_name: 'Brand · 8 GB' } as any)!.alt, 'Brand');
});

test('the answer receipt names the picture sources only when pictures are shown', async () => {
  await seed(); const p = (await so('FKL-10')).blocks.find((b: any) => b.type === 'provenance') as any; assert.equal(p.images.used, true); assert.deepEqual(p.images.sites, ['img.example.test']);
  const { db } = await getDb(); await db.query('delete from laptop_image'); const q = (await so('FKL-10')).blocks.find((b: any) => b.type === 'provenance') as any; assert.equal(q.images.used, false);
});

test('stripImages is safe on any block shape', () => { const blocks: any[] = [{ type: 'text' }, { type: 'cards', cards: [{ image: { url: 'x' } }] }, { type: 'compare', laptops: [{ image: { url: 'y' } }] }, { type: 'cards' }]; stripImages(blocks); assert.equal(blocks[1].cards[0].image, null); assert.equal(blocks[2].laptops[0].image, null); });
