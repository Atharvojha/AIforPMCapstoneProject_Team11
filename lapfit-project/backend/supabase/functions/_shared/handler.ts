// The orchestrator: one request in, one reply out, for every kind of input.
// Order: clean the input, read it (model, else fallback), route to a flow, wording, gate, log. A failure becomes a calm reply, never an error.
import { routeWithModel, offlineRoute, backfillNeeds, reconcileFlow, isDistress, isAbusive, type RouterResult, type Flow } from './router.ts';
import { mergeNeeds, MODS, refineNeeds, refineNotice } from './refine.ts';
import { applySoftTerms } from './soft.ts';
import { runShortlist } from './flows/shortlist.ts';
import { secondOpinionAndPitch } from './flows/pitch.ts';
import { usedCheck } from './flows/used.ts';
import { compare } from './flows/compare.ts';
import { ownerVoice } from './flows/owner.ts';
import { buyForOthers } from './flows/team.ts';
import { marketPulse, brandInsights } from './flows/market.ts';
import { sellPlan, sellInputOf, type SellInput } from './flows/sell.ts';
import { launchYearOf } from './launch.ts';
import { myLaptops, type Owned } from './flows/mylaptops.ts';
import { submitExperience, type ExperienceInput } from './flows/experience.ts';
import { liveFor } from './flows/livecards.ts';
import { writeReasons } from './reasons.ts';
import { DEGRADED_NOTICE } from './guard.ts';
import { buildProvenance } from './provenance.ts';
import { readImage, validateImage } from './flows/image.ts';
import { whereToBuy, logClick } from './flows/buy.ts';
import { resolveVariant, claimsForMention } from './flows/pitch.ts';
import { askBlock, laptopChoices, cleanListing, cleanClaims, cleanMentions } from './flows/ask.ts';
import { webLaptop, cleanLaptopName } from './flows/weblaptop.ts';
import { webRecoSafe, autoQuery, searchQuery, hasRecoNeed } from './flows/webreco.ts';
import { fmtDate } from './util.ts';
import { checkedContext, followUpIntent, pickRef, refersToCurrent } from './followup.ts';
import { laptopQuestion, needsLinesOf } from './flows/question.ts';
import { gateCards, NO_MATCH } from './gate.ts';
import { scrub, looksLikeUrl } from './util.ts';
import type { Deps, Reply, Block, Needs, RawCriterion, Settings } from './types.ts';
import { publicCard, type Card } from './cards.ts';

export interface QueryInput {
  text?: string; history?: string[]; needs?: Needs; prior_needs?: Needs; flow?: string;
  image?: unknown; live?: boolean; session_hash?: string; context?: { max_price?: number };
  owned?: Owned[]; experience?: ExperienceInput; receipt?: string; client?: { what: string; screen?: string; message?: string; status?: number; action?: string };
  intent?: string; retailer?: string; from?: string; sort?: string;
  focus?: { variant_id: string; name?: string } | null; shown?: { variant_id: string; name?: string }[];
  action?: 'where_to_buy' | 'outbound_click' | 'read_image' | 'data_status' | 'client_log' | 'report_status' | 'report_delete' | 'submit_experience' | 'live_reviews' | 'compare' | 'owner_voice' | 'second_opinion' | 'check_pitch' | 'sell_plan' | 'used_check' | 'catalog' | 'web_search_laptops'; variant_id?: string; variant_ids?: string[]; topic?: string;
  query?: string; recommended?: string[]; picked?: string[]; laptop_text?: string; custom?: unknown; claims?: unknown; rest?: unknown;
  sell?: SellInput; listing?: import('./router.ts').Listing;
}
interface Failure { stage: string; kind: string; message: string }
const CLIENT_KINDS = ['network', 'timeout', 'server', 'auth', 'bad_request', 'too_large', 'ui_crash'];
const inputKind = (i: QueryInput) => (i.action ? `action:${i.action}` : i.owned ? 'owned' : i.experience ? 'experience' : i.needs && !i.text ? 'needs' : 'text');
/** The one honest line about the data. Says what is saved, what is live, and what no person has checked. */
export function dataNotice(settings: Settings): string {
  const ds = settings.DATA_STATUS ?? {}; const when = ds.prices_as_of ? ` from ${fmtDate(ds.prices_as_of)}` : '';
  const verified = Number(ds.verified_variants ?? 0) > 0 ? 'Some specs are checked by a person.' : 'Specs are imported listing data that no person has checked yet.';
  return `Prices are a saved snapshot${when}, not live. ${verified} Web reviews are fetched live when you ask.`;
}
/** The kill switch for web pictures: remove every picture from the reply. */
export function stripImages(blocks: Block[]) { for (const b of blocks) { if (b.type === 'cards') for (const c of b.cards ?? []) c.image = null; if (b.type === 'compare') for (const l of b.laptops ?? []) l.image = null; } }
const FOOTER = 'LapFit shows recorded facts with their dates. It is a second opinion, not a purchase recommendation or a guarantee.';
const MAX_TEXT = 4000;
const HELP_CHOICES = [{ label: 'Get a shortlist for my budget', send: 'Get a shortlist for my budget' }, { label: 'Check a laptop I am considering', send: 'Check a laptop I am considering' }, { label: 'Check what a seller told me', send: 'Check what a seller told me' }, { label: 'Compare two laptops', send: 'Compare two laptops' }, { label: 'Check a used listing', send: 'Check a used listing' }, { label: 'What owners say', send: 'What owners say' }];

