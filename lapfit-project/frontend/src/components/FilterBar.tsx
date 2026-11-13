import { useEffect, useId, useRef, useState } from 'react';
import { NumberField } from './NumberField';
import { budgetLabel } from './viz/BudgetSlider';
import { OPTS, GPU_LABEL, QUICK_PRICES, activeChips, optionCount, type Filters, type Row, type Dim } from '../lib/explore';

type Group = 'brand' | 'price' | 'weight' | 'screen' | 'power';
const GROUPS: { id: Group; label: string; dims: Dim[] }[] = [
  { id: 'brand', label: 'Brand', dims: ['brand'] }, { id: 'price', label: 'Price', dims: ['price'] }, { id: 'weight', label: 'Weight', dims: ['weight'] },
  { id: 'screen', label: 'Screen', dims: ['screen'] }, { id: 'power', label: 'Power', dims: ['ram', 'storage', 'gpu'] },
];
const plural = (n: number) => `${n} laptop${n === 1 ? '' : 's'}`;

/** One toggle with its live count. An option that would show nothing is disabled (unless it is already on, so it can be turned off). */
function Option({ label, n, on, onClick }: { label: string; n: number; on: boolean; onClick(): void }) {
  return <button type="button" className={`chip opt ${on ? 'on' : ''}`} aria-pressed={on} disabled={n === 0 && !on} onClick={onClick}><span>{label}</span><span className="opt-n" aria-label={plural(n)}>{n}</span></button>;
}

/**
 * A compact filter bar: five chips (Brand, Price, Weight, Screen, Power) that each open a small panel of options with live counts,
 * then the active filters as removable chips. Nothing is a wall; everything is a button with a real label.
 */
export function FilterBar({ rows, f, set, total, shown }: { rows: Row[]; f: Filters; set(f: Filters): void; total: number; shown: number }) {
  const [open, setOpen] = useState<Group | null>(null); const uid = useId(); const btn = useRef<Record<string, HTMLButtonElement | null>>({});
  const brands = [...new Set(rows.map((r) => r.brand))].sort(); const every = activeChips(f); const chips = every.filter((c) => c.dim !== 'search');   // the search words are visible in the search box itself
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); btn.current[open]?.focus(); } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [open]);
  const toggleIn = (list: string[], k: string) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const n = (d: Dim, key: string) => optionCount(rows, f, d, key);
  const single = (d: 'weight' | 'ram' | 'storage') => OPTS[d].map((o) => <Option key={o.key} label={o.label} n={n(d, o.key)} on={f[d] === o.key} onClick={() => set({ ...f, [d]: f[d] === o.key ? null : o.key })} />);
  const summary = (g: Group): string => { const c = chips.filter((x) => g === 'power' ? ['ram', 'storage', 'gpu'].includes(x.dim) : x.dim === g); return c.length === 0 ? '' : c.length === 1 ? c[0].label : `${c.length} chosen`; };
  const panel = (g: Group) => {
    if (g === 'brand') return <div className="chips" role="group" aria-label="Brand">{brands.map((b) => <Option key={b} label={b} n={n('brand', b)} on={f.brands.includes(b)} onClick={() => set({ ...f, brands: toggleIn(f.brands, b) })} />)}</div>;
    if (g === 'price') return <><NumberField id="ex-budget" label="Up to (₹)" unit="₹" value={f.budget} min={5000} max={1000000} step={5000} stepper={false} onChange={(v) => set({ ...f, budget: v })} hint={f.budget ? budgetLabel(f.budget) : 'Type a number, or tap one'} />
      <div className="chips" role="group" aria-label="Quick price limits">{QUICK_PRICES.map((q) => <Option key={q} label={`Up to ${budgetLabel(q)}`} n={n('price', String(q))} on={f.budget === q} onClick={() => set({ ...f, budget: f.budget === q ? null : q })} />)}</div></>;
    if (g === 'weight') return <div className="chips" role="group" aria-label="Weight">{single('weight')}</div>;
    if (g === 'screen') return <div className="chips" role="group" aria-label="Screen size">{OPTS.screen.map((o) => <Option key={o.key} label={o.label} n={n('screen', o.key)} on={f.screen.includes(o.key)} onClick={() => set({ ...f, screen: toggleIn(f.screen, o.key) })} />)}</div>;
    return <><fieldset className="chip-group"><legend>Memory (RAM)</legend><div className="chips">{single('ram')}</div></fieldset>
      <fieldset className="chip-group"><legend>Storage</legend><div className="chips">{single('storage')}</div></fieldset>
      <fieldset className="chip-group"><legend>Graphics</legend><div className="chips"><Option label={GPU_LABEL} n={n('gpu', '')} on={f.gpu} onClick={() => set({ ...f, gpu: !f.gpu })} /></div></fieldset></>;
  };
  return (
    <div className="filterbar">
      <div className="fb-row" role="group" aria-label="Filters">
        {GROUPS.map((g) => { const s = summary(g.id); return (
          <button key={g.id} type="button" ref={(el) => { btn.current[g.id] = el; }} className={`chip fb-chip ${s ? 'on' : ''} ${open === g.id ? 'open' : ''}`} aria-expanded={open === g.id} aria-controls={`${uid}-${g.id}`} onClick={() => setOpen(open === g.id ? null : g.id)}>
            <span>{g.label}{s ? <span className="fb-sum">: {s}</span> : null}</span><span className="fb-caret" aria-hidden="true">▾</span></button>); })}
      </div>
      {GROUPS.map((g) => open === g.id && <div key={g.id} id={`${uid}-${g.id}`} className="fb-panel" role="group" aria-label={`${g.label} options`}>{panel(g.id)}<button type="button" className="btn small ghost fb-done" onClick={() => { setOpen(null); btn.current[g.id]?.focus(); }}>Done</button></div>)}
      <div className="fb-status">
        <p className="fb-count" role="status" aria-live="polite"><strong>{shown} of {total} laptops</strong></p>
        {every.length > 0 && <ul className="fb-active" aria-label="Active filters">{chips.map((c) => <li key={c.id}><button type="button" className="chip on removable" aria-label={`Remove filter: ${c.label}`} onClick={() => set({ ...c.remove(f), unk: f.unk })}>{c.label} <span aria-hidden="true">✕</span></button></li>)}
          <li><button type="button" className="link" onClick={() => set({ ...f, q: '', budget: null, brands: [], weight: null, screen: [], ram: null, storage: null, gpu: false, unk: [] })}>Clear all</button></li></ul>}
      </div>
    </div>
  );
}
