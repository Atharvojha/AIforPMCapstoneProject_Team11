// Find a few product pictures for each recommendable laptop model (Tavily image search), check each one really is an image,
// keep the ones whose description names this brand and model, and store them in laptop_image.
// Usage: node --env-file=.env --import tsx scripts/fetch-images.ts --via-cli [--dry]
// These are web images with an UNVERIFIED licence. They are shown with attribution and can be switched off (FEATURE_FLAGS.web_images).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cliDb, pgDb, type Db } from './lib/db.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes('--dry'); const key = process.env.TAVILY_API_KEY;
if (!key) { console.error('TAVILY_API_KEY is not set (put it in backend/.env).'); process.exit(1); }
const url = process.argv.find((a) => a.startsWith('--database-url='))?.split('=').slice(1).join('=') ?? process.env.DATABASE_URL;
const db: Db = process.argv.includes('--via-cli') ? await cliDb(path.resolve(here, '..')) : url ? await pgDb(url) : (() => { console.error('Use --via-cli or --database-url=…'); process.exit(1); })();

const GENERIC = new Set(['laptop', 'notebook', 'gen', 'core', 'intel', 'amd', 'hexa', 'octa', 'dual', 'quad', 'thin', 'light', 'with', 'and', 'the', 'new', 'series', 'inch']);
const ALIAS: Record<string, string[]> = { apple: ['apple', 'macbook'], hp: ['hp', 'pavilion'], asus: ['asus', 'vivobook', 'tuf', 'rog'], lenovo: ['lenovo', 'ideapad', 'thinkpad', 'legion'], msi: ['msi'], dell: ['dell', 'inspiron'], acer: ['acer', 'aspire', 'nitro'] };
const BAD = /\b(box|charger|adapter|bag|sleeve|case|cover|skin|sticker|stand|mouse|screen protector|battery pack|keyboard cover|ram stick|ssd stick)\b/i;
const toks = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 2 && !GENERIC.has(t) && !/^\d{4}$/.test(t));

const models = (await db.query(`select v.model_id, m.brand, m.marketing_name, array_agg(v.id order by v.id) as variants from variant v join laptop_model m on m.id = v.model_id where v.recommendable group by v.model_id, m.brand, m.marketing_name order by v.model_id`)).rows;
const parse = (x: any): string[] => (Array.isArray(x) ? x : String(x).replace(/[{}"]/g, '').split(',').filter(Boolean));

async function isImage(u: string): Promise<boolean> {
  try { const r = await fetch(u, { headers: { range: 'bytes=0-2047' }, signal: AbortSignal.timeout(8000) }); return (r.ok || r.status === 206) && /^image\//i.test(r.headers.get('content-type') ?? ''); } catch { return false; }
}
let totalPics = 0;
for (const m of models) {
  const name = String(m.marketing_name).toLowerCase().startsWith(String(m.brand).toLowerCase()) ? m.marketing_name : `${m.brand} ${m.marketing_name}`;
  const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ query: `${name} laptop`, search_depth: 'basic', max_results: 6, include_images: true, include_image_descriptions: true, country: 'india' }) });
  if (!res.ok) { console.log(`\n${name}: search failed (${res.status})`); continue; }
  const data: any = await res.json(); const need = toks(String(m.marketing_name)).filter((t) => t !== String(m.brand).toLowerCase()); const brands = ALIAS[String(m.brand).toLowerCase()] ?? [String(m.brand).toLowerCase()];
  const scored = (data.images ?? []).map((i: any) => ({ url: typeof i === 'string' ? i : i.url, desc: typeof i === 'string' ? '' : String(i.description ?? '') })).filter((i: any) => /^https:\/\//.test(i.url)).map((i: any) => {
    const d = i.desc.toLowerCase(); const brandHit = brands.some((b) => d.includes(b)); const hits = need.filter((t) => d.includes(t)).length;
    return { ...i, score: (brandHit ? 2 : -5) + hits * 2 + (/laptop|notebook|open/.test(d) ? 1 : 0) - (BAD.test(d) ? 6 : 0), hits };
  }).filter((i: any) => i.score >= 4 && i.hits >= 1).sort((a: any, b: any) => b.score - a.score);
  const kept: any[] = [];
  for (const c of scored) { if (kept.length >= 3) break; if (kept.some((k) => k.url === c.url)) continue; if (await isImage(c.url)) kept.push(c); }
  console.log(`\n${name}  (${parse(m.variants).join(', ')}): ${kept.length} picture${kept.length === 1 ? '' : 's'} kept of ${data.images?.length ?? 0} found`);
  for (const k of kept) console.log(`  - ${new URL(k.url).hostname}  ${k.desc.slice(0, 90)}`);
  totalPics += kept.length;
  if (!dry && kept.length) {
    for (const v of parse(m.variants)) {
      await db.query('delete from laptop_image where variant_id = $1', [v]);
      for (let p = 0; p < kept.length; p++) await db.query(`insert into laptop_image (variant_id, url, site, description, position) values ($1, $2, $3, $4, $5) on conflict (variant_id, url) do nothing`, [v, kept[p].url, new URL(kept[p].url).hostname, kept[p].desc.slice(0, 300), p]);
    }
  }
}
console.log(`\n${dry ? 'DRY RUN, nothing stored. ' : 'Stored. '}${totalPics} pictures for ${models.length} models.`);
await db.close();
