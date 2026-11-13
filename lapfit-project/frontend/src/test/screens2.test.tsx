import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { NumberField } from '../components/NumberField';
import { BlockView } from '../components/blocks/BlockView';
import { CtxContext, noopCtx } from '../components/ctx';
import { dateProblem, minPurchaseDate, maxAgeYears, endedBeforeLaunch } from '../lib/launch';
import { fx, okResponse, cfg } from './helpers';
import type { Block } from '../lib/types';
import { useState } from 'react';

let calls: any[] = []; let handler: (b: any) => Response = () => okResponse(fx('help'));
// the catalog with the new fields: two US rows, launch years on some India rows
const catalog = () => { const r = fx('catalog'); return { ...r, blocks: r.blocks.map((b) => b.type !== 'catalog' ? b : { ...b, rows: b.rows.map((x: any, i: number) => ({ ...x, market: x.variant_id.startsWith('AMZ') ? 'US' : 'IN', launch_year: x.variant_id === 'FKL-10' ? 2020 : i % 2 ? 2023 : null })) }) } as any; };
const route = (body: any): Response => {
  if (body.action === 'data_status') return okResponse(fx('data_status')); if (body.action === 'catalog') return okResponse(catalog());
  if (body.action === 'sell_plan') return okResponse(fx('sell')); if (body.action === 'used_check') return okResponse(fx('used')); if (body.action === 'compare') return okResponse(fx('compare')); if (body.owned) return okResponse(fx('mylaptops'));
  return okResponse(fx('shortlist'));
};
beforeEach(() => { calls = []; sessionStorage.clear(); localStorage.clear(); handler = route; window.location.hash = ''; vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { const body = JSON.parse(init.body); if (body.action !== 'data_status') calls.push(body); return handler(body); })); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });
const mount = () => render(<App config={cfg} />);
const goto = async (name: RegExp) => { await userEvent.click(screen.getAllByRole('link', { name })[0]); };
const sent = (p: (b: any) => boolean) => calls.filter(p);
const opt = async (label: RegExp | string, text: string) => { const box = await screen.findByRole('combobox', { name: label }); await waitFor(() => expect(sessionStorage.getItem('lapfit.catalog.v2')).toBeTruthy()); await userEvent.clear(box); await userEvent.type(box, text); return box; };

describe('typed number fields', () => {
  it('typing sends the number, out-of-range shows a hint, and the buttons nudge by the step', async () => {
    const seen: (number | null)[] = []; const Host = () => { const [v, setV] = useState<number | null>(80); return <NumberField label="Battery health" unit="%" value={v} min={30} max={100} onChange={(n) => { seen.push(n); setV(n); }} />; };
    render(<Host />); const f = screen.getByLabelText('Battery health'); await userEvent.clear(f); await userEvent.type(f, '72'); expect(seen.at(-1)).toBe(72);
    await userEvent.clear(f); await userEvent.type(f, '500'); expect(await screen.findByRole('alert')).toHaveTextContent(/30 to 100/); expect(seen.at(-1)).not.toBe(500); fireEvent.blur(f); expect(f).toHaveValue(100);
    await userEvent.click(screen.getByRole('button', { name: /Less: Battery health/ })); expect(f).toHaveValue(99);
  });
});

