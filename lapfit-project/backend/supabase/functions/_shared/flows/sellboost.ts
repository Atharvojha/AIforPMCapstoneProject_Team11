// SELL BOOSTERS: what else the seller can do to get more money. Three sources, each labelled:
//  rule   - arithmetic in code on the person's own inputs (the same sample factors as the estimate)
//  owners - owner review topics for this laptop from the dataset, only when the count is at least MIN_EVIDENCE_N, with the counts quoted
//  web    - a labelled web search on resale trends (cached, counted against the daily live limit, links shown, NOT verified).
//           Only the laptop name and a fixed topic ("resale") leave the system, never the person's other words.
import { liveReviews } from '../live.ts';
import { fmtInr } from '../util.ts';
import { resale, ageFactor, flagsOf, type ResaleCfg, type SellInput } from './sell.ts';
import type { Deps, Row } from '../types.ts';

export interface Booster { title: string; why: string; source: 'rule' | 'owners' | 'web'; gain_text?: string; items?: { snippet: string; url: string; site: string }[] }
export interface BoostCtx { cfg: ResaleCfg; price: number | null; input: SellInput; row: Row | null; name: string; td: string; base: { mid: number } | null; fixes: any[] }

const NEG_SHARE = 0.3;   // "many complaints" = at least 30% of the opinions on that topic are negative (and n >= MIN_EVIDENCE_N)
const OWNER_TOPICS: Record<string, { title: string; fix: string }> = {
  battery: { title: 'Replace the battery before you sell: the highest value fix for this model', fix: 'a new battery answers the most common worry a buyer of this model will have' },
  heat_noise: { title: 'Clean the fans and renew the thermal paste before you sell', fix: 'a clean, cool-running laptop answers the heat complaint buyers will ask about' },
  hinge: { title: 'Check the hinge and tighten or repair it before you sell', fix: 'a firm hinge answers the build complaint buyers will check first' },
  keyboard: { title: 'Test every key and fix or clean the keyboard before you sell', fix: 'a working keyboard answers the typing complaints owners report' },
  display: { title: 'Check the screen carefully and show the buyer it is clean and even', fix: 'owners report display problems, so a buyer will look at the screen first' },
};

const gainText = (gain: number, extra = '') => (gain > 0 ? `Adds about ${fmtInr(gain)} to the middle of the sample estimate${extra}` : undefined);

export async function sellBoosters(deps: Deps, c: BoostCtx): Promise<{ boosters: Booster[] }> {
  const out: Booster[] = []; const fl = flagsOf(c.input);
  // (a) rules on the person's inputs
  if (c.price != null && c.base) {
    const price = c.price; const withFlags = (add: string[], remove: string[] = []) => resale(price, { ...c.input, flags: [...(c.input.flags ?? []).filter((k) => !remove.includes(k)), ...add] }, c.cfg).mid - c.base!.mid;
    const bf = c.fixes.find((f) => f.fix === 'Replace the battery');
    if (bf) out.push({ title: 'Replace the battery', source: 'rule', why: fl.has('battery_swollen') ? 'A swollen battery cuts the price a lot and is unsafe.' : `Battery health is ${c.input.battery_health_pct}%, which lowers what buyers pay.`,
      gain_text: `Adds about ${fmtInr(bf.adds)}, costs about ${fmtInr(bf.cost)} (sample estimate, not a quote): net ${bf.net >= 0 ? '' : 'minus '}${fmtInr(Math.abs(bf.net))}. ${bf.worth_it ? 'Worth doing on these numbers.' : 'Not worth doing on these numbers.'}` });
    if (fl.has('no_charger')) { const g = withFlags([], ['no_charger']); if (g > 0) out.push({ title: 'Get the original charger', source: 'rule', why: 'A laptop without its original charger sells for less.', gain_text: gainText(g, ', before what a charger costs you') }); }
    if (!fl.has('has_bill')) { const g = withFlags(['has_bill']); if (g > 0) out.push({ title: 'Find the original bill', source: 'rule', why: 'The bill proves the purchase date and that it is yours.', gain_text: gainText(g, ' if you have it') }); }
    if (!fl.has('has_box')) { const g = withFlags(['has_box']); if (g > 0) out.push({ title: 'Find the original box', source: 'rule', why: 'Buyers pay a little more for a complete set.', gain_text: gainText(g, ' if you have it') }); }
    if (!fl.has('warranty_left')) { const g = withFlags(['warranty_left']); if (g > 0) out.push({ title: 'Check whether warranty is still left', source: 'rule', why: 'If it is, show the end date and the invoice: buyers pay more for cover.', gain_text: gainText(g, ' if it is still under warranty') }); }
    if (c.input.age_years != null && c.input.age_years < 6) {
      const now = ageFactor(c.cfg.age, c.input.age_years), later = ageFactor(c.cfg.age, c.input.age_years + 1); const drop = Math.round(c.base.mid * (1 - later / now) / 500) * 500;
      if (drop > 0) out.push({ title: 'Sell sooner rather than later', source: 'rule', why: `The sample age factor goes from ${now} to ${later} when the laptop is one year older.`, gain_text: `Waiting a year lowers the sample estimate by about ${fmtInr(drop)}` });
    }
  }
  out.push({ title: 'Clean it and reset it', source: 'rule', why: 'A clean laptop with photos in daylight and a fresh reset looks cared for. I have no data on how much this adds, so I give no figure.' });
  if (fl.has('need_fast')) out.push({ title: 'List at the low end of the range', source: 'rule', why: 'You need to sell fast, so price near the low end to get offers sooner.' });
  // (b) owner review topics for this laptop from the dataset
  if (c.row) {
    try {
      const ev = await deps.tools.call<any>('evidence_summary', { variant_id: c.row.variant_id }); const minN = Number(deps.settings.MIN_EVIDENCE_N ?? ev.min_n ?? 20);
      for (const t of ev.topics ?? []) {
        const spec = OWNER_TOPICS[t.topic]; if (!spec || t.n < minN || t.negative / t.n < NEG_SHARE) continue;
        if (t.topic === 'battery' && fl.has('battery_replaced')) continue;
        out.push({ title: spec.title, source: 'owners', why: `${t.negative} of ${t.n} owner opinions on ${t.topic.replace('_', ' / ')} for this laptop are negative (machine-read, not human-verified), so ${spec.fix}.` });
      }
    } catch { /* the owner data is optional */ }
  }
  // (c) a labelled web search on resale trends
  const key = c.row ? c.row.variant_id : `WEB:resale:${c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)}`;
  const web = await liveReviews({ tools: deps.tools, source: deps.live ?? null, settings: deps.settings, variantId: key, laptop: c.name.split(' · ')[0], topic: 'resale' });
  const ok = web.status === 'ok' || web.status === 'cached';
  out.push({ title: 'What the web says about reselling this laptop', source: 'web',
    why: ok ? `${web.note} Live, not verified: open the links to read the originals.` : web.note,
    items: ok ? web.items.map((i) => ({ snippet: i.snippet, url: i.url, site: i.site })) : [] });
  return { boosters: out };
}
