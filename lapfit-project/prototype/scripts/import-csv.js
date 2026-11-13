// Usage: npm run import -- <table> <file.csv> [--verified-by "Name"]
// Imports REAL data into a table. Rows are marked verified only if you pass --verified-by. is_sample is set to 0.
import fs from 'node:fs';
import { db } from '../server/db.js';

const TABLES = ['laptop_model', 'variant', 'price_history', 'evidence_excerpt', 'claim_ledger'];
const [table, file] = process.argv.slice(2);
const vb = process.argv.includes('--verified-by') ? process.argv[process.argv.indexOf('--verified-by') + 1] : null;
if (!TABLES.includes(table) || !file) { console.error(`Usage: npm run import -- <${TABLES.join('|')}> <file.csv> [--verified-by "Name"]`); process.exit(1); }

function parseCsv(src) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const [head, ...body] = parseCsv(fs.readFileSync(file, 'utf8'));
const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const unknown = head.filter((h) => !cols.includes(h));
if (unknown.length) { console.error('Unknown columns:', unknown.join(', ')); process.exit(1); }
const now = new Date().toISOString().slice(0, 10);
const insert = db.prepare(`INSERT OR REPLACE INTO ${table} (${[...head, 'verified', 'verified_by', 'verified_at', 'is_sample'].join(',')}) VALUES (${[...head, 1, 2, 3, 4].map(() => '?').join(',')})`);
db.transaction(() => { for (const r of body) insert.run(...r.map((x) => (x === '' ? null : x)), vb ? 1 : 0, vb, vb ? now : null, 0); })();
console.log(`Imported ${body.length} rows into ${table}. ${vb ? `Marked verified by ${vb}.` : 'Not verified, so they will not be shown until verified = 1.'}`);
