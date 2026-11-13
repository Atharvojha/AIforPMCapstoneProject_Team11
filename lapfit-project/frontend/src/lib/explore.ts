import type { CatalogRow } from './types';

/**
 * The Explore filters, as plain data. Nothing here calls a server or a model.
 * A laptop whose value for a filter is NOT recorded is never dropped silently: it is counted as "unknown", and the person can choose to include those.
 */
export type Row = CatalogRow & Record<string, any>;
export type Dim = 'search' | 'brand' | 'price' | 'weight' | 'screen' | 'ram' | 'storage' | 'gpu';
export interface Filters { q: string; budget: number | null; brands: string[]; weight: string | null; screen: string[]; ram: string | null; storage: string | null; gpu: boolean; unk: Dim[] }
export const emptyFilters = (): Filters => ({ q: '', budget: null, brands: [], weight: null, screen: [], ram: null, storage: null, gpu: false, unk: [] });
export interface Opt { key: string; label: string; phrase: string }

export const QUICK_PRICES = [30000, 50000, 80000, 120000];
export const OPTS: Record<'weight' | 'screen' | 'ram' | 'storage', Opt[]> = {
  weight: [{ key: '1.3', label: 'Ultra-light (under 1.3 kg)', phrase: 'weighs under 1.3 kg' }, { key: '1.5', label: 'Light to carry (under 1.5 kg)', phrase: 'weighs under 1.5 kg' }, { key: '2', label: 'Easy to carry (under 2 kg)', phrase: 'weighs under 2 kg' }],
  screen: [{ key: 's', label: 'Compact (under 14 in)', phrase: 'has a screen under 14 in' }, { key: 'm', label: 'Mid-size (14 in)', phrase: 'has a 14 in screen' }, { key: 'l', label: 'Big screen (15 in or more)', phrase: 'has a screen of 15 in or more' }],
  ram: [{ key: '8', label: '8 GB or more', phrase: 'has 8 GB RAM or more' }, { key: '16', label: '16 GB or more', phrase: 'has 16 GB RAM or more' }, { key: '32', label: '32 GB or more', phrase: 'has 32 GB RAM or more' }],
  storage: [{ key: '256', label: '256 GB or more', phrase: 'has 256 GB storage or more' }, { key: '512', label: '512 GB or more', phrase: 'has 512 GB storage or more' }, { key: '1024', label: '1 TB or more', phrase: 'has 1 TB storage or more' }],
};
export const GPU_LABEL = 'Dedicated graphics (for gaming and design)';
export const DIM_NAME: Record<Dim, string> = { search: 'the search words', brand: 'the brand filter', price: 'the price limit', weight: 'the weight limit', screen: 'the screen size', ram: 'the RAM filter', storage: 'the storage filter', gpu: 'the graphics filter' };
const WHAT: Partial<Record<Dim, string>> = { weight: 'weight', screen: 'screen size', ram: 'RAM', storage: 'storage', gpu: 'graphics information' };
export const DIMS: Dim[] = ['search', 'brand', 'price', 'weight', 'screen', 'ram', 'storage', 'gpu'];
export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');

const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
/** One option against one laptop: true, false, or null when the laptop does not record that value. */
export function optTest(dim: Dim, key: string, r: Row): boolean | null {
  switch (dim) {
    case 'weight': return num(r.weight_kg) ? r.weight_kg < Number(key) : null;
    case 'screen': { const s = r.display_size; if (!num(s)) return null; return key === 's' ? s < 14 : key === 'm' ? s >= 14 && s < 15 : s >= 15; }
    case 'ram': return num(r.ram_gb) ? r.ram_gb >= Number(key) : null;
    case 'storage': return num(r.storage_gb) ? r.storage_gb >= Number(key) : null;
    case 'gpu': return r.gpu_class == null ? null : r.gpu_class === 'dedicated';
    case 'brand': return r.brand === key;
    case 'price': return num(r.price_inr) ? r.price_inr <= Number(key) : false;
    default: return true;
  }
}
const haystack = (r: Row) => `${r.name} ${r.brand} ${r.ram_gb ?? ''} gb ram ${r.storage_gb ?? ''} gb storage ${r.display_size ?? ''} inch in ${r.weight_kg ?? ''} kg ${r.gpu_class ?? ''}`.toLowerCase();
const tokens = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

export const isActive = (f: Filters, d: Dim): boolean => d === 'search' ? tokens(f.q).length > 0 : d === 'brand' ? f.brands.length > 0 : d === 'price' ? f.budget != null : d === 'screen' ? f.screen.length > 0 : d === 'gpu' ? f.gpu : f[d] != null;
/** Does the laptop pass this one filter? null means "not recorded". */
export function testDim(f: Filters, d: Dim, r: Row): boolean | null {
  if (!isActive(f, d)) return true;
  switch (d) {
    case 'search': { const h = haystack(r); return tokens(f.q).every((t) => h.includes(t)); }
    case 'brand': return f.brands.includes(r.brand);
    case 'price': return optTest('price', String(f.budget), r);
    case 'screen': { const t = f.screen.map((k) => optTest('screen', k, r)); return t.includes(true) ? true : t.includes(null) ? null : false; }
    case 'gpu': return optTest('gpu', '', r);
    default: return optTest(d, f[d] as string, r);
  }
}
const passes = (f: Filters, d: Dim, r: Row) => { const t = testDim(f, d, r); return t === true || (t === null && f.unk.includes(d)); };
export const matchAll = (f: Filters, r: Row, skip?: Dim) => DIMS.every((d) => d === skip || passes(f, d, r));
export const applyFilters = (rows: Row[], f: Filters) => rows.filter((r) => matchAll(f, r));

