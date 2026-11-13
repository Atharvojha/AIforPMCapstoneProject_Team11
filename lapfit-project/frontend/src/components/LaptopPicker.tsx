import { useEffect, useMemo } from 'react';
import { useCatalog } from '../state/useCatalog';

/** Pick a laptop version from the catalog. A plain select grouped by brand: works on every phone and with a screen reader. */
export function LaptopPicker({ id, label, value, onChange, onlyRecommendable = false, optional = false }: { id: string; label: string; value: string; onChange(v: string, name: string): void; onlyRecommendable?: boolean; optional?: boolean }) {
  const { rows, status, load } = useCatalog(); const q = '';
  useEffect(load, [load]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>(); const needle = q.trim().toLowerCase();
    for (const r of rows) { if (onlyRecommendable && !r.recommendable) continue; if (needle && !r.name.toLowerCase().includes(needle)) continue; m.set(r.brand, [...(m.get(r.brand) ?? []), r]); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, q, onlyRecommendable]);
  return (
    <div className="field picker">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value, rows.find((r) => r.variant_id === e.target.value)?.name ?? '')} disabled={status !== 'ready'}>
        <option value="">{status === 'loading' ? 'Loading laptops…' : status === 'error' ? 'Could not load the list' : optional ? 'Not sure / any' : 'Choose a laptop'}</option>
        {groups.map(([brand, list]) => <optgroup key={brand} label={brand}>{list.map((r) => <option key={r.variant_id} value={r.variant_id}>{r.name}{r.price_inr ? ` (₹${r.price_inr.toLocaleString('en-IN')})` : ''}</option>)}</optgroup>)}
      </select>
      {status === 'error' && <p className="error small">I could not load the laptop list. Check your connection and reload.</p>}
    </div>
  );
}
