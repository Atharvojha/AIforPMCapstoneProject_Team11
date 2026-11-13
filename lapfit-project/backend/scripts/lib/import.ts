// Imports the team's existing SQLite database into the LapFit Postgres schema (plan: build-plan/01_BACKEND_BUILD_PLAN.md, section 4.2).
// Repeatable: it clears the imported tables first, then copies and counts.
import fs from 'node:fs';
import Database from 'better-sqlite3';
import type { Db } from './db.ts';

export interface ImportOptions { sqlitePath: string; curationCsv?: string; withEmbeddings?: boolean; }
export interface ImportReport { counts: Record<string, number>; checks: string[]; }

const RIGHTS: Record<string, { rights_status: string; quote_allowed: boolean; region: string; attribution?: string }> = {
  'S-FLIPKART-REVIEWS': { rights_status: 'declared_cc_by_4', quote_allowed: true, region: 'IN', attribution: 'Flipkart Review Dataset, Zenodo record 17612521, CC BY 4.0' },
  'S-FLIPKART-LISTING': { rights_status: 'declared_cc_by_4', quote_allowed: false, region: 'IN', attribution: 'Flipkart Review Dataset, Zenodo record 17612521, CC BY 4.0' },
  'S-AMAZON-REVIEWS-23': { rights_status: 'research_only', quote_allowed: false, region: 'US' },
  'S-AMAZON-LISTING-23': { rights_status: 'research_only', quote_allowed: false, region: 'US' },
};

const day = (x: unknown): string | null => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null);

