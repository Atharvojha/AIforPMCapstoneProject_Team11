const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 33 + c.charCodeAt(0)) % 360; return h; };

/**
 * A drawn laptop, used when there is no photo (or the photo fails to load). It is an illustration, not the product:
 * the lid takes a brand colour, the screen follows the recorded screen size, the base is thinner for lighter laptops.
 */
export function LaptopArt({ brand, screen, weight, name }: { brand: string; screen?: number | null; weight?: number | null; name?: string }) {
  const hue = hueOf(brand.toLowerCase()); const w = 124 + Math.max(-14, Math.min(26, ((screen ?? 15) - 15) * 12)); const x = (200 - w) / 2; const thick = weight == null ? 7 : Math.max(4, Math.min(10, 3 + weight * 2.4));
  const h = Math.round(w * 0.62);
  return (
    <svg className="laptop-art" viewBox="0 0 200 150" role="img" aria-label={`Illustration of a laptop${name ? `: ${name}` : ''}. Not a photo of this exact laptop.`}>
      <defs>
        <linearGradient id={`la-lid-${hue}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={`hsl(${hue} 70% 62%)`} /><stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 70% 45%)`} /></linearGradient>
        <linearGradient id="la-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b1d3d" /><stop offset="1" stopColor="#2a2d5a" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="136" rx={w / 2 + 14} ry="7" fill="#000" opacity=".12" />
      <rect x={x} y={118 - h} width={w} height={h} rx="8" fill={`url(#la-lid-${hue})`} />
      <rect x={x + 6} y={124 - h} width={w - 12} height={h - 12} rx="4" fill="url(#la-screen)" />
      <rect x={x + 14} y={134 - h} width={(w - 28) * 0.55} height="5" rx="2.5" fill="#fff" opacity=".85" /><rect x={x + 14} y={145 - h} width={(w - 28) * 0.35} height="4" rx="2" fill="#fff" opacity=".45" />
      <rect x={x + 14} y={158 - h} width={(w - 28) * 0.8} height={Math.max(6, h - 48)} rx="4" fill="#fff" opacity=".1" />
      <path d={`M${x - 14} 118 H${x + w + 14} L${x + w + 8} ${118 + thick} H${x - 8} Z`} fill="#cfcdf5" /><rect x="88" y="118" width="24" height="3" rx="1.5" fill="#a9a6de" />
      <text x="100" y={102 - h / 2 + 24} textAnchor="middle" fontSize="0" aria-hidden="true">{brand}</text>
    </svg>
  );
}
