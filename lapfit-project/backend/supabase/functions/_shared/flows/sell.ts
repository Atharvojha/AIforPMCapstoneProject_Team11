// F09 Sell plan. SAMPLE factors (settings.RESALE, defaults here), a range that widens with unknowns, and per-fix net arithmetic in code.
// Works for any laptop: a catalog laptop with a rupee price, a catalog laptop without one (US listings) when the person says what they paid,
// or a laptop that is not in the catalog (custom_name) with paid_inr. A price is never invented.
import { resolveVariant } from './pitch.ts';
import { fmtInr, fmtDate, scrub } from '../util.ts';
import { launchYearOf, maxAgeYears } from '../launch.ts';
import { sellBoosters } from './sellboost.ts';
import type { Deps, Row, Block } from '../types.ts';
import type { Mention, Listing } from '../router.ts';

export const FLAG_KEYS = ['cracked_screen', 'dead_pixels', 'keys_missing', 'hinge_loose', 'battery_replaced', 'battery_swollen', 'water_damage', 'scratches_dents', 'no_charger', 'has_box', 'has_bill', 'warranty_left', 'ssd_upgraded', 'ram_upgraded', 'repaired', 'need_fast'] as const;
export type FlagKey = typeof FLAG_KEYS[number];
export interface FlagCfg { label: string; factor: number; note?: string; safety?: string; spread_add?: number }
/** SAMPLE assumptions, not learned from real sales. Each can be overridden in settings.RESALE.flags. factor < 1 lowers the price, > 1 raises it. */
export const DEFAULT_FLAGS: Record<FlagKey, FlagCfg> = {
  cracked_screen: { label: 'Cracked screen', factor: 0.75 },
  dead_pixels: { label: 'Dead pixels on the screen', factor: 0.9 },
  keys_missing: { label: 'Missing or broken keys', factor: 0.95 },
  hinge_loose: { label: 'Loose or cracked hinge', factor: 0.9 },
  battery_replaced: { label: 'Battery replaced (new battery)', factor: 1.04, note: 'Positive: a fresh battery is worth a little more to a buyer.' },
  battery_swollen: { label: 'Swollen battery', factor: 0.7, safety: 'A swollen battery can leak or catch fire. Stop using and charging this laptop now, and have the battery replaced by a service centre. Tell any buyer about it honestly.' },
  water_damage: { label: 'Water or liquid damage', factor: 0.65, note: 'Liquid damage can fail later, so buyers pay much less.' },
  scratches_dents: { label: 'Scratches or dents on the body', factor: 0.95 },
  no_charger: { label: 'Original charger missing', factor: 0.93 },
  has_box: { label: 'Original box available', factor: 1.02, note: 'Positive.' },
  has_bill: { label: 'Original bill available', factor: 1.03, note: 'Positive: proves the purchase date and ownership.' },
  warranty_left: { label: 'Warranty still left', factor: 1.05, note: 'Positive: show the warranty date to the buyer.' },
  ssd_upgraded: { label: 'SSD upgraded', factor: 1.02, note: 'Small positive.' },
  ram_upgraded: { label: 'RAM upgraded', factor: 1.02, note: 'Small positive.' },
  repaired: { label: 'Repaired before (board or part)', factor: 0.95, note: 'Buyers worry about repeat faults, so a past repair lowers the price a little.' },
  need_fast: { label: 'You need to sell fast', factor: 0.92, spread_add: 0.06, note: 'A quick sale means a lower, wider range.' },
};
export const DEFAULT_RESALE = {
  age: { '0': 0.85, '1': 0.72, '2': 0.6, '3': 0.5, '4': 0.42, '5': 0.35, '6': 0.28 } as Record<string, number>,
  condition: { excellent: 1, good: 0.92, fair: 0.8, poor: 0.6 } as Record<string, number>,
  battery: { below_80: 0.93, below_70: 0.88 }, cracked_screen: 0.75, spread_known: 0.12, spread_unknown: 0.22,
  fix_cost: { battery: 3500 } as Record<string, number>,
  flags: DEFAULT_FLAGS as Record<string, FlagCfg>,
};
export type ResaleCfg = typeof DEFAULT_RESALE;
/** Defaults in code, overridden by settings.RESALE; flags are merged key by key so one override does not drop the others. */
export function resaleCfg(s: any): ResaleCfg {
  const o = s ?? {}; const flags: Record<string, FlagCfg> = {};
  for (const k of FLAG_KEYS) flags[k] = { ...DEFAULT_FLAGS[k], ...(o.flags?.[k] ?? {}) };
  if (typeof o.cracked_screen === 'number' && !o.flags?.cracked_screen?.factor) flags.cracked_screen.factor = o.cracked_screen;
  return { ...DEFAULT_RESALE, ...o, age: { ...DEFAULT_RESALE.age, ...(o.age ?? {}) }, condition: { ...DEFAULT_RESALE.condition, ...(o.condition ?? {}) }, battery: { ...DEFAULT_RESALE.battery, ...(o.battery ?? {}) }, fix_cost: { ...DEFAULT_RESALE.fix_cost, ...(o.fix_cost ?? {}) }, flags };
}
export const ageFactor = (a: Record<string, number>, years: number) => a[String(Math.min(6, Math.max(0, Math.round(years))))] ?? 0.25;
const round = (n: number) => Math.round(n / 500) * 500;

