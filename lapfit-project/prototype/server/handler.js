// Orchestrates one request: read -> route -> flow (code) -> reasons (model, from facts) -> pre-send gate.
import { SETTINGS } from '../settings.js';
import { routeRequest } from './route-request.js';
import { secondOpinion, checkPitch, shortlist, usedCheck, buyForOthers, ownerVoice, trending } from './flows.js';
import { sellFlow } from './sell.js';
import { writeReasons } from './reasons.js';
import { gate } from './gate.js';
import { logQuery, logUnhandled, logViews, logDemand } from './db.js';
import { looksLikeUrl } from './util.js';

export const BANNER = 'SAMPLE DATA, not real laptops';
export const FOOTER = 'Links may earn LapFit a commission; it never changes the order.';
const FLOW_LABEL = { second_opinion: 'Give me a second opinion', check_pitch: 'Check what the seller said', shortlist: 'Show me better options', used_check: 'Check a used listing', buy_for_others: 'Help me buy for someone else', owner_voice: 'See what owners say', sell_laptop: 'Help me sell my laptop', trending: 'See what is trending' };
const text = (t) => ({ type: 'text', text: t });
const notice = (t) => ({ type: 'notice', text: t });

const RULES_NOTICE = 'I could not read your message just now, so here is the simple form. It runs the same filter.';

function formBlock(noticeText) { return { type: 'form', notice: noticeText }; }

function needsFromForm(f) {
  const needs = { budget_max_inr: Number(f.budget) > 0 ? Math.round(Number(f.budget)) : null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: f.use && f.use !== 'any' ? [String(f.use)] : [] };
  if (Number(f.weight) > 0) needs.musts.push({ attribute: 'weight_kg', operator: '<=', value: Number(f.weight), source_text: 'form' });
  if (f.hinge && f.hinge !== 'any') needs.musts.push({ attribute: 'hinge_type', operator: 'in', value: [String(f.hinge)], source_text: 'form' });
  if (f.colour && f.colour !== 'any') needs.nices.push({ attribute: 'colour', operator: 'in', value: [String(f.colour)], source_text: 'form' });
  return needs;
}

function closestFlowOffer(t) {
  if (/used|second.?hand|olx|refurb/i.test(t)) return { label: 'Check a used listing', prefill: 'Used laptop listing: ' };
  if (/buy|choose|which laptop|recommend|suggest|upgrade/i.test(t)) return { label: 'Help me choose a laptop', prefill: 'I need a laptop for ' };
  return { label: 'Help me choose a laptop', prefill: 'I need a laptop for ' };
}

