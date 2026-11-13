// F09 Sell plan. SAMPLE factors (settings.RESALE), a range that widens with unknowns, and per-fix net arithmetic in code.
import { resolveVariant } from './pitch.ts';
import { fmtInr, fmtDate } from '../util.ts';
import type { Deps, Row, Block } from '../types.ts';
import type { Mention, Listing } from '../router.ts';

export const DEFAULT_RESALE = {
  age: { '0': 0.85, '1': 0.72, '2': 0.6, '3': 0.5, '4': 0.42, '5': 0.35, '6': 0.28 } as Record<string, number>,
  condition: { excellent: 1, good: 0.92, fair: 0.8, poor: 0.6 } as Record<string, number>,
  battery: { below_80: 0.93, below_70: 0.88 }, cracked_screen: 0.75, spread_known: 0.12, spread_unknown: 0.22,
  fix_cost: { battery: 3500 } as Record<string, number>,
};
export const ageFactor = (a: Record<string, number>, years: number) => a[String(Math.min(6, Math.max(0, Math.round(years))))] ?? 0.25;
const round = (n: number) => Math.round(n / 500) * 500;

export interface SellInput { age_years?: number | null; condition?: string | null; battery_health_pct?: number | null; cracked_screen?: boolean | null; has_bill?: boolean | null; has_box?: boolean | null; urgent?: boolean }
export function resale(newPrice: number, i: SellInput, cfg = DEFAULT_RESALE) {
  const unknown: string[] = []; const factors: { label: string; factor: number }[] = [];
  let f = 1;
  if (i.age_years == null) unknown.push('age'); else { const a = ageFactor(cfg.age, i.age_years); f *= a; factors.push({ label: `Age ${i.age_years} year${i.age_years === 1 ? '' : 's'}`, factor: a }); }
  if (!i.condition) unknown.push('condition'); else { const c = cfg.condition[i.condition] ?? 0.92; f *= c; factors.push({ label: `Condition: ${i.condition}`, factor: c }); }
  if (i.battery_health_pct == null) unknown.push('battery health'); else if (i.battery_health_pct < 70) { f *= cfg.battery.below_70; factors.push({ label: `Battery ${i.battery_health_pct}% (below 70)`, factor: cfg.battery.below_70 }); } else if (i.battery_health_pct < 80) { f *= cfg.battery.below_80; factors.push({ label: `Battery ${i.battery_health_pct}% (below 80)`, factor: cfg.battery.below_80 }); }
  if (i.cracked_screen) { f *= cfg.cracked_screen; factors.push({ label: 'Cracked screen', factor: cfg.cracked_screen }); }
  const mid = newPrice * f; const spread = unknown.length ? cfg.spread_unknown : cfg.spread_known;
  return { low: round(mid * (1 - spread)), high: round(mid * (1 + spread)), mid: round(mid), factors, unknown };
}

export async function sellPlan(deps: Deps, mention: Mention | undefined, l: Listing | null, text: string, forced?: { variantId: string; input: SellInput }): Promise<{ blocks: Block[] }> {
  const blocks: Block[] = []; const cfg = { ...DEFAULT_RESALE, ...(deps.settings.RESALE ?? {}) };
  const tips = ['Remove your accounts and reset the laptop before the buyer sees it.', 'Meet in a public place and let the buyer test it before they pay.', 'Say honestly about any fault: it protects you from a dispute later.', 'Keep the bill and box: they raise the price buyers will pay.'];
  const m: Mention | undefined = mention ?? (l && (l.brand || l.line) ? { brand: l.brand, line: l.line } : undefined);
  if (!m && !forced) { blocks.push({ type: 'text', text: 'Which laptop are you selling? Type its name, how old it is, and its condition.' }); return { blocks }; }
  const res = forced ? ({ kind: 'one', variantId: forced.variantId } as const) : await resolveVariant(deps, m!);
  if (res.kind !== 'one') { blocks.push(...(res.kind === 'not_found' ? [{ type: 'text', text: 'This laptop is not in the catalog, so I will not give figures. General tips below.' }] : res.blocks)); blocks.push({ type: 'checklist', title: 'Before you sell', items: tips }); return { blocks }; }
  const got = await deps.tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: res.variantId });
  if (!got.found) { blocks.push({ type: 'text', text: 'That laptop is not in the catalog.' }); return { blocks }; }
  const row = got.specs;
  if (row.price_inr == null) { blocks.push({ type: 'text', text: `No new price on file for ${row.display_name}, so I cannot estimate. General tips below.` }, { type: 'checklist', title: 'Before you sell', items: tips }); return { blocks }; }
  const age = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*old|bought\s+(\d+(?:\.\d+)?)\s*years?\s*(?:ago|back)/i);
  const input: SellInput = forced ? forced.input : { age_years: l?.age_years ?? (age ? Number(age[1] || age[2]) : null), condition: /excellent|like new|mint/i.test(text) ? 'excellent' : /scratch|dent|worn|fair/i.test(text) ? 'fair' : /poor|bad shape|damaged/i.test(text) ? 'poor' : /good/i.test(text) ? 'good' : null,
    battery_health_pct: l?.battery_health_pct ?? null, cracked_screen: /crack/i.test(text) ? true : null, urgent: /urgent|need money|fast|quickly/i.test(text) };
  const base = resale(row.price_inr, input, cfg);
  const fixes: any[] = [];
  if (input.battery_health_pct != null && input.battery_health_pct < 80) {
    const after = resale(row.price_inr, { ...input, battery_health_pct: 100 }, cfg); const cost = cfg.fix_cost.battery; const gain = after.mid - base.mid;
    fixes.push({ fix: 'Replace the battery', cost, adds: gain, net: gain - cost, worth_it: gain - cost > 0, cost_basis: 'Sample estimate, not a quote' });
  }
  blocks.push({ type: 'sell_plan', laptop: row.display_name, new_price: row.price_inr, new_price_text: fmtInr(row.price_inr), as_of: fmtDate(row.price_as_of),
    range: { low: base.low, high: base.high, low_text: fmtInr(base.low), high_text: fmtInr(base.high) }, factors: base.factors, unknown: base.unknown, fixes,
    list_at: input.urgent ? base.low : base.high, list_at_text: fmtInr(input.urgent ? base.low : base.high),
    disclaimers: ['An estimate, not a promise.', 'The factors are sample assumptions, not learned from real sales. No real used-price data is connected yet.', base.unknown.length ? `The range is wider because I do not know: ${base.unknown.join(', ')}.` : ''].filter(Boolean) });
  blocks.push({ type: 'checklist', title: 'Before you sell', items: tips });
  return { blocks };
}