export interface SellInput { age_years?: number | null; condition?: string | null; battery_health_pct?: number | null; cracked_screen?: boolean | null; has_bill?: boolean | null; has_box?: boolean | null; urgent?: boolean; flags?: string[]; notes?: string | null; extra_unknown?: string[] }
export const flagsOf = (i: SellInput): Set<FlagKey> => {
  const s = new Set<FlagKey>((i.flags ?? []).filter((k): k is FlagKey => (FLAG_KEYS as readonly string[]).includes(k)));
  if (i.cracked_screen) s.add('cracked_screen'); if (i.has_bill) s.add('has_bill'); if (i.has_box) s.add('has_box'); if (i.urgent) s.add('need_fast');
  return s;
};
export function resale(newPrice: number, i: SellInput, cfg: ResaleCfg = DEFAULT_RESALE) {
  const unknown: string[] = [...(i.extra_unknown ?? [])]; const factors: { label: string; factor: number; note?: string; flag?: string }[] = [];
  const fl = flagsOf(i); let f = 1; let spreadAdd = 0;
  if (i.age_years == null) unknown.push('age'); else { const a = ageFactor(cfg.age, i.age_years); f *= a; factors.push({ label: `Age ${i.age_years} year${i.age_years === 1 ? '' : 's'}`, factor: a }); }
  if (!i.condition) unknown.push('condition'); else { const c = cfg.condition[i.condition] ?? 0.92; f *= c; factors.push({ label: `Condition: ${i.condition}`, factor: c }); }
  const newBattery = fl.has('battery_replaced');
  if (i.battery_health_pct == null) { if (!newBattery && !fl.has('battery_swollen')) unknown.push('battery health'); }
  else if (newBattery) { /* a new battery: the old health reading no longer applies */ }
  else if (i.battery_health_pct < 70) { f *= cfg.battery.below_70; factors.push({ label: `Battery ${i.battery_health_pct}% (below 70)`, factor: cfg.battery.below_70 }); }
  else if (i.battery_health_pct < 80) { f *= cfg.battery.below_80; factors.push({ label: `Battery ${i.battery_health_pct}% (below 80)`, factor: cfg.battery.below_80 }); }
  for (const k of FLAG_KEYS) if (fl.has(k)) { const c = cfg.flags[k]; f *= c.factor; spreadAdd += c.spread_add ?? 0; factors.push({ label: c.label, factor: c.factor, note: c.note, flag: k }); }
  const mid = newPrice * f; const spread = (unknown.length ? cfg.spread_unknown : cfg.spread_known) + spreadAdd;
  return { low: round(mid * (1 - spread)), high: round(mid * (1 + spread)), mid: round(mid), factors, unknown, spread };
}

