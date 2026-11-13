import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockView } from '../components/blocks/BlockView';
import { CtxContext, noopCtx, type Ctx } from '../components/ctx';
import { ApiConfigContext } from '../components/api-context';
import { Lappy } from '../components/viz/Lappy';
import { Radar } from '../components/viz/Radar';
import { Ring } from '../components/viz/Ring';
import { CountUp } from '../components/viz/CountUp';
import { Confetti } from '../components/viz/Confetti';
import { axesFor, norm } from '../lib/viz';
import App from '../App';
import { fx, okResponse, cfg } from './helpers';
import type { Block } from '../lib/types';

const withCtx = (ui: React.ReactElement, ctx: Partial<Ctx> = {}) => <ApiConfigContext.Provider value={cfg}><CtxContext.Provider value={{ ...noopCtx, ...ctx }}>{ui}</CtxContext.Provider></ApiConfigContext.Provider>;
const show = (b: Block, ctx: Partial<Ctx> = {}) => render(withCtx(<BlockView block={b} />, ctx));
const block = (name: string, type: string): Block => { const b = fx(name).blocks.find((x) => x.type === type); if (!b) throw new Error(`${name} has no ${type}`); return b; };
const reduce = (on: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
afterEach(() => vi.unstubAllGlobals());

describe('visual building blocks', () => {
  it('the mascot is decorative (hidden from screen readers) and has a mood for each situation', () => {
    for (const m of ['idle', 'thinking', 'happy', 'oops', 'listening'] as const) { const { container, unmount } = render(<Lappy mood={m} />); const svg = container.querySelector('svg')!; expect(svg).toHaveAttribute('aria-hidden', 'true'); expect(svg).toHaveClass(m); unmount(); }
  });
  it('the radar describes every value in words, says it is scaled against the others, and marks unknown values instead of inventing them', () => {
    const cards = block('shortlist', 'cards').cards as any[]; const a = axesFor({ ...cards[0], specs: { ...cards[0].specs, weight_kg: null } }); const n = a.map((x) => norm(x.value, [x.value, 5, 9], x.higherIsBetter));
    const { container } = render(<Radar axes={a} norms={n} name="Test laptop" />); const label = screen.getByRole('img').getAttribute('aria-label')!;
    expect(label).toMatch(/Test laptop: Lower price/); expect(label).toMatch(/Lightness \?/); expect(label).toMatch(/scaled against the other laptops/); expect(container.querySelectorAll('circle.dot.unknown').length).toBeGreaterThanOrEqual(1); expect(container.textContent).toMatch(/Lightness \?/);
  });
  it('the ring shows the count, describes itself, and clamps nonsense values', () => {
    const { container } = render(<Ring value={7} label="12" caption="Collecting owner voices: 12 of 20" />); expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Collecting owner voices: 12 of 20'); expect(container.querySelector('.ring-n')!.textContent).toBe('12');
    const { container: c2 } = render(<Ring value={-3} label="0" />); expect(c2.querySelector('.meter')).toBeTruthy();
  });
  it('the price counts up but always ends on the exact text the backend sent', async () => {
    reduce(false); render(<CountUp to={86990} text="₹86,990" ms={30} />); await waitFor(() => expect(screen.getByLabelText('₹86,990')).toHaveTextContent('₹86,990'), { timeout: 1500 });
    reduce(true); const { container } = render(<CountUp to={50000} text="₹50,000" />); expect(container).toHaveTextContent('₹50,000');
  });
  it('confetti bursts only for a good result and never for people who prefer reduced motion', () => {
    reduce(false); const { container, rerender } = render(<Confetti fire={false} />); expect(container).toBeEmptyDOMElement(); rerender(<Confetti fire />); expect(container.querySelectorAll('i').length).toBeGreaterThan(10);
    reduce(true); const r2 = render(<Confetti fire />); expect(r2.container).toBeEmptyDOMElement();
  });
});

describe('the laptop card', () => {
  it('shows the trust line with the price date and how old it is, the owner count and data status, and the key specs', () => {
    show(block('shortlist', 'cards')); const first = screen.getAllByRole('article')[0];
    expect(within(first).getByText(/Price as of 10 Nov 2026 \(\d+ days?( old)?\)|Price as of 10 Nov 2026 \(today\)/)).toBeInTheDocument(); expect(within(first).getByText(/\d+ owner opinions/)).toBeInTheDocument(); expect(within(first).getByText('Not human-verified')).toBeInTheDocument();
    expect(within(first).getByRole('list', { name: 'Key specs' })).toBeInTheDocument(); expect(within(first).getByRole('button', { name: 'Details' })).toBeInTheDocument(); expect(within(first).getAllByRole('img').length).toBeGreaterThanOrEqual(1);
  });
  it('an old price is labelled stale, and thin evidence says it is still collecting, never a percentage', () => {
    const base = (block('shortlist', 'cards').cards as any[])[0]; show({ type: 'cards', title: 't', first: 3, requireAll: false, cards: [{ ...base, as_of: '2020-01-01', as_of_text: '1 Jan 2020', evidence: { n: 4, enough: false, positive: 4, negative: 0, text: 'Not enough owner evidence yet (n = 4; we need at least 20).', min_n: 20 } }] });
    expect(document.querySelector('.fresh')).toHaveClass('stale'); expect(screen.getByText('still collecting (need 20)')).toBeInTheDocument(); expect(document.body.textContent).not.toMatch(/\d+ of \d+ owner opinions positive|%/);
  });
  it('the first result is the one hero and the others are compact rows', () => {
    show(block('shortlist', 'cards')); expect(document.querySelectorAll('.bhero')).toHaveLength(1); expect(document.querySelectorAll('.brow')).toHaveLength(2); expect(screen.getAllByRole('article')[0]).toHaveClass('bhero');
  });
  it('the board says pictures are from the web and what a "?" means', () => { show(block('shortlist', 'cards')); expect(screen.getByText(/Pictures are from the web and may not show this exact version/)).toBeInTheDocument(); });
});

describe('the answer receipt (where every answer\'s data came from)', () => {
  it('names the catalog snapshot, the dataset opinions with a count, that there is no live data, which AI parts were used, and that everything was re-checked', async () => {
    show(block('shortlist', 'provenance')); await userEvent.click(screen.getByText(/How I built this answer/)); const t = document.body.textContent!;
    expect(t).toMatch(/saved snapshot \(10 Nov 2026\), not live/); expect(t).toMatch(/No person has verified the specs/); expect(t).toMatch(/\d+ opinions read by a machine from 3987 dataset reviews, which have no dates/); expect(t).not.toMatch(/Live web/); expect(t).toMatch(/Re-checked/); expect(t).toMatch(/never decides prices, specs or counts/);
  });
  it('a stylish answer states the stand-in lens and the live web source with a count', async () => {
    show(block('stylish', 'provenance')); await userEvent.click(screen.getByText(/How I built this answer/)); expect(document.body.textContent).toMatch(/Used as a stand-in for: looks/); expect(document.body.textContent).toMatch(/Live web.*web excerpts? via fake-live/s);
  });
  it('a plain-text answer has no receipt at all', () => { const f = fx('help'); expect(f.blocks.some((b) => b.type === 'provenance')).toBe(false); });
});

describe('shop links and the affiliate disclosure', () => {
  let f: ReturnType<typeof vi.fn>; beforeEach(() => { f = vi.fn(async () => okResponse({ ...fx('help'), blocks: [{ type: 'ack' }] } as any)); vi.stubGlobal('fetch', f); });
  it('with no affiliate tags: plain links, no disclosure (nothing is earned, so nothing is claimed), noopener only', () => {
    show(block('where_to_buy', 'where_to_buy')); expect(screen.queryByRole('note')).toBeNull(); expect(screen.queryByText('Affiliate link')).toBeNull();
    for (const a of screen.getAllByRole('link')) { expect(a).toHaveAttribute('target', '_blank'); expect(a.getAttribute('rel')).toBe('noopener noreferrer'); expect(a.getAttribute('href')).toMatch(/^https:\/\//); }
    expect(screen.getByText(/price at the shop can differ from my saved price/)).toBeInTheDocument();
  });
  it('with affiliate tags: only tagged shops are marked, they are rel="sponsored", and the plain-language disclosure is shown', () => {
    show(block('where_to_buy_affiliate', 'where_to_buy')); const links = screen.getAllByRole('link'); const tagged = links.filter((a) => within(a).queryByText('Affiliate link')); expect(tagged.length).toBe(2); for (const a of tagged) expect(a.getAttribute('rel')).toMatch(/sponsored/);
    const plain = links.filter((a) => !within(a).queryByText('Affiliate link')); expect(plain.length).toBe(1); expect(plain[0].getAttribute('rel')).toBe('noopener noreferrer'); expect(screen.getByRole('note')).toHaveTextContent(/may earn LapFit a small commission.*never changes which laptops are shown or in what order/);
  });
  it('opening a shop counts one anonymous click for that shop and laptop, and a failing count never blocks the link', async () => {
    show(block('where_to_buy', 'where_to_buy')); const a = screen.getAllByRole('link')[0]; a.addEventListener('click', (e) => e.preventDefault()); await userEvent.click(a);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1)); const body = JSON.parse((f.mock.calls[0] as any)[1].body); expect(body).toMatchObject({ action: 'outbound_click', retailer: 'amazon_in', variant_id: 'FKL-10', from: 'where_to_buy' }); expect(JSON.stringify(body)).not.toMatch(/text/);
    f.mockRejectedValue(new TypeError('offline')); await userEvent.click(a);   // must not throw
  });
  it('a non-https link from the data is never shown', () => { show({ type: 'where_to_buy', variant_id: 'x', name: 'X', note: 'n', disclosure: null, links: [{ id: 'a', name: 'Bad', url: 'javascript:alert(1)', affiliate: false }, { id: 'b', name: 'Good', url: 'https://ok.test/?q=1', affiliate: false }] }); expect(screen.getAllByRole('link')).toHaveLength(1); });
});

describe('reading a picture', () => {
  it('shows what the model read as chips, the claims it found, and says the user should check it; a link offers the typed path', async () => {
    const goto = vi.fn(); show(block('image_listing', 'image_read'), { goto }); expect(screen.getByRole('heading', { name: /Here’s what I saw/ })).toBeInTheDocument(); expect(screen.getByText('Battery health')).toBeInTheDocument(); expect(screen.getByText('65%')).toBeInTheDocument(); expect(screen.getByText(/I can be wrong, so please check it/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Not right\? Type the details instead/ })); expect(goto).toHaveBeenCalledWith('check'); expect(JSON.parse(sessionStorage.getItem('lapfit.prefill')!).laptop).toMatch(/Lenovo/);
  });
  it('an unreadable picture is shown plainly with no "type instead" link and concerns listed', () => { show(block('image_unreadable', 'image_read')); expect(screen.getByText(/could not read enough/)).toBeInTheDocument(); expect(screen.getByText(/⚠ blurry/)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Not right/ })).toBeNull(); });
  it('claims read from a seller chat get stamps: MISMATCH for a wrong spec, OPINION for an opinion, UNCHECKED for what no person approved', () => {
    show(block('image_seller', 'claims')); const t = document.body.textContent!; expect(t).toMatch(/MISMATCH/); expect(t).toMatch(/OPINION/); expect(t).toMatch(/UNCHECKED/); expect(t).not.toMatch(/VERIFIED/); expect(document.querySelectorAll('.stamp')[0]).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('the whole app with a picture', () => {
  let f: ReturnType<typeof vi.fn>;
  beforeEach(() => { window.location.hash = ''; sessionStorage.clear(); localStorage.setItem('lapfit.imgconsent.v1', 'true'); vi.stubGlobal('scrollTo', vi.fn());
    f = vi.fn(async (_u: string, init: any) => { const b = JSON.parse(init.body); return okResponse(b.action === 'data_status' ? fx('data_status') : b.action === 'read_image' ? fx('image_listing') : fx('help')); }); vi.stubGlobal('fetch', f); });
  it('attach, press Read picture: one request with the picture and the larger-body header, then what was read, the checks, the checklist and the receipt', async () => {
    const lib = await import('../lib/image'); vi.spyOn(lib, 'prepareImage').mockResolvedValue({ mime: 'image/jpeg', data: 'QUJD', bytes: 90_000, width: 800, height: 600, previewUrl: 'blob:x' });
    render(<App config={cfg} />); await userEvent.upload(document.querySelector('input[type=file]') as HTMLInputElement, new File(['x'], 'a.png', { type: 'image/png' })); await userEvent.click(await screen.findByRole('button', { name: 'Read picture' }));
    expect(await screen.findByText(/Here’s what I saw/)).toBeInTheDocument(); const call = f.mock.calls.find((c: any) => JSON.parse(c[1].body).action === 'read_image')!; expect(JSON.parse((call as any)[1].body)).toEqual({ action: 'read_image', image: { mime: 'image/jpeg', data: 'QUJD' } });
    expect((call as any)[1].headers['x-lapfit-image']).toBe('1'); expect(screen.getByText(/What I found/)).toBeInTheDocument(); expect(screen.getByText(/Check in person before paying/)).toBeInTheDocument(); expect(screen.getByText(/How I built this answer/)).toBeInTheDocument();
    expect(f.mock.calls.filter((c: any) => 'x-lapfit-image' in (c[1].headers ?? {}))).toHaveLength(1);
  });
  it('ordinary text requests never use the larger-body header', async () => { render(<App config={cfg} />); await userEvent.type(screen.getByLabelText('Your message'), 'laptop under 50k{Enter}'); await waitFor(() => expect(f.mock.calls.some((c: any) => JSON.parse(c[1].body).text)).toBe(true)); expect(f.mock.calls.every((c: any) => !('x-lapfit-image' in (c[1].headers ?? {})))).toBe(true); });
});


describe('laptop pictures', () => {
  const pic = { url: 'https://img.example.test/a.jpg', site: 'img.example.test', page: null, alt: 'A silver laptop' };
  it('shows the picture with its description, lazy loading, no referrer sent, and a caption naming the source', async () => {
    const { LaptopImage } = await import('../components/LaptopImage'); render(<LaptopImage pic={pic} brand="Lenovo" name="Lenovo IdeaPad" />);
    const img = screen.getByAltText('A silver laptop'); expect(img).toHaveAttribute('loading', 'lazy'); expect(img.getAttribute('referrerpolicy')).toBe('no-referrer'); expect(img).toHaveAttribute('src', pic.url); expect(screen.getByText(/Photo: img.example.test/)).toBeInTheDocument();
    expect(screen.getByText(/Photo: img.example.test/).getAttribute('title')).toMatch(/may not show this exact version.*licence is not verified/);
  });
  it('a picture that fails to load is replaced by a drawn laptop, labelled as an illustration; no picture also shows the drawing', async () => {
    const { LaptopImage } = await import('../components/LaptopImage'); const { unmount } = render(<LaptopImage pic={pic} brand="Lenovo" name="Lenovo IdeaPad" />);
    fireEvent.error(screen.getByAltText('A silver laptop')); expect(screen.queryByAltText('A silver laptop')).toBeNull(); expect(screen.getByRole('img', { name: /Illustration of a laptop.*Not a photo/ })).toBeInTheDocument(); expect(screen.getByText('Illustration')).toBeInTheDocument(); unmount();
    render(<LaptopImage pic={null} brand="HP" name="HP 14s" />); expect(screen.getByRole('img', { name: /Illustration of a laptop: HP 14s/ })).toBeInTheDocument();
  });
  it('a picture whose page link is known links to it safely', async () => { const { LaptopImage } = await import('../components/LaptopImage'); render(<LaptopImage pic={{ ...pic, page: 'https://shop.example.test/p' }} brand="X" name="X" />); const a = screen.getByRole('link', { name: /Photo: img.example.test/ }); expect(a).toHaveAttribute('target', '_blank'); expect(a.getAttribute('rel')).toBe('noopener noreferrer'); });
  it('the drawing is deterministic per brand and follows the recorded screen size', async () => {
    const { LaptopArt } = await import('../components/viz/LaptopArt'); const w = (s: number) => { const { container, unmount } = render(<LaptopArt brand="Asus" screen={s} />); const r = Number(container.querySelectorAll('rect')[0].getAttribute('width')); unmount(); return r; };
    expect(w(17)).toBeGreaterThan(w(13)); const fill = (b: string) => { const { container, unmount } = render(<LaptopArt brand={b} />); const f = container.querySelector('linearGradient')!.innerHTML; unmount(); return f; }; expect(fill('Asus')).toBe(fill('Asus')); expect(fill('Asus')).not.toBe(fill('Lenovo'));
  });
  it('every card in a real reply shows a picture, and the compare heads show one per laptop', () => {
    show(block('shortlist', 'cards')); expect(document.querySelectorAll('.brow img').length).toBeGreaterThanOrEqual(2); expect(document.querySelector('.bhero .spec-portrait')).toBeInTheDocument(); expect(document.querySelectorAll('.bhero img').length).toBe(0); document.body.innerHTML = '';
    show(block('compare', 'compare')); expect(document.querySelectorAll('.tug-head img').length).toBe(3);
  });
  it('the receipt names where the pictures came from and that they are not verified', async () => { show(block('shortlist', 'provenance')); await userEvent.click(screen.getByText(/How I built this answer/)); expect(document.body.textContent).toMatch(/Pictures.*From the web \(.+\).*not verified.*licence is not verified/s); });
  it('the spec tiles show recorded values and a "?" for what the catalog does not know', () => {
    const base = (block('shortlist', 'cards').cards as any[])[0]; show({ type: 'cards', title: 't', first: 3, requireAll: false, cards: [{ ...base, specs: { ...base.specs, weight_kg: null, ram_gb: 16 } }] });
    const tiles = within(screen.getByRole('list', { name: 'Key specs' })).getAllByRole('listitem').map((l) => l.textContent); expect(tiles[0]).toMatch(/16 GB/); expect(tiles[3]).toMatch(/\?/);
  });
});

describe('web-wide market and brand context', () => {
  const web = { status: 'ok', provider: 'tavily', fetched_at: '2026-11-13T10:00:00Z', note: 'From across the web, fetched just now. Not verified, and not part of the dataset numbers.', scope: 'market', items: [{ snippet: 'Laptop prices in India are rising.', url: 'https://news.example.test/a', site: 'news.example.test', published: '2026-11-10' }, { snippet: 'bad link', url: 'javascript:alert(1)', site: 'x' }] };
  it('market pulse shows web items as live and not verified, with safe links only', () => {
    show({ ...block('trending', 'market_pulse'), web }); const panel = screen.getByRole('region', { name: /Across the Indian laptop market/ });
    expect(within(panel).getByText('Live, not verified')).toBeInTheDocument(); expect(within(panel).getByText(/Laptop prices in India are rising/)).toBeInTheDocument(); expect(within(panel).queryByText(/bad link/)).toBeNull();
    const a = within(panel).getByRole('link', { name: /news.example.test/ }); expect(a).toHaveAttribute('href', 'https://news.example.test/a'); expect(a.getAttribute('rel')).toBe('noopener noreferrer'); expect(a).toHaveAttribute('target', '_blank');
  });
  it('brand insights names the brand in the web panel; off status shows nothing; a limit message is shown', () => {
    const b = block('brand', 'brand_insights') as any; const one = { ...b, brands: [b.brands[0]] }; const { unmount } = render(withCtx(<BlockView block={{ ...one, web: { ...web, scope: 'Lenovo' } }} />)); expect(screen.getByRole('region', { name: `What the web says about ${b.brands[0].brand}` })).toBeInTheDocument(); unmount();
    const r2 = render(withCtx(<BlockView block={{ ...b, web: { ...web, status: 'off', items: [] } }} />)); expect(screen.queryByText('Live, not verified')).toBeNull(); r2.unmount();
    render(withCtx(<BlockView block={{ ...b, web: { status: 'limit', items: [], fetched_at: null, note: 'Web-wide context is paused for today to stay within the search budget. Only the recorded dataset is shown.' } }} />)); expect(screen.getByText(/paused for today/)).toBeInTheDocument();
  });
});
