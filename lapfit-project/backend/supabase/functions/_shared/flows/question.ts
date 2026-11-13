// A follow-up question about one laptop. Sections, each with its own source: catalog facts, owner opinions (counts), the web (labelled live and not verified).
// Nothing here is written by an AI model, so nothing can be invented. Unknown values say "?". Predictions are never made.
import type { Deps, Block, Row } from '../types.ts';
import type { Intent, Ref } from '../followup.ts';
import { liveReviews } from '../live.ts';
import { win11Rule } from './used.ts';
import { fmtInr, fmtDate } from '../util.ts';

export const GUARDRAIL = 'What I can and cannot say: I only answer questions about laptops. I use the catalog, owner reviews and web pages, and I show where each part comes from. I do not predict the future or promise how long a laptop will last, and I do not tell you to buy or not to buy.';
const ALL: Intent[] = ['why', 'lifespan', 'problems', 'upgrade', 'price'];
export const SUGGEST: Record<Intent, string> = { why: 'Why this one?', lifespan: 'Will it last long?', problems: 'Common problems?', upgrade: 'Can I upgrade it?', suit: 'Is it good for my work?', price: 'Will the price drop?' };
const TOPICS: Record<Intent, string[] | 'all'> = { lifespan: ['build', 'battery', 'performance', 'heat_noise'], suit: ['performance', 'heat_noise', 'display'], problems: 'all', upgrade: [], why: [], price: [] };
const WEB_TOPIC: Record<Intent, string> = { lifespan: 'longevity', suit: 'performance', problems: 'problems', upgrade: 'upgrade', why: '', price: 'deals' };
const v = (x: unknown, unit = '') => (x == null || x === '' ? '?' : `${x}${unit}`);
const short = (n: string) => n.split(' · ')[0];

const slots = (r: Row) => (r.memory_slots == null || /unknown|not stated|^\s*$/i.test(String(r.memory_slots)) ? '? (not recorded)' : String(r.memory_slots));
function catalogLines(intent: Intent, r: Row): string[] {
  const price = r.price_inr ? `${fmtInr(r.price_inr)} as of ${fmtDate(r.price_as_of)} (a saved snapshot, not a live shop price)` : 'price ?';
  const w11 = win11Rule(r.cpu_text); const w11t = w11 === 'supported' ? 'supported by its processor' : w11 === 'unsupported' ? 'not supported by its processor' : '?';
  const base = [`${short(r.display_name)}: ${price}`];
  switch (intent) {
    case 'lifespan': return [...base, `Processor: ${v(r.cpu_text)}`, `Windows 11: ${w11t}`, `Memory: ${v(r.ram_gb, ' GB')}, memory slots: ${slots(r)}`, `Battery: ${v(r.battery_wh, ' Wh')}`, `Warranty: ${r.warranty_years != null ? `${r.warranty_years} year${Number(r.warranty_years) === 1 ? '' : 's'}` : '?'}`];
    case 'upgrade': return [...base, `Memory: ${v(r.ram_gb, ' GB')}, memory slots: ${slots(r)}`, `Storage: ${v(r.storage_gb, ' GB')}`, 'Whether the storage or battery can be replaced is not recorded: "?"'];
    case 'suit': return [...base, `Processor: ${v(r.cpu_text)}`, `Graphics: ${v(r.gpu_text)}`, `Memory: ${v(r.ram_gb, ' GB')}, storage: ${v(r.storage_gb, ' GB')}`, `Screen: ${v(r.display_size, ' inch')}, weight: ${v(r.weight_kg, ' kg')}`];
    case 'price': return [...base, 'I have one saved price for it, so I cannot show a price history or a trend', 'The shop price today may differ from this snapshot'];
    case 'problems': return [...base, `Warranty: ${r.warranty_years != null ? `${r.warranty_years} year${Number(r.warranty_years) === 1 ? '' : 's'}` : '?'}`];
    default: return base;
  }
}

