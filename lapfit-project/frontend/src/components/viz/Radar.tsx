import type { Axis } from '../../lib/viz';

/** "Laptop DNA": six real attributes drawn as a shape. Scaled against the other laptops on screen only; unknown values stay at the centre with a "?". */
export function Radar({ axes, norms, size = 150, name }: { axes: Axis[]; norms: (number | null)[]; size?: number; name: string }) {
  const c = size / 2; const R = size * 0.34; const n = axes.length;
  const pt = (i: number, k: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * R * k, c + Math.sin(a) * R * k] as const; };
  const poly = norms.map((v, i) => pt(i, v ?? 0.04).join(',')).join(' ');
  const label = `${name}: ${axes.map((a) => `${a.label} ${a.shown}`).join(', ')}. Shapes are scaled against the other laptops shown.`;
  return (
    <svg className="radar" width={size + 40} height={size + 12} viewBox={`-20 -6 ${size + 40} ${size + 12}`} role="img" aria-label={label}>
      <defs><linearGradient id="rd-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity=".55" /><stop offset="1" stopColor="#00c2b3" stopOpacity=".45" /></linearGradient></defs>
      {[0.33, 0.66, 1].map((k) => <polygon key={k} className="grid" points={axes.map((_, i) => pt(i, k).join(',')).join(' ')} />)}
      {axes.map((_, i) => <line key={i} className="spoke" x1={c} y1={c} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} />)}
      <polygon className="shape" points={poly} fill="url(#rd-fill)" />
      {norms.map((v, i) => { const [x, y] = pt(i, v ?? 0.04); return <circle key={i} className={v == null ? 'dot unknown' : 'dot'} cx={x} cy={y} r={v == null ? 3.4 : 3.8} />; })}
      {axes.map((a, i) => { const [x, y] = pt(i, 1.34); return <text key={a.key} className="axis" x={x} y={y} textAnchor={x < c - 4 ? 'end' : x > c + 4 ? 'start' : 'middle'} dominantBaseline="middle">{a.label}{norms[i] == null ? ' ?' : ''}</text>; })}
    </svg>
  );
}
