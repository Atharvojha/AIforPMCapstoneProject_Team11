// F02 Second opinion and the pitch check. Specs come from stored rows; verdicts come only from approved ledger rows.
import { criteriaFromNeeds, toFilterArgs, evalCriterion, HINGE_LABEL } from '../normalise.ts';
import { rank, onePerModel, type Evidence } from '../rank.ts';
import { buildCard, evidenceView, type Card } from '../cards.ts';
import { fmtInr, fmtDate, fmtStorage, normText } from '../util.ts';
import { liveFor } from './livecards.ts';
import type { Deps, Needs, Row, Block } from '../types.ts';
import type { Mention, Claim, RouterResult } from '../router.ts';

export interface Candidate { variant_id: string; model_id: number; display_name: string; brand: string; price_inr: number | null; ram_gb: number | null; storage_gb: number | null; recommendable: boolean }
export type Resolution = { kind: 'one'; variantId: string } | { kind: 'ask'; blocks: Block[] } | { kind: 'not_found'; blocks: Block[] };

const lev = (a: string, b: string) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const STOP = new Set(['laptop', 'notebook', 'gb', 'ram', 'ssd', 'storage', 'the', 'a', 'an', 'and', 'with', 'new', 'for']);
/** Typo-tolerant match: every word the buyer typed must match a word of the name within 1 edit (2 for long words). */
async function fuzzyCandidates(deps: Deps, m: Mention): Promise<Candidate[]> {
  const toks = normText(`${m.brand ?? ''} ${m.line ?? ''}`).split(' ').filter((t) => t && !STOP.has(t)); if (!toks.length) return [];
  const all = await deps.tools.call<{ rows: (Candidate & { text: string })[] }>('list_names', {});
  return all.rows.filter((r) => { const words = r.text.split(' '); return toks.every((t) => words.some((w) => lev(t, w) <= (t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0))); });
}

export async function resolveVariant(deps: Deps, m: Mention, o: { pickFirst?: boolean } = {}): Promise<Resolution & { assumed?: string }> {
  const r = await deps.tools.call<{ candidates: Candidate[] }>('resolve_laptop', { brand: m.brand ?? '', line: m.line ?? '' });
  let c = r.candidates;
  if (!c.length) c = await fuzzyCandidates(deps, m);
  // still nothing: drop trailing words one at a time ("macbook air m1 battery life" -> "macbook air m1"), keeping at least two words
  if (!c.length) { const toks = `${m.line ?? ''}`.trim().split(/\s+/); for (let n = toks.length - 1; n >= 2 && !c.length; n--) { const r2 = await deps.tools.call<{ candidates: Candidate[] }>('resolve_laptop', { brand: '', line: toks.slice(0, n).join(' ') }); c = r2.candidates; } }
  if (!c.length) return { kind: 'not_found', blocks: [{ type: 'text', text: `I could not find ${[m.brand, m.line].filter(Boolean).join(' ') || 'that laptop'} in the LapFit catalog, so I will not guess its specs or price.` }, { type: 'offer', label: 'Show me laptops that fit my needs instead', flow: 'shortlist' }] };
  const narrow = (f: (x: Candidate) => boolean) => { const n = c.filter(f); if (n.length) c = n; };
  if (m.ram_gb) narrow((x) => x.ram_gb === m.ram_gb);
  if (m.storage_gb) narrow((x) => x.storage_gb === m.storage_gb);
  if (c.length > 1 && m.price_inr) narrow((x) => x.price_inr === m.price_inr);
  const models = [...new Set(c.map((x) => x.model_id))];
  if (c.length === 1) return { kind: 'one', variantId: c[0].variant_id };
  if (o.pickFirst && models.length === 1) { const best = [...c].sort((a, b) => Number(b.recommendable) - Number(a.recommendable) || (a.price_inr ?? 1e9) - (b.price_inr ?? 1e9))[0]; return { kind: 'one', variantId: best.variant_id, assumed: `${best.display_name} (the lowest-priced of ${c.length} versions; tell me if you mean another)` }; }
  const label = (x: Candidate) => x.display_name;
  if (models.length > 1) return { kind: 'ask', blocks: [{ type: 'choices', question: 'Which laptop do you mean?', choices: c.slice(0, 4).map((x) => ({ label: label(x), send: x.display_name })) }] };
  return { kind: 'ask', blocks: [{ type: 'choices', question: 'That laptop comes in more than one version. Which one?', choices: c.slice(0, 4).map((x) => ({ label: label(x), send: x.display_name })) }] };
}

