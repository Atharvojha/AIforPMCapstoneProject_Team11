// Owner-evidence lenses for words that are not catalog fields. Counts come from SQL; code turns them into score and facts.
import { LOOKS_TERMS, type LensId } from './soft.ts';
import type { Tools } from './tools.ts';
import type { Row, Settings } from './types.ts';

export interface LensData { bonus: Map<string, number>; facts: Map<string, string[]>; labels: string[] }
const TOPIC: Partial<Record<LensId, { topic: string; noun: string }>> = { build: { topic: 'hinge', noun: 'build' }, battery_life: { topic: 'battery', noun: 'battery' } };

export async function lensData(tools: Tools, settings: Settings, lenses: LensId[], rows: Row[]): Promise<LensData> {
  const out: LensData = { bonus: new Map(), facts: new Map(), labels: [] };
  const add = (id: string, bonus: number, fact?: string) => { out.bonus.set(id, (out.bonus.get(id) ?? 0) + bonus); if (fact) out.facts.set(id, [...(out.facts.get(id) ?? []), fact]); };
  const minN = Number(settings.MIN_EVIDENCE_N ?? 20);
  for (const lens of lenses) {
    if (lens === 'looks') {
      out.labels.push('looks (owners who praised the design in reviews)');
      const r = await tools.call<{ rows: { variant_id: string; n: number; of: number }[] }>('term_mentions', { terms: LOOKS_TERMS, min_rating: Number(settings.LOOKS_MIN_RATING ?? 4) });
      const by = new Map(r.rows.map((x) => [x.variant_id, x]));
      for (const row of rows) {
        const m = by.get(row.variant_id); if (!m || !m.n) continue;
        add(row.variant_id, (Math.min(m.n, 40) / 40) * 2, `${m.n} owners praised the looks in their reviews${m.n < minN ? ' (a small number)' : ''}. Keyword match, not verified.`);
      }
    } else {
      const t = TOPIC[lens]!; out.labels.push(`${t.noun} (owner opinions)`);
      await Promise.all(rows.map(async (row) => {
        const s = await tools.call<{ topics: { n: number; positive: number; negative: number; enough: boolean }[] }>('evidence_summary', { variant_id: row.variant_id, topic: t.topic });
        const x = s.topics[0]; if (!x || !x.enough) return;
        add(row.variant_id, (x.positive / Math.max(1, x.positive + x.negative) - 0.5) * 2, `${x.positive} of ${x.n} owner opinions on ${t.noun} are positive (machine-read).`);
      }));
    }
  }
  return out;
}
