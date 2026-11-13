// The gate in front of everything. It runs before any model call, search call or heavy database work.
// allow: full service. degrade: rules reader only, no model, no live search. block: HTTP 429 with Retry-After.
import type { Tools } from './tools.ts';

export interface Guard { status: 200 | 413 | 429; action: 'allow' | 'degrade' | 'block' | 'too_large'; reason?: string; retry_after?: number; degraded: boolean }
export const DEFAULT_BODY_MAX = 20000;

/** A per-visitor id: a salted hash of the network address and the day. The address itself is never stored or logged. */
export async function visitorId(ip: string, salt: string, day = new Date().toISOString().slice(0, 10)): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${ip}|${day}`));
  return Array.from(new Uint8Array(buf)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function guardRequest(o: { tools: Tools; visitor: string; bodyLength: number; bodyMax?: number }): Promise<Guard> {
  if (o.bodyLength > (o.bodyMax ?? DEFAULT_BODY_MAX)) return { status: 413, action: 'too_large', reason: 'body_too_large', degraded: false };
  try {
    const d = await o.tools.call<{ action: 'allow' | 'degrade' | 'block'; reason?: string; retry_after?: number }>('rate_gate', { visitor: o.visitor });
    if (d.action === 'block') return { status: 429, action: 'block', reason: d.reason, retry_after: d.retry_after ?? 60, degraded: true };
    if (d.action === 'degrade') return { status: 200, action: 'degrade', reason: d.reason, degraded: true };
    return { status: 200, action: 'allow', degraded: false };
  } catch {
    // If the limiter itself fails, stay available but spend nothing: rules reader only.
    return { status: 200, action: 'degrade', reason: 'limiter_unavailable', degraded: true };
  }
}

export const DEGRADED_NOTICE: Record<string, string> = {
  heavy_use: 'You have sent a lot of requests this hour, so I am using the simpler reader without live web results for now.',
  daily_budget: 'LapFit has reached its daily budget for the smart reader, so I am using the simpler reader without live web results until tomorrow.',
  limiter_unavailable: 'I am running in a simpler mode right now (no live web results).',
};
export const BLOCK_MESSAGE = (retry: number) => `You are sending requests too quickly. Please wait ${retry} second${retry === 1 ? '' : 's'} and try again.`;