export async function laptopQuestion(deps: Deps, o: { ref: Ref; intent: Intent; needsLines?: string[] }): Promise<{ blocks: Block[] }> {
  const { tools, settings } = deps; const minN = settings.MIN_EVIDENCE_N ?? 20;
  const got = await tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: o.ref.variant_id });
  if (!got.found) return { blocks: [{ type: 'text', text: 'That laptop is not in the catalog any more, so I will not guess. Pick one from the list.' }] };
  const row = got.specs; const name = short(row.display_name); const sections: any[] = [];
  const headline: Record<Intent, string> = {
    lifespan: `Nobody can tell you how many years a laptop will last, and I will not guess. Here is what is recorded and reported about ${name} that affects how long it stays useful.`,
    why: o.needsLines?.length ? `I showed ${name} because of what you told me. Here is what I used, and the reasons below.` : `You have not told me your needs in this chat yet, so I cannot say why it fits you. Here is what is recorded about ${name}.`,
    upgrade: `Here is what is recorded about upgrading ${name}. Anything not recorded is marked "?".`,
    suit: `I cannot test it for you. Here are the recorded specs of ${name} and what owners and web pages say about how it performs.`,
    price: `I cannot predict prices or tell you when to buy. In India the big shopping festivals (Flipkart Big Billion Days and Amazon Great Indian Festival, usually around September and October, and the Republic Day sales in January) often bring discounts on laptops, but not on every model or every year. This is a general pattern, not a promise. Below is the price I have for ${name} and what the web says about its current deals and price changes.`,
    problems: `Here is what owners and web pages report as problems with ${name}, with counts where I have them.`,
  };
  if (o.intent === 'why' && o.needsLines?.length) sections.push({ kind: 'catalog', title: 'What you asked for', items: o.needsLines });
  sections.push({ kind: 'catalog', title: 'What is recorded', items: catalogLines(o.intent, row) });

  const want = TOPICS[o.intent];
  if (want !== undefined && !(Array.isArray(want) && !want.length)) {
    const ev = await tools.call<any>('evidence_summary', { variant_id: row.variant_id });
    const topics = (ev.topics as any[]).filter((t) => want === 'all' || want.includes(t.topic));
    const items = topics.map((t) => t.enough ? `${t.topic.replace('_', ' / ')}: ${t.n} owner opinions, ${t.positive} positive, ${t.negative} negative` : `${t.topic.replace('_', ' / ')}: only ${t.n} owner opinion${t.n === 1 ? '' : 's'} (I need ${minN} before I show a count)`);
    sections.push({ kind: 'owners', title: 'What owners say (counted, machine-read, not human-verified)', items: items.length ? items : ['No recorded owner opinions on this.'] });
  }
  if (o.intent !== 'why') {
    const res = await liveReviews({ tools, source: deps.live ?? null, settings, variantId: row.variant_id, laptop: name, topic: WEB_TOPIC[o.intent] });
    sections.push({ kind: 'web', title: 'What the web says (not verified)', items: [], web: { status: res.status, items: res.items, note: res.note, fetched_at: res.fetched_at } });
  }
  const block: Block = { type: 'laptop_answer', laptop: { variant_id: row.variant_id, name: row.display_name, price_text: row.price_inr ? fmtInr(row.price_inr) : '?', as_of_text: fmtDate(row.price_as_of) }, intent: o.intent, headline: headline[o.intent], sections, guardrail: GUARDRAIL, suggestions: ALL.filter((i) => i !== o.intent).map((i) => SUGGEST[i]) };
  return { blocks: [block] };
}

/** The needs the person gave, as plain lines (from the browser's last understood needs). Only what they said; nothing added. */
export function needsLinesOf(n: any): string[] {
  if (!n || typeof n !== 'object') return [];
  const out: string[] = []; if (Number(n.budget_max_inr) > 0) out.push(`Budget up to ${fmtInr(Number(n.budget_max_inr))}`);
  if (Array.isArray(n.use_cases) && n.use_cases.length) out.push(`Use: ${n.use_cases.slice(0, 5).map(String).join(', ')}`);
  for (const [k, label] of [['musts', 'Must'], ['shoulds', 'Should'], ['nices', 'Nice']] as const) for (const c of (Array.isArray(n[k]) ? n[k] : []).slice(0, 6)) out.push(`${label}: ${String(c.label ?? `${c.attribute} ${c.operator ?? ''} ${c.value}`).slice(0, 80)}`);
  return out;
}
