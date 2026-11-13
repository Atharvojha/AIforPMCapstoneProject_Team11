import { sendQuery, type ApiConfig } from './api';
import type { ApiError } from './types';

export type ClientKind = 'network' | 'timeout' | 'server' | 'auth' | 'bad_request' | 'too_large' | 'ui_crash';
const last = new Map<string, number>(); let windowStart = 0; let inWindow = 0;
/** For tests: forget what was sent. */
export const resetClientLog = () => { last.clear(); windowStart = 0; inWindow = 0; };

/**
 * Tell the server about a failure that only this browser can see (the request never arrived, timed out, or a screen crashed).
 * Fire and forget: never throws, never retries, never blocks the user, and never includes anything the user typed.
 * At most one report per kind per minute and five a minute overall, so a broken connection cannot create a storm.
 */
export function reportClientError(cfg: ApiConfig, e: { what: ClientKind; screen: string; message?: string; status?: number; action?: string }, now = Date.now()): boolean {
  if (now - windowStart > 60_000) { windowStart = now; inWindow = 0; }
  if (inWindow >= 5 || now - (last.get(e.what) ?? 0) < 60_000) return false;
  last.set(e.what, now); inWindow++;
  void sendQuery(cfg, { action: 'client_log', client: { what: e.what, screen: e.screen.slice(0, 40), message: (e.message ?? '').slice(0, 200), status: e.status, action: (e.action ?? '').slice(0, 40) } }, { timeoutMs: 8000 }).catch(() => {});
  return true;
}

/** Which errors are worth reporting: not a deliberate cancel, and not the rate limit (the server already logged that). */
export function kindOf(error: ApiError): ClientKind | null {
  return error.kind === 'aborted' || error.kind === 'rate_limited' ? null : (error.kind as ClientKind);
}

/** Count that someone opened a shop link (no identity; the server hashes the visitor). Fire and forget. */
export function reportClick(cfg: ApiConfig, o: { retailer: string; variantId?: string; from?: string }): void {
  void sendQuery(cfg, { action: 'outbound_click', retailer: o.retailer, variant_id: o.variantId, from: o.from }, { timeoutMs: 6000 }).catch(() => {});
}
