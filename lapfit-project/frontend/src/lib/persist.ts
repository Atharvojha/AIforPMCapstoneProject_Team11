import type { Turn } from '../state/useThread';
import { getSession, setSession } from './storage';

/**
 * What survives a reload of the page (this browser tab only): the last few finished turns of a conversation, the open Detail card, and the screen.
 * Typed text and replies only; nothing here is sent anywhere. Size-capped so a long chat can never fill the storage.
 */
export const MAX_SAVED_TURNS = 6; export const MAX_SAVED_BYTES = 300_000;
const turnsKey = (k: string) => `lapfit.thread.v1.${k}`; const detailKey = (k: string) => `lapfit.detail.v1.${k}`; const ROUTE = 'lapfit.route.v1';

export function saveTurns(key: string, turns: Turn[]) {
  let keep = turns.filter((t) => t.reply && !t.pending && !t.error).slice(-MAX_SAVED_TURNS).map((t) => ({ id: t.id, user: t.user, reply: t.reply, body: t.body, typed: t.typed }));
  while (keep.length > 0 && JSON.stringify(keep).length > MAX_SAVED_BYTES) keep = keep.slice(1);
  setSession(turnsKey(key), keep);
}
export function loadTurns(key: string): Turn[] {
  const raw = getSession<unknown>(turnsKey(key), []); if (!Array.isArray(raw)) return [];
  return raw.filter((t) => t && typeof t.id === 'number' && t.reply && Array.isArray(t.reply.blocks)).slice(-MAX_SAVED_TURNS).map((t) => ({ id: t.id, user: typeof t.user === 'string' ? t.user : undefined, reply: t.reply, body: t.body && typeof t.body === 'object' ? t.body : {}, ...(t.typed ? { typed: true } : {}) }));
}
export function clearSaved(key: string) { try { sessionStorage.removeItem(turnsKey(key)); sessionStorage.removeItem(detailKey(key)); } catch { /* ignore */ } }

export interface SavedDetail { variant_id: string; tab: string }
export const saveDetail = (key: string, d: SavedDetail | null) => { if (d) setSession(detailKey(key), d); else try { sessionStorage.removeItem(detailKey(key)); } catch { /* ignore */ } };
export const loadDetail = (key: string): SavedDetail | null => { const d = getSession<any>(detailKey(key), null); return d && typeof d.variant_id === 'string' ? { variant_id: d.variant_id, tab: String(d.tab ?? 'fit') } : null; };
export const saveRoute = (tab: string) => setSession(ROUTE, tab);
export const loadRoute = (): string | null => getSession<string | null>(ROUTE, null);
