// Everything the board says about the laptops is computed here from the card numbers. Nothing is invented: unknown stays unknown.
import type { Pic } from '../LaptopImage';

export interface Card {
  variant_id: string; name: string; brand?: string; price_inr: number | null; price_text: string; as_of: string; as_of_text: string; data_status: string; spec_lines: string[]; specs: any; image?: Pic | null;
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
