import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import App from '../App';
import { AskScreen } from '../screens/AskScreen';
import { BottomSheet } from '../components/BottomSheet';
import { BlockView } from '../components/blocks/BlockView';
import { CtxContext, noopCtx } from '../components/ctx';
import { CatalogProvider } from '../state/useCatalog';
import { useThread } from '../state/useThread';
import { createSessionStore } from '../lib/session';
import { saveTurns, loadTurns, MAX_SAVED_TURNS } from '../lib/persist';
import { applyFilters, emptyFilters, optionCount, explainZero, leftOutUnknown, type Row } from '../lib/explore';
import { fx, okResponse, cfg } from './helpers';

const row = (id: string, brand: string, name: string, price: number, extra: Record<string, unknown> = {}): Row => ({ variant_id: id, model_id: 1, name: `${name} · ${id}`, brand, price_inr: price, ram_gb: 16, storage_gb: 512, recommendable: true, display_size: 14, weight_kg: 1.5, gpu_class: 'integrated', market: 'IN', ...extra }) as Row;
const ROWS: Row[] = [row('A1', 'Apple', 'MacBook Air M1', 69990, { weight_kg: 1.29, display_size: 13.3 }), row('D1', 'Dell', 'Dell Inspiron', 45000, { weight_kg: 1.8 }), row('D2', 'Dell', 'Dell XPS', 90000, { weight_kg: 1.2 }), row('H1', 'HP', 'HP Pavilion', 35000, { weight_kg: null }), row('L1', 'Lenovo', 'Lenovo Gamer', 85000, { weight_kg: 2.4, gpu_class: 'dedicated', display_size: 15.6 })];
const catalogReply = (rows: Row[] = ROWS) => ({ ...fx('catalog'), blocks: [{ type: 'catalog', rows }] });

describe('filters (plain logic)', () => {
  it('Apple and under 1.5 kg shows the MacBook (1.29 kg): 1 laptop', () => {
    const f = { ...emptyFilters(), brands: ['Apple'], weight: '1.5' }; expect(applyFilters(ROWS, f).map((r) => r.variant_id)).toEqual(['A1']);
  });
  it('an unknown weight is never dropped silently: it is counted, and included only when asked', () => {
    const f = { ...emptyFilters(), weight: '1.5' }; expect(applyFilters(ROWS, f).map((r) => r.variant_id)).toEqual(['A1', 'D2']);
    expect(leftOutUnknown(ROWS, f)).toEqual([{ dim: 'weight', n: 1, what: 'weight' }]);
    expect(applyFilters(ROWS, { ...f, unk: ['weight'] }).map((r) => r.variant_id)).toEqual(['A1', 'D2', 'H1']);
  });
  it('each option shows how many laptops it would leave, given the other filters', () => {
    const f = { ...emptyFilters(), brands: ['Dell'] };
    expect(optionCount(ROWS, f, 'weight', '1.5')).toBe(1); expect(optionCount(ROWS, f, 'weight', '1.3')).toBe(1); expect(optionCount(ROWS, f, 'weight', '2')).toBe(2);
    expect(optionCount(ROWS, f, 'brand', 'Apple')).toBe(1);   // a brand option ignores the brand filter itself
    expect(optionCount(ROWS, { ...f, budget: 30000 }, 'ram', '16')).toBe(0);
  });
  it('the zero result names the blocking filter and the one change that fixes it', () => {
    const f = { ...emptyFilters(), brands: ['Apple'], budget: 30000 }; const z = explainZero(ROWS, f);
    expect(z.text).toBe('No Apple laptop costs up to ₹30,000.'); expect(z.dim).toBe('price'); expect(z.fix).toBe('Remove the price limit'); expect(z.count).toBe(1);
  });
});

