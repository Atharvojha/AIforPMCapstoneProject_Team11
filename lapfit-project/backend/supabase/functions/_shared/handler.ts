// The orchestrator: one request in, one reply out, for every kind of input.
// Order: clean the input, read it (model, else fallback), route to a flow, wording, gate, log. A failure becomes a calm reply, never an error.
import { routeWithModel, offlineRoute, backfillNeeds, reconcileFlow, type RouterResult, type Flow } from './router.ts';
import { normAttr } from './normalise.ts';
import { applySoftTerms } from './soft.ts';
import { runShortlist } from './flows/shortlist.ts';
import { secondOpinionAndPitch } from './flows/pitch.ts';
import { usedCheck } from './flows/used.ts';
import { compare } from './flows/compare.ts';
import { ownerVoice } from './flows/owner.ts';
import { buyForOthers } from './flows/team.ts';
import { marketPulse, brandInsights } from './flows/market.ts';
import { sellPlan } from './flows/sell.ts';
import { myLaptops, type Owned } from './flows/mylaptops.ts';
import { submitExperience, type ExperienceInput } from './flows/experience.ts';
import { liveFor } from './flows/livecards.ts';
import { writeReasons } from './reasons.ts';
import { DEGRADED_NOTICE } from './guard.ts';
import { gateCards, NO_MATCH } from './gate.ts';
import { scrub, looksLikeUrl } from './util.ts';
import type { Deps, Reply, Block, Needs, RawCriterion } from './types.ts';
import { publicCard, type Card } from './cards.ts';

export interface QueryInput {
  text?: string; history?: string[]; needs?: Needs; prior_needs?: Needs; flow?: string;
  image?: unknown; live?: boolean; session_hash?: string; context?: { max_price?: number };
  owned?: Owned[]; experience?: ExperienceInput; receipt?: string; action?: 'report_status' | 'report_delete' | 'submit_experience' | 'live_reviews'; variant_id?: string; topic?: string;
}
const FOOTER = 'LapFit shows recorded facts with their dates. It is a second opinion, not a purchase recommendation or a guarantee.';
const MAX_TEXT = 4000;
const HELP_CHOICES = [{ label: 'Get a shortlist for my budget', send: 'Suggest a laptop under 60k' }, { label: 'Check a laptop I am considering', send: 'Should I buy the Macbook Air M1?' }, { label: 'Check what a seller told me', send: 'The seller said: ' }, { label: 'Compare two laptops', send: 'Compare ' }, { label: 'Check a used listing', send: 'Used laptop: ' }, { label: 'What owners say', send: 'What do owners say about ' }];

