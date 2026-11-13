// F01 Shortlist. Needs in, a short list that meets every Must out. Filtering, ranking and relaxing are code and SQL.
import { capability } from '../rank.ts';
import { criteriaFromNeeds, publicNeeds, actualText, evalCriterion } from '../normalise.ts';
import { rank, onePerModel, colourNotes, relaxOptions, findRows, budgetOnly, strengthsOf, KNOWN_USE, gpuScore, isSortKey, sellable, SORT_KEYS, SORT_LABEL, type Evidence, type Scored, type SortKey } from '../rank.ts';
import { buildCard, type Card } from '../cards.ts';
import { fmtInr, fmtDate, parseInrAmounts } from '../util.ts';
import type { Tools } from '../tools.ts';
import { lensData, type LensData } from '../lens.ts';
import { liveFor } from './livecards.ts';
import type { Deps, Needs, Row, Block } from '../types.ts';
import type { CriteriaSet } from '../normalise.ts';
import type { LensId } from '../soft.ts';

/** Capability for a use as a share (0..100) of the strongest laptop in the whole catalog for that use. Shared with the web catalog so both tiers use ONE fit logic. */
export function relativeFit(cap: number, uses: string[], all: Row[]): number {
  const maxP = Math.max(0, ...all.map((r) => (r.price_inr != null && r.price_inr > 0 ? (r.price_inr as number) : 0))) || null; const refCap = Math.max(1, ...all.map((r) => capability(r, uses, maxP)));
  return Math.min(100, (100 * cap) / refCap);
}
/** The catalog rows a fit is measured against, and the maxPrice used by capability(). */
export async function fitReference(tools: Tools): Promise<Row[]> { return (await tools.call<{ rows: Row[] }>('find_variants', {})).rows.filter(sellable); }

/** One plain sentence: how the list is ordered and why. */
export function sortNote(sort: SortKey, needs: Needs, crit: CriteriaSet, fellBack = false): string {
  const b = needs.budget_max_inr && needs.budget_max_inr > 0 ? needs.budget_max_inr : null;
  switch (sort) {
    case 'budget': return `Closest to your ${fmtInr(b as number)} budget from below first, so the highest price comes first.`;
    case 'price_low': return 'Cheapest first. The cheapest is not the strongest, so check the specs.';
    case 'price_high': return 'Most expensive first. A higher price does not always mean a better laptop.';
    case 'light': return 'Lightest first by recorded weight. Laptops with no recorded weight go last.';
    case 'reviews': return 'Most owner opinions first. More opinions means more evidence, not a better laptop.';
    default:
      if (budgetOnly(needs, crit)) return b ? `${fellBack ? 'Showing best fit. ' : ''}Strongest laptops within your ${fmtInr(b)} budget first (RAM, storage, processor, graphics). If two are close, the one nearer your budget goes first.` : `${fellBack ? 'Showing best fit. ' : ''}Strongest laptops first (RAM, storage, processor, graphics). You gave no budget or use, so nothing else is weighed.`;
      return `${fellBack ? 'Showing best fit. ' : ''}Ordered by how well their recorded specs suit what you said, with your Shoulds and Nice-to-haves counted.${b ? ' Price only breaks ties.' : ''}`;
  }
}

