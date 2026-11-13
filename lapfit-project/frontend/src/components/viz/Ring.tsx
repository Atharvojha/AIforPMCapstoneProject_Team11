import { useEffect, useState } from 'react';

/** A progress ring. Used for "how many owner voices do we have, out of how many we need". */
export function Ring({ value, label, caption, tone = 'accent', size = 72 }: { value: number; label: string; caption?: string; tone?: 'good' | 'accent' | 'warn'; size?: number }) {
  const [v, setV] = useState(0); useEffect(() => { const t = requestAnimationFrame(() => setV(Math.max(0, Math.min(1, value)))); return () => cancelAnimationFrame(t); }, [value]);
  const r = size / 2 - 7; const circ = 2 * Math.PI * r;
  return (
    <figure className={`ring ${tone}`} style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={caption ?? label}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} /><circle className="meter" cx={size / 2} cy={size / 2} r={r} strokeDasharray={circ} strokeDashoffset={circ * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-n">{label}</text>
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