const key = (c: RawCriterion) => `${normAttr(c.attribute) ?? String(c.attribute).toLowerCase()}`;
export function mergeNeeds(prior: Needs, cur: Needs): Needs {
  const merge = (a: RawCriterion[], b: RawCriterion[]) => { const m = new Map(a.map((c) => [key(c), c])); for (const c of b) m.set(key(c), c); return [...m.values()]; };
  return { budget_max_inr: cur.budget_max_inr ?? prior.budget_max_inr, budget_min_inr: cur.budget_min_inr ?? prior.budget_min_inr,
    musts: merge(prior.musts, cur.musts), shoulds: merge(prior.shoulds.filter((c) => !cur.musts.some((m) => key(m) === key(c))), cur.shoulds), nices: merge(prior.nices, cur.nices),
    use_cases: [...new Set([...prior.use_cases, ...cur.use_cases])] };
}
const MODS: { re: RegExp; apply(n: Needs, base: number | null, notes: string[]): void }[] = [
  { re: /\b(cheaper|lower (?:the )?budget|less expensive|sasta|reduce (?:the )?price)\b/i, apply(n, base, notes) { const b = n.budget_max_inr ?? base; if (b) { n.budget_max_inr = Math.floor((b * 0.85) / 1000) * 1000; notes.push(`"Cheaper" read as a budget of ₹${n.budget_max_inr.toLocaleString('en-IN')} (15% lower). Change it if you like.`); } else notes.push('Tell me a budget and I will go cheaper than that.'); } },
  { re: /\b(lighter|more portable|less weight)\b/i, apply(n, _b, notes) { n.shoulds = n.shoulds.filter((c) => normAttr(c.attribute) !== 'weight_kg'); n.shoulds.push({ attribute: 'weight_kg', operator: '<=', value: 1.3, source_text: 'lighter' }); notes.push('"Lighter" read as weight up to 1.3 kg (a Should).'); } },
  { re: /\b(more ram|more memory|bigger ram)\b/i, apply(n, _b, notes) { n.shoulds = n.shoulds.filter((c) => normAttr(c.attribute) !== 'ram_gb'); n.shoulds.push({ attribute: 'ram_gb', operator: '>=', value: 16, source_text: 'more RAM' }); notes.push('"More RAM" read as 16 GB or more (a Should).'); } },
  { re: /\b(bigger screen|larger screen|bigger display)\b/i, apply(n, _b, notes) { n.shoulds = n.shoulds.filter((c) => normAttr(c.attribute) !== 'display_size'); n.shoulds.push({ attribute: 'display_size', operator: '>=', value: 15, source_text: 'bigger screen' }); notes.push('"Bigger screen" read as 15 inch or more (a Should).'); } },
  { re: /\b(more storage|bigger ssd|more space)\b/i, apply(n, _b, notes) { n.shoulds = n.shoulds.filter((c) => normAttr(c.attribute) !== 'storage_gb'); n.shoulds.push({ attribute: 'storage_gb', operator: '>=', value: 512, source_text: 'more storage' }); notes.push('"More storage" read as 512 GB or more (a Should).'); } },
];

/** Remove what we must not keep or act on, and say so. */
export function cleanText(raw: string): { text: string; notices: string[] } {
  const notices: string[] = []; let t = String(raw ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  if (t.length > MAX_TEXT) { t = t.slice(0, MAX_TEXT); notices.push('Your message was very long, so I read only the first part.'); }
  const before = t;
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ').replace(/(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/g, ' ').replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, ' ');
  if (t !== before) notices.push('I removed phone numbers, emails or ID numbers from your message. I do not need them and I do not keep them.');
  if (looksLikeUrl(t)) { t = t.replace(/https?:\/\/\S+|www\.\S+/gi, ' '); notices.push('I cannot open links. Paste the text from the page instead and I will read that.'); }
  if (/\$\s?\d|\busd\b|dollars?|£|€|\bgbp\b|\beuros?\b/i.test(t)) notices.push('I work in rupees (₹) and do not convert currencies. Please give your budget in rupees.');
  if (/\b(usa|america|united states|uk|london|dubai|uae|canada|australia|singapore|europe)\b/i.test(t) && !/india/i.test(t)) notices.push('The catalog and prices are for India only, in rupees.');
  return { text: t.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), notices };
}

