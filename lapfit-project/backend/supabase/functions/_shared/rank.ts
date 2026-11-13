// Ranking, colour fallback and "which Must to relax" are all computed here, never by the model.
import { evalCriterion, describe, criteriaFromNeeds, toFilterArgs, normCriterion, isCodeOnly, type Criterion, type CriteriaSet } from './normalise.ts';
import type { Needs, Row, RawCriterion, Settings } from './types.ts';
import type { Tools } from './tools.ts';

export interface Evidence { n: number; positive: number; negative: number }
export interface MatchInfo { pct: number; cap: number; sat: number | null; shouldsMet: number; shouldsAll: number; nicesMet: number; nicesAll: number; unknown: string[] }
export interface Scored { row: Row; score: number; metShoulds: Criterion[]; metNices: Criterion[]; evidence: Evidence; match?: MatchInfo }

// ---------- the transparent fit score (docs: prototype/fixes/RANKING.md) ----------
// Every term below comes from a RECORDED value. An unknown value earns nothing; it is never guessed.
export type SortKey = 'best' | 'budget' | 'price_low' | 'price_high' | 'light' | 'reviews';
export const SORT_KEYS: SortKey[] = ['best', 'budget', 'price_low', 'price_high', 'light', 'reviews'];
export const SORT_LABEL: Record<SortKey, string> = { best: 'Best fit', budget: 'Closest to budget', price_low: 'Price: low to high', price_high: 'Price: high to low', light: 'Lightest', reviews: 'Most owner opinions' };
export const isSortKey = (x: unknown): x is SortKey => typeof x === 'string' && (SORT_KEYS as string[]).includes(x);

/** Processor strength 0..5 read from the recorded processor text only; null when it cannot be read. */
export function cpuTier(text: string | null | undefined): number | null {
  if (!text) return null; const t = text.toLowerCase(); let tier: number | null = null;
  if (/\bm[1-4]\b/.test(t)) tier = 4;
  else if (/\bi9\b|ryzen 9|ultra 9/.test(t)) tier = 5;
  else if (/\bi7\b|ryzen 7|ultra 7|\br7[- ]/.test(t)) tier = 4;
  else if (/\bi5\b|ryzen 5|ultra 5|\br5[- ]/.test(t)) tier = 3;
  else if (/\bi3\b|ryzen 3|\br3[- ]/.test(t)) tier = 2;
  else if (/celeron|pentium|athlon|atom|dual core/.test(t)) tier = 1;
  if (tier == null) return null;
  const gen = t.match(/(\d{1,2})(?:st|nd|rd|th) gen/); if (gen) tier += Math.max(-0.3, Math.min(0.6, (Number(gen[1]) - 10) * 0.1));
  return tier;
}
const GPU_RE = /nvidia|geforce|rtx|gtx|radeon rx|\barc\b/i;
export const gpuScore = (r: Row): number | null => (r.gpu_class === 'dedicated' || GPU_RE.test(r.gpu_text ?? '') ? (/rtx/i.test(r.gpu_text ?? '') ? 1 : 0.8) : r.gpu_class != null || r.gpu_text ? 0 : null);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

