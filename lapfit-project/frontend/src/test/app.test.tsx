import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fx, okResponse, cfg } from './helpers';

type Handler = (body: any) => Response | Promise<Response>;
let calls: any[] = []; let allInit: any[] = []; let handler: Handler = () => okResponse(fx('help'));
const route: Handler = (body) => {
  if (body.action === 'data_status') return okResponse(fx('data_status'));
  if (body.action === 'read_image') return okResponse(fx('image_listing'));
  if (body.action === 'where_to_buy') return okResponse(fx('where_to_buy'));
  if (body.action === 'catalog') return okResponse(fx('catalog'));
  if (body.action === 'compare') return okResponse(fx('compare'));
  if (body.action === 'used_check') return okResponse(fx('used'));
  if (body.action === 'sell_plan') return okResponse(fx('sell'));
  if (body.action === 'owner_voice') return okResponse(fx('owner_voice'));
  if (body.owned) return okResponse(fx('mylaptops'));
  if (body.experience) return okResponse({ ...fx('help'), flow: 'submit_experience', blocks: [{ type: 'report_receipt', receipt: 'ABCDE12345', text: 'Thank you.' }] } as any);
  if (body.needs) return okResponse(fx('shortlist'));
  if (/trending/.test(body.text ?? '')) return okResponse(fx('trending'));
  return okResponse(fx('shortlist'));
};
beforeEach(() => { calls = []; allInit = []; sessionStorage.clear(); handler = route; window.location.hash = ''; vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { const body = JSON.parse(init.body); if (body.action !== 'data_status') calls.push(body); allInit.push(init); return handler(body); })); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });
const mount = () => render(<App config={cfg} />);
const goto = async (name: RegExp) => { await userEvent.click(screen.getAllByRole('link', { name })[0]); };
const sent = (pred: (b: any) => boolean) => calls.filter(pred);
const catalogReady = async () => { await waitFor(() => expect(sessionStorage.getItem('lapfit.catalog.v2')).toBeTruthy()); };
const dots = () => Array.from(document.querySelectorAll<SVGGElement>('.price-map .dot'));
const pickOption = async (label: string | RegExp, which = 1) => { const box = await screen.findByRole('combobox', { name: label }); await userEvent.click(box); const opts = await screen.findAllByRole('option'); const opt = opts[which - 1]; const name = opt.querySelector('span')!.textContent!; await userEvent.click(opt); const rows = JSON.parse(sessionStorage.getItem('lapfit.catalog.v2') ?? '[]'); return rows.find((r: any) => r.name === name)?.variant_id as string; };

describe('details', () => {
  it('tapping Details on the best fit opens the detail sheet instead of crashing the screen, and it can be closed and another opened', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: /Show me laptops/ })); await screen.findAllByRole('article');
    await userEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]); expect(await screen.findByRole('dialog')).toBeInTheDocument(); expect(screen.queryByText(/Something broke on this screen/)).toBeNull(); expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Fit', 'Specs', 'Trust']);
    await userEvent.click(screen.getByRole('button', { name: 'Close' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getAllByRole('button', { name: /^Details: / })[0]); expect(await screen.findByRole('dialog')).toBeInTheDocument(); expect(screen.queryByText(/Something broke on this screen/)).toBeNull();
  });
});

