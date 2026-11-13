// F03 Used laptop check. Compares a listing with the catalog and applies fixed rules. No verdict is ever given.
import { fmtInr, fmtDate } from '../util.ts';
import { resolveVariant } from './pitch.ts';
import type { Deps, Row, Block } from '../types.ts';
import type { Listing, Mention } from '../router.ts';

export interface Finding { severity: 'warn' | 'info' | 'ok'; text: string }

/** Windows 11 needs Intel 8th gen or newer, or AMD Ryzen 2000 or newer. Anything else is "unknown", never a guess. */
export function win11Rule(cpu: string | null | undefined): 'supported' | 'unsupported' | 'unknown' {
  if (!cpu) return 'unknown';
  let m = cpu.match(/ryzen\s*[3579]\s*(\d)\d{3}/i);
  if (m) return Number(m[1]) >= 2 ? 'supported' : 'unsupported';
  m = cpu.match(/core\s*(?:i[3579]|ultra)[- ]?(\d{1,2})\d{3}/i) ?? cpu.match(/(\d{1,2})(?:th|st|nd|rd)\s*gen/i);
  if (m) return Number(m[1]) >= 8 ? 'supported' : 'unsupported';
  return 'unknown';
}

export async function usedCheck(deps: Deps, listing: Listing | null, mention: Mention | undefined): Promise<{ blocks: Block[] }> {
  const { tools, settings } = deps; const blocks: Block[] = []; const findings: Finding[] = [];
  const l = listing ?? {};
  const m: Mention = mention ?? { brand: l.brand, line: l.line, ram_gb: l.ram_gb, storage_gb: l.storage_gb, price_inr: l.price_inr };
  let row: Row | null = null;
  if (m.brand || m.line) {
    const res = await resolveVariant(deps, m);
    if (res.kind === 'one') row = (await tools.call<{ specs: Row }>('get_variant', { variant_id: res.variantId })).specs;
    else if (res.kind === 'ask') blocks.push(...res.blocks);
  }
  if (row) {
    blocks.push({ type: 'text', text: `Compared with the catalog listing for ${row.display_name} (new-laptop specs, not this exact unit).` });
    const cmp = (label: string, stated: number | null | undefined, cat: number | null, unit: string) => {
      if (stated == null) return; if (cat == null) { findings.push({ severity: 'info', text: `${label}: the catalog has no value to compare with.` }); return; }
      findings.push(stated === cat ? { severity: 'ok', text: `${label} matches the catalog (${cat} ${unit}).` } : { severity: 'warn', text: `${label} in the listing is ${stated} ${unit}, but the catalog lists ${cat} ${unit}. Ask the seller to show it in the system settings.` });
    };
    cmp('RAM', l.ram_gb, row.ram_gb, 'GB'); cmp('Storage', l.storage_gb, row.storage_gb, 'GB'); cmp('Weight', l.weight_kg, row.weight_kg, 'kg');
    const w = win11Rule(row.cpu_text);
    if (/windows\s*11/i.test(l.os ?? '') ) findings.push(w === 'unsupported' ? { severity: 'warn', text: 'The listing says Windows 11, but this processor is older than Windows 11 supports. Ask how it was installed.' } : { severity: 'ok', text: 'Windows 11 is plausible for this processor.' });
    if (row.price_inr != null) {
      const band = settings.USED_PRICE_BAND ?? { low: 0.3, high: 0.75 };
      if (l.price_inr != null) {
        const lo = Math.round(row.price_inr * band.low), hi = Math.round(row.price_inr * band.high);
        findings.push({ severity: l.price_inr < lo || l.price_inr > hi ? 'warn' : 'info', text: `Asking ${fmtInr(l.price_inr)}. New price is ${fmtInr(row.price_inr)} (as of ${fmtDate(row.price_as_of)}). A used laptop often sells for ${fmtInr(lo)} to ${fmtInr(hi)}. This is a sample range, not a price check.` });
      }
    }
  } else if (!blocks.length) blocks.push({ type: 'text', text: 'I could not match this laptop to the catalog, so I cannot compare specs or price. The checklist below still applies.' });
  const bset = settings.BATTERY ?? {}; const bmin = { ok: Number(bset.note_below ?? 80), warn: Number(bset.check_below ?? 70) };
  if (l.battery_health_pct != null) findings.push(l.battery_health_pct < bmin.warn ? { severity: 'warn', text: `Battery health is ${l.battery_health_pct}%. Below ${bmin.warn}% usually means a replacement soon.` } : l.battery_health_pct < bmin.ok ? { severity: 'info', text: `Battery health is ${l.battery_health_pct}%. Below ${bmin.ok}% it is wearing out.` } : { severity: 'ok', text: `Battery health is ${l.battery_health_pct}%.` });
  else findings.push({ severity: 'info', text: 'No battery health stated. Ask for a screenshot of the battery report.' });
  if (l.has_serial === false) findings.push({ severity: 'warn', text: 'No serial number given. Without it you cannot check warranty or whether the laptop is reported lost.' });
  if (l.has_bill === false) findings.push({ severity: 'warn', text: 'No bill or invoice. Warranty claims and proof of ownership become hard.' });
  if (l.seller_warranty_months === 0) findings.push({ severity: 'info', text: 'The seller offers no warranty.' });
  if (l.reason && /fault|issue|problem|broken|heating|hang|slow|dead|crack/i.test(l.reason)) findings.push({ severity: 'warn', text: `The reason for selling mentions a problem ("${l.reason}"). Ask exactly what is wrong before paying.` });
  blocks.push({ type: 'findings', findings, note: 'These are checks, not a verdict. I do not say whether to buy.' });
  blocks.push({ type: 'checklist', title: 'Check in person before paying', items: ['Meet in a public place and test the laptop before paying.', 'Check the serial number on the body matches the bill.', 'Look at the battery report, hinge, keyboard, ports and screen.', 'Sign out of all accounts and reset the laptop in front of you.', 'Pay only after the checks, and keep a written receipt.'] });
  return { blocks };
}
