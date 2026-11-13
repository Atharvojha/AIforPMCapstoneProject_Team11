import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailSheet } from '../components/blocks/DetailSheet';
import { fx } from './helpers';
import type { Block } from '../lib/types';

const cards = fx('shortlist').blocks.find((b) => b.type === 'cards')!.cards as any[];
const prov = { type: 'provenance', catalog: { used: true, prices_as_of: '2026-11-10', verified: false, live: false }, dataset: { used: false, opinions: 0, machine_read: true, lenses: [], reviews_total: 10, dated: false }, live: { used: false, items: 0 }, ai: { reader: 'none', wording: 'templates', degraded: null }, checks: { gate: false }, affiliate: { links: true } } as unknown as Block;
const open = (extra: Partial<Parameters<typeof DetailSheet>[0]> = {}) => {
  const onClose = vi.fn(); const onAction = vi.fn();
  render(<DetailSheet card={cards[0]} blocks={[{ type: 'cards', cards } as Block, prov]} busy={false} onClose={onClose} onAction={onAction} {...extra} />);
  return { onClose, onAction };
};

describe('Detail sheet', () => {
  it('has Fit, Specs and Trust tabs, and Trust shows the trust line and the receipt', async () => {
    open(); const tabs = screen.getAllByRole('tab'); expect(tabs.map((t) => t.textContent)).toEqual(['Fit', 'Specs', 'Trust']);
    await userEvent.click(screen.getByRole('tab', { name: 'Trust' }));
    const panel = screen.getByRole('tabpanel'); expect(within(panel).getByText('Not human-verified')).toBeTruthy(); expect(within(panel).getByText(/How I built this answer/)).toBeTruthy();
  });
  it('Specs tab lists the spec lines', async () => {
    open(); await userEvent.click(screen.getByRole('tab', { name: 'Specs' }));
    for (const l of cards[0].spec_lines) expect(within(screen.getByRole('tabpanel')).getByText(l)).toBeTruthy();
  });
  it('Where to buy carries the Affiliate label when the reply has affiliate links, and closes then fires the action', async () => {
    const { onClose, onAction } = open(); const buy = screen.getByRole('button', { name: /Where to buy/ });
    expect(within(buy).getByText('Affiliate')).toBeTruthy();
    await userEvent.click(buy); expect(onClose).toHaveBeenCalled(); expect(onAction).toHaveBeenCalledWith({ action: 'where_to_buy', variant_id: cards[0].variant_id }, expect.stringContaining('Where to buy'));
  });
  it('Owners say and Full check fire the existing actions', async () => {
    const { onAction } = open(); await userEvent.click(screen.getByRole('button', { name: 'Owners say' })); await userEvent.click(screen.getByRole('button', { name: 'Full check' }));
    expect(onAction.mock.calls.map((c) => (c[0] as any).action)).toEqual(['owner_voice', 'second_opinion']);
  });
  it('shows no label when the reply says nothing about affiliate links, and nothing when no card', () => {
    open({ blocks: [{ type: 'cards', cards } as Block] }); expect(screen.queryByText('Affiliate')).toBeNull();
  });
  it('does not crash when the sheet starts empty and then receives a laptop (what happens when Details is tapped), and again when closed and reopened', () => {
    const props = { blocks: [{ type: 'cards', cards } as Block], busy: false, onClose: vi.fn(), onAction: vi.fn() };
    const { rerender, container } = render(<DetailSheet card={null} {...props} />); expect(container.innerHTML).toBe('');
    rerender(<DetailSheet card={cards[0]} {...props} />); expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(<DetailSheet card={null} {...props} />); expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<DetailSheet card={cards[1]} {...props} />); expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