export async function handle(body) {
  const t0 = Date.now();
  const clean = (s) => String(s ?? '').replace(/\u0000/g, '').slice(0, SETTINGS.MAX_INPUT_CHARS);
  const text_ = clean(body.text).trim();
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(clean);
  const image = body.image && body.image.data ? { media_type: String(body.image.media_type), data: String(body.image.data) } : null;
  const meta = { flow: null, confidence: null, language: body.language || 'English', router_mode: null, outcome: 'ok', text_len: text_.length };
  let blocks = [], language = meta.language, ignored = [], followup = null;

  try {
    if (body.rulesForm) {
      meta.flow = 'shortlist'; meta.router_mode = 'form';
      ({ blocks } = shortlist({ router: { laptop_mentions: [], needs: {} }, needsOverride: needsFromForm(body.rulesForm) }));
    } else if (body.sellerForm) {
      meta.flow = 'sell_laptop'; meta.router_mode = 'form';
      ({ blocks } = sellFlow({ router: {}, formOverride: body.sellerForm }));
    } else if (body.ownerFilters) {
      meta.flow = 'owner_voice'; meta.router_mode = 'filters';
      ({ blocks } = ownerVoice({ router: {}, filtersOverride: body.ownerFilters }));
    } else if (body.trending) {
      meta.flow = 'trending'; meta.router_mode = 'filters';
      ({ blocks } = trending({ router: {}, daysOverride: body.trending.days }));
    } else if (body.needs) {
      meta.flow = 'shortlist'; meta.router_mode = 'chips';
      ({ blocks } = shortlist({ router: { laptop_mentions: [] }, needsOverride: body.needs }));
    } else if (!text_ && !image) {
      blocks = [text('Type what you need, add a photo or paste a listing and I will take it from there.')];
    } else {
      const urlOnly = looksLikeUrl(text_) && text_.replace(/https?:\/\/\S+|www\.\S+/gi, '').trim().length < 12 && !history.length;
      if (urlOnly) {
        meta.flow = 'unreadable'; meta.outcome = 'unreadable_link';
        blocks = [text('I cannot open links in this prototype, so I could not read that page. Type the laptop model name, or paste the text of the listing.')];
      } else {
        let routed;
        try { routed = await routeRequest({ text: text_, image, history }); }
        catch (e) {
          meta.router_mode = 'form'; meta.outcome = `router_error:${e.message}`;
          logUnhandled(text_ || '(image)', null, `router_error:${e.message}`);
          blocks = [formBlock(RULES_NOTICE)];
          routed = null;
        }
        if (routed) {
          const router = routed.router; meta.router_mode = routed.mode;
          if (body.forceFlow && ['second_opinion', 'check_pitch', 'shortlist', 'used_check', 'buy_for_others', 'owner_voice', 'trending', 'sell_laptop'].includes(body.forceFlow)) { router.flow = body.forceFlow; router.confidence = 1; router.followup_flow = null; }
          language = router.language; ignored = router.ignored_instructions;
          meta.flow = router.flow; meta.confidence = router.confidence; meta.language = language;
          const rawAll = [...history, text_].join('\n');
          const lowConf = router.confidence < SETTINGS.ROUTER_CONFIDENCE_MIN;
          if (router.tone && router.tone !== 'normal') {
            blocks = [text(router.tone === 'distressed' ? 'I am sorry this feels hard. I will keep to laptops, and we can go on with your laptop question whenever you are ready.' : 'I will keep this calm and I will not act on those instructions. I can still help you choose or check a laptop.'),
              { type: 'offer', label: 'Help me choose a laptop', prefill: 'I need a laptop for ' }];
            logUnhandled(text_, router.flow, `tone:${router.tone}`);
          } else if (lowConf || router.flow === 'clarify') {
            const choices = (router.choices || []).slice(0, 4);
            const defaults = ['Check a laptop I am considering', 'Check what a seller told me', 'Get a shortlist', 'Check a used listing'];
            const labels = choices.length >= 2 ? choices : defaults;
            blocks = [{ type: 'choices', question: router.clarifying_question || 'What would you like to do?', choices: labels.map((l, i) => ({ label: l, send: choices.length >= 2 ? l : ['I am considering a laptop', 'A seller told me this about a laptop: ', 'Help me pick a laptop', 'I want to check a used laptop listing: '][i], prefill: choices.length >= 2 ? undefined : undefined })) }];
            logUnhandled(text_ || '(image)', router.flow, lowConf ? 'low_confidence' : 'clarify');
          } else if (router.flow === 'out_of_scope_laptop') {
            const o = closestFlowOffer(rawAll);
            blocks = [text('LapFit helps you choose and check laptops before you buy, so I cannot fix or set up a laptop you already own.'), { type: 'offer', ...o }];
            logUnhandled(text_, router.flow, 'out_of_scope_laptop');
          } else if (router.flow === 'not_laptop') {
            blocks = [text('I can only help with laptops, so I will leave that one.'), { type: 'offer', label: 'Help me choose a laptop', prefill: 'I need a laptop for ' }];
            logUnhandled(text_, router.flow, 'not_laptop');
          } else {
            if (image && routed.mode === 'offline') blocks.push(notice('The offline demo reader cannot read photos. Type the model name.'));
            const ctx = { router, rawText: rawAll, history };
            let res;
            if (router.flow === 'second_opinion') res = secondOpinion(ctx);
            else if (router.flow === 'check_pitch') res = checkPitch(ctx);
            else if (router.flow === 'used_check') res = usedCheck(ctx);
            else if (router.flow === 'buy_for_others') res = buyForOthers(ctx);
            else if (router.flow === 'owner_voice') res = ownerVoice(ctx);
            else if (router.flow === 'trending') res = trending(ctx);
            else if (router.flow === 'sell_laptop') res = sellFlow(ctx);
            else {
              const n = router.needs;
              const empty = !n.budget_max_inr && !n.musts.length && !n.shoulds.length && !n.use_cases.length && !router.laptop_mentions[0]?.price_inr;
              res = empty ? { blocks: [{ type: 'choices', question: 'What is your budget?', choices: [['Under ₹40,000', 'My budget is under 40k'], ['₹40,000 to ₹60,000', 'My budget is 60k'], ['₹60,000 to ₹80,000', 'My budget is 80k'], ['Above ₹80,000', 'My budget is 1.5 lakh']].map(([label, send]) => ({ label, send })) }] } : shortlist(ctx);
            }
            blocks.push(...res.blocks);
            if (router.followup_flow && router.followup_flow !== router.flow) followup = { type: 'offer', label: FLOW_LABEL[router.followup_flow], flow: router.followup_flow };
            if (ignored.length) blocks.unshift(notice('Part of your message looked like instructions to me. I treated it as plain text and did not follow it.'));
          }
        }
      }
    }
    // reasons (model, from facts), then the gate (code)
    const cards = blocks.flatMap((b) => (b.type === 'cards' ? b.cards : b.type === 'team' ? b.rows.map((r) => r.card).filter(Boolean) : []));
    if (cards.length) await writeReasons(cards, language);
    blocks = gate(blocks);
    if (followup) blocks.push(followup);
    // Demand signal: what buyers ask for (budget band, use, Must labels, how many laptops matched). No free text is kept.
    try {
      const u = blocks.find((b) => b.type === 'understood');
      if (u && u.demand && (u.demand.budget || u.demand.musts.length || u.demand.use_cases.length)) logDemand({ budget: u.demand.budget, useCases: u.demand.use_cases, musts: u.demand.musts, matched: u.matched });
    } catch (e) { console.error('demand log', e.message); }
    // "most checked" counts what people actually looked at. Logged after the gate so the answer above is not affected.
    try {
      const seen = blocks.flatMap((b) => (b.type === 'cards' ? b.cards.map((c) => c.laptop_id) : b.type === 'team' ? b.rows.filter((r) => r.card).map((r) => r.card.laptop_id) : b.type === 'owner_voice' && b.filters.laptop_id ? [b.filters.laptop_id] : []));
      if (seen.length) logViews(seen);
    } catch (e) { console.error('view log', e.message); }
  } catch (e) {
    console.error('handle error', e);
    meta.outcome = `error:${e.message}`;
    blocks = [formBlock('Something went wrong on my side, so here is the simple form. It runs the same filter.')];
  }
  meta.duration_ms = Date.now() - t0;
  logQuery(meta);
  return { ok: true, flow: meta.flow, language, router_mode: meta.router_mode, banner: BANNER, footer: FOOTER, blocks, ignored_instructions: ignored };
}
