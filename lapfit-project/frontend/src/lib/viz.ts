// Arranging numbers the backend already gave us so they can be drawn. Nothing here is a new fact: values are scaled
// against the other laptops on screen only, and unknown values stay unknown.
export interface Axis { key: string; label: string; value: number | null; shown: string; higherIsBetter: boolean }
export const norm = (v: number | null, all: (number | null)[], higher: boolean): number | null => {
  if (v == null) return null; const k = all.filter((x): x is number => x != null); if (k.length < 2) return 0.62;
  const lo = Math.min(...k), hi = Math.max(...k); if (hi === lo) return 0.62; const t = (v - lo) / (hi - lo); return 0.18 + 0.82 * (higher ? t : 1 - t);
};
export function axesFor(card: any): Axis[] {
  const s = card.specs ?? {}; const e = card.evidence ?? {};
  return [
    { key: 'price', label: 'Lower price', value: card.price_inr ?? null, shown: card.price_text ?? '?', higherIsBetter: false },
    { key: 'ram', label: 'RAM', value: s.ram_gb ?? null, shown: s.ram_gb != null ? `${s.ram_gb} GB` : '?', higherIsBetter: true },
    { key: 'storage', label: 'Storage', value: s.storage_gb ?? null, shown: s.storage_gb != null ? (s.storage_gb >= 1024 ? `${s.storage_gb / 1024} TB` : `${s.storage_gb} GB`) : '?', higherIsBetter: true },
    { key: 'weight', label: 'Lightness', value: s.weight_kg ?? null, shown: s.weight_kg != null ? `${s.weight_kg} kg` : '?', higherIsBetter: false },
    { key: 'screen', label: 'Screen', value: s.display_size ?? null, shown: s.display_size != null ? `${s.display_size} in` : '?', higherIsBetter: true },
    { key: 'owners', label: 'Owners', value: e.enough && e.positive + e.negative > 0 ? e.positive / (e.positive + e.negative) : null, shown: e.enough ? `${e.positive} of ${e.n} positive` : 'not enough evidence', higherIsBetter: true },
  ];
}
/** The days between a recorded date and today, for the "how fresh is this price" chip. */
export const daysOld = (iso: string | null | undefined, now = new Date()): number | null => { if (!iso) return null; const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`); return isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / 86400000)); };
export const freshness = (d: number | null): { tone: 'fresh' | 'aging' | 'stale' | 'unknown'; text: string } => d == null ? { tone: 'unknown', text: 'date unknown' } : d <= 7 ? { tone: 'fresh', text: d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} old` } : d <= 30 ? { tone: 'aging', text: `${d} days old` } : { tone: 'stale', text: `${d} days old` };
