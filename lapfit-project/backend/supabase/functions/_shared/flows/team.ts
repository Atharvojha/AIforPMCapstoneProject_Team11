// F04 Buy for others or a team. A clean table is read by code first; totals are exact sums computed in code.
import { criteriaFromNeeds } from '../normalise.ts';
import { findRows, rank, onePerModel, type Evidence } from '../rank.ts';
import { buildCard, publicCard, type Card } from '../cards.ts';
import { gateCards } from '../gate.ts';
import { runShortlist } from './shortlist.ts';
import { fmtInr, parseInrAmounts } from '../util.ts';
import type { Deps, Needs, Block, Row } from '../types.ts';

const ROLE_USE: [RegExp, string][] = [[/design|edit|video|photo|creative|media/i, 'editing'], [/develop|engineer|software|program|coder|it\b/i, 'coding'], [/account|admin|sales|hr|office|clerk|manager|front desk|reception|finance/i, 'office'], [/field|travel|site|marketing/i, 'travel'], [/student|class|lab|teacher|faculty/i, 'study']];
const useOf = (t: string) => ROLE_USE.find(([re]) => re.test(t))?.[1] ?? 'office';

export interface TeamRow { line: number; role: string; count: number; use: string; budget: number | null }
export function parseTeamTable(text: string): { rows: TeamRow[]; bad: { line: number; text: string }[]; totalBudget: number | null } {
  const rows: TeamRow[] = []; const bad: { line: number; text: string }[] = []; let totalBudget: number | null = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim(); if (!line) return;
    const tb = line.match(/total\s*budget[^\d₹r]*([₹\drsk.,\s]*(?:lakh|lac|k)?)|budget\s*(?:is|of)?\s*([₹\drsk.,\s]*(?:lakh|lac|k)?)\s*(?:in\s*)?total/i);
    if (tb) { const a = parseInrAmounts(tb[1] || tb[2] || ''); if (a.length) { totalBudget = a[0].value; return; } }
    const cells = (line.includes('|') ? line.split('|') : line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) { bad.push({ line: i + 1, text: line.slice(0, 80) }); return; }
    if (/^(role|team|department|designation)\b/i.test(cells[0]) && cells.some((c) => /count|people|number|qty|use|budget/i.test(c))) return;   // header
    let role = '', count: number | null = null, budget: number | null = null; const rest: string[] = [];
    for (const c of cells) {
      if (/^\d{1,4}$/.test(c) && count == null) count = Number(c);
      else if (/₹|rs\.?|inr|lakh|lac|\dk\b|^\d{1,3}(,\d{2,3})+$|^\d{5,7}$/i.test(c) && parseInrAmounts(c).length) budget = parseInrAmounts(c)[0].value;
      else if (!role) role = c; else rest.push(c);
    }
    if (!role || !count || count < 1) { bad.push({ line: i + 1, text: line.slice(0, 80) }); return; }
    rows.push({ line: i + 1, role, count, use: useOf(`${role} ${rest.join(' ')}`), budget });
  });
  return { rows, bad, totalBudget };
}

const PERSONA_DEFAULTS: { re: RegExp; name: string; shoulds: Needs['shoulds']; note: string }[] = [
  { re: /\b(mom|mother|dad|father|parents?|grandparents?|grandma|grandpa)\b/i, name: 'parent', shoulds: [{ attribute: 'display_size', operator: '>=', value: 14, source_text: 'for a parent' }, { attribute: 'weight_kg', operator: '<=', value: 1.8, source_text: 'for a parent' }], note: 'For a parent I assumed a screen of 14 inch or more and weight up to 1.8 kg. These are assumptions you can change.' },
  { re: /\b(son|daughter|kid|child|children|school)\b/i, name: 'child', shoulds: [{ attribute: 'warranty_years', operator: '>=', value: 2, source_text: 'for a child' }], note: 'For a child I assumed a warranty of 2 years or more. This is an assumption you can change.' },
];

export async function buyForOthers(deps: Deps, text: string, needs: Needs): Promise<{ blocks: Block[]; cards: Card[]; matched?: number }> {
  const { tools, settings, requestId } = deps; const minN = settings.MIN_EVIDENCE_N ?? 20;
  const table = parseTeamTable(text);
  if (table.rows.length >= 2 || (table.rows.length === 1 && table.rows[0].count > 1)) {
    const blocks: Block[] = []; const plan: any[] = []; const cards: Card[] = [];
    for (const b of table.bad) blocks.push({ type: 'notice', text: `I could not read line ${b.line} ("${b.text}"). Please use one line per role, for example: Designer | 3 | editing | ₹90,000.` });
    for (const r of table.rows) {
      const n: Needs = { budget_max_inr: r.budget, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [r.use] };
      const crit = criteriaFromNeeds(n); const found = await findRows(tools, n, crit.musts);
      if (!found.rows.length) { plan.push({ ...r, pick: null, subtotal: 0, note: 'Nothing in the catalog fits this budget.' }); continue; }
      const ev = new Map<string, Evidence>(); await Promise.all(found.rows.map(async (x) => ev.set(x.variant_id, (await tools.call<any>('evidence_summary', { variant_id: x.variant_id })).total)));
      const best = onePerModel(rank(found.rows, n, crit, ev, settings))[0];
      const card = buildCard(best.row, { musts: crit.musts, requireAll: true, evidence: best.evidence, minN, factLines: [] });
      const ok = await gateCards(tools, requestId, [card], { requireAll: true, maxWords: 25 });
      if (!ok.length) { plan.push({ ...r, pick: null, subtotal: 0, note: 'I could not show this reliably.' }); continue; }
      cards.push(card); plan.push({ ...r, pick: publicCard(card), subtotal: card.price_inr * r.count, note: '' });
    }
    const total = plan.reduce((s, p) => s + p.subtotal, 0); const people = plan.filter((p) => p.pick).reduce((s, p) => s + p.count, 0); const left = plan.filter((p) => !p.pick).reduce((s, p) => s + p.count, 0);
    const over = table.totalBudget != null && total > table.totalBudget ? total - table.totalBudget : 0;
    blocks.push({ type: 'team_plan', rows: plan, total, total_text: fmtInr(total), laptops: people, left_out: left, total_budget: table.totalBudget, over_budget: over,
      note: over ? `The total is ${fmtInr(over)} over your total budget of ${fmtInr(table.totalBudget!)}.` : table.totalBudget != null ? `The total is within your total budget of ${fmtInr(table.totalBudget)}.` : '' });
    return { blocks, cards };
  }
  // one recipient
  const p = PERSONA_DEFAULTS.find((x) => x.re.test(text)); const blocks: Block[] = [];
  const n: Needs = JSON.parse(JSON.stringify(needs));
  if (p && !n.shoulds.some((c) => c.attribute === 'display_size')) { n.shoulds.push(...p.shoulds); blocks.push({ type: 'notice', text: p.note }); }
  if (!n.budget_max_inr) {
    blocks.push({ type: 'choices', question: `What is the budget${p ? ` for your ${p.name === 'parent' ? 'parent' : 'child'}'s laptop` : ''}?`, choices: ['Under ₹40,000', '₹40,000 to ₹70,000', 'Over ₹70,000'].map((l, i) => ({ label: l, send: ['under 40k', 'under 70k', 'under 1 lakh'][i] })) });
    return { blocks, cards: [] };
  }
  const r = await runShortlist(deps, n);
  return { blocks: [...blocks, ...r.blocks], cards: r.cards, matched: r.matched };
}
