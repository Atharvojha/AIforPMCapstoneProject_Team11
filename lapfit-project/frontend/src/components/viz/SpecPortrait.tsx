import { useId } from 'react';
import { hueOf, type Look } from '../../lib/looks';

/** A drawn laptop whose shape follows the recorded numbers: lid width from screen size, base thickness from weight, vents and glow for dedicated graphics, a Hz badge for fast screens. Colour follows the brand, not the real laptop. Not a photo. */
export function SpecPortrait({ look, className = '' }: { look: Look; className?: string }) {
  const uid = useId().replace(/:/g, ''); const h = hueOf(look.brand);
  const lw = 96 + Math.max(0, (look.screen ?? 15.6) - 13) * 9.5, lh = lw * 0.6, t = look.weight == null ? 6 : 3 + look.weight * 2.2, cx = 100, base = 124, x = cx - lw / 2;
  const dedicated = look.gpu === 'dedicated'; const blocks = look.ram == null ? 0 : Math.max(1, Math.round(look.ram / 8));
  const desc = `Drawing of ${look.name}: ${look.screen != null ? `${look.screen} inch screen` : 'screen size unknown'}, ${look.weight != null ? `${look.weight} kg` : 'weight unknown'}${dedicated ? ', dedicated graphics listed' : ''}. Drawn from the recorded specs, not a photo.`;
  return (
    <svg className={`spec-portrait ${className}`} viewBox="0 18 200 122" role="img" aria-label={desc}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={`hsl(${h} 70% 62%)`} /><stop offset="1" stopColor={`hsl(${(h + 40) % 360} 68% 44%)`} /></linearGradient>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b1d3d" /><stop offset="1" stopColor="#2d3068" /></linearGradient>
      </defs>
      {dedicated && <ellipse cx={cx} cy={base + t + 2} rx={lw / 2 + 6} ry="7" fill={`hsl(${h} 90% 60%)`} opacity=".35" />}
      <rect x={x} y={base - lh} width={lw} height={lh} rx="7" fill={`url(#g${uid})`} />
      <rect x={x + 5} y={base - lh + 5} width={lw - 10} height={lh - 10} rx="4" fill={`url(#s${uid})`} />
      <path d={`M${x - 12} ${base} H${x + lw + 12} L${x + lw + 6} ${base + t} H${x - 6} Z`} fill="#d3d0f3" />
      <rect x={cx - 12} y={base} width="24" height="2.6" rx="1.3" fill="#a9a5dd" />
      {dedicated && [0, 1, 2, 3, 4].map((i) => <rect key={i} x={x + 8 + i * 5} y={base + t * 0.35} width="3" height={t * 0.4} rx="1" fill="#8d89cf" />)}
      {look.hz != null && look.hz >= 100 && <text x={cx} y={base - lh / 2 + 4} textAnchor="middle" fontSize={Math.max(11, lw / 7)} fontWeight="800" fill="#fff">{look.hz} Hz</text>}
      {Array.from({ length: blocks }, (_, i) => <rect key={i} x={x + 11 + i * 12} y={base - lh + 12} width="9" height="9" rx="2" fill="#7cf0e0" />)}
      {look.ram == null && <text x={x + 11} y={base - lh + 21} fontSize="11" fill="#fff">RAM ?</text>}
    </svg>
  );
}
