import type { Reply } from './types';

/** The one laptop a conversation is about, and the laptops last shown. Ids and names only, never typed text. */
export interface FocusLaptop { variant_id: string; name: string }
export interface ThreadContext { focus: FocusLaptop | null; focusTurn: number; shown: FocusLaptop[] }
export const MAX_SHOWN = 6;

const pick = (x: any): FocusLaptop | null => (x && typeof x.variant_id === 'string' && x.variant_id && typeof x.name === 'string' ? { variant_id: x.variant_id, name: x.name } : null);
/** "Brand Model · 8 GB / 256 GB" -> "Brand Model". */
export const shortName = (name: string) => name.split(' · ')[0];

function focusOf(r: Reply): FocusLaptop | null {
  const blocks = r.blocks ?? [];
  const ans = blocks.find((b) => b.type === 'laptop_answer'); if (ans) { const f = pick(ans.laptop); if (f) return f; }
  const cards = (b: { type: string }) => b.type === 'cards';
  if (r.flow === 'second_opinion') { const c = blocks.find(cards); const f = pick(c?.cards?.[0]); if (f) return f; }
  const latestCards = [...blocks].reverse().find((b) => cards(b) && (b.cards?.length ?? 0) > 0);
  if (latestCards) { const f = pick(latestCards.cards[0]); if (f) return f; }
  const ev = blocks.find((b) => b.type === 'evidence');
  if (ev && typeof ev.variant_id === 'string' && ev.variant_id && typeof ev.laptop === 'string') return { variant_id: ev.variant_id, name: ev.laptop };
  return null;
}
function shownOf(r: Reply): FocusLaptop[] {
  const out: FocusLaptop[] = [];
  for (const b of r.blocks ?? []) {
    const list = b.type === 'cards' ? b.cards : b.type === 'compare' ? b.laptops : null;
    for (const x of (Array.isArray(list) ? list : [])) { const l = pick(x); if (l && !out.some((o) => o.variant_id === l.variant_id)) out.push(l); }
  }
  return out.slice(0, MAX_SHOWN);
}

/** Scans from the latest reply backwards. `focusTurn` is the id of the turn that set the focus (0 when none). */
export function deriveContext(turns: { id: number; reply?: Reply }[]): ThreadContext {
  let focus: FocusLaptop | null = null; let focusTurn = 0; let shown: FocusLaptop[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const r = turns[i].reply; if (!r) continue;
    if (!focus) { const f = focusOf(r); if (f) { focus = f; focusTurn = turns[i].id; } }
    if (!shown.length) shown = shownOf(r);
    if (focus && shown.length) break;
  }
  return { focus, focusTurn, shown };
}
