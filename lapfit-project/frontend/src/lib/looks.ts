// Everything the "look" visuals show is derived here from recorded numbers. Nothing is invented: unknown stays null, tags are counts over the laptops that have the value.
import type { CatalogRow } from './types';

export interface Look { id: string; name: string; brand: string; price: number | null; ram: number | null; screen: number | null; weight: number | null; battery: number | null; hz: number | null; gpu: string | null }
const n = (v: unknown): number | null => (v == null || v === '' || !isFinite(Number(v)) || Number(v) <= 0 ? null : Number(v));

export const fromCard = (c: { variant_id: string; name: string; brand?: string; price_inr: number | null; specs?: any }): Look => ({
  id: c.variant_id, name: c.name, brand: c.brand ?? c.name.split(' ')[0], price: n(c.price_inr), ram: n(c.specs?.ram_gb), screen: n(c.specs?.display_size), weight: n(c.specs?.weight_kg),
  battery: n(c.specs?.battery_wh), hz: n(c.specs?.refresh_hz), gpu: c.specs?.gpu_class ?? null,
});
export const fromCatalog = (r: CatalogRow & Record<string, any>): Look => ({
  id: r.variant_id, name: r.name, brand: r.brand, price: n(r.price_inr), ram: n(r.ram_gb), screen: n(r.display_size), weight: n(r.weight_kg), battery: n(r.battery_wh), hz: n(r.refresh_hz), gpu: r.gpu_class ?? null,
});

type Num = 'price' | 'ram' | 'screen' | 'weight' | 'battery' | 'hz';
const vals = (all: Look[], k: Num) => all.map((l) => l[k]).filter((v): v is number => v != null);

/** Screen glass size in cm for a diagonal in inches, assuming a 16:9 shape (the shape is not recorded). */
export function glass(diagonalIn: number) { const k = (diagonalIn / Math.hypot(16, 9)) * 2.54; return { w: 16 * k, h: 9 * k, area: 16 * 9 * k * k }; }
export const A4 = { w: 29.7, h: 21.0 };

/** One litre of water weighs about one kilogram. */
export const bottlesOf = (kg: number | null) => (kg == null ? null : Math.round(kg * 10) / 10);

export const hueOf = (s: string) => { let h = 0; for (const c of s.toLowerCase()) h = (h * 33 + c.charCodeAt(0)) % 360; return h; };

export interface Tag { txt: string; hi: boolean }
/** What stands out about this laptop among the laptops that have the same value recorded. Only counts, never a verdict. */
export function differenceTags(l: Look, all: Look[], max = 3): Tag[] {
  const out: Tag[] = []; const used = new Set<Num>(); const push = (txt: string, hi: boolean) => { if (out.length < max) out.push({ txt, hi }); };
  const total = all.length; if (total < 5) return out;
  const ext = (k: Num, low: string, high: string) => { const v = l[k]; const a = vals(all, k); if (v == null || a.length < 5) return; if (v === Math.min(...a)) { push(low, true); used.add(k); } else if (v === Math.max(...a)) { push(high, true); used.add(k); } };
  ext('weight', `Lightest of the ${vals(all, 'weight').length}`, `Heaviest of the ${vals(all, 'weight').length}`);
  ext('screen', `Smallest screen of the ${vals(all, 'screen').length}`, `Biggest screen of the ${vals(all, 'screen').length}`);
  ext('price', `Lowest price of the ${vals(all, 'price').length}`, `Highest price of the ${vals(all, 'price').length}`);
  const ram = vals(all, 'ram'); if (l.ram != null && ram.length >= 5 && l.ram === Math.max(...ram) && ram.filter((r) => r === l.ram).length < ram.length / 2) push(`${l.ram} GB RAM, one of ${ram.filter((r) => r === l.ram).length}`, true);
  const gk = all.filter((x) => x.gpu != null); if (l.gpu === 'dedicated' && gk.length >= 5) push(`Dedicated graphics (${gk.filter((x) => x.gpu === 'dedicated').length} of ${gk.length})`, false);
  const hz = vals(all, 'hz'); if (l.hz != null && l.hz >= 100 && hz.length >= 3) push(`${l.hz} Hz screen (recorded for ${hz.length})`, false);
  const bat = vals(all, 'battery'); if (l.battery != null && bat.length >= 3 && l.battery === Math.max(...bat)) push(`Largest battery on record, ${l.battery} Wh (${bat.length} known)`, false);
  if (out.length < max) {
    const pos = ([['price', 'Cheaper than', 'Pricier than'], ['weight', 'Lighter than', 'Heavier than'], ['screen', 'Smaller screen than', 'Bigger screen than']] as [Num, string, string][])
      .filter(([k]) => !used.has(k) && l[k] != null && vals(all, k).length >= 5).map(([k, a, b]) => {
        const v = vals(all, k), lower = v.filter((x) => x > (l[k] as number)).length, higher = v.filter((x) => x < (l[k] as number)).length;
        return lower >= higher ? { s: lower, txt: `${a} ${lower} of ${v.length - 1}` } : { s: higher, txt: `${b} ${higher} of ${v.length - 1}` };
      }).sort((x, y) => y.s - x.s);
    for (const p of pos) push(p.txt, false);
  }
  return out;
}

/** Position of this laptop on a shared 0..1 track among all that have the value, plus the others' positions. Null when fewer than 3 laptops have it. */
export function strip(l: Look, all: Look[], k: Num): { self: number; others: number[]; lo: number; hi: number } | null {
  const a = vals(all, k), v = l[k]; if (v == null || a.length < 3) return null; const lo = Math.min(...a), hi = Math.max(...a); const X = (x: number) => (hi === lo ? 0.5 : (x - lo) / (hi - lo));
  return { self: X(v), others: all.filter((o) => o.id !== l.id && o[k] != null).map((o) => X(o[k] as number)), lo, hi };
}
