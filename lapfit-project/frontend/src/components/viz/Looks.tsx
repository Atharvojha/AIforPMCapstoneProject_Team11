import { useId } from 'react';
import { bottlesOf, strip, type Look } from '../../lib/looks';

/** Weight as one-litre bottles of water (one litre weighs about one kilogram). */
export function Bottles({ kg }: { kg: number | null }) {
  const uid = useId().replace(/:/g, ''); const b = bottlesOf(kg);
  if (kg == null || b == null) return <p className="feel muted">Weight ?</p>;
  return (
    <div className="feel">
      <div className="bottles" aria-hidden="true">{Array.from({ length: Math.ceil(kg) }, (_, i) => { const f = Math.min(1, Math.max(0, kg - i)); return (
        <svg key={i} width="22" height="46" viewBox="0 0 22 46"><defs><clipPath id={`b${uid}${i}`}><rect x="0" y={46 - 44 * f} width="22" height="46" /></clipPath></defs>
          <path d="M8 2h6v5l4 5v30a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V12l4-5z" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
          <path d="M8 2h6v5l4 5v30a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V12l4-5z" fill="var(--teal, #0d8a80)" opacity=".75" clipPath={`url(#b${uid}${i})`} /></svg>); })}</div>
      <div><strong>{kg} kg</strong><p className="muted small">about {b} one-litre bottles of water</p></div>
    </div>
  );
}

const ROWS: { k: 'price' | 'weight' | 'screen' | 'ram'; label: string; fmt: (v: number) => string }[] = [
  { k: 'price', label: 'Price', fmt: (v) => `₹${Math.round(v).toLocaleString('en-IN')}` }, { k: 'weight', label: 'Weight', fmt: (v) => `${v} kg` }, { k: 'screen', label: 'Screen', fmt: (v) => `${v} inch` }, { k: 'ram', label: 'RAM', fmt: (v) => `${v} GB` },
];
/** Where this laptop sits among all the laptops that have the value recorded (left is the lowest). */
export function PositionStrips({ look, all }: { look: Look; all: Look[] }) {
  const rows = ROWS.map((r) => ({ r, s: strip(look, all, r.k) })).filter((x) => x.s);
  if (!rows.length) return null;
  return (
    <div className="strips" role="group" aria-label="Where it sits among all the laptops we have (left is the lowest)">
      {rows.map(({ r, s }) => { const W = 190, pad = 8, X = (p: number) => pad + p * W; const v = look[r.k] as number; const lower = all.filter((o) => o[r.k] != null && (o[r.k] as number) < v).length; return (
        <div className="strip-row" key={r.k}><b>{r.label}</b>
          <svg viewBox={`0 0 ${W + 2 * pad} 26`} role="img" aria-label={`${r.label} ${r.fmt(v)}: lower than ${all.filter((o) => o[r.k] != null).length - 1 - lower} others, higher than ${lower}`}>
            <line x1={pad} x2={W + pad} y1="13" y2="13" stroke="var(--line)" strokeWidth="2" />
            {s!.others.map((p, i) => <circle key={i} cx={X(p)} cy="13" r="3" fill="var(--muted)" opacity=".4" />)}
            <circle cx={X(s!.self)} cy="13" r="6.5" fill="var(--accent)" /></svg>
          <span className="strip-val">{r.fmt(v)}</span></div>); })}
      <p className="muted small">Left is the lowest of the laptops with this recorded, the big dot is this laptop.</p>
    </div>
  );
}