const clampNum = (v: unknown, lo: number, hi: number): number | null => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
/** Reads the sell fields of a request (flat per the contract, or nested under `sell`), validating everything in code. */
export function sellInputOf(body: any): { input: SellInput; customName: string | null; paidInr: number | null } {
  const s = { ...(body?.sell ?? {}), ...(body ?? {}) } as any; const flags = Array.isArray(s.flags) ? [...new Set(s.flags.filter((k: unknown) => typeof k === 'string' && (FLAG_KEYS as readonly string[]).includes(k)))] as string[] : [];
  const cond = ['excellent', 'good', 'fair', 'poor'].includes(s.condition) ? s.condition : null;
  const notes = typeof s.notes === 'string' ? scrub(s.notes.replace(/[\u0000-\u001f]+/g, ' ')).trim().slice(0, 300) : '';
  const name = typeof s.custom_name === 'string' ? scrub(s.custom_name.replace(/[\u0000-\u001f]+/g, ' ')).trim().slice(0, 80) : '';
  const paid = clampNum(s.paid_inr, 1000, 1_000_000);
  return { input: { age_years: clampNum(s.age_years, 0, 30), condition: cond, battery_health_pct: clampNum(s.battery_health_pct, 0, 100), flags, notes: notes || null, cracked_screen: flags.includes('cracked_screen') ? true : null, urgent: flags.includes('need_fast') }, customName: name || null, paidInr: paid == null ? null : Math.round(paid) };
}

const TIPS = ['Back up your files, sign out of every account on it and do a full reset before the buyer sees it.', 'Meet in a public place and let the buyer test it before they pay.', 'Say honestly about any fault: it protects you from a dispute later.', 'Keep the bill and box: they raise the price buyers will pay.'];
const today = (deps: Deps) => (deps.now?.() ?? new Date()).toISOString().slice(0, 10);

