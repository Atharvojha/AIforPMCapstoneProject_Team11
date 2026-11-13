import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockView } from '../components/blocks/BlockView';
import { CtxContext, noopCtx } from '../components/ctx';
import { ApiConfigContext } from '../components/api-context';
import { SpecPortrait } from '../components/viz/SpecPortrait';
import { ScaleScreens } from '../components/viz/ScaleScreens';
import { Bottles, PositionStrips } from '../components/viz/Looks';
import { glass, A4, differenceTags, strip, bottlesOf, fromCard, type Look } from '../lib/looks';
import { fx, cfg } from './helpers';
import type { Block } from '../lib/types';

const L = (id: string, o: Partial<Look> = {}): Look => ({ id, name: id, brand: 'Brand', price: 40000, ram: 8, screen: 15.6, weight: 1.8, battery: null, hz: null, gpu: null, ...o });
const set: Look[] = [L('a', { price: 30000, weight: 1.2, screen: 13.3 }), ...['b', 'c', 'd', 'e', 'f', 'g'].map((i, k) => L(i, { price: 40000 + k * 5000, weight: 1.6 + k * 0.1, screen: 15.6 })), L('h', { price: 90000, weight: 2.6, screen: 17.3, gpu: 'dedicated', hz: 144, ram: 16 })];
const withCtx = (ui: React.ReactElement) => <ApiConfigContext.Provider value={cfg}><CtxContext.Provider value={noopCtx}>{ui}</CtxContext.Provider></ApiConfigContext.Provider>;
const block = (name: string, type: string): Block => fx(name).blocks.find((x) => x.type === type)!;

describe('look logic', () => {
  it('screen glass is sized from the diagonal at 16:9 and the A4 sheet is 29.7 x 21 cm', () => {
    const g = glass(15.6); expect(g.w).toBeCloseTo(34.5, 0); expect(g.h).toBeCloseTo(19.4, 0); expect(g.area).toBeCloseTo(g.w * g.h, 5); expect(glass(17.3).w).toBeGreaterThan(glass(13.3).w); expect(A4).toEqual({ w: 29.7, h: 21 });
  });
  it('tags are counts over laptops that have the value: extremes first, then plain positions; nothing for unknowns or tiny sets', () => {
    expect(differenceTags(set[0], set).map((t) => t.txt)).toEqual(expect.arrayContaining(['Lightest of the 8', 'Smallest screen of the 8', 'Lowest price of the 8']));
    const hi = differenceTags(set[7], set, 6).map((t) => t.txt); expect(hi).toEqual(expect.arrayContaining(['Heaviest of the 8', 'Biggest screen of the 8', 'Highest price of the 8', '16 GB RAM, one of 1', 'Dedicated graphics (1 of 1)'.replace('1 of 1', '1 of 8')].filter((x) => !x.includes('Dedicated'))));
    const mid = differenceTags(set[3], set, 2); expect(mid.length).toBe(2); for (const t of mid) expect(t.txt).toMatch(/ of 7$/);
    expect(differenceTags(L('x', { weight: null, price: null, screen: null }), set)).toEqual([]); expect(differenceTags(set[0], set.slice(0, 3))).toEqual([]);
  });
  it('a strip ignores laptops without the value, is null with fewer than 3 known, and puts the lowest at 0 and the highest at 1', () => {
    const s = strip(set[0], set, 'weight')!; expect(s.self).toBe(0); expect(strip(set[7], set, 'weight')!.self).toBe(1); expect(s.others.length).toBe(7);
    expect(strip(set[0], [set[0], L('z', { weight: null }), L('y', { weight: null })], 'weight')).toBeNull(); expect(strip(L('q', { battery: null }), set, 'battery')).toBeNull();
  });
  it('bottles are weight in kg to one decimal, and unknown stays unknown', () => { expect(bottlesOf(1.29)).toBe(1.3); expect(bottlesOf(null)).toBeNull(); });
  it('fromCard reads recorded specs and treats 0 or missing as unknown', () => { const l = fromCard({ variant_id: 'v', name: 'X · 8 GB', price_inr: 0, specs: { display_size: 14, weight_kg: null, ram_gb: 8, gpu_class: 'dedicated' } }); expect(l.price).toBeNull(); expect(l.screen).toBe(14); expect(l.weight).toBeNull(); expect(l.gpu).toBe('dedicated'); });
});

