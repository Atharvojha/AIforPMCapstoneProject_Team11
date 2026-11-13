// F08 My laptops. Pure date and price arithmetic. The list lives on the user's device; the server only computes and stores nothing.
import { resolveVariant } from './pitch.ts';
import { resale, resaleCfg } from './sell.ts';
import { launchYearOf, checkPurchaseDate } from '../launch.ts';
import { fmtInr, fmtDate } from '../util.ts';
import type { Deps, Row, Block } from '../types.ts';

export interface Owned { name?: string; variant_id?: string; purchase_date?: string; price_paid?: number | null }
const DAY = 86400000;
/** Same calendar date N years later; 29 Feb becomes 28 Feb in a non-leap year. Dates are UTC days. */
export function addYears(iso: string, years: number): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null;
  const y = Number(m[1]) + years, mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d)); if (isNaN(+dt) || dt.getUTCMonth() !== mo - 1) { return new Date(Date.UTC(y, mo - 1, 28)).toISOString().slice(0, 10); }
  return dt.toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);

export async function myLaptops(deps: Deps, owned: Owned[], today: string): Promise<{ blocks: Block[] }> {
  const items: any[] = [];
  for (const o of (owned ?? []).slice(0, 10)) {
    const base: any = { input: o.name ?? o.variant_id ?? '' };
    let row: Row | null = null;
    if (o.variant_id) { const v = await deps.tools.call<any>('get_variant', { variant_id: o.variant_id }); if (v.found) row = v.specs; }
    else if (o.name) { const r = await resolveVariant(deps, { brand: '', line: o.name }); if (r.kind === 'one') row = (await deps.tools.call<any>('get_variant', { variant_id: r.variantId })).specs; }
    if (!row) { items.push({ ...base, found: false, note: 'No longer in the catalog, or not found. Your saved facts are kept.' }); continue; }
    const launch = launchYearOf(row.display_name, row.cpu_text); const chk = o.purchase_date && /^\d{4}-\d{2}-\d{2}$/.test(o.purchase_date) ? checkPurchaseDate(o.purchase_date, launch, today) : null;
    const it: any = { ...base, found: true, name: row.display_name, variant_id: row.variant_id, launch_year: launch };
    if (chk && !chk.ok) { it.date_check = { ok: false, kind: chk.kind, reason: chk.reason }; it.date_error = chk.reason; it.warranty = { status: 'invalid', note: chk.reason }; }
    else if (!o.purchase_date || !/^\d{4}-\d{2}-\d{2}$/.test(o.purchase_date)) it.warranty = { status: 'unknown', note: 'Add the purchase date (YYYY-MM-DD) to see the warranty end.' };
    else if (row.warranty_years == null) it.warranty = { status: 'unknown', note: 'The catalog has no warranty period for this laptop. Check your invoice.' };
    else { const end = addYears(o.purchase_date, row.warranty_years); const left = daysBetween(today, end!); it.warranty = { status: left >= 0 ? 'active' : 'expired', ends: end, ends_text: fmtDate(end), days_left: left, rule: `Warranty of ${row.warranty_years} year${row.warranty_years === 1 ? '' : 's'} counted from the purchase date. Standard period from the catalog; keep your invoice.` }; }
    if (row.price_inr != null) { it.price_now = row.price_inr; it.price_now_text = fmtInr(row.price_inr); it.as_of = fmtDate(row.price_as_of);
      if (o.price_paid != null) { it.price_paid = o.price_paid; it.gap = row.price_inr - o.price_paid; it.gap_text = it.gap === 0 ? 'Same as what you paid.' : it.gap < 0 ? `${fmtInr(-it.gap)} lower than what you paid.` : `${fmtInr(it.gap)} higher than what you paid.`; }
      if (o.purchase_date && chk?.ok) { const yrs = (Date.parse(today) - Date.parse(o.purchase_date)) / (365.25 * DAY); const r = resale(row.price_inr, { age_years: Math.round(yrs * 10) / 10 }, resaleCfg(deps.settings.RESALE)); it.resale = { low: r.low, high: r.high, low_text: fmtInr(r.low), high_text: fmtInr(r.high), note: 'Sample estimate, not a promise.' }; } }
    items.push(it);
  }
  if (!items.length) return { blocks: [{ type: 'text', text: 'Add a laptop (name and purchase date) to see its warranty and price now.' }] };
  return { blocks: [{ type: 'my_laptops', today, items, note: 'Your list is not stored on the server.' }] };
}
