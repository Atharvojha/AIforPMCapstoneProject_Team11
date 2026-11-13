// FOLLOW-UP QUESTIONS WITH CONTEXT. The browser says which laptop the person is looking at (focus) and which were shown (shown): ids and names only.
// Code decides what "this" means and which kind of question it is. The AI model is not used here; every line is a stored fact, an owner count or a web excerpt with its link.
import type { Deps } from './types.ts';

export type Intent = 'lifespan' | 'why' | 'upgrade' | 'suit' | 'problems';
export interface Ref { variant_id: string; name: string }
export interface Context { focus: Ref | null; shown: Ref[] }

const INTENTS: [Intent, RegExp][] = [
  ['why', /\b(why (this|that|it|did you|is this|do you|not)|which (one|laptop) did you (show|recommend|suggest|pick|choose)|based on my (spec|need|requirement|budget)|how did you (pick|choose|decide)|what made you (pick|choose|show|recommend))\b/i],
  ['lifespan', /\b(last|lasts|lasting|lifespan|life span|durab\w*|longevity|how long (will|would|does|can|should)|(\d+|few|several|many)\s*(more\s*)?years?|long[- ]?term|future[- ]?proof|outdated|obsolete|reliab\w*)\b/i],
  ['upgrade', /\b(upgrad\w*|expand\w*|add (more )?(ram|memory|storage|ssd)|ram slots?|extra ram|replace (the )?(battery|ssd|ram|keyboard))\b/i],
  ['problems', /\b(problems?|issues?|complain\w*|defects?|faulty|common (fault|problem|issue)s?|what goes wrong|drawbacks?|downsides?|cons)\b/i],
  ['suit', /\b(good for|suitable for|can (it|i|this) (run|play|edit|handle|do)|will (it|this) (run|work|handle|be enough)|enough for|ok(ay)? for|fine for|work for|handle)\b/i],
];
// words that mean the person wants a new list or a different laptop, not a question about the current one
const NEW_REQUEST = /\b(show|suggest|recommend|find|cheaper|lighter|alternatives?|similar|instead|other|another|compare|\bvs\.?\b|versus|under|below|budget|sell|worth|resale)\b/i;
const BRANDS = /\b(asus|hp|msi|lenovo|acer|apple|macbook|dell|samsung|xiaomi|redmi|realme|infinix|thinkpad|ideapad|inspiron|vivobook|zenbook|surface|legion|tuf|rog|nitro|predator)\b/i;
const DEICTIC = /\b(this|that|it|its|the one|you (showed|recommended|suggested|picked)|recommended|top pick|best fit)\b/i;

/** The kind of follow-up question this is, or null when it is not one (a new search, a named laptop, a sale). Pure. */
export function followUpIntent(text: string, ctx: Context): Intent | null {
  const t = String(text ?? '').trim(); if (!t || t.length > 300) return null;
  if (!ctx.focus && !ctx.shown.length) return null;
  if (NEW_REQUEST.test(t) && !/\bwhy\b|which (one|laptop) did you/i.test(t)) return null;
  const hit = INTENTS.find(([, re]) => re.test(t)); if (!hit) return null;
  // a question about a brand, a maker or laptops in general ("which brand is more reliable", "will a gaming laptop last") is not about the one on screen
  if (!DEICTIC.test(t) && (/\b(brands?|makers?|manufacturers?|companies|company)\b/i.test(t) || /\b(a|an|any|the best|best|gaming|cheap|good)\b[^?]{0,25}\blaptops?\b/i.test(t) || /\blaptops\b/i.test(t))) return null;
  const named = t.match(BRANDS); if (named && ![ctx.focus, ...ctx.shown].some((r) => r && r.name.toLowerCase().includes(named[0].toLowerCase()))) return null;   // a laptop we have not been talking about is named: normal routing
  const asks = /\?\s*$/.test(t) || /^(will|can|could|does|do|is|are|how|what|should|would|which|any|why)\b/i.test(t);
  if (hit[0] !== 'why' && !asks) return null;                                                                                         // a statement is not a question about the current laptop
  return hit[0];
}

/** The context the browser sent, checked against the catalog: an id that does not exist, or a made-up name, is ignored. Names always come from the catalog. */
export async function checkedContext(deps: Deps, raw: { focus?: unknown; shown?: unknown } | undefined): Promise<Context> {
  const empty: Context = { focus: null, shown: [] }; if (!raw) return empty;
  const idOf = (x: any): string | null => (x && typeof x.variant_id === 'string' && /^[A-Za-z0-9_-]{2,24}$/.test(x.variant_id) ? x.variant_id : null);
  const wantF = idOf(raw.focus); const wantS = Array.isArray(raw.shown) ? (raw.shown as any[]).map(idOf).filter((x): x is string => !!x).slice(0, 6) : [];
  if (!wantF && !wantS.length) return empty;
  const all = await deps.tools.call<{ rows: { variant_id: string; display_name: string }[] }>('find_variants', {});
  const byId = new Map(all.rows.map((r) => [r.variant_id, r.display_name])); const ref = (id: string): Ref | null => (byId.has(id) ? { variant_id: id, name: byId.get(id)! } : null);
  const focus = wantF ? ref(wantF) : null; const shown = [...new Set(wantS)].map(ref).filter((x): x is Ref => !!x);
  return { focus, shown };
}

const shortName = (n: string) => n.split(' · ')[0].toLowerCase();
/** Which laptop the question is about: one it names (from the shown list), else the focus, else the only one shown. Null means ask. */
export function pickRef(text: string, ctx: Context): Ref | null {
  const t = String(text).toLowerCase();
  const named = [ctx.focus, ...ctx.shown].find((r) => r && t.includes(shortName(r.name)));
  if (named) return named; if (ctx.focus) return ctx.focus; if (ctx.shown.length === 1) return ctx.shown[0]; return null;
}
/** "this", "it", "the one you showed": the person is pointing at the laptop in focus. */
export const refersToCurrent = (text: string) => DEICTIC.test(String(text ?? ''));
