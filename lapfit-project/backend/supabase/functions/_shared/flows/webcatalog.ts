// The web catalog: laptops read from web pages, kept in table web_laptop as a SECOND, clearly labelled tier next to the catalog laptops.
// Nothing here is verified. Every row carries its source page and the date of its price. Rows only get in through the same code validation
// as the live suggestions (flows/webreco.ts validateRecoItems). The fit/match uses the catalog's own logic (rank.ts capability + shortlist.ts relativeFit)
// on the parsed values only: an unknown value earns nothing. This module never touches the catalog cards.
import { capability, cpuTier } from '../rank.ts';
import { relativeFit, fitReference } from './shortlist.ts';
import { fmtInr, scrub } from '../util.ts';
import type { RecoItem } from './webreco.ts';
import type { Deps, Block, Needs, Row } from '../types.ts';

export const WEB_CATALOG_NOTE = 'From web pages, read by an AI model and checked against their text. Not verified. Prices are as of the date shown.';
const FILLER = new Set(['laptop', 'laptops', 'notebook', 'with', 'inch', 'inches', 'the', 'new', 'and', 'for', 'a', 'an', 'in']);
/** Normalised name: lower case, punctuation and filler words removed, so "HP 15s" and "HP 15s laptop" are one row. */
export function webKey(name: string): string { return String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w && !FILLER.has(w)).join(' ').slice(0, 120); }

const BRANDS: [RegExp, string][] = [[/\b(?:lenovo|thinkpad|ideapad|legion|yoga|loq)\b/i, 'Lenovo'], [/\b(?:hp|pavilion|victus|omen|elitebook|probook|envy|spectre)\b/i, 'HP'], [/\b(?:dell|inspiron|xps|latitude|alienware|vostro)\b/i, 'Dell'],
  [/\b(?:asus|vivobook|zenbook|rog|tuf|expertbook)\b/i, 'ASUS'], [/\b(?:acer|aspire|nitro|predator|swift|travelmate)\b/i, 'Acer'], [/\bmsi\b/i, 'MSI'], [/\b(?:apple|macbook)\b/i, 'Apple'], [/\b(?:samsung|galaxy book)\b/i, 'Samsung'],
  [/\binfinix|inbook\b/i, 'Infinix'], [/\b(?:xiaomi|mi notebook)\b/i, 'Xiaomi'], [/\bredmi/i, 'Redmi'], [/\b(?:honor|magicbook)\b/i, 'Honor'], [/\bavita\b/i, 'Avita'], [/\bchuwi\b/i, 'Chuwi'], [/\brealme\b/i, 'Realme'],
  [/\b(?:microsoft|surface)\b/i, 'Microsoft'], [/\blg gram|\blg\b/i, 'LG'], [/\bgigabyte|aorus\b/i, 'Gigabyte'], [/\b(?:huawei|matebook)\b/i, 'Huawei'], [/\brazer\b/i, 'Razer']];
export const brandOf = (name: string): string | null => BRANDS.find(([re]) => re.test(name))?.[1] ?? null;

export interface WebSpecs { ram_gb: number | null; storage_gb: number | null; display_size: number | null; weight_kg: number | null; battery_wh: number | null; cpu: string | null; gpu: string | null }
export interface WebMatch { pct: number; label: string; basis: string[] }
export interface WebRow { key: string; name: string; brand: string | null; price_inr: number | null; price_text: string | null; price_as_of: string | null; specs: WebSpecs; source: { url: string; site: string }; match?: WebMatch }
export interface WebFilters { brand?: unknown; q?: unknown; budget_min_inr?: unknown; budget_max_inr?: unknown; offset?: unknown; limit?: unknown }

