import { useMemo, useState } from 'react';
import type { CatalogRow } from '../../lib/types';
import { LaptopImage } from '../LaptopImage';

type Row = CatalogRow & Record<string, any>;
export const brandColor = (brands: string[], b: string) => { const i = Math.max(0, brands.indexOf(b)); return `hsl(${(i * 67 + 250) % 360} 62% 40%)`; };
export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
/** The photo a catalog row carries, when it has one. Never invented. */
export const picOf = (r: Row) => (typeof r.image_url === 'string' && r.image_url.startsWith('https://') ? { url: r.image_url, site: r.image_site ?? null, page: r.image_page ?? null, alt: r.name } : r.image && r.image.url ? r.image : null);
/** How strong a laptop is on paper, 0 to 1, from the RAM and storage on record only. Unknown RAM or storage counts as nothing, so it shows low rather than guessed high. */
export const strengthOf = (r: Row, maxRam: number, maxSto: number) => 0.5 * ((r.ram_gb ?? 0) / maxRam) + 0.5 * ((r.storage_gb ?? 0) / maxSto);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

/**
 * The value map: across is price (cheaper to pricier), up is how strong it is on paper (RAM and storage on record).
 * The top-left corner is "more for your money". Each dot is a laptop (photo when we have one). Tap a dot to peek, then pick it to compare.
 */
export function ValueMap({ rows, picks, onToggle, tags }: { rows: Row[]; picks: string[]; onToggle(id: string, name: string): void; tags(r: Row): string[] }) {
  const [peek, setPeek] = useState<string | null>(null);
  const m = useMemo(() => {
    const maxRam = Math.max(1, ...rows.map((r) => r.ram_gb ?? 0)); const maxSto = Math.max(1, ...rows.map((r) => r.storage_gb ?? 0)); const prices = rows.map((r) => r.price_inr as number);
    const lo = Math.min(...prices), hi = Math.max(...prices); const str = rows.map((r) => strengthOf(r, maxRam, maxSto));
    return { maxRam, maxSto, lo, hi, str, mp: median(prices), ms: median(str) };
  }, [rows]);
  if (!rows.length) return <p className="muted">No laptops match, so there is nothing to draw. Loosen a filter.</p>;
  const pos = (r: Row, i: number) => {
    const jitter = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997; return (h % 7) - 3; };
    const x = m.hi === m.lo ? 50 : 8 + ((r.price_inr as number) - m.lo) / (m.hi - m.lo) * 84; const y = 8 + (1 - Math.min(1, m.str[i])) * 84;
    return { left: `${Math.max(6, Math.min(94, x + jitter(r.variant_id) * 0.6))}%`, top: `${Math.max(6, Math.min(94, y + jitter(r.variant_id + 'y') * 0.8))}%` };
  };
  const p = rows.find((r) => r.variant_id === peek); const pi = p ? rows.indexOf(p) : -1;
  const short = (r: Row) => r.name.split(' · ')[0];
  return (
    <figure className="value-map">
      <p className="muted small vm-lead">Each dot is a laptop. Left is cheaper, right is pricier. Higher means more RAM and storage on record. The top-left corner is where you get more for your money.</p>
      <div className="vm-wrap">
        <span className="vm-yaxis" aria-hidden="true">Stronger on paper ↑</span>
        <div className="vm-plot" role="group" aria-label="Value map. Each dot is a laptop. Use the list below if you prefer.">
          <span className="vm-region best" style={{ left: 0, top: 0, width: `${m.hi === m.lo ? 50 : 8 + (m.mp - m.lo) / (m.hi - m.lo) * 84}%`, height: `${8 + (1 - m.ms) * 84}%` }} aria-hidden="true"><b>More for your money</b></span>
          <span className="vm-label br" aria-hidden="true">Pricey for what it has</span><span className="vm-label tr" aria-hidden="true">Top of the range</span><span className="vm-label bl" aria-hidden="true">Basics, low price</span>
          {rows.map((r, i) => { const sel = picks.includes(r.variant_id); const pic = picOf(r); return (
            <button key={r.variant_id} type="button" className={`vm-dot ${sel ? 'sel' : ''} ${peek === r.variant_id ? 'peek' : ''}`} style={pos(r, i)} aria-pressed={peek === r.variant_id}
              aria-label={`${short(r)}, ${rupees(r.price_inr as number)}, ${r.ram_gb ?? '?'} GB RAM, ${r.storage_gb ?? '?'} GB storage${sel ? ', picked for comparison' : ''}. Press to peek.`} onClick={() => setPeek(peek === r.variant_id ? null : r.variant_id)}>
              {pic ? <img src={pic.url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <i aria-hidden="true">{(r.brand ?? '?').slice(0, 1)}</i>}
              {sel && <span className="vm-tick" aria-hidden="true">✓</span>}
            </button>); })}
        </div>
      </div>
      <span className="vm-xaxis" aria-hidden="true">Cheaper → Pricier</span>
      <div className="vm-peek" aria-live="polite">
        {p ? (
          <div className="peek-card"><div className="peek-pic"><LaptopImage pic={picOf(p)} brand={p.brand} name={short(p)} screen={p.display_size} weight={p.weight_kg} caption={false} /></div>
            <div><strong>{short(p)}</strong><p className="muted small">{p.name.split(' · ')[1] ?? ''}</p><p><strong>{rupees(p.price_inr as number)}</strong> · {p.ram_gb ?? '?'} GB RAM · {p.storage_gb ?? '?'} GB storage</p>
              {tags(p).length > 0 && <p className="tagrow">{tags(p).map((t) => <span className="tag" key={t}>{t}</span>)}</p>}
              <div className="inline"><button type="button" className={`btn small ${picks.includes(p.variant_id) ? '' : 'ghost'}`} onClick={() => onToggle(p.variant_id, p.name)}>{picks.includes(p.variant_id) ? 'Picked: tap to remove' : 'Pick to compare'}</button><button type="button" className="link" onClick={() => setPeek(null)}>Close</button></div></div>
            <span className="sr-only">{pi + 1} of {rows.length}</span></div>
        ) : <p className="muted small">Tap a dot to peek at that laptop.</p>}
      </div>
      <details className="vm-list"><summary>Show these as a list</summary>
        <ul className="map-list">{[...rows].sort((a, b) => m.str[rows.indexOf(b)] - m.str[rows.indexOf(a)] || (a.price_inr as number) - (b.price_inr as number)).map((r) => (
          <li key={r.variant_id}><label><input type="checkbox" checked={picks.includes(r.variant_id)} onChange={() => onToggle(r.variant_id, r.name)} /> <span className="row-name"><strong>{short(r)}</strong><span className="muted small">{r.ram_gb ?? '?'} GB RAM · {r.storage_gb ?? '?'} GB storage</span></span> <span className="row-price">{rupees(r.price_inr as number)}</span></label></li>))}</ul>
      </details>
    </figure>
  );
}
