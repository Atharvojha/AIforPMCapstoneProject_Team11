// Words that are not catalog fields ("stylish", "premium", "durable", "fast"). Each is handled openly:
// a stand-in the buyer can see and edit, an owner-evidence lens, or an honest "not in the catalog".
import type { Needs } from './types.ts';

export type LensId = 'looks' | 'build' | 'battery_life';
export interface SoftResult { needs: Needs; notices: string[]; lenses: LensId[]; unsupported: string[] }

export const LOOKS_TERMS = ['stylish', 'sleek', 'slim', 'premium', 'elegant', 'good looking', 'looks good', 'nice look', 'beautiful', 'attractive', 'classy'];

interface Rule { id: string; re: RegExp; apply(n: Needs, r: SoftResult, o: { lightKg: number; text: string }): void }
const has = (n: Needs, attr: string) => [...n.musts, ...n.shoulds, ...n.nices].some((c) => String(c.attribute).toLowerCase().replace(/[\s-]+/g, '_') === attr || (attr === 'weight_kg' && /^weight/.test(String(c.attribute))));
const hit = (t: string, re: RegExp) => (t.match(re) as RegExpMatchArray)[0];

const RULES: Rule[] = [
  { id: 'looks', re: /\b(stylish|stylishly|style|sleek|premium|elegant|classy|aesthetic(?:ally)?|good[- ]?looking|nice[- ]?looking|beautiful|attractive|looks? (?:good|nice|great)|best looking)\b/i,
    apply(n, r) { r.lenses.push('looks'); r.notices.push('Looks and design are not recorded in the catalog. As a stand-in I counted how many owners praised the looks in their reviews. Treat it as a guide, not a fact about the design. I have no colour data yet.'); } },
  { id: 'light', re: /\b(light|lightweight|light-weight|halka|portable|compact|slim|thin|ultrabook|travel[- ]friendly)\b/i,
    apply(n, r, o) { if (!has(n, 'weight_kg')) { n.shoulds.push({ attribute: 'weight_kg', operator: '<=', value: o.lightKg, source_text: hit(o.text, this.re) }); r.notices.push(`"${hit(o.text, this.re)}" read as weight up to ${o.lightKg} kg (a Should you can change). Thickness is not in the catalog.`); } } },
  { id: 'durable', re: /\b(durable|sturdy|rugged|solid build|well[- ]built|build quality|long[- ]lasting|lasts long)\b/i,
    apply(n, r) { r.lenses.push('build'); r.notices.push('Build quality is not a catalog field. I used what owners reported about the hinge and build.'); } },
  { id: 'battery', re: /\b(long battery|good battery|battery life|battery backup|all[- ]day battery|lasts? (?:all day|long))\b/i,
    apply(n, r) { r.lenses.push('battery_life'); r.notices.push('Real battery life is not in the catalog. I used what owners reported about the battery.'); } },
  { id: 'gaming', re: /\b(rgb|gaming look|gamer look)\b/i,
    apply(n, r, o) { if (!has(n, 'gpu_class')) n.shoulds.push({ attribute: 'gpu_class', operator: 'in', value: ['dedicated'], source_text: hit(o.text, this.re) }); r.unsupported.push('RGB lighting'); } },
  { id: 'fast', re: /\b(fast|powerful|high[- ]performance|snappy|smooth|lag[- ]?free|no lag)\b/i,
    apply(n, r, o) { if (!has(n, 'ram_gb')) { n.shoulds.push({ attribute: 'ram_gb', operator: '>=', value: 16, source_text: hit(o.text, this.re) }); r.notices.push(`"${hit(o.text, this.re)}" read as 16 GB RAM or more (a Should you can change). Processor speed is not scored.`); } } },
  { id: 'value', re: /\b(cheap|cheapest|affordable|budget[- ]friendly|value for money|economical|low cost|sasta)\b/i,
    apply(n, r) { if (!n.use_cases.includes('value')) n.use_cases.push('value'); } },
  { id: 'camera', re: /\b(good camera|webcam|speakers?|loud speaker|microphone|mic quality|dolby|fingerprint|face unlock|touch ?screen|backlit|numpad|hdmi|usb[- ]?c|thunderbolt|sd card|2[- ]?in[- ]?1)\b/i,
    apply(n, r, o) { const w = o.text.match(new RegExp(this.re.source, 'gi')) ?? []; for (const x of new Set(w.map((y) => y.toLowerCase()))) if (!/2[- ]?in[- ]?1/.test(x)) r.unsupported.push(x); } },
];

export function applySoftTerms(text: string, needs: Needs, o: { lightKg: number }): SoftResult {
  const n: Needs = JSON.parse(JSON.stringify(needs)); const r: SoftResult = { needs: n, notices: [], lenses: [], unsupported: [] };
  // a reader may emit style words as if they were fields; the looks lens below handles them, so drop them here
  const STYLE_ATTR = /^(style|stylish|design|looks?|appearance|aesthetics?|aesthetic|premium|sleek)$/i;
  for (const k of ['musts', 'shoulds', 'nices'] as const) n[k] = n[k].filter((c) => !STYLE_ATTR.test(String(c.attribute).trim()));
  for (const rule of RULES) if (rule.re.test(text)) rule.apply(n, r, { lightKg: o.lightKg, text });
  r.lenses = [...new Set(r.lenses)]; r.unsupported = [...new Set(r.unsupported)];
  if (r.unsupported.length) r.notices.push(`Not in the catalog, so I cannot check or filter on: ${r.unsupported.join(', ')}. Live reviews may mention them.`);
  return r;
}