const num = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const cleanWord = (s: unknown, n: number) => scrub(String(s ?? '')).replace(/\[(?:link|email|phone)\]/g, ' ').replace(/[^A-Za-z0-9 .\-+/()&']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** Merge validated candidates into the table. Idempotent: the same item again only raises hits and last_seen. */
export async function upsertCandidates(deps: Deps, items: RecoItem[], query: string): Promise<{ sent: number; new: number; updated: number; total: number }> {
  const rows = items.filter((i) => i && /^https:\/\//i.test(i.source?.url ?? '') && webKey(i.name).length >= 3).map((i) => ({
    key: webKey(i.name), name: i.name, brand: brandOf(i.name), price_inr: i.price_inr, ram_gb: i.specs.ram_gb ?? null, storage_gb: i.specs.storage_gb ?? null, display_size: i.specs.display_size ?? null,
    weight_kg: i.specs.weight_kg ?? null, battery_wh: i.specs.battery_wh ?? null, cpu: i.specs.cpu ?? null, gpu: i.specs.gpu ?? null, source_url: i.source.url, site: i.source.site, snippet: String(i.why ?? '').slice(0, 400) }));
  if (!rows.length) return { sent: 0, new: 0, updated: 0, total: 0 };
  const r = await deps.tools.call<any>('web_catalog_upsert', { items: rows, query: cleanWord(query, 120) });
  return { sent: rows.length, new: r.new ?? 0, updated: r.updated ?? 0, total: r.total ?? 0 };
}

export function filterArgs(f: WebFilters): Record<string, unknown> {
  const a: Record<string, unknown> = {}; const brand = cleanWord(f.brand, 40); const q = cleanWord(f.q, 60);
  if (brand) a.brand = brand; if (q) a.q = q;
  const mn = num(f.budget_min_inr), mx = num(f.budget_max_inr); if (mn != null && mn > 0) a.budget_min = Math.floor(mn); if (mx != null && mx > 0) a.budget_max = Math.floor(mx);
  const lim = num(f.limit), off = num(f.offset); a.limit = lim != null && lim >= 1 ? Math.min(60, Math.floor(lim)) : 24; a.offset = off != null && off > 0 ? Math.floor(off) : 0;
  return a;
}
export interface StoredRow { key: string; name: string; brand: string | null; price_inr: number | null; price_as_of: string | null; ram_gb: number | null; storage_gb: number | null; display_size: number | null; weight_kg: number | null; battery_wh: number | null; cpu: string | null; gpu: string | null; source_url: string; site: string | null; snippet: string | null; hits: number; last_seen: string }
export async function listWebCatalog(deps: Deps, f: WebFilters): Promise<{ total: number; rows: StoredRow[] }> {
  const r = await deps.tools.call<any>('web_catalog_list', filterArgs(f));
  const n = (v: unknown) => (v == null ? null : Number(v));
  return { total: Number(r?.total ?? 0), rows: (Array.isArray(r?.rows) ? r.rows : []).map((x: any) => ({ ...x, price_inr: n(x.price_inr), ram_gb: n(x.ram_gb), storage_gb: n(x.storage_gb), display_size: n(x.display_size), weight_kg: n(x.weight_kg), battery_wh: n(x.battery_wh) })) };
}

/** A web row as a catalog-shaped Row, only so the catalog's own capability() can read it. Unparsed values stay null and earn nothing. */
export const asRow = (p: { price_inr: number | null; ram_gb?: number | null; storage_gb?: number | null; display_size?: number | null; weight_kg?: number | null; battery_wh?: number | null; cpu?: string | null; gpu?: string | null }): Row =>
  ({ variant_id: 'web', model_id: 0, brand: '', marketing_name: '', display_name: '', price_inr: p.price_inr, ram_gb: p.ram_gb ?? null, storage_gb: p.storage_gb ?? null, display_size: p.display_size ?? null, weight_kg: p.weight_kg ?? null,
    battery_wh: p.battery_wh ?? null, cpu_text: p.cpu ?? null, gpu_text: p.gpu ?? null, gpu_class: null, hinge_type: null } as unknown as Row);