describe('Explore screen', () => {
  let calls: any[] = []; let rowsNow = ROWS;
  beforeEach(() => { calls = []; rowsNow = ROWS; sessionStorage.clear(); localStorage.clear(); window.location.hash = '#/explore';
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { const b = JSON.parse(init.body); if (b.action !== 'data_status') calls.push(b); if (b.action === 'catalog') return okResponse(catalogReply(rowsNow) as any); if (b.action === 'web_search_laptops') return okResponse(fx('web_picks')); return okResponse(fx('data_status')); })); });
  afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });
  const open = async (name: RegExp) => { await userEvent.click(screen.getByRole('button', { name })); };
  const count = () => screen.getByText(/of \d+ laptops/).textContent;

  it('Apple + Light to carry (under 1.5 kg) shows 1 of 5, the MacBook', async () => {
    render(<App config={cfg} />); await screen.findByText('5 of 5 laptops');
    await open(/^Brand/); await userEvent.click(screen.getByRole('button', { name: /^Apple\s*1/ }));
    await open(/^Weight/); await userEvent.click(screen.getByRole('button', { name: /^Light to carry \(under 1\.5 kg\)\s*1/ }));
    expect(count()).toBe('1 of 5 laptops'); expect(document.querySelectorAll('.bcard')).toHaveLength(1); expect(screen.getByRole('heading', { name: 'MacBook Air M1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter: Apple' })).toBeInTheDocument();
  });
  it('a list saved by an older build (no weight) is not trusted: it is fetched again', async () => {
    sessionStorage.setItem('lapfit.catalog.v2', JSON.stringify(ROWS.map(({ weight_kg, display_size, ...r }) => r))); sessionStorage.setItem('lapfit.catalog', JSON.stringify([{ variant_id: 'old' }]));
    render(<App config={cfg} />); await screen.findByText('5 of 5 laptops'); expect(calls.filter((c) => c.action === 'catalog')).toHaveLength(1);
    expect(sessionStorage.getItem('lapfit.catalog')).toBeNull(); expect(JSON.parse(sessionStorage.getItem('lapfit.catalog.v2')!)[0]).toHaveProperty('weight_kg');
  });
  it('a fresh saved list is used without asking the server again', async () => {
    sessionStorage.setItem('lapfit.catalog.v2', JSON.stringify(ROWS)); render(<App config={cfg} />); await screen.findByText('5 of 5 laptops'); expect(calls.filter((c) => c.action === 'catalog')).toHaveLength(0);
  });
  it('options with no result are disabled; the zero state names the blocker and one tap removes it', async () => {
    render(<App config={cfg} />); await screen.findByText('5 of 5 laptops');
    await open(/^Brand/); await userEvent.click(screen.getByRole('button', { name: /^Apple\s*1/ }));
    await open(/^Price/); await userEvent.type(screen.getByLabelText('Up to (₹)'), '30000');
    expect(await screen.findByText('No Apple laptop costs up to ₹30,000.')).toBeInTheDocument(); expect(count()).toBe('0 of 5 laptops'); expect(screen.getByText(/to see 1\./)).toBeInTheDocument();
    await open(/^Weight/); expect(screen.getByRole('button', { name: /^Ultra-light/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove the price limit' })); expect(count()).toBe('1 of 5 laptops'); expect(screen.queryByText(/No Apple laptop/)).toBeNull();
  });
  it('laptops with no recorded weight are told about, and can be included', async () => {
    render(<App config={cfg} />); await screen.findByText('5 of 5 laptops'); await open(/^Weight/); await userEvent.click(screen.getByRole('button', { name: /^Light to carry/ }));
    expect(count()).toBe('2 of 5 laptops'); const note = screen.getByText(/no recorded weight, so it is left out/); await userEvent.click(within(note.closest('p')!).getByRole('button', { name: 'Include it' }));
    expect(count()).toBe('3 of 5 laptops'); expect(screen.getByText(/^weight not recorded/)).toBeInTheDocument();
  });
  it('typing searches name, brand and spec; Escape closes a filter panel; Clear all resets', async () => {
    render(<App config={cfg} />); await screen.findByText('5 of 5 laptops'); await userEvent.type(screen.getByLabelText('Search by name, brand or spec'), 'dell xps'); expect(count()).toBe('1 of 5 laptops');
    await open(/^Brand/); expect(screen.getByRole('button', { name: /^Brand/ })).toHaveAttribute('aria-expanded', 'true'); await userEvent.keyboard('{Escape}'); expect(screen.getByRole('button', { name: /^Brand/ })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' })); expect(count()).toBe('5 of 5 laptops');
  });
  it('"Search the web too" sends web_search_laptops and shows the picks, not verified', async () => {
    render(<App config={cfg} />); await screen.findByText('5 of 5 laptops'); const btn = screen.getByRole('button', { name: 'Search the web too' }); expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Search by name, brand or spec'), 'thin light laptop'); await userEvent.click(btn);
    await waitFor(() => expect(calls.find((c) => c.action === 'web_search_laptops')).toMatchObject({ query: 'thin light laptop' }));
    expect(await screen.findByText(/not in my catalog, not verified/)).toBeInTheDocument();
  });
});

describe('web picks block', () => {
  const block = () => fx('web_picks').blocks[0];
  const show = (b: any, ctx: any = {}) => render(<CtxContext.Provider value={{ ...noopCtx, ...ctx }}><BlockView block={b} /></CtxContext.Provider>);
  it('shows the labels, the stated price, "?" for missing specs, and links only for https', () => {
    show(block()); expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('More from the live web (not in my catalog, not verified)');
    expect(screen.getByText('₹68,990 (as stated by the page)')).toBeInTheDocument(); expect(screen.getByText('price not stated')).toBeInTheDocument();
    expect(screen.getByText(/Read from web pages by an AI model/)).toBeInTheDocument(); expect(screen.getAllByText(/\? storage/).length).toBe(1);
    const links = screen.getAllByRole('link'); expect(links).toHaveLength(1); expect(links[0]).toHaveAttribute('href', 'https://www.example-shop.in/lenovo-ideapad-slim-5'); expect(links[0]).toHaveAttribute('target', '_blank'); expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/Source: insecure\.example\.com/)).toBeInTheDocument();
  });
  it('quiet notes for off, limit, error and empty; no cards then', () => {
    for (const [status, re] of [['off', /switched off/], ['limit', /paused for today/], ['error', /did not work just now/], ['empty', /had nothing I could read/]] as const) { const { unmount } = show({ ...block(), status, items: [] }); expect(screen.getByRole('status')).toHaveTextContent(re); expect(screen.queryByRole('list')).toBeNull(); unmount(); }
  });
  it('"Compare with it" sends a compare with a custom laptop built from the item', async () => {
    const action = vi.fn(); show(block(), { action, compare: { ids: ['A1'], has: () => true, toggle() {} } }); await userEvent.click(screen.getAllByRole('button', { name: 'Compare with it' })[0]);
    expect(action).toHaveBeenCalledWith({ action: 'compare', variant_ids: ['A1'], custom: [{ name: 'Lenovo IdeaPad Slim 5 14', price_inr: 68990, ram_gb: 16, storage_gb: 512, display_size: 14, weight_kg: 1.46, cpu: 'Ryzen 7 7730U' }] }, 'Compare with Lenovo IdeaPad Slim 5 14');
  });
  it('Compare is off until a catalog laptop is picked', () => { show(block()); expect(screen.getAllByRole('button', { name: 'Compare with it' })[0]).toBeDisabled(); });
});

