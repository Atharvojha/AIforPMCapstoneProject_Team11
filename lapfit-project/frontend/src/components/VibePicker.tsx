import { useEffect, useId, useState } from 'react';
import { useCatalog } from '../state/useCatalog';
import type { Needs } from '../lib/types';

export const VIBES: { id: string; icon: string; label: string; use: string }[] = [
  { id: 'study', icon: '🎓', label: 'Study', use: 'study' }, { id: 'coding', icon: '💻', label: 'Code', use: 'coding' }, { id: 'gaming', icon: '🎮', label: 'Game', use: 'gaming' },
  { id: 'editing', icon: '🎨', label: 'Create', use: 'editing' }, { id: 'travel', icon: '✈️', label: 'Travel light', use: 'travel' }, { id: 'stylish', icon: '🪞', label: 'Look stylish', use: '' },
];
/** Slider stops. null = no limit. The quick-pick chips below the slider jump to 30k / 45k / 60k / 80k / no limit. */
export const BUDGETS: (number | null)[] = [20000, 30000, 45000, 60000, 80000, 100000, 150000, null];
const STOPS = [1, 2, 3, 4, 7];
const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
export const budgetText = (n: number | null) => (n == null ? 'No limit' : n >= 100000 ? `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh` : rupees(n));
const short = (n: number | null) => (n == null ? 'No limit' : n >= 100000 ? `₹${n / 100000}L` : `₹${n / 1000}k`);

/** The state of the Ask form, kept in one place so the picker (tiles + budget) and the sticky button can sit apart on the page. */
export function useVibes(onNeeds: (n: Needs, label: string) => void, onText: (t: string) => void) {
  const { rows, load } = useCatalog(); useEffect(load, [load]);
  const [picked, setPicked] = useState<string[]>([]); const [idx, setIdx] = useState(3);
  const budget = BUDGETS[idx]; const cap = budget == null ? ` ` : ` under ${budgetText(budget)}`;
  const prices = rows.filter((r) => r.recommendable && r.price_inr != null).map((r) => r.price_inr as number);
  const within = prices.filter((p) => budget == null || p <= budget).length;
  const uses = VIBES.filter((v) => picked.includes(v.id) && v.use).map((v) => v.use); const stylish = picked.includes('stylish');
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const go = () => {
    if (stylish) onText(`A stylish laptop${uses.length ? ` for ${uses.join(' and ')}` : ''}${cap}`.trimEnd());
    else onNeeds({ budget_max_inr: budget, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: uses }, `${uses.length ? uses.join(' + ') : 'Anything'}${budget == null ? ', no budget limit' : cap}`);
  };
  return { picked, toggle, idx, setIdx, budget, within, go };
}
export type Vibes = ReturnType<typeof useVibes>;

/** Six tiles and one budget slider with five quick stops. That is the whole form; the button is the sticky AskCta. */
export function VibePicker({ v }: { v: Vibes }) {
  const id = useId();
  return (
    <section className="vibe-picker" aria-label="Pick what you need">
      <h3>What’s it for?</h3>
      <div className="tiles" role="group" aria-label="Pick one or more">{VIBES.map((x) => <button type="button" key={x.id} className={`tile ${v.picked.includes(x.id) ? 'on' : ''}`} aria-pressed={v.picked.includes(x.id)} onClick={() => v.toggle(x.id)}><span className="tile-icon" aria-hidden="true">{x.icon}</span><span className="tile-text">{x.label}</span></button>)}</div>
      <div className="budget-pick">
        <label htmlFor={id}>Budget up to <strong>{budgetText(v.budget)}</strong></label>
        <input id={id} type="range" min={0} max={BUDGETS.length - 1} step={1} value={v.idx} aria-valuetext={`${budgetText(v.budget)}, ${v.within} laptops in the catalog ${v.budget == null ? 'in all' : 'at or under this price'}`} onChange={(e) => v.setIdx(Number(e.target.value))} />
        <div className="stops" role="group" aria-label="Quick budgets">{STOPS.map((i) => <button type="button" key={i} className={`stop ${v.idx === i ? 'on' : ''}`} aria-pressed={v.idx === i} onClick={() => v.setIdx(i)}>{short(BUDGETS[i])}</button>)}</div>
      </div>
    </section>
  );
}

/** The one primary button of the Ask screen. Sticky above the tab bar. */
export function AskCta({ v, busy }: { v: Vibes; busy: boolean }) {
  return <div className="ask-cta"><button className="btn big-cta" disabled={busy} onClick={v.go}>Show me laptops <span aria-hidden="true">→</span></button></div>;
}
