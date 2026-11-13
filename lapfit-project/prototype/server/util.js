export const fmtInr = (n) => '₹' + Number(n).toLocaleString('en-IN');
export const fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtStorage = (gb) => (gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`);
export const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

const UNITS = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12,
  thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 };
const TENS = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };

function wordsToNumber(str) {
  let total = 0, seen = false;
  for (const w of str.toLowerCase().split(/[\s-]+/)) {
    if (w in UNITS) { total += UNITS[w]; seen = true; }
    else if (w in TENS) { total += TENS[w]; seen = true; }
    else if (w === 'hundred' && seen) total *= 100;
  }
  return seen ? total : null;
}

// Finds rupee amounts in free text: "60k", "1 lakh", "1.5 lakh", "sixty thousand", "₹62,990", "Rs 45000".
export function parseInrAmounts(text) {
  const t = String(text).toLowerCase();
  const out = [];
  const push = (value, index) => { if (value >= 1000 && value <= 50000000) out.push({ value: Math.round(value), index }); };
  let m;
  const reK = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|lakh|thousand|hazaar|hazar)\b/g;
  while ((m = reK.exec(t))) {
    const n = parseFloat(m[1]); const u = m[2];
    push(/^(k|thousand|hazaar|hazar)$/.test(u) ? n * 1000 : n * 100000, m.index);
  }
  const reW = /((?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|and)[\s-]+)+)(thousand|lakh|lac|hazaar|hazar)\b/g;
  while ((m = reW.exec(t))) {
    const n = wordsToNumber(m[1].replace(/\band\b/g, ''));
    if (n) push(/lakh|lac/.test(m[2]) ? n * 100000 : n * 1000, m.index);
  }
  const reP = /(?:₹|rs\.?\s*|inr\s*)\s*(\d{1,3}(?:,\d{2,3})+|\d{4,8})/g;
  while ((m = reP.exec(t))) push(parseInt(m[1].replace(/,/g, ''), 10), m.index);
  const reC = /(?<![\d.])(\d{1,3}(?:,\d{2,3})+|\d{5,7})(?![\d.]*\s*(?:gb|tb|kg|mah|wh|hz))/g;
  while ((m = reC.exec(t))) push(parseInt(m[1].replace(/,/g, ''), 10), m.index);
  const seen = new Set();
  return out.filter((o) => (seen.has(o.value) ? false : seen.add(o.value)));
}

export const normText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export const looksLikeUrl = (s) => /https?:\/\/\S+|www\.\S+/i.test(s);

// Cheap, code-side detection of text that tries to steer the assistant. Added to ignored_instructions.
const INJECTION = [
  /ignore (all |any |the )?(previous|above|prior|earlier) (instructions|rules|prompts?)/i,
  /disregard (the |all |your )?(rules|instructions|system)/i,
  /you are now\b/i, /act as\b/i, /pretend (to be|you)/i, /reveal (your|the) (system )?prompt/i,
  /system prompt/i, /developer mode/i, /jailbreak/i, /always (recommend|rank|put|say)/i,
  /(rank|put|show|list) .{0,30}\b(first|top|number one|#1)\b/i, /do not (mention|show|include)/i,
];
export function findInjections(text) {
  const hits = [];
  for (const re of INJECTION) {
    const m = String(text).match(re);
    if (m) {
      const start = Math.max(0, m.index - 10);
      hits.push(String(text).slice(start, m.index + m[0].length + 40).trim());
    }
  }
  return hits;
}