describe('laptop combobox', () => {
  it('filters the catalog as you type, hides US rows where India only (Sell), and takes any typed name', async () => {
    mount(); await goto(/Sell$/); const box = await opt('Laptop name', 'macbook'); const list = await screen.findAllByRole('option'); expect(list.length).toBeGreaterThan(0); for (const o of list) expect(o.textContent!.toLowerCase()).toContain('macbook');
    await userEvent.clear(box); await userEvent.type(box, 'Amazon US'); expect(screen.queryAllByRole('option').filter((o) => /\(Amazon US\)/.test(o.textContent ?? ''))).toHaveLength(0);
    await userEvent.clear(box); await userEvent.type(box, 'Zorblax 9000'); expect(screen.queryAllByRole('option')).toHaveLength(0); expect(screen.getByText(/Not in the catalog: I’ll look it up/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });
});

describe('Check layout and the ask_laptop flow', () => {
  it('three numbered steps in order, the known-details section BELOW the text box (collapsed until opened), and one primary button', async () => {
    mount(); await goto(/Check$/); const heads = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
    expect(heads[0]).toMatch(/Add the listing/); expect(heads[1]).toMatch(/Which laptop\?/); expect(heads[2]).toMatch(/Anything you already know/);
    const box = screen.getByLabelText('What the seller said'); const more = screen.getByRole('button', { name: /Add what you know/ }); expect(box.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); expect(screen.queryByLabelText('Asking price')).toBeNull();
    await userEvent.click(more); const price = screen.getByLabelText('Asking price'); expect(box.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); for (const l of ['Age', 'Battery health']) expect(screen.getByLabelText(l)).toBeInTheDocument(); expect(screen.getByRole('group', { name: 'Warranty' })).toBeInTheDocument(); expect(screen.getByRole('group', { name: 'Original bill' })).toBeInTheDocument(); expect(screen.getByRole('group', { name: 'Original box' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Check it' })).toHaveLength(1);
  });
  it('typed laptop + known details become one used_check request; an ask_laptop reply shows under the input and answering re-sends the original request without a second text box', async () => {
    handler = (b) => b.action === 'used_check' && !b.variant_id && !b.laptop_text ? okResponse({ ...fx('used'), blocks: [{ type: 'ask_laptop', question: 'Which laptop is this?', base: { action: 'used_check', listing: { price_inr: 40000 } }, choices: [{ variant_id: 'FKL-10', label: 'Macbook Air M1, 8 GB / 256 GB, ₹86,990' }], placeholder: 'Type its name' }] } as any) : route(b);
    mount(); await goto(/Check$/); await userEvent.click(await screen.findByRole('button', { name: /Add what you know/ })); await userEvent.type(screen.getByLabelText('Asking price'), '40000'); fireEvent.change(screen.getByLabelText('Battery health'), { target: { value: '65' } });
    within(screen.getByRole('group', { name: 'Original bill' })).getByRole('button', { name: 'No' }).click(); await userEvent.click(screen.getByRole('button', { name: 'Check it' }));
    await waitFor(() => expect(sent((b) => b.action === 'used_check')).toHaveLength(1)); expect(sent((b) => b.action === 'used_check')[0]).toMatchObject({ listing: { price_inr: 40000, battery_health_pct: 65, has_bill: false } });
    expect(await screen.findByText('Which laptop is this?')).toBeInTheDocument(); expect(document.querySelectorAll('textarea')).toHaveLength(1);
    await userEvent.type(screen.getByLabelText(/Type the laptop’s name/), 'Macbook Air M1{Enter}'); await waitFor(() => expect(sent((b) => b.action === 'used_check')).toHaveLength(2)); expect(sent((b) => b.action === 'used_check')[1]).toMatchObject({ laptop_text: 'Macbook Air M1', listing: { price_inr: 40000 } });
  });
  it('a typed laptop name goes as laptop_text', async () => {
    mount(); await goto(/Check$/); await opt('Laptop name', 'Zorblax 9000'); await userEvent.click(screen.getByRole('button', { name: 'Check it' })); await waitFor(() => expect(sent((b) => b.action === 'used_check')).toHaveLength(1)); expect(sent((b) => b.action === 'used_check')[0].laptop_text).toBe('Zorblax 9000');
  });
});

describe('Sell steps', () => {
  it('age is its own step (typed, capped by the launch year) and condition is four described choices with no emoji; the request follows the contract', async () => {
    mount(); await goto(/Sell$/); await opt('Laptop name', 'Macbook Air'); await userEvent.click((await screen.findAllByRole('option')).find((o) => /APPLE 2020 Macbook Air M1/.test(o.textContent!))!); await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Question 2 of 4/)).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'How old is it?' })).toBeInTheDocument(); const age = screen.getByLabelText('Age in years'); await userEvent.clear(age); await userEvent.type(age, '4'); expect(age).toHaveValue(4); expect(age).toHaveAttribute('max', String(new Date().getFullYear() - 2020 + 1)); await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'What shape is it in?' })).toBeInTheDocument(); const radios = screen.getAllByRole('radio'); expect(radios).toHaveLength(4); expect(radios.map((r) => r.querySelector('strong')!.textContent)).toEqual(['Like new', 'Good', 'Worn', 'Rough']); expect(document.querySelector('.shapes')!.textContent).toMatch(/Visible scratches/); expect(document.querySelector('.shapes')!.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    await userEvent.click(screen.getByRole('radio', { name: /Worn/ })); await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Battery health'), { target: { value: '72' } }); await userEvent.type(screen.getByLabelText('Search'.length ? /Anything about it/ : ''), 'screen'); expect(screen.queryByRole('button', { name: 'Battery replaced' })).toBeNull(); await userEvent.click(screen.getByRole('button', { name: 'Cracked screen' })); await userEvent.clear(screen.getByLabelText(/Anything about it/)); await userEvent.click(screen.getByRole('button', { name: 'Original box' })); await userEvent.type(screen.getByLabelText(/Anything else \(type it\)/), 'Sale purchase');
    expect(screen.queryByLabelText('What did you pay?')).toBeNull(); await userEvent.click(screen.getByRole('button', { name: 'Show me the range' })); await waitFor(() => expect(sent((b) => b.action === 'sell_plan')).toHaveLength(1));
    expect(sent((b) => b.action === 'sell_plan')[0]).toEqual({ action: 'sell_plan', variant_id: 'FKL-10', age_years: 4, condition: 'fair', battery_health_pct: 72, flags: ['cracked_screen', 'has_box'], notes: 'Sale purchase' }); expect(await screen.findByText(/How this was worked out/)).toBeInTheDocument();
  });
  it('a custom laptop asks "What did you pay?" and sends custom_name and paid_inr; a reply that needs the paid price asks inline and re-sends', async () => {
    handler = (b) => b.action === 'sell_plan' && b.paid_inr == null ? okResponse({ ...fx('sell'), blocks: [{ ...fx('sell').blocks[0], range: null, needs_paid_price: true }] } as any) : route(b);
    mount(); await goto(/Sell$/); await opt('Laptop name', 'Zorblax 9000'); await userEvent.click(screen.getByRole('button', { name: 'Next' })); await userEvent.click(screen.getByRole('button', { name: 'Next' })); await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show me the range' })); await waitFor(() => expect(sent((b) => b.action === 'sell_plan')).toHaveLength(1)); expect(sent((b) => b.action === 'sell_plan')[0]).toMatchObject({ custom_name: 'Zorblax 9000' }); expect(sent((b) => b.action === 'sell_plan')[0].variant_id).toBeUndefined();
    const ask = await screen.findByLabelText('What did you pay?'); await userEvent.type(ask, '55000'); await userEvent.click(screen.getByRole('button', { name: 'Update the range' })); await waitFor(() => expect(sent((b) => b.action === 'sell_plan')).toHaveLength(2)); expect(sent((b) => b.action === 'sell_plan')[1]).toMatchObject({ custom_name: 'Zorblax 9000', paid_inr: 55000 });
    expect((await screen.findAllByText(/might sell for/)).length).toBeGreaterThan(0);
  });
});

