// LAUNCH YEAR and date checks. Pure functions, no I/O.
// launchYearOf is APPROXIMATE and never invented: it reads a year written in the laptop name ("(2022)", "2020 Macbook Air"),
// else the processor generation, else returns null (unknown).
// Processor mapping (approximate, the first full year laptops with that chip were on sale; a model may have launched a little earlier):
//   Intel Core Nth gen (also read from i5-1135G7 / i7-8550U style numbers) -> 2010 + N, so 8th 2018, 10th 2020, 11th 2021, 12th 2022, 13th 2023, 14th 2024
//   Intel Core Ultra -> 2024
//   AMD Ryzen 3000 -> 2019, 4000 -> 2020, 5000 -> 2021, 6000 -> 2022, 7000 -> 2023, 8000 and 9000 -> 2024
//   Apple M1 -> 2020, M2 -> 2022, M3 -> 2023, M4 -> 2024
export const EARLIEST_YEAR = 2012;

const NAME_YEAR = /(?<![\w.-])(20(?:1[2-9]|2\d))(?![\w-])/;
const APPLE: Record<string, number> = { '1': 2020, '2': 2022, '3': 2023, '4': 2024 };

export function launchYearOf(name: string | null | undefined, cpuText?: string | null): number | null {
  const n = String(name ?? ''); const c = String(cpuText ?? ''); const all = `${n} ${c}`;
  const y = n.match(NAME_YEAR); if (y) return Number(y[1]);
  const apple = c.match(/^\s*(?:apple\s*)?M([1-4])\b/i) ?? (/\b(?:apple|macbook)\b/i.test(n) ? n.match(/\bM([1-4])\b/i) : null); if (apple) return APPLE[apple[1]] ?? null;
  if (/core\s*ultra/i.test(all)) return 2024;
  // Ryzen: the series digit of the 4-digit model number (5500U, R7-4800H)
  const ryz = all.match(/ryzen[^,|]*?(?:\b|r[3579]-)([3-9])\d{3}[a-z]{0,2}\b/i) ?? all.match(/\bR[3579]-([3-9])\d{3}[a-z]{0,2}\b/i);
  if (ryz) { const s = Number(ryz[1]); return s >= 8 ? 2024 : 2016 + s; }
  // Intel: "10th Gen" or a model number such as i5-1135G7, i7-10750H, i5-8250U
  const gen = all.match(/\b(\d{1,2})(?:st|nd|rd|th)[\s-]*gen/i);
  if (gen) { const g = Number(gen[1]); if (g >= 2 && g <= 15) return 2010 + g; }
  const model = all.match(/\bi[3579][-\s]?(\d{4,5})[a-z]{0,2}\d?\b(?!\s*(?:gb|tb))/i);
  if (model) { const d = model[1]; const g = d.length === 5 ? Number(d.slice(0, 2)) : d[0] === '1' ? Number(d.slice(0, 2)) : Number(d[0]); if (g >= 2 && g <= 15) return 2010 + g; }
  return null;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateText = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };

export type DateCheck = { ok: true } | { ok: false; reason: string; kind: 'future' | 'before_launch' | 'too_old' | 'not_a_date' };
/** A purchase date must be a real date, not after today, and not before the model launched (launch year start) or 2012 when the launch is unknown. */
export function checkPurchaseDate(iso: string, launchYear: number | null, today: string): DateCheck {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ok: false, kind: 'not_a_date', reason: 'This is not a date I can read. Use the format YYYY-MM-DD.' };
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (dt.getUTCFullYear() !== Number(m[1]) || dt.getUTCMonth() !== Number(m[2]) - 1 || dt.getUTCDate() !== Number(m[3])) return { ok: false, kind: 'not_a_date', reason: 'That day does not exist on the calendar.' };
  if (iso > today) return { ok: false, kind: 'future', reason: `${dateText(iso)} is in the future, so it cannot be a purchase date.` };
  if (launchYear != null && Number(m[1]) < launchYear - 1) return { ok: false, kind: 'before_launch', reason: `This model launched in ${launchYear}, so ${dateText(iso)} cannot be right.` };
  if (launchYear == null && Number(m[1]) < EARLIEST_YEAR) return { ok: false, kind: 'too_old', reason: `${dateText(iso)} is before ${EARLIEST_YEAR}, earlier than any laptop in this catalog, so it cannot be right.` };
  return { ok: true };
}

/** Oldest age (whole years) a laptop of this model can have today. null when the launch year is unknown. */
export const maxAgeYears = (launchYear: number | null, today: string): number | null => (launchYear == null ? null : Math.max(0, Number(today.slice(0, 4)) - launchYear));
