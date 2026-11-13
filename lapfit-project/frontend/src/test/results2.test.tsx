import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockView } from '../components/blocks/BlockView';
import { CtxContext, noopCtx, type Ctx } from '../components/ctx';
import { parseCustom, heroEyebrow } from '../components/blocks/BoardLogic';
import { fx, cfg } from './helpers';
import { ApiConfigContext } from '../components/api-context';
import type { Block } from '../lib/types';

const show = (b: Block, ctx: Partial<Ctx> = {}) => render(<CtxContext.Provider value={{ ...noopCtx, ...ctx }}><BlockView block={b} /></CtxContext.Provider>);
const cards = () => fx('shortlist').blocks.find((x) => x.type === 'cards')!;
const sorts = [{ key: 'best', label: 'Best fit' }, { key: 'budget', label: 'Closest to budget' }, { key: 'price_low', label: 'Lowest price' }, { key: 'light', label: 'Lightest' }, { key: 'reviews', label: 'Most reviewed' }];
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('sort', () => {
  it('shows the sort line, its note and the budget note, and a chosen sort is re-sent with the needs', async () => {
    const resort = vi.fn(); const needs = { budget_max_inr: 60000 };
    show({ ...cards(), needs, sort: { key: 'best', label: 'Best fit', note: 'Ordered by how well each laptop meets your needs.' }, sorts, budget_note: 'Everything in the catalog costs less than your budget.' }, { resort });
    expect(screen.getByText('Sorted by: Best fit')).toBeInTheDocument(); expect(screen.getByText(/Ordered by how well/)).toBeInTheDocument(); expect(screen.getByText(/costs less than your budget/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Best fit' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Lowest price' }));
    expect(resort).toHaveBeenCalledWith({ needs, sort: 'price_low' }, expect.stringMatching(/lowest price/i));
  });
  it('falls back to the saved needs when the block carries none', async () => {
    const resort = vi.fn(); show({ ...cards(), needs: undefined, sort: { key: 'best', label: 'Best fit', note: '' }, sorts }, { resort, savedNeeds: () => ({ budget_max_inr: 50000 }) } as any);
    await userEvent.click(screen.getByRole('button', { name: 'Lightest' })); expect(resort).toHaveBeenCalledWith({ needs: { budget_max_inr: 50000 }, sort: 'light' }, expect.any(String));
  });
  it('claims "Best fit" only when sorted by best fit', () => {
    expect(heroEyebrow({ key: 'best', label: 'Best fit' }, true)).toBe('Best fit for what you said');
    expect(heroEyebrow({ key: 'price_low', label: 'Lowest price' }, true)).toBe('First by lowest price');
    show({ ...cards(), sort: { key: 'price_low', label: 'Lowest price', note: 'Cheapest first.' }, sorts });
    expect(screen.queryByText('Best fit for what you said')).toBeNull(); expect(screen.getByText('First by lowest price')).toBeInTheDocument();
  });
});

describe('own laptop', () => {
  it('validates: name required, numbers typed with bounds, blank stays unknown', () => {
    expect(parseCustom({ name: '' })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    expect(parseCustom({ name: 'X', ram_gb: 'lots', weight_kg: '9' })).toMatchObject({ ok: false, errors: { ram_gb: expect.any(String), weight_kg: expect.any(String) } });
    expect(parseCustom({ name: ' My Pavilion ', price_inr: '45,000', ram_gb: '16', cpu: 'i5' })).toEqual({ ok: true, laptop: { name: 'My Pavilion', price_inr: 45000, ram_gb: 16, cpu: 'i5' } });
  });
  const cmp = () => { const b = fx('compare').blocks.find((x) => x.type === 'compare')!; return { ...b, laptops: b.laptops.slice(0, 2), evidence: b.evidence.slice(0, 2), rows: b.rows.map((r: any) => ({ ...r, values: r.values.slice(0, 2), best: r.best != null && r.best < 2 ? r.best : null })) } as Block; };
  it('compare sheet: add my laptop re-sends compare with custom and the real ids; the form shows errors', async () => {
    localStorage.setItem('lapfit.owned.v1', JSON.stringify([{ id: 'o1', variant_id: 'v', name: 'HP Pavilion 14 · 8 GB', purchase_date: '2022-01-01', price_paid: null }]));
    const action = vi.fn(); const b = cmp(); show(b, { action });
    await userEvent.click(screen.getByRole('button', { name: /add my laptop/i }));
    await userEvent.click(screen.getByRole('button', { name: /compare with my laptop/i })); expect(await screen.findByText('Give your laptop a name.')).toBeInTheDocument(); expect(action).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'HP Pavilion 14' })); expect(screen.getByLabelText(/^Name/)).toHaveValue('HP Pavilion 14 · 8 GB');
    await userEvent.type(screen.getByLabelText(/^RAM/), '16'); await userEvent.click(screen.getByRole('button', { name: /compare with my laptop/i }));
    expect(action).toHaveBeenCalledWith({ action: 'compare', variant_ids: b.laptops.map((l: any) => l.variant_id), custom: [{ name: 'HP Pavilion 14 · 8 GB', ram_gb: 16 }] }, expect.any(String));
  });
  it('custom column is labelled, has no photo and no owner opinions; add is disabled at 3 columns', () => {
    const b = fx('compare').blocks.find((x) => x.type === 'compare')!; const laptops = [...b.laptops.slice(0, 2), { name: 'Mine', custom: true, data_status: 'As entered' }];
    const rows = b.rows.map((r: any) => ({ ...r, values: [...r.values.slice(0, 2), '?'] }));
    show({ ...b, laptops, rows, evidence: b.evidence.slice(0, 2) } as Block);
    expect(screen.getByText('(yours, as you entered)')).toBeInTheDocument(); expect(screen.getByText('no opinions for your own laptop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add my laptop/i })).toBeDisabled();
  });
});

