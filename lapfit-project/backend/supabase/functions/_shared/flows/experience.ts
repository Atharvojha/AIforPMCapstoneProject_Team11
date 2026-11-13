// F06 Add my experience. Rules flag risk; a named person approves every report. Nothing is visible until approved.
import { resolveVariant } from './pitch.ts';
import { findInjections, looksLikeUrl, scrub } from '../util.ts';
import type { Deps, Block } from '../types.ts';

export interface ExperienceInput { name?: string; variant_id?: string; months_owned?: number; persona?: string; topic?: string; rating?: number; note?: string; adult_confirmed?: boolean; consent?: boolean; session_hash?: string }
const TOPICS = ['battery', 'heat_noise', 'keyboard', 'display', 'performance', 'hinge', 'service'];
const PERSONAS = ['student', 'developer', 'gamer', 'creator', 'parent', 'professional', 'other'];
const ABUSE = /idiot|stupid|scam|fraud|cheat|bastard|fuck|chutiya|madarchod|bc\b|mc\b/i;
const PHONE_WORDS = /\b(nine|eight|seven|six)\b(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){6,}/i;

export function triageRules(note: string, rating?: number): string[] {
  const flags: string[] = [];
  if (ABUSE.test(note)) flags.push('abuse');
  if (findInjections(note).length) flags.push('instruction_like');
  if (PHONE_WORDS.test(note) || /\b[\w.+-]+\s*(?:@|\bat\b)\s*[\w-]+\s*(?:\.|\bdot\b)\s*\w+/i.test(note)) flags.push('personal_data');
  if (/buy now|discount code|whatsapp me|click here|visit my/i.test(note)) flags.push('spam');
  if (rating != null && rating <= 2 && /love|excellent|best|perfect|amazing/i.test(note)) flags.push('rating_mismatch');
  if (rating != null && rating >= 4 && /worst|terrible|useless|waste/i.test(note)) flags.push('rating_mismatch');
  return flags;
}

export async function submitExperience(deps: Deps, e: ExperienceInput): Promise<{ blocks: Block[] }> {
  const fail = (text: string): { blocks: Block[] } => ({ blocks: [{ type: 'text', text }] });
  if (!e.adult_confirmed || !e.consent) return fail('Please confirm you are 18 or older and agree to the notice before submitting. I do not collect your name or contact details.');
  const note = String(e.note ?? '').trim();
  if (note.length < 10) return fail('Please write at least a sentence (10 characters).');
  if (note.length > 800) return fail('Please keep it under 800 characters.');
  if (looksLikeUrl(note) || scrub(note) !== note.slice(0, 500) && /\[(?:link|email|phone)\]/.test(scrub(note))) return fail('Please remove links, email addresses and phone numbers from your note.');
  if (e.rating != null && !(e.rating >= 1 && e.rating <= 5)) return fail('The rating must be 1 to 5.');
  if (e.months_owned != null && !(e.months_owned >= 0 && e.months_owned <= 120)) return fail('Months owned must be between 0 and 120.');
  const persona = e.persona && PERSONAS.includes(e.persona) ? e.persona : e.persona ? 'other' : null;
  const topic = e.topic && TOPICS.includes(e.topic) ? e.topic : null;
  let vid = e.variant_id ?? '';
  if (!vid && e.name) { const r = await resolveVariant(deps, { brand: '', line: e.name }); if (r.kind !== 'one') return { blocks: r.blocks }; vid = r.variantId; }
  if (!vid) return fail('Which laptop is this about?');
  const v = await deps.tools.call<any>('get_variant', { variant_id: vid }); if (!v.found) return fail('That laptop is not in the catalog.');
  const flags = triageRules(note, e.rating);
  const out = await deps.tools.call<any>('report_submit', { variant_id: vid, months_owned: e.months_owned, persona, topic, rating: e.rating, note, session_hash: e.session_hash ?? 'anon', flags });
  if (!out.ok) return fail(out.reason === 'rate_limit' ? 'Too many reports in the last hour. Please try again later.' : 'Submissions are closed right now.');
  return { blocks: [{ type: 'report_receipt', receipt: out.receipt, laptop: v.specs.display_name, text: 'Thank you. A person reviews every report before it is shown, usually within 48 hours. Keep this code to check the status or to delete your report. It is labelled "owner-reported, not verified" when shown.' }] };
}