export interface FitContext { all: Row[]; uses: string[] }
export async function fitContext(deps: Deps, uses: string[]): Promise<FitContext> { let all: Row[] = []; try { all = await fitReference(deps.tools); } catch { /* no reference: no match shown */ } return { all, uses }; }
/** Same fit logic as the catalog cards: capability for the use, as a share of the strongest catalog laptop for it. Undefined when there is no reference. */
export function matchFor(p: Parameters<typeof asRow>[0], ctx: FitContext): WebMatch | undefined {
  if (!ctx.all.length) return undefined;
  const row = asRow(p); const maxP = Math.max(0, ...ctx.all.map((r) => (r.price_inr != null && r.price_inr > 0 ? (r.price_inr as number) : 0))) || null;
  const cap = capability(row, ctx.uses, maxP); const rel = relativeFit(cap, ctx.uses, ctx.all); const pct = Math.max(0, Math.min(100, Math.round(rel)));
  const unknown = ([['ram_gb', 'RAM'], ['storage_gb', 'storage'], ['cpu', 'processor'], ['display_size', 'screen size'], ['weight_kg', 'weight'], ['battery_wh', 'battery']] as [keyof typeof p, string][]).filter(([k]) => p[k] == null).map(([, n]) => n);
  const basis = [`Strength for ${ctx.uses.length ? ctx.uses.join(', ') : 'everyday use'}: ${pct}% of the strongest laptop in the LapFit catalog for it, counting only values read from the web page (RAM, storage, processor${cpuTier(p.cpu) == null && p.cpu ? ' (tier not recognised)' : ''}, graphics, screen, weight, battery)`];
  if (unknown.length) basis.push(`Not found on the page, so not counted: ${unknown.join(', ')}`);
  basis.push('An estimate from unverified web text, not a LapFit score');
  return { pct, label: `${pct}% match`, basis };
}

const fitArgs = (r: StoredRow) => ({ price_inr: r.price_inr, ram_gb: r.ram_gb, storage_gb: r.storage_gb, display_size: r.display_size, weight_kg: r.weight_kg, battery_wh: r.battery_wh, cpu: r.cpu, gpu: r.gpu });
export function toWebRow(r: StoredRow, ctx?: FitContext): WebRow {
  const match = ctx ? matchFor(fitArgs(r), ctx) : undefined;
  return { key: r.key, name: r.name, brand: r.brand ?? null, price_inr: r.price_inr, price_text: r.price_inr != null ? fmtInr(r.price_inr) : null, price_as_of: r.price_as_of ?? null,
    specs: { ram_gb: r.ram_gb, storage_gb: r.storage_gb, display_size: r.display_size, weight_kg: r.weight_kg, battery_wh: r.battery_wh, cpu: r.cpu ?? null, gpu: r.gpu ?? null }, source: { url: r.source_url, site: r.site ?? '' }, ...(match ? { match } : {}) };
}

/** The `web_catalog` block: instant, no model, no live search. */
export async function webCatalogBlock(deps: Deps, f: WebFilters, uses: string[] = []): Promise<Block> {
  const { total, rows } = await listWebCatalog(deps, f); const ctx = await fitContext(deps, uses);
  return { type: 'web_catalog', total, rows: rows.map((r) => toWebRow(r, ctx)), note: WEB_CATALOG_NOTE };
}

/** Stored web laptops that fit the budget (and uses), best fit first, for the automatic web_picks. */
export async function storedFor(deps: Deps, needs: Needs, max = 8): Promise<{ row: StoredRow; match: WebMatch | undefined }[]> {
  const uses = Array.isArray(needs.use_cases) ? needs.use_cases : [];
  const { rows } = await listWebCatalog(deps, { budget_min_inr: needs.budget_min_inr, budget_max_inr: needs.budget_max_inr, limit: 60 });
  const ctx = await fitContext(deps, uses);
  const scored = rows.map((row) => ({ row, match: matchFor(fitArgs(row), ctx) }));
  scored.sort((a, b) => (b.match?.pct ?? -1) - (a.match?.pct ?? -1) || b.row.hits - a.row.hits || a.row.key.localeCompare(b.row.key));
  return scored.slice(0, max);
}
