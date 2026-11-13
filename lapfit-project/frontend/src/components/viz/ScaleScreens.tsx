import { A4, glass } from '../../lib/looks';

const PALETTE = ['#5b3fe0', '#0d8a80', '#d9480f', '#c2255c'];
/** The screens of the laptops drawn at the same scale, next to an A4 sheet. Sized from the recorded diagonal, assuming a 16:9 shape. Bezels and thickness are not recorded, so not drawn. */
export function ScaleScreens({ items }: { items: { name: string; screen: number | null }[] }) {
  const known = items.map((x, i) => ({ ...x, i })).filter((x): x is { name: string; screen: number; i: number } => x.screen != null);
  if (known.length < 2) return null;
  const VW = 640, VH = 300, pad = 18, cx = (VW - 130) / 2 + pad; const g = known.map((x) => ({ ...x, ...glass(x.screen) }));
  const mw = Math.max(A4.w, ...g.map((x) => x.w)), mh = Math.max(A4.h, ...g.map((x) => x.h)); const scale = Math.min((VW - 2 * pad - 130) / mw, (VH - 2 * pad) / mh), base = VH - pad;
  const order = [...g].sort((a, b) => b.h - a.h); let ly = Math.max(18, base - mh * scale + 6);
  return (
    <figure className="scale-screens">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={`Screens of ${g.map((x) => `${x.name} ${x.screen} inch`).join(', ')} drawn to the same scale next to an A4 sheet. Assumes a 16:9 screen shape.`}>
        <rect x={cx - (A4.w * scale) / 2} y={base - A4.h * scale} width={A4.w * scale} height={A4.h * scale} rx="4" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="6 5" />
        <text x={cx - (A4.w * scale) / 2 + 8} y={base - A4.h * scale + 16} fontSize="12" fill="var(--muted)">A4 paper</text>
        {[...g].sort((a, b) => b.w - a.w).map((x) => <rect key={x.i} x={cx - (x.w * scale) / 2} y={base - x.h * scale} width={x.w * scale} height={x.h * scale} rx="5" fill={PALETTE[x.i % 4]} fillOpacity=".10" stroke={PALETTE[x.i % 4]} strokeWidth="3" />)}
        {order.map((x) => { const y = ly; ly += 20; return (<g key={x.i}><path d={`M${cx + (x.w * scale) / 2} ${base - x.h * scale} L${VW - 66} ${y - 4}`} stroke={PALETTE[x.i % 4]} strokeWidth="1.5" fill="none" opacity=".8" /><text x={VW - 62} y={y} fontSize="14" fontWeight="800" fill={PALETTE[x.i % 4]}>{x.screen}″</text></g>); })}
      </svg>
      <ul className="scale-legend">{g.map((x) => <li key={x.i}><i style={{ borderColor: PALETTE[x.i % 4] }} />{x.name.split(' · ')[0]} · {x.screen}″ · about {Math.round(x.area)} cm²</li>)}</ul>
      <figcaption className="muted small">Same scale for every screen, drawn as 16:9 (the shape is not recorded). Bezels, thickness and the base are not drawn: we do not have those measurements.</figcaption>
    </figure>
  );
}