const sellBlock = (extra: Partial<Block>): Block => ({ ...fx('sell').blocks.find((b) => b.type === 'sell_plan')!, ...extra });
const showBlock = (b: Block) => render(<CtxContext.Provider value={noopCtx}><BlockView block={b} /></CtxContext.Provider>);
describe('sell result', () => {
  it('the checklist is a plain bulleted list (no tick boxes) with Copy list and Copy the whole plan, and a visible Copied state', async () => {
    const write = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    showBlock(sellBlock({ checklist: ['Clean the screen', 'Find the bill'], copy_text: 'WHOLE PLAN TEXT' })); const list = screen.getByRole('heading', { name: 'Before you list it' }).parentElement!; expect(within(list).getAllByRole('listitem')).toHaveLength(2); expect(list.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Copy list' })); expect(write).toHaveBeenCalledWith('- Clean the screen\n- Find the bill'); expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy the whole plan' })); expect(write).toHaveBeenLastCalledWith('WHOLE PLAN TEXT');
  });
  it('falls back to execCommand when the clipboard API is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); const exec = vi.fn().mockReturnValue(true); (document as any).execCommand = exec; showBlock(sellBlock({ checklist: ['One'] })); await userEvent.click(screen.getByRole('button', { name: 'Copy list' })); expect(exec).toHaveBeenCalledWith('copy'); expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
  it('boosters render as "How to get more" with a source tag; web items show https links only and "Live, not verified"', () => {
    showBlock(sellBlock({ boosters: [{ title: 'Keep the box', why: 'Boxed laptops sell faster.', source: 'rule', gain_text: 'maybe 2 to 5 percent' }, { title: 'List on a Sunday', why: 'Owners say so.', source: 'owners' }, { title: 'Prices are softening', why: 'From the web.', source: 'web', items: [{ snippet: 'Used M1 prices fell', url: 'https://example.com/a', site: 'example.com' }, { snippet: 'bad', url: 'javascript:alert(1)', site: 'x' }, { snippet: 'plain http', url: 'http://insecure.test', site: 'y' }] }] }));
    expect(screen.getByRole('heading', { name: 'How to get more' })).toBeInTheDocument(); for (const t of ['Rule', 'Owners', 'Web']) expect(screen.getByText(t, { selector: '.src-tag' })).toBeInTheDocument();
    const links = screen.getAllByRole('link'); expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://example.com/a']); expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener')); expect(screen.getByText('Live, not verified.')).toBeInTheDocument();
  });
  it('a plan with no range never shows a blank or "undefined" range', () => { const { container } = showBlock(sellBlock({ range: null, needs_paid_price: true })); expect(container.textContent).toMatch(/Tell me what you paid/); expect(container.textContent).not.toMatch(/undefined|NaN/); });
});