const countWord = (shown: number, total: number) => (total > shown ? `Top ${shown} of the ${total} laptops` : `${shown} laptop${shown > 1 ? 's' : ''}`);
/** Budgets are numbers or numeric text ("1.5 lakh" is read in code); anything else is dropped with a visible notice, never passed to SQL. */
export function cleanBudget(v: unknown): { value: number | null; ignored?: string } {
  if (v == null || v === '') return { value: null };
  let n: number | null = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') { const t = v.trim(); n = /^\d+(\.\d+)?$/.test(t.replace(/,/g, '')) ? Number(t.replace(/,/g, '')) : parseInrAmounts(t)[0]?.value ?? null; }
  if (n == null || !Number.isFinite(n) || n <= 0 || n > 10_000_000) return { value: null, ignored: typeof v === 'number' ? (Number.isFinite(v) ? String(v) : 'not a number') : JSON.stringify(String(v)).slice(0, 24) };
  return { value: Math.round(n) };
}
/** Other variants of the same model that are not shown, in plain words (e.g. the RTX version of the same name). */
export function siblingLines(r: Row, rows: Row[]): string[] {
  return rows.filter((x) => x.model_id === r.model_id && x.variant_id !== r.variant_id).slice(0, 2).map((x) => `Also sold as ${x.display_name.split(' · ').pop()}${x.gpu_text && x.gpu_text !== r.gpu_text ? ` with ${x.gpu_text}` : ''} at ${fmtInr(x.price_inr as number)}.`);
}
/** Which single Must, on its own, leaves how many laptops, and the best the catalog has for a number. */
export async function blockedBy(tools: Tools, needs: Needs, crit: CriteriaSet, all: Row[]): Promise<string[]> {
  const out: string[] = [];
  for (const c of crit.musts.filter((x) => x.supported)) {
    const alone = await findRows(tools, { ...needs, budget_max_inr: c.implicit && c.operator === '<=' ? needs.budget_max_inr : null, budget_min_inr: c.implicit && c.operator === '>=' ? needs.budget_min_inr : null }, [c]);
    const attr = c.attribute as string; const vals = all.map((r) => (r as any)[attr]).filter((x) => typeof x === 'number') as number[];
    let extra = '';
    if (typeof c.value === 'number' && vals.length && !alone.rows.length) { const best = c.operator === '<=' || c.operator === '<' ? Math.min(...vals) : Math.max(...vals); extra = attr === 'ram_gb' ? ` The most RAM any laptop here has is ${best} GB.` : ` The ${c.operator === '<=' || c.operator === '<' ? 'lowest' : 'highest'} value in the catalog is ${attr === 'price_inr' ? fmtInr(best) : String(best)}.`; }
    out.push(`Blocked by: ${c.label}. On its own it leaves ${alone.rows.length} laptop${alone.rows.length === 1 ? '' : 's'}.${extra}`);
  }
  return out;
}

export interface ShortlistResult { blocks: Block[]; cards: Card[]; matched: number; demand: { budget: number | null; use_cases: string[]; musts: string[] } }

const TEXTY = new Set(['brand', 'os_family', 'cpu_vendor', 'gpu_class', 'cpu_contains']);
export function factLinesFor(s: Scored, needs: Needs, crit: CriteriaSet, minN: number, extra: string[] = [], first: string[] = []): string[] {
  const r = s.row; const lines: string[] = [...first];
  for (const c of crit.musts.filter((x) => x.supported && !x.implicit)) lines.push(TEXTY.has(c.attribute as string) ? `Meets your must: ${c.label}.` : `Meets your must: ${c.label}. This laptop has ${actualText(c, r)}.`);
  if (r.price_inr != null) {
    if (needs.budget_max_inr && r.price_inr > needs.budget_max_inr) lines.push(`Costs ${fmtInr(r.price_inr)}, ${fmtInr(r.price_inr - needs.budget_max_inr)} over your budget of ${fmtInr(needs.budget_max_inr)} (as of ${fmtDate(r.price_as_of)}).`);
    else if (needs.budget_max_inr) lines.push(`Costs ${fmtInr(r.price_inr)}, which uses ${Math.round((r.price_inr / needs.budget_max_inr) * 100)}% of your budget of ${fmtInr(needs.budget_max_inr)} (as of ${fmtDate(r.price_as_of)}).`);
    else lines.push(`Costs ${fmtInr(r.price_inr)} as of ${fmtDate(r.price_as_of)}.`);
  }
  for (const c of s.metShoulds) lines.push(`Also matches: ${c.label}.`);
  for (const c of s.metNices) lines.push(`Nice to have, met: ${c.label}.`);
  lines.push(...extra);
  for (const u of (needs.use_cases ?? []).filter(KNOWN_USE)) {
    if (/light|travel|portab/.test(u)) { if (r.weight_kg != null && r.weight_kg <= 1.5) lines.push(`Weighs ${r.weight_kg} kg, which suits ${u}.`); }
    else if (/cod|edit|design|gam|video/.test(u) && r.ram_gb != null && r.storage_gb != null) lines.push(`${r.ram_gb} GB RAM and ${r.storage_gb} GB storage for ${u}.`);
    else if (u !== 'value' && r.ram_gb != null && r.display_size != null) lines.push(`${r.ram_gb} GB RAM and a ${r.display_size} inch screen for ${u}.`);
  }
  if (s.evidence.n >= minN) lines.push(`${s.evidence.positive} of ${s.evidence.n} owner opinions are positive (machine-read).`);
  return [...new Set(lines)].slice(0, 8);
}