type Comp = 'ram' | 'storage' | 'cpu' | 'gpu' | 'screen' | 'weight' | 'battery' | 'form' | 'cheap';
export const BASE_WEIGHTS: Record<Comp, number> = { ram: 3, storage: 1.5, cpu: 3, gpu: 1, screen: 0.5, weight: 0.5, battery: 0.5, form: 0, cheap: 0 };
const USE_WEIGHTS: [RegExp, Partial<Record<Comp, number>>][] = [
  [/study|student|college|school|class|office|work|browsing|account|admin|sales|basic/, { ram: 1, cpu: 1, battery: 1, weight: 0.5, screen: 0.5 }],
  [/cod|program|develop|engineer|software/, { ram: 3, cpu: 3, storage: 1 }],
  [/gam/, { gpu: 7, cpu: 2, ram: 1 }],
  [/edit|video|design|photo|render|creat/, { gpu: 3, ram: 2, cpu: 2, storage: 1.5, screen: 1 }],
  [/light|travel|portab|commut|carry/, { weight: 4, battery: 2.5 }],
  [/^value$/, { cheap: 4 }],
  [/note|draw|sketch|tablet|pen|handwrit|present/, { form: 3 }],
  // wider real-world uses: which recorded specs matter for each (documented in prototype/fixes/RANKING.md)
  [/^cad$|architect|3d|animation|vfx|blender|solidworks/, { gpu: 4, ram: 3, cpu: 3, storage: 1.5, screen: 1 }],
  [/data|machine|^ml$|analytics/, { ram: 4, cpu: 4, storage: 1.5, gpu: 1 }],
  [/trading|stock|forex/, { ram: 2, cpu: 2, screen: 2, battery: 0.5 }],
  [/music|audio/, { ram: 3, cpu: 3, storage: 2 }],
  [/stream|youtube|content|vlog/, { cpu: 3, ram: 2, gpu: 2, storage: 1.5 }],
  [/online class|teach|meeting|call/, { battery: 1.5, weight: 1, ram: 1.5, cpu: 1 }],
  [/accounting|excel|finance|business/, { ram: 2, cpu: 2, screen: 1, storage: 0.5 }],
  [/kid|child|medical/, { ram: 1, cpu: 1, battery: 1, weight: 0.5 }],
];
export function weightsFor(uses: string[]): Record<Comp, number> {
  const w = { ...BASE_WEIGHTS };
  for (const u of uses ?? []) for (const [re, d] of USE_WEIGHTS) if (re.test(String(u).toLowerCase())) for (const k of Object.keys(d) as Comp[]) w[k] += d[k]!;
  return w;
}
/** 0..100: how strong this laptop is for the stated use, from recorded values only. Missing values add nothing. */
export function capability(row: Row, uses: string[], maxPrice: number | null = null): number {
  const w = weightsFor(uses); const cpu = cpuTier(row.cpu_text); const gpu = gpuScore(row);
  const c: Record<Comp, number> = {
    ram: row.ram_gb == null ? 0 : clamp01(row.ram_gb / 32), storage: row.storage_gb == null ? 0 : clamp01(row.storage_gb / 1024),
    cpu: cpu == null ? 0 : clamp01(cpu / 5), gpu: gpu ?? 0, screen: row.display_size == null ? 0 : row.display_size >= 14 && row.display_size <= 16.5 ? 1 : 0.6,
    weight: row.weight_kg == null ? 0 : clamp01((2.4 - row.weight_kg) / 1.4), battery: row.battery_wh == null ? 0 : clamp01(row.battery_wh / 80),
    form: row.hinge_type && row.hinge_type !== 'clamshell' ? 1 : 0, cheap: row.price_inr != null && maxPrice ? clamp01(1 - row.price_inr / maxPrice) : 0,
  };
  const total = (Object.keys(w) as Comp[]).reduce((a, k) => a + w[k], 0);
  return (100 * (Object.keys(w) as Comp[]).reduce((a, k) => a + w[k] * c[k], 0)) / total;
}
/** Kept for callers that only want a use-based number. */
export const useScore = (row: Row, uses: string[]) => capability(row, uses);

/** Plain strengths of a laptop, from recorded values, used in the "why it is here" line. */
export function strengthsOf(r: Row): string[] {
  const o: string[] = [];
  if (r.ram_gb != null) o.push(`${r.ram_gb} GB RAM`); if (r.storage_gb != null) o.push(`${r.storage_gb >= 1024 ? r.storage_gb / 1024 + ' TB' : r.storage_gb + ' GB'} storage`);
  if (r.cpu_text) o.push(`${r.cpu_text} processor`); if (gpuScore(r)) o.push('separate graphics');
  return o;
}

export const KNOWN_USE = (u: string) => USE_WEIGHTS.some(([re]) => re.test(String(u).toLowerCase()));
export const hasPrice = (r: Row) => r.price_inr != null && Number.isFinite(r.price_inr) && r.price_inr > 0;
export const isIndia = (r: Row) => (r.market ?? 'IN') === 'IN';
/** An India shortlist only holds laptops that are sold in India and have a rupee price on file. */
export const sellable = (r: Row) => isIndia(r) && hasPrice(r);

/** The one way to find laptops for a set of needs: SQL for the fields in the database, code for processor text. */
export async function findRows(tools: Tools, needs: Needs, musts: Criterion[]): Promise<{ rows: Row[]; unknown_values: Record<string, number> }> {
  const found = await tools.call<{ rows: Row[]; unknown_values: Record<string, number> }>('find_variants', toFilterArgs(needs, musts));
  const codeOnly = musts.filter((c) => c.supported && isCodeOnly(c));
  return { rows: found.rows.filter((r) => sellable(r) && codeOnly.every((c) => evalCriterion(c, r) === true)), unknown_values: found.unknown_values };
}

