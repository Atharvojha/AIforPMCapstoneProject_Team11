import { useId, useState } from 'react';
import { loadOwned } from '../../lib/storage';
import { CUSTOM_FIELDS, parseCustom, type CustomLaptop } from './BoardLogic';

/** "Add my laptop": a laptop that is not in the catalog. Only the name is required; blank fields stay "?". Nothing typed here is logged or saved by this form. */
export function CustomLaptopForm({ onSubmit, onCancel }: { onSubmit: (l: CustomLaptop) => void; onCancel: () => void }) {
  const uid = useId(); const [form, setForm] = useState<Record<string, string>>({}); const [errors, setErrors] = useState<Record<string, string>>({}); const owned = loadOwned();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e: React.FormEvent) => { e.preventDefault(); const r = parseCustom(form); if (r.ok) onSubmit(r.laptop); else setErrors(r.errors); };
  const field = (k: string, label: string, unit: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="cl-field" key={k}>
      <label htmlFor={`${uid}-${k}`}>{label}{unit && <span className="muted"> ({unit})</span>}</label>
      <input id={`${uid}-${k}`} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${uid}-${k}-e` : undefined} {...props} />
      {errors[k] && <p className="cl-err" id={`${uid}-${k}-e`} role="alert">{errors[k]}</p>}
    </div>
  );
  return (
    <form className="custom-form" onSubmit={submit} aria-label="Add my laptop" noValidate>
      <p className="muted small">For a laptop that is not in the catalog. Only the name is needed. Anything you leave blank shows as “?”, and your numbers are shown as you entered them.</p>
      {owned.length > 0 && (
        <div className="cl-saved"><span className="small"><strong>From “You”</strong> (saved on this device)</span>
          <div className="cl-saved-list">{owned.map((o) => <button type="button" key={o.id} className={`chip ${form.name === o.name ? 'on' : ''}`} aria-pressed={form.name === o.name} onClick={() => set('name', o.name)}>{o.name.split(' · ')[0]}</button>)}</div>
        </div>
      )}
      {field('name', 'Name', '', { required: true, maxLength: 120, autoComplete: 'off', placeholder: 'e.g. My HP Pavilion' })}
      <div className="cl-grid">
        {CUSTOM_FIELDS.map((f) => field(f.key, f.label, f.unit, { inputMode: f.int ? 'numeric' : 'decimal', autoComplete: 'off' }))}
        {field('cpu', 'Processor', '', { maxLength: 80, autoComplete: 'off', placeholder: 'e.g. Core i5 11th Gen' })}
      </div>
      <div className="cl-actions"><button type="submit" className="btn small">Compare with my laptop</button><button type="button" className="link" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

/** The button that opens the form in place. `disabledWhy` explains a disabled button (max reached). */
export function AddMyLaptop({ onAdd, disabledWhy }: { onAdd: (l: CustomLaptop) => void; disabledWhy?: string | null }) {
  const [open, setOpen] = useState(false);
  if (open) return <CustomLaptopForm onSubmit={(l) => { setOpen(false); onAdd(l); }} onCancel={() => setOpen(false)} />;
  return <div className="cl-add"><button type="button" className="btn soft small" disabled={!!disabledWhy} onClick={() => setOpen(true)}>＋ Add my laptop</button>{disabledWhy && <span className="muted small"> {disabledWhy}</span>}</div>;
}
