import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgliteDb, type Db } from '../scripts/lib/db.ts';
import { applyMigrations } from '../scripts/lib/migrate.ts';
import { importExisting } from '../scripts/lib/import.ts';
import { SqlTools } from '../supabase/functions/_shared/tools.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..', '..');
export const SQLITE = path.join(ROOT, 'prototype_prathyusha', 'backend', 'data', 'lapfit.db');

let cached: Promise<{ db: Db; tools: SqlTools }> | null = null;
/** One imported database shared by all tests in a file. */
export function getDb() {
  cached ??= (async () => {
    const db = await pgliteDb();
    await applyMigrations(db);
    await importExisting(db, { sqlitePath: SQLITE, curationCsv: path.join(ROOT, 'lapfit-project', 'data-model', 'curation', 'catalog_curation_14.csv') });
    return { db, tools: new SqlTools((s, p) => db.query(s, p)) };
  })();
  return cached;
}
export async function withSetting<T>(db: Db, key: string, value: unknown, fn: () => Promise<T>): Promise<T> {
  const old = (await db.query('select value from settings where key = $1', [key])).rows[0]?.value;
  await db.query('update settings set value = $2::jsonb where key = $1', [key, JSON.stringify(value)]);
  try { return await fn(); } finally { await db.query('update settings set value = $2::jsonb where key = $1', [key, JSON.stringify(old)]); }
}