export interface RankOpts { sort?: SortKey }
/** True when the person gave only a budget (or nothing): no use, Should or Nice. Then "more laptop for the money" decides. */
export const budgetOnly = (needs: Needs, crit: CriteriaSet) => !(needs.use_cases ?? []).length && !crit.shoulds.length && !crit.nices.length && !crit.musts.some((c) => !c.implicit);
export function rank(rows: Row[], needs: Needs, crit: CriteriaSet, evidence: Map<string, Evidence>, settings: Settings, bonus: Map<string, number> = new Map(), opts: RankOpts = {}): Scored[] {
  const w = settings.WEIGHTS ?? {}; const wShould = w.should ?? 6; const wNice = w.nice ?? 2; const wEv = w.evidence ?? 6; const wNear = w.near_budget ?? 6;
  const minN = settings.MIN_EVIDENCE_N ?? 20; const sort: SortKey = opts.sort ?? 'best';
  const bonly = budgetOnly(needs, crit); const uses = needs.use_cases ?? []; const wantsCheap = uses.some((u) => /^value$/i.test(u));
  const budget = needs.budget_max_inr && needs.budget_max_inr > 0 ? needs.budget_max_inr : null;
  const maxPrice = Math.max(0, ...rows.map((r) => (hasPrice(r) ? (r.price_inr as number) : 0))) || null;
  const out = rows.map((row) => {
    const metShoulds = crit.shoulds.filter((c) => evalCriterion(c, row) === true);
    const metNices = crit.nices.filter((c) => evalCriterion(c, row) === true);
    const ev = evidence.get(row.variant_id) ?? { n: 0, positive: 0, negative: 0 };
    let score = capability(row, uses, maxPrice) + metShoulds.length * wShould + metNices.length * wNice + (bonus.get(row.variant_id) ?? 0) * 5;
    // secondary factor, only when the person gave nothing but a budget: among laptops that fit, one that uses more of the budget is the "more laptop for the money" side. Not when the person asked for cheap.
    if (budget && bonly && hasPrice(row) && !wantsCheap) score += wNear * clamp01((row.price_inr as number) / budget);
    if (ev.n >= minN && ev.positive + ev.negative > 0) { const ratio = ev.positive / (ev.positive + ev.negative); score += wEv * (ratio - 0.5) + (ratio >= 0.5 ? 2 * Math.min(1, ev.n / 100) : 0); }
    // MATCH %: how well this laptop satisfies what was stated, from recorded values only. With only a use and a budget it is the capability score itself (0..100);
    // with Shoulds/Nices it blends capability (65%) with the share of them met (35%). Unknown values earn nothing and are listed.
    const cap = capability(row, uses, maxPrice); const nS = crit.shoulds.length, nN = crit.nices.length;
    const sat = nS + nN ? (metShoulds.length + 0.5 * metNices.length) / (nS + 0.5 * nN) : null;
    const unknown = ([['ram_gb', 'RAM'], ['storage_gb', 'storage'], ['cpu_text', 'processor'], ['display_size', 'screen size'], ['weight_kg', 'weight'], ['battery_wh', 'battery']] as [keyof Row, string][]).filter(([k]) => (row as any)[k] == null).map(([, n]) => n);
    const match: MatchInfo = { pct: Math.max(0, Math.min(100, Math.round(sat == null ? cap : 0.65 * cap + 35 * sat))), cap: Math.round(cap), sat, shouldsMet: metShoulds.length, shouldsAll: nS, nicesMet: metNices.length, nicesAll: nN, unknown };
    return { row, score, metShoulds, metNices, evidence: ev, match };
  });
  out.sort(comparator(sort));
  return out;
}
const idc = (a: Scored, b: Scored) => a.row.variant_id.localeCompare(b.row.variant_id);
const pr = (s: Scored) => (hasPrice(s.row) ? (s.row.price_inr as number) : null);
const cmpNullLast = (a: number | null, b: number | null, dir: 1 | -1) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : (a - b) * dir);
const byScore = (a: Scored, b: Scored) => Math.round((b.score - a.score) * 1e6) / 1e6;
const byPriceAsc = (a: Scored, b: Scored) => cmpNullLast(pr(a), pr(b), 1);
/** Deterministic: the sort key first, then the fit score, then price (low first), then id. */
export function comparator(sort: SortKey): (a: Scored, b: Scored) => number {
  const key: Record<SortKey, (a: Scored, b: Scored) => number> = {
    best: byScore, budget: (a, b) => cmpNullLast(pr(a), pr(b), -1), price_low: byPriceAsc, price_high: (a, b) => cmpNullLast(pr(a), pr(b), -1),
    light: (a, b) => cmpNullLast(a.row.weight_kg ?? null, b.row.weight_kg ?? null, 1), reviews: (a, b) => b.evidence.n - a.evidence.n,
  };
  return (a, b) => key[sort](a, b) || byScore(a, b) || byPriceAsc(a, b) || idc(a, b);
}
export function onePerModel(list: Scored[]): Scored[] { const seen = new Set<number>(); return list.filter((s) => (seen.has(s.row.model_id) ? false : (seen.add(s.row.model_id), true))); }

