// REFINEMENT: a typed update to the needs the person already gave ("change the budget to 80000", "not HP", "lighter", "80k").
// Pure code, no model. Merges into prior_needs and says exactly what changed. Never invents a need.
import { normAttr } from './normalise.ts';
import { offlineRoute, parseBudget } from './router.ts';
import { fmtInr } from './util.ts';
import type { Needs, RawCriterion } from './types.ts';

const key = (c: RawCriterion) => `${normAttr(c.attribute) ?? String(c.attribute).toLowerCase()}`;
export function mergeNeeds(prior: Needs, cur: Needs): Needs {
  const merge = (a: RawCriterion[], b: RawCriterion[]) => { const m = new Map(a.map((c) => [key(c), c])); for (const c of b) m.set(key(c), c); return [...m.values()]; };
  return { budget_max_inr: cur.budget_max_inr ?? prior.budget_max_inr, budget_min_inr: cur.budget_min_inr ?? prior.budget_min_inr,
    musts: merge(prior.musts, cur.musts), shoulds: merge(prior.shoulds.filter((c) => !cur.musts.some((m) => key(m) === key(c))), cur.shoulds), nices: merge(prior.nices, cur.nices),
    use_cases: [...new Set([...prior.use_cases, ...cur.use_cases])] };
}
const setShould = (n: Needs, attribute: string, operator: string, value: number, source_text: string) => { n.shoulds = n.shoulds.filter((c) => normAttr(c.attribute) !== attribute); n.shoulds.push({ attribute, operator, value, source_text }); };
export const MODS: { re: RegExp; apply(n: Needs, base: number | null, notes: string[]): void }[] = [
  { re: /\b(cheaper|lower (?:the )?budget|less expensive|sasta|reduce (?:the )?price)\b/i, apply(n, base, notes) { const b = n.budget_max_inr ?? base; if (b) { n.budget_max_inr = Math.floor((b * 0.85) / 1000) * 1000; notes.push(`"Cheaper" read as a budget of ₹${n.budget_max_inr.toLocaleString('en-IN')} (15% lower). Change it if you like.`); } else notes.push('Tell me a budget and I will go cheaper than that.'); } },
  { re: /\b(lighter|more portable|less weight|thinner|slimmer|not so heavy|less heavy|easier to carry)\b/i, apply(n, _b, notes) { setShould(n, 'weight_kg', '<=', 1.3, 'lighter'); notes.push('"Lighter" read as weight up to 1.3 kg (a Should).'); } },
  { re: /\b(more ram|more memory|bigger ram)\b/i, apply(n, _b, notes) { setShould(n, 'ram_gb', '>=', 16, 'more RAM'); notes.push('"More RAM" read as 16 GB or more (a Should).'); } },
  { re: /\b(bigger screen|larger screen|bigger display)\b/i, apply(n, _b, notes) { setShould(n, 'display_size', '>=', 15, 'bigger screen'); notes.push('"Bigger screen" read as 15 inch or more (a Should).'); } },
  { re: /\b(more storage|bigger ssd|more space)\b/i, apply(n, _b, notes) { setShould(n, 'storage_gb', '>=', 512, 'more storage'); notes.push('"More storage" read as 512 GB or more (a Should).'); } },
  { re: /\b(better battery|longer battery|more battery|battery backup)\b/i, apply(n, _b, notes) { setShould(n, 'battery_wh', '>=', 50, 'better battery'); notes.push('"Better battery" read as 50 Wh or more (a Should).'); } },
];
const NOT_READ = /\b(better|nicer|sharper|brighter) (display|screen)\b|\bfaster\b|\bbetter (performance|camera|speakers?)\b/i;

