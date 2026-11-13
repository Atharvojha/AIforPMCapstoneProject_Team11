import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useThread } from '../state/useThread';
import { fx, cfg } from './helpers';
import type { ApiResult } from '../lib/types';

const ok = (name: string): ApiResult => ({ ok: true, reply: fx(name) });
const deferred = () => { let resolve!: (r: ApiResult) => void; const p = new Promise<ApiResult>((r) => (resolve = r)); return { p, resolve }; };

describe('useThread', () => {
  it('shows the user text, then the reply; sendText resolves true so the box can be cleared', async () => {
    const send = vi.fn(async () => ok('shortlist')); const { result } = renderHook(() => useThread(cfg, send as any));
    let done = false; await act(async () => { done = await result.current.sendText('laptop for coding under 60k'); });
    expect(done).toBe(true); expect(result.current.turns[0].user).toBe('laptop for coding under 60k'); expect(result.current.turns[0].reply?.flow).toBe('shortlist'); expect(result.current.busy).toBe(false);
  });
  it('a failure resolves false (text is kept by the caller) and keeps the error for a retry', async () => {
    const send = vi.fn().mockResolvedValueOnce({ ok: false, error: { kind: 'network', message: 'offline' } }).mockResolvedValueOnce(ok('shortlist'));
    const { result } = renderHook(() => useThread(cfg, send as any)); let r = true;
    await act(async () => { r = await result.current.sendText('x'); }); expect(r).toBe(false); expect(result.current.turns[0].error?.kind).toBe('network');
    await act(async () => { await result.current.retry(); }); expect(result.current.turns.at(-1)?.reply?.flow).toBe('shortlist'); expect(result.current.turns.some((t) => t.error)).toBe(false);
  });
  it('an older answer never replaces a newer request', async () => {
    const a = deferred(), b = deferred(); const send = vi.fn().mockReturnValueOnce(a.p).mockReturnValueOnce(b.p);
    const { result } = renderHook(() => useThread(cfg, send as any));
    act(() => { void result.current.sendText('first'); }); act(() => { void result.current.sendText('second'); });
    await act(async () => { b.resolve(ok('compare')); }); await act(async () => { a.resolve(ok('shortlist')); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.turns.find((t) => t.user === 'second')?.reply?.flow).toBe('compare'); expect(result.current.turns.find((t) => t.user === 'first')).toBeUndefined();
  });
  it('sends the understood needs and earlier messages with a follow-up', async () => {
    const send = vi.fn(async () => ok('shortlist')); const { result } = renderHook(() => useThread(cfg, send as any));
    await act(async () => { await result.current.sendText('laptop for coding under 60k'); }); await act(async () => { await result.current.sendText('make it cheaper'); });
    const body = (send.mock.calls[1] as any)[1]; expect(body.text).toBe('make it cheaper'); expect(body.history).toEqual(['laptop for coding under 60k']); expect(body.prior_needs.budget_max_inr).toBe(60000);
    expect(JSON.stringify(body.prior_needs)).not.toContain('"label"');
  });
  it('direct actions and form needs carry no text and no prior needs', async () => {
    const send = vi.fn(async () => ok('compare')); const { result } = renderHook(() => useThread(cfg, send as any));
    await act(async () => { await result.current.action({ action: 'compare', variant_ids: ['a', 'b'] }, 'Compare'); }); expect((send.mock.calls[0] as any)[1]).toEqual({ action: 'compare', variant_ids: ['a', 'b'] });
  });
  it('a rate limit starts a countdown that blocks sending, then clears', async () => {
    vi.useFakeTimers(); try {
      const send = vi.fn().mockResolvedValue({ ok: false, error: { kind: 'rate_limited', message: 'slow', retryAfter: 2 } }); const { result } = renderHook(() => useThread(cfg, send as any));
      await act(async () => { await result.current.sendText('a'); }); expect(result.current.cooldown).toBe(2);
      let sent = true; await act(async () => { sent = await result.current.sendText('b'); }); expect(sent).toBe(false); expect(send).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1000); }); expect(result.current.cooldown).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('clear empties the conversation', async () => {
    const send = vi.fn(async () => ok('help')); const { result } = renderHook(() => useThread(cfg, send as any));
    await act(async () => { await result.current.sendText('hi'); }); act(() => result.current.clear()); expect(result.current.turns).toEqual([]);
  });
});
