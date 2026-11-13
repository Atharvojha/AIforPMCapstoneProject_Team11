import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, renderHook, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deriveContext } from '../lib/focus';
import { useThread } from '../state/useThread';
import { AskScreen } from '../screens/AskScreen';
import { LaptopAnswer } from '../components/blocks/LaptopAnswer';
import { CtxContext, noopCtx } from '../components/ctx';
import { fx, cfg, fixtures } from './helpers';
import type { Reply } from '../lib/types';

const turn = (id: number, reply?: Reply) => ({ id, reply });
const answer = fixtures.laptop_answer.reply;
const ok = (reply: Reply) => async () => ({ ok: true as const, reply });
const compare = { ids: [], names: {}, has: () => false, toggle() {}, remove() {}, clear() {} };

describe('focus derivation', () => {
  it('takes the first card of a shortlist and up to 6 shown', () => {
    const c = deriveContext([turn(1, fx('shortlist'))]); const cards = (fx('shortlist').blocks.find((b) => b.type === 'cards')!.cards as any[]);
    expect(c.focus).toEqual({ variant_id: cards[0].variant_id, name: cards[0].name }); expect(c.shown.length).toBe(Math.min(6, cards.length)); expect(c.focusTurn).toBe(1);
  });
  it('compare gives shown but no focus', () => { const c = deriveContext([turn(1, fx('compare'))]); expect(c.focus).toBeNull(); expect(c.shown.map((s) => s.variant_id)).toContain('FKL-10'); });
  it('second opinion focuses on the checked laptop', () => { expect(deriveContext([turn(1, fx('second_opinion'))]).focus?.variant_id).toBe('FKL-10'); });
  it('owner voice focuses via the evidence block, and later shown survives', () => {
    const c = deriveContext([turn(1, fx('shortlist')), turn(2, fx('owner_voice'))]); expect(c.focus).toEqual({ variant_id: 'FKL-10', name: 'APPLE 2020 Macbook Air M1 · 8 GB / 256 GB' }); expect(c.shown.length).toBeGreaterThan(0);
  });
  it('a laptop answer sets the focus and an empty thread has none', () => { expect(deriveContext([turn(1, answer)]).focus?.variant_id).toBe('FKL-10'); expect(deriveContext([]).focus).toBeNull(); });
});

describe('sendText context', () => {
  it('attaches focus and shown, never the typed text, and clearing stops it', async () => {
    const send: any = vi.fn(ok(fx('shortlist'))); const { result } = renderHook(() => useThread(cfg, send));
    await act(async () => { await result.current.sendText('laptop for coding'); });
    expect(send.mock.calls[0][1].focus).toBeUndefined();
    await act(async () => { await result.current.sendText('Will this last 8 years?'); });
    const body = send.mock.calls[1][1]; expect(body.focus.variant_id).toBe(result.current.focus!.variant_id); expect(body.shown.length).toBeGreaterThan(0);
    expect(JSON.stringify([body.focus, body.shown])).not.toContain('Will this last'); expect(Object.keys(body.focus).sort()).toEqual(['name', 'variant_id']);
    act(() => result.current.clearFocus()); expect(result.current.focus).toBeNull();
    await act(async () => { await result.current.sendText('and now?'); });
    expect(send.mock.calls[2][1].focus).toBeUndefined();
  });
});

function Harness({ send }: { send: any }) { const thread = useThread(cfg, send); return <AskScreen thread={thread} compare={compare} goto={() => {}} />; }

describe('composer chip and follow-ups', () => {
  it('shows the chip, helper line and suggestion chips only with a focus; ✕ hides them; chips send text', async () => {
    const send: any = vi.fn(ok(fx('shortlist'))); render(<Harness send={send} />);
    expect(screen.queryByText(/Asking about/)).toBeNull(); expect(screen.queryByText(/I only talk about laptops/)).toBeNull();
    await userEvent.type(screen.getByLabelText('Your message'), 'laptop for coding{Enter}');
    await screen.findByText(/Asking about/); expect(screen.getByText(/I only talk about laptops/)).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask about this laptop, or a new one')).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: 'Will it last long?' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2)); expect(send.mock.calls[1][1].text).toBe('Will it last long?'); expect(send.mock.calls[1][1].focus).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Clear my selection/ }));
    expect(screen.queryByText(/Asking about/)).toBeNull(); expect(screen.queryByText(/I only talk about laptops/)).toBeNull(); expect(screen.queryByRole('button', { name: 'Common problems?' })).toBeNull();
  });
  it('opening Details makes that laptop the focus', async () => {
    const send: any = vi.fn(ok({ ...fx('shortlist') })); render(<Harness send={send} />);
    await userEvent.type(screen.getByLabelText('Your message'), 'laptop{Enter}'); await screen.findByText(/Asking about/);
    await userEvent.click(screen.getByRole('button', { name: /^Clear my selection/ })); expect(screen.queryByText(/Asking about/)).toBeNull();
    const cards = fx('shortlist').blocks.find((b) => b.type === 'cards')!.cards as any[];
    await userEvent.click(screen.getAllByRole('button', { name: /details|check|more/i })[0]);
    await screen.findByText(/Asking about/); expect(screen.getByText(/Asking about/).textContent).toContain(cards[0].name.split(' · ')[0]);
  });
});

describe('LaptopAnswer', () => {
  const view = (b: any, sendText = vi.fn()) => render(<CtxContext.Provider value={{ ...noopCtx, sendText }}><LaptopAnswer b={b} /></CtxContext.Provider>);
  const block = answer.blocks[0];
  it('renders sections with source tags, https links only, guardrail, badge and suggestions', async () => {
    const sendText = vi.fn(); view(block, sendText);
    expect(screen.getByText(block.headline)).toBeTruthy(); expect(screen.getByText('Catalog')).toBeTruthy(); expect(screen.getAllByText('Dataset').length).toBeGreaterThan(0); expect(screen.getAllByText('Web').length).toBeGreaterThan(0);
    expect(screen.getByText('Live, not verified')).toBeTruthy(); expect(screen.getByText(block.guardrail)).toBeTruthy(); expect(screen.getByText('What I can and can’t say')).toBeTruthy();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href')); expect(hrefs).toEqual(['https://example.com/review']);
    await userEvent.click(screen.getByRole('button', { name: 'Common problems?' })); expect(sendText).toHaveBeenCalledWith('Common problems?');
  });
  it('shows unknowns as ? and never renders markup', () => {
    view({ ...block, headline: '<b>x</b>', sections: [{ kind: 'catalog', title: 'T', items: [''], web: undefined }] }); expect(screen.getByText('<b>x</b>')).toBeTruthy(); expect(screen.getByText('?')).toBeTruthy();
  });
  it.each(['off', 'limit', 'error', 'empty'])('web status %s shows its note, not the live badge', (status) => {
    view({ ...block, sections: [{ kind: 'web', title: 'W', items: [], web: { status, items: [], note: `note for ${status}`, fetched_at: null } }] });
    expect(screen.getByText(`note for ${status}`)).toBeTruthy(); expect(screen.queryByText('Live, not verified')).toBeNull();
  });
});
void within;
