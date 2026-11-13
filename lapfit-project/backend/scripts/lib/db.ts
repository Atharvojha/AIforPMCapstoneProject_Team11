// One tiny database interface so the same code runs on Postgres (Supabase) and on PGlite (local tests).
export interface Db {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  /** Optional cap on rows per INSERT statement (the CLI path sends whole statements as files). */
  maxRows?: number;
}

export async function pgliteDb(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite/vector');
  const db = new PGlite({ extensions: { vector } });
  await db.waitReady;
  return {
    query: async (sql, params = []) => { const r = await db.query(sql, params as any[]); return { rows: r.rows as any[] }; },
    exec: async (sql) => { await db.exec(sql); },
    close: async () => { await db.close(); },
  };
}

export async function pgDb(connectionString: string): Promise<Db> {
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString });
  await client.connect();
  return {
    query: async (sql, params = []) => { const r = await client.query(sql, params as any[]); return { rows: r.rows }; },
    exec: async (sql) => { await client.query(sql); },
    close: async () => { await client.end(); },
  };
}

/** Runs SQL on the linked Supabase project through the CLI login (no database password needed). Parameters are inlined as escaped literals. */
export async function cliDb(workdir: string, opts: { readOnly?: boolean } = {}): Promise<Db> {
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lapfit-sql-'));
  const lit = (v: unknown): string => v === null || v === undefined ? 'NULL' : typeof v === 'boolean' ? String(v) : typeof v === 'number' ? (isFinite(v) ? String(v) : 'NULL')
    : "'" + String(v).replace(/\u0000/g, '').replace(/'/g, "''") + "'";
  const inline = (sql: string, params: unknown[]) => sql.replace(/\$(\d+)/g, (_m, n) => lit(params[Number(n) - 1]));
  let n = 0;
  const run = (sql: string) => {
    const f = path.join(dir, `q${n++}.sql`); fs.writeFileSync(f, sql);
    const out = execFileSync('supabase', ['db', 'query', '--remote', ...(opts.readOnly ? ['--read-only'] : ['--yes']), '-f', f, '--workdir', workdir], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const a = out.indexOf('{'); const j = a >= 0 ? JSON.parse(out.slice(a, out.lastIndexOf('}') + 1)) : { rows: [] };
    return { rows: (j.rows ?? []) as any[] };
  };
  return { maxRows: 250, query: async (sql, params = []) => run(inline(sql, params)), exec: async (sql) => { run(sql); }, close: async () => { fs.rmSync(dir, { recursive: true, force: true }); } };
}
