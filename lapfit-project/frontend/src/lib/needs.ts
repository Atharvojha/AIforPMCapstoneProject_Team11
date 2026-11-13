import type { Needs, RawCriterion, Reply } from './types';

export const emptyNeeds = (): Needs => ({ budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] });

/** The needs the backend says it understood in the last reply; sent back for follow-ups ("cheaper", "only Lenovo"). */
export function understoodNeeds(reply: Reply | null | undefined): Needs | null {
  const b = reply?.blocks.find((x) => x.type === 'understood');
  return b ? (b.needs as Needs) : null;
}

export type Tier = 'musts' | 'shoulds' | 'nices';
const strip = (c: RawCriterion): RawCriterion => ({ attribute: c.attribute, operator: c.operator, value: c.value, source_text: c.source_text });
/** Move a need to another tier, or remove it (tier = null). */
export function moveNeed(n: Needs, from: Tier, index: number, to: Tier | null): Needs {
  const out: Needs = JSON.parse(JSON.stringify(n)); const [item] = out[from].splice(index, 1);
  if (item && to) out[to].push(item);
  return out;
}
/** What is sent to the backend: only the fields it reads. */
export function cleanNeeds(n: Needs): Needs {
  return { budget_max_inr: n.budget_max_inr, budget_min_inr: n.budget_min_inr, musts: n.musts.map(strip), shoulds: n.shoulds.map(strip), nices: n.nices.map(strip), use_cases: [...n.use_cases] };
}
export const sameNeeds = (a: Needs, b: Needs) => JSON.stringify(cleanNeeds(a)) === JSON.stringify(cleanNeeds(b));

/** "60k", "1.5 lakh", "₹62,990" typed into a budget box. Returns null if not a usable amount. */
export function parseBudget(s: string): number | null {
  const t = s.toLowerCase().replace(/[₹,\s]|rs\.?|inr/g, '');
  const m = t.match(/^(\d+(?:\.\d+)?)(k|lakh|lac|l)?$/); if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] === 'k' ? 1000 : m[2] ? 100000 : 1);
  return n >= 1000 && n <= 10_000_000 ? Math.round(n) : null;
}
export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
