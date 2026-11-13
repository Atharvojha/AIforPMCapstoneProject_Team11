// Ranking, colour fallback and "which Must to relax" are all computed here, never by the model.
import { evalCriterion, describe, criteriaFromNeeds, toFilterArgs, normCriterion, isCodeOnly, type Criterion, type CriteriaSet } from './normalise.ts';
import type { Needs, Row, RawCriterion, Settings } from './types.ts';
import type { Tools } from './tools.ts';

export interface Evidence { n: number; positive: number; negative: number }
export interface Scored { row: Row; score: number; metShoulds: Criterion[]; metNices: Criterion[]; evidence: Evidence }

const hasDedicatedGpu = (r: Row) => /nvidia|geforce|rtx|gtx|radeon rx|arc/i.test(r.gpu_text ?? '');
const USE_RULES: [RegExp, (r: Row) => number][] = [
  [/light|travel|portab|commut|carry/, (r) => (r.weight_kg == null ? 0 : (2.2 - r.weight_kg) * 2)],
  [/cod|program|develop|engineer|software/, (r) => (r.ram_gb ?? 0) / 8 + (r.storage_gb ?? 0) / 512 + ((r.ram_gb ?? 0) >= 16 ? 1 : 0)],
  [/edit|video|design|photo|render|creat/, (r) => ((r.ram_gb ?? 0) / 8) * 1.5 + (r.storage_gb ?? 0) / 512 + (hasDedicatedGpu(r) ? 1 : 0)],
  [/gam/, (r) => (hasDedicatedGpu(r) ? 4 : 0) + (r.ram_gb ?? 0) / 16],
  [/study|student|college|school|office|work|browsing|account|admin|sales|basic|class/, (r) => ((r.ram_gb ?? 0) >= 8 ? 1 : 0) + ((r.display_size ?? 0) >= 14 ? 0.5 : 0) - (r.price_inr ?? 0) / 200000],
  [/^value$/, (r) => -(r.price_inr ?? 0) / 20000],
  [/note|draw|sketch|tablet|pen|handwrit|present/, (r) => (r.hinge_type && r.hinge_type !== 'clamshell' ? 2 : 0)],
];
export function useScore(row: Row, uses: string[]): number {
  let s = 0; for (const u of uses ?? []) for (const [re, fn] of USE_RULES) if (re.test(String(u).toLowerCase())) s += fn(row); return s;
}

/** The one way to find laptops for a set of needs: SQL for the fields in the database, code for processor text. */
export async function findRows(tools: Tools, needs: Needs, musts: Criterion[]): Promise<{ rows: Row[]; unknown_values: Record<string, number> }> {
  const found = await tools.call<{ rows: Row[]; unknown_values: Record<string, number> }>('find_variants', toFilterArgs(needs, musts));
  const codeOnly = musts.filter((c) => c.supported && isCodeOnly(c));
  return { rows: found.rows.filter((r) => codeOnly.every((c) => evalCriterion(c, r) === true)), unknown_values: found.unknown_values };
}

export function rank(rows: Row[], needs: Needs, crit: CriteriaSet, evidence: Map<string, Evidence>, settings: Settings, bonus: Map<string, number> = new Map()): Scored[] {
  const w = settings.WEIGHTS ?? { should: 3, nice: 1, price_headroom: 0.5, evidence: 0.5 }; const minN = settings.MIN_EVIDENCE_N ?? 20;
  const out = rows.map((row) => {
    const metShoulds = crit.shoulds.filter((c) => evalCriterion(c, row) === true);
    const metNices = crit.nices.filter((c) => evalCriterion(c, row) === true);
    const ev = evidence.get(row.variant_id) ?? { n: 0, positive: 0, negative: 0 };
    let score = metShoulds.length * w.should + metNices.length * w.nice + useScore(row, needs.use_cases) + (bonus.get(row.variant_id) ?? 0);
    if (needs.budget_max_inr && row.price_inr != null) score += w.price_headroom * (1 - row.price_inr / needs.budget_max_inr);
    if (ev.n >= minN && ev.positive + ev.negative > 0) score += w.evidence * (ev.positive / (ev.positive + ev.negative) - 0.5);
    return { row, score, metShoulds, metNices, evidence: ev };
  });
  out.sort((a, b) => b.score - a.score || (a.row.price_inr ?? 0) - (b.row.price_inr ?? 0) || a.row.variant_id.localeCompare(b.row.variant_id));
  return out;
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
  return out.sort((a, b) => b.adds - a.adds).slice(0, 2);
}
