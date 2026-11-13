// PRE-SEND GATE. Runs after everything is built, before anything is returned. The model never sees or controls it.
// It re-reads the stored facts and compares them with what is about to be shown. A result item that fails is dropped and logged.
import type { Tools } from './tools.ts';
import { evalCriterion } from './normalise.ts';
import { textMatchesFacts, templateReasons } from './reasons.ts';
import type { Card } from './cards.ts';
import type { Row } from './types.ts';

export const NO_MATCH = 'I could not show a laptop that passed every check, so I am showing none. Try changing a Must or the budget.';

async function log(tools: Tools, requestId: string, variantId: string | null, check: string, detail: string) {
  try { await tools.call('log_event', { kind: 'gate', request_id: requestId, variant_id: variantId, check_name: check, detail }); } catch { /* logging must not break an answer */ }
}

export async function gateCards(tools: Tools, requestId: string, cards: Card[], o: { requireAll: boolean; maxWords: number }): Promise<Card[]> {
  // every card is checked in parallel, and each card's three lookups run in parallel (each lookup is a database round trip)
  const results = await Promise.all(cards.map((c) => checkCard(tools, requestId, c, o)));
  return cards.filter((_, i) => results[i]);
}

async function checkCard(tools: Tools, requestId: string, c: Card, o: { requireAll: boolean; maxWords: number }): Promise<boolean> {
  {
    const fails: [string, string][] = [];
    const [v, p, ev] = await Promise.all([
      tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: c.variant_id }),
      tools.call<{ found: boolean; price_inr: number; as_of: string }>('get_price', { variant_id: c.variant_id }),
      tools.call<{ total: { n: number } }>('evidence_summary', { variant_id: c.variant_id }),
    ]);
    if (!v.found || v.specs.model_id !== c.model_id) fails.push(['variant_missing', c.variant_id]);
    else {
      const row = v.specs;
      for (const k of ['ram_gb', 'storage_gb', 'display_size', 'weight_kg'] as const) if ((c.specs[k] ?? null) !== ((row as any)[k] ?? null)) fails.push(['spec_mismatch', `${k}: ${c.specs[k]} vs ${(row as any)[k]}`]);
      if (!p.found || p.price_inr !== c.price_inr) fails.push(['price_mismatch', `${c.price_inr} vs ${p.price_inr}`]);
      if (!p.found || !c.as_of || p.as_of !== c.as_of) fails.push(['price_as_of', `${c.as_of} vs ${p?.as_of}`]);
      for (const m of c._gate?.musts ?? []) {
        const actual = evalCriterion(m, row); const shown = c.musts.find((x) => x.label === m.label);
        if (o.requireAll && actual !== true) fails.push(['must_failed', m.label]);
        if (shown && shown.ok !== actual) fails.push(['tick_mismatch', m.label]);
      }
      if (ev.total.n !== c.evidence.n) fails.push(['evidence_n', `${c.evidence.n} vs ${ev.total.n}`]);
    }
    if (!fails.length && !c.reasons.every((r) => textMatchesFacts(r, c, o.maxWords))) {
      await log(tools, requestId, c.variant_id, 'reasons_replaced', c.reasons.join(' | '));
      c.reasons = templateReasons(c);
      if (!c.reasons.every((r) => textMatchesFacts(r, c, o.maxWords))) fails.push(['reasons_text', 'text does not match stored facts']);
    }
    if (fails.length) { for (const [n, d] of fails) await log(tools, requestId, c.variant_id, n, d); return false; }
    return true;
  }
}
