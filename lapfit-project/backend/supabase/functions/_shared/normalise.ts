// Turns what the model (or the controls) says into exact criteria that code can check.
import { parseInrAmounts, fmtInr, fmtStorage } from './util.ts';
import type { RawCriterion, Row, Needs } from './types.ts';

export type Op = '>=' | '<=' | '=' | '>' | '<' | 'in' | 'not_in';
export interface Criterion {
  supported: boolean; attribute: string | null; operator: Op; value: number | string[] | null;
  label: string; source_text: string; implicit?: boolean; raw: RawCriterion;
}

type Kind = 'num' | 'enum' | 'colour' | 'text' | 'cpu';
const KIND: Record<string, { kind: Kind; def: Op; sql: boolean }> = {
  ram_gb: { kind: 'num', def: '>=', sql: true }, storage_gb: { kind: 'num', def: '>=', sql: true }, weight_kg: { kind: 'num', def: '<=', sql: true },
  price_inr: { kind: 'num', def: '<=', sql: true }, display_size: { kind: 'num', def: '>=', sql: true }, warranty_years: { kind: 'num', def: '>=', sql: true },
  battery_wh: { kind: 'num', def: '>=', sql: true }, refresh_hz: { kind: 'num', def: '>=', sql: true },
  hinge_type: { kind: 'enum', def: 'in', sql: true }, colour: { kind: 'colour', def: 'in', sql: true },
  brand: { kind: 'text', def: 'in', sql: true }, cpu_vendor: { kind: 'text', def: 'in', sql: true }, os_family: { kind: 'text', def: 'in', sql: true }, gpu_class: { kind: 'text', def: 'in', sql: true },
  cpu_contains: { kind: 'cpu', def: 'in', sql: false },   // matched in code against the processor text
};
export const isCodeOnly = (c: Criterion) => !!c.attribute && !KIND[c.attribute].sql;
export const SUPPORTED_ATTRIBUTES = Object.keys(KIND);
const ALIAS: Record<string, string> = {
  ram: 'ram_gb', memory: 'ram_gb', ram_gb: 'ram_gb', storage: 'storage_gb', ssd: 'storage_gb', storage_gb: 'storage_gb', disk: 'storage_gb',
  weight: 'weight_kg', weight_kg: 'weight_kg', kg: 'weight_kg', price: 'price_inr', budget: 'price_inr', price_inr: 'price_inr', cost: 'price_inr',
  screen: 'display_size', screen_size: 'display_size', display: 'display_size', display_size: 'display_size', size: 'display_size',
  warranty: 'warranty_years', warranty_years: 'warranty_years', hinge: 'hinge_type', hinge_type: 'hinge_type', form_factor: 'hinge_type', type: 'hinge_type',
  colour: 'colour', color: 'colour', colours: 'colour', colors: 'colour',
  battery: 'battery_wh', battery_wh: 'battery_wh', refresh: 'refresh_hz', refresh_rate: 'refresh_hz', refresh_hz: 'refresh_hz', hz: 'refresh_hz',
  brand: 'brand', make: 'brand', company: 'brand', cpu_vendor: 'cpu_vendor', processor_maker: 'cpu_vendor', os: 'os_family', os_family: 'os_family', operating_system: 'os_family',
  gpu: 'gpu_class', gpu_class: 'gpu_class', graphics: 'gpu_class', graphics_card: 'gpu_class', cpu: 'cpu_contains', processor: 'cpu_contains', cpu_contains: 'cpu_contains',
};
export const normAttr = (a: string) => ALIAS[String(a).toLowerCase().trim().replace(/[\s-]+/g, '_')] ?? null;
const OPS: Record<string, Op> = {
  '>=': '>=', '≥': '>=', gte: '>=', min: '>=', at_least: '>=', 'at least': '>=', minimum: '>=',
  '<=': '<=', '≤': '<=', lte: '<=', max: '<=', at_most: '<=', 'at most': '<=', maximum: '<=', under: '<=', below: '<=',
  not_in: 'not_in', not: 'not_in', exclude: 'not_in', except: 'not_in', without: 'not_in', no: 'not_in', '!=': 'not_in',
  '=': '=', '==': '=', is: '=', eq: '=', equals: '=', '>': '>', gt: '>', more_than: '>', '<': '<', lt: '<', less_than: '<', in: 'in', one_of: 'in',
};
export const HINGE_LABEL: Record<string, string> = { clamshell: 'Regular laptop (clamshell)', convertible_360: '360° convertible', detachable: 'Detachable keyboard' };
function hingeOf(s: unknown): string | null {
  const t = String(s).toLowerCase();
  if (/convert|360|flip|yoga|2[\s-]?in[\s-]?1|fold|touch/.test(t)) return 'convertible_360';
  if (/detach|tablet/.test(t)) return 'detachable';
  if (/clam|regular|normal|laptop|standard/.test(t)) return 'clamshell';
  return null;
}
const BRANDS: [RegExp, string][] = [[/apple|mac(book)?/i, 'apple'], [/hp|hewlett/i, 'hp'], [/asus|vivobook|zenbook|tuf|rog/i, 'asus'], [/lenovo|ideapad|thinkpad|legion|yoga/i, 'lenovo'], [/dell|inspiron|xps|alienware/i, 'dell'], [/acer|aspire|nitro|predator|swift/i, 'acer'], [/msi/i, 'msi'], [/samsung|galaxy book/i, 'samsung'], [/infinix|redmi|xiaomi|realme|honor|huawei|microsoft|surface/i, '$&']];
function textValue(attr: string, v: unknown): string | null {
  const t = String(v).toLowerCase().trim(); if (!t) return null;
  if (attr === 'brand') { for (const [re, b] of BRANDS) if (re.test(t)) return b === '$&' ? (t.match(re) as RegExpMatchArray)[0] : b; return t; }
  if (attr === 'os_family') return /mac|apple|osx/.test(t) ? 'macos' : /win/.test(t) ? 'windows' : null;
  if (attr === 'cpu_vendor') return /intel|core|\bi[3579]\b|celeron|pentium/.test(t) ? 'intel' : /amd|ryzen|athlon/.test(t) ? 'amd' : /apple|\bm[1-4]\b/.test(t) ? 'apple' : null;
  if (attr === 'gpu_class') return /dedic|nvidia|geforce|rtx|gtx|radeon|separate|graphics card|gaming/.test(t) ? 'dedicated' : /integr|inbuilt|onboard|shared/.test(t) ? 'integrated' : null;
  return t;
}
function numberOf(attr: string, v: unknown): number | null {
  if (typeof v === 'number') return v;
  const s = String(v).toLowerCase().replace(/,/g, '');
  if (attr === 'price_inr') { const a = parseInrAmounts(s); if (a.length) return a[0].value; }
  const m = s.match(/(\d+(?:\.\d+)?)\s*(tb|gb|kg|g|inch|in|"|years?|yrs?)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === 'tb') n *= 1024;
  if (attr === 'weight_kg' && m[2] === 'g') n /= 1000;
  return n;
}

const DISPLAY: Record<string, string> = { hp: 'HP', msi: 'MSI', asus: 'ASUS', amd: 'AMD', macos: 'macOS' };
const cap = (x: string) => DISPLAY[x] ?? x[0].toUpperCase() + x.slice(1);
export function describe(c: { attribute: string | null; operator: Op; value: any }): string {
  const { attribute: a, operator: o, value: v } = c;
  const up = (u: string) => (o === '<=' ? `up to ${u}` : o === '>=' ? `${u} or more` : o === '<' ? `under ${u}` : o === '>' ? `over ${u}` : u);
  switch (a) {
    case 'ram_gb': return `RAM ${up(v + ' GB')}`;
    case 'storage_gb': return `Storage ${up(fmtStorage(v))}`;
    case 'weight_kg': return `Weight ${up(v + ' kg')}`;
    case 'price_inr': return `Price ${up(fmtInr(v))}`;
    case 'display_size': return `Screen ${up(v + ' inch')}`;
    case 'warranty_years': return `Warranty ${up(v + (v === 1 ? ' year' : ' years'))}`;
    case 'hinge_type': return `Hinge: ${(v as string[]).map((x) => HINGE_LABEL[x]).join(' or ')}`;
    case 'colour': return `Colour: ${(v as string[]).map((x) => x[0].toUpperCase() + x.slice(1)).join(' or ')}`;
    case 'battery_wh': return `Battery ${up(v + ' Wh')}`;
    case 'refresh_hz': return `Refresh rate ${up(v + ' Hz')}`;
    case 'brand': return `${o === 'not_in' ? 'Not' : 'Brand:'} ${(v as string[]).map(cap).join(' or ')}`;
    case 'os_family': return `${o === 'not_in' ? 'Not' : 'Operating system:'} ${(v as string[]).map((x) => (x === 'macos' ? 'macOS' : 'Windows')).join(' or ')}`;
    case 'cpu_vendor': return `${o === 'not_in' ? 'Not' : 'Processor:'} ${(v as string[]).map((x) => (x === 'amd' ? 'AMD' : cap(x))).join(' or ')}`;
    case 'gpu_class': return `Graphics: ${(v as string[]).map((x) => (x === 'dedicated' ? 'separate graphics card' : 'built-in graphics')).join(' or ')}`;
    case 'cpu_contains': return `Processor: ${(v as string[]).join(' or ')}`;
  }
  return `${a} ${o} ${v}`;
}

export function normCriterion(c: RawCriterion): Criterion {
  const base = { source_text: c.source_text ?? '', raw: c };
  const attribute = normAttr(c.attribute);
  if (!attribute) return { ...base, supported: false, attribute: null, operator: '=', value: null, label: `${c.attribute} ${[].concat(c.value as any).join(', ')}`.trim() };
  const { kind, def } = KIND[attribute];
  let operator: Op = OPS[String(c.operator ?? '').toLowerCase().trim()] ?? def;
  const vals = Array.isArray(c.value) ? c.value : [c.value];
  let value: number | string[] | null;
  if (kind === 'num') { value = vals.map((v) => numberOf(attribute, v)).filter((n): n is number => n != null)[0] ?? null; if (operator === 'in' || operator === 'not_in') operator = def === 'in' ? '=' : def; }
  else if (kind === 'enum') { value = [...new Set(vals.map(hingeOf).filter((x): x is string => !!x))]; operator = 'in'; }
  else if (kind === 'text') { value = [...new Set(vals.map((v) => textValue(attribute, v)).filter((x): x is string => !!x))]; if (operator !== 'not_in') operator = 'in'; }
  else if (kind === 'cpu') { value = [...new Set(vals.map((v) => String(v).toLowerCase().trim()).filter(Boolean))]; operator = 'in'; }
  else { value = [...new Set(vals.map((v) => String(v).toLowerCase().trim()).filter(Boolean))]; operator = 'in'; }
  if (value == null || (Array.isArray(value) && !value.length)) return { ...base, supported: false, attribute: null, operator: '=', value: null, label: `${c.attribute} ${vals.join(', ')}` };
  const crit: Criterion = { ...base, supported: true, attribute, operator, value, label: '' };
  crit.label = describe(crit);
  return crit;
}

/** true or false from stored values; null when the catalog does not know the value (shown as "Unknown"). */
export function evalCriterion(c: Criterion, row: Row): boolean | null {
  if (!c.supported || !c.attribute) return null;
  if (c.attribute === 'cpu_contains') return row.cpu_text ? (c.value as string[]).some((t) => row.cpu_text!.toLowerCase().includes(t)) : null;
  if (KIND[c.attribute].kind === 'text') { const x = String((row as any)[c.attribute] ?? '').toLowerCase(); if (!x) return null; const hit = (c.value as string[]).includes(x); return c.operator === 'not_in' ? !hit : hit; }
  if (c.attribute === 'colour') return (row.colours ?? []).length ? (row.colours ?? []).some((x) => (c.value as string[]).includes(x.toLowerCase())) : null;
  if (c.attribute === 'hinge_type') return row.hinge_type ? (c.value as string[]).includes(row.hinge_type) : null;
  const x = (row as any)[c.attribute] as number | null;
  if (x == null) return null;
  const v = c.value as number;
  switch (c.operator) { case '>=': return x >= v; case '<=': return x <= v; case '>': return x > v; case '<': return x < v; default: return x === v; }
}
export function actualText(c: Criterion, row: Row): string {
  if (!c.attribute) return '';
  switch (c.attribute) {
    case 'ram_gb': return row.ram_gb == null ? 'not in catalog' : `${row.ram_gb} GB`;
    case 'storage_gb': return row.storage_gb == null ? 'not in catalog' : fmtStorage(row.storage_gb);
    case 'weight_kg': return row.weight_kg == null ? 'not in catalog' : `${row.weight_kg} kg`;
    case 'price_inr': return row.price_inr == null ? 'not in catalog' : fmtInr(row.price_inr);
    case 'display_size': return row.display_size == null ? 'not in catalog' : `${row.display_size} inch`;
    case 'warranty_years': return row.warranty_years == null ? 'not in catalog' : `${row.warranty_years} year${row.warranty_years === 1 ? '' : 's'}`;
    case 'hinge_type': return row.hinge_type ? HINGE_LABEL[row.hinge_type] : 'not in catalog';
    case 'colour': return (row.colours ?? []).join(', ') || 'not in catalog';
    case 'battery_wh': return row.battery_wh == null ? 'not in catalog' : `${row.battery_wh} Wh`;
    case 'refresh_hz': return row.refresh_hz == null ? 'not in catalog' : `${row.refresh_hz} Hz`;
    case 'brand': return row.brand; case 'os_family': return row.os_family === 'macos' ? 'macOS' : 'Windows';
    case 'cpu_vendor': return row.cpu_vendor ?? 'not in catalog'; case 'gpu_class': return row.gpu_class ?? 'not in catalog';
    case 'cpu_contains': return row.cpu_text ?? 'not in catalog';
  }
  return '';
}

export interface CriteriaSet { musts: Criterion[]; shoulds: Criterion[]; nices: Criterion[] }
export function criteriaFromNeeds(needs: Needs): CriteriaSet {
  const musts = (needs.musts ?? []).map(normCriterion);
  if (needs.budget_max_inr) { const c = normCriterion({ attribute: 'price_inr', operator: '<=', value: needs.budget_max_inr, source_text: 'budget' }); c.label = `Within your budget of ${fmtInr(needs.budget_max_inr)}`; c.implicit = true; musts.unshift(c); }
  if (needs.budget_min_inr) { const c = normCriterion({ attribute: 'price_inr', operator: '>=', value: needs.budget_min_inr, source_text: 'budget' }); c.label = `Price ${fmtInr(needs.budget_min_inr)} or more`; c.implicit = true; musts.push(c); }
  return { musts, shoulds: (needs.shoulds ?? []).map(normCriterion), nices: (needs.nices ?? []).map(normCriterion) };
}

/** Arguments for the find_variants tool: explicit Musts become criteria; the budget goes in its own fields. */
export function toFilterArgs(needs: Needs, crit: Criterion[], extra: Record<string, unknown> = {}) {
  return {
    criteria: crit.filter((c) => c.supported && !c.implicit && KIND[c.attribute as string].sql).map((c) => ({ attribute: c.attribute, operator: c.operator, value: c.value })),
    budget_max: crit.some((c) => c.implicit && c.operator === '<=') ? needs.budget_max_inr : null,
    budget_min: crit.some((c) => c.implicit && c.operator === '>=') ? needs.budget_min_inr : null, ...extra,
  };
}

/** Vague words become visible, editable Should items (F01.18). Never a Must. */
export function applyVagueTerms(text: string, needs: Needs, lightKg: number): { needs: Needs; added: string[] } {
  const n: Needs = JSON.parse(JSON.stringify(needs)); const added: string[] = [];
  const has = (attr: string) => [...n.musts, ...n.shoulds, ...n.nices].some((c) => normAttr(c.attribute) === attr);
  if (/\b(light|lightweight|light-weight|halka|portable)\b/i.test(text) && !has('weight_kg')) {
    n.shoulds.push({ attribute: 'weight_kg', operator: '<=', value: lightKg, source_text: (text.match(/\b(light|lightweight|light-weight|halka|portable)\b/i) as RegExpMatchArray)[0] });
    added.push(`"light" read as weight up to ${lightKg} kg (a Should you can change)`);
  }
  return { needs: n, added };
}

export function publicNeeds(needs: Needs) {
  const strip = (l: RawCriterion[]) => (l ?? []).map((c) => { const n = normCriterion(c); return { attribute: c.attribute, operator: c.operator, value: c.value, source_text: c.source_text ?? '', label: n.label, supported: n.supported }; });
  return { budget_max_inr: needs.budget_max_inr ?? null, budget_min_inr: needs.budget_min_inr ?? null, musts: strip(needs.musts), shoulds: strip(needs.shoulds), nices: strip(needs.nices), use_cases: needs.use_cases ?? [] };
}