export async function handleQuery(deps: Deps, input: QueryInput): Promise<Reply> {
  const { tools, settings, requestId } = deps; const t0 = Date.now();
  const dataMode = settings.data_mode ?? 'course';
  const reply: Reply = { ok: true, request_id: requestId, flow: null, language: 'English', router_mode: null, notice: dataMode === 'production' ? '' : 'Course project: sample data, not for real purchases.', footer: FOOTER, data_mode: dataMode, blocks: [], ignored_instructions: [], settings_version: settings._version ?? 0, data_version: null };
  const tm: Record<string, number> = {}; const lap = (k: string, since: number) => { tm[k] = Date.now() - since; };
  let textLen = 0; let outcome = 'ok'; let extra: Record<string, unknown> = {};
  const finish = async () => {
    tm.total_ms = Date.now() - t0; reply.timings = tm;
    if (!reply.blocks.length) reply.blocks.push({ type: 'text', text: 'I did not get anything I could use. Tell me what you need, for example: "laptop for coding under 60k".' });
    try { await tools.call('log_event', { kind: 'query', request_id: requestId, flow: reply.flow, outcome, language: reply.language, router_mode: reply.router_mode, duration_ms: Date.now() - t0, text_len: textLen, ...extra }); } catch { /* logging never breaks an answer */ }
    return reply;
  };
  try { await run(); } catch (e) {
    outcome = 'error'; reply.blocks = [{ type: 'text', text: 'Something went wrong on my side, and I would rather say so than guess. Please try again, or use the form.' }];
    try { console.error(requestId, (e as Error)?.message); } catch { /* ignore */ }
  }
  return finish();

  async function run() {
    if (deps.degraded) reply.blocks.push({ type: 'notice', text: DEGRADED_NOTICE[deps.degraded] ?? DEGRADED_NOTICE.limiter_unavailable });
    const flags = settings.FEATURE_FLAGS ?? {}; const session = input.experience?.session_hash ?? input.session_hash ?? 'anon';
    // ---- structured requests (no text reading needed) ----
    if (input.action === 'submit_experience' || input.experience) { reply.flow = 'submit_experience'; reply.blocks.push(...(await submitExperience(deps, { ...(input.experience ?? {}), session_hash: session })).blocks); return; }
    if (input.action === 'report_status') { reply.flow = 'submit_experience'; const r = await tools.call<any>('report_status', { receipt: input.receipt ?? '' }); reply.blocks.push({ type: 'text', text: r.found ? `Your report is ${r.status}${r.reject_reason ? ` (${r.reject_reason})` : ''}.` : 'I could not find a report with that code.' }); return; }
    if (input.action === 'report_delete') { reply.flow = 'submit_experience'; const r = await tools.call<any>('report_delete', { receipt: input.receipt ?? '' }); reply.blocks.push({ type: 'text', text: r.deleted ? 'Your report has been deleted.' : 'I could not find a report with that code.' }); return; }
    if (input.action === 'live_reviews' && input.variant_id) {
      reply.flow = 'live_reviews'; const v = await tools.call<any>('get_variant', { variant_id: input.variant_id });
      if (!v.found) reply.blocks.push({ type: 'text', text: 'That laptop is not in the catalog.' }); else reply.blocks.push(...(await liveFor(deps, [v.specs], input.topic)));
      return;
    }
    if (input.owned) { reply.flow = 'my_laptops'; reply.blocks.push(...(await myLaptops(deps, input.owned, (deps.now?.() ?? new Date()).toISOString().slice(0, 10))).blocks); return; }

    // ---- clean the text ----
    const cleaned = cleanText(input.text ?? ''); const text = cleaned.text; textLen = text.length;
    for (const n of cleaned.notices) reply.blocks.push({ type: 'notice', text: n });
    if (input.image) reply.blocks.push({ type: 'notice', text: 'Reading photos is not switched on in this version. Please type the details (laptop name, price, battery health, what the seller said).' });
    if (flags.router_enabled === false && !input.needs) { reply.blocks.push({ type: 'text', text: 'Typed requests are paused. Use the form.' }); outcome = 'paused'; return; }
    if (!text && !input.needs) { reply.blocks.push({ type: 'choices', question: 'Tell me what you need, or pick one:', choices: HELP_CHOICES.slice(0, 4) }); outcome = 'empty'; return; }

    // ---- read it ----
    let router: RouterResult; const tRouter = Date.now();
    if (input.needs && !text) { router = { flow: 'shortlist', confidence: 1, language: 'English', needs: input.needs, laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null }; reply.router_mode = 'form'; }
    else if (deps.model) {
      try { router = await routeWithModel(deps.model, { text, history: input.history }, settings.ROUTER_TIMEOUT_MS ?? 8000); reply.router_mode = 'model'; { const rc = reconcileFlow(text, router); router = rc.router; if (rc.changed) extra = { ...extra, flow_corrected: rc.changed }; } if (['shortlist', 'buy_for_others', 'second_opinion'].includes(router.flow)) { const b = backfillNeeds(text, router.needs); if (b.added.length) { router.needs = b.needs; reply.blocks.push({ type: 'notice', text: `The reader missed something you wrote, so I added it from your words: ${b.added.join('; ')}.` }); } } }
      catch (e) { extra = { ...extra, router_error: String((e as Error)?.message ?? e).slice(0, 120) }; reply.router_error = String((e as Error)?.message ?? e).slice(0, 120); router = offlineRoute(text); reply.router_mode = 'fallback'; reply.notice = [reply.notice, 'The reader is unavailable, so I used a simpler reading. Check the needs below.'].filter(Boolean).join(' '); }
    } else { router = offlineRoute(text); reply.router_mode = 'offline'; }
    lap('router_ms', tRouter); reply.language = router.language; reply.ignored_instructions = router.ignored_instructions;
    if (router.ignored_instructions.length) reply.blocks.push({ type: 'notice', text: 'Some text in your message looked like an instruction to me. I treated it as data and ignored it.' });
    if (router.tone === 'abusive') { reply.flow = 'clarify'; reply.blocks.push({ type: 'text', text: 'I can help with laptops. Tell me what you need and I will check it.' }); outcome = 'abusive'; return; }
    if (router.tone === 'distressed') { reply.flow = 'clarify'; reply.blocks.push({ type: 'text', text: 'That sounds stressful. Take your time. When you are ready, tell me your budget and what the laptop is for, and I will go step by step.' }); outcome = 'distressed'; return; }
    const flow = (input.flow ?? router.flow) as Flow; reply.flow = flow;
    if (router.confidence < (settings.ROUTER_CONFIDENCE_MIN ?? 0.6) && !input.flow) {
      reply.flow = 'clarify';
      reply.blocks.push({ type: 'choices', question: router.clarifying_question ?? 'What would you like to do?', choices: (router.choices.length ? router.choices : HELP_CHOICES.slice(0, 3).map((c) => c.label)).slice(0, 4).map((c) => ({ label: c, send: c })) });
      outcome = 'clarify'; return;
    }

    // ---- needs: follow-up merge, modifiers, soft words ----
    let needs: Needs = router.needs; const notes: string[] = [];
    if (input.prior_needs && ['shortlist', 'buy_for_others', 'second_opinion'].includes(flow)) {
      needs = mergeNeeds(input.prior_needs, needs);
      for (const m of MODS) if (m.re.test(text)) m.apply(needs, input.context?.max_price ?? null, notes);
    }
    const soft = applySoftTerms(text, needs, { lightKg: settings.LIGHT_KG ?? 1.5 }); needs = soft.needs;
    for (const n of [...notes, ...soft.notices]) reply.blocks.push({ type: 'notice', text: n });
    const cards: Card[] = [];
    const logUnhandled = async (kind: string) => { try { await tools.call('log_event', { kind: 'unhandled', reason: kind, text: scrub(text) }); } catch { /* ignore */ } };
    const wantLive = input.live === true || soft.lenses.includes('looks'); const tFlow = Date.now();

    switch (flow) {
      case 'shortlist': {
        const r = await runShortlist(deps, needs, { lenses: soft.lenses, wantLive }); reply.blocks.push(...r.blocks); cards.push(...r.cards); extra = { matched: r.matched };
        try { await tools.call('log_event', { kind: 'demand', budget_band: r.demand.budget ? (r.demand.budget < 40000 ? 'Under ₹40,000' : r.demand.budget < 70000 ? '₹40,000–70,000' : 'Over ₹70,000') : 'None', use_cases: r.demand.use_cases, musts: r.demand.musts, matched: r.matched }); } catch { /* ignore */ }
        if (!r.matched) outcome = 'no_match'; break;
      }
      case 'buy_for_others': { const r = await buyForOthers(deps, text, needs); reply.blocks.push(...r.blocks); cards.push(...r.cards); break; }
      case 'second_opinion': case 'check_pitch': {
        const r = await secondOpinionAndPitch(deps, router, needs); reply.blocks.push(...r.blocks); cards.push(...r.cards);
        if (router.followup_flow === 'shortlist') { const s = await runShortlist(deps, needs, { lenses: soft.lenses }); reply.blocks.push(...s.blocks); cards.push(...s.cards); }
        break;
      }
      case 'used_check': { const r = await usedCheck(deps, router.listing, router.laptop_mentions[0]); reply.blocks.push(...r.blocks); break; }
      case 'compare': reply.blocks.push(...(await compare(deps, router.laptop_mentions, wantLive)).blocks); break;
      case 'owner_voice': reply.blocks.push(...(await ownerVoice(deps, router.laptop_mentions[0], text)).blocks); break;
      case 'trending': reply.blocks.push(...(await marketPulse(deps)).blocks); break;
      case 'brand_insights': reply.blocks.push(...(await brandInsights(deps, router.laptop_mentions[0]?.brand ?? null)).blocks); break;
      case 'sell_laptop': reply.blocks.push(...(await sellPlan(deps, router.laptop_mentions[0], router.listing, text)).blocks); break;
      case 'my_laptops': {
        const m = text.match(/(?:bought|purchased)\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})/i);
        if (m) reply.blocks.push(...(await myLaptops(deps, [{ name: m[1], purchase_date: m[2] }], (deps.now?.() ?? new Date()).toISOString().slice(0, 10))).blocks);
        else reply.blocks.push({ type: 'text', text: 'Tell me the laptop and the purchase date, for example: "bought Macbook Air M1 on 2024-03-15". Your list is not stored on the server.' });
        break;
      }
      case 'submit_experience': reply.blocks.push({ type: 'form_request', form: 'experience', text: 'Thank you for wanting to help other buyers. Use the experience form: laptop, how long you have owned it, a short note (no links, emails or phone numbers), and the 18+ confirmation. A person reviews every report before it is shown.' }); break;
      case 'help': reply.blocks.push({ type: 'text', text: 'I am LapFit, a second opinion for laptop buyers in India. I use recorded facts with dates, owner opinions with counts, and live web reviews labelled as such. I do not say "buy this".' }, { type: 'choices', question: 'What would you like to do?', choices: HELP_CHOICES }); break;
      case 'out_of_scope_laptop': reply.blocks.push({ type: 'text', text: 'I help people choose a laptop to buy, so I cannot fix or support one you already own.' }); await logUnhandled(flow); outcome = 'out_of_scope'; break;
      case 'clarify': reply.blocks.push({ type: 'choices', question: router.clarifying_question ?? 'What would you like to do?', choices: HELP_CHOICES.slice(0, 4) }); break;
      default: reply.blocks.push({ type: 'text', text: 'I only help with choosing and checking laptops. Ask me about one.' }); await logUnhandled('not_laptop'); outcome = 'not_laptop';
    }

    lap('flow_ms', tFlow);
    // ---- wording, then the gate (the gate always has the last word) ----
    if (cards.length) {
      const tWrite = Date.now();
      await writeReasons(deps.model && flags.reasons_enabled !== false ? deps.model : null, cards, router.language, { maxWords: settings.REASON_MAX_WORDS ?? 25, timeoutMs: settings.WRITER_TIMEOUT_MS ?? 2000 });
      lap('reasons_ms', tWrite); const tGate = Date.now();
      for (const b of reply.blocks) {
        if (b.type !== 'cards') continue;
        const ok = await gateCards(tools, requestId, b.cards as Card[], { requireAll: b.requireAll === true, maxWords: settings.REASON_MAX_WORDS ?? 25 });
        const dropped = (b.cards as Card[]).length - ok.length; b.cards = ok.map(publicCard);
        if (dropped && !ok.length) { b.type = 'text'; b.text = NO_MATCH; outcome = 'gate_dropped'; }
      }
      lap('gate_ms', tGate);
    }
    reply.blocks = reply.blocks.filter((b) => !(b.type === 'cards' && !(b.cards as unknown[]).length));
    reply.blocks = reply.blocks.map((b) => (b.type === 'cards' ? { ...b, cards: (b.cards as any[]).map((c) => (c._gate ? publicCard(c) : c)) } : b));
  }
}
