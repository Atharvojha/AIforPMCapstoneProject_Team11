// A picture you can send on WhatsApp: the top picks as a card, drawn from the answer's own text. No server involved.
import type { Reply } from './types';

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number): number {
  const words = text.split(/\s+/); let line = ''; let lines = 0;
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; lines++; line = w; if (lines >= maxLines) return y; } else line = t; }
  if (line) { ctx.fillText(line, x, y); y += lh; } return y;
}
export interface CardLine { title: string; sub: string }
export function cardLines(reply: Reply): CardLine[] {
  const out: CardLine[] = [];
  for (const b of reply.blocks) {
    if (b.type === 'cards') for (const c of (b.cards as any[]).slice(0, 3)) out.push({ title: `${String(c.name).split(' · ')[0]}  ${c.price_text}`, sub: `as of ${c.as_of_text}. ${c.reasons?.[0] ?? c.evidence?.text ?? ''}` });
    if (b.type === 'compare') for (const l of (b.laptops as any[]).slice(0, 3)) out.push({ title: String(l.name).split(' · ')[0], sub: String(l.name).split(' · ')[1] ?? '' });
    if (b.type === 'sell_plan') out.push({ title: String(b.laptop).split(' · ')[0], sub: b.range?.low_text && b.range?.high_text ? `A used one might sell for ${b.range.low_text} to ${b.range.high_text}` : 'No price range yet' });
  }
  return out;
}
export function renderShareCard(reply: Reply, canvas: HTMLCanvasElement): boolean {
  const lines = cardLines(reply); const ctx = canvas.getContext('2d'); if (!ctx || !lines.length) return false;
  const W = 1080; const H = 1080; canvas.width = W; canvas.height = H;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5b3df5'); g.addColorStop(1, '#00b8a3'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.96)'; const r = 40; ctx.beginPath(); ctx.moveTo(60 + r, 150); ctx.arcTo(W - 60, 150, W - 60, H - 150, r); ctx.arcTo(W - 60, H - 150, 60, H - 150, r); ctx.arcTo(60, H - 150, 60, 150, r); ctx.arcTo(60, 150, W - 60, 150, r); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 54px system-ui, sans-serif'; ctx.fillText('LapFit says…', 70, 100);
  let y = 250; ctx.fillStyle = '#16163a';
  lines.slice(0, 3).forEach((l, i) => { ctx.font = '700 44px system-ui, sans-serif'; y = wrap(ctx, `${i + 1}. ${l.title}`, 110, y, W - 220, 54, 2); ctx.font = '400 32px system-ui, sans-serif'; ctx.fillStyle = '#4b4b6b'; y = wrap(ctx, l.sub, 110, y + 4, W - 220, 42, 3) + 34; ctx.fillStyle = '#16163a'; });
  ctx.fillStyle = '#fff'; ctx.font = '400 30px system-ui, sans-serif'; ctx.fillText('Prices are a saved snapshot, not live. A second opinion, not advice.', 70, H - 70);
  return true;
}
export const canvasToBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
