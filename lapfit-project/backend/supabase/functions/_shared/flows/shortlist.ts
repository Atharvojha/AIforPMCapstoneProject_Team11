// F01 Shortlist. Needs in, a short list that meets every Must out. Filtering, ranking and relaxing are code and SQL.
import { criteriaFromNeeds, publicNeeds, actualText } from '../normalise.ts';
import { rank, onePerModel, colourNotes, relaxOptions, findRows, type Evidence, type Scored } from '../rank.ts';
import { buildCard, type Card } from '../cards.ts';
import { fmtInr, fmtDate } from '../util.ts';
import { lensData, type LensData } from '../lens.ts';
import { liveFor } from './livecards.ts';
import type { Deps, Needs, Row, Block } from '../types.ts';
import type { CriteriaSet } from '../normalise.ts';
import type { LensId } from '../soft.ts';

export interface ShortlistResult { blocks: Block[]; cards: Card[]; matched: number; demand: { budget: number | null; use_cases: string[]; musts: string[] } }

const TEXTY = new Set(['brand', 'os_family', 'cpu_vendor', 'gpu_class', 'cpu_contains']);
export function factLinesFor(s: Scored, needs: Needs, crit: CriteriaSet, minN: number, extra: string[] = []): string[] {
  const r = s.row; const lines: string[] = [];
  for (const c of crit.musts.filter((x) => x.supported && !x.implicit)) lines.push(TEXTY.has(c.attribute as string) ? `Meets your must: ${c.label}.` : `Meets your must: ${c.label}. This laptop has ${actualText(c, r)}.`);
  if (r.price_inr != null) {
    if (needs.budget_max_inr) lines.push(`Costs ${fmtInr(r.price_inr)}, ${fmtInr(needs.budget_max_inr - r.price_inr)} under your budget of ${fmtInr(needs.budget_max_inr)} (as of ${fmtDate(r.price_as_of)}).`);
    else lines.push(`Costs ${fmtInr(r.price_inr)} as of ${fmtDate(r.price_as_of)}.`);
  }
  for (const c of s.metShoulds) lines.push(`Also matches: ${c.label}.`);
  for (const c of s.metNices) lines.push(`Nice to have, met: ${c.label}.`);
  lines.push(...extra);
  for (const u of needs.use_cases ?? []) {
    if (/light|travel|portab/.test(u) && r.weight_kg != null) lines.push(`Weighs ${r.weight_kg} kg, which suits ${u}.`);
    else if (/cod|edit|design|gam|video/.test(u) && r.ram_gb != null && r.storage_gb != null) lines.push(`${r.ram_gb} GB RAM and ${r.storage_gb} GB storage for ${u}.`);
    else if (u !== 'value' && r.ram_gb != null && r.display_size != null) lines.push(`${r.ram_gb} GB RAM and a ${r.display_size} inch screen for ${u}.`);
  }
  if (s.evidence.n >= minN) lines.push(`${s.evidence.positive} of ${s.evidence.n} owner opinions are positive (machine-read).`);
  return [...new Set(lines)].slice(0, 7);
}

