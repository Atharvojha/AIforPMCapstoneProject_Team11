import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { BlockView } from '../components/blocks/BlockView';
import { CtxContext, noopCtx } from '../components/ctx';
import { fx, okResponse, cfg } from './helpers';

const rowOf = (id: string, brand: string, name: string, price: number) => ({ variant_id: id, model_id: 1, name: `${name} · ${id}`, brand, price_inr: price, ram_gb: 16, storage_gb: 512, recommendable: true, display_size: 14, weight_kg: 1.5, gpu_class: 'integrated', market: 'IN' });
const CAT = [rowOf('A1', 'Apple', 'MacBook Air M1', 69990), rowOf('D1', 'Dell', 'Dell Inspiron', 45000), rowOf('H1', 'HP', 'HP Pavilion', 35000)];
const webBlock = () => fx('web_catalog').blocks[0] as any;

describe('Explore: two tiers', () => {
  let calls: any[] = []; let web: any = null;
  beforeEach(() => { calls = []; web = webBlock(); sessionStorage.clear(); localStorage.clear(); window.location.hash = '#/explore';
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { const b = JSON.parse(init.body); if (b.action !== 'data_status') calls.push(b);
      if (b.action === 'catalog') return okResponse({ ...fx('catalog'), blocks: [{ type: 'catalog', rows: CAT }] } as any);
      if (b.action === 'web_catalog') { const w = typeof web === 'function' ? web(b) : web; return okResponse({ ...fx('web_catalog'), blocks: [w] } as any); }
      if (b.action === 'compare') return okResponse(fx('compare'));
      return okResponse(fx('data_status')); })); });
  afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });
  const webCalls = () => calls.filter((c) => c.action === 'web_catalog');
  const goWeb = async () => { render(<App config={cfg} />); await screen.findByText('My catalog (3 laptops, prices dated, owner opinions)'); await userEvent.click(screen.getByRole('tab', { name: /^From the web/ })); };

  it('shows the two tiers with counts from the responses, never a fixed number', async () => {
    render(<App config={cfg} />);
    expect(await screen.findByText('My catalog (3 laptops, prices dated, owner opinions)')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Catalog (3)' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('tab', { name: 'From the web (312)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^From the web/ }));
    expect(screen.getByText('More laptops from the web (312, not verified)')).toBeInTheDocument();
    expect(screen.getByText('Showing 4 of 312')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b14 laptops\b/);
  });
  it('a web row shows its price date, or "price not stated", key specs with "not stated on the page", the tag, a match pill and https-only links', async () => {
    await goWeb(); const cards = await screen.findAllByRole('listitem').then((l) => l.filter((x) => x.classList.contains('web-card')));
    expect(cards).toHaveLength(4); const lenovo = cards.find((c) => /Lenovo IdeaPad/.test(c.textContent!))!;
    expect(lenovo).toHaveTextContent('₹68,990'); expect(lenovo).toHaveTextContent('price as of 2 Nov 2026'); expect(lenovo).toHaveTextContent('From the web, not verified'); expect(lenovo).toHaveTextContent('82% fit'); expect(lenovo).toHaveTextContent('RAM: 16 GB');
    expect(within(lenovo).getByRole('link', { name: /example-shop\.in/ })).toHaveAttribute('target', '_blank'); expect(within(lenovo).getByText(/Why 82%/)).toBeInTheDocument();
    expect(lenovo.querySelector('img')).toBeNull(); expect(lenovo.querySelector('svg.spec-portrait')).not.toBeNull();
    const asus = cards.find((c) => /ASUS Zenbook/.test(c.textContent!))!;
    expect(asus).toHaveTextContent('price not stated'); expect(asus).toHaveTextContent('Storage: not stated on the page'); expect(asus).toHaveTextContent('Weight: not stated on the page');
    expect(within(asus).queryByRole('link')).toBeNull(); expect(asus).toHaveTextContent('Source: insecure.example.com');
  });
  it('"Show 24 more" sends the next offset and appends; the button goes away when all are shown', async () => {
    web = (b: any) => ({ ...webBlock(), total: 6, rows: b.offset ? webBlock().rows.slice(0, 2).map((r: any) => ({ ...r, key: `n${r.key}`, name: `Next ${r.name}` })) : webBlock().rows });
    await goWeb(); expect(await screen.findByText('Showing 4 of 6')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show 2 more' })); expect(await screen.findByText('Showing 6 of 6')).toBeInTheDocument();
    expect(webCalls().at(-1)).toMatchObject({ action: 'web_catalog', offset: 4, limit: 24 }); expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
  });
  it('brand chips come from the rows; a brand, a typed budget and search words are sent to the backend', async () => {
    await goWeb(); await screen.findByText('Showing 4 of 312');
    await userEvent.click(screen.getByRole('button', { name: 'Dell' })); await waitFor(() => expect(webCalls().at(-1)).toMatchObject({ brand: 'Dell', offset: 0 }));
    await userEvent.type(screen.getByLabelText('Up to (₹)'), '60000'); await waitFor(() => expect(webCalls().at(-1)).toMatchObject({ brand: 'Dell', budget_max_inr: 60000 }));
    await userEvent.click(screen.getByRole('button', { name: 'Dell' })); await userEvent.type(screen.getByLabelText(/Search by name/), 'zenbook');
    await waitFor(() => expect(webCalls().at(-1)).toMatchObject({ q: 'zenbook', budget_max_inr: 60000 })); expect(webCalls().at(-1).brand).toBeUndefined();
  });
  it('sort by price puts a laptop with no price last', async () => {
    await goWeb(); await screen.findByText('Showing 4 of 312'); await userEvent.selectOptions(screen.getByLabelText('Sort'), 'low');
    const names = Array.from(document.querySelectorAll('.web-card h3')).map((h) => h.textContent); expect(names).toEqual(['HP Pavilion 15', 'Dell Inspiron 14', 'Lenovo IdeaPad Slim 5 14', 'ASUS Zenbook 14 OLED']);
  });
  it('Compare tick builds a custom laptop and compares it with a catalog pick', async () => {
    await goWeb(); await screen.findByText('Showing 4 of 312');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Compare Lenovo IdeaPad Slim 5 14' }));
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled(); expect(screen.getByText('Tick at least one catalog laptop too')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^Catalog/ })); await userEvent.click(await screen.findByRole('checkbox', { name: 'Compare MacBook Air M1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compare' })); await waitFor(() => expect(calls.some((c) => c.action === 'compare')).toBe(true));
    expect(calls.find((c) => c.action === 'compare')).toMatchObject({ variant_ids: ['A1'], custom: [{ name: 'Lenovo IdeaPad Slim 5 14', price_inr: 68990, ram_gb: 16, storage_gb: 512, display_size: 14, weight_kg: 1.46, cpu: 'Ryzen 7 7730U' }] });
  });
  it('an empty table says so honestly and keeps the web search button', async () => {
    web = { ...webBlock(), total: 0, rows: [] }; await goWeb();
    expect(await screen.findByText(/I have not collected laptops from the web yet/)).toBeInTheDocument(); expect(screen.getByText('More laptops from the web (0, not verified)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search the web too' })).toBeInTheDocument();
  });
  it('a failed request says nothing is shown and does not guess', async () => {
    web = { type: 'nothing' }; await goWeb(); expect(await screen.findByText(/could not load the laptops from the web/)).toBeInTheDocument();
  });
});

describe('web_picks with eight items', () => {
  const show = (ctx: Partial<typeof noopCtx> = {}) => render(<CtxContext.Provider value={{ ...noopCtx, ...ctx }}><BlockView block={fx('web_picks').blocks[0]} /></CtxContext.Provider>);
  it('lists all eight compactly with the match pill, and "See all" opens the web tier with the budget', async () => {
    const goto = vi.fn(); show({ goto, savedNeeds: () => ({ budget_max_inr: 70000, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] }) });
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(8); expect(document.querySelector('.wp-compact')).not.toBeNull(); expect(document.querySelectorAll('.match-pill')).toHaveLength(8);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('From the web, not verified'); expect(screen.getAllByRole('link').every((a) => (a as HTMLAnchorElement).href.startsWith('https://'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'See all laptops from the web' })); expect(goto).toHaveBeenCalledWith('explore'); expect(JSON.parse(sessionStorage.getItem('lapfit.explore.web')!)).toEqual({ budget: 70000 });
  });
});
