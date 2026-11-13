import { useCallback, useEffect, useRef, useState } from 'react';
import { sendQuery, type ApiConfig } from '../lib/api';
import type { ApiError, Needs, Reply } from '../lib/types';
import { cleanNeeds, understoodNeeds } from '../lib/needs';
import { deriveContext, type FocusLaptop } from '../lib/focus';

export interface Turn { id: number; user?: string; reply?: Reply; error?: ApiError; pending?: boolean; body: Record<string, unknown> }

/**
 * One conversation: turns, a single request at a time, answers to older requests ignored, text kept on failure,
 * a countdown when the server says "too many requests".
 */
export function useThread(cfg: ApiConfig, send = sendQuery, onError?: (error: ApiError, body: Record<string, unknown>) => void) {
  const [turns, setTurns] = useState<Turn[]>([]); const [cooldown, setCooldown] = useState(0);
  const latest = useRef(0); const ctl = useRef<AbortController | null>(null); const turnsRef = useRef<Turn[]>([]); turnsRef.current = turns;
  // the user's own choice of focus (opened Details, or cleared with the chip) wins until a newer reply sets one
  const [pick, setPick] = useState<{ focus: FocusLaptop | null; after: number } | null>(null);
  const derived = deriveContext(turns);
  const focus = pick && pick.after >= derived.focusTurn ? pick.focus : derived.focus;
  const shown = derived.shown;
  const ctxRef = useRef({ focus, shown }); ctxRef.current = { focus, shown };
  const busy = turns.some((t) => t.pending);

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  /** Returns true when the server answered, so the caller knows whether to clear the text box. */
  const run = useCallback(async (body: Record<string, unknown>, userLabel?: string): Promise<boolean> => {
    if (cooldown > 0) return false;
    const id = ++latest.current; ctl.current?.abort();
    const c = new AbortController(); ctl.current = c;
    // a new request replaces any failed or still-running one, so no turn can be left spinning
    setTurns((t) => [...t.filter((x) => !x.error && !x.pending), { id, user: userLabel, pending: true, body }]);
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
  const history = useCallback(() => turnsRef.current.filter((t) => t.user && t.reply).slice(-6).map((t) => String(t.user)), []);

  const sendText = useCallback((text: string) => {
    const prior = lastNeeds(); const h = history();
    const { focus: f, shown: sh } = ctxRef.current;   // ids and names only, never the typed text
    return run({ text, ...(f ? { focus: { variant_id: f.variant_id, name: f.name } } : {}), ...(sh.length ? { shown: sh.map((x) => ({ variant_id: x.variant_id, name: x.name })) } : {}), ...(h.length ? { history: h } : {}), ...(prior ? { prior_needs: cleanNeeds(prior) } : {}) }, text);
  }, [run, lastNeeds, history]);
  const sendNeeds = useCallback((needs: Needs, label = 'Update my needs') => run({ needs: cleanNeeds(needs) }, label), [run]);
  const action = useCallback((body: Record<string, unknown>, label?: string) => run(body, label), [run]);
  const clear = useCallback(() => { latest.current++; ctl.current?.abort(); setTurns([]); setPick(null); }, []);
  const setFocus = useCallback((f: FocusLaptop | null) => setPick({ focus: f, after: latest.current }), []);
  const clearFocus = useCallback(() => setFocus(null), [setFocus]);
  const retry = useCallback(() => { const last = [...turnsRef.current].reverse().find((t) => t.error); if (last) return run(last.body, last.user); return Promise.resolve(false); }, [run]);

  return { turns, busy, focus, shown, setFocus, clearFocus, cooldown, sendText, sendNeeds, action, clear, retry };
}
export type Thread = ReturnType<typeof useThread>;