/** The reason line for why this laptop sits where it does. It only states recorded facts that are true of it. */
export function orderLine(s: Scored, i: number, sort: SortKey, needs: Needs, bonly: boolean): string[] {
  const r = s.row; const st = strengthsOf(r).slice(0, 3).join(', ');
  switch (sort) {
    case 'budget': return needs.budget_max_inr && r.price_inr != null ? [`Ordered by closeness to your budget: ${fmtInr(r.price_inr)} of ${fmtInr(needs.budget_max_inr)}.`] : [];
    case 'price_low': return [`Ordered by price, low to high: ${fmtInr(r.price_inr as number)}.`];
    case 'price_high': return [`Ordered by price, high to low: ${fmtInr(r.price_inr as number)}.`];
    case 'light': return [r.weight_kg != null ? `Ordered by weight: ${r.weight_kg} kg.` : 'Weight is not recorded, so this is placed last when ordered by weight.'];
    case 'reviews': return [`Ordered by owner opinions: ${s.evidence.n} on record.`];
    default: return st ? [i === 0 ? `Ranked first on its recorded specs${bonly ? ' for the money' : ''}: ${st}.` : `Recorded specs: ${st}.`] : [];
  }
}
/** True when the top two are level on the thing they were ordered by (the page may then avoid calling one "the" best). */
export function tied(ranked: Scored[], sort: SortKey): boolean {
  const [a, b] = ranked; if (!a || !b) return false;
  switch (sort) {
    case 'budget': case 'price_low': case 'price_high': return a.row.price_inr === b.row.price_inr;
    case 'light': return a.row.weight_kg === b.row.weight_kg;
    case 'reviews': return a.evidence.n === b.evidence.n;
    default: return Math.abs(a.score - b.score) < 1;
  }
}

