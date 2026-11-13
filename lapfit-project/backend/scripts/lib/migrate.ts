import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db.ts';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations');

export async function applyMigrations(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  return files;
}
