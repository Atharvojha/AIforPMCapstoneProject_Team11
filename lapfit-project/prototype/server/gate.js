// PRE-SEND GATE. Runs after everything is built, before anything is shown. The model never sees or controls it.
import { db, isShowable, logGate } from './db.js';
import { getVariant, evalCriterion, ratingFor, evidenceFor, queryEvidence, computeTrending } from './engine.js';
import { evalSpecClaim } from './flows.js';
import { fmtInr } from './util.js';
import { SETTINGS } from '../settings.js';
import { textMatchesFacts, templateReasons } from './reasons.js';
import { computeSellPlan } from './sell.js';

export const NO_MATCH = 'I could not show a laptop that passed every check, so I am showing none. Try changing a Must or the budget.';

function checkCard(card, block) {
  const fails = [];
  const row = getVariant(card.variant_id);
  if (!row || row.model_id !== card.laptop_id) return [['laptop_id', 'variant or laptop does not exist, or is not verified or sample']];
  for (const c of card._gate?.musts || []) {
    const actual = evalCriterion(c, row);
    if ((block.requireAll || card._gate.requireAll) && actual !== true) fails.push(['must_failed', c.label]);
    const shown = card.musts.find((m) => m.label === c.label);
    if (shown && shown.ok !== actual) fails.push(['tick_mismatch', c.label]);
  }
  if (card.price_inr !== row.price_inr || card.price_text !== fmtInr(row.price_inr)) fails.push(['price_mismatch', `${card.price_inr} vs ${row.price_inr}`]);
  if (!row.price_as_of || card.as_of !== row.price_as_of || !card.as_of_text) fails.push(['price_as_of_missing', card.variant_id]);
  const s = card.specs;
  for (const [k, v] of Object.entries({ weight_kg: row.weight_kg, display_size: row.display_size, ram_gb: row.ram_gb, storage_gb: row.storage_gb, hinge_type: row.hinge_type, year: row.year, processor: row.processor, gpu: row.gpu })) {
    if (s[k] !== v) fails.push(['spec_mismatch', `${k}: ${s[k]} vs ${v}`]);
  }
  const rt = ratingFor(row.model_id);
  if (card.rating.n !== rt.n || card.rating.value !== rt.value) fails.push(['rating_mismatch', `n ${card.rating.n} vs ${rt.n}`]);
  if (!fails.length && !card.reasons.every((r) => textMatchesFacts(r, card))) {
    logGate(card.laptop_id, card.variant_id, 'reasons_replaced', card.reasons.join(' | '));
    card.reasons = templateReasons(card);
    if (!card.reasons.every((r) => textMatchesFacts(r, card))) fails.push(['reasons_text', 'text does not match stored facts']);
  }
  return fails;
}

function gateClaims(block) {
  for (const row of block.rows) {
    if (row.status === 'verdict') {
      const l = db.prepare(`SELECT * FROM claim_ledger c WHERE c.id = ? AND ${isShowable('c')}`).get(row.ledger_id);
      if (!l || !l.approver || !l.verdict || l.verdict !== row.detail || l.sample_size !== row.sample_size) {
        logGate(null, null, 'claim_verdict_missing', row.claim_text);
        Object.assign(row, { status: 'not_checked', label: 'Not checked yet', detail: 'No person has approved a verdict for this claim yet. This is not a verdict either way.' });
        delete row.sample_size; delete row.approver; delete row.ledger_id;
      }
    } else if ((row.status === 'supported' || row.status === 'contradicts') && row._spec) {
      const { ok } = evalSpecClaim(row._spec);
      if (ok !== (row.status === 'supported')) {
        logGate(row._spec.laptop_id, null, 'claim_spec_mismatch', row.claim_text);
        Object.assign(row, { status: 'not_in_catalog', label: 'Not in catalog', detail: 'I could not confirm this against the catalog.' });
      }
    }
    delete row._spec;
  }
}