describe('web_laptop', () => {
  const b = () => fx('web_laptop').blocks[0];
  it('renders the title, only present fields with the unverified mark, https links only', () => {
    show(b());
    expect(screen.getByRole('heading', { name: /not in my catalog. Here is what the web says/ })).toBeInTheDocument();
    expect(screen.getAllByText('from the web, not verified')).toHaveLength(5); expect(screen.queryByText('Weight')).toBeNull(); expect(screen.queryByText('Battery')).toBeNull();
    expect(screen.getByText(/Not verified, may be wrong/)).toBeInTheDocument(); expect(screen.getByText('Live, not verified')).toBeInTheDocument();
    const links = screen.getAllByRole('link'); expect(links).toHaveLength(1); expect(links[0]).toHaveAttribute('href', 'https://example.com/acer-aspire-lite-14');
  });
  it('compare with it posts a compare with custom built from the fields', async () => {
    const action = vi.fn(); show(b(), { action, compare: { ids: ['A', 'B'], has: () => true, toggle() {} } });
    await userEvent.click(screen.getByRole('button', { name: 'Compare with it' }));
    expect(action).toHaveBeenCalledWith({ action: 'compare', variant_ids: ['A', 'B'], custom: [{ name: 'Acer Aspire Lite 14 AL14-71M', price_inr: 38990, ram_gb: 16, storage_gb: 512, display_size: 14, cpu: 'Intel Core i5-12450H' }] }, expect.any(String));
  });
  it('status notes for off, limit, error and empty; no compare button when it cannot', () => {
    for (const status of ['off', 'limit', 'error', 'empty']) { const { unmount } = show({ ...b(), status, fields: {}, items: [], can_compare: false }); expect(within(screen.getByRole('status')).getByText(/./)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Compare with it' })).toBeNull(); unmount(); }
  });
});

describe('match percentage', () => {
  it('shows a % match on the best fit and on each row, with the reasons one tap away and the not-a-promise note', async () => {
    const b = JSON.parse(JSON.stringify(fx('shortlist').blocks.find((x: any) => x.type === 'cards'))); const pcts = [90, 60, 58, 40, 35];
    b.cards.forEach((c: any, i: number) => { c.match = { pct: pcts[i], label: `${pcts[i]}% match`, basis: ['Meets all 1 of your Must', `Capability for study: ${pcts[i]} of 100`, 'Not recorded, so not counted: weight'] }; });
    render(<ApiConfigContext.Provider value={cfg}><CtxContext.Provider value={noopCtx}><BlockView block={b} /></CtxContext.Provider></ApiConfigContext.Provider>);
    const hero = document.querySelector('.bhero') as HTMLElement; expect(within(hero).getByText('90% match')).toBeInTheDocument(); expect(document.querySelectorAll('.brow .match-pill').length).toBeGreaterThanOrEqual(2); expect(screen.getAllByText('60% match').length).toBeGreaterThanOrEqual(1);
    await userEvent.click(within(hero).getByText('Why 90%?')); expect(within(hero).getByText(/Capability for study: 90 of 100/)).toBeInTheDocument(); expect(within(hero).getByText(/not a promise/)).toBeInTheDocument();
  });
});

