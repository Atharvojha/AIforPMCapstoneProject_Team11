import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockView } from '../components/blocks/BlockView';
import { CtxContext, noopCtx, type Ctx } from '../components/ctx';
import { fx, fixtures } from './helpers';
import type { Block } from '../lib/types';

const withCtx = (ui: React.ReactElement, ctx: Partial<Ctx> = {}) => <CtxContext.Provider value={{ ...noopCtx, ...ctx }}>{ui}</CtxContext.Provider>;
const show = (b: Block, ctx: Partial<Ctx> = {}) => render(withCtx(<BlockView block={b} />, ctx));
const block = (name: string, type: string): Block => { const b = fx(name).blocks.find((x) => x.type === type); if (!b) throw new Error(`${name} has no ${type}`); return b; };

describe('every block in every real backend reply renders without crashing', () => {
  for (const [name, f] of Object.entries(fixtures)) {
    it(name, () => {
      const { container } = render(withCtx(<>{f.reply.blocks.map((b, i) => <BlockView key={i} block={b} />)}</>));
      expect(container.textContent).not.toMatch(/undefined|NaN|\[object Object\]|_gate/);
    });
  }
});

describe('cards', () => {
  it('show one best fit and two rows, each with its price date and data status, and "Show 2 more" reveals the rest', async () => {
    show(block('shortlist', 'cards'));
    expect(screen.getAllByRole('article')).toHaveLength(3); expect(screen.getAllByText(/as of 10 Nov 2026/).length).toBe(3);
    expect(screen.getAllByText(/not human-verified/i).length).toBe(3); expect(screen.getByText('Best fit for what you said')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show 2 more' })); expect(screen.getAllByRole('article')).toHaveLength(5); expect(screen.getAllByText(/as of 10 Nov 2026/).length).toBe(5);
  });
  it('rows say how they differ from the best fit using only the card numbers; an unknown price is "?", never ₹0; a near tie shows two heroes', () => {
    const base = (block('shortlist', 'cards').cards as any[])[0]; const mk = (o: any) => ({ ...base, ...o, specs: { ...base.specs, ...(o.specs ?? {}) } });
    const cards = [mk({}), mk({ variant_id: 'x1', name: 'B · 8 GB / 512 GB', price_inr: 37990, price_text: '₹37,990', specs: { weight_kg: 1.6 } }), mk({ variant_id: 'x2', name: 'C · 8 GB / 512 GB', price_inr: 0, price_text: '₹0' })];
    show({ type: 'cards', title: '3 laptops within your budget', first: 3, requireAll: true, cards });
    expect(screen.getByText('₹4,000 costlier · 0.2 kg lighter')).toBeInTheDocument(); expect(document.body.textContent).not.toMatch(/₹0\b/); expect(within(screen.getByRole('article', { name: /^C ·/ })).getByText('?')).toBeInTheDocument();
    document.body.innerHTML = ''; show({ type: 'cards', title: 't', first: 3, requireAll: false, cards: [mk({}), mk({ variant_id: 'x3', name: 'D · 8 GB / 512 GB', price_inr: 34100, price_text: '₹34,100' })] });
    expect(screen.getAllByText('Tie')).toHaveLength(2); expect(document.querySelectorAll('.bhero')).toHaveLength(2);
  });
  it('Must items carry an accessible meets / does not meet word, not only a symbol', () => {
    const base = (block('shortlist', 'cards').cards as any[])[0];
    show({ type: 'cards', title: 't', first: 3, requireAll: false, cards: [{ ...base, musts: [{ label: 'RAM 16 GB or more', ok: true, actual: '16 GB' }, { label: 'Weight up to 1.2 kg', ok: false, actual: '1.8 kg' }, { label: 'Colour: Blue', ok: null, actual: 'not in catalog' }] }] });
    expect(document.body.textContent).toMatch(/Meets: RAM 16 GB/); expect(document.body.textContent).toMatch(/Does not meet: Weight/); expect(document.body.textContent).toMatch(/Unknown: Colour/);
    expect(screen.getByText('RAM 16 GB or more').closest('li')).toHaveClass('true');
  });
  it('the compare toggle calls back with the laptop id and name; Details (and tapping a row) open the detail sheet through the app', async () => {
    const toggle = vi.fn(); const openDetail = vi.fn();
    show(block('shortlist', 'cards'), { compare: { ids: [], has: () => false, toggle }, openDetail } as any);
    await userEvent.click(screen.getAllByLabelText('Compare')[0]); expect(toggle).toHaveBeenCalledWith(expect.stringMatching(/^(FKL|AMZ)-/), expect.stringContaining('·'));
    await userEvent.click(screen.getByRole('button', { name: 'Details' })); expect(openDetail).toHaveBeenCalledWith(expect.objectContaining({ variant_id: expect.any(String) }));
    await userEvent.click(screen.getAllByRole('button', { name: /^Details: / })[0]); expect(openDetail).toHaveBeenCalledTimes(2);
  });
it('a budget-only Must is not listed as a Must when every card meets it', () => { show(block('shortlist', 'cards')); expect(screen.queryByLabelText('Your Must items')).toBeNull(); });
  it('the card face keeps one shopping button (Where to buy); Owners say and Full check live in the detail sheet', () => { show(block('shortlist', 'cards')); for (const n of ['Owners say', 'Full check']) expect(screen.queryByRole('button', { name: n })).toBeNull(); expect(screen.getAllByRole('button', { name: /Where to buy/ })).toHaveLength(1); });
});

describe('understood needs', () => {
  const needsBlock = (): Block => ({ type: 'understood', matched: 3, needs: { budget_max_inr: 60000, budget_min_inr: null, use_cases: ['coding'], shoulds: [], nices: [],
    musts: [{ attribute: 'ram_gb', operator: '>=', value: 8, label: 'RAM 8 GB or more', supported: true }, { attribute: 'touchscreen', operator: '=', value: 'yes', label: 'touchscreen yes', supported: false }] } });
  it('shows the use, each need as a chip with its importance, the budget as a slider, and marks needs that cannot be checked', () => {
    show(needsBlock()); expect(screen.getAllByText(/coding/).length).toBeGreaterThanOrEqual(1); expect(screen.getByLabelText(/Budget up to/)).toHaveAttribute('type', 'range'); expect(screen.getByLabelText(/Budget up to/)).toHaveValue('4');
    expect(screen.getByRole('button', { name: /RAM 8 GB or more: Must/ })).toBeInTheDocument(); expect(screen.getByText(/cannot be checked yet/)).toBeInTheDocument(); expect(document.querySelectorAll('select, input[type=text], input:not([type=range])')).toHaveLength(0);
  });
  it('tapping a chip changes how much it matters (Should, then Must, then Nice); the cross removes it; Update sends the edited needs', async () => {
    const sendNeeds = vi.fn(); show(needsBlock(), { sendNeeds }); expect(screen.queryByRole('button', { name: 'Update results' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /RAM 8 GB or more: Must/ })); expect(screen.getByRole('button', { name: /RAM 8 GB or more: Nice/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /RAM 8 GB or more: Nice/ })); expect(screen.getByRole('button', { name: /RAM 8 GB or more: Should/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove touchscreen yes' })); await userEvent.click(screen.getByRole('button', { name: 'Update results' }));
    const sent = sendNeeds.mock.calls[0][0]; expect(sent.musts).toHaveLength(0); expect(sent.shoulds).toHaveLength(1); expect(sent.shoulds[0].attribute).toBe('ram_gb'); expect(sent.budget_max_inr).toBe(60000);
  });
  it('dragging the budget changes it; "No budget limit" removes it; both offer Update', async () => {
    const sendNeeds = vi.fn(); const { unmount } = show(needsBlock(), { sendNeeds }); fireEvent.change(screen.getByLabelText(/Budget up to/), { target: { value: '6' } });
    await userEvent.click(screen.getByRole('button', { name: 'Update results' })); expect(sendNeeds.mock.calls[0][0].budget_max_inr).toBe(100000); unmount();
    show(needsBlock(), { sendNeeds }); await userEvent.click(screen.getByRole('button', { name: 'No budget limit' })); expect(screen.getByRole('button', { name: '＋ Add a budget' })).toBeInTheDocument(); await userEvent.click(screen.getByRole('button', { name: 'Update results' })); expect(sendNeeds.mock.calls[1][0].budget_max_inr).toBeNull();
  });
});

describe('evidence and live reviews', () => {
  it('thin evidence shows "not enough evidence" with no percentage, no bar and no quotes', () => {
    show({ type: 'evidence', laptop: 'X · 8 GB', min_n: 20, topics: [{ topic: 'battery', n: 5, enough: false, positive: 4, negative: 1, other_polarity: 0, quotes: [] }] });
    expect(screen.getByText(/Not enough evidence yet \(n = 5; we need at least 20\)/)).toBeInTheDocument(); expect(screen.queryByLabelText(/positive and .* negative of/)).toBeNull(); expect(screen.queryByText(/👍/)).toBeNull();
  });
  it('enough evidence shows counts, a bar with a text alternative, and attributed machine-read quotes', () => {
    show(block('owner_voice', 'evidence')); expect(screen.getAllByLabelText(/positive and .* negative of/)[0]).toBeInTheDocument(); expect(document.body.textContent).toMatch(/machine-read/);
  });
  it('live reviews are labelled live and unverified, and every link opens safely', () => {
    show(block('owner_voice', 'live_reviews')); expect(screen.getByText('Live, not verified')).toBeInTheDocument();
    const links = screen.getAllByRole('link'); expect(links.length).toBeGreaterThan(0); for (const a of links) { expect(a).toHaveAttribute('target', '_blank'); expect(a.getAttribute('rel')).toMatch(/noopener/); expect(a.getAttribute('href')).toMatch(/^https:\/\//); }
  });
  it('a non-https or script link from a source is never rendered as a link', () => {
    show({ type: 'live_reviews', laptop: 'X', status: 'ok', note: 'n', items: [{ snippet: 'bad', url: 'javascript:alert(1)', site: 'evil', kind: 'excerpt' }, { snippet: 'http only', url: 'http://insecure.test', site: 'plain', kind: 'excerpt' }] });
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
  it('live results that are switched off take no space', () => { const { container } = show({ type: 'live_reviews', laptop: 'X', status: 'off', items: [], note: 'off' }); expect(container).toBeEmptyDOMElement(); });
  it('error and limit states keep their plain explanation', () => { show({ type: 'live_reviews', laptop: 'X · Y', status: 'error', note: 'I could not reach live sources just now', items: [] }); expect(screen.getByText(/could not reach live sources/)).toBeInTheDocument(); });
});

describe('tables and plans', () => {
  it('compare marks the best value and shows the evidence row', () => { show(block('compare', 'compare')); expect(screen.getAllByText(/✓ best/).length).toBeGreaterThan(0); expect(screen.getByText('Owner opinions')).toBeInTheDocument(); expect(screen.getAllByRole('columnheader').length).toBeGreaterThanOrEqual(4); });
  it('compare opens as a sheet: one "Pick X if … matters" line from the best marks, Hide same hides rows that are equal, shapes sit behind a button', async () => {
    show(block('compare', 'compare')); expect(screen.getAllByText(/^Pick .* if .* matters/).length).toBeGreaterThan(0); expect(screen.getByRole('dialog', { name: /Compare 3 laptops/ })).toBeInTheDocument();
    expect(screen.getByText('RAM')).toBeInTheDocument(); await userEvent.click(screen.getByRole('checkbox', { name: 'Hide same' })); expect(screen.queryByText('Warranty')).toBeNull(); expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(document.querySelector('.multi-radar')).toBeNull(); await userEvent.click(screen.getByRole('button', { name: 'Shapes' })); expect(document.querySelector('.multi-radar')).toBeTruthy();
  });
  it('the team plan shows exact totals and says when the budget is exceeded', () => { show(block('team', 'team_plan')); expect(screen.getByText(/Total for/)).toBeInTheDocument(); expect(screen.getByText(/exact sums of price/)).toBeInTheDocument(); });
  it('the sell plan shows a range, the factors, the sample-assumption warning and the fix arithmetic', () => {
    show(block('sell', 'sell_plan')); expect(screen.getByText(/sample assumptions/i)).toBeInTheDocument(); expect(screen.getByText(/How this was worked out/)).toBeInTheDocument(); expect(screen.getByText(/Replace the battery/)).toBeInTheDocument();
  });
  it('my laptops shows warranty status and the days left', () => { show(block('mylaptops', 'my_laptops')); expect(screen.getByText(/Warranty (ends|ended)/)).toBeInTheDocument(); });
  it('claims show a status pill per claim and never a verdict without an approver', () => { show(block('pitch', 'claims')); expect(screen.getAllByText(/Does not match|Matches the catalog|Not checked yet|Not in catalog/).length).toBeGreaterThan(0); expect(screen.queryByText(/Approved by/)).toBeNull(); });
  it('market pulse and brand insights show their honest limits', () => { show(block('trending', 'market_pulse')); expect(document.body.textContent).toMatch(/cannot show price drops|No requests recorded/); });
});

describe('checklist and findings', () => {
  it('ticks are remembered on this device and the progress is counted', async () => {
    const b = block('used', 'checklist'); const { unmount } = show(b); const first = screen.getAllByRole('checkbox')[0]; await userEvent.click(first); expect(first).toBeChecked();
    expect(screen.getByText(/\(1 of 5, kept on this device\)/)).toBeInTheDocument(); unmount(); show(b); expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
  });
  it('findings have a screen-reader word for each level, and the "not a verdict" note', () => { show(block('used', 'findings')); expect(document.body.textContent).toMatch(/Check: |Note: |OK: /); expect(document.body.textContent).toMatch(/not a verdict/i); });
});

describe('choices, offers and safety', () => {
  it('a choice that ends with a space fills the text box; any other choice is sent', async () => {
    const sendText = vi.fn(), prefill = vi.fn(); show({ type: 'choices', question: 'q?', choices: [{ label: 'My budget', send: 'My budget is ' }, { label: 'Under 40k', send: 'under 40k' }] }, { sendText, prefill });
    await userEvent.click(screen.getByRole('button', { name: 'My budget' })); expect(prefill).toHaveBeenCalledWith('My budget is '); await userEvent.click(screen.getByRole('button', { name: 'Under 40k' })); expect(sendText).toHaveBeenCalledWith('under 40k');
  });
  it('an offer with needs sends them; an offer without needs opens the finder', async () => {
    const sendNeeds = vi.fn(), goto = vi.fn(); const n = { budget_max_inr: 70000, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] };
    const { unmount } = show({ type: 'offer', label: 'Raise it', needs: n }, { sendNeeds }); await userEvent.click(screen.getByRole('button', { name: 'Show these' })); expect(sendNeeds).toHaveBeenCalledWith(n); unmount();
    show({ type: 'offer', label: 'Try the finder', flow: 'shortlist' }, { goto }); await userEvent.click(screen.getByRole('button')); expect(goto).toHaveBeenCalledWith('find');
  });
  it('markup inside any text is shown as text, never run', () => {
    show({ type: 'text', text: '<img src=x onerror=alert(1)><script>alert(2)</script>' }); expect(document.querySelector('img')).toBeNull(); expect(document.querySelector('script')).toBeNull(); expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
  it('an unknown block type is mentioned, not a crash', () => { show({ type: 'something_new' }); expect(screen.getByText(/not shown in this version/)).toBeInTheDocument(); });
  it('the receipt code can be copied', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    show({ type: 'report_receipt', receipt: 'ABC123XYZ9', text: 'Thanks' }); await userEvent.click(screen.getByRole('button', { name: 'Copy code' })); expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
