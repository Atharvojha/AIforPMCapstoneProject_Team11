import { useId } from 'react';

export const BUDGET_STEPS = [20000, 30000, 40000, 50000, 60000, 80000, 100000, 150000, 200000];
const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
export const budgetLabel = (n: number) => (n >= 100000 ? `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh` : rupees(n));

/**
 * One slider instead of a field: drag the budget and see, behind the track, how many laptops sit at each price.
 * The bars are counts of the catalog list the server sent; the real results always come from the server.
 */
export function BudgetSlider({ value, onChange, prices, label = 'Budget up to' }: { value: number; onChange(v: number): void; prices: number[]; label?: string }) {
  const id = useId(); const idx = Math.max(0, BUDGET_STEPS.findIndex((s) => s >= value) === -1 ? BUDGET_STEPS.length - 1 : BUDGET_STEPS.findIndex((s) => s >= value));
  const bins = BUDGET_STEPS.map((s, i) => prices.filter((p) => p <= s && p > (BUDGET_STEPS[i - 1] ?? 0)).length); const top = Math.max(1, ...bins);
  const within = prices.filter((p) => p <= BUDGET_STEPS[idx]).length;
  return (
    <div className="budget-slider">
      <label htmlFor={id}>{label} <strong className="big">{budgetLabel(BUDGET_STEPS[idx])}</strong></label>
      <div className="hist" aria-hidden="true">{bins.map((n, i) => <i key={i} className={i <= idx ? 'on' : ''} style={{ height: `${12 + (n / top) * 40}px` }} title={`${n} laptops`} />)}</div>
      <input id={id} type="range" min={0} max={BUDGET_STEPS.length - 1} step={1} value={idx} aria-valuetext={`${budgetLabel(BUDGET_STEPS[idx])}, ${within} laptops in the catalog at or under this price`} onChange={(e) => onChange(BUDGET_STEPS[Number(e.target.value)])} />
      <p className="muted small slider-note">{within} laptop{within === 1 ? '' : 's'} in the catalog at or under {budgetLabel(BUDGET_STEPS[idx])}</p>
    </div>
  );
}
