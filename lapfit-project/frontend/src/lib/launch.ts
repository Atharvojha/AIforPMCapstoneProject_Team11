// Dates and ages bounded by when a laptop model launched. Unknown stays unknown: nothing here invents a launch year.
export type MaybeLaunch = { launch_year?: number | null; market?: 'IN' | 'US' | string | null };
export const FALLBACK_MIN_DATE = '2012-01-01';
export const todayIso = (d = new Date()) => d.toISOString().slice(0, 10);
export const launchYearOf = (r?: MaybeLaunch | null): number | null => { const y = r?.launch_year; return typeof y === 'number' && y >= 1990 && y <= 2100 ? y : null; };
export const minPurchaseDate = (r?: MaybeLaunch | null) => { const y = launchYearOf(r); return y ? `${y}-01-01` : FALLBACK_MIN_DATE; };
export const maxAgeYears = (r?: MaybeLaunch | null, now = new Date()) => { const y = launchYearOf(r); return y ? Math.max(1, Math.min(20, now.getFullYear() - y + 1)) : 12; };
/** A plain-words reason a purchase date cannot be right, or null when it is fine (or empty). */
export function dateProblem(date: string, r?: MaybeLaunch | null, today = todayIso()): string | null {
  if (!date) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return 'That does not look like a date.';
  if (date > today) return 'That date is in the future.';
  const y = launchYearOf(r); if (y && date < `${y}-01-01`) return `This model launched in ${y}, so it cannot have been bought before then.`;
  if (date < FALLBACK_MIN_DATE) return 'That is too long ago for any laptop in this catalog.';
  return null;
}
/** A warranty "ended" text like "12 Mar 2019" or "2019-03-12": true when it ended before the model launched (which can only be a wrong date). */
export function endedBeforeLaunch(endsText: unknown, r?: MaybeLaunch | null): boolean { const y = launchYearOf(r); if (!y || typeof endsText !== 'string') return false; const m = endsText.match(/\b(19|20)\d{2}\b/); return !!m && Number(m[0]) < y; }

/**
 * Make the "my laptops" reply safe to show: a warranty that ended before the model launched is never shown (it can only come from a wrong date),
 * and an item the server refused for its date shows the server's own reason.
 */
export function cleanMyLaptops(blocks: { type: string; [k: string]: any }[], launchOf: (variantId: string) => MaybeLaunch | undefined) {
  return blocks.map((b) => b.type !== 'my_laptops' ? b : { ...b, items: (b.items as any[]).map((it) => {
    const why = it.date_note ?? it.purchase_note ?? it.date_error;
    if (typeof why === 'string' && why) return { ...it, found: false, input: it.input ?? it.name ?? 'This laptop', note: why };
    if (it.warranty && endedBeforeLaunch(it.warranty.ends_text ?? it.warranty.ends_on, launchOf(it.variant_id))) { const { warranty: _w, ...rest } = it; return { ...rest, found: false, input: it.name ?? 'This laptop', note: 'The purchase date is before this model launched, so I cannot work out a warranty. Check the date.' }; }
    return it;
  }) });
}
