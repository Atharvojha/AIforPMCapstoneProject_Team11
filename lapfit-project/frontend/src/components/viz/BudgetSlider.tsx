import { SliderInput } from '../SliderInput';

export const BUDGET_STEPS = [20000, 30000, 40000, 50000, 60000, 80000, 100000, 150000, 200000];
const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
export const budgetLabel = (n: number) => (n >= 100000 ? `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh` : rupees(n));
export const BUDGET_MIN = 10000; export const BUDGET_MAX = 300000;

/**
 * One slider plus a number field you can type in: drag the budget and see, behind the track, how many laptops sit at each price.
 * The bars are counts of the catalog list the server sent; the real results always come from the server.
 */
export function BudgetSlider({ value, onChange, prices, label = 'Budget up to' }: { value: number; onChange(v: number): void; prices: number[]; label?: string }) {
  const bins = BUDGET_STEPS.map((s, i) => prices.filter((p) => p <= s && p > (BUDGET_STEPS[i - 1] ?? 0)).length); const top = Math.max(1, ...bins);
  const within = prices.filter((p) => p <= value).length;
  return (
    <div className="budget-slider">
      <SliderInput label={label} fieldLabel="Type a budget in rupees" value={value} onChange={onChange} min={BUDGET_MIN} max={BUDGET_MAX} stops={BUDGET_STEPS} prefix="₹" format={(n) => n.toLocaleString('en-IN')}
        hint="You can also type an amount, like 75000 or 1.5 lakh."
        valueText={(v) => `${budgetLabel(v ?? 0)}, ${within} laptops in the catalog at or under this price`}>
        <div className="hist" aria-hidden="true">{bins.map((n, i) => <i key={i} className={BUDGET_STEPS[i] <= Math.max(value, BUDGET_STEPS[0]) || (i > 0 && BUDGET_STEPS[i - 1] < value) ? 'on' : ''} style={{ height: `${12 + (n / top) * 40}px` }} title={`${n} laptops`} />)}</div>
      </SliderInput>
      <p className="muted small slider-note">{within} laptop{within === 1 ? '' : 's'} in the catalog at or under {budgetLabel(value)}</p>
    </div>
  );
}
