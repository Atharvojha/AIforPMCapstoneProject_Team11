import { useSyncExternalStore } from 'react';
import type { Needs, Reply } from './types';
import { cleanNeeds, inr } from './needs';
import type { FocusLaptop } from './focus';
import { getSession, setSession } from './storage';

/**
 * The session brief: three saved parts that clearing one never touches.
 * needs = the last understood needs, recs = ids and names of the last recommendation list (max 10),
 * selection = the laptop in focus and the compare picks. Ids and names only, never typed text. Kept in sessionStorage.
 */
export interface NamedLaptop { id: string; name: string }
export interface SessionBrief { needs: Needs | null; recs: NamedLaptop[]; focus: FocusLaptop | null; picks: NamedLaptop[] }
export const MAX_RECS = 10; export const MAX_PICKS = 4;
const KEY = 'lapfit.session.v1';
export const emptyBrief = (): SessionBrief => ({ needs: null, recs: [], focus: null, picks: [] });

const named = (x: any): NamedLaptop | null => (x && typeof x.id === 'string' && x.id && typeof x.name === 'string' ? { id: x.id, name: x.name.slice(0, 120) } : null);
const sanitize = (raw: any): SessionBrief => {
  const b = emptyBrief(); if (!raw || typeof raw !== 'object') return b;
  if (raw.needs && typeof raw.needs === 'object' && Array.isArray(raw.needs.use_cases)) b.needs = raw.needs as Needs;
  b.recs = (Array.isArray(raw.recs) ? raw.recs : []).map(named).filter(Boolean).slice(0, MAX_RECS) as NamedLaptop[];
  b.picks = (Array.isArray(raw.picks) ? raw.picks : []).map(named).filter(Boolean).slice(0, MAX_PICKS) as NamedLaptop[];
  const f = raw.focus; if (f && typeof f.variant_id === 'string' && typeof f.name === 'string') b.focus = { variant_id: f.variant_id, name: f.name };
  return b;
};

export interface SessionStore { get(): SessionBrief; set(patch: Partial<SessionBrief>): void; reset(): void; subscribe(fn: () => void): () => void }
/** `persist` false keeps the brief in memory only (used when no shared store is given). */
export function createSessionStore(persist = true): SessionStore {
  let state: SessionBrief = persist ? sanitize(getSession<unknown>(KEY, null)) : emptyBrief(); const subs = new Set<() => void>();
  const commit = (next: SessionBrief) => { state = next; if (persist) setSession(KEY, next); subs.forEach((f) => f()); };
  return {
    get: () => state,
    set: (patch) => { const next = sanitize({ ...state, ...patch, needs: patch.needs === undefined ? state.needs : patch.needs ? cleanNeeds(patch.needs) : null }); if (JSON.stringify(next) !== JSON.stringify(state)) commit(next); },
    reset: () => commit(emptyBrief()),
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
export const useSessionBrief = (store: SessionStore): SessionBrief => useSyncExternalStore(store.subscribe, store.get, store.get);

/** The recommendation list of one reply: the cards of a shortlist (not a single-laptop second opinion), max 10. Null when the reply recommends nothing. */
export function recsOf(reply: Reply | undefined): NamedLaptop[] | null {
  if (!reply || reply.flow === 'second_opinion') return null; const out: NamedLaptop[] = [];
  for (const b of reply.blocks ?? []) if (b.type === 'cards') for (const c of (b.cards ?? []) as any[]) { const n = named({ id: c?.variant_id, name: c?.name }); if (n && !out.some((o) => o.id === n.id)) out.push(n); }
  return out.length ? out.slice(0, MAX_RECS) : null;
}

/** "coding · up to ₹80,000" */
export function needsSummary(n: Needs | null): string {
  if (!n) return '';
  const parts = [...n.use_cases, ...(n.budget_max_inr != null ? [`up to ${inr(n.budget_max_inr)}`] : ['no budget limit'])];
  return parts.join(' · ');
}
