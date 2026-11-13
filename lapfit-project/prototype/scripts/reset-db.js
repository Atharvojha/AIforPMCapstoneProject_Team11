import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (f.startsWith('lapfit.db')) fs.rmSync(path.join(dir, f));
await import('../server/db.js');
console.log('Database recreated with SAMPLE data.');
