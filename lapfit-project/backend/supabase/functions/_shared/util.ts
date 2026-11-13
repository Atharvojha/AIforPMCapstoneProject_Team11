export const fmtInr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(+d)) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
export const fmtStorage = (gb: number) => (gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`);
export const words = (s: string) => String(s).trim().split(/\s+/).filter(Boolean).length;
export const normText = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const looksLikeUrl = (s: string) => /https?:\/\/\S+|www\.\S+/i.test(s);

const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function wordsToNumber(str: string): number | null {
  let total = 0, seen = false;
  for (const w of str.toLowerCase().split(/[\s-]+/)) {
    if (w in UNITS) { total += UNITS[w]; seen = true; }
    else if (w in TENS) { total += TENS[w]; seen = true; }
    else if (w === 'hundred' && seen) total *= 100;
  }
  return seen ? total : null;
}

/** Rupee amounts in free text: "60k", "1 lakh", "1.5 lakh", "sixty thousand", "₹62,990", "Rs 45000". */
export function parseInrAmounts(text: string): { value: number; index: number }[] {
  const t = String(text).toLowerCase(); const out: { value: number; index: number }[] = [];
  const push = (value: number, index: number) => { if (value >= 1000 && value <= 50_000_000) out.push({ value: Math.round(value), index }); };
  let m: RegExpExecArray | null;
  const reK = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|thousand|hazaar|hazar)\b/g;
  while ((m = reK.exec(t))) { const n = parseFloat(m[1]); push(/^(k|thousand|hazaar|hazar)$/.test(m[2]) ? n * 1000 : n * 100000, m.index); }
  const reW = /((?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|and)[\s-]+)+)(thousand|lakh|lac|hazaar|hazar)\b/g;
  while ((m = reW.exec(t))) { const n = wordsToNumber(m[1].replace(/\band\b/g, '')); if (n) push(/lakh|lac/.test(m[2]) ? n * 100000 : n * 1000, m.index); }
  const reP = /(?:₹|rs\.?\s*|inr\s*)\s*(\d{1,3}(?:,\d{2,3})+|\d{4,8})/g;
  while ((m = reP.exec(t))) push(parseInt(m[1].replace(/,/g, ''), 10), m.index);
  const reC = /(?<![\d.])(\d{1,3}(?:,\d{2,3})+|\d{5,7})(?![\d.]*\s*(?:gb|tb|kg|mah|wh|hz))/g;
  while ((m = reC.exec(t))) push(parseInt(m[1].replace(/,/g, ''), 10), m.index);
  const seen = new Set<number>();
  return out.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}

/** Text that tries to steer the assistant. Added to ignored_instructions whatever the model says. */
const INJECTION = [
  /ignore (all |any |the )?(previous|above|prior|earlier) (instructions|rules|prompts?)/i, /disregard (the |all |your )?(rules|instructions|system)/i,
  /you are now\b/i, /pretend (to be|you)/i, /reveal (your|the) (system )?prompt/i, /system prompt/i, /developer mode/i, /jailbreak/i,
  /always (recommend|rank|put|say)/i, /(rank|put|show|list) .{0,30}\b(first|top|number one|#1)\b/i, /do not (mention|show|include)/i,
];
export function findInjections(text: string): string[] {
  const hits: string[] = [];
  for (const re of INJECTION) { const m = String(text).match(re); if (m && m.index !== undefined) hits.push(String(text).slice(Math.max(0, m.index - 10), m.index + m[0].length + 40).trim()); }
  return hits;
}

/** Remove phone numbers, emails and links before text is kept in the unhandled log. */
export function scrub(text: string): string {
  return String(text)
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/g, '[phone]')
    .slice(0, 500);
}

export function newRequestId(): string { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