function gateEvidence(block) {
  const truth = new Map(evidenceFor(block.laptop_id).map((t) => [t.topic, t]));
  block.topics = block.topics.filter((t) => {
    const x = truth.get(t.topic);
    const ok = x && x.n === t.n && x.enough === (t.n >= SETTINGS.MIN_EVIDENCE_N) && x.enough === t.enough;
    if (!ok) logGate(block.laptop_id, null, 'evidence_mismatch', t.topic);
    return ok;
  });
}

function gateOwnerVoice(block) {
  const truth = queryEvidence(block.filters);
  const key = (r) => JSON.stringify([r.laptop_id, r.n, r.enough, r.rating, r.topics, r.excerpts.map((e) => e.id)]);
  const ok = truth.length === block.rows.length && truth.every((r, i) => key(r) === key(block.rows[i])) && block.total_n === truth.reduce((a, r) => a + r.n, 0);
  if (!ok) logGate(null, null, 'owner_voice_mismatch', JSON.stringify(block.filters));
  return ok;
}
function gateTrending(block) {
  const truth = computeTrending(block.days);
  const ok = ['most_checked', 'rising', 'drops'].every((k) => JSON.stringify(truth[k]) === JSON.stringify(block[k]));
  if (!ok) logGate(null, null, 'trending_mismatch', `days=${block.days}`);
  return ok;
}

function gateSellPlan(block) {
  const truth = computeSellPlan(block.input);
  const { type, ...rest } = block;
  const ok = !!truth && JSON.stringify(truth) === JSON.stringify(rest);
  if (!ok) logGate(block.laptop?.id, block.laptop?.variant_id, 'sell_plan_mismatch', 'figures differ from a fresh calculation');
  return ok;
}

export function gate(blocks) {
  const out = [];
  let mainFailed = false;
  for (const block of blocks) {
    if (block.type === 'cards') {
      block.cards = block.cards.filter((card) => {
        const fails = checkCard(card, block);
        fails.forEach(([name, detail]) => logGate(card.laptop_id, card.variant_id, name, detail));
        return !fails.length;
      });
      if (!block.cards.length) { if (block.showMusts) mainFailed = true; else out.push({ type: 'text', text: NO_MATCH }); continue; }
    } else if (block.type === 'team') {
      for (const r of block.rows) {
        if (!r.card) continue;
        const fails = checkCard(r.card, { requireAll: true });
        if (fails.length) { fails.forEach(([n, d]) => logGate(r.card.laptop_id, r.card.variant_id, n, d)); r.card = null; r.subtotal = null; }
      }
      block.missing = block.rows.filter((r) => !r.card).length;
      block.total_cost = block.rows.reduce((a, r) => a + (r.subtotal || 0), 0);
    } else if (block.type === 'claims') gateClaims(block);
    else if (block.type === 'evidence') gateEvidence(block);
    else if (block.type === 'owner_voice') { if (!gateOwnerVoice(block)) { out.push({ type: 'text', text: NO_MATCH }); continue; } }
    else if (block.type === 'sell_plan') { if (!gateSellPlan(block)) { out.push({ type: 'text', text: NO_MATCH }); continue; } }
    else if (block.type === 'trending') { if (!gateTrending(block)) { out.push({ type: 'text', text: NO_MATCH }); continue; } }
    out.push(block);
  }
  if (mainFailed) return [{ type: 'text', text: NO_MATCH }];
  const hadCards = blocks.some((b) => b.type === 'cards' || b.type === 'team');
  const hasCards = out.some((b) => (b.type === 'cards' && b.cards.length) || (b.type === 'team' && b.rows.some((r) => r.card)));
  if (hadCards && !hasCards && !out.some((b) => b.type === 'text' && b.text === NO_MATCH)) out.push({ type: 'text', text: NO_MATCH });
  for (const b of out) {
    if (b.type === 'cards') b.cards.forEach((c) => delete c._gate);
    if (b.type === 'team') b.rows.forEach((r) => r.card && delete r.card._gate);
  }
  return out;
}
