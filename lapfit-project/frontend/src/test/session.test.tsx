import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SliderInput } from '../components/SliderInput';
import { AskLaptopForm, AskLaptop, AskRepeatContext } from '../components/blocks/AskLaptop';
import { Composer } from '../components/Composer';
import { AskScreen } from '../screens/AskScreen';
import { CatalogProvider } from '../state/useCatalog';
import { CtxContext, noopCtx } from '../components/ctx';
import { createSessionStore } from '../lib/session';
import { useThread } from '../state/useThread';
import { fx, cfg } from './helpers';

const ok = (name: string) => async () => ({ ok: true as const, reply: fx(name) });
const picks = { ids: [] as string[], names: {}, has: () => false, toggle() {}, remove() {}, clear() {} };

describe('SliderInput', () => {
  const Host = ({ onChange = () => {} }: { onChange?(n: number): void }) => { const [v, set] = useState<number | null>(60000); return <SliderInput label="Budget up to" fieldLabel="Type a budget" value={v} onChange={(n) => { set(n); onChange(n); }} min={10000} max={300000} step={5000} prefix="₹" format={(n) => n.toLocaleString('en-IN')} />; };
  it('the slider and the typed field stay in sync', async () => {
    render(<Host />); const field = screen.getByRole('textbox', { name: 'Type a budget' }) as HTMLInputElement; const range = screen.getByLabelText(/Budget up to/);
    fireEvent.change(range, { target: { value: '90000' } }); expect(field.value).toBe('90000');
    await userEvent.clear(field); await userEvent.type(field, '75000{Enter}'); expect(range).toHaveValue('75000'); expect(field.value).toBe('75000');
  });
  it('validates as you type, clamps with a plain hint, and Enter applies', async () => {
    const onChange = vi.fn(); render(<Host onChange={onChange} />); const field = screen.getByRole('textbox', { name: 'Type a budget' });
    await userEvent.clear(field); await userEvent.type(field, 'abc'); expect(screen.getByText(/not a number/)).toBeInTheDocument(); await userEvent.type(field, '{Enter}'); expect(onChange).not.toHaveBeenCalled();
    await userEvent.clear(field); await userEvent.type(field, '999999'); expect(screen.getByText(/highest I can set is ₹3,00,000/)).toBeInTheDocument(); await userEvent.type(field, '{Enter}'); expect(onChange).toHaveBeenLastCalledWith(300000);
    await userEvent.clear(field); await userEvent.type(field, '1.5 lakh{Enter}'); expect(onChange).toHaveBeenLastCalledWith(150000);
  });
});

describe('edit a sent message', () => {
  it('useThread.edit drops that turn and every reply after it, and resends from what came before', async () => {
    const send: any = vi.fn(ok('shortlist')); const { result } = renderHook(() => useThread(cfg, send));
    await act(async () => { await result.current.sendText('laptop for coding under 60k'); }); await act(async () => { await result.current.sendText('make it cheaper'); });
    const first = result.current.turns[0].id; const second = result.current.turns[1].id;
    await act(async () => { await result.current.edit(second, 'make it lighter'); });
    expect(result.current.turns.map((t) => t.user)).toEqual(['laptop for coding under 60k', 'make it lighter']); expect(result.current.turns.some((t) => t.id === second)).toBe(false);
    await act(async () => { await result.current.edit(first, 'gaming laptop'); }); expect(result.current.turns.map((t) => t.user)).toEqual(['gaming laptop']);
    expect(send.mock.calls.at(-1)[1].prior_needs).toBeUndefined(); expect(send.mock.calls.at(-1)[1].history).toBeUndefined();
  });
  const mount = (send: any) => { const Host = () => { const thread = useThread(cfg, send, undefined, createSessionStore(false)); return <AskScreen thread={thread} compare={picks} goto={() => {}} />; }; return render(<CatalogProvider cfg={cfg}><Host /></CatalogProvider>); };
  it('Edit puts the text back in the composer; Esc cancels; sending replaces the turn', async () => {
    const send: any = vi.fn(ok('shortlist')); mount(send);
    await userEvent.type(screen.getByLabelText('Your message'), 'laptop for coding{Enter}'); await screen.findByRole('button', { name: /Edit your message/ });
    await userEvent.click(screen.getByRole('button', { name: /Edit your message/ })); expect(await screen.findByText('Editing your message')).toBeInTheDocument(); expect(screen.getByLabelText('Your message')).toHaveValue('laptop for coding');
    await userEvent.keyboard('{Escape}'); expect(screen.queryByText('Editing your message')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Edit your message/ })); await userEvent.clear(screen.getByLabelText('Your message')); await userEvent.type(screen.getByLabelText('Your message'), 'laptop for gaming{Enter}');
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2)); expect(send.mock.calls[1][1].text).toBe('laptop for gaming'); await waitFor(() => expect(screen.getAllByText('laptop for gaming')).toHaveLength(1)); expect(screen.queryByText('laptop for coding')).toBeNull();
  });
});

