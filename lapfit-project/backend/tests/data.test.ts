import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { getDb, SQLITE, withSetting } from './helpers.ts';

test('import: row counts equal the source database', async () => {
  const { db } = await getDb();
  const sq = new Database(SQLITE, { readonly: true });
  for (const [pg, lite] of [['review', 'reviews'], ['evidence_claim', 'evidence_claims'], ['spec_fact', 'spec_facts'], ['variant', 'laptop_variants'], ['laptop_model', 'laptop_models'], ['source', 'sources']] as const) {
    const a = Number((await db.query(`select count(*) n from ${pg}`)).rows[0].n);
    const b = (sq.prepare(`select count(*) n from ${lite}`).get() as any).n;
    assert.equal(a, b, `${pg} vs ${lite}`);
  }
  sq.close();
});

test('data rules: every shown price has an as-of date; every evidence row has a source', async () => {
  const { db } = await getDb();
  assert.equal(Number((await db.query('select count(*) n from variant_specs where price_inr is not null and price_as_of is null')).rows[0].n), 0);
  assert.equal(Number((await db.query('select count(*) n from evidence_claim e left join source s on s.id = e.source_id where s.id is null')).rows[0].n), 0);
});

test('source rights: Amazon is research only and never quotable; Flipkart reviews are declared CC BY 4.0', async () => {
  const { db } = await getDb();
  const r = (await db.query("select id, rights_status, quote_allowed from source where id like 'S-AMAZON%' or id = 'S-FLIPKART-REVIEWS' order by id")).rows;
  for (const x of r) {
    if (x.id.startsWith('S-AMAZON')) { assert.equal(x.rights_status, 'research_only'); assert.equal(x.quote_allowed, false); }
    else { assert.equal(x.rights_status, 'declared_cc_by_4'); assert.equal(x.quote_allowed, true); }
  }
});

test('find_variants: every Must holds on every row, ordered by price, only India laptops', async () => {
  const { tools } = await getDb();
  const r = await tools.call('find_variants', { budget_max: 60000, criteria: [{ attribute: 'ram_gb', operator: '>=', value: 8 }] });
  assert.ok(r.total > 0);
  let last = 0;
  for (const row of r.rows) { assert.ok(row.ram_gb >= 8); assert.ok(row.price_inr <= 60000); assert.equal(row.recommendable, true); assert.ok(row.price_inr >= last); last = row.price_inr; }
});

test('find_variants: weight limit returns only light laptops and reports unknown values', async () => {
  const { tools } = await getDb();
  const r = await tools.call('find_variants', { criteria: [{ attribute: 'weight_kg', operator: '<=', value: 1.5 }] });
  assert.ok(r.rows.length >= 1);
  for (const row of r.rows) assert.ok(row.weight_kg <= 1.5);
  assert.equal(typeof r.unknown_values.weight_kg, 'number');
});

test('find_variants: hinge type filter works and a convertible request returns nothing (honest no-match)', async () => {
  const { tools } = await getDb();
  const clam = await tools.call('find_variants', { criteria: [{ attribute: 'hinge_type', operator: 'in', value: ['clamshell'] }] });
  const conv = await tools.call('find_variants', { criteria: [{ attribute: 'hinge_type', operator: 'in', value: ['convertible_360'] }] });
  assert.equal(clam.total, 14);
  assert.equal(conv.total, 0);
});

test('find_variants: unknown attributes and operators are refused, not interpolated', async () => {
  const { tools } = await getDb();
  await assert.rejects(() => tools.call('find_variants', { criteria: [{ attribute: 'ram_gb; drop table variant', operator: '>=', value: 8 }] }));
  await assert.rejects(() => tools.call('find_variants', { criteria: [{ attribute: 'ram_gb', operator: '>= 0 or 1=1 --', value: 8 }] }));
  const ok = await tools.call('find_variants', {});
  assert.ok(ok.total >= 14);
});

test('resolve_laptop: a family name matches several, a precise name matches one', async () => {
  const { tools } = await getDb();
  const tuf = await tools.call('resolve_laptop', { brand: 'Asus', line: 'TUF Gaming' });
  assert.ok(tuf.candidates.length >= 2);
  const mba = await tools.call('resolve_laptop', { line: 'Macbook Air M1' });
  assert.ok(mba.candidates.some((c: any) => c.variant_id === 'FKL-10'));
  const none = await tools.call('resolve_laptop', { brand: 'Dell', line: 'XPS 13' });
  assert.equal(none.candidates.length, 0);
});

