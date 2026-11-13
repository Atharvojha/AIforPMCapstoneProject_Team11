// The five flows. Each returns blocks for the UI. Facts come only from the database via engine.js.
import { db, isShowable } from './db.js';
import { SETTINGS } from '../settings.js';
import {
  normCriterion, criteriaFromNeeds, getVariant, queryVariants, variantsOfModel, allModels, evalCriterion, rank,
  buildCard, runShortlist, relaxOptions, evidenceFor, TOPIC_LABEL, hingeLabel, ratingFor, useScore,
  PERSONAS, PERSONA_LABEL, TOPICS, normFilters, filterLabels, queryEvidence, loosenOptions, computeTrending,
} from './engine.js';
import { fmtInr, fmtDate, fmtStorage, normText, parseInrAmounts } from './util.js';

const text = (t) => ({ type: 'text', text: t });
const notice = (t) => ({ type: 'notice', text: t });

/* ---------- catalog matching ---------- */
export function matchModels(mention) {
  const q = normText(`${mention.brand || ''} ${mention.line || ''}`);
  const models = allModels();
  if (!q) return [];
  const letter = (q.match(/\b(?:laptop )?([a-h])$/) || [])[1];
  let hits = models.filter((m) => normText(m.line) === normText(mention.line || '') || q.includes(normText(m.line)));
  if (!hits.length && letter && /sample/.test(q)) hits = models.filter((m) => m.line.toLowerCase().endsWith(` ${letter}`));
  if (!hits.length && /^sample( laptop)?$/.test(normText(mention.line || ''))) hits = models; // too vague: ask which
  return hits;
}
const variantLabel = (v) => `${v.line}, ${v.ram_gb} GB RAM, ${fmtStorage(v.storage_gb)}, ${fmtInr(v.price_inr)}`;

/** Resolve a mention to exactly one variant, or return a clarify/not-found block set. */
export function resolveVariant(mention) {
  const models = matchModels(mention);
  if (!models.length) return { blocks: [text(`I could not find ${[mention.brand, mention.line].filter(Boolean).join(' ') || 'that laptop'} in the LapFit catalog, so I will not guess its specs or price. The sample catalog only has Sample Laptop A to H.`),
    { type: 'offer', label: 'Show me laptops that fit my needs instead', flow: 'shortlist' }], notFound: true };
  if (models.length > 1) {
    return { blocks: [{ type: 'choices', question: 'Which laptop do you mean?', choices: models.slice(0, 4).map((m) => ({ label: m.line, send: m.line })) }] };
  }
  let vs = variantsOfModel(models[0].id);
  if (mention.ram_gb) vs = vs.filter((v) => v.ram_gb === mention.ram_gb).length ? vs.filter((v) => v.ram_gb === mention.ram_gb) : vs;
  if (mention.storage_gb) vs = vs.filter((v) => v.storage_gb === mention.storage_gb).length ? vs.filter((v) => v.storage_gb === mention.storage_gb) : vs;
  if (vs.length > 1 && mention.price_inr) { const p = vs.filter((v) => v.price_inr === mention.price_inr); if (p.length === 1) vs = p; }
  if (vs.length > 1) {
    return { model: models[0], blocks: [{ type: 'choices', question: `${models[0].line} comes in more than one version. Which one?`,
      choices: vs.slice(0, 4).map((v) => ({ label: `${v.ram_gb} GB RAM, ${fmtStorage(v.storage_gb)}, ${fmtInr(v.price_inr)}`, send: `${v.line} ${v.ram_gb}GB RAM ${v.storage_gb}GB storage` })) }] };
  }
  return { variant: vs[0], model: models[0] };
}

const priceBlock = (variantId) => {
  const rows = db.prepare(`SELECT seller, price_inr, timestamp FROM price_history h WHERE h.variant_id = ? AND ${isShowable('h')} ORDER BY timestamp DESC`).all(variantId);
  if (!rows.length) return null;
  const prices = rows.map((r) => r.price_inr);
  return { type: 'text', text: `Seen between ${fmtInr(Math.min(...prices))} and ${fmtInr(Math.max(...prices))} across ${rows.length} recorded prices, latest on ${fmtDate(rows[0].timestamp)}.` };
};