describe('shell', () => {
  it('without the two settings it explains what to do and never calls the network', () => { render(<App config={null} />); expect(screen.getByRole('heading', { name: /needs two settings/ })).toBeInTheDocument(); expect(calls).toHaveLength(0); });
  it('five spaces, no tab full of forms: Ask, Explore, Check, Sell, You; plus Market and About; skip link and landmarks; the honest banner', () => {
    mount(); for (const n of ['Ask', 'Explore', 'Check', 'Sell', 'You']) expect(screen.getAllByRole('link', { name: new RegExp(`^${n}$|${n}$`) }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument(); expect(screen.getByRole('main')).toBeInTheDocument(); expect(screen.getByText(/saved snapshot, not live/)).toBeInTheDocument(); expect(screen.queryByText(/[Cc]ourse project|sample data/)).toBeNull();
  });
  it('the (i) button opens the Trust sheet: plain reasons, the data line, Market, About and the voice language; Escape closes it; no footer or banner is left on the page', async () => {
    mount(); expect(document.querySelector('.foot, .banner')).toBeNull(); await userEvent.click(screen.getByRole('button', { name: 'Why trust this?' }));
    const d = await screen.findByRole('dialog', { name: 'Why trust this?' }); expect(within(d).getByText(/Not human-verified/)).toBeInTheDocument(); expect(within(d).getByRole('link', { name: 'Market' })).toHaveAttribute('href', '#/market'); expect(within(d).getByRole('link', { name: /Sources, privacy and limits/ })).toHaveAttribute('href', '#/about'); expect(within(d).getByLabelText('Voice language')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('navigation changes the screen and an unknown address falls back to Ask', async () => {
    mount(); await goto(/Explore$/); expect(await screen.findByRole('heading', { name: 'Browse laptops' })).toBeInTheDocument(); window.location.hash = '#/nonsense'; window.dispatchEvent(new HashChangeEvent('hashchange')); expect(await screen.findByRole('heading', { name: 'Ask LapFit' })).toBeInTheDocument();
  });
  it('after the server reports its status the banner states the snapshot date; About shows the counts; status is fetched once per session', async () => {
    const f = vi.fn(async (_u: string, init: any) => okResponse(JSON.parse(init.body).action === 'data_status' ? fx('data_status') : fx('help'))); vi.stubGlobal('fetch', f);
    const { unmount } = mount(); expect(await screen.findByText(/saved snapshot from 10 Nov 2026, not live/)).toBeInTheDocument(); await userEvent.click(screen.getByRole('button', { name: 'Why trust this?' })); await userEvent.click(await screen.findByRole('link', { name: /Sources, privacy and limits/ })); expect(await screen.findByText(/What data is in here right now/)).toBeInTheDocument(); expect(screen.getByText(/3987 reviews|3,987 reviews/)).toBeInTheDocument(); expect(screen.getByText(/Amazon US: 687, internal use only/)).toBeInTheDocument(); unmount(); mount();
    expect(f.mock.calls.filter((c: any) => JSON.parse(c[1].body).action === 'data_status')).toHaveLength(1);
  });
});

describe('Home: pick a vibe, drag a budget, one button', () => {
  it('shows tiles and a slider, no form fields other than the message box', async () => { mount(); expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThan(5); expect(screen.getByLabelText(/Budget up to/)).toHaveAttribute('type', 'range'); expect(document.querySelectorAll('.hero select, .hero input:not([type=range]), .hero textarea')).toHaveLength(0); });
  it('study + code and a 1 lakh budget become one structured request, with no model reading needed', async () => {
    mount(); await catalogReady(); await userEvent.click(screen.getByRole('button', { name: 'Study' })); await userEvent.click(screen.getByRole('button', { name: 'Code' })); fireEvent.change(screen.getByLabelText(/Budget up to/), { target: { value: '5' } });
    await userEvent.click(screen.getByRole('button', { name: /Show me laptops/ })); await screen.findAllByRole('article'); expect(calls.filter((c) => c.needs)).toHaveLength(1); const n = calls.find((c) => c.needs).needs;
    expect(n.use_cases).toEqual(['study', 'coding']); expect(n.budget_max_inr).toBe(100000); expect(n.musts).toEqual([]);
  });
  it('the slider shows how many laptops sit at or under the budget, from the catalog list', async () => { mount(); await catalogReady(); await waitFor(() => expect(screen.getByLabelText(/Budget up to/)).toHaveAttribute('aria-valuetext', expect.stringMatching(/₹60,000, 9 laptops in the catalog at or under this price/))); fireEvent.change(screen.getByLabelText(/Budget up to/), { target: { value: '0' } }); expect(screen.getByLabelText(/Budget up to/)).toHaveAttribute('aria-valuetext', expect.stringMatching(/₹20,000, [01] laptops? in the catalog/)); await userEvent.click(screen.getByRole('button', { name: 'No limit' })); expect(screen.getByLabelText(/Budget up to/)).toHaveAttribute('aria-valuetext', expect.stringMatching(/^No limit,/)); });
  it('choosing "Look stylish" sends a sentence instead, so the stylish stand-in can apply', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Look stylish' })); await userEvent.click(screen.getByRole('button', { name: 'Game' })); await userEvent.click(screen.getByRole('button', { name: /Show me laptops/ }));
    await waitFor(() => expect(calls.some((c) => c.text)).toBe(true)); expect(calls.find((c) => c.text).text).toBe('A stylish laptop for gaming under ₹60,000');
  });
  it('an example in your own words sends one request; Enter in the box sends; Shift+Enter does not; empty cannot be sent', async () => {
    mount(); await userEvent.type(screen.getByLabelText('Your message'), 'Laptop for coding under 60k{Enter}'); await screen.findAllByRole('article'); expect(calls.find((c) => c.text).text).toBe('Laptop for coding under 60k');
    await userEvent.type(screen.getByLabelText('Your message'), 'a{Shift>}{Enter}{/Shift}b'); expect(screen.getByLabelText('Your message')).toHaveValue('a\nb'); expect(calls.filter((c) => c.text)).toHaveLength(1);
  });
  it('a failure keeps the text and offers Try again; a rate limit shows minutes and disables sending', async () => {
    handler = () => new Response(JSON.stringify({ ok: false, message: 'boom' }), { status: 500 }); mount(); const box = screen.getByLabelText('Your message'); await userEvent.type(box, 'laptop under 50k{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/boom/); expect(box).toHaveValue('laptop under 50k'); handler = route; await userEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findAllByRole('article');
  });
  it('a rate limit speaks plainly, shows the wait as minutes, and keeps the text', async () => {
    handler = () => new Response(JSON.stringify({ ok: false }), { status: 429, headers: { 'retry-after': '682' } }); mount(); const box = screen.getByLabelText('Your message'); await userEvent.type(box, 'hello there{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/ask again in 11 min 22 s/); expect(screen.getByRole('button', { name: /Wait 11 min 2\d s/ })).toBeDisabled(); expect(box).toHaveValue('hello there'); expect(document.body.textContent).not.toMatch(/682 seconds/);
  });
  it('a follow-up carries the needs and history of the earlier answer', async () => {
    mount(); await userEvent.type(screen.getByLabelText('Your message'), 'Laptop for coding under 60k{Enter}'); await screen.findAllByRole('article'); await userEvent.type(screen.getByLabelText('Your message'), 'make it cheaper{Enter}'); await waitFor(() => expect(calls.filter((c) => c.text)).toHaveLength(2));
    const f = calls.filter((c) => c.text)[1]; expect(f.prior_needs.budget_max_inr).toBe(60000); expect(f.history).toEqual(['Laptop for coding under 60k']);
  });
});

describe('Explore: the laptop map', () => {
  it('picking cards on Home fills the tray; opening it goes to Explore and compares', async () => {
    mount(); await userEvent.type(screen.getByLabelText('Your message'), 'Laptop for coding under 60k{Enter}'); await screen.findAllByRole('article'); const ticks = screen.getAllByLabelText('Compare'); await userEvent.click(ticks[0]); await userEvent.click(ticks[1]);
    const tray = screen.getByRole('region', { name: /picked for comparison/ }); expect(tray).toHaveTextContent('2 picked'); await userEvent.click(within(tray).getByRole('button', { name: 'Compare' })); await waitFor(() => expect(sent((b) => b.action === 'compare')).toHaveLength(1));
  });
});

describe('Check: a picture or a paste, details optional', () => {
  it('pasted seller words are sent as "the seller said"; the button needs a few words first', async () => {
    mount(); await goto(/Check$/); const btn = await screen.findByRole('button', { name: 'Check it' }); expect(btn).toBeDisabled(); await userEvent.type(screen.getByLabelText('What the seller said'), 'It has 16 GB RAM and 3 years warranty'); expect(btn).toBeEnabled(); await userEvent.click(btn);
    await waitFor(() => expect(calls.some((b) => /^The seller said: It has 16 GB RAM/.test(b.text ?? ''))).toBe(true));
  });
  it('a picture needs the one-time consent, then is read: one request with the larger-body header', async () => {
    const lib = await import('../lib/image'); vi.spyOn(lib, 'prepareImage').mockResolvedValue({ mime: 'image/jpeg', data: 'QUJD', bytes: 90_000, width: 800, height: 600, previewUrl: 'blob:x' });
    mount(); await goto(/Check$/); await userEvent.upload(document.querySelector('input[type=file]') as HTMLInputElement, new File(['x'], 'a.png', { type: 'image/png' })); const go = await screen.findByRole('button', { name: 'Read the picture' }); expect(go).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/sent to Google’s Gemini AI/)); expect(go).toBeEnabled(); await userEvent.click(go); expect(await screen.findByText(/Here’s what I saw/)).toBeInTheDocument();
    const i = allInit.findIndex((x) => JSON.parse(x.body).action === 'read_image'); expect(allInit[i].headers['x-lapfit-image']).toBe('1'); expect(JSON.parse(allInit[i].body)).toEqual({ action: 'read_image', image: { mime: 'image/jpeg', data: 'QUJD' } });
  });
});


describe('You: your laptops and your experience', () => {
  it('adding a laptop keeps it on this device and asks the server to compute (the server stores nothing)', async () => {
    mount(); await goto(/You$/); await userEvent.click(await screen.findByRole('button', { name: /Add a laptop/ })); const id = await pickOption('Which laptop?'); await userEvent.type(screen.getByLabelText('When did you buy it?'), '2024-03-15'); await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(sent((b) => b.owned)).toHaveLength(1)); expect(sent((b) => b.owned)[0].owned[0]).toMatchObject({ variant_id: id, purchase_date: '2024-03-15' }); expect(JSON.parse(localStorage.getItem('lapfit.owned.v1')!)).toHaveLength(1); expect(await screen.findByText(/Warranty (ends|ended)/)).toBeInTheDocument();
  });
  it('tells the user when this device cannot save', async () => {
    const orig = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try { mount(); await goto(/You$/); await userEvent.click(await screen.findByRole('button', { name: /Add a laptop/ })); await pickOption('Which laptop?'); await userEvent.click(screen.getByRole('button', { name: 'Add' })); expect(await screen.findByText(/Not saved on this device/)).toBeInTheDocument(); } finally { Storage.prototype.setItem = orig; }
  });
  it('sharing is stars, a topic chip and one sentence; contact details are refused; one box covers 18+ and the notice; the optional extras are hidden', async () => {
    mount(); await goto(/You$/); await userEvent.click(await screen.findByRole('tab', { name: /Share my experience/ })); const submit = screen.getByRole('button', { name: 'Send for review' }); expect(submit).toBeDisabled(); expect(screen.queryByLabelText(/Owned for/)).toBeNull();
    const id = await pickOption('Which laptop do you own?'); await userEvent.click(screen.getByRole('radio', { name: '4 of 5' })); await userEvent.click(screen.getByRole('button', { name: /Battery/ })); await userEvent.type(screen.getByLabelText('Your experience'), 'call me on 9876543210 about this laptop'); await userEvent.click(screen.getByLabelText(/I am 18 or older/));
    expect(submit).toBeDisabled(); expect(screen.getByText(/remove links, email addresses and phone numbers/i)).toBeInTheDocument(); await userEvent.clear(screen.getByLabelText('Your experience')); await userEvent.type(screen.getByLabelText('Your experience'), 'Battery easily lasts a full day of classes.'); expect(submit).toBeEnabled();
    await userEvent.click(submit); await waitFor(() => expect(sent((b) => b.experience)).toHaveLength(1)); expect(sent((b) => b.experience)[0].experience).toMatchObject({ variant_id: id, rating: 4, topic: 'battery', adult_confirmed: true, consent: true, months_owned: null }); expect(await screen.findByText('ABCDE12345')).toBeInTheDocument();
  });
  it('deleting a report asks for confirmation first', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true); vi.stubGlobal('confirm', confirm); mount(); await goto(/You$/); await userEvent.click(await screen.findByRole('tab', { name: /Share my experience/ })); await userEvent.click(screen.getByRole('button', { name: /Already sent one/ }));
    await userEvent.type(await screen.findByLabelText('Your receipt code'), 'abcde12345'); await userEvent.click(screen.getByRole('button', { name: 'Delete report' })); expect(sent((b) => b.action === 'report_delete')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Delete report' })); await waitFor(() => expect(sent((b) => b.action === 'report_delete')).toHaveLength(1)); expect(sent((b) => b.action === 'report_delete')[0].receipt).toBe('ABCDE12345');
  });
});

describe('Market', () => { it('loads the market pulse on request', async () => { mount(); await userEvent.click(screen.getByRole('button', { name: 'Why trust this?' })); await userEvent.click(await screen.findByRole('link', { name: 'Market' })); await userEvent.click(await screen.findByRole('button', { name: 'Market pulse' })); expect(await screen.findByText(/Most reviewed laptops in the dataset/)).toBeInTheDocument(); }); });
