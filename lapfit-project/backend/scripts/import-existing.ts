// Usage: node --import tsx scripts/import-existing.ts [--database-url=postgres://...] [--embeddings]
// Without a database URL it imports into an in-memory PGlite database and prints the report (a dry run).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgDb, pgliteDb, cliDb } from './lib/db.ts';
import { applyMigrations } from './lib/migrate.ts';
import { importExisting } from './lib/import.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const url = process.argv.find((a) => a.startsWith('--database-url='))?.split('=').slice(1).join('=') ?? process.env.DATABASE_URL;
const viaCli = process.argv.includes('--via-cli');
const db = viaCli ? await cliDb(path.resolve(here, '..')) : url ? await pgDb(url) : await pgliteDb();
if (!url && !viaCli) console.log('No DATABASE_URL: dry run on in-memory PGlite.');
else if (viaCli) console.log('Importing into the linked Supabase project through the CLI login.');
const applied = url || viaCli ? [] : await applyMigrations(db);   // on Supabase, apply migrations with `supabase db push` instead
if (applied.length) console.log('migrations:', applied.join(', '));
const report = await importExisting(db, {
  sqlitePath: path.join(root, 'prototype_prathyusha', 'backend', 'data', 'lapfit.db'),
  curationCsv: path.join(root, 'lapfit-project', 'data-model', 'curation', 'catalog_curation_14.csv'),
  withEmbeddings: process.argv.includes('--embeddings'),
});
console.log(JSON.stringify(report, null, 2));
await db.close();