describe('composer pill', () => {
  it('is a small pill that expands on click, collapses on Escape and outside click, and keeps the draft', async () => {
    render(<div><Composer onSend={vi.fn()} busy={false} cooldown={0} focusName="Acer Aspire 5 · 8 GB" /><button>outside</button></div>);
    const pill = screen.getByRole('button', { name: /Ask a follow-up/ }); expect(pill).toHaveAttribute('aria-expanded', 'false'); expect(pill).toHaveTextContent('Acer Aspire 5'); expect(screen.getByLabelText('Your message')).not.toBeVisible();
    await userEvent.click(pill); const box = screen.getByLabelText('Your message'); expect(box).toHaveFocus(); await userEvent.type(box, 'hello'); await userEvent.keyboard('{Escape}'); expect(screen.getByLabelText('Your message')).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Ask a follow-up/ })); expect(screen.getByLabelText('Your message')).toHaveValue('hello'); await userEvent.click(screen.getByText('outside')); expect(screen.getByLabelText('Your message')).not.toBeVisible();
  });
  it('collapses after a successful send and opens by keyboard focus', async () => {
    const onSend = vi.fn().mockResolvedValue(true); render(<Composer onSend={onSend} busy={false} cooldown={0} />);
    await userEvent.tab(); expect(screen.getByLabelText('Your message')).toHaveFocus(); await userEvent.type(screen.getByLabelText('Your message'), 'hi{Enter}');
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('hi')); await waitFor(() => expect(screen.getByLabelText('Your message')).not.toBeVisible());
  });
});

describe('the three saved parts', () => {
  it('clearing the focus keeps the needs and the recommendations; requests carry them plus recommended and picked', async () => {
    const send: any = vi.fn(ok('shortlist')); const store = createSessionStore(false); const { result } = renderHook(() => useThread(cfg, send, undefined, store));
    await act(async () => { await result.current.sendText('laptop for coding under 60k'); });
    const b = store.get(); expect(b.needs?.budget_max_inr).toBe(60000); expect(b.recs.length).toBeGreaterThan(0); expect(b.recs.length).toBeLessThanOrEqual(10); expect(b.focus).toBeTruthy();
    act(() => result.current.clearFocus()); expect(store.get().focus).toBeNull(); expect(store.get().needs?.budget_max_inr).toBe(60000); expect(store.get().recs.length).toBe(b.recs.length);
    act(() => store.set({ picks: [{ id: 'FKL-10', name: 'A' }] }));
    await act(async () => { await result.current.sendText('change the budget to 80000'); });
    const body = send.mock.calls[1][1]; expect(body.focus).toBeUndefined(); expect(body.prior_needs.budget_max_inr).toBe(60000); expect(body.recommended).toEqual(b.recs.map((r) => r.id)); expect(body.picked).toEqual(['FKL-10']);
    act(() => result.current.clear()); expect(store.get()).toEqual({ needs: null, recs: [], focus: null, picks: [] });
  });
  it('the saved needs follow the newest understood reply', async () => {
    const r2 = JSON.parse(JSON.stringify(fx('shortlist'))); r2.blocks.find((x: any) => x.type === 'understood').needs.budget_max_inr = 80000;
    const send: any = vi.fn().mockResolvedValueOnce({ ok: true, reply: fx('shortlist') }).mockResolvedValueOnce({ ok: true, reply: r2 }); const store = createSessionStore(false); const { result } = renderHook(() => useThread(cfg, send, undefined, store));
    await act(async () => { await result.current.sendText('coding under 60k'); }); await act(async () => { await result.current.sendText('change the budget to 80000'); }); expect(store.get().needs?.budget_max_inr).toBe(80000);
  });
});

describe('ask_laptop', () => {
  const block = { type: 'ask_laptop', question: 'Which laptop are you asking about?', base: { text: 'is it good?', action: undefined, flow: 'x' }, choices: [{ variant_id: 'A-1', label: 'Acme Book · 8 GB · ₹40,000' }, { variant_id: 'A-2', label: 'Acme Book · 16 GB · ₹50,000' }], placeholder: 'e.g. Acme Book' };
  const view = (action = vi.fn(), repeat = false) => render(<CtxContext.Provider value={{ ...noopCtx, action }}><AskRepeatContext.Provider value={repeat}><AskLaptop b={block as any} /></AskRepeatContext.Provider></CtxContext.Provider>);
  it('choosing a button posts base plus variant_id', async () => { const action = vi.fn(); view(action); await userEvent.click(screen.getByRole('button', { name: /16 GB/ })); expect(action).toHaveBeenCalledWith(expect.objectContaining({ text: 'is it good?', variant_id: 'A-2' }), expect.stringContaining('16 GB')); });
  it('typing the name posts base plus laptop_text', async () => {
    const action = vi.fn(); view(action); const input = screen.getByRole('textbox', { name: 'Type the laptop’s name' }); expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(input, 'Acme Book 16{Enter}'); expect(action).toHaveBeenCalledWith(expect.objectContaining({ text: 'is it good?', laptop_text: 'Acme Book 16' }), 'Acme Book 16');
  });
  it('the same question twice in a row shows a note instead of repeating the buttons, and the box stays', () => {
    view(vi.fn(), true); expect(screen.getByText(/I still could not place that laptop/)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /16 GB/ })).toBeNull(); expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
  it('useThread.action adds the usual context to the answer', async () => {
    const send: any = vi.fn(ok('shortlist')); const { result } = renderHook(() => useThread(cfg, send, undefined, createSessionStore(false)));
    await act(async () => { await result.current.sendText('coding under 60k'); }); await act(async () => { await result.current.action({ text: 'x', variant_id: 'A-1' }, 'label'); });
    const body = send.mock.calls[1][1]; expect(body.variant_id).toBe('A-1'); expect(body.prior_needs).toBeTruthy(); expect(body.recommended.length).toBeGreaterThan(0);
  });
});
void AskLaptopForm;