// ---------- colours ----------
const NEAR: Record<string, string[]> = {
  blue: ['navy', 'teal', 'grey'], navy: ['blue', 'black', 'grey'], red: ['maroon', 'pink', 'orange'], green: ['teal', 'blue', 'grey'],
  white: ['silver', 'grey'], silver: ['grey', 'white'], grey: ['silver', 'black'], gray: ['silver', 'black'], black: ['grey', 'navy'],
  pink: ['red', 'white'], gold: ['silver', 'white'], purple: ['blue', 'navy'], orange: ['red', 'gold'],
};
const DARK = ['black', 'navy', 'grey'];
export function nearestColour(wanted: string, available: string[]): { kind: 'exact' | 'nearest' | 'dark'; colour: string } | null {
  const have = [...new Set(available.map((x) => x.toLowerCase()))]; const w = wanted.toLowerCase();
  if (have.includes(w)) return { kind: 'exact', colour: w };
  for (const n of NEAR[w] ?? []) if (have.includes(n)) return { kind: 'nearest', colour: n };
  for (const d of DARK) if (have.includes(d)) return { kind: 'dark', colour: d };
  return null;
}
/** Notes for colours the buyer wanted. If the catalog holds no colour data at all, say so instead of guessing. */
export function colourNotes(wanted: string[], shown: Row[]): string[] {
  const notes: string[] = []; const all = shown.flatMap((r) => r.colours ?? []);
  for (const w of wanted) {
    if (!all.length) { notes.push(`I do not have colour data for these laptops yet, so I cannot check ${w}.`); continue; }
    const m = nearestColour(w, all);
    if (m && m.kind !== 'exact') { const holder = shown.find((r) => (r.colours ?? []).map((x) => x.toLowerCase()).includes(m.colour)); notes.push(`None of these come in ${w}. ${m.kind === 'nearest' ? 'The nearest colour is' : 'A dark colour is'} ${m.colour}, on ${holder?.display_name ?? 'one of them'}.`); }
    else if (!m) notes.push(`None of these come in ${w}, and no dark option is listed.`);
  }
  return notes;
}

// ---------- which Must to relax ----------
export interface RelaxOption { label: string; adds: number; needs: Needs }
export async function relaxOptions(tools: Tools, needs: Needs, crit: CriteriaSet): Promise<RelaxOption[]> {
  const out: RelaxOption[] = [];
  for (const m of crit.musts.filter((c) => c.supported)) {
    const rest = crit.musts.filter((c) => c !== m);
    const adjusted: Needs = { ...needs, budget_max_inr: m.implicit && m.operator === '<=' ? null : needs.budget_max_inr, budget_min_inr: m.implicit && m.operator === '>=' ? null : needs.budget_min_inr };
    const res = await findRows(tools, adjusted, rest);
    if (!res.rows.length) continue;
    const attr = m.attribute as string;
    if (typeof m.value === 'number') {
      const dir = m.operator === '<=' || m.operator === '<' ? 1 : -1;
      const vals = res.rows.map((r) => (r as any)[attr] as number | null).filter((x): x is number => x != null).sort((a, b) => (a - b) * dir);
      if (!vals.length) continue;
      const relaxed = vals[0]; const adds = vals.filter((x) => (dir === 1 ? x <= relaxed : x >= relaxed)).length;
      const n2 = JSON.parse(JSON.stringify(needs)) as Needs;
      if (m.implicit) { if (m.operator === '<=') n2.budget_max_inr = relaxed; else n2.budget_min_inr = relaxed; }
      else { const i = n2.musts.findIndex((x) => x === m.raw || (normCriterion(x).attribute === attr)); if (i >= 0) n2.musts[i] = { ...n2.musts[i], value: relaxed }; }
      out.push({ label: `Change "${m.label}" to "${describe({ attribute: attr, operator: m.operator, value: relaxed })}"`, adds, needs: n2 });
    } else {
      const n2 = JSON.parse(JSON.stringify(needs)) as Needs; const i = n2.musts.findIndex((x) => normCriterion(x).attribute === attr); if (i >= 0) n2.musts.splice(i, 1);
      out.push({ label: `Drop "${m.label}"`, adds: res.rows.length, needs: n2 });
    }
  }
  return out.sort((a, b) => b.adds - a.adds).slice(0, 3);
}
