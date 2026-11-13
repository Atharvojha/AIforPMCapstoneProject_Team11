// Writes real handler replies to ../frontend/src/test/fixtures so the frontend tests render genuine backend output.
// Usage: npm run fixtures   (uses in-memory Postgres, the rules reader and a fake live source; no keys, no network)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../tests/helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { FakeLive } from '../supabase/functions/_shared/live.ts';
import { FakeModel } from '../supabase/functions/_shared/model.ts';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'src', 'test', 'fixtures');
fs.mkdirSync(out, { recursive: true });
const live = new FakeLive((q) => ({ items: [
  { snippet: `Owners of the ${q.laptop.split(' ').slice(0, 3).join(' ')} mention steady daily use. Example text, not a real review.`, url: 'https://example.test/reviews/1', site: 'example.test', topic: q.topic ?? '', kind: 'excerpt' as const },
  { snippet: 'A second example excerpt about build and keyboard. Example text, not a real review.', url: 'https://example.test/reviews/2', site: 'example.test', topic: '', kind: 'excerpt' as const },
] }));
const TEAM = 'Designer | 3 | editing | ₹90,000\nDeveloper | 5 | coding | ₹70,000\nAccounts | 2 | office | ₹45,000\nTotal budget ₹10 lakh';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const read = (o: any) => JSON.stringify({ kind: 'listing_screenshot', readable: true, confidence: 0.92, laptop: { brand: 'Lenovo', line: 'IdeaPad 3 Ryzen 5', ram_gb: 8, storage_gb: 512, cpu: 'Ryzen 5 5500U', price_inr: 46999 }, listing: { battery_health_pct: 65, os: 'Windows 11', has_serial: null, has_bill: false, seller_warranty_months: null, weight_kg: null, reason: 'upgrading' }, claims: [], text_seen: 'example', concerns: [], ...o });
const TAGGED = [{ id: 'amazon_in', name: 'Amazon.in', search: 'https://www.amazon.in/s?k={q}', tag_param: 'tag', tag: 'example-21' }, { id: 'flipkart', name: 'Flipkart', search: 'https://www.flipkart.com/search?q={q}', tag_param: 'affid', tag: 'exampleaff' }, { id: 'croma', name: 'Croma', search: 'https://www.croma.com/searchB?q={q}%3Arelevance', tag_param: null, tag: '' }];
const CASES: Record<string, { body: any; live?: boolean; degraded?: string; now?: string; model?: FakeModel; tagged?: boolean }> = {
  data_status: { body: { action: 'data_status' } },
  where_to_buy: { body: { action: 'where_to_buy', variant_id: 'FKL-10' } },
  where_to_buy_affiliate: { body: { action: 'where_to_buy', variant_id: 'FKL-10' }, tagged: true },
  image_listing: { body: { action: 'read_image', image: { mime: 'image/png', data: PNG } }, model: new FakeModel(() => read({})) },
  image_seller: { body: { action: 'read_image', image: { mime: 'image/png', data: PNG } }, model: new FakeModel(() => read({ kind: 'seller_message', laptop: { brand: 'HP', line: '14s', ram_gb: null, storage_gb: null, cpu: null, price_inr: null }, listing: {}, claims: [{ claim_text: 'It has 16 GB RAM', type: 'spec' }, { claim_text: 'Best laptop ever', type: 'opinion' }, { claim_text: 'Battery lasts 2 days', type: 'performance' }] })) },
  image_unreadable: { body: { action: 'read_image', image: { mime: 'image/png', data: PNG } }, model: new FakeModel(() => read({ kind: 'unreadable', readable: false, concerns: ['blurry'] })) },
  shortlist: { body: { text: 'laptop for coding under 60k' } },
  stylish: { body: { text: 'I am looking for a stylish laptop under 2 lakhs which has good battery life' }, live: true },
  offer: { body: { text: 'laptop under 1.4 kg for travel' } },
  nomatch: { body: { text: 'laptop under 20k with 32 GB RAM compulsory' } },
  second_opinion: { body: { action: 'second_opinion', variant_id: 'FKL-10' }, live: true },
  pitch: { body: { text: 'The shopkeeper told me this HP 14s has 16 GB RAM and a 3 year warranty' } },
  used: { body: { text: 'Used Macbook Air M1 8GB 256GB, asking 40000, battery health 65%, no bill' } },
  compare: { body: { action: 'compare', variant_ids: ['FKL-10', 'FKL-14', 'FKL-11'] } },
  owner_voice: { body: { action: 'owner_voice', variant_id: 'FKL-10', topic: 'battery' }, live: true },
  brand: { body: { text: 'which brand is more reliable for laptops' } },
  trending: { body: { text: 'what is trending right now' } },
  team: { body: { text: TEAM } },
  parent_ask: { body: { text: 'I want to buy a laptop for my father' } },
  sell: { body: { action: 'sell_plan', variant_id: 'FKL-10', sell: { age_years: 2, condition: 'fair', battery_health_pct: 70 } } },
  mylaptops: { body: { owned: [{ variant_id: 'FKL-10', purchase_date: '2024-03-15', price_paid: 90000 }, { variant_id: 'FKL-14' }] }, now: '2025-03-16T10:00:00Z' },
  help: { body: { text: 'hi' } },
  not_laptop: { body: { text: 'best phone under 20000?' } },
  catalog: { body: { action: 'catalog' } },
  clarify: { body: { text: 'hmm' } },
  degraded: { body: { text: 'laptop for coding under 60k' }, degraded: 'heavy_use' },
  pii: { body: { text: 'call me on 9876543210, laptop under 50k' } },
};
// Real picture URLs from the live catalog, so design review and tests see real pictures (they are only URLs).
const PICS = [
  { v: "FKL-01", url: "https://rukminim2.flixcart.com/image/480/480/xif0q/computer/k/k/r/fa706ihrb-hx041w-gaming-laptop-asus-original-imah3my8kb6tsnky.jpeg?q=80", site: "rukminim2.flixcart.com", desc: "The ASUS TUF Gaming A17 laptop is showcased in a sleek advertisement, featuring its graphite black design, 90Whr battery" },
  { v: "FKL-02", url: "https://rukmini1.flixcart.com/image/1500/1500/krtjgcw0/computer/p/n/g/15-ec2004ax-gaming-laptop-hp-original-imag5j3b48askf4b.jpeg?q=70", site: "rukmini1.flixcart.com", desc: "The sleek black HP Pavilion laptop with a purple illuminated logo and backlit keyboard is displayed against a white back" },
  { v: "FKL-03", url: "https://rukmini1.flixcart.com/image/1500/1500/kb1470w0/computer/z/5/f/msi-na-gaming-laptop-original-imafsh7ahbgkmvtm.jpeg?q=70", site: "rukmini1.flixcart.com", desc: "The MSI GF63 Thin laptop with an 11th generation Core i5 processor is displayed open, showcasing its sleek black design," },
  { v: "FKL-04", url: "https://rukmini1.flixcart.com/image/1500/1500/ks99aq80/computer/y/z/7/na-gaming-laptop-lenovo-original-imag5ve3jvhgvsnx.jpeg?q=70", site: "rukmini1.flixcart.com", desc: "The laptop screen displays a high-performance gaming interface with a sleek sports car and \"IdeaPad Gaming\" branding, sh" },
  { v: "FKL-05", url: "https://rukminim3.flixcart.com/image/480/480/xif0q/computer/p/r/1/-original-imahg52nsgjmxhza.jpeg?q=20", site: "rukminim3.flixcart.com", desc: "The ASUS TUF Gaming F15 laptop, featuring a Core i5 10th Gen processor, displays its vibrant orange and yellow \u201cTUF GAMI" },
  { v: "FKL-06", url: "https://assets.nvidia.partners/images/png/comgrdc8jb73d8j7.png", site: "assets.nvidia.partners", desc: "A black MSI gaming laptop with a 144 Hz display showcases its Intel Core i5 11th Gen processor and NVIDIA GeForce RTX gr" },
  { v: "FKL-07", url: "https://rukmini1.flixcart.com/image/1500/1500/krtjgcw0/computer/p/n/g/15-ec2004ax-gaming-laptop-hp-original-imag5j3b48askf4b.jpeg?q=70", site: "rukmini1.flixcart.com", desc: "The sleek black HP Pavilion laptop with a purple illuminated logo and backlit keyboard is displayed against a white back" },
  { v: "FKL-08", url: "https://in.store.asus.com/media/catalog/product/r/f/rf-m6500qf_cl_slvr_fngrprnt_1__1.jpg", site: "in.store.asus.com", desc: "The refurbished ASUS Vivobook Pro 15 laptop with Ryzen 7 octa-core AMD R7-4800H processor is displayed open, showcasing " },
  { v: "FKL-09", url: "https://5.imimg.com/data5/SELLER/Default/2022/10/YK/ED/WB/162122710/asus-vivobook-15-2021-core-i3-10th-gen-4-gb-512-gb-ssd-silver-color.jpg", site: "5.imimg.com", desc: "A silver ASUS VivoBook 15 laptop from 2022, powered by a Core i3 10th Gen processor, is shown open with its screen displ" },
  { v: "FKL-10", url: "https://rukminim3.flixcart.com/image/480/480/xif0q/screen-guard/tempered-glass/o/v/n/apple-macbook-air-m1-13-3-inch-lightwings-enriched-transparent-original-imag3gh5xftgbpg3.png?q=90", site: "rukminim3.flixcart.com", desc: "A silver MacBook Air with an M1 chip displays a vibrant, colorful abstract wallpaper on its screen, set against a plain " },
  { v: "FKL-11", url: "https://m.media-amazon.com/images/I/61q6x-ll5FL.jpg", site: "m.media-amazon.com", desc: "A silver Lenovo IdeaPad 3 laptop with a Ryzen 5 Hexa Core 5500U processor is open, displaying a vibrant abstract wallpap" },
  { v: "FKL-12", url: "https://m.media-amazon.com/images/I/61s7sJEpsVL.jpg", site: "m.media-amazon.com", desc: "A silver Lenovo IdeaPad 3 laptop with a Celeron Dual Core processor is open, displaying a vibrant screen wallpaper of a " },
  { v: "FKL-13", url: "https://rukminim3.flixcart.com/image/480/480/xif0q/computer/9/k/j/-enriched-transparent-original-imahg5fxdsurqysm.png?q=90", site: "rukminim3.flixcart.com", desc: "The laptop screen displays the HP logo and a promotional message about India's number one brand, featuring a silver keyb" },
  { v: "FKL-14", url: "https://rukmini1.flixcart.com/image/1500/1500/xif0q/computer/b/w/w/-original-imagp7pfyd8rbp6z.jpeg?q=70", site: "rukmini1.flixcart.com", desc: "The HP 14s laptop with an Intel Core i3 11th Gen processor is displayed open, showcasing its silver body, black screen b" },
];
const { tools, db } = await getDb(); const settings = await loadSettings(tools);
for (const p of PICS) await db.query('insert into laptop_image (variant_id, url, site, description, position) values ($1, $2, $3, $4, 0) on conflict do nothing', [p.v, p.url, p.site, p.desc]);
for (const [name, c] of Object.entries(CASES)) {
  const st: any = c.tagged ? { ...settings, RETAILERS: TAGGED } : settings;
  const reply = await handleQuery({ tools, model: c.model ?? null, live: c.live ? live : null, degraded: c.degraded, settings: st, requestId: `fx-${name}`, now: c.now ? () => new Date(c.now!) : undefined }, c.body);
  reply.timings = undefined;
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ request: c.body, reply }, null, 2));
  console.log(name.padEnd(15), reply.flow, reply.blocks.map((b: any) => b.type).join(','));
}
process.exit(0);