/* ---------- 1. second_opinion ---------- */
export function secondOpinion({ router }) {
  const mention = router.laptop_mentions[0];
  if (!mention) return { blocks: [{ type: 'choices', question: 'Which laptop are you considering?', choices: [{ label: 'I will type the model name', send: null, prefill: 'I am considering ' }] }] };
  const res = resolveVariant(mention);
  if (!res.variant) return { blocks: res.blocks };
  const crit = criteriaFromNeeds(router.needs);
  const main = buildCard(res.variant, { musts: crit.musts, requireAll: false });
  const blocks = [];
  if (!router.needs.musts.length && !router.needs.budget_max_inr) blocks.push(notice('You did not give any Musts or a budget, so there is nothing to tick. Tell me what you need and I will check it.'));
  blocks.push({ type: 'cards', title: 'The laptop you are considering', cards: [main], showMusts: true });
  const pb = priceBlock(res.variant.variant_id); if (pb) blocks.push(pb);
  const topics = evidenceFor(res.variant.model_id);
  blocks.push({ type: 'evidence', laptop: `${res.variant.brand} ${res.variant.line}`, laptop_id: res.variant.model_id, min_n: SETTINGS.MIN_EVIDENCE_N, topics: topics.map((t) => ({ ...t, label: TOPIC_LABEL[t.topic] || t.topic })) });
  // alternatives: meet every Must, same or lower price
  const altCrit = [...crit.musts, normCriterion({ attribute: 'price_inr', operator: '<=', value: res.variant.price_inr })];
  altCrit[altCrit.length - 1].implicit = true; altCrit[altCrit.length - 1].label = `Price ${fmtInr(res.variant.price_inr)} or less`;
  const seen = new Set([res.variant.model_id]);
  const altRows = rank(queryVariants(altCrit), router.needs, crit).filter((s) => (seen.has(s.row.model_id) ? false : seen.add(s.row.model_id))).slice(0, SETTINGS.MAX_ALTERNATIVES);
  const mustOnly = crit.musts.filter((c) => c.supported && !c.implicit);
  if (altRows.length) {
    blocks.push({ type: 'cards', title: 'Alternatives that meet every Must at the same or a lower price', requireAll: true,
      cards: altRows.map((s) => buildCard(s.row, { musts: altCrit, requireAll: true, factLines: [`Costs ${fmtInr(s.row.price_inr)}, ${fmtInr(res.variant.price_inr - s.row.price_inr)} less than the laptop you are considering.`, ...mustOnly.map((c) => `Meets your must: ${c.label}.`)] })) });
  } else blocks.push(text('No other laptop in the catalog meets every Must at the same or a lower price.'));
  return { blocks };
}

