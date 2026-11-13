export interface RadarItem { name: string; color: string; values: (number | null)[] }

/** Several laptops on one radar. Each axis is scaled against the laptops shown; unknown values are left at the centre. */
export function MultiRadar({ axes, items, size = 230 }: { axes: string[]; items: RadarItem[]; size?: number }) {
  const c = size / 2; const R = size * 0.34; const n = axes.length;
  const scaled = items.map((it) => it.values.map((v, ai) => { if (v == null) return null; const all = items.map((x) => x.values[ai]).filter((q): q is number => q != null); const lo = Math.min(...all); const hi = Math.max(...all); return hi === lo ? 0.62 : 0.18 + 0.82 * ((v - lo) / (hi - lo)); }));
  const pt = (i: number, k: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * R * k, c + Math.sin(a) * R * k] as const; };
  return (
    <figure className="multi-radar">
      <svg width={size + 60} height={size + 14} viewBox={`-30 -6 ${size + 60} ${size + 14}`} role="img" aria-label={`Radar comparing ${items.map((i) => i.name).join(', ')} on ${axes.join(', ')}. Shapes are scaled against each other.`}>
        {[0.33, 0.66, 1].map((k) => <polygon key={k} className="grid" points={axes.map((_, i) => pt(i, k).join(',')).join(' ')} />)}
        {axes.map((_, i) => <line key={i} className="spoke" x1={c} y1={c} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} />)}
        {scaled.map((vals, k) => <polygon key={k} className="mshape" points={vals.map((v, i) => pt(i, v ?? 0.04).join(',')).join(' ')} fill={items[k].color} stroke={items[k].color} />)}
        {axes.map((a, i) => { const [x, y] = pt(i, 1.3); return <text key={a} className="axis" x={x} y={y} textAnchor={x < c - 4 ? 'end' : x > c + 4 ? 'start' : 'middle'} dominantBaseline="middle">{a}</text>; })}
      </svg>
      <figcaption className="legend">{items.map((i) => <span key={i.name}><i style={{ background: i.color }} />{i.name}</span>)}</figcaption>
    </figure>
  );
}
