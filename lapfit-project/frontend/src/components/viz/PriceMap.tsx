import { useMemo, useState } from 'react';
import type { CatalogRow } from '../../lib/types';

export const brandColor = (brands: string[], b: string) => { const i = Math.max(0, brands.indexOf(b)); return `hsl(${(i * 67 + 250) % 360} 72% 52%)`; };
const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
const jitter = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997; return ((h % 9) - 4) / 14; };

/**
 * The laptop map: every laptop with a price is a dot. Left to right is price, bottom to top is RAM, dot size is storage.
 * Drag the budget (shaded area), hide brands, tap dots to pick laptops to compare. All values come from the catalog list.
 */
export function PriceMap({ rows, budget, hidden, picks, onToggle }: { rows: CatalogRow[]; budget: number; hidden: Set<string>; picks: string[]; onToggle(id: string, name: string): void }) {
  const [hover, setHover] = useState<string | null>(null);
  const data = useMemo(() => rows.filter((r) => r.recommendable && r.price_inr != null), [rows]);
  const brands = useMemo(() => [...new Set(data.map((r) => r.brand))].sort(), [data]);
  if (!data.length) return <p className="muted">No laptops with a price to draw yet.</p>;
  const W = 340, H = 230, L = 38, R = 14, T = 14, B = 34;
  const prices = data.map((r) => r.price_inr as number); const xMin = Math.floor(Math.min(...prices) / 10000) * 10000 - 5000; const xMax = Math.ceil(Math.max(...prices) / 10000) * 10000 + 5000;
  const rams = [...new Set(data.map((r) => r.ram_gb ?? 8))].sort((a, b) => a - b); const yMax = Math.max(1, rams.length);
  const x = (p: number) => L + ((p - xMin) / (xMax - xMin)) * (W - L - R); const y = (ram: number, id: string) => H - B - ((Math.max(0, rams.indexOf(ram)) + 0.5 + jitter(id)) / yMax) * (H - T - B);
  const ticks: number[] = []; for (let t = Math.ceil(xMin / 20000) * 20000; t <= xMax; t += 20000) ticks.push(t);
  const bx = Math.max(L, Math.min(W - R, x(budget)));
  const h = data.find((r) => r.variant_id === hover);
  return (
    <figure className="price-map">
      <div className="map-tip" aria-live="polite">{h ? <><strong>{h.name.split(' · ')[0]}</strong> · {rupees(h.price_inr as number)} · {h.ram_gb ?? '?'} GB RAM · {h.storage_gb ?? '?'} GB storage</> : <span className="muted">Tap a dot to pick a laptop. Bigger dot = more storage.</span>}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Laptop map. Each dot is a laptop: price across, RAM up, storage as size.">
        <rect className="afford" x={L} y={T} width={Math.max(0, bx - L)} height={H - T - B} rx="6" />
        <line className="axis-line" x1={L} y1={H - B} x2={W - R} y2={H - B} />
        {ticks.map((t) => <g key={t}><line className="tick" x1={x(t)} y1={H - B} x2={x(t)} y2={H - B + 4} /><text className="tick-label" x={x(t)} y={H - B + 16} textAnchor="middle">{t >= 100000 ? `${t / 100000}L` : `${t / 1000}k`}</text></g>)}
        {rams.map((r, i) => <text key={r} className="tick-label" x={L - 6} y={H - B - ((i + 0.5) / yMax) * (H - T - B) + 3} textAnchor="end">{r} GB</text>)}
        <line className="budget-line" x1={bx} y1={T} x2={bx} y2={H - B} />
        {data.map((r) => {
          const off = hidden.has(r.brand); const over = (r.price_inr as number) > budget; const sel = picks.includes(r.variant_id); const rad = 6 + Math.min(1, (r.storage_gb ?? 256) / 1024) * 6; const cx = x(r.price_inr as number); const cy = y(r.ram_gb ?? 8, r.variant_id);
          return (
            <g key={r.variant_id} className={`dot ${off ? 'off' : ''} ${over ? 'over' : ''} ${sel ? 'sel' : ''}`} tabIndex={off ? -1 : 0} role="button" aria-pressed={sel} aria-hidden={off}
              aria-label={`${r.name.split(' · ')[0]}, ${rupees(r.price_inr as number)}, ${r.ram_gb ?? '?'} GB RAM, ${r.storage_gb ?? '?'} GB storage${over ? ', over your budget' : ''}. ${sel ? 'Picked for comparison' : 'Press to pick for comparison'}`}
              onClick={() => !off && onToggle(r.variant_id, r.name)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !off) { e.preventDefault(); onToggle(r.variant_id, r.name); } }}
              onMouseEnter={() => setHover(r.variant_id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r.variant_id)} onBlur={() => setHover(null)}>
              {sel && <circle className="halo" cx={cx} cy={cy} r={rad + 5} />}
              <circle className="body" cx={cx} cy={cy} r={rad} fill={brandColor(brands, r.brand)} />
              {sel && <text className="check" x={cx} y={cy + 4} textAnchor="middle">✓</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
