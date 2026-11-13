import { useEffect, useState } from 'react';

const COLORS = ['#7c5cff', '#00c2b3', '#ffd166', '#ff6b6b', '#4dabf7'];
/** A short burst for a good result (every Must met). Skipped for people who prefer reduced motion. */
export function Confetti({ fire }: { fire: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => { if (!fire || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; setOn(true); const t = setTimeout(() => setOn(false), 1900); return () => clearTimeout(t); }, [fire]);
  if (!on) return null;
  return <div className="confetti" aria-hidden="true">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 7) * 60}ms`, ['--dx' as any]: `${((i * 53) % 90) - 45}px`, ['--rot' as any]: `${(i * 47) % 360}deg` }} />)}</div>;
}
