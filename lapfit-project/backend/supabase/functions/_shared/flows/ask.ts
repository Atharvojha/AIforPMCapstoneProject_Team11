// "Which laptop?" done properly: the question always carries a way to answer (tap a distinguishable choice that carries the variant id, or type the name),
// and the ORIGINAL task rides along in `base`, so the answer continues it instead of starting over. Also: checks for what the browser sends back in `base`.
import { fmtInr, scrub, findInjections } from '../util.ts';
import type { Deps, Block, Row } from '../types.ts';
import type { Claim, Listing, Mention } from '../router.ts';

export interface AskChoice { variant_id: string; label: string }
export const ASK_PLACEHOLDER = 'Type the laptop, for example "Asus TUF Gaming F15"';
/** A label no two variants share: name, price and the variant id. */
export const variantLabel = (c: { display_name: string; price_inr: number | null; variant_id: string }) => `${c.display_name} · ${c.price_inr != null ? fmtInr(c.price_inr) : 'price ?'} · ${c.variant_id}`;
/** `base: null` and `choices: null` are filled in by the handler (it knows the request and what the person was looking at). */
export function askBlock(question: string, base: Record<string, unknown> | null, choices: AskChoice[] | null): Block {
  return { type: 'ask_laptop', question, base, choices, placeholder: ASK_PLACEHOLDER };
}
export const withBase = (blocks: Block[], base: Record<string, unknown>): Block[] => blocks.map((b) => (b.type === 'ask_laptop' && !b.base ? { ...b, base } : b));
/** Keep a `needs` object small enough to send back and forth. */
export const slimNeeds = (n: unknown) => (n && typeof n === 'object' && JSON.stringify(n).length < 4000 ? n : undefined);

/** Choices for a "which laptop" question: the ids given (shown, recommended) first, then the catalog's India laptops. */
export async function laptopChoices(deps: Deps, ids: string[], max = 6): Promise<AskChoice[]> {
  const all = await deps.tools.call<{ rows: Row[] }>('find_variants', {}); const byId = new Map(all.rows.map((r) => [r.variant_id, r]));
  const out: Row[] = []; const seen = new Set<string>();
  for (const id of ids) { const r = byId.get(id); if (r && !seen.has(id)) { seen.add(id); out.push(r); } }
  const india = all.rows.filter((r) => r.price_inr != null && !/^us/i.test(String(r.market ?? '')) && !seen.has(r.variant_id)).sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0) || String(a.variant_id).localeCompare(String(b.variant_id)));
  for (const r of india) { if (out.length >= max) break; out.push(r); }
  return out.slice(0, max).map((r) => ({ variant_id: r.variant_id, label: variantLabel(r) }));
}

// ---- what comes back in `base` is checked, never trusted ----
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null);
const str = (v: unknown, n: number) => { const t = typeof v === 'string' ? scrub(v).replace(/\s+/g, ' ').trim().slice(0, n) : ''; return t && !findInjections(t).length ? t : null; };
export function cleanListing(x: any): Listing | null {
  if (!x || typeof x !== 'object') return null; const b = (v: unknown) => (typeof v === 'boolean' ? v : null);
  return { age_years: num(x.age_years, 0, 30), brand: str(x.brand, 30), line: str(x.line, 60), ram_gb: num(x.ram_gb, 2, 128), storage_gb: num(x.storage_gb, 32, 8192), price_inr: num(x.price_inr, 1000, 2_000_000), os: str(x.os, 20), battery_health_pct: num(x.battery_health_pct, 1, 100), has_serial: b(x.has_serial), has_bill: b(x.has_bill), seller_warranty_months: num(x.seller_warranty_months, 0, 120), weight_kg: num(x.weight_kg, 0.3, 8), reason: str(x.reason, 160) };
}
const CLAIM_TYPES = ['spec', 'performance', 'price', 'service', 'comparative', 'absolute', 'opinion'];
export const cleanClaims = (x: unknown): Claim[] => (Array.isArray(x) ? x : []).slice(0, 12).map((c: any) => ({ claim_text: str(c?.claim_text, 300) ?? '', type: CLAIM_TYPES.includes(c?.type) ? c.type : 'performance', scope: str(c?.scope, 80) ?? '' } as Claim)).filter((c) => c.claim_text.length > 3);
export const cleanMentions = (x: unknown): Mention[] => (Array.isArray(x) ? x : []).slice(0, 3).map((m: any) => ({ brand: str(m?.brand, 30), line: str(m?.line, 60), ram_gb: num(m?.ram_gb, 2, 128), storage_gb: num(m?.storage_gb, 32, 8192), price_inr: num(m?.price_inr, 1000, 2_000_000) } as Mention)).filter((m) => m.brand || m.line);