describe('look visuals', () => {
  it('the portrait says it is a drawing, follows the screen size, shows vents and Hz only when recorded, and "RAM ?" when unknown', () => {
    const a = render(<SpecPortrait look={set[7]} />); expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Drawn from the recorded specs, not a photo/); expect(a.container.textContent).toMatch(/144 Hz/); const wBig = Number(a.container.querySelectorAll('rect')[0].getAttribute('width')); a.unmount();
    const b = render(<SpecPortrait look={L('k', { screen: 13.3, ram: null })} />); expect(b.container.textContent).not.toMatch(/Hz/); expect(b.container.textContent).toMatch(/RAM \?/); expect(Number(b.container.querySelectorAll('rect')[0].getAttribute('width'))).toBeLessThan(wBig);
  });
  it('same-scale screens need two known screens, skip unknown ones, and state the 16:9 assumption', () => {
    expect(render(<ScaleScreens items={[{ name: 'A', screen: 14 }, { name: 'B', screen: null }]} />).container.innerHTML).toBe('');
    const { container } = render(<ScaleScreens items={[{ name: 'A · x', screen: 13.3 }, { name: 'B', screen: 17.3 }, { name: 'C', screen: null }]} />); expect(container.querySelector('svg')!.getAttribute('aria-label')).toMatch(/same scale.*A4.*16:9/); expect(container.textContent).toMatch(/13\.3″.*about \d+ cm²/); expect(container.textContent).toMatch(/not drawn/); expect(container.textContent).not.toMatch(/C ·/);
  });
  it('bottles show the weight and the unit; unknown weight shows "?"', () => { const { unmount } = render(<Bottles kg={1.29} />); expect(screen.getByText(/about 1.3 one-litre bottles/)).toBeInTheDocument(); unmount(); render(<Bottles kg={null} />); expect(screen.getByText('Weight ?')).toBeInTheDocument(); });
  it('position strips describe each value in words and only show rows with enough data', () => { render(<PositionStrips look={set[0]} all={set} />); expect(screen.getByRole('group', { name: /left is the lowest/ })).toBeInTheDocument(); expect(screen.getAllByRole('img').length).toBe(4); });
});

describe('look in the results', () => {
  it('the hero shows a drawing first, a switch brings the photo (with attribution), and another switch brings the drawing back', async () => {
    render(withCtx(<BlockView block={block('shortlist', 'cards')} />)); const hero = document.querySelector('.bhero') as HTMLElement;
    expect(hero.querySelector('.spec-portrait')).toBeInTheDocument(); expect(within(hero).getByText(/Drawn from the specs, not a photo/)).toBeInTheDocument();
    await userEvent.click(within(hero).getByRole('button', { name: 'Show photo' })); expect(hero.querySelector('img')).toBeInTheDocument(); expect(within(hero).getByText(/Photo:/)).toBeInTheDocument(); expect(hero.querySelector('.spec-portrait')).toBeNull();
    await userEvent.click(within(hero).getByRole('button', { name: 'Show drawing' })); expect(hero.querySelector('.spec-portrait')).toBeInTheDocument();
  });
  it('compare shows the screens at the same scale above the table', () => { render(withCtx(<BlockView block={block('compare', 'compare')} />)); expect(document.querySelector('.scale-screens')).toBeInTheDocument(); expect(screen.getByRole('img', { name: /same scale/ })).toBeInTheDocument(); });
  it('a laptop with no photo on file still shows the drawing, says there is no photo, and has no Show photo button', () => {
    const b = JSON.parse(JSON.stringify(block('shortlist', 'cards'))); for (const c of b.cards) c.image = null;
    render(withCtx(<BlockView block={b} />)); const hero = document.querySelector('.bhero') as HTMLElement;
    expect(hero.querySelector('.spec-portrait')).toBeInTheDocument(); expect(within(hero).getByText(/No photo on file for this laptop/)).toBeInTheDocument(); expect(within(hero).queryByRole('button', { name: /Show photo/ })).toBeNull();
  });
});
