import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCatalog } from '../state/useCatalog';
import type { CatalogRow } from '../lib/types';

export type PickRow = CatalogRow & { market?: 'IN' | 'US' | null; launch_year?: number | null };
const MAX = 40;

/** Words typed, all of which must appear in the name (any order). */
export const matchRows = (rows: PickRow[], q: string, opts: { onlyRecommendable?: boolean; indiaOnly?: boolean } = {}) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => !(opts.onlyRecommendable && !r.recommendable) && !(opts.indiaOnly && r.market === 'US') && words.every((w) => `${r.brand} ${r.name}`.toLowerCase().includes(w)));
};

/**
 * Name a laptop: type to filter the catalog, pick one, or just type any name (when free text is allowed we say we will look it up).
 * onChange(variant_id, name, free): an empty id with free=true means "this is a name I typed, not in the list".
 */
export function LaptopPicker({ id, label, value, onChange, onlyRecommendable = false, optional = false, indiaOnly = false, allowFree = false, hint, onRow }: {
  id: string; label: string; value: string; onChange(v: string, name: string, free?: boolean): void; onlyRecommendable?: boolean; optional?: boolean; indiaOnly?: boolean; allowFree?: boolean; hint?: string; onRow?(r: PickRow | null): void;
}) {
  const { rows: all, status, load } = useCatalog(); const rows = all as PickRow[]; useEffect(load, [load]);
  const [text, setText] = useState(''); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1); const box = useRef<HTMLDivElement>(null); const lb = useId(); const prev = useRef(value);
  useEffect(() => {   // keep the box in step when the parent picks or clears
    const row = value ? rows.find((r) => r.variant_id === value) : null;
    if (row) setText(row.name); else if (prev.current && !value) setText('');
    prev.current = value; onRow?.(row ?? null);
  }, [value, rows]);   // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => matchRows(rows, text, { onlyRecommendable, indiaOnly }).slice(0, MAX), [rows, text, onlyRecommendable, indiaOnly]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const pick = (r: PickRow) => { setText(r.name); setOpen(false); setActive(-1); onChange(r.variant_id, r.name, false); };
  const typed = text.trim(); const exact = !!value && rows.find((r) => r.variant_id === value)?.name === text;
  const type = (s: string) => { prev.current = ''; setText(s); setOpen(true); setActive(-1); onChange('', allowFree ? s.trim() : '', allowFree && s.trim().length > 0); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(list.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && active >= 0 && list[active]) { e.preventDefault(); pick(list[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };
  const loading = status === 'loading' || status === 'idle';
  return (
    <div className="field picker combo" ref={box}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" role="combobox" aria-expanded={open} aria-controls={lb} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined} autoComplete="off" spellCheck={false} maxLength={80}
        value={text} placeholder={loading ? 'Loading laptops…' : optional ? 'Type a name, or leave empty' : 'Type a laptop name'} onChange={(e) => type(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={key} aria-describedby={`${id}-help`} />
      <ul id={lb} role="listbox" aria-label={`${label}: matches`} className="combo-list" hidden={!open || (list.length === 0)}>
        {list.map((r, i) => <li key={r.variant_id} id={`${id}-o${i}`} role="option" aria-selected={r.variant_id === value} className={i === active ? 'act' : ''} onMouseDown={(e) => { e.preventDefault(); pick(r); }}><span>{r.name}</span>{r.price_inr ? <span className="muted small"> ₹{r.price_inr.toLocaleString('en-IN')}</span> : null}</li>)}
      </ul>
      <p id={`${id}-help`} className="muted small combo-help" aria-live="polite">
        {status === 'error' ? 'I could not load the laptop list, but you can still type a name.' : value && exact ? 'Found in the catalog.' : typed && allowFree && list.length === 0 ? 'Not in the catalog: I’ll look it up.' : typed && !value && list.length > 0 ? `${list.length >= MAX ? `${MAX}+` : list.length} match${list.length === 1 ? '' : 'es'}. Pick one${allowFree ? ' or keep typing' : ''}.` : typed && !allowFree && list.length === 0 ? 'No match. Try a shorter name.' : hint ?? (indiaOnly ? 'Laptops sold in India.' : '')}
      </p>
    </div>
  );
}