export async function runShortlist(deps: Deps, needs: Needs, o: { lenses?: LensId[]; wantLive?: boolean } = {}): Promise<ShortlistResult> {
  const { tools, settings } = deps; const minN = settings.MIN_EVIDENCE_N ?? 20;
  const crit = criteriaFromNeeds(needs);
  const found = await findRows(tools, needs, crit.musts);
  const rows = found.rows;
  const unsupported = [...crit.musts, ...crit.shoulds, ...crit.nices].filter((c) => !c.supported);
  const demand = { budget: needs.budget_max_inr, use_cases: needs.use_cases ?? [], musts: crit.musts.filter((c) => !c.implicit && c.supported).map((c) => c.label) };
  const blocks: Block[] = [{ type: 'understood', needs: publicNeeds(needs), matched: rows.length, demand }];
  if (unsupported.length) blocks.push({ type: 'notice', text: `I cannot check these yet, so they did not filter the results: ${unsupported.map((c) => c.label).join('; ')}.` });
  const unk = Object.entries(found.unknown_values ?? {}).filter(([, n]) => n > 0);
  if (unk.length) blocks.push({ type: 'notice', text: `Some laptops have no value on file for ${unk.map(([a, n]) => `${a.replace('_', ' ')} (${n})`).join(', ')}. A laptop with an unknown value never counts as meeting that Must.` });

  if (needs.budget_max_inr) {
    const low = await tools.call<{ rows: Row[] }>('find_variants', {});
    const min = Math.min(...low.rows.map((r) => r.price_inr ?? Infinity));
    if (isFinite(min) && needs.budget_max_inr < min) blocks.push({ type: 'notice', text: `The cheapest laptop in the catalog is ${fmtInr(min)}, above your budget of ${fmtInr(needs.budget_max_inr)}.` });
  }

  if (!rows.length) {
    const opts = await relaxOptions(tools, needs, crit);
    blocks.push({ type: 'text', text: 'Nothing in the catalog meets every Must. I have not dropped any of them.' });
    if (opts.length) { blocks.push({ type: 'text', text: 'Closest ways forward:' }); for (const x of opts) blocks.push({ type: 'offer', label: `${x.label}. This adds ${x.adds} laptop${x.adds > 1 ? 's' : ''}.`, needs: x.needs }); }
    else blocks.push({ type: 'text', text: 'Even with any single Must relaxed, nothing fits. You may need to change two things at once.' });
    return { blocks, cards: [], matched: 0, demand };
  }

  const evidence = new Map<string, Evidence>();
  await Promise.all(rows.map(async (r) => { const e = await tools.call<{ total: Evidence }>('evidence_summary', { variant_id: r.variant_id }); evidence.set(r.variant_id, e.total); }));
  const lens: LensData = o.lenses?.length ? await lensData(tools, settings, o.lenses, rows) : { bonus: new Map(), facts: new Map(), labels: [] };
  const ranked = onePerModel(rank(rows, needs, crit, evidence, settings, lens.bonus));
  const top = ranked.slice(0, settings.SHORTLIST_MAX ?? 5);
  const cards = top.map((s) => buildCard(s.row, { musts: crit.musts, requireAll: true, evidence: s.evidence, minN, factLines: factLinesFor(s, needs, crit, minN, lens.facts.get(s.row.variant_id) ?? []) }));
  const wanted = [...crit.nices, ...crit.shoulds].filter((c) => c.supported && c.attribute === 'colour').flatMap((c) => c.value as string[]);
  for (const n of colourNotes(wanted, top.map((s) => s.row))) blocks.push({ type: 'notice', text: n });
  const open = crit.musts.filter((c) => !c.implicit).length === 0 && !needs.budget_max_inr;
  blocks.push({ type: 'cards', title: open ? `${top.length} laptop${top.length > 1 ? 's' : ''} from the catalog (nothing was filtered)` : crit.musts.every((c) => c.implicit) ? `${top.length} laptop${top.length > 1 ? 's' : ''} within your budget` : `${top.length} laptop${top.length > 1 ? 's' : ''} that meet every Must`, cards, first: settings.SHORTLIST_FIRST ?? 3, requireAll: true, compare: true });
  if (lens.labels.length) blocks.push({ type: 'notice', text: `Ranked using ${lens.labels.join(' and ')}. These are owner-reported guides, not catalog facts.` });
  if (open) blocks.push({ type: 'choices', question: 'To narrow this down, tell me one of these:', choices: [{ label: 'My budget', send: 'My budget is ' }, { label: 'What I will use it for', send: 'I will use it for ' }, { label: 'A brand I prefer or avoid', send: 'I prefer ' }] });
  if (o.wantLive) blocks.push(...(await liveFor(deps, top.slice(0, settings.LIVE_PER_QUERY ?? 2).map((s) => s.row), o.lenses?.includes('looks') ? 'design' : undefined)));
  return { blocks, cards, matched: rows.length, demand };
}
