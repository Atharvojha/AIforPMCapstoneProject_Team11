import { useId, useState } from 'react';

export interface SliderInputProps {
  label: string; fieldLabel?: string; value: number | null; onChange(v: number): void;
  min: number; max: number; step?: number; stops?: number[];
  prefix?: string; suffix?: string; format?(n: number): string; valueText?(n: number | null): string; nullText?: string; hint?: string; id?: string; className?: string; children?: React.ReactNode;
}

/** "80000", "80,000", "₹80k", "1.5 lakh" -> number. Null when it is not a number. */
export function parseTyped(s: string, shorthand: boolean): number | null {
  const t = s.replace(/[₹,\s%]|years?|yrs?/gi, '').toLowerCase(); if (!t) return null;
  const m = /^(\d+(?:\.\d+)?)(k|l|lac|lakh|lakhs)?$/.exec(t); if (!m) return null; const n = Number(m[1]); if (!Number.isFinite(n)) return null;
  if (!m[2]) return n; if (!shorthand) return null; return m[2] === 'k' ? n * 1000 : n * 100000;
}

/**
 * A slider with a number field you can type in. The two stay in sync. Typing is checked as you go: a plain hint says what is allowed,
 * Enter (or leaving the field) applies it, and a number outside the range is moved to the nearest allowed value and says so.
 * With `stops` the slider steps over those values; a typed value is kept as typed.
 */
export function SliderInput({ label, fieldLabel = 'Type a value', value, onChange, min, max, step = 1, stops, prefix = '', suffix = '', format, valueText, nullText = 'Not set', hint, id, className = '', children }: SliderInputProps) {
  const gen = useId(); const sid = id ?? `${gen}-s`; const fid = `${gen}-f`; const hid = `${gen}-h`;
  const [draft, setDraft] = useState<string | null>(null); const [note, setNote] = useState('');
  const show = (n: number) => (format ? format(n) : n.toLocaleString('en-IN'));
  const stopIdx = (v: number) => { const i = stops!.findIndex((s) => s >= v); return i === -1 ? stops!.length - 1 : i; };
  const idx = value == null ? (stops ? stops.length - 1 : max) : stops ? stopIdx(value) : Math.min(max, Math.max(min, value));
  const fieldText = draft ?? (value == null ? '' : prefix || suffix ? (format ? String(value) : value.toLocaleString('en-IN')) : String(value));
  const range = `${prefix}${show(min)}${suffix} and ${prefix}${show(max)}${suffix}`;
  const check = (raw: string): { ok: boolean; n?: number; msg: string } => {
    if (raw.trim() === '') return { ok: false, msg: `Type a number between ${range}.` };
    const n = parseTyped(raw, prefix === '₹'); if (n == null) return { ok: false, msg: `That is not a number. Type something like ${prefix}${show(Math.round((min + max) / 2 / step) * step)}${suffix}.` };
    if (n < min) return { ok: true, n: min, msg: `The lowest I can set is ${prefix}${show(min)}${suffix}. Press Enter to use it.` };
    if (n > max) return { ok: true, n: max, msg: `The highest I can set is ${prefix}${show(max)}${suffix}. Press Enter to use it.` };
    return { ok: true, n: Math.round(n), msg: 'Press Enter to apply.' };
  };
  const apply = (raw: string) => {
    const r = check(raw); if (!r.ok) { setNote(r.msg); return false; }
    onChange(r.n!); setDraft(null); const typed = parseTyped(raw, prefix === '₹'); setNote(typed != null && typed !== r.n ? `Set to ${prefix}${show(r.n!)}${suffix}, the nearest allowed value.` : ''); return true;
  };
  const display = value == null ? nullText : `${prefix}${show(value)}${suffix}`;
  return (
    <div className={`slider-input ${className}`}>
      <label htmlFor={sid} className="si-label">{label} <strong className="big">{display}</strong></label>
      {children}
      <div className="si-row">
        <input id={sid} className="si-range" type="range" min={stops ? 0 : min} max={stops ? stops.length - 1 : max} step={stops ? 1 : step} value={idx}
          aria-valuetext={valueText ? valueText(value) : display} onChange={(e) => { const v = Number(e.target.value); setDraft(null); setNote(''); onChange(stops ? stops[v] : v); }} />
        <span className="si-field">
          {prefix && <span className="si-affix" aria-hidden="true">{prefix}</span>}
          <input id={fid} className="si-num" type="text" inputMode="numeric" autoComplete="off" aria-label={fieldLabel} aria-describedby={hid} aria-invalid={note !== '' && draft !== null && !check(draft).ok ? true : undefined}
            value={fieldText} placeholder={value == null ? nullText : ''}
            onChange={(e) => { setDraft(e.target.value); const r = check(e.target.value); setNote(e.target.value === '' ? '' : r.msg); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (draft !== null) apply(draft); } else if (e.key === 'Escape' && draft !== null) { e.stopPropagation(); setDraft(null); setNote(''); } }}
            onBlur={() => { if (draft !== null) { if (!apply(draft)) { setDraft(null); setNote(''); } } }} />
          {suffix && <span className="si-affix" aria-hidden="true">{suffix.trim()}</span>}
        </span>
      </div>
      <p id={hid} className={`muted small si-hint ${note ? 'show' : ''}`} aria-live="polite">{note || hint || `You can also type it. Allowed: ${range}.`}</p>
    </div>
  );
}