export { mergeNeeds };

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

const LAPTOP_ACTIONS = ['used_check', 'check_pitch', 'owner_voice', 'second_opinion', 'sell_plan', 'compare'];
const FLOW_OF: Record<string, string> = { used_check: 'used_check', check_pitch: 'check_pitch', owner_voice: 'owner_voice', second_opinion: 'second_opinion', sell_plan: 'sell_laptop', compare: 'compare' };
const emptyNeeds = (): Needs => ({ budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] });
/** Needs from the browser: the lists always exist (a missing one used to crash the request). Budgets are validated downstream. */
export function safeNeeds(n: any): Needs {
  const arr = (v: any) => (Array.isArray(v) ? v.filter((c) => c && typeof c === 'object' && typeof c.attribute === 'string') : []);
  const max = n?.budget_max_inr ?? null, min = n?.budget_min_inr ?? null;   // budget validation belongs to the ranking step
  return { budget_max_inr: max, budget_min_inr: min, musts: arr(n?.musts), shoulds: arr(n?.shoulds), nices: arr(n?.nices), use_cases: Array.isArray(n?.use_cases) ? n.use_cases.filter((u: any) => typeof u === 'string').slice(0, 8) : [] };
}
const stubRouter = (over: Partial<RouterResult> = {}): RouterResult => ({ flow: 'second_opinion', confidence: 1, language: 'English', needs: emptyNeeds(), laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null, ...over });