/** How many laptops each option would show, given every OTHER filter as it stands. */
export function optionCount(rows: Row[], f: Filters, d: Dim, key: string): number {
  return rows.filter((r) => { if (!matchAll(f, r, d)) return false; const t = optTest(d, key, r); return t === true || (t === null && f.unk.includes(d)); }).length;
}
export const dimCount = (rows: Row[], f: Filters, d: Dim) => rows.filter((r) => matchAll(f, r, d)).length;

export interface ActiveChip { id: string; dim: Dim; label: string; remove(f: Filters): Filters }
export function activeChips(f: Filters): ActiveChip[] {
  const out: ActiveChip[] = []; const opt = (d: 'weight' | 'screen' | 'ram' | 'storage', k: string) => OPTS[d].find((o) => o.key === k)?.label ?? k;
  if (isActive(f, 'search')) out.push({ id: 'search', dim: 'search', label: `“${f.q.trim()}”`, remove: (x) => ({ ...x, q: '' }) });
  f.brands.forEach((b) => out.push({ id: `brand-${b}`, dim: 'brand', label: b, remove: (x) => ({ ...x, brands: x.brands.filter((y) => y !== b) }) }));
  if (f.budget != null) out.push({ id: 'price', dim: 'price', label: `Up to ${rupees(f.budget)}`, remove: (x) => ({ ...x, budget: null }) });
  if (f.weight) out.push({ id: 'weight', dim: 'weight', label: opt('weight', f.weight), remove: (x) => ({ ...x, weight: null }) });
  f.screen.forEach((k) => out.push({ id: `screen-${k}`, dim: 'screen', label: opt('screen', k), remove: (x) => ({ ...x, screen: x.screen.filter((y) => y !== k) }) }));
  if (f.ram) out.push({ id: 'ram', dim: 'ram', label: `${opt('ram', f.ram)} RAM`, remove: (x) => ({ ...x, ram: null }) });
  if (f.storage) out.push({ id: 'storage', dim: 'storage', label: `${opt('storage', f.storage)} storage`, remove: (x) => ({ ...x, storage: null }) });
  if (f.gpu) out.push({ id: 'gpu', dim: 'gpu', label: 'Dedicated graphics', remove: (x) => ({ ...x, gpu: false }) });
  return out;
}
export const removeDim = (f: Filters, d: Dim): Filters => ({ ...f, ...(d === 'search' ? { q: '' } : d === 'brand' ? { brands: [] } : d === 'price' ? { budget: null } : d === 'screen' ? { screen: [] } : d === 'gpu' ? { gpu: false } : { [d]: null }), unk: f.unk.filter((x) => x !== d) });

const phrase = (f: Filters, d: Dim): string => {
  if (d === 'search') return `matches “${f.q.trim()}”`; if (d === 'price') return `costs up to ${rupees(f.budget!)}`; if (d === 'gpu') return 'has dedicated graphics';
  if (d === 'screen') return f.screen.map((k) => OPTS.screen.find((o) => o.key === k)!.phrase).join(' or ');
  return OPTS[d as 'weight'].find((o) => o.key === f[d as 'weight'])!.phrase;
};
/** Why nothing is shown, naming the filter that blocks it and the one change that brings laptops back. */
export function explainZero(rows: Row[], f: Filters): { text: string; dim: Dim | null; fix: string; count: number } {
  const act = DIMS.filter((d) => isActive(f, d)); const preds = act.filter((d) => d !== 'brand').map((d) => phrase(f, d));
  const subject = f.brands.length ? `${f.brands.join(' or ')} laptop` : 'laptop'; const text = `No ${subject} ${preds.length ? preds.join(' and ') : 'is listed'}.`;
  let best: { d: Dim; n: number } | null = null; for (const d of act) { const n = dimCount(rows, f, d); if (n > 0 && (!best || n > best.n)) best = { d, n }; }
  return best ? { text, dim: best.d, fix: `Remove ${DIM_NAME[best.d]}`, count: best.n } : { text: `${text} Even one filter on its own leaves nothing.`, dim: null, fix: 'Clear all', count: 0 };
}
/** Laptops that would match but for a value the catalog has not recorded: told, never dropped silently. */
export function leftOutUnknown(rows: Row[], f: Filters): { dim: Dim; n: number; what: string }[] {
  const out: { dim: Dim; n: number; what: string }[] = [];
  for (const d of ['weight', 'screen', 'ram', 'storage', 'gpu'] as Dim[]) {
    if (!isActive(f, d) || f.unk.includes(d)) continue;
    const g = { ...f, unk: [...f.unk, d] }; const n = rows.filter((r) => matchAll(g, r) && testDim(f, d, r) === null).length; if (n > 0) out.push({ dim: d, n, what: WHAT[d]! });
  }
  return out;
}