describe('sort and refine in place', () => {
  const picks = { ids: [] as string[], names: {}, has: () => false, toggle() {}, remove() {}, clear() {} };
  const mount = (send: any, persist?: string) => { const Host = () => { const thread = useThread(cfg, send, undefined, createSessionStore(false), persist); return <AskScreen thread={thread} compare={picks} goto={() => {}} />; }; return render(<CatalogProvider cfg={cfg}><Host /></CatalogProvider>); };
  const ask = async () => { await userEvent.type(screen.getByLabelText('Your message'), 'laptop for coding under 60k{Enter}'); await screen.findByRole('group', { name: 'Sort these laptops by' }); };
  beforeEach(() => { sessionStorage.clear(); });
  it('a sort replaces the reply, adds no turn and no user bubble, and sends needs with sort', async () => {
    const sorted = fx('sorted_cards'); const send: any = vi.fn(async (_c: any, body: any) => ({ ok: true as const, reply: body.sort ? { ...sorted, blocks: sorted.blocks.map((b: any) => (b.type === 'cards' ? { ...b, sort: { key: 'light', label: 'Lightest', note: 'Lightest first.' } } : b)) } : sorted }));
    mount(send); await ask(); expect(document.querySelectorAll('.turn')).toHaveLength(1); expect(document.querySelectorAll('.user-bubble')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Lightest' }));
    await waitFor(() => expect(screen.getByText('Sorted by: Lightest')).toBeInTheDocument());
    const body = send.mock.calls[1][1]; expect(body.sort).toBe('light'); expect(body.needs).toBeTruthy(); expect(body.text).toBeUndefined();
    expect(document.querySelectorAll('.turn')).toHaveLength(1); expect(document.querySelectorAll('.user-bubble')).toHaveLength(1); expect(screen.queryByText(/^Sort by/)).toBeNull();
  });
  it('a failed sort keeps the old reply and says so calmly; so does the "Tell me what you need" answer', async () => {
    for (const second of [{ ok: false as const, error: { kind: 'server' as const, message: 'boom' } }, { ok: true as const, reply: fx('clarify') }]) {
      const send: any = vi.fn().mockResolvedValueOnce({ ok: true, reply: fx('sorted_cards') }).mockResolvedValueOnce(second);
      const { unmount } = mount(send); await ask(); await userEvent.click(screen.getByRole('button', { name: 'Lightest' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/kept them as they were/); expect(screen.getByText(/Sorted by:/)).toBeInTheDocument(); expect(document.querySelectorAll('.turn')).toHaveLength(1); unmount();
    }
  });
  it('the chips are busy while a sort runs and the reply is marked updating', async () => {
    let release: (v: any) => void = () => {}; const send: any = vi.fn().mockResolvedValueOnce({ ok: true, reply: fx('sorted_cards') }).mockImplementationOnce(() => new Promise((r) => { release = r; }));
    mount(send); await ask(); await userEvent.click(screen.getByRole('button', { name: 'Lightest' })); expect(await screen.findByText('Updating these results…')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Lowest price' })).toBeDisabled();
    await act(async () => { release({ ok: true, reply: fx('sorted_cards') }); }); await waitFor(() => expect(screen.queryByText('Updating these results…')).toBeNull());
  });
  it('the thread saves its last turns and a fresh mount restores them; Start over clears them', async () => {
    const send: any = vi.fn(async () => ({ ok: true as const, reply: fx('sorted_cards') })); const { unmount } = mount(send, 'ask'); await ask(); unmount();
    mount(send, 'ask'); expect(await screen.findByText('laptop for coding under 60k')).toBeInTheDocument(); expect(screen.getByRole('group', { name: 'Sort these laptops by' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /New search/ })); expect(loadTurns('ask')).toEqual([]);
  });
  it('saves at most 6 turns and only finished ones', () => {
    const turns = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, user: `q${i}`, reply: fx('help'), body: {} })); saveTurns('t', [...turns, { id: 99, pending: true, body: {} }]);
    const back = loadTurns('t'); expect(back).toHaveLength(MAX_SAVED_TURNS); expect(back[5].user).toBe('q8'); expect(back.some((t) => t.id === 99)).toBe(false);
  });
  it('useThread.replaceTurn leaves the other turns alone', async () => {
    const send: any = vi.fn(async () => ({ ok: true as const, reply: fx('sorted_cards') })); const { result } = renderHook(() => useThread(cfg, send, undefined, createSessionStore(false)));
    await act(async () => { await result.current.sendText('one'); }); await act(async () => { await result.current.sendText('two'); }); const first = result.current.turns[0].id;
    await act(async () => { await result.current.replaceTurn(first, { sort: 'x' }); }); expect(result.current.turns).toHaveLength(2); expect(result.current.turns.map((t) => t.user)).toEqual(['one', 'two']);
  });
});

describe('BottomSheet focus', () => {
  it('a parent re-render with a new onClose does not move focus back to the opener', async () => {
    const Host = () => { const [n, setN] = useState(0); return <><button>opener</button><button onClick={() => setN(n + 1)}>rerender {n}</button><BottomSheet open onClose={() => setN(-1)} title="Details"><button>inside</button></BottomSheet></>; };
    render(<Host />); await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)); const opener = screen.getByRole('button', { name: 'opener' }); const spy = vi.spyOn(opener, 'focus');
    await userEvent.click(screen.getByRole('button', { name: /rerender/ })); await userEvent.click(screen.getByRole('button', { name: /rerender/ })); await new Promise((r) => setTimeout(r, 60));
    expect(spy).not.toHaveBeenCalled(); expect(document.activeElement).not.toBe(opener);
  });
  it('Escape still closes, through the latest onClose', async () => {
    const onClose = vi.fn(); const { rerender } = render(<BottomSheet open onClose={() => {}} title="D"><p>x</p></BottomSheet>); rerender(<BottomSheet open onClose={onClose} title="D"><p>x</p></BottomSheet>); await userEvent.keyboard('{Escape}'); expect(onClose).toHaveBeenCalledTimes(1);
  });
});