describe('You: purchase date limits', () => {
  it('the helpers: launch year sets the minimum, today the maximum, and the reasons are plain', () => {
    expect(minPurchaseDate({ launch_year: 2020 })).toBe('2020-01-01'); expect(minPurchaseDate(null)).toBe('2012-01-01'); expect(maxAgeYears({ launch_year: 2020 }, new Date('2026-11-14'))).toBe(7); expect(maxAgeYears(null)).toBe(12);
    expect(dateProblem('2019-05-01', { launch_year: 2020 })).toMatch(/launched in 2020/); expect(dateProblem('2999-01-01', null)).toMatch(/future/); expect(dateProblem('2024-01-01', { launch_year: 2020 })).toBeNull(); expect(endedBeforeLaunch('15 Mar 2019', { launch_year: 2020 })).toBe(true); expect(endedBeforeLaunch('15 Mar 2025', { launch_year: 2020 })).toBe(false); expect(endedBeforeLaunch('15 Mar 2019', null)).toBe(false);
  });
  it('the date field has min and max, says when the model launched, refuses an early date with a reason, and never shows a warranty that ended before the model existed', async () => {
    mount(); await goto(/You$/); await userEvent.click(await screen.findByRole('button', { name: /Add a laptop/ })); await opt('Which laptop?', 'Macbook Air'); await userEvent.click((await screen.findAllByRole('option')).find((o) => /APPLE 2020 Macbook Air M1/.test(o.textContent!))!);
    const date = screen.getByLabelText('When did you buy it?'); expect(date).toHaveAttribute('min', '2020-01-01'); expect(date).toHaveAttribute('max', new Date().toISOString().slice(0, 10)); expect(screen.getByText('This model launched in 2020.')).toBeInTheDocument();
    fireEvent.change(date, { target: { value: '2018-06-01' } }); expect(await screen.findByRole('alert')).toHaveTextContent(/launched in 2020/); expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    handler = (b) => b.owned ? okResponse({ ...fx('mylaptops'), blocks: [{ type: 'my_laptops', today: '2026-11-14', note: 'n', items: [{ found: true, name: 'APPLE 2020 Macbook Air M1 · 8 GB / 256 GB', variant_id: 'FKL-10', warranty: { status: 'expired', ends_text: '1 Jun 2019', days_left: -9 } }] }] } as any) : route(b);
    fireEvent.change(date, { target: { value: '2021-06-01' } }); await userEvent.click(screen.getByRole('button', { name: 'Add' })); await waitFor(() => expect(sent((b) => b.owned)).toHaveLength(1)); await screen.findByText(/purchase date is before this model launched/); expect(document.body.textContent).not.toMatch(/Warranty ended 1 Jun 2019/);
  });
});

