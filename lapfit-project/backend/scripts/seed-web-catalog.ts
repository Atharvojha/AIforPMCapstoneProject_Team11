// Grow the web catalog (table web_laptop) from the web, safely: a fixed matrix of queries, a web search for each, the model READS the snippets
// into candidate laptops, and CODE validates them (the same validateRecoItems the live suggestions use) before they are merged into the table.
// Usage: node --env-file=.env --import tsx scripts/seed-web-catalog.ts --via-cli [--dry] [--max-queries N] [--budget-credits N] [--skip N] [--seed N]
//   --dry              run searches and extraction, write nothing
//   --max-queries N    default 20      --budget-credits N   stop when this many search credits were used (1 credit per basic search)
//   --skip N           skip the first N queries of the shuffled list (to carry on where an earlier run stopped; upserts are idempotent anyway)
// Needs TAVILY_API_KEY and GEMINI_API_KEY and/or ANTHROPIC_API_KEY in backend/.env. Keys are never printed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cliDb, pgDb, type Db } from './lib/db.ts';
import { SqlTools, type Tools } from '../supabase/functions/_shared/tools.ts';
import { tavilyWeb, sanitizeItems } from '../supabase/functions/_shared/live.ts';
import { GeminiClient, AnthropicClient, FallbackModel, askJson, type ModelClient } from '../supabase/functions/_shared/model.ts';
import { validateRecoItems, RECO_SYSTEM, recoUser } from '../supabase/functions/_shared/flows/webreco.ts';
import { upsertCandidates } from '../supabase/functions/_shared/flows/webcatalog.ts';
import type { Deps } from '../supabase/functions/_shared/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2); const flag = (n: string) => argv.includes(n);
const val = (n: string, d: number) => { const i = argv.findIndex((a) => a === n || a.startsWith(n + '=')); if (i < 0) return d; const v = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1]; const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : d; };
const dry = flag('--dry'); const maxQueries = val('--max-queries', 20); const budgetCredits = val('--budget-credits', Infinity); const skip = val('--skip', 0); const seed = val('--seed', 11);
const year = new Date().getFullYear(); const DELAY_MS = 1500;

export const BRANDS = ['Lenovo', 'HP', 'Dell', 'ASUS', 'Acer', 'MSI', 'Apple', 'Samsung', 'Infinix', 'Xiaomi', 'Honor', 'Avita', 'Chuwi', 'Realme', 'Redmi', 'Microsoft Surface', 'LG', 'Gigabyte'];
export const BANDS = ['under ₹25,000', 'between ₹25,000 and ₹40,000', 'between ₹40,000 and ₹60,000', 'between ₹60,000 and ₹80,000', 'between ₹80,000 and ₹1.2 lakh', 'above ₹1.2 lakh'];
export const USES = ['student', 'coding', 'gaming', 'creator', 'business', 'thin and light'];
/** The fixed matrix, shuffled deterministically (the same seed gives the same order, so a stopped run can be carried on with --skip). */
export function buildQueries(seedN: number, y = year): string[] {
  const all: string[] = []; for (const b of BRANDS) for (const band of BANDS) for (const u of USES) all.push(`best ${b} laptops ${band} India ${y} for ${u}`);
  let a = seedN >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (s: unknown, n: number) => String(s).slice(0, n).padEnd(n);

async function main() {
  const tavilyKey = process.env.TAVILY_API_KEY; if (!tavilyKey) { console.error('TAVILY_API_KEY is not set (put it in backend/.env).'); process.exit(1); }
  const clients: ModelClient[] = []; if (process.env.GEMINI_API_KEY) clients.push(new GeminiClient({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || undefined })); if (process.env.ANTHROPIC_API_KEY) clients.push(new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY }));
  if (!clients.length) { console.error('Set GEMINI_API_KEY and/or ANTHROPIC_API_KEY in backend/.env.'); process.exit(1); }
  const model = new FallbackModel(clients, 20000);
  const url = argv.find((a) => a.startsWith('--database-url='))?.split('=').slice(1).join('=') ?? process.env.DATABASE_URL;
  const db: Db = flag('--via-cli') ? await cliDb(path.resolve(here, '..')) : url ? await pgDb(url) : (() => { console.error('Use --via-cli or --database-url=…'); process.exit(1); })();
  const tools: Tools = new SqlTools((s, p) => db.query(s, p)); const deps = { tools, model, live: null, settings: {}, requestId: 'seed' } as unknown as Deps;
  const catalog = ((await tools.call<any>('list_names', {})).rows ?? []).map((r: any) => ({ text: `${r.brand ?? ''} ${r.display_name ?? ''} ${r.text ?? ''}` }));
  const before = Number((await db.query('select count(*)::int as n from web_laptop where not rejected')).rows[0].n);
  const queries = buildQueries(seed).slice(skip, skip + maxQueries);
  console.log(`${dry ? 'DRY RUN (nothing is written). ' : ''}${queries.length} queries, ${Number.isFinite(budgetCredits) ? budgetCredits : 'no'} credit limit, ${before} rows in the web catalog now. Model: ${model.name.replace(/\s*\(.*?\)/g, '')}\n`);
  console.log(`${pad('#', 3)} ${pad('query', 62)} ${pad('results', 7)} ${pad('cands', 5)} ${pad('kept', 4)} ${pad('new', 4)}`);
  let credits = 0, newRows = 0, kept = 0, fail = 0, n = 0;
  for (const q of queries) {
    if (credits >= budgetCredits) { console.log(`\nCredit limit (${budgetCredits}) reached, stopping.`); break; }
    n++; let results = 0, cands = 0, keep = 0, fresh = 0, err = '';
    try {
      const got = await tavilyWeb({ apiKey: tavilyKey, country: 'india' }, { query: q, news: false, anyTime: true, need: [] }); credits++;
      const snips = sanitizeItems(got.items, 8, 70); results = snips.length;
      if (snips.length) {
        let raw: any; try { raw = await askJson(model, { system: RECO_SYSTEM, user: recoUser(snips), maxTokens: 2200 }, recoUser(snips.slice(0, 5))); } finally { await sleep(DELAY_MS); }
        cands = Array.isArray(raw?.items) ? raw.items.length : 0;
        const checked = validateRecoItems(raw, snips, { budget: null, catalog, max: 8, year }); keep = checked.length;
        if (checked.length && !dry) { const r = await upsertCandidates(deps, checked, q); fresh = r.new; }
        kept += checked.length;
      }
    } catch (e) { fail++; err = String((e as Error)?.message ?? e).replace(/key[=:]\S+/gi, '[key]').slice(0, 60); }
    newRows += fresh;
    console.log(`${pad(n, 3)} ${pad(q, 62)} ${pad(results, 7)} ${pad(cands, 5)} ${pad(keep, 4)} ${pad(dry ? '-' : fresh, 4)}${err ? '  ! ' + err : ''}`);
  }
  const total = Number((await db.query('select count(*)::int as n from web_laptop where not rejected')).rows[0].n);
  const brands = (await db.query("select coalesce(brand, '(unknown)') as brand, count(*)::int as n from web_laptop where not rejected group by 1 order by 2 desc")).rows;
  console.log(`\n${dry ? 'DRY RUN, nothing stored. ' : ''}Summary: ${total} rows in the web catalog (${dry ? 'would add up to ' + kept + ' checked candidates' : newRows + ' new'}), ${credits} search credits used, ${fail} failed queries, ${kept} candidates kept after code checks.`);
  console.log('By brand: ' + (brands.map((b: any) => `${b.brand} ${b.n}`).join(', ') || 'none yet'));
}
await main();