/* ---------- 2. check_pitch ---------- */
function parseSpecClaim(t) {
  const s = t.toLowerCase().replace(/,/g, '');
  let m;
  const op = /(under|below|less than|upto|up to|max|only|at most)/.test(s) ? '<=' : /(at least|minimum|min|over|more than|\+)/.test(s) ? '>=' : '=';
  if ((m = s.match(/(\d{1,3})\s*gb\s*(?:of\s*)?(?:ram|memory)|(?:ram|memory)\s*(?:of\s*)?(\d{1,3})\s*gb/))) return { attribute: 'ram_gb', op, value: Number(m[1] || m[2]), unit: 'GB' };
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(gb|tb)\s*(?:ssd|storage|nvme|hdd|disk)|(?:ssd|storage)\s*(?:of\s*)?(\d+)\s*(gb|tb)/))) {
    const n = Number(m[1] || m[3]); const u = (m[2] || m[4]); return { attribute: 'storage_gb', op, value: u === 'tb' ? n * 1024 : n, unit: 'GB' };
  }
  if ((m = s.match(/(\d(?:\.\d+)?)\s*kg/))) return { attribute: 'weight_kg', op, value: Number(m[1]), unit: 'kg' };
  if ((m = s.match(/(\d{2}(?:\.\d)?)\s*(?:inch|in\b|")/))) return { attribute: 'display_size', op: '=', value: Number(m[1]), unit: 'inch' };
  if ((m = s.match(/(\d)\s*[- ]?\s*years?\s*(?:of\s*)?warranty|warranty\s*(?:of\s*)?(\d)\s*years?/))) return { attribute: 'warranty_years', op: '>=', value: Number(m[1] || m[2]), unit: 'years' };
  if (/360|convertible|2[- ]?in[- ]?1|flip|foldable|tablet mode/.test(s)) return { attribute: 'hinge_type', op: '=', value: 'convertible_360' };
  if (/detachable/.test(s)) return { attribute: 'hinge_type', op: '=', value: 'detachable' };
  return null;
}
export function evalSpecClaim(g) {
  const vs = g.variant_ids.map(getVariant).filter(Boolean);
  const stored = [...new Set(vs.map((v) => (g.attribute === 'hinge_type' ? v.hinge_type : v[g.attribute])))];
  const tol = g.attribute === 'weight_kg' ? SETTINGS.WEIGHT_TOLERANCE_KG : 0;
  const cmp = (x) => (g.op === '<=' ? x <= g.value + tol : g.op === '>=' ? x >= g.value : tol ? Math.abs(x - g.value) <= tol : x === g.value);
  return { ok: stored.some(cmp), stored };
}
const CLAIM_TOPIC = [[/battery|hours|charge|backup/, 'battery'], [/hot|heat|cool|fan|noise|loud/, 'heat_noise'], [/keyboard|typing|keys/, 'keyboard'],
  [/screen|display|bright|colour|color/, 'display'], [/fast|speed|lag|smooth|heavy|slow|software|gaming|performance/, 'performance'], [/hinge|fold|flip|360|sturdy|build/, 'hinge']];

function ledgerLookup(claimText, scopeLine) {
  const t = claimText.toLowerCase();
  const rows = db.prepare(`SELECT * FROM claim_ledger c WHERE ${isShowable('c')}`).all();
  return rows.find((r) => {
    const scopeOk = r.scope === 'general' || (scopeLine && normText(r.scope) === normText(scopeLine));
    return scopeOk && (r.match_terms || '').split(',').some((term) => term.trim() && t.includes(term.trim().toLowerCase()));
  }) || null;
}

export function checkPitch({ router }) {
  const mention = router.laptop_mentions[0];
  let model = null, variant = null; const blocks = [];
  if (mention) {
    const res = resolveVariant(mention);
    if (res.notFound) blocks.push(text('That laptop is not in the catalog. Specs below show "Not in catalog" and I will not guess them.'));
    else if (res.blocks && !res.variant && res.model == null) return { blocks: res.blocks };
    else { model = res.model; variant = res.variant || null; }
  }
  const claims = router.claims;
  if (!claims.length) return { blocks: [text('I could not find separate claims in that text. Paste the exact words the seller or listing used.')] };
  const modelVariants = model ? variantsOfModel(model.id) : [];
  const rows = claims.map((c) => {
    const base = { claim_text: c.claim_text, type: c.type };
    if (c.type === 'opinion') return { ...base, status: 'cant_check', label: 'Can\'t be checked', detail: 'This is an opinion, so there is no fact to compare.' };
    if (c.type === 'spec') {
      const p = parseSpecClaim(c.claim_text);
      if (!p || !model) return { ...base, status: 'not_in_catalog', label: 'Not in catalog', detail: model ? 'I could not match this to a field in the catalog.' : 'The laptop is not in the catalog, so there is nothing to compare with.' };
      const pool = variant ? [variant] : modelVariants;
      const gate = { laptop_id: model.id, variant_ids: pool.map((v) => v.variant_id), attribute: p.attribute, op: p.op, value: p.value };
      const { ok, stored } = evalSpecClaim(gate);
      const fmtVal = (x) => (p.attribute === 'hinge_type' ? hingeLabel(x) : p.attribute === 'storage_gb' ? fmtStorage(x) : p.attribute === 'warranty_years' ? `${x} year${x > 1 ? 's' : ''}` : `${x}${p.unit ? ' ' + p.unit : ''}`);
      const catalogLine = `Catalog lists: ${stored.map(fmtVal).join(', ')}.`;
      if (ok) return { ...base, status: 'supported', label: 'Matches the catalog', detail: catalogLine, _spec: gate };
      return { ...base, status: 'contradicts', label: 'Does not match the specs', detail: `${catalogLine} This does not match what was claimed.`, _spec: gate };
    }
    const entry = ledgerLookup(c.claim_text, model?.line || c.scope);
    if (entry && entry.approver && entry.verdict) {
      return { ...base, status: 'verdict', label: 'Checked by a person', detail: entry.verdict, sample_size: entry.sample_size, approver: entry.approver, date: entry.date, ledger_id: entry.id };
    }
    const topic = (CLAIM_TOPIC.find(([re]) => re.test(c.claim_text.toLowerCase())) || [])[1];
    let evidence = null;
    if (model && topic) { const t = evidenceFor(model.id).find((x) => x.topic === topic); if (t) evidence = { topic: TOPIC_LABEL[topic] || topic, n: t.n, enough: t.enough, sources: t.sources, texts: t.enough ? t.excerpts.map((e) => e.text) : [] }; }
    return { ...base, status: 'not_checked', label: 'Not checked yet', detail: 'No person has approved a verdict for this claim yet. This is not a verdict either way.', evidence, scope_laptop: model?.id ?? null };
  });
  blocks.push({ type: 'claims', laptop: model ? `${model.brand} ${model.line}` : null, rows });
  return { blocks };
}

/* ---------- 3. shortlist ---------- */
export function shortlist({ router, needsOverride = null }) {
  const needs = needsOverride ? { ...needsOverride } : { ...router.needs };
  if (!needs.budget_max_inr && router.laptop_mentions[0]?.price_inr && !needsOverride) needs.budget_max_inr = router.laptop_mentions[0].price_inr;
  const r = runShortlist(needs);
  const blocks = [{ type: 'understood', needs: publicNeeds(needs), matched: r.rows.length, demand: { budget: needs.budget_max_inr ?? null, use_cases: needs.use_cases || [], musts: r.crit.musts.filter((c) => !c.implicit).map((c) => c.label) } }];
  const crit = r.crit;
  if (r.unsupported.length) blocks.push(notice(`I cannot check these yet, so they did not filter the results: ${r.unsupported.map((c) => c.label).join('; ')}.`));
  if (!r.cards.length) {
    const opts = relaxOptions(crit);
    blocks.push(text('Nothing in the catalog meets every Must. I have not dropped any of them.'));
    if (opts.length) {
      blocks.push(text('Closest ways forward:'));
      for (const o of opts) {
        const edited = relaxedNeeds(needs, o);
        blocks.push({ type: 'offer', label: `${o.label}. This adds ${o.adds} laptop${o.adds > 1 ? 's' : ''}.`, needs: edited });
      }
    } else blocks.push(text('Even with any single Must relaxed, nothing fits. You may need to change two things at once.'));
    return { blocks, noMatch: true };
  }
  for (const n of r.colourNotes) blocks.push(notice(n));
  blocks.push({ type: 'cards', title: `${r.cards.length} laptop${r.cards.length > 1 ? 's' : ''} that meet every Must`, cards: r.cards, requireAll: true, compare: true });
  return { blocks };
}
function relaxedNeeds(needs, opt) {
  const n = JSON.parse(JSON.stringify(needs));
  const raw = opt.must.raw;
  if (opt.must.implicit) { if (opt.kind === 'change') { if (opt.must.operator === '<=') n.budget_max_inr = opt.relaxedValue; else n.budget_min_inr = opt.relaxedValue; } return n; }
  const i = n.musts.findIndex((m) => m === raw || (m.attribute === raw.attribute && JSON.stringify(m.value) === JSON.stringify(raw.value)));
  if (i >= 0) { if (opt.kind === 'change') n.musts[i] = { ...n.musts[i], value: opt.relaxedValue }; else n.musts.splice(i, 1); }
  return n;
}
export function publicNeeds(needs) {
  const strip = (list) => (list || []).map((c) => { const n = normCriterion(c); return { attribute: c.attribute, operator: c.operator, value: c.value, source_text: c.source_text || '', label: n.label, supported: n.supported }; });
  return { budget_max_inr: needs.budget_max_inr ?? null, budget_min_inr: needs.budget_min_inr ?? null, musts: strip(needs.musts), shoulds: strip(needs.shoulds), nices: strip(needs.nices), use_cases: needs.use_cases || [] };
}

/* ---------- 4. used_check ---------- */
export function usedCheck({ router, rawText }) {
  const t = rawText.toLowerCase();
  const mention = router.laptop_mentions[0];
  const blocks = [];
  const flags = [];
  let model = null, variant = null;
  if (mention) {
    const models = matchModels(mention);
    if (models.length === 1) model = models[0];
    else if (models.length > 1) return { blocks: [{ type: 'choices', question: 'Which model is the listing for?', choices: models.slice(0, 4).map((m) => ({ label: m.line, send: m.line })) }] };
  }
  const statedPrice = mention?.price_inr ?? parseInrAmounts(rawText)[0]?.value ?? null;
  if (!model) {
    flags.push({ level: 'info', text: 'I could not match the laptop to the catalog, so I cannot compare its specs. Type the exact model name and I will try again.' });
  } else {
    const vs = variantsOfModel(model.id);
    const maxRam = Math.max(...vs.map((v) => v.ram_gb));
    const combos = vs.map((v) => `${v.ram_gb} GB RAM with ${fmtStorage(v.storage_gb)}`).join('; ');
    if (mention.ram_gb && mention.ram_gb > maxRam) flags.push({ level: 'warn', text: `The listing says ${mention.ram_gb} GB RAM. The most this model comes with is ${maxRam} GB, so this combination looks impossible.` });
    else if (mention.ram_gb && mention.storage_gb && !vs.some((v) => v.ram_gb === mention.ram_gb && v.storage_gb === mention.storage_gb)) flags.push({ level: 'warn', text: `${mention.ram_gb} GB RAM with ${fmtStorage(mention.storage_gb)} is not a combination the catalog lists. Catalog lists: ${combos}.` });
    variant = vs.find((v) => v.ram_gb === mention.ram_gb && v.storage_gb === mention.storage_gb) || (vs.length === 1 ? vs[0] : null);
    const wm = t.match(/(\d(?:\.\d+)?)\s*kg/); if (wm && Math.abs(Number(wm[1]) - model.weight_kg) > SETTINGS.WEIGHT_TOLERANCE_KG) flags.push({ level: 'warn', text: `The listing says ${wm[1]} kg. The catalog says ${model.weight_kg} kg.` });
    // OS vs age
    const os = t.match(/windows\s*(7|8|10|11)|macos|chrome\s?os|ubuntu/);
    if (os && os[1] === '11' && model.year < SETTINGS.OS_SUPPORT.windows_11_min_model_year) flags.push({ level: 'warn', text: `Windows 11 on a ${model.year} model is unusual. Check that it is supported on this hardware.` });
    if (os && (os[1] === '7' || os[1] === '8')) flags.push({ level: 'warn', text: `Windows ${os[1]} no longer gets security updates.` });
    if (os && os[1] === '10') flags.push({ level: 'warn', text: `Windows 10 stopped getting regular updates on ${fmtDate(SETTINGS.OS_SUPPORT.windows_10_ended)}. Ask about upgrading to Windows 11, or a newer model.` });
    if (!os) flags.push({ level: 'info', text: 'The listing does not say which operating system is installed.' });
    // price vs usual range
    const base = variant ? variant.price_inr : Math.min(...vs.map((v) => v.price_inr));
    if (statedPrice) {
      const lo = Math.round(base * SETTINGS.USED_PRICE_BAND.low), hi = Math.round(base * SETTINGS.USED_PRICE_BAND.high);
      if (statedPrice > hi) flags.push({ level: 'warn', text: `${fmtInr(statedPrice)} is high for a used one. The usual range here is ${fmtInr(lo)} to ${fmtInr(hi)}, against a new price of ${fmtInr(base)}.` });
      else if (statedPrice < lo) flags.push({ level: 'warn', text: `${fmtInr(statedPrice)} is far below the usual ${fmtInr(lo)} to ${fmtInr(hi)}. Ask why before going further.` });
      else flags.push({ level: 'ok', text: `${fmtInr(statedPrice)} sits inside the usual used range of ${fmtInr(lo)} to ${fmtInr(hi)} (new price ${fmtInr(base)}, as of ${fmtDate(vs[0].price_as_of)}).` });
    } else flags.push({ level: 'info', text: 'The listing does not show a price, so I cannot compare it.' });
  }
  if (!/battery (health|cycle|capacity)|cycle count|\d+\s*%\s*(health|battery)|health\s*:?\s*\d+/.test(t)) flags.push({ level: 'warn', text: 'Battery health is missing. Ask for a screenshot of the battery report.' });
  if (!/serial|s\/n|service tag|imei/.test(t)) flags.push({ level: 'warn', text: 'No serial number is shown. Ask for a clear photo of the serial sticker or the number in system settings.' });
  blocks.push({ type: 'used', laptop: model ? `${model.brand} ${model.line}` : null, listing_price: statedPrice, flags,
    checklist: ['Charge the laptop and run it for 15 minutes. Watch for heat and fan noise.', 'Open the battery report or battery health screen yourself.', 'Match the serial number on the sticker, in settings and on the box or bill.',
      'Open and close the lid several times. Check the hinge is firm and does not wobble.', 'Type on every key. Test the trackpad, ports, camera and speakers.', 'Look for dead pixels or lines on a white and a black screen.', 'Ask for the original bill and any warranty left.', 'Check that the laptop is not locked to another account or organisation.'],
    cannot_judge: ['Real battery health', 'Whether the serial number is genuine', 'Past repairs or replaced parts', 'Internal damage or a loose hinge', 'How it performs under load'] });
  blocks.push(text('This is a list of things to check, not a verdict. I cannot tell you to buy or not to buy.'));
  return { blocks };
}

/* ---------- 5. buy_for_others ---------- */
const ROLE_USE = [[/design|creative|video|editor|photograph/, 'editing'], [/develop|engineer|software|programmer|data|it\b|tech/, 'coding'], [/field|travel|sales|executive|manager|founder/, 'travel'],
  [/account|admin|hr|support|clerk|reception|operations|office|finance/, 'office'], [/student|intern|trainee/, 'study']];
export function parseTeamTable(raw) {
  const rows = [];
  for (const line of raw.split(/\n/)) {
    const cells = line.split(/\||\t|,(?=\s*\S)/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2 || /^-+$/.test(cells[0]) || /^role$/i.test(cells[0])) continue;
    const role = cells.find((c) => /[a-z]/i.test(c) && !/^\d/.test(c) && !/^(₹|rs)/i.test(c));
    if (!role) continue;
    const count = cells.map((c) => c.match(/^(\d{1,3})(?:\s*(?:people|persons|laptops|nos|x))?$/i)).find(Boolean);
    const money = parseInrAmounts(cells.filter((c) => c !== role).join(' | '));
    const use = ROLE_USE.find(([re]) => re.test(line.toLowerCase()))?.[1] || 'office';
    rows.push({ role, count: count ? Number(count[1]) : 1, budget_each: money[0]?.value ?? null, use });
  }
  return rows;
}

export function buyForOthers({ router, rawText, history }) {
  const recipient = router.recipient;
  const asked = history.length; // earlier user messages = questions already answered
  const blocks = [];
  const needs = { ...router.needs, shoulds: [...router.needs.shoulds], nices: [...router.needs.nices] };
  if (recipient === 'team') {
    const roles = parseTeamTable(rawText);
    if (!roles.length) return { blocks: [text('Paste a table with one line per role, for example: Designer | 3 | editing | ₹90,000. Include the number of people and what each role does.')] };
    const total = needs.budget_max_inr ?? null;
    const heads = roles.reduce((a, r) => a + r.count, 0);
    const explicit = roles.reduce((a, r) => a + (r.budget_each ? r.budget_each * r.count : 0), 0);
    const fallbackCap = total ? Math.floor((total - explicit) / Math.max(1, roles.filter((r) => !r.budget_each).reduce((a, r) => a + r.count, 0))) : null;
    const out = [];
    for (const r of roles) {
      const cap = r.budget_each ?? fallbackCap;
      const n = { budget_max_inr: cap, musts: [], shoulds: [], nices: [], use_cases: [r.use] };
      const sl = runShortlist(n, { limit: 1 });
      const card = sl.cards[0] || null;
      out.push({ role: r.role, count: r.count, use: r.use, cap, card, subtotal: card ? card.price_inr * r.count : null });
    }
    const costed = out.filter((o) => o.card);
    const sum = costed.reduce((a, o) => a + o.subtotal, 0);
    blocks.push({ type: 'team', rows: out, total_cost: sum, total_budget: total, people: heads, missing: out.length - costed.length });
    if (total && sum > total) blocks.push(notice(`The total is ${fmtInr(sum - total)} over your budget. Lower specs for one role, or raise the budget.`));
    return { blocks };
  }
  // parent or child: ask at most two questions
  if (!recipient || !['parent', 'child'].includes(recipient)) {
    if (asked < SETTINGS.MAX_BUY_FOR_OTHERS_QUESTIONS) return { blocks: [{ type: 'choices', question: 'Who will use the laptop?', choices: [{ label: 'A parent', send: 'It is for my parent' }, { label: 'A child', send: 'It is for my child' }, { label: 'A team', send: 'It is for my team' }] }] };
  } else if (!needs.use_cases.length && asked < SETTINGS.MAX_BUY_FOR_OTHERS_QUESTIONS) {
    const choices = recipient === 'parent'
      ? ['Video calls and family photos', 'Reading and browsing', 'Office or banking work', 'Something else'] : ['School and online classes', 'Coding and projects', 'Drawing and notes', 'Gaming'];
    return { blocks: [{ type: 'choices', question: `What will your ${recipient} mainly use it for?`, choices: choices.map((c) => ({ label: c, send: c })) }] };
  }
  if (recipient === 'parent') { needs.shoulds.push({ attribute: 'display_size', operator: '>=', value: 14, source_text: 'easy to read' }, { attribute: 'weight_kg', operator: '<=', value: 1.5, source_text: 'easy to carry' }); }
  if (recipient === 'child') { needs.shoulds.push({ attribute: 'warranty_years', operator: '>=', value: 2, source_text: 'long warranty' }); needs.nices.push({ attribute: 'hinge_type', operator: 'in', value: ['convertible_360'], source_text: 'tough hinge' }); }
  if (!needs.use_cases.length) needs.use_cases = ['office'];
  const res = shortlist({ router, needsOverride: needs });
  return res;
}

/* ---------- 6. owner_voice: what owners say, filtered by who, how long, when and about what ---------- */
export function filterOptions() {
  return {
    personas: PERSONAS.map((p) => ({ value: p, label: PERSONA_LABEL[p] })),
    topics: TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] || t })),
    months: SETTINGS.MONTHS_CHOICES, windows: SETTINGS.WINDOW_CHOICES,
    laptops: allModels().map((m) => ({ value: m.id, label: m.line })),
  };
}
export function ownerVoice({ router, filtersOverride = null }) {
  const blocks = [];
  let raw = filtersOverride;
  if (!raw) {
    const o = router.owner_filters || {};
    raw = { persona: o.persona, topic: o.topic, min_months: o.min_months, days: o.days, laptop_id: null };
    const mention = router.laptop_mentions?.[0] || (o.laptop ? { line: o.laptop } : null);
    if (mention) {
      const ms = matchModels(mention);
      if (ms.length === 1) raw.laptop_id = ms[0].id;
      else if (!ms.length) blocks.push(notice(`I could not find ${[mention.brand, mention.line].filter(Boolean).join(' ')} in the catalog, so the reports below are not limited to it.`));
    }
  }
  const { filters, unknown } = normFilters(raw);
  if (unknown.length) blocks.push(notice(`I cannot filter by ${unknown.join(' or ')} yet, so I left it out.`));
  const rows = queryEvidence(filters);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const block = { type: 'owner_voice', filters, labels: filterLabels(filters), rows, total_n: total, min_n: SETTINGS.MIN_EVIDENCE_N, options: filterOptions() };
  blocks.push(block);
  if (!rows.length) {
    blocks.push(text('No owner reports match all of these filters. I have not changed any of them.'));
    for (const o of loosenOptions(filters)) blocks.push({ type: 'offer', label: `Remove "${{ persona: 'reviewer type', topic: 'topic', min_months: 'months owned', days: 'time window', laptop_id: 'laptop' }[o.key]}". This shows ${o.n} reports.`, ownerFilters: o.filters });
  }
  return { blocks };
}

/* ---------- 7. trending: counted in code ---------- */
export function trending({ router, daysOverride = null }) {
  const days = Number(daysOverride) > 0 ? Math.min(365, Math.round(Number(daysOverride))) : Math.min(365, Math.round(router?.owner_filters?.days || SETTINGS.TREND_WINDOW_DAYS));
  const data = computeTrending(days);
  return { blocks: [{ type: 'trending', ...data, windows: SETTINGS.WINDOW_CHOICES, min_reports: SETTINGS.TREND_MIN_REPORTS, min_drop_pct: SETTINGS.TREND_MIN_DROP_PCT }] };
}