const LABEL: Record<string, string> = { ram_gb: 'RAM', storage_gb: 'storage', weight_kg: 'weight', display_size: 'screen', battery_wh: 'battery', refresh_hz: 'refresh rate', brand: 'brand', cpu_vendor: 'processor maker', os_family: 'system', gpu_class: 'graphics', hinge_type: 'type', warranty_years: 'warranty', colour: 'colour', cpu_contains: 'processor' };
const UNIT: Record<string, string> = { ram_gb: ' GB', storage_gb: ' GB', weight_kg: ' kg', display_size: ' inch', battery_wh: ' Wh', refresh_hz: ' Hz', warranty_years: ' years' };
function critText(c: RawCriterion, bucket: string): string {
  const a = normAttr(c.attribute) ?? String(c.attribute); const v = Array.isArray(c.value) ? c.value.join(', ') : String(c.value); const u = UNIT[a] ?? '';
  const body = c.operator === 'not_in' ? `not ${v}` : c.operator === '>=' || c.operator === '>' ? `${LABEL[a] ?? a} ${v}${u} or more` : c.operator === '<=' || c.operator === '<' ? `${LABEL[a] ?? a} up to ${v}${u}` : `${LABEL[a] ?? a}: ${v}${u}`;
  return `${body} (${bucket === 'musts' ? 'must' : bucket === 'shoulds' ? 'should' : 'nice to have'})`;
}
const sig = (c: RawCriterion) => JSON.stringify([key(c), c.operator ?? '', c.value]);
const clone = (n: Needs): Needs => JSON.parse(JSON.stringify(n));
const BRAND_RE = '(?:asus|hp|msi|lenovo|acer|apple|macbook|dell|samsung|xiaomi|redmi|realme|infinix|microsoft|surface)';
const CHANGE_VERB = /\b(change|update|set|make|put|raise|increase|lower|reduce|decrease|bump|revise|adjust|move|keep|increase|go)\b/i;
const AMOUNT_ONLY = /^\s*(?:rs\.?|₹|inr)?\s*[\d,.]+\s*(?:k|lakhs?|lacs?|thousand|hazaar|hazar)?\s*(?:rs\.?|rupees)?\s*[.!]?\s*$/i;

export interface Refinement { needs: Needs; changes: string[]; notes: string[]; unchanged: string | null }

