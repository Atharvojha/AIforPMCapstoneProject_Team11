// Plain-language summaries of an answer, for reading aloud and for sharing. Every word comes from the backend reply:
// this file only arranges text the backend already produced, it never adds a fact.
import type { Block, Reply } from './types';

const first = (a?: string[]) => (a && a[0] ? a[0] : '');
export function summaryLines(reply: Reply, max = 3): string[] {
  const out: string[] = []; const notices = reply.blocks.filter((b) => b.type === 'notice').slice(0, 1).map((b) => String(b.text));
  for (const b of reply.blocks) {
    if (b.type === 'cards') { (b.cards as any[]).slice(0, max).forEach((c, i) => out.push(`${i + 1}. ${String(c.name).split(' · ')[0]}, ${c.price_text}, as of ${c.as_of_text}. ${first(c.reasons)}`.trim())); }
    else if (b.type === 'compare') { out.push(`Comparing ${(b.laptops as any[]).map((l) => String(l.name).split(' · ')[0]).join(' and ')}.`); out.push(String(b.note)); }
    else if (b.type === 'claims') for (const r of (b.rows as any[]).slice(0, 5)) out.push(`${r.claim_text}: ${r.label ?? r.status}. ${r.detail ?? ''}`.trim());
    else if (b.type === 'findings') for (const f of (b.findings as any[]).slice(0, 5)) out.push(String(f.text));
    else if (b.type === 'sell_plan') out.push(`${b.laptop}: a used one might sell for ${b.range.low_text} to ${b.range.high_text}. ${(b.disclaimers as string[])[0] ?? ''}`.trim());
    else if (b.type === 'evidence') for (const t of (b.topics as any[]).slice(0, 3)) out.push(t.enough ? `${t.topic}: ${t.positive} positive and ${t.negative} negative owner opinions, of ${t.n}.` : `${t.topic}: not enough owner evidence yet (n = ${t.n}).`);
    else if (b.type === 'text' && out.length < 2) out.push(String(b.text));
    else if (b.type === 'image_read' && b.readable) out.push(`I read your picture as ${b.kind_label}.`);
  }
  return [...notices, ...out];
}
export const speechText = (reply: Reply): string => summaryLines(reply, 3).join(' ').replace(/[₹]/g, 'rupees ').replace(/\s+/g, ' ').trim();
export const shareText = (reply: Reply, siteName = 'LapFit'): string => `${summaryLines(reply, 3).join('\n')}\n\n— ${siteName}: facts with dates, not live prices.`.trim();
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text.slice(0, 1500))}`;
export const hasShareable = (blocks: Block[]) => blocks.some((b) => ['cards', 'compare', 'claims', 'findings', 'sell_plan'].includes(b.type));
