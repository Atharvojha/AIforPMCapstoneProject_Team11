// Runs before every build: asks the live backend for the laptop list and the data status and saves them as public/snapshot.json,
// so the app can paint them instantly on the first visit and refresh them in the background. Never fails the build.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.resolve(here, '../public/snapshot.json');
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.resolve(here, '../.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch { /* no local env file: the host provides the variables */ }
const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''); const key = env.VITE_SUPABASE_ANON_KEY ?? '';
const keep = () => { fs.mkdirSync(path.dirname(out), { recursive: true }); if (!fs.existsSync(out)) fs.writeFileSync(out, '{}'); console.log('snapshot: kept the existing file'); };
if (!url || !key) { keep(); process.exit(0); }
const ask = async (action) => { const r = await fetch(`${url}/functions/v1/query`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, apikey: key }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(20000) }); const d = await r.json(); return d.blocks ?? []; };
try {
  const [cat, st] = await Promise.all([ask('catalog'), ask('data_status')]);
  const catalog = cat.find((b) => b.type === 'catalog')?.rows; const status = st.find((b) => b.type === 'data_status');
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('empty catalog');
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify({ taken_at: new Date().toISOString(), catalog, data_status: status ?? null }));
  console.log(`snapshot: ${catalog.length} laptops saved`);
} catch (e) { console.log('snapshot: could not refresh (' + (e?.message ?? e) + ')'); keep(); }
