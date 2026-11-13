import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { reportClientError, kindOf } from '../lib/clientLog';
import { useThread } from '../state/useThread';
import { fx, okResponse, cfg } from './helpers';

const bodies = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c: any) => JSON.parse(c[1].body));
const logs = (f: ReturnType<typeof vi.fn>) => bodies(f).filter((b) => b.action === 'client_log');

describe('reporting failures only the browser can see', () => {
  let f: ReturnType<typeof vi.fn>;
  beforeEach(() => { f = vi.fn(async () => okResponse({ ...fx('help'), blocks: [{ type: 'ack' }] } as any)); vi.stubGlobal('fetch', f); });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the kind, the screen and a short message, and nothing the user typed', async () => {
    expect(reportClientError(cfg, { what: 'network', screen: 'ask', message: 'Failed to fetch', action: 'text' })).toBe(true);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1)); const b = bodies(f)[0];
    expect(b).toEqual({ action: 'client_log', client: { what: 'network', screen: 'ask', message: 'Failed to fetch', action: 'text' } }); expect(Object.keys(b)).not.toContain('text'); expect(b.client).not.toHaveProperty('text');
  });
  it('is throttled: one report per kind a minute, five a minute in total, and long messages are cut', async () => {
    const t = 1_000_000; expect(reportClientError(cfg, { what: 'network', screen: 'ask', message: 'x'.repeat(900) }, t)).toBe(true);
    expect(reportClientError(cfg, { what: 'network', screen: 'ask' }, t + 1000)).toBe(false);
    for (const k of ['timeout', 'server', 'auth', 'bad_request'] as const) expect(reportClientError(cfg, { what: k, screen: 'ask' }, t + 2000)).toBe(true);
    expect(reportClientError(cfg, { what: 'ui_crash', screen: 'ask' }, t + 3000)).toBe(false);
    expect(reportClientError(cfg, { what: 'network', screen: 'ask' }, t + 61_000)).toBe(true);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(6)); expect(bodies(f)[0].client.message.length).toBe(200);
  });
  it('a failing log call is swallowed: it never throws and never retries', async () => {
    f.mockRejectedValue(new TypeError('offline')); expect(() => reportClientError(cfg, { what: 'network', screen: 'ask' })).not.toThrow(); await new Promise((r) => setTimeout(r, 20)); expect(f).toHaveBeenCalledTimes(1);
  });
  it('a deliberate cancel and a rate limit are not reported (the server already knows about the limit)', () => {
    expect(kindOf({ kind: 'aborted', message: '' })).toBeNull(); expect(kindOf({ kind: 'rate_limited', message: '', retryAfter: 5 })).toBeNull();
    expect(kindOf({ kind: 'network', message: '' })).toBe('network'); expect(kindOf({ kind: 'server', message: '' })).toBe('server');
  });
  it('useThread tells the reporter about real failures only', async () => {
    const onError = vi.fn(); const send = vi.fn().mockResolvedValueOnce({ ok: false, error: { kind: 'network', message: 'offline' } }).mockResolvedValueOnce({ ok: false, error: { kind: 'aborted', message: '' } });
    const { result } = renderHook(() => useThread(cfg, send as any, onError));
    await act(async () => { await result.current.sendText('a'); }); await act(async () => { await result.current.sendText('b'); });
    expect(onError).toHaveBeenCalledTimes(1); expect(onError.mock.calls[0][0].kind).toBe('network');
  });
  it('a throwing reporter cannot break the screen', async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: { kind: 'network', message: 'offline' } }); const { result } = renderHook(() => useThread(cfg, send as any, () => { throw new Error('x'); }));
    await act(async () => { await result.current.sendText('a'); }); expect(result.current.turns[0].error?.kind).toBe('network');
  });
});

describe('error boundary', () => {
  it('shows a plain message with a reload button instead of a blank page, and reports the crash once', () => {
    const onCrash = vi.fn(); const Boom = () => { throw new Error('render exploded'); }; const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary screen="find" onCrash={onCrash}><Boom /></ErrorBoundary>); spy.mockRestore();
    expect(screen.getByRole('alert')).toHaveTextContent(/Something broke on this screen/); expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(onCrash).toHaveBeenCalledTimes(1); expect(onCrash).toHaveBeenCalledWith('render exploded', 'find');
  });
  it('children render normally when nothing is wrong', () => { render(<ErrorBoundary screen="ask" onCrash={() => {}}><p>fine</p></ErrorBoundary>); expect(screen.getByText('fine')).toBeInTheDocument(); });
});

describe('whole app', () => {
  let f: ReturnType<typeof vi.fn>;
  afterEach(() => vi.unstubAllGlobals());
  it('a dead connection shows a plain message, keeps the text, and reports the failure without the text', async () => {
    window.location.hash = ''; f = vi.fn(async (_u: string, init: any) => { const b = JSON.parse(init.body); if (b.action === 'client_log') return okResponse({ ...fx('help'), blocks: [{ type: 'ack' }] } as any); throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', f); vi.stubGlobal('scrollTo', vi.fn()); render(<App config={cfg} />);
    const box = screen.getByLabelText('Your message'); await userEvent.type(box, 'my secret question about a laptop{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/No connection to the server/); expect(box).toHaveValue('my secret question about a laptop');
    await waitFor(() => expect(logs(f)).toHaveLength(1)); const sent = logs(f)[0].client;
    expect(sent).toMatchObject({ what: 'network', screen: 'ask', action: 'text' }); expect(JSON.stringify(logs(f))).not.toMatch(/secret question/);
  });
  it('the About page tells people what is logged and for how long', async () => {
    window.location.hash = '#/about'; f = vi.fn(async () => okResponse(fx('help'))); vi.stubGlobal('fetch', f); render(<App config={cfg} />);
    expect(await screen.findByText(/everything you type or tap/)).toBeInTheDocument(); expect(screen.getByText(/saved as you typed it/)).toBeInTheDocument(); expect(screen.getByText(/Pictures are not saved/)).toBeInTheDocument(); expect(screen.getAllByText(/never your text/).length).toBeGreaterThan(0);
  });
});