describe('Explore: board by default, value map second', () => {
  it('opens as a board with filters, a sort control and photo-or-drawing cards with 2 to 3 tags; budget is typed', async () => {
    mount(); await goto(/Explore$/); await waitFor(() => expect(document.querySelectorAll('.bcard').length).toBeGreaterThan(0)); expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('aria-selected', 'true'); expect(document.querySelector('.value-map')).toBeNull();
    expect(screen.getByLabelText('Sort')).toBeInTheDocument(); expect(screen.getByRole('button', { name: /^Price/ })).toBeInTheDocument(); expect(screen.getByText(/Two tiers/)).toBeInTheDocument(); const n = document.querySelectorAll('.bcard').length; expect(n).toBeLessThanOrEqual(12);
    for (const c of document.querySelectorAll('.bcard')) expect(c.querySelectorAll('.tag').length).toBeLessThanOrEqual(3);
    const total = Number(screen.getByText(/of 14 laptops/).textContent!.match(/^(\d+)/)![1]); expect(total).toBe(14); await userEvent.click(screen.getByRole('button', { name: /^Price/ })); await userEvent.type(screen.getByLabelText('Up to (₹)'), '40000'); await waitFor(() => expect(screen.getByText(/of 14 laptops/).textContent).not.toMatch(/^14 /));
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'high'); const prices = Array.from(document.querySelectorAll('.bprice')).map((e) => Number(e.textContent!.match(/₹([\d,]+)/)![1].replace(/,/g, ''))); expect(prices).toEqual([...prices].sort((a, b) => b - a)); expect(prices.every((p) => p <= 40000)).toBe(true);
  });
  it('filter chips narrow the board and Clear filters restores it; ticking two cards enables Compare', async () => {
    mount(); await goto(/Explore$/); await waitFor(() => expect(document.querySelectorAll('.bcard').length).toBeGreaterThan(0)); await userEvent.click(screen.getByRole('button', { name: /^Brand/ })); await userEvent.click(screen.getByRole('button', { name: /^HP\s*\d/ })); const hp = document.querySelectorAll('.bcard').length; expect(hp).toBeGreaterThan(0); expect(hp).toBeLessThan(14);
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' })); await waitFor(() => expect(document.querySelectorAll('.bcard').length).toBeGreaterThan(hp));
    const boxes = screen.getAllByRole('checkbox', { name: /^Compare / }); expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled(); await userEvent.click(boxes[0]); await userEvent.click(boxes[1]); expect(screen.getByText('2 picked')).toBeInTheDocument(); await userEvent.click(screen.getByRole('button', { name: 'Compare' })); await waitFor(() => expect(sent((b) => b.action === 'compare')).toHaveLength(1)); expect(sent((b) => b.action === 'compare')[0].variant_ids).toHaveLength(2);
  });
  it('the Value map has plain-language axes and a labelled region, tap = peek card, pick from the peek, and a list is always one tap away', async () => {
    mount(); await goto(/Explore$/); await waitFor(() => expect(document.querySelectorAll('.bcard').length).toBeGreaterThan(0)); await userEvent.click(screen.getByRole('tab', { name: 'Value map' }));
    expect(screen.getByText('More for your money')).toBeInTheDocument(); expect(screen.getByText(/Cheaper → Pricier/)).toBeInTheDocument(); expect(screen.getByText(/Stronger on paper/)).toBeInTheDocument(); const dots = Array.from(document.querySelectorAll<HTMLButtonElement>('.vm-dot')); expect(dots).toHaveLength(14); for (const d of dots) expect(d.getAttribute('aria-label')).toMatch(/₹[\d,]+, \d+ GB RAM/);
    await userEvent.click(dots[0]); expect(document.querySelector('.peek-card')).toBeTruthy(); await userEvent.click(screen.getByRole('button', { name: 'Pick to compare' })); expect(screen.getByText('Pick one more to compare')).toBeInTheDocument();
    expect(screen.getByText('Show these as a list')).toBeInTheDocument(); expect(document.querySelectorAll('.map-list input[type=checkbox]')).toHaveLength(14); await userEvent.click(screen.getByRole('tab', { name: 'Market' })); expect(screen.getByRole('button', { name: 'Market pulse' })).toBeInTheDocument();
  });
});

describe('Sell shows your saved laptops', () => {
  it('lists the laptops saved in You as quick picks, and tapping one fills the laptop, its age from the purchase date and the price paid', async () => {
    const { saveOwned } = await import('../lib/storage'); const year = new Date().getFullYear() - 3;
    saveOwned([{ id: 'o1', variant_id: 'FKL-10', name: 'APPLE 2020 Macbook Air M1 · 8 GB / 256 GB', purchase_date: `${year}-03-11`, price_paid: 70000 }]);
    mount(); await goto(/Sell$/); const group = await screen.findByRole('group', { name: 'Your saved laptops' }); const chip = within(group).getByRole('button', { name: /APPLE 2020 Macbook Air M1/ });
    expect(chip).toHaveTextContent(`bought ${year}-03`); await userEvent.click(chip); expect(chip).toHaveAttribute('aria-pressed', 'true'); expect((screen.getByLabelText('Laptop name') as HTMLInputElement).value).toMatch(/Macbook Air M1/);
    await userEvent.click(screen.getByRole('button', { name: 'Next' })); expect((screen.getAllByLabelText('Age in years')[0] as HTMLInputElement).value).toBe('3');
  });
  it('without saved laptops the picker looks as before', async () => { localStorage.clear(); mount(); await goto(/Sell$/); await screen.findByLabelText('Laptop name'); expect(screen.queryByRole('group', { name: 'Your saved laptops' })).toBeNull(); });
});

