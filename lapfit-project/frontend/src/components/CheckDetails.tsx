import { NumberField } from './NumberField';

export interface Known { price: number | null; age: number | null; battery: number | null; warranty: 'yes' | 'no' | null; warrantyMonths: number | null; bill: boolean | null; box: boolean | null }
export const noKnown: Known = { price: null, age: null, battery: null, warranty: null, warrantyMonths: null, bill: null, box: null };
export const hasKnown = (k: Known) => Object.values(k).some((v) => v != null);

/** Yes / No chips for something the seller may or may not have. Tapping the chosen one again clears it ("not sure"). */
export const Tri = ({ label, value, onChange }: { label: string; value: boolean | null; onChange(v: boolean | null): void }) => (
  <div className="tri" role="group" aria-label={label}><span>{label}</span>{([[true, 'Yes'], [false, 'No']] as const).map(([v, t]) => <button type="button" key={t} className={`chip ${value === v ? 'on' : ''}`} aria-pressed={value === v} onClick={() => onChange(value === v ? null : v)}>{t}</button>)}</div>
);

/** Step 3 of Check: what you already know, as typed fields and chips. Everything is optional; unknowns stay unknown. */
export function CheckDetails({ k, onChange }: { k: Known; onChange(k: Known): void }) {
  const set = (p: Partial<Known>) => onChange({ ...k, ...p });
  return (
    <div className="details-box check-details">
      <p className="muted small">Skip anything you do not know. Nothing here is guessed.</p>
      <div className="grid-fields">
        <NumberField id="cd-price" label="Asking price" unit="₹" value={k.price} min={1000} max={1000000} step={1000} onChange={(v) => set({ price: v })} />
        <NumberField id="cd-age" label="Age" unit="years" value={k.age} min={0} max={15} step={1} onChange={(v) => set({ age: v })} />
        <NumberField id="cd-bat" label="Battery health" unit="%" value={k.battery} min={30} max={100} step={1} onChange={(v) => set({ battery: v })} hint="From the battery or system report, if you have seen it." />
      </div>
      <div className="tri" role="group" aria-label="Warranty"><span>Warranty</span>
        {([['yes', 'Some left'], ['no', 'None / ended']] as const).map(([v, t]) => <button type="button" key={v} className={`chip ${k.warranty === v ? 'on' : ''}`} aria-pressed={k.warranty === v} onClick={() => set({ warranty: k.warranty === v ? null : v, warrantyMonths: v === 'no' ? null : k.warrantyMonths })}>{t}</button>)}</div>
      {k.warranty === 'yes' && <NumberField id="cd-wm" label="Months of warranty left" unit="months" value={k.warrantyMonths} min={1} max={60} step={1} onChange={(v) => set({ warrantyMonths: v })} />}
      <Tri label="Original bill" value={k.bill} onChange={(v) => set({ bill: v })} />
      <Tri label="Original box" value={k.box} onChange={(v) => set({ box: v })} />
    </div>
  );
}
