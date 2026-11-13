// F05 Owner voice: what owners say, by topic, with counts. Dataset opinions, approved owner reports, and live web results kept apart.
import { resolveVariant, TOPIC_OF } from './pitch.ts';
import { liveFor } from './livecards.ts';
import { askBlock, withBase } from './ask.ts';
import type { Deps, Row, Block } from '../types.ts';
import type { Mention } from '../router.ts';

const PERSONA: [RegExp, string][] = [[/gamer|gaming/i, 'gamer'], [/student|college|school/i, 'student'], [/develop|coder|programmer|engineer/i, 'developer'], [/parent|mom|dad|mother|father/i, 'parent'], [/creator|editor|designer|video/i, 'creator'], [/profession|office|work/i, 'professional']];
export const personaOf = (t: string) => PERSONA.find(([re]) => re.test(t))?.[1] ?? null;
export const topicFromText = (t: string) => TOPIC_OF.find(([re]) => re.test(t.toLowerCase()))?.[1] ?? null;
const MONTHS = /(\d+)\s*(?:months?|mo)\b|after\s+(?:a|one|1)\s+year|(\d+)\s*years?\s*(?:of use|later|old)/i;

export async function ownerVoice(deps: Deps, mention: Mention | undefined, text: string, variantId?: string): Promise<{ blocks: Block[] }> {
  const { tools, settings } = deps; const blocks: Block[] = []; const minN = settings.MIN_EVIDENCE_N ?? 20;
  const topic = topicFromText(text); const persona = personaOf(text);
  if (persona || MONTHS.test(text)) blocks.push({ type: 'notice', text: `The recorded dataset has no user type or months-owned on its reviews, so I cannot filter by ${[persona && `"${persona}"`, MONTHS.test(text) && 'time owned'].filter(Boolean).join(' or ')} there. ${persona ? 'Approved owner reports that carry a user type are shown separately below when they exist.' : ''}` });
  if (!mention && !variantId) {
    // no laptop named: leaderboard of laptops on this topic, only where there is enough evidence
    if (!topic) return { blocks: [...blocks, askBlock('Which laptop do you want owner opinions on?', { action: 'owner_voice', topic: text.slice(0, 200) }, null)] };
    const names = await tools.call<{ rows: Row[] }>('find_variants', {});
    const list = (await Promise.all(names.rows.map(async (r) => { const s = await tools.call<any>('evidence_summary', { variant_id: r.variant_id, topic }); const t = s.topics[0]; return t ? { name: r.display_name, variant_id: r.variant_id, ...t } : null; }))).filter(Boolean) as any[];
    const enough = list.filter((x) => x.enough).sort((a, b) => b.positive / b.n - a.positive / a.n);
    blocks.push({ type: 'topic_board', topic, min_n: minN, rows: enough.map((x) => ({ name: x.name, variant_id: x.variant_id, n: x.n, positive: x.positive, negative: x.negative })), thin: list.length - enough.length,
      note: enough.length ? `Only laptops with at least ${minN} owner opinions on ${topic} are listed. Counts are machine-read, not human-verified.` : `No laptop has at least ${minN} owner opinions on ${topic} yet, so I am not ranking any.` });
    return { blocks };
  }
  let vid = variantId ?? '';
  if (!vid) {
    const res = await resolveVariant(deps, mention!, { pickFirst: true, web: true }); if ((res as any).assumed) blocks.push({ type: 'notice', text: `I used ${(res as any).assumed}.` });
    if (res.kind !== 'one') return { blocks: [...blocks, ...withBase(res.blocks, { action: 'owner_voice', topic: text.slice(0, 200) })] };
    vid = res.variantId;
  }
  const got = await tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: vid });
  if (!got.found) return { blocks: [{ type: 'text', text: 'That laptop is not in the catalog.' }] };
  const row = got.specs;
  const ev = await tools.call<any>('evidence_summary', { variant_id: row.variant_id, topic: topic ?? undefined });
  const topics = await Promise.all(ev.topics.map(async (t: any) => ({ ...t, quotes: t.enough ? (await tools.call<any>('evidence_quotes', { variant_id: row.variant_id, topic: t.topic, limit: 3 })).quotes : [] })));
  blocks.push({ type: 'evidence', laptop: row.display_name, variant_id: row.variant_id, min_n: minN, label: ev.label, topics });
  if (!topics.length) blocks.push({ type: 'text', text: `There are no recorded owner opinions${topic ? ` about ${topic}` : ''} for ${row.display_name}.` });
  const rep = await tools.call<any>('owner_reports', { variant_id: row.variant_id, persona: persona ?? undefined, topic: topic ?? undefined });
  blocks.push({ type: 'owner_reports', laptop: row.display_name, n: rep.n, label: rep.label, rows: rep.n >= minN ? rep.rows : [], note: rep.n ? (rep.n >= minN ? '' : `Only ${rep.n} approved owner report${rep.n > 1 ? 's' : ''} so far (we need ${minN}), so none are quoted.`) : 'No approved owner reports yet.' });
  blocks.push(...(await liveFor(deps, [row], topic ?? undefined)));
  return { blocks };
}
