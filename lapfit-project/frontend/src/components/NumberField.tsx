import { useEffect, useId, useState } from 'react';

/**
 * A number you can type, or nudge with - and +. Everything that used to be slider-only gets one of these.
 * Typing is never clamped while you are mid-number; the value is only sent when it is inside the limits, and corrected when you leave the field.
 */
export function NumberField({ label, value, onChange, min = 0, max = 100, step = 1, unit, stepper = true, hint, id: idProp, size }: {
  label: string; value: number | null; onChange(v: number | null): void; min?: number; max?: number; step?: number; unit?: string; stepper?: boolean; hint?: string; id?: string; size?: 'wide';
}) {
  const auto = useId(); const id = idProp ?? auto; const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => { setDraft(value == null ? '' : String(value)); }, [value]);
  const num = draft.trim() === '' ? null : Number(draft); const bad = num != null && (!isFinite(num) || num < min || num > max);
  const commit = (s: string) => { setDraft(s); if (s.trim() === '') { onChange(null); return; } const n = Number(s); if (isFinite(n) && n >= min && n <= max) onChange(n); };
  const nudge = (d: number) => { const base = value ?? (d > 0 ? min - step : min + step); const n = Math.min(max, Math.max(min, Math.round((base + d) * 1e6) / 1e6)); onChange(n); setDraft(String(n)); };
  const blur = () => { if (num == null) return; if (!isFinite(num)) { setDraft(value == null ? '' : String(value)); return; } const n = Math.min(max, Math.max(min, num)); setDraft(String(n)); onChange(n); };
  return (
    <div className={`numfield ${size ?? ''}`}>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="numfield-row">
        {stepper && <button type="button" className="step-btn" aria-label={`Less: ${label}`} onClick={() => nudge(-step)} disabled={value != null && value <= min}>−</button>}
        <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft} onChange={(e) => commit(e.target.value)} onBlur={blur} aria-invalid={bad} aria-describedby={bad ? `${id}-err` : hint ? `${id}-hint` : undefined} />
        {stepper && <button type="button" className="step-btn" aria-label={`More: ${label}`} onClick={() => nudge(step)} disabled={value != null && value >= max}>+</button>}
        {unit && <span className="muted unit">{unit}</span>}
      </div>
      {bad ? <p id={`${id}-err`} className="error small" role="alert">Use a number from {min} to {max}.</p> : hint ? <p id={`${id}-hint`} className="muted small">{hint}</p> : null}
    </div>
  );
}
