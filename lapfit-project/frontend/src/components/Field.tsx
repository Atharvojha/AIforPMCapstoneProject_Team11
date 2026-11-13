import type { ReactNode } from 'react';
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <p className="muted small" id={`${id}-hint`}>{hint}</p>}</div>;
}
export const numOrNull = (s: string): number | null => { const n = Number(s.replace(/,/g, '')); return s.trim() !== '' && isFinite(n) ? n : null; };