export interface SellForced { variantId?: string; customName?: string | null; paidInr?: number | null; input: SellInput }
export async function sellPlan(deps: Deps, mention: Mention | undefined, l: Listing | null, text: string, forced?: SellForced): Promise<{ blocks: Block[] }> {
  const blocks: Block[] = []; const cfg = resaleCfg(deps.settings.RESALE); const tips = TIPS;
  const m: Mention | undefined = mention ?? (l && (l.brand || l.line) ? { brand: l.brand, line: l.line } : undefined);
  if (!m && !forced) { blocks.push({ type: 'text', text: 'Which laptop are you selling? Type its name, how old it is, and its condition.' }); return { blocks }; }
  let row: Row | null = null; let name = ''; let custom = false;
  if (forced?.customName && !forced.variantId) { custom = true; name = forced.customName; }
  else {
    const res = forced?.variantId ? ({ kind: 'one', variantId: forced.variantId } as const) : await resolveVariant(deps, m!);
    if (res.kind !== 'one') { blocks.push(...(res.kind === 'not_found' ? [{ type: 'text', text: 'This laptop is not in the catalog, so I will not give figures. General tips below.' }] : res.blocks)); blocks.push({ type: 'checklist', title: 'Before you sell', items: tips }); return { blocks }; }
    const got = await deps.tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: res.variantId });
    if (!got.found) { blocks.push({ type: 'text', text: 'That laptop is not in the catalog.' }); return { blocks }; }
    row = got.specs; name = row.display_name;
  }
  const age = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*old|bought\s+(\d+(?:\.\d+)?)\s*years?\s*(?:ago|back)/i);
  const input: SellInput = forced ? { ...forced.input } : { age_years: l?.age_years ?? (age ? Number(age[1] || age[2]) : null), condition: /excellent|like new|mint/i.test(text) ? 'excellent' : /scratch|dent|worn|fair/i.test(text) ? 'fair' : /poor|bad shape|damaged/i.test(text) ? 'poor' : /good/i.test(text) ? 'good' : null,
    battery_health_pct: l?.battery_health_pct ?? null, cracked_screen: /crack/i.test(text) ? true : null, urgent: /urgent|need money|fast|quickly/i.test(text) };
  const td = today(deps);
  // date sense: a laptop cannot be older than its launch. When unsure, widen and say so instead of rejecting.
  const launch = custom ? launchYearOf(name, null) : launchYearOf(row!.display_name, row!.cpu_text);
  const maxAge = maxAgeYears(launch, td); const dateNotes: string[] = [];
  if (input.age_years != null && maxAge != null && input.age_years > maxAge) {
    dateNotes.push(`This model launched in ${launch}, so it cannot be ${input.age_years} years old (at most about ${maxAge}). I used ${maxAge} and widened the range.`);
    input.age_years = maxAge; input.extra_unknown = ['age'];
  }
  // price basis: the catalog rupee price when there is one, else what the person paid. Never invented.
  const paid = forced?.paidInr ?? null; let price: number | null = null; let basis: 'catalog' | 'paid' | null = null;
  if (row?.price_inr != null) { price = row.price_inr; basis = 'catalog'; } else if (paid != null) { price = paid; basis = 'paid'; }
  const base = { type: 'sell_plan', laptop: name, custom, launch_year: launch, date_notes: dateNotes, notes: input.notes ?? null, notes_echo: input.notes ? `I did not price this: ${input.notes}` : null };
  const flagList = [...flagsOf(input)];
  if (price == null) {
    const checklist = [...tips]; const ev = await sellBoosters(deps, { cfg, price: null, input, row, name, td, base: null, fixes: [] });
    const copy = copyText({ name, td, range: null, price_line: null, factors: [], notes: input.notes ?? null, boosters: ev.boosters, checklist, safety: [] });
    blocks.push({ ...base, needs_paid_price: true, new_price: null, range: null, factors: [], unknown: [], fixes: [], boosters: ev.boosters, checklist, copy_text: copy, safety: [],
      message: row ? `No new price in rupees is on file for ${name} (it may be a listing from outside India), so I cannot estimate. Tell me what you paid and I will use that. I will not guess a price.` : `Tell me what you paid for ${name} and I will estimate from that. I will not guess a price.`,
      disclaimers: ['No price is on file, so there is no estimate yet.'] });
    blocks.push({ type: 'checklist', title: 'Before you sell', items: tips });
    return { blocks };
  }
  const res = resale(price, input, cfg);
  const fixes: any[] = [];
  const swollen = flagList.includes('battery_swollen'); const replaced = flagList.includes('battery_replaced');
  if (((input.battery_health_pct != null && input.battery_health_pct < 80) || swollen) && !replaced) {
    const withoutSwollen = (input.flags ?? []).filter((k) => k !== 'battery_swollen');
    const after = resale(price, { ...input, battery_health_pct: 100, flags: [...withoutSwollen, 'battery_replaced'], cracked_screen: input.cracked_screen, urgent: input.urgent }, cfg); const cost = cfg.fix_cost.battery; const gain = after.mid - res.mid;
    fixes.push({ fix: 'Replace the battery', cost, adds: gain, net: gain - cost, worth_it: gain - cost > 0, cost_basis: 'Sample estimate, not a quote' });
  }
  const listAt = flagList.includes('need_fast') ? res.low : res.high;
  const safety = flagList.map((k) => cfg.flags[k]?.safety).filter(Boolean) as string[];
  const bo = await sellBoosters(deps, { cfg, price, input, row, name, td, base: res, fixes });
  const basisText = basis === 'paid' ? `Based on what you paid (${fmtInr(price)}), as you told me. Not a catalog price.` : `Based on the new price on file: ${fmtInr(price)} as of ${fmtDate(row!.price_as_of)}.`;
  const checklist = [
    ...safety, 'Back up your files, sign out of every account on it and do a full reset before the buyer sees it.', 'Clean the screen, keyboard and body, and take clear photos in daylight.',
    flagList.includes('has_bill') && flagList.includes('has_box') ? 'Keep the original bill and box ready to show.' : 'Find the original bill and box if you still have them: they raise the price buyers will pay.',
    flagList.includes('no_charger') ? 'Tell the buyer the original charger is missing, or buy one and say so.' : 'Include the original charger.',
    ...flagList.filter((k) => ['cracked_screen', 'dead_pixels', 'keys_missing', 'hinge_loose', 'water_damage', 'scratches_dents', 'repaired'].includes(k)).map((k) => `Say honestly about: ${cfg.flags[k].label.toLowerCase()}.`),
    `List at about ${fmtInr(listAt)} and expect offers down to about ${fmtInr(res.low)}.`, 'Meet in a public place and let the buyer test it before they pay.' ];
  const range = { low: res.low, high: res.high, low_text: fmtInr(res.low), high_text: fmtInr(res.high) };
  const disclaimers = ['An estimate, not a promise.', 'The factors are sample assumptions, not learned from real sales. No real used-price data is connected yet.', res.unknown.length ? `The range is wider because I do not know: ${res.unknown.join(', ')}.` : ''].filter(Boolean);
  const copy = copyText({ name, td, range, price_line: basisText, factors: res.factors, notes: input.notes ?? null, boosters: bo.boosters, checklist, safety, listAt, disclaimers: disclaimers.slice(0, 2) });
  blocks.push({ ...base, new_price: price, new_price_text: fmtInr(price), as_of: basis === 'catalog' ? fmtDate(row!.price_as_of) : null, price_basis: basis, price_note: basisText,
    range, factors: res.factors.map((f) => ({ label: f.label, factor: f.factor, note: f.note ?? null, sample: true })), unknown: res.unknown, fixes, safety,
    list_at: listAt, list_at_text: fmtInr(listAt), boosters: bo.boosters, checklist, copy_text: copy, disclaimers });
  blocks.push({ type: 'checklist', title: 'Before you sell', items: tips });
  return { blocks };
}