// ---------- spec claims ----------
export interface SpecClaim { attribute: 'ram_gb' | 'storage_gb' | 'weight_kg' | 'display_size' | 'warranty_years' | 'hinge_type'; op: '=' | '<=' | '>='; value: number | string; unit?: string }
export function parseSpecClaim(t0: string): SpecClaim | null {
  const s = t0.toLowerCase().replace(/,/g, ''); let m: RegExpMatchArray | null;
  const op = /(under|below|less than|upto|up to|max|only|at most)/.test(s) ? '<=' : /(at least|minimum|min|over|more than|\+)/.test(s) ? '>=' : '=';
  if ((m = s.match(/(\d{1,3})\s*gb\s*(?:of\s*)?(?:ram|memory)|(?:ram|memory)\s*(?:of\s*)?(\d{1,3})\s*gb/))) return { attribute: 'ram_gb', op, value: Number(m[1] || m[2]), unit: 'GB' };
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(gb|tb)\s*(?:ssd|storage|nvme|hdd|disk)|(?:ssd|storage)\s*(?:of\s*)?(\d+)\s*(gb|tb)/))) { const n = Number(m[1] || m[3]); const u = m[2] || m[4]; return { attribute: 'storage_gb', op, value: u === 'tb' ? n * 1024 : n, unit: 'GB' }; }
  if ((m = s.match(/(\d(?:\.\d+)?)\s*kg/))) return { attribute: 'weight_kg', op, value: Number(m[1]), unit: 'kg' };
  if ((m = s.match(/(\d{2}(?:\.\d)?)\s*(?:inch|in\b|")/))) return { attribute: 'display_size', op: '=', value: Number(m[1]), unit: 'inch' };
  if ((m = s.match(/(\d)\s*[- ]?\s*years?\s*(?:of\s*)?warranty|warranty\s*(?:of\s*)?(\d)\s*years?/))) return { attribute: 'warranty_years', op: '>=', value: Number(m[1] || m[2]), unit: 'years' };
  if (/360|convertible|2[- ]?in[- ]?1|flip|foldable|tablet mode/.test(s)) return { attribute: 'hinge_type', op: '=', value: 'convertible_360' };
  if (/detachable/.test(s)) return { attribute: 'hinge_type', op: '=', value: 'detachable' };
  return null;
}
/** Pure comparison of a claim against the stored rows (all versions of the model, or the chosen one). */
export function evalSpecClaim(c: SpecClaim, rows: Row[], tolKg: number): { ok: boolean; stored: (number | string)[] } {
  const stored = [...new Set(rows.map((r) => (r as any)[c.attribute]).filter((x) => x != null))] as (number | string)[];
  const tol = c.attribute === 'weight_kg' ? tolKg : 0;
  const cmp = (x: number | string) => { if (typeof x === 'string') return x === c.value; const v = c.value as number; return c.op === '<=' ? x <= v + tol : c.op === '>=' ? x >= v : tol ? Math.abs(x - v) <= tol : x === v; };
  return { ok: stored.some(cmp), stored };
}
export const fmtSpec = (c: SpecClaim, x: number | string) => c.attribute === 'hinge_type' ? HINGE_LABEL[x as string] : c.attribute === 'storage_gb' ? fmtStorage(x as number) : c.attribute === 'warranty_years' ? `${x} year${x === 1 ? '' : 's'}` : `${x}${c.unit ? ' ' + c.unit : ''}`;

export const TOPIC_OF: [RegExp, string][] = [[/battery|hours|charge|backup/, 'battery'], [/hot|heat|cool|fan|noise|loud/, 'heat_noise'], [/keyboard|typing|keys/, 'keyboard'], [/screen|display|bright|colour|color/, 'display'], [/fast|speed|lag|smooth|heavy|slow|software|gaming|performance/, 'performance'], [/hinge|fold|flip|build|sturdy/, 'hinge']];

export interface ClaimRow { claim_text: string; type: string; status: string; label: string; detail: string; sample_size?: number; approver?: string; date?: string; ledger_id?: string; evidence?: any; _spec?: { claim: SpecClaim; variant_ids: string[] } }

export async function checkClaims(deps: Deps, claims: Claim[], rows: Row[] | null, scopeNames: string[]): Promise<ClaimRow[]> {
  const out: ClaimRow[] = []; const tol = deps.settings.WEIGHT_TOLERANCE_KG ?? 0.05;
  for (const c of claims) {
    const base = { claim_text: c.claim_text, type: c.type };
    if (c.type === 'opinion') { out.push({ ...base, status: 'cant_check', label: "Can't be checked", detail: 'This is an opinion, so there is no fact to compare.' }); continue; }
    if (c.type === 'spec') {
      const p = parseSpecClaim(c.claim_text);
      if (!p || !rows?.length) { out.push({ ...base, status: 'not_in_catalog', label: 'Not in catalog', detail: rows?.length ? 'I could not match this to a field in the catalog.' : 'The laptop is not in the catalog, so there is nothing to compare with.' }); continue; }
      const { ok, stored } = evalSpecClaim(p, rows, tol);
      if (!stored.length) { out.push({ ...base, status: 'not_in_catalog', label: 'Not in catalog', detail: 'The catalog has no value for this field yet.' }); continue; }
      const detail = `Catalog lists: ${stored.map((x) => fmtSpec(p, x)).join(', ')}.`;
      const spec = { claim: p, variant_ids: rows.map((r) => r.variant_id) };
      out.push(ok ? { ...base, status: 'supported', label: 'Matches the catalog', detail, _spec: spec } : { ...base, status: 'contradicts', label: 'Does not match the specs', detail: `${detail} This does not match what was claimed.`, _spec: spec });
      continue;
    }
    const scopes = ['general', ...scopeNames];
    const hit = await deps.tools.call<any>('lookup_claim_verdict', { claim_text: c.claim_text, scopes });
    if (hit.found) { out.push({ ...base, status: 'verdict', label: 'Checked by a person', detail: hit.verdict, sample_size: hit.sample_size, approver: hit.approver, date: hit.approved_at, ledger_id: hit.ledger_id }); continue; }
    const topic = TOPIC_OF.find(([re]) => re.test(c.claim_text.toLowerCase()))?.[1]; let evidence: any = null;
    if (rows?.[0] && topic) {
      const s = await deps.tools.call<any>('evidence_summary', { variant_id: rows[0].variant_id, topic }); const t = s.topics[0];
      if (t) evidence = { topic, n: t.n, enough: t.enough, positive: t.positive, negative: t.negative, sources: t.sources, label: s.label };
    }
    out.push({ ...base, status: 'not_checked', label: 'Not checked yet', detail: 'No person has approved a verdict for this claim yet. This is not a verdict either way.', evidence });
  }
  return out;
}

export async function secondOpinionAndPitch(deps: Deps, router: RouterResult, needs: Needs): Promise<{ blocks: Block[]; cards: Card[] }> {
  const { tools, settings } = deps; const minN = settings.MIN_EVIDENCE_N ?? 20; const blocks: Block[] = [];
  const mention = router.laptop_mentions[0];
  if (!mention) return { blocks: [{ type: 'text', text: 'Which laptop are you asking about? Type its name, for example "Asus TUF Gaming F15".' }], cards: [] };
  const res = await resolveVariant(deps, mention);
  if (res.kind !== 'one') return { blocks: res.blocks, cards: [] };
  const v = await tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: res.variantId });
  const row = v.specs; const crit = criteriaFromNeeds(needs);
  const ev = await tools.call<any>('evidence_summary', { variant_id: row.variant_id });
  const cards: Card[] = [];
  if (row.price_inr == null || !row.price_as_of) {
    blocks.push({ type: 'text', text: `I have owner opinions for ${row.display_name} but no Indian price on file, so I show the evidence only and will not guess a price.` });
  } else {
    const card = buildCard(row, { musts: crit.musts, requireAll: false, evidence: ev.total, minN, factLines: [`Costs ${fmtInr(row.price_inr)} as of ${fmtDate(row.price_as_of)}.`, ...crit.musts.filter((c) => c.supported && !c.implicit).map((c) => `${c.label}: this laptop has ${(card0 as any)(c, row)}.`)] });
    cards.push(card);
    blocks.push({ type: 'cards', title: 'The laptop you are considering', cards: [card], showMusts: true, requireAll: false });
  }
  // owner evidence by topic, with n; quotes only where n is enough and the source allows quoting
  const topics = await Promise.all(ev.topics.map(async (t: any) => {
    const q = t.enough ? (await tools.call<any>('evidence_quotes', { variant_id: row.variant_id, topic: t.topic, limit: 3 })).quotes : [];
    return { ...t, quotes: q };
  }));
  blocks.push({ type: 'evidence', laptop: row.display_name, variant_id: row.variant_id, min_n: minN, label: ev.label, topics });
  blocks.push(...(await liveFor(deps, [row])));
  // alternatives: meet every Must at the same or a lower price
  if (row.price_inr != null && row.recommendable) {
    const args = toFilterArgs(needs, crit.musts, { budget_max: row.price_inr, exclude_model_id: row.model_id });
    const alt = await tools.call<{ rows: Row[] }>('find_variants', args);
    if (alt.rows.length) {
      const evm = new Map<string, Evidence>(); await Promise.all(alt.rows.map(async (r) => { evm.set(r.variant_id, (await tools.call<any>('evidence_summary', { variant_id: r.variant_id })).total); }));
      const altCrit = { ...crit }; const top = onePerModel(rank(alt.rows, needs, altCrit, evm, settings)).slice(0, settings.MAX_ALTERNATIVES ?? 2);
      const altCards = top.map((s) => buildCard(s.row, { musts: crit.musts, requireAll: true, evidence: s.evidence, minN, factLines: [`Costs ${fmtInr(s.row.price_inr as number)}, ${fmtInr(row.price_inr! - (s.row.price_inr as number))} less than the laptop you are considering.`] }));
      cards.push(...altCards);
      blocks.push({ type: 'cards', title: 'Alternatives that meet every Must at the same or a lower price', cards: altCards, requireAll: true, compare: true });
    } else blocks.push({ type: 'text', text: 'No other laptop in the catalog meets every Must at the same or a lower price.' });
  }
  // pitch claims
  if (router.claims.length) {
    const mv = await tools.call<{ rows: Row[] }>('model_variants', { model_id: row.model_id });
    const rowsForClaims = mv.rows.length ? mv.rows : [row];
    const claimRows = await checkClaims(deps, router.claims, rowsForClaims, [row.variant_id, String(row.model_id)]);
    blocks.push({ type: 'claims', laptop: row.display_name, rows: claimRows.map(({ _spec, ...r }) => r) });
  }
  return { blocks, cards };
}
const card0 = (c: any, row: Row) => { const a = (c.attribute as string); return a === 'hinge_type' ? (row.hinge_type ? HINGE_LABEL[row.hinge_type] : 'not in catalog') : String((row as any)[a] ?? 'not in catalog'); };
