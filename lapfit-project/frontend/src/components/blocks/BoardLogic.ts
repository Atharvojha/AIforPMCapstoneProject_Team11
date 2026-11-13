// Everything the board says about the laptops is computed here from the card numbers. Nothing is invented: unknown stays unknown.
import type { Pic } from '../LaptopImage';

export interface Card {
  variant_id: string; name: string; brand?: string; price_inr: number | null; price_text: string; as_of: string; as_of_text: string; data_status: string; spec_lines: string[]; specs: any; image?: Pic | null; match?: { pct: number; label: string; basis: string[] };
  musts: { label: string; ok: boolean | null; actual: string }[]; evidence: { n: number; enough: boolean; text: string; positive: number; negative: number; min_n?: number }; reasons: string[]; unknown_fields: string[];
}
export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
/** A price of 0 or a missing price means unknown: show "?", never "₹0". */
export const priceKnown = (c: Card) => typeof c.price_inr === 'number' && c.price_inr > 0;
export const priceShown = (c: Card) => (priceKnown(c) ? c.price_text : '?');
export const storage = (g: number | null | undefined) => (g == null ? '?' : g >= 1024 ? `${g / 1024} TB` : `${g} GB`);
export const brandOf = (c: Card) => c.name.split(' · ')[0];
export const versionOf = (c: Card) => c.name.split(' · ')[1];
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const kg = (n: number) => `${parseFloat(n.toFixed(2))} kg`;

/** Short "how this differs from the best fit" line, from the numbers on the two cards only. */
export function deltaLine(c: Card, hero: Card): string {
  const out: string[] = []; const a = c.specs ?? {}; const h = hero.specs ?? {};
  if (priceKnown(c) && priceKnown(hero)) { const d = (c.price_inr as number) - (hero.price_inr as number); if (d !== 0) out.push(`${inr(Math.abs(d))} ${d < 0 ? 'cheaper' : 'costlier'}`); }
  const w = num(a.weight_kg), hw = num(h.weight_kg); if (w != null && hw != null && Math.abs(w - hw) >= 0.05) out.push(`${kg(Math.abs(w - hw))} ${w < hw ? 'lighter' : 'heavier'}`);
  const r = num(a.ram_gb), hr = num(h.ram_gb); if (r != null && hr != null && r !== hr) out.push(`${Math.abs(r - hr)} GB ${r > hr ? 'more' : 'less'} RAM`);
  const s = num(a.storage_gb), hs = num(h.storage_gb); if (s != null && hs != null && s !== hs) out.push(`${storage(Math.abs(s - hs))} ${s > hs ? 'more' : 'less'} storage`);
  if (out.length) return out.slice(0, 2).join(' · ');
  const known = priceKnown(c) && priceKnown(hero) && w != null && hw != null && r != null && hr != null && s != null && hs != null;
  return known ? 'Same price, weight, RAM and storage as the best fit' : 'Some values are unknown (?), so no difference can be shown';
}

/** A tie only when the top two match on everything that can be measured: price within 2%, same RAM and storage, owner opinions within 3 points (or both too few to count). */
export function isTie(cards: Card[]): boolean {
  if (cards.length < 2) return false; const [a, b] = cards;
  if (!priceKnown(a) || !priceKnown(b)) return false; const pa = a.price_inr as number, pb = b.price_inr as number; if (Math.abs(pa - pb) > 0.02 * Math.max(pa, pb)) return false;
  const sa = a.specs ?? {}, sb = b.specs ?? {}; if (num(sa.ram_gb) == null || sa.ram_gb !== sb.ram_gb || num(sa.storage_gb) == null || sa.storage_gb !== sb.storage_gb) return false;
  const ea = a.evidence, eb = b.evidence; if (ea.enough !== eb.enough) return false;
  if (ea.enough) { const ra = ea.positive / Math.max(1, ea.positive + ea.negative), rb = eb.positive / Math.max(1, eb.positive + eb.negative); if (Math.abs(ra - rb) > 0.03) return false; }
  return true;
}

/** The one line that makes an answer sound like a verdict: the first backend reason that is not just the price again. */
export const verdictOf = (c: Card): string | null => c.reasons.find((r) => !/^Costs /.test(r)) ?? c.reasons[0] ?? null;
export const musts = (c: Card) => c.musts.filter((m) => !m.label.startsWith('Within your budget'));
export const missesMust = (c: Card) => c.musts.some((m) => m.ok === false);

// ---- sort (what the board says about its own order) ----
export interface SortInfo { key: string; label: string; note?: string }
/** The hero label. "Best fit" is claimed only when the order really is best fit; any other order says what it is first by. */
export function heroEyebrow(sort: SortInfo | null | undefined, fit: boolean): string | null {
  if (!sort || sort.key === 'best') return fit ? 'Best fit for what you said' : null;
  return `First by ${sort.label.toLowerCase()}`;
}

// ---- the person's own laptop (custom compare column) ----
export interface CustomLaptop { name: string; price_inr?: number; ram_gb?: number; storage_gb?: number; display_size?: number; weight_kg?: number; battery_wh?: number; cpu?: string }
export const CUSTOM_FIELDS: { key: Exclude<keyof CustomLaptop, 'name' | 'cpu'>; label: string; unit: string; min: number; max: number; int?: boolean }[] = [
  { key: 'price_inr', label: 'Price', unit: '₹', min: 1000, max: 1000000, int: true },
  { key: 'ram_gb', label: 'RAM', unit: 'GB', min: 1, max: 256, int: true },
  { key: 'storage_gb', label: 'Storage', unit: 'GB', min: 16, max: 16384, int: true },
  { key: 'display_size', label: 'Screen size', unit: 'inch', min: 7, max: 21 },
  { key: 'weight_kg', label: 'Weight', unit: 'kg', min: 0.3, max: 6 },
  { key: 'battery_wh', label: 'Battery', unit: 'Wh', min: 5, max: 200 },
];
/** Checks what was typed. Blank stays unknown ("?"). Returns either the clean laptop or one message per bad field. */
export function parseCustom(form: Record<string, string>): { ok: true; laptop: CustomLaptop } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}; const out: CustomLaptop = { name: '' };
  const name = (form.name ?? '').trim(); if (!name) errors.name = 'Give your laptop a name.'; else if (name.length > 80) errors.name = 'Keep the name under 80 characters.'; else out.name = name;
  for (const f of CUSTOM_FIELDS) {
    const raw = (form[f.key] ?? '').trim().replace(/,/g, ''); if (!raw) continue;
    const n = Number(raw);
    if (!/^\d+(\.\d+)?$/.test(raw) || !isFinite(n)) errors[f.key] = `${f.label}: type a number (${f.unit}).`;
    else if (n < f.min || n > f.max) errors[f.key] = `${f.label}: between ${f.min} and ${f.max} ${f.unit}.`;
    else if (f.int && !Number.isInteger(n)) errors[f.key] = `${f.label}: a whole number.`;
    else out[f.key] = n;
  }
  const cpu = (form.cpu ?? '').trim(); if (cpu.length > 60) errors.cpu = 'Keep the processor under 60 characters.'; else if (cpu) out.cpu = cpu;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, laptop: out };
}