async function insertMany(db: Db, table: string, cols: string[], rows: unknown[][]) {
  if (!rows.length) return;
  const per = Math.max(1, Math.min(db.maxRows ?? Infinity, Math.floor(30000 / cols.length)));
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const params: unknown[] = [];
    const values = chunk.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`).join(',');
    await db.query(`insert into ${table} (${cols.join(',')}) values ${values}`, params);
  }
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export async function importExisting(db: Db, opt: ImportOptions): Promise<ImportReport> {
  const sq = new Database(opt.sqlitePath, { readonly: true });
  const counts: Record<string, number> = {}; const checks: string[] = [];
  // clear in dependency order (re-runnable)
  for (const t of ['review_embedding','evidence_claim','review','price_history','variant_curation','spec_fact','model_alias','variant','laptop_model','source']) await db.exec(`delete from ${t}`);

  const sources = sq.prepare('select * from sources').all() as any[];
  await insertMany(db, 'source', ['id','publisher','source_name','source_class','url','licence_status','rights_status','permission','quote_allowed','attribution_text','region','notes'],
    sources.map((s) => { const r = RIGHTS[s.id]; return [s.id, s.publisher, s.source_name, s.source_class, s.url, s.licence_status,
      r?.rights_status ?? 'facts_only', s.permission, r?.quote_allowed ?? false, r?.attribution ?? s.attribution_text, r?.region ?? 'UNKNOWN', s.notes]; }));
  counts.source = sources.length;
  const region = new Map(sources.map((s) => [s.id, RIGHTS[s.id]?.region ?? 'UNKNOWN']));

  const models = sq.prepare('select * from laptop_models').all() as any[];
  await insertMany(db, 'laptop_model', ['id','brand','marketing_name','category'], models.map((m) => [m.id, m.brand, m.marketing_name, m.category ?? 'laptop']));
  counts.laptop_model = models.length;

  const variants = sq.prepare('select * from laptop_variants').all() as any[];
  await insertMany(db, 'variant', ['id','model_id','listing_title','display_name','catalogue_set','market','recommendable','aliases_text','review_count'],
    variants.map((v) => { const al = JSON.parse(v.aliases || '[]') as string[]; const india = v.catalogue_set === 'flipkart14';
      return [v.id, v.model_id, v.listing_title, v.display_name, v.catalogue_set, india ? 'IN' : 'US', india, al.join(' '), v.review_count]; }));
  counts.variant = variants.length;
  const aliasRows: unknown[][] = [];
  for (const v of variants) for (const a of new Set<string>(JSON.parse(v.aliases || '[]'))) aliasRows.push([v.id, a]);
  await insertMany(db, 'model_alias', ['variant_id','alias'], aliasRows); counts.model_alias = aliasRows.length;

  const facts = sq.prepare('select * from spec_facts').all() as any[];
  await insertMany(db, 'spec_fact', ['variant_id','attribute','value_text','value_num','unit','source_id','quote','variant_match','validation_status','retrieved_at'],
    facts.map((f) => [f.variant_id, f.attribute, f.value_text, f.value_num, f.unit, f.source_id, f.quote, f.variant_match, f.validation_status, day(f.retrieved_at)]));
  counts.spec_fact = facts.length;

  const prices = facts.filter((f) => f.attribute === 'price_inr' && f.value_num && day(f.retrieved_at));
  await insertMany(db, 'price_history', ['variant_id','seller','price_inr','observed_at','source_id','verified'],
    prices.map((f) => [f.variant_id, 'Flipkart listing', Math.round(f.value_num), day(f.retrieved_at), f.source_id, false]));
  counts.price_history = prices.length;

  if (opt.curationCsv && fs.existsSync(opt.curationCsv)) {
    const cur = parseCsv(fs.readFileSync(opt.curationCsv, 'utf8'));
    await insertMany(db, 'variant_curation', ['variant_id','hinge_type','hinge_basis','warranty_years','warranty_basis','colours','cpu_vendor','cpu_family','cpu_generation_or_model','win11_status','win11_basis','memory_slots','verified','verified_by'],
      cur.map((c) => [c.variant_id, c.hinge_type || null, c.hinge_basis, c.warranty_years ? Number(c.warranty_years) : null, c.warranty_basis,
        JSON.stringify(c.colours ? c.colours.split('|') : []), c.cpu_vendor, c.cpu_family, c.cpu_generation_or_model, c.win11_status, c.win11_basis,
        c.ram_upgradeable, c.verified === 'true', c.verified_by || null]));
    counts.variant_curation = cur.length;
  }

  const reviews = sq.prepare('select * from reviews').all() as any[];
  await insertMany(db, 'review', ['id','source_id','variant_id','rating','title','original_text','language','review_date','helpful_votes','verified_purchase','dup_cluster_id','flag','config_mismatch_hint','content_hash','region'],
    reviews.map((r) => [r.id, r.source_id, r.variant_id, r.rating, r.title, r.original_text, r.language, day(r.review_date), r.helpful_votes, r.verified_purchase, r.dup_cluster_id, r.flag, r.config_mismatch_hint, r.content_hash, region.get(r.source_id) ?? 'UNKNOWN']));
  counts.review = reviews.length;
  const reviewSource = new Map(reviews.map((r) => [r.id, r.source_id]));

  const claims = sq.prepare('select * from evidence_claims').all() as any[];
  await insertMany(db, 'evidence_claim', ['id','review_id','variant_id','category','claim_text','polarity','strength','usage_context','quote','quote_start','quote_end','model','prompt_version','validation_status','source_id','region'],
    claims.map((c) => { const sid = reviewSource.get(c.review_id) as string; return [c.id, c.review_id, c.variant_id, c.category, c.claim_text, c.polarity, c.strength, c.usage_context, c.quote, c.quote_start, c.quote_end, c.model, c.prompt_version, c.validation_status, sid, region.get(sid) ?? 'UNKNOWN']; }));
  counts.evidence_claim = claims.length;

  if (opt.withEmbeddings) {
    const emb = sq.prepare("select owner_id, model_name, dim, vector from embeddings where owner_type = 'review'").all() as any[];
    const rows = emb.map((e) => { const b = e.vector as Buffer; const f = new Float32Array(b.buffer, b.byteOffset, e.dim); return [e.owner_id, e.model_name, e.dim, '[' + Array.from(f).join(',') + ']']; });
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200); const params: unknown[] = [];
      const vals = chunk.map((r) => `($${params.push(r[0])},$${params.push(r[1])},$${params.push(r[2])},$${params.push(r[3])}::vector)`).join(',');
      await db.query(`insert into review_embedding (review_id, model_name, dim, embedding) values ${vals}`, params);
    }
    counts.review_embedding = rows.length;
  }

  await db.query(`insert into settings (key, value) values ('data_version', $1::jsonb)
    on conflict (key) do update set value = excluded.value, version = settings.version + 1, updated_at = now()`,
    [JSON.stringify({ imported_at: new Date().toISOString().slice(0, 10), counts })]);

  // Integrity checks (the "done when" tests of build step B1)
  const q = async (sql: string) => Number((await db.query(sql)).rows[0].n);
  checks.push(`prices without an as-of date: ${await q('select count(*) n from variant_specs where price_inr is not null and price_as_of is null')}`);
  checks.push(`evidence rows without a source: ${await q('select count(*) n from evidence_claim e where not exists (select 1 from source s where s.id = e.source_id)')}`);
  checks.push(`India variants (recommendable): ${await q('select count(*) n from variant where recommendable')}`);
  sq.close();
  return { counts, checks };
}