export async function handleQuery(deps: Deps, input0: QueryInput): Promise<Reply> {
  let input: QueryInput = { ...input0 }; if (input.needs) input.needs = safeNeeds(input.needs); if (input.prior_needs) input.prior_needs = safeNeeds(input.prior_needs);
  const { tools, settings, requestId } = deps; const t0 = Date.now();
  const dataMode = settings.data_mode ?? 'course';
  const reply: Reply = { ok: true, request_id: requestId, flow: null, language: 'English', router_mode: null, notice: dataMode === 'production' ? '' : dataNotice(settings), footer: FOOTER, data_mode: dataMode, blocks: [], ignored_instructions: [], settings_version: settings._version ?? 0, data_version: null };
  const tm: Record<string, number> = {}; const lap = (k: string, since: number) => { tm[k] = Date.now() - since; };
  let textLen = 0; let outcome = 'ok'; let extra: Record<string, unknown> = {};
  // what the log records: the stage we are in, hard failures (thrown) and soft failures (handled, but worth knowing)
  let stage = 'start'; let errorStage: string | undefined; let errorMessage: string | undefined; let loggedText: string | undefined; let skipLog = false;
  const failures: Failure[] = []; const detail: Record<string, unknown> = {}; let lensesUsed: string[] = [];
  const finish = async () => {
    tm.total_ms = Date.now() - t0; reply.timings = tm;
    if ((settings.FEATURE_FLAGS ?? {}).web_images === false) stripImages(reply.blocks);
    // the answer receipt: which sources fed this answer (built from the reply itself, so it cannot claim a source that was not used)
    if (!['client_log', 'data_status', 'catalog', 'outbound_click'].includes(String(reply.flow)) && !reply.blocks.some((b) => b.type === 'provenance')) {
      const prov = buildProvenance({ blocks: reply.blocks, routerMode: reply.router_mode, reasonsMode: detail.reasons_mode as string | undefined, lenses: lensesUsed, degraded: deps.degraded ?? null, settings, gateRan: reply.blocks.some((b) => b.type === 'cards'), liveProvider: deps.live?.name ?? null, vision: !!(detail.image as any)?.kind, affiliateLinks: reply.blocks.some((b) => b.type === 'where_to_buy' && (b.links as any[]).some((l) => l.affiliate)) });
      if (prov) reply.blocks.push(prov);
    }
    try {
      const asks = reply.blocks.filter((b) => b.type === 'ask_laptop');
      if (asks.length) {
        const ids = [...(input.recommended ?? []), ...((input.shown ?? []).map((s) => s?.variant_id)), input.focus?.variant_id ?? ''].filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{2,24}$/.test(x)).slice(0, 14);
        const dflt = await laptopChoices(deps, ids);
        for (const b of asks) { if (!b.base) b.base = { ...(input.action ? { action: input.action } : {}), ...(input.text ? { text: String(input.text).slice(0, 400) } : {}) }; if (!Array.isArray(b.choices)) b.choices = dflt; }
      }
    } catch { for (const b of reply.blocks) if (b.type === 'ask_laptop' && !Array.isArray(b.choices)) b.choices = []; }
    if (!reply.blocks.length) reply.blocks.push({ type: 'text', text: 'I did not get anything I could use. Tell me what you need, for example: "laptop for coding under 60k".' });
    if (!skipLog) {
      try {
        const attempts = deps.model?.drain?.() ?? [];
        for (const a of attempts) if (!a.ok) failures.push({ stage: 'model', kind: 'attempt_failed', message: `${a.model}: ${a.error}` });
        for (const b of reply.blocks) if (b.type === 'live_reviews' && (b.status === 'error' || b.status === 'limit')) failures.push({ stage: 'live', kind: String(b.status), message: String(b.error ?? b.note).slice(0, 120) });
        await tools.call('log_event', { kind: 'query', request_id: requestId, flow: reply.flow, outcome, language: reply.language, router_mode: reply.router_mode, duration_ms: tm.total_ms, text_len: textLen,
          settings_version: String(settings._version ?? ''), visitor: input.session_hash, input_kind: inputKind(input), status: 200, error_stage: errorStage, error_message: errorMessage, text_scrubbed: loggedText,
          timings: tm, blocks: reply.blocks.map((b) => b.type), detail: { ...detail, ...extra, failures, model_attempts: attempts, degraded: deps.degraded ?? null, ignored: reply.ignored_instructions.length } });
      } catch { /* logging never breaks an answer */ }
    }
    return reply;
  };
  try { await run(); } catch (e) {
    outcome = 'error'; errorStage = stage; errorMessage = String((e as Error)?.message ?? e).slice(0, 200);
    reply.blocks = [{ type: 'text', text: 'Something went wrong on my side, and I would rather say so than guess. Please try again, or use the form.' }];
    try { console.error(requestId, (e as Error)?.message); } catch { /* ignore */ }
  }
  return finish();

  async function run() {
    if (deps.degraded) reply.blocks.push({ type: 'notice', text: DEGRADED_NOTICE[deps.degraded] ?? DEGRADED_NOTICE.limiter_unavailable });
    stage = input.action ? `action:${input.action}` : input.owned ? 'action:owned' : input.experience ? 'action:experience' : 'clean';
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
    if (input.action === 'web_search_laptops') {
      reply.flow = 'web_search_laptops'; const q = String(input.query ?? '').trim();
      if (q.length < 2 || q.length > 80) { reply.blocks.push({ type: 'text', text: 'Type 2 to 80 characters, for example a laptop name or "lightweight laptop for travel".' }); outcome = 'bad_request'; return; }
      loggedText = scrub(q); textLen = q.length; reply.blocks.push(await webRecoSafe(deps, searchQuery(q))); return;
    }
    if (input.action === 'data_status') {
      reply.flow = 'data_status'; const ds = settings.DATA_STATUS ?? {};
      reply.blocks.push({ type: 'data_status', ...ds, data_mode: dataMode, notice: dataNotice(settings), live_source: deps.live?.name ?? null, ai_model: deps.model?.name ?? null });
      return;
    }
    // publish cards that came from a direct path: template wording, then the same pre-send gate as every other answer
    const publishCards = async (cs: Card[]) => {
      if (!cs.length) return; await writeReasons(null, cs, 'English', { maxWords: 25, timeoutMs: 100 });
      const ok = await gateCards(tools, requestId, cs, { requireAll: false, maxWords: 25 });
      for (const b of reply.blocks) if (b.type === 'cards') b.cards = (b.cards as Card[]).filter((c) => ok.some((k) => k.variant_id === c.variant_id)).map(publicCard);
      reply.blocks = reply.blocks.filter((b) => !(b.type === 'cards' && !(b.cards as unknown[]).length));
    };
    // a photo or screenshot: read by the vision model into fields, validated in code, then checked against the catalog. Never stored or logged.
    if (input.action === 'read_image') {
      reply.flow = 'image'; const v = validateImage(input.image, settings.IMAGE_LIMITS ?? {});
      if (!v.ok) { reply.blocks.push({ type: 'text', text: v.reason }); outcome = 'bad_image'; return; }
      detail.image = { bytes: v.bytes, mime: v.image.mime };
      if (!deps.model) { reply.blocks.push({ type: 'text', text: 'Reading pictures needs the smart reader, which is not available to you right now (it is switched off, or you have reached a limit). Please type the details instead.' }, { type: 'choices', question: 'What would you like to do?', choices: [{ label: 'Check a used listing', send: 'Used laptop: ' }, { label: 'Check what a seller said', send: 'The seller said: ' }] }); outcome = 'image_unavailable'; return; }
      const g = await tools.call<any>('image_gate', { visitor: session });
      if (!g.allowed) { reply.blocks.push({ type: 'text', text: 'You have sent several pictures recently. Please try again a little later, or type the details.' }); outcome = 'rate_limited'; detail.retry_after = g.retry_after; return; }
      try {
        const r = await readImage(deps, v.image, input.intent); detail.image = { ...(detail.image as object), kind: r.read?.kind, readable: r.read?.readable, confidence: r.read?.confidence, concerns: r.read?.concerns.length };
        reply.blocks.push(...r.blocks); await publishCards(r.cards);
      } catch (e) {
        failures.push({ stage: 'image', kind: 'read_failed', message: String((e as Error)?.message ?? e).slice(0, 120) }); outcome = 'image_failed';
        reply.blocks.push({ type: 'text', text: 'I could not read that picture just now. Please try again, or type the details instead.' });
      }
      return;
    }
    if (input.action === 'where_to_buy' && input.variant_id) { reply.flow = 'where_to_buy'; reply.blocks.push(...(await whereToBuy(deps, input.variant_id))); return; }
    if (input.action === 'outbound_click') { skipLog = true; reply.flow = 'outbound_click'; await logClick(deps, { variantId: input.variant_id, retailer: String(input.retailer ?? ''), visitor: input.session_hash, from: input.from }); reply.blocks.push({ type: 'ack' }); return; }
    // a failure that only the browser can see (network down, a timeout, a crashed screen)
    if (input.action === 'client_log') {
      skipLog = true; reply.flow = 'client_log'; const c = input.client;
      if (c && CLIENT_KINDS.includes(c.what)) await tools.call('log_event', { kind: 'client', request_id: requestId, what: c.what, screen: String(c.screen ?? '').slice(0, 40), message: String(c.message ?? '').slice(0, 300), status: c.status, action: String(c.action ?? '').slice(0, 40), visitor: input.session_hash });
      reply.blocks.push({ type: 'ack' }); return;
    }
    // the answer to "which laptop?": a tapped choice carries variant_id; a typed name arrives as laptop_text. Resolve it ONCE and continue the original task.
    let typedMention: { brand: string | null; line: string } | undefined;
    if (typeof input.laptop_text === 'string' && !input.variant_id && (input.action ? LAPTOP_ACTIONS.includes(input.action) : !!input.text)) {
      const typed = cleanLaptopName(input.laptop_text);
      if (typed.length >= 2) {
        detail.laptop_text_len = typed.length; const res = await resolveVariant(deps, { brand: '', line: typed }, { web: false });
        const { laptop_text: _lt, variant_id: _vi, ...rest } = input as any; const base = Object.fromEntries(Object.entries(rest).filter(([k]) => !['session_hash', 'history', 'focus', 'shown', 'recommended', 'prior_needs', 'live'].includes(k)));
        if (res.kind === 'one') input = { ...input, variant_id: res.variantId };
        else if (res.kind === 'ask') { reply.flow = FLOW_OF[input.action ?? ''] ?? 'clarify'; reply.blocks.push(...res.blocks.map((b) => (b.type === 'ask_laptop' ? { ...b, base } : b))); return; }
        else {
          typedMention = { brand: null, line: typed };
          if (!input.action || input.action === 'sell_plan') { reply.flow = FLOW_OF[input.action ?? ''] ?? 'laptop_question'; reply.blocks.push({ type: 'text', text: `I could not find ${typed} in the LapFit catalog, so I will not guess its specs or price.` }, await webLaptop(deps, typed)); return; }
        }
      }
    }
    // a follow-up question whose "which laptop?" was answered: that laptop is now the one in focus
    if (input.variant_id && !input.action && input.text) input = { ...input, focus: { variant_id: input.variant_id } };

    // direct actions by laptop id: no text reading, no model call for the read step
    if (input.action === 'catalog') { reply.flow = 'catalog'; const n = await tools.call<any>('list_names', {}); reply.blocks.push({ type: 'catalog', rows: n.rows.map((r: any) => ({ variant_id: r.variant_id, model_id: r.model_id, name: r.display_name, brand: r.brand, price_inr: r.price_inr, ram_gb: r.ram_gb, storage_gb: r.storage_gb, recommendable: r.recommendable, display_size: r.display_size ?? null, image_url: r.image_url ?? null, image_site: r.image_site ?? null, image_page: r.image_page ?? null, weight_kg: r.weight_kg ?? null, battery_wh: r.battery_wh ?? null, refresh_hz: r.refresh_hz ?? null, gpu_class: r.gpu_class ?? null, market: r.market === 'US' ? 'US' : r.market === 'IN' ? 'IN' : (r.market ?? null), launch_year: launchYearOf(r.display_name, r.cpu_text) })) }); return; }
    if (input.action === 'compare') {
      reply.flow = 'compare'; const ids = [...(input.variant_ids ?? []), ...(input.variant_id ? [input.variant_id] : [])].filter((x) => typeof x === 'string').slice(0, 4);
      const ms = [...cleanMentions(input.rest), ...(typedMention ? [typedMention] : [])];
      reply.blocks.push(...(await compare(deps, ms, input.live === true, ids, input.custom)).blocks); return;
    }
    // the one-laptop flows below also run with NO laptop yet: they then ask "which laptop?" with the original task in `base`
    const secondOpinionWithGate = async (claims: ReturnType<typeof cleanClaims>) => {
      const needs0 = input.needs ?? safeNeeds(null); const mention = typedMention ? { brand: null, line: typedMention.line } : undefined;
      const r = await secondOpinionAndPitch(deps, stubRouter({ flow: claims.length ? 'check_pitch' : 'second_opinion', claims, laptop_mentions: mention ? [mention] : [] }), needs0, input.variant_id);
      reply.blocks.push(...r.blocks);
      if (r.cards.length) { await writeReasons(null, r.cards, 'English', { maxWords: 25, timeoutMs: 100 }); const ok = await gateCards(tools, requestId, r.cards, { requireAll: false, maxWords: 25 }); for (const b of reply.blocks) if (b.type === 'cards') b.cards = (b.cards as Card[]).filter((c) => ok.some((k) => k.variant_id === c.variant_id)).map(publicCard); reply.blocks = reply.blocks.filter((b) => !(b.type === 'cards' && !(b.cards as unknown[]).length)); }
    };
    if (input.action === 'owner_voice') { reply.flow = 'owner_voice'; reply.blocks.push(...(await ownerVoice(deps, typedMention ?? undefined, input.topic ?? '', input.variant_id)).blocks); return; }
    if (input.action === 'second_opinion') { reply.flow = 'second_opinion'; await secondOpinionWithGate([]); return; }
    if (input.action === 'check_pitch') { reply.flow = 'check_pitch'; await secondOpinionWithGate(cleanClaims(input.claims)); return; }
    if (input.action === 'sell_plan' && (input.variant_id || (input as any).custom_name)) { reply.flow = 'sell_laptop'; const sv = sellInputOf(input); reply.blocks.push(...(await sellPlan(deps, undefined, null, '', { variantId: input.variant_id, customName: sv.customName, paidInr: sv.paidInr, input: sv.input })).blocks); return; }
    if (input.action === 'used_check') {
      reply.flow = 'used_check'; const listing = cleanListing(input.listing); const claims = cleanClaims(input.claims);
      const mention = typedMention ? { brand: null, line: typedMention.line } : undefined;
      reply.blocks.push(...(await usedCheck(deps, listing, mention, input.variant_id)).blocks);
      if (claims.length && !reply.blocks.some((b) => b.type === 'ask_laptop')) reply.blocks.push(...(await claimsForMention(deps, input.variant_id ? { variant_id: input.variant_id } : mention, claims)));
      return;
    }
    if (input.owned) { reply.flow = 'my_laptops'; reply.blocks.push(...(await myLaptops(deps, input.owned, (deps.now?.() ?? new Date()).toISOString().slice(0, 10))).blocks); return; }

    // ---- clean the text ----
    const cleaned = cleanText(input.text ?? ''); const text = cleaned.text; textLen = text.length; loggedText = text ? scrub(text) : undefined;
    for (const n of cleaned.notices) reply.blocks.push({ type: 'notice', text: n });
    if (input.image) reply.blocks.push({ type: 'notice', text: 'To read a picture, use the camera button on the Ask screen. For now I am only using your typed words.' });
    if (flags.router_enabled === false && !input.needs) { reply.blocks.push({ type: 'text', text: 'Typed requests are paused. Use the form.' }); outcome = 'paused'; return; }
    if (input.sort && !text && !input.needs && input.prior_needs) input.needs = input.prior_needs;   // a sort chip re-orders the saved needs
    if (!text && !input.needs) { reply.blocks.push({ type: 'choices', question: 'Tell me what you need, or pick one:', choices: HELP_CHOICES.slice(0, 4) }); outcome = 'empty'; return; }

    // ---- read it ----
    // the four starter buttons start a guided step; they never run a canned example
    const starter = text.trim();
    if (!input.action && !input.needs && HELP_CHOICES.some((c) => c.send === starter)) {
      reply.flow = 'clarify'; outcome = 'clarify';
      if (starter === 'Get a shortlist for my budget') reply.blocks.push({ type: 'choices', question: 'What is your budget? Pick one, or type it (for example "laptop for coding under 55k").', choices: [30, 45, 60, 80].map((k) => ({ label: `Up to ₹${k},000`, send: `Suggest a laptop under ${k}k` })).concat([{ label: 'Up to ₹1 lakh', send: 'Suggest a laptop under 1 lakh' }]) });
      else if (starter === 'Check a laptop I am considering') reply.blocks.push(askBlock('Which laptop do you want me to check? Pick one, or type its name.', { action: 'second_opinion' }, await laptopChoices(deps, [...(input.recommended ?? []), ...(input.focus?.variant_id ? [input.focus.variant_id] : [])], 6)));
      else if (starter === 'Check what a seller told me') reply.blocks.push({ type: 'text', text: 'Paste what the seller said, for example: "seller says 16 GB RAM, 3 year warranty, battery lasts 2 days". You can also use the Check page to add a picture of the listing.' });
      else if (starter === 'Check a used listing') reply.blocks.push({ type: 'text', text: 'Paste the listing here (title, price, age, battery health, warranty), or use the Check page to add a picture of it.' });
      else if (starter === 'What owners say') reply.blocks.push(askBlock('Which laptop do you want owner opinions on? Pick one, or type its name.', { action: 'owner_voice' }, await laptopChoices(deps, [...(input.recommended ?? []), ...(input.focus?.variant_id ? [input.focus.variant_id] : [])], 6)));
      else reply.blocks.push({ type: 'text', text: 'Tick two or three laptops with the + on any result or in Explore, then press Compare. Or type two names, for example "Macbook Air M1 vs Asus TUF Gaming F15".' });
      return;
    }
    stage = 'router'; let router: RouterResult; const tRouter = Date.now();
    // what the browser says the person is looking at, checked against the catalog (ids and names only, never typed text)
    const ctxInfo = await checkedContext(deps, { focus: input.focus, shown: input.shown });
    const refined = text && !input.needs && !input.flow && input.prior_needs ? refineNeeds(text, input.prior_needs, input.context?.max_price ?? null) : null;
    const followIntent = text && !input.needs && !input.flow && !refined ? followUpIntent(text, ctxInfo) : null;
    if (refined) {
      router = { flow: 'shortlist', confidence: 1, language: 'English', needs: refined.needs, laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null }; reply.router_mode = 'context';
      reply.blocks.push({ type: 'notice', text: refineNotice(refined) }); for (const n of refined.notes) reply.blocks.push({ type: 'notice', text: n }); detail.refined = refined.changes.length;
    }
    else if (followIntent) { router = { flow: 'laptop_question', confidence: 1, language: 'English', needs: input.prior_needs ?? ({ budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] } as Needs), laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null }; reply.router_mode = 'context'; }
    else if (input.needs && !text) { router = { flow: 'shortlist', confidence: 1, language: 'English', needs: input.needs, laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null }; reply.router_mode = 'form'; }
    else if (deps.model) {
      try { router = await routeWithModel(deps.model, { text, history: input.history }, settings.ROUTER_TIMEOUT_MS ?? 8000); reply.router_mode = 'model'; { const rc = reconcileFlow(text, router); router = rc.router; if (rc.changed) detail.flow_corrected = rc.changed; } if (['shortlist', 'buy_for_others', 'second_opinion'].includes(router.flow)) { const b = backfillNeeds(text, router.needs); if (b.added.length) { detail.backfilled = b.added; router.needs = b.needs; reply.blocks.push({ type: 'notice', text: `The reader missed something you wrote, so I added it from your words: ${b.added.join('; ')}.` }); } } }
      catch (e) { failures.push({ stage: 'router', kind: 'fallback', message: String((e as Error)?.message ?? e).slice(0, 120) }); reply.router_error = String((e as Error)?.message ?? e).slice(0, 120); router = offlineRoute(text); reply.router_mode = 'fallback'; reply.notice = [reply.notice, 'The reader is unavailable, so I used a simpler reading. Check the needs below.'].filter(Boolean).join(' '); }
    } else { router = offlineRoute(text); reply.router_mode = 'offline'; }
    lap('router_ms', tRouter); reply.language = router.language; reply.ignored_instructions = router.ignored_instructions;
    if (router.ignored_instructions.length) reply.blocks.push({ type: 'notice', text: 'Some text in your message looked like an instruction to me. I treated it as data and ignored it.' });
    // a model-returned tone is only honoured when the words themselves confirm it
    if (router.tone === 'distressed' && !isDistress(text)) router.tone = 'normal';
    if (router.tone === 'abusive' && !isAbusive(text)) router.tone = 'normal';
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
    if (!refined && input.prior_needs && ['shortlist', 'buy_for_others', 'second_opinion'].includes(flow)) {
      needs = mergeNeeds(input.prior_needs, needs);
      for (const m of MODS) if (m.re.test(text)) m.apply(needs, input.context?.max_price ?? null, notes);
    }
    if (flow === 'shortlist' && text && !refined && !(needs.use_cases ?? []).length) {   // a use we do not recognise is never echoed as understood: say what was used instead
      const m = text.match(/\b(?:for|use(?:d)? for|to do|doing)\s+([a-z][\w\s/&+.-]{2,40}?)(?=\s+(?:under|below|within|upto|up to|around|budget|with|and|which|that)\b|[,.?!]|$)/i); const what = m?.[1]?.trim();
      if (what && !/^(a|an|the|me|my|us|our|laptop|laptops|something|anything|best|good|work)$/i.test(what) && !/\d/.test(what)) notes.push(`I can't rank by "${what}" directly, so I used general performance and your budget.`);
    }
    const soft = applySoftTerms(refined ? '' : text, needs, { lightKg: settings.LIGHT_KG ?? 1.5 }); needs = soft.needs;
    lensesUsed = soft.lenses; for (const n of [...notes, ...soft.notices]) reply.blocks.push({ type: 'notice', text: n });
    const cards: Card[] = [];
    const logUnhandled = async (kind: string) => { try { await tools.call('log_event', { kind: 'unhandled', reason: kind, text: scrub(text) }); } catch { /* ignore */ } };
    const wantLive = input.live === true || soft.lenses.includes('looks'); const tFlow = Date.now(); stage = `flow:${flow}`;

    // "this", "it", "the one you showed" in a question about a laptop: the person means the one in focus
    if (ctxInfo.focus && !router.laptop_mentions.length && ['owner_voice', 'second_opinion', 'check_pitch'].includes(flow) && refersToCurrent(text)) {
      router.laptop_mentions = [{ variant_id: ctxInfo.focus.variant_id, line: ctxInfo.focus.name, brand: null }]; reply.blocks.push({ type: 'notice', text: `I took this to mean ${ctxInfo.focus.name.split(' · ')[0]}.` });
    }

    // web picks beyond the catalog run in parallel with the shortlist and can never change or break it
    let webPicks: Promise<Block | null> | null = null;
    if (flow === 'shortlist' && deps.live?.web && flags.live_reviews !== false && flags.web_recommendations !== false && hasRecoNeed(needs)) {
      webPicks = webRecoSafe(deps, autoQuery(needs, (deps.now?.() ?? new Date()).getFullYear())).then((b) => (b.status === 'off' || b.status === 'empty' ? null : b), () => null);
    }

    switch (flow) {
      case 'laptop_question': {
        const ref = pickRef(text, ctxInfo);
        if (!ref) {
          const ids = ctxInfo.shown.map((r) => r.variant_id); reply.blocks.push(askBlock('Which laptop do you mean?', { text: input.text, prior_needs: input.prior_needs, shown: ctxInfo.shown.map((r) => ({ variant_id: r.variant_id })) }, ids.length ? await laptopChoices(deps, ids, ids.length) : null)); outcome = 'clarify'; break;
        }
        if (ctxInfo.focus && ref.variant_id === ctxInfo.focus.variant_id && refersToCurrent(text)) reply.blocks.push({ type: 'notice', text: `I took this to mean ${ref.name.split(' · ')[0]}.` });
        const r = await laptopQuestion(deps, { ref, intent: followIntent!, needsLines: needsLinesOf(input.prior_needs) }); reply.blocks.push(...r.blocks);
        if (followIntent === 'why') {
          const empty = { budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] } as Needs;
          const so = await secondOpinionAndPitch(deps, { flow: 'second_opinion', confidence: 1, language: 'English', needs: empty, laptop_mentions: [], claims: [], listing: null, ignored_instructions: [], clarifying_question: null, choices: [], tone: 'normal', followup_flow: null, ...({} as object) } as any, input.prior_needs ?? empty, ref.variant_id);
          reply.blocks.push(...so.blocks); cards.push(...so.cards);
        }
        break;
      }
      case 'shortlist': {
        const r = await runShortlist(deps, needs, { lenses: soft.lenses, wantLive, sort: input.sort }); reply.blocks.push(...r.blocks); cards.push(...r.cards); extra = { matched: r.matched };
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
      const tWrite = Date.now(); stage = 'reasons';
      const rr = await writeReasons(deps.model && flags.reasons_enabled !== false ? deps.model : null, cards, router.language, { maxWords: settings.REASON_MAX_WORDS ?? 25, timeoutMs: settings.WRITER_TIMEOUT_MS ?? 2000 });
      detail.reasons_mode = rr.mode; if (rr.rejected) detail.reasons_rejected = rr.rejected; if (rr.mode === 'template' && rr.error) failures.push({ stage: 'reasons', kind: 'template_fallback', message: rr.error });
      lap('reasons_ms', tWrite); const tGate = Date.now(); stage = 'gate'; let gateDropped = 0;
      for (const b of reply.blocks) {
        if (b.type !== 'cards') continue;
        const ok = await gateCards(tools, requestId, b.cards as Card[], { requireAll: b.requireAll === true, maxWords: settings.REASON_MAX_WORDS ?? 25 });
        const dropped = (b.cards as Card[]).length - ok.length; gateDropped += dropped; b.cards = ok.map(publicCard);
        if (dropped && !ok.length) { b.type = 'text'; b.text = NO_MATCH; outcome = 'gate_dropped'; }
      }
      lap('gate_ms', tGate); if (gateDropped) { detail.gate_dropped = gateDropped; failures.push({ stage: 'gate', kind: 'dropped', message: `${gateDropped} card(s) failed the re-check` }); }
    }
    reply.blocks = reply.blocks.filter((b) => !(b.type === 'cards' && !(b.cards as unknown[]).length));
    reply.blocks = reply.blocks.map((b) => (b.type === 'cards' ? { ...b, cards: (b.cards as any[]).map((c) => (c._gate ? publicCard(c) : c)) } : b));
    if (webPicks) {
      const wp = await webPicks;
      if (wp) { let at = -1; reply.blocks.forEach((b, i) => { if (b.type === 'cards') at = i; }); reply.blocks.splice(at + 1 || reply.blocks.length, 0, wp); }
    }
    if ((settings.FEATURE_FLAGS ?? {}).web_images === false) stripImages(reply.blocks);
  }
}