export async function runShortlist(deps: Deps, needs: Needs, o: { lenses?: LensId[]; wantLive?: boolean; sort?: string | null } = {}): Promise<ShortlistResult> {
  const { tools, settings } = deps; const minN = settings.MIN_EVIDENCE_N ?? 20;
  const pre: Block[] = [];
  const clean = cleanBudget(needs.budget_max_inr); const cleanMin = cleanBudget(needs.budget_min_inr);
  needs = { budget_max_inr: clean.value, budget_min_inr: cleanMin.value, musts: Array.isArray(needs.musts) ? needs.musts : [], shoulds: Array.isArray(needs.shoulds) ? needs.shoulds : [], nices: Array.isArray(needs.nices) ? needs.nices : [], use_cases: Array.isArray(needs.use_cases) ? needs.use_cases.map(String) : [] };
  if (clean.ignored) pre.push({ type: 'notice', text: `I ignored the budget you sent (${clean.ignored}) because it is not a usable amount, so the list is not limited by price.` });
  if (cleanMin.ignored) pre.push({ type: 'notice', text: `I ignored the minimum price you sent (${cleanMin.ignored}) because it is not a usable amount.` });
  const inverted = needs.budget_max_inr != null && needs.budget_min_inr != null && needs.budget_min_inr > needs.budget_max_inr;
  const crit = criteriaFromNeeds(needs);
  const found = await findRows(tools, needs, crit.musts);
  const rows = found.rows;
  const unsupported = [...crit.musts, ...crit.shoulds, ...crit.nices].filter((c) => !c.supported);
  const demand = { budget: needs.budget_max_inr, use_cases: needs.use_cases ?? [], musts: crit.musts.filter((c) => !c.implicit && c.supported).map((c) => c.label) };
  const blocks: Block[] = [{ type: 'understood', needs: publicNeeds(needs), matched: rows.length, demand }, ...pre];
  const unknownUse = (needs.use_cases ?? []).filter((u) => !KNOWN_USE(u));
  if (unknownUse.length) blocks.push({ type: 'notice', text: `I cannot judge ${unknownUse.map((u) => `"${u}"`).join(', ')} from the catalog, so the order does not use it. I ranked on RAM, storage, processor and graphics instead.` });
  if (unsupported.length) blocks.push({ type: 'notice', text: `I cannot check these yet, so they did not filter the results: ${unsupported.map((c) => c.label).join('; ')}.` });
  const unk = Object.entries(found.unknown_values ?? {}).filter(([, n]) => n > 0);
  if (unk.length) blocks.push({ type: 'notice', text: `Some laptops have no value on file for ${unk.map(([a, n]) => `${a.replace('_', ' ')} (${n})`).join(', ')}. A laptop with an unknown value never counts as meeting that Must.` });

  let budgetNote: string | undefined;
  const all = (await tools.call<{ rows: Row[] }>('find_variants', {})).rows.filter(sellable);
  const prices = all.map((r) => r.price_inr as number);
  if (needs.budget_max_inr && prices.length) {
    const min = Math.min(...prices); const max = Math.max(...prices);
    if (needs.budget_max_inr < min) { budgetNote = `Your budget of ${fmtInr(needs.budget_max_inr)} is below everything I have: the cheapest laptop is ${fmtInr(min)}.`; blocks.push({ type: 'notice', text: `The cheapest laptop in the catalog is ${fmtInr(min)}, above your budget of ${fmtInr(needs.budget_max_inr)}.` }); }
    else if (needs.budget_max_inr > max) budgetNote = `Your budget is above everything I have: the highest price is ${fmtInr(max)}, so these are the strongest I have.`;
  }
  if (budgetNote) (blocks[0] as Block).budget_note = budgetNote;

  if (!rows.length) {
    const opts = await relaxOptions(tools, needs, crit);
    if (inverted) blocks.push({ type: 'text', text: `Your minimum price (${fmtInr(needs.budget_min_inr as number)}) is above your maximum (${fmtInr(needs.budget_max_inr as number)}). Did you mean ${fmtInr(needs.budget_max_inr as number)} to ${fmtInr(needs.budget_min_inr as number)}?` });
    blocks.push({ type: 'text', text: 'Nothing in the catalog meets every Must. I have not dropped any of them.' });
    for (const t of await blockedBy(tools, needs, crit, all)) blocks.push({ type: 'text', text: t });
    if (opts.length) { blocks.push({ type: 'text', text: 'Closest ways forward:' }); for (const x of opts) blocks.push({ type: 'offer', label: `${x.label}. This adds ${x.adds} laptop${x.adds > 1 ? 's' : ''}.`, needs: x.needs }); }
    else blocks.push({ type: 'text', text: 'Even with any single Must relaxed, nothing fits. You may need to change two things at once.' });
    return { blocks, cards: [], matched: 0, demand };
  }

  const evidence = new Map<string, Evidence>();
  await Promise.all(rows.map(async (r) => { const e = await tools.call<{ total: Evidence }>('evidence_summary', { variant_id: r.variant_id }); evidence.set(r.variant_id, e.total); }));
  const lens: LensData = o.lenses?.length ? await lensData(tools, settings, o.lenses, rows) : { bonus: new Map(), facts: new Map(), labels: [] };
  const asked = o.sort ?? 'best'; const sort: SortKey = isSortKey(asked) ? asked : 'best';
  const noBudget = sort === 'budget' && !(needs.budget_max_inr && needs.budget_max_inr > 0);
  const useSort: SortKey = noBudget ? 'best' : sort;
  // the sort only re-orders. Which laptops qualify was decided above (Musts), and one variant per model is kept in the chosen order.
  const ranked = onePerModel(rank(rows, needs, crit, evidence, settings, lens.bonus, { sort: useSort }));
  // a gaming list does not fill its places with laptops that have no separate graphics, unless fewer than 3 have it
  const gaming = (needs.use_cases ?? []).some((u) => /gam/i.test(u));
  const withGpu = ranked.filter((s) => (gpuScore(s.row) ?? 0) > 0);
  const pool = gaming && withGpu.length >= 3 ? withGpu : ranked;
  if (gaming && withGpu.length < 3) blocks.push({ type: 'notice', text: `Only ${withGpu.length} of the laptops that fit have a separate graphics card, so the rest of this list is not gaming-grade.` });
  const top = pool.slice(0, settings.SHORTLIST_MAX ?? 5);
  const note = sortNote(useSort, needs, crit, noBudget);
  const bonly = budgetOnly(needs, crit);
  // MATCH %: capability for the stated use measured against the strongest laptop in the WHOLE catalog for that use (so a ₹30k laptop is not scored against an imaginary ideal), blended with the Shoulds/Nices met. Recorded values only.
  const matchOf = (s: Scored, uses: string[]) => {
    const m = s.match; if (!m) return undefined; const rel = relativeFit(m.cap, uses, all); const pct = Math.max(0, Math.min(100, Math.round(m.sat == null ? rel : 0.65 * rel + 35 * m.sat)));
    const basis = [`Meets ${crit.musts.length ? `all ${crit.musts.length} of your Must${crit.musts.length === 1 ? '' : 's'}` : 'every Must you set'} and your budget`, `Strength for ${uses.length ? uses.join(', ') : 'everyday use'}: ${Math.round(rel)}% of the strongest laptop I have for it (from recorded RAM, storage, processor, graphics, screen, weight, battery)`];
    if (m.shouldsAll + m.nicesAll) basis.push(`Meets ${m.shouldsMet} of ${m.shouldsAll} Shoulds and ${m.nicesMet} of ${m.nicesAll} Nices`); if (m.unknown.length) basis.push(`Not recorded, so not counted: ${m.unknown.join(', ')}`);
    return { pct, label: `${pct}% match`, basis };
  };
  const cards = top.map((s, i) => Object.assign(buildCard(s.row, { musts: crit.musts, requireAll: true, evidence: s.evidence, minN, factLines: factLinesFor(s, needs, crit, minN, [...(lens.facts.get(s.row.variant_id) ?? []), ...siblingLines(s.row, rows)], orderLine(s, i, useSort, needs, bonly)) }), { match: matchOf(s, needs.use_cases ?? []) }));
  for (const c of crit.shoulds.filter((x) => x.supported)) if (top.length && top.every((s) => evalCriterion(c, s.row) !== true)) blocks.push({ type: 'notice', text: `None of these meets your Should: ${c.label}. They are the closest I have that meet every Must.` });
  const wanted = [...crit.nices, ...crit.shoulds].filter((c) => c.supported && c.attribute === 'colour').flatMap((c) => c.value as string[]);
  for (const n of colourNotes(wanted, top.map((s) => s.row))) blocks.push({ type: 'notice', text: n });
  const qualifying = new Set(rows.map((r) => r.model_id)).size;
  const open = crit.musts.filter((c) => !c.implicit).length === 0 && !needs.budget_max_inr;
  blocks.push({ type: 'cards', title: open ? `${top.length} laptop${top.length > 1 ? 's' : ''} from the catalog (nothing was filtered)` : `${countWord(top.length, qualifying)} ${crit.musts.every((c) => c.implicit) ? 'within your budget' : 'that meet every Must'}`, cards, first: settings.SHORTLIST_FIRST ?? 3, requireAll: true, compare: true, needs: JSON.parse(JSON.stringify(needs)), sort: { key: useSort, label: SORT_LABEL[useSort], note }, sorts: SORT_KEYS.filter((k) => k !== 'budget' || !!needs.budget_max_inr).map((k) => ({ key: k, label: SORT_LABEL[k] })), ...(budgetNote ? { budget_note: budgetNote } : {}), tie: tied(ranked, useSort) });
  if (needs.budget_max_inr && top.length < 3) {
    const cap = Math.floor(needs.budget_max_inr * 1.15);
    const more = await findRows(tools, { ...needs, budget_max_inr: cap }, criteriaFromNeeds({ ...needs, budget_max_inr: cap }).musts);
    const inModels = new Set(top.map((s) => s.row.model_id));
    const near = more.rows.filter((r) => (r.price_inr as number) > (needs.budget_max_inr as number) && !inModels.has(r.model_id));
    if (near.length) {
      const ev2 = new Map<string, Evidence>(); await Promise.all(near.map(async (r) => { ev2.set(r.variant_id, (await tools.call<{ total: Evidence }>('evidence_summary', { variant_id: r.variant_id })).total); }));
      const r2 = onePerModel(rank(near, needs, crit, ev2, settings, new Map(), { sort: 'best' })).slice(0, 2);
      const lowest = Math.min(...near.map((r) => r.price_inr as number));
      blocks.push({ type: 'cards', title: `A little over your budget (up to 15% more, from ${fmtInr(lowest)})`, over_budget: true, note: 'These are NOT within your budget. They are shown only because very little fits. Each costs more than you said.', cards: r2.map((s) => buildCard(s.row, { musts: crit.musts, requireAll: false, evidence: s.evidence, minN, factLines: factLinesFor(s, needs, crit, minN, [], []) })), first: 2, requireAll: false, compare: true });
    }
  }
  if (lens.labels.length) blocks.push({ type: 'notice', text: `Ranked using ${lens.labels.join(' and ')}. These are owner-reported guides, not catalog facts.` });
  if (open) blocks.push({ type: 'choices', question: 'To narrow this down, tell me one of these:', choices: [{ label: 'My budget', send: 'My budget is ' }, { label: 'What I will use it for', send: 'I will use it for ' }, { label: 'A brand I prefer or avoid', send: 'I prefer ' }] });
  if (o.wantLive) blocks.push(...(await liveFor(deps, top.slice(0, settings.LIVE_PER_QUERY ?? 2).map((s) => s.row), o.lenses?.includes('looks') ? 'design' : undefined)));
  return { blocks, cards, matched: rows.length, demand };
}
