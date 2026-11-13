import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendQuery, type ApiConfig } from '../lib/api';
import type { ApiError, Needs, Reply } from '../lib/types';
import { cleanNeeds, understoodNeeds } from '../lib/needs';
import { deriveContext, type FocusLaptop } from '../lib/focus';
import { loadTurns, saveTurns, clearSaved } from '../lib/persist';
import { createSessionStore, recsOf, MAX_RECS, MAX_PICKS, type SessionStore, type NamedLaptop } from '../lib/session';

export interface Turn { id: number; user?: string; reply?: Reply; error?: ApiError; pending?: boolean; refreshError?: string; body: Record<string, unknown>; typed?: boolean }

/**
 * One conversation: turns, a single request at a time, answers to older requests ignored, text kept on failure,
 * a countdown when the server says "too many requests".
 */
export function useThread(cfg: ApiConfig, send = sendQuery, onError?: (error: ApiError, body: Record<string, unknown>) => void, session?: SessionStore, persistKey?: string) {
  const own = useMemo(() => createSessionStore(false), []); const store = session ?? own;   // the three saved parts: needs, recommendations, selection
  const [turns, setTurns] = useState<Turn[]>(() => (persistKey ? loadTurns(persistKey) : [])); const [cooldown, setCooldown] = useState(0);
  const [refreshing, setRefreshing] = useState<number | null>(null); const rctl = useRef<AbortController | null>(null);
  const latest = useRef(turns.reduce((m, t) => Math.max(m, t.id), 0)); const ctl = useRef<AbortController | null>(null); const turnsRef = useRef<Turn[]>([]); turnsRef.current = turns;
  // the user's own choice of focus (opened Details, or cleared with the chip) wins until a newer reply sets one
  const [pick, setPick] = useState<{ focus: FocusLaptop | null; after: number } | null>(null);
  const derived = deriveContext(turns);
  const focus = pick && pick.after >= derived.focusTurn ? pick.focus : (derived.focus ?? (turns.length === 0 ? store.get().focus : null));
  const shown = derived.shown;
  const ctxRef = useRef({ focus, shown }); ctxRef.current = { focus, shown };
  const busy = turns.some((t) => t.pending);

  // the last few finished turns survive a reload of the page; "Start over" clears them
  useEffect(() => { if (persistKey && !turns.some((t) => t.pending)) saveTurns(persistKey, turns); }, [turns, persistKey]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  /** Returns true when the server answered, so the caller knows whether to clear the text box. */
  const run = useCallback(async (body: Record<string, unknown>, userLabel?: string, typed = false): Promise<boolean> => {
    if (cooldown > 0) return false;
    const id = ++latest.current; ctl.current?.abort();
    const c = new AbortController(); ctl.current = c;
    // a new request replaces any failed or still-running one, so no turn can be left spinning
    setTurns((t) => [...t.filter((x) => !x.error && !x.pending), { id, user: userLabel, pending: true, body, ...(typed ? { typed: true } : {}) }]);
    const r = await send(cfg, body, { signal: c.signal });
    if (id !== latest.current) return false;                       // an older answer never replaces a newer request
    if (r.ok) { setTurns((t) => t.map((x) => (x.id === id ? { ...x, pending: false, reply: r.reply } : x))); return true; }
    if (r.error.kind === 'aborted') return false;
    if (r.error.kind === 'rate_limited') setCooldown(r.error.retryAfter);
    try { onError?.(r.error, body); } catch { /* reporting must never break the screen */ }
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, pending: false, error: r.error } : x)));
    return false;
  }, [cfg, cooldown, send, onError]);

  const lastNeeds = useCallback((): Needs | null => { for (let i = turnsRef.current.length - 1; i >= 0; i--) { const n = understoodNeeds(turnsRef.current[i].reply); if (n) return n; } return null; }, []);

  // keep the saved brief in step with what the server last said; clearing the focus never touches needs or recommendations
  useEffect(() => {
    const n = lastNeeds(); if (n && JSON.stringify(cleanNeeds(n)) !== JSON.stringify(store.get().needs)) store.set({ needs: n });
    for (let i = turns.length - 1; i >= 0; i--) { const r = recsOf(turns[i].reply); if (r) { if (JSON.stringify(r) !== JSON.stringify(store.get().recs)) store.set({ recs: r }); break; } }
  }, [turns, store, lastNeeds]);
  useEffect(() => { if (turns.length > 0 || pick) store.set({ focus }); }, [focus, turns.length, pick, store]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** Everything a request may carry about the conversation: ids and names only, never typed text. `from` is the turn list it is built from. */
  const context = useCallback((from: Turn[], fc: { focus: FocusLaptop | null; shown: FocusLaptop[] }) => {
    const sess = store.get(); let prior: Needs | null = null; for (let i = from.length - 1; i >= 0 && !prior; i--) prior = understoodNeeds(from[i].reply); prior = prior ?? (from === turnsRef.current ? sess.needs : null);
    let recs: NamedLaptop[] | null = null; for (let i = from.length - 1; i >= 0 && !recs; i--) recs = recsOf(from[i].reply); recs = recs ?? (from === turnsRef.current ? sess.recs : []);
    const h = from.filter((t) => t.user && t.reply).slice(-6).map((t) => String(t.user));
    return { ...(fc.focus ? { focus: { variant_id: fc.focus.variant_id, name: fc.focus.name } } : {}), ...(fc.shown.length ? { shown: fc.shown.map((x) => ({ variant_id: x.variant_id, name: x.name })) } : {}),
      ...(recs.length ? { recommended: recs.slice(0, MAX_RECS).map((r) => r.id) } : {}), ...(sess.picks.length ? { picked: sess.picks.slice(0, MAX_PICKS).map((p) => p.id) } : {}),
      ...(h.length ? { history: h } : {}), ...(prior ? { prior_needs: cleanNeeds(prior) } : {}) };
  }, [store]);
  const sendText = useCallback((text: string) => run({ text, ...context(turnsRef.current, ctxRef.current) }, text, true), [run, context]);
  /** Replace a sent message: drop that turn and every reply after it, then send the new text from what came before. */
  const edit = useCallback((turnId: number, text: string) => {
    const at = turnsRef.current.findIndex((t) => t.id === turnId); if (at < 0 || cooldown > 0) return Promise.resolve(false);
    const kept = turnsRef.current.slice(0, at); const dc = deriveContext(kept);
    turnsRef.current = kept; setTurns(kept); setPick(null);
    const needs = (() => { for (let i = kept.length - 1; i >= 0; i--) { const n = understoodNeeds(kept[i].reply); if (n) return n; } return null; })();
    store.set({ needs, recs: (() => { for (let i = kept.length - 1; i >= 0; i--) { const r = recsOf(kept[i].reply); if (r) return r; } return []; })(), focus: dc.focus });
    return run({ text, ...context(kept, dc) }, text, true);
  }, [run, context, store, cooldown]);
  const sendNeeds = useCallback((needs: Needs, label = 'Update my needs') => run({ needs: cleanNeeds(needs) }, label), [run]);
  const action = useCallback((body: Record<string, unknown>, label?: string) => {
    // the answer to "Which laptop?" continues the original text request, so it carries the usual context too
    const askAnswer = body.action === undefined && (body.laptop_text !== undefined || body.variant_id !== undefined);
    return run(askAnswer ? { ...context(turnsRef.current, ctxRef.current), ...body } : body, label);
  }, [run, context]);
  /**
   * Re-request one turn and REPLACE its reply in place (a re-sort, "Update results"): its question stays, no turn is added, nothing scrolls.
   * If the server cannot do it (an error, or the "Tell me what you need" choices), the old reply stays and a calm note says so.
   */
  const replaceTurn = useCallback(async (turnId: number, body: Record<string, unknown>): Promise<boolean> => {
    const old = turnsRef.current.find((t) => t.id === turnId); if (!old?.reply || cooldown > 0 || turnsRef.current.some((t) => t.pending)) return false;
    rctl.current?.abort(); const c = new AbortController(); rctl.current = c; setRefreshing(turnId);
    setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, refreshError: undefined } : x)));
    const r = await send(cfg, body, { signal: c.signal });
    if (rctl.current !== c) return false;
    rctl.current = null; setRefreshing(null);
    const usable = r.ok && r.reply.blocks.length > 0 && !(r.reply.blocks.some((b) => b.type === 'choices') && !r.reply.blocks.some((b) => b.type === 'cards'));
    if (r.ok && usable) { setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, reply: r.reply, refreshError: undefined } : x))); return true; }
    if (!r.ok) { if (r.error.kind === 'aborted') return false; if (r.error.kind === 'rate_limited') setCooldown(r.error.retryAfter); try { onError?.(r.error, body); } catch { /* reporting must never break the screen */ } }
    const why = !r.ok && r.error.kind === 'rate_limited' ? 'I need a short break before I can do that again.' : 'I could not update these results just now, so I kept them as they were. Please try again in a moment.';
    setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, refreshError: why } : x)));
    return false;
  }, [cfg, cooldown, send, onError]);
  const clear = useCallback(() => { latest.current++; ctl.current?.abort(); rctl.current?.abort(); rctl.current = null; setRefreshing(null); setTurns([]); setPick(null); store.reset(); if (persistKey) clearSaved(persistKey); }, [store, persistKey]);
  const setFocus = useCallback((f: FocusLaptop | null) => setPick({ focus: f, after: latest.current }), []);
  const clearFocus = useCallback(() => setFocus(null), [setFocus]);
  const retry = useCallback(() => { const last = [...turnsRef.current].reverse().find((t) => t.error); if (last) return run(last.body, last.user); return Promise.resolve(false); }, [run]);

  return { turns, busy, refreshing, replaceTurn, persistKey, focus, shown, setFocus, clearFocus, cooldown, sendText, sendNeeds, action, edit, clear, retry, session: store };
}
export type Thread = ReturnType<typeof useThread>;