/** Is this text a typed update to the needs already given? Returns the merged needs and what changed, or null when it is something else (a new search, a question). */
export function refineNeeds(text: string, prior: Needs | null | undefined, ctxMax?: number | null): Refinement | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim(); if (!prior || !t || t.length > 400) return null;
  const p: Needs = { budget_max_inr: prior.budget_max_inr ?? null, budget_min_inr: prior.budget_min_inr ?? null, musts: prior.musts ?? [], shoulds: prior.shoulds ?? [], nices: prior.nices ?? [], use_cases: prior.use_cases ?? [] };
  const n = clone(p); const notes: string[] = []; let hit = false; let unchanged: string | null = null;
  const base = n.budget_max_inr ?? ctxMax ?? null; const bud = parseBudget(t);
  // ----- budget -----
  const noLimit = /\b(no|remove|removed|without|drop|skip|ignore|forget)\b.{0,20}\b(budget|limit|price)\b|\bno (budget|price) (limit|cap)\b|\bbudget (does not|doesn'?t) matter\b/i.test(t);
  const relative = t.match(/\b(increase|raise|add|bump|up|more|extra|decrease|reduce|lower|cut|drop)\b.{0,25}?\bby\s*(?:rs\.?|₹)?\s*([\d.,]+\s*(?:k|lakhs?|lacs?|thousand)?)/i);
  const pct = t.match(/(\d{1,3})\s*(?:%|per ?cent|percent)\s*(more|less|extra|higher|lower|cheaper)|(?:\+|-)\s*(\d{1,3})\s*%|spend (\d{1,3})\s*(?:%|per ?cent|percent)\s*(more|less)/i);
  const aBitMore = /\b(a bit|slightly|little|bit) more budget\b|\bmore budget\b|\bbigger budget\b|\bhigher budget\b/i.test(t);
  if (noLimit && !bud.max && !bud.min) { hit = true; if (n.budget_max_inr != null || n.budget_min_inr != null) { n.budget_max_inr = null; n.budget_min_inr = null; } else unchanged = 'there was no budget limit to remove'; }
  else if (relative && base) {
    const amt = parseBudget(`under ${relative[2]}`).max ?? parseBudget(relative[2] + (/\d$/.test(relative[2].trim()) ? '000' : '')).bare; const up = /increase|raise|add|bump|up|more|extra/i.test(relative[1]);
    if (amt) { hit = true; n.budget_max_inr = Math.max(5000, base + (up ? amt : -amt)); }
  } else if (pct && base) {
    const v = Number(pct[1] ?? pct[3] ?? pct[4]); const word = String(pct[2] ?? pct[5] ?? ''); const down = /less|lower|cheaper/i.test(word) || /^-/.test(pct[0]); hit = true;
    n.budget_max_inr = Math.round((base * (1 + (down ? -v : v) / 100)) / 1000) * 1000;
  } else if (aBitMore && !bud.max && base) { hit = true; n.budget_max_inr = Math.round((base * 1.15) / 1000) * 1000; notes.push('"More budget" read as 15% higher. Change it if you like.'); }
  else if ((CHANGE_VERB.test(t) && /\bbudget\b/i.test(t)) || /^\s*(?:ok(?:ay)?[, ]+|please )?(?:make it|set it( to)?|go (?:to|up to)|let'?s (?:say|go))\b/i.test(t) || AMOUNT_ONLY.test(t) || /\bmake it\b/i.test(t) && (bud.max || bud.bare)) {
    const amountSrc = (() => { const i = t.toLowerCase().lastIndexOf('budget'); return i >= 0 ? t.slice(i) : t; })();
    const b2 = i2(amountSrc, t);
    if (b2.min != null || b2.max != null || b2.bare != null) { hit = true; if (b2.min != null) n.budget_min_inr = b2.min; if (b2.max != null) n.budget_max_inr = b2.max; else if (b2.bare != null) n.budget_max_inr = b2.bare; }
    else if (/\bbudget\b/i.test(t)) { hit = true; unchanged = 'I did not see an amount. Tell me the budget in rupees, for example 80000 or 1 lakh'; }
  }
  // ----- modifiers (lighter, more RAM, better battery) -----
  for (const m of MODS) if (m.re.test(t) && !(m === MODS[0] && hit)) { hit = true; m.apply(n, ctxMax ?? null, notes); }
  if (NOT_READ.test(t)) { hit = true; notes.push('I cannot rank by that yet. Tell me a number, for example a screen size, a refresh rate or a weight.'); }
  // ----- added requirements and exclusions -----
  const starts = /^\s*(?:ok(?:ay)?[, ]+)?(?:also|plus|and also|additionally|and|i (?:also )?(?:need|want)|it (?:must|should|needs?)|needs?|must have|with)\b/i.test(t);
  const excl = new RegExp(`^\\s*(?:ok(?:ay)?[, ]+)?(?:please )?(not|no|except|without|avoid|exclude|other than|nothing from)\\s+(?:any\\s+)?(?:${BRAND_RE})\\b`, 'i').test(t);
  const specAdd = starts || excl || /\bmust be\b|\bneeds? (?:at least )?\d/i.test(t);
  if (specAdd) {
    const r = offlineRoute(t).needs; const add: Needs = { budget_max_inr: null, budget_min_inr: null, musts: r.musts.filter((c) => c.attribute !== 'colour' || true), shoulds: r.shoulds, nices: r.nices, use_cases: [] };
    const brandOut = add.musts.filter((c) => normAttr(c.attribute) === 'brand' && c.operator === 'not_in'); add.musts = add.musts.filter((c) => !brandOut.includes(c));
    if (add.musts.length || add.shoulds.length || add.nices.length || brandOut.length) {
      hit = true; const merged = mergeNeeds(n, add); n.musts = merged.musts; n.shoulds = merged.shoulds; n.nices = merged.nices;
      for (const b of brandOut) { const have = n.musts.find((c) => normAttr(c.attribute) === 'brand' && c.operator === 'not_in'); if (have) have.value = [...new Set([...(have.value as string[]), ...(b.value as string[])])]; else n.musts.push(b); }
    }
  }
  const useChange = t.match(/^\s*(actually|instead|now)?\s*(?:,\s*)?(?:it is |it's |this is )?for\s+(?!my |a |an |our |the )(.+)$/i);
  if (useChange) { const uc = offlineRoute(`laptop for ${useChange[2]}`).needs.use_cases; if (uc.length) { hit = true; n.use_cases = /actually|instead/i.test(t) ? uc : [...new Set([...n.use_cases, ...uc])]; } }
  if (!hit) return null;
  // ----- what changed, exactly -----
  const changes: string[] = [];
  if (n.budget_max_inr !== p.budget_max_inr) changes.push(n.budget_max_inr == null ? 'budget limit removed' : `budget up to ${fmtInr(n.budget_max_inr)}`);
  if (n.budget_min_inr !== p.budget_min_inr) changes.push(n.budget_min_inr == null ? 'lowest price removed' : `budget from ${fmtInr(n.budget_min_inr)}`);
  for (const b of ['musts', 'shoulds', 'nices'] as const) {
    const had = new Set(p[b].map(sig)); for (const c of n[b]) if (!had.has(sig(c))) changes.push(critText(c, b));
    const has = new Set(n[b].map(sig)); for (const c of p[b]) if (!has.has(sig(c)) && !([...n.musts, ...n.shoulds, ...n.nices].some((x) => key(x) === key(c) && b !== 'musts'))) { /* replaced criteria are reported as the new one */ }
  }
  const addedUse = n.use_cases.filter((u) => !p.use_cases.includes(u)); if (addedUse.length || n.use_cases.length !== p.use_cases.length) changes.push(`use: ${n.use_cases.join(', ') || 'none'}`);
  return { needs: n, changes, notes, unchanged: changes.length ? null : (unchanged ?? 'your needs already say that') };
}
function i2(src: string, whole: string) { const a = parseBudget(src); if (a.min != null || a.max != null || a.bare != null) return a; return parseBudget(whole); }

/** The one notice line for a refinement. */
export function refineNotice(r: Refinement): string { return r.changes.length ? `Updated: ${r.changes.join('; ')}.` : `I did not change anything: ${r.unchanged}.`; }