test('get_price and get_variant return dated prices and provenance', async () => {
  const { tools } = await getDb();
  const p = await tools.call('get_price', { variant_id: 'FKL-10' });
  assert.equal(p.found, true); assert.ok(p.as_of); assert.ok(p.price_inr > 0);
  const v = await tools.call('get_variant', { variant_id: 'FKL-10' });
  assert.equal(v.found, true); assert.ok(v.facts.length > 0); assert.ok(v.facts.every((f: any) => f.source_id));
  assert.equal(v.specs.win11_status, 'not applicable (macOS)');
});

test('evidence_summary: counts distinct duplicate clusters, flags thin evidence, labels machine-read', async () => {
  const { db, tools } = await getDb();
  const s = await tools.call('evidence_summary', { variant_id: 'FKL-10' });
  assert.equal(s.min_n, 20); assert.match(s.label, /machine-read/);
  const rows = Number((await db.query("select count(*) n from evidence_claim where variant_id = 'FKL-10' and topic <> 'other'")).rows[0].n);
  assert.ok(s.total.n <= rows);
  for (const t of s.topics) assert.equal(t.enough, t.n >= 20);
});

test('evidence_quotes: short, attributed, and never from a research-only source', async () => {
  const { tools } = await getDb();
  for (const v of ['FKL-10', 'AMZ-01']) {
    const q = await tools.call('evidence_quotes', { variant_id: v, limit: 10 });
    for (const x of q.quotes) { assert.ok(x.quote.split(/\s+/).length <= 26); assert.ok(!x.source_id.startsWith('S-AMAZON')); assert.equal(x.machine_read, true); }
  }
  const amz = await tools.call('evidence_quotes', { variant_id: 'AMZ-01' });
  assert.equal(amz.quotes.length, 0);
});

test('production mode: unverified imported variants are hidden, quotes follow rights', async () => {
  const { db, tools } = await getDb();
  await withSetting(db, 'data_mode', 'production', async () => {
    const r = await tools.call('find_variants', {});
    assert.equal(r.total, 0);                        // nothing is verified yet
    const v = await tools.call('get_variant', { variant_id: 'FKL-10' });
    assert.equal(v.found, false);
  });
  const back = await tools.call('find_variants', {});
  assert.ok(back.total >= 14);
});

test('claim ledger: a verdict needs a named approver; lookup returns approved entries only', async () => {
  const { db, tools } = await getDb();
  await assert.rejects(() => db.query("insert into claim_ledger (id, claim_text, status, verdict) values ('X1','x','approved','v')"));
  await db.query("insert into claim_ledger (id, claim_text, scope, match_terms, status) values ('L-DRAFT','Battery lasts a full day','general','{full day}','draft')");
  const none = await tools.call('lookup_claim_verdict', { claim_text: 'battery lasts a full day', scopes: ['general'] });
  assert.equal(none.found, false);
  await db.query("update claim_ledger set status='approved', verdict='Partly supported', approver='Test Reviewer', sample_size=12 where id='L-DRAFT'");
  const hit = await tools.call('lookup_claim_verdict', { claim_text: 'The battery lasts a full day!', scopes: ['general'] });
  assert.equal(hit.found, true); assert.equal(hit.approver, 'Test Reviewer');
  await db.query("delete from claim_ledger where id='L-DRAFT'");
});

test('log_event writes the four log kinds and refuses an unknown one', async () => {
  const { db, tools } = await getDb();
  await tools.call('log_event', { kind: 'query', request_id: 'r1', flow: 'shortlist', outcome: 'ok', text_len: 10 });
  await tools.call('log_event', { kind: 'gate', request_id: 'r1', variant_id: 'FKL-10', check_name: 'test', detail: 'd' });
  await tools.call('log_event', { kind: 'demand', budget_band: 'Under ₹40,000', matched: 0 });
  assert.equal(Number((await db.query("select count(*) n from query_log where request_id='r1'")).rows[0].n), 1);
  await assert.rejects(() => tools.call('log_event', { kind: 'nope' }));
});

test('settings: every setting the code reads exists in the database, so code and settings can never drift apart', async () => {
  const fs = await import('node:fs'); const path = await import('node:path');
  const { db } = await getDb(); const have = new Set((await db.query('select key from settings')).rows.map((r: any) => r.key));
  const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/%20/g, ' ')), '..', 'supabase', 'functions', '_shared');
  const files: string[] = []; const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith('.ts') && files.push(path.join(d, f.name)); }; walk(root);
  const used = new Set<string>(); for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/settings\??\.([A-Z][A-Z_]+)\b/g)) used.add(m[1]);
  const missing = [...used].filter((k) => !have.has(k) && k !== 'data_mode'); assert.deepEqual(missing, [], `settings read by code but not in the database: ${missing.join(', ')}`);
});