function copyText(o: { name: string; td: string; range: { low_text: string; high_text: string } | null; price_line: string | null; factors: { label: string; factor: number }[]; notes: string | null; boosters: { title: string; why: string; gain_text?: string; source: string; items?: { url: string }[] }[]; checklist: string[]; safety: string[]; listAt?: number; disclaimers?: string[] }) {
  const L: string[] = [`LapFit sell plan for ${o.name}`, `Date: ${fmtDate(o.td)}`, '(A sample estimate, not a promise. The factors are sample assumptions, not learned from real sales.)'];
  if (o.range) L.push('', `Estimated range: ${o.range.low_text} to ${o.range.high_text}${o.listAt ? `, list at about ${fmtInr(o.listAt)}` : ''}`, o.price_line ?? '');
  else L.push('', 'No estimate yet: I need to know what you paid.');
  if (o.factors.length) L.push('', 'Factors used (sample):', ...o.factors.map((f) => `- ${f.label}: x${f.factor}`));
  if (o.notes) L.push('', `I did not price this: ${o.notes}`);
  if (o.boosters.length) L.push('', 'What else could get you more:', ...o.boosters.map((b) => `- ${b.title}: ${b.why}${b.gain_text ? ` (${b.gain_text})` : ''} [source: ${b.source}${b.source === 'web' ? ', not verified' : ''}]${b.items?.length ? ' ' + b.items.map((i) => i.url).join(' ') : ''}`));
  L.push('', 'Checklist:', ...o.checklist.map((c) => `- ${c}`));
  return L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}
