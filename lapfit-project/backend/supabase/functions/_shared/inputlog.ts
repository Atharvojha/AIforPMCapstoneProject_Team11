// What the input log records for one request. Pure, so it is tested. Pictures and automatic calls are never stored.
const SKIP_ACTIONS = new Set(['client_log', 'data_status', 'catalog', 'outbound_click']);   // automatic, not something a person typed
const BIG_KEYS = ['image', 'image_base64', 'image_data', 'data_url', 'picture'];

export interface InputRecord { kind: string; text: string; payload: Record<string, unknown> | null; raw_len: number }

export function kindOf(b: any): string { return b?.action ? `action:${b.action}` : b?.owned ? 'owned' : b?.experience ? 'experience' : b?.needs && !b?.text ? 'needs' : 'text'; }

/** Returns null when there is nothing a person provided (automatic calls, empty bodies). */
export function inputRecord(raw: string, headerImage = false): InputRecord | null {
  let b: any; try { b = raw ? JSON.parse(raw) : {}; } catch { return { kind: 'unparseable', text: raw.slice(0, 2000), payload: null, raw_len: raw.length }; }   // a malformed body is still an input
  if (b === null || typeof b !== 'object' || Array.isArray(b)) return { kind: 'unparseable', text: String(raw).slice(0, 2000), payload: null, raw_len: raw.length };
  if (b.action && SKIP_ACTIONS.has(String(b.action))) return null;
  const { text, session_hash: _s, ...rest } = b; const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (BIG_KEYS.includes(k) || (typeof v === 'string' && v.length > 20000 && /^data:/.test(v))) payload[k] = `[picture not stored, ${typeof v === 'string' ? v.length : 0} characters]`;
    else payload[k] = v;
  }
  if (headerImage && !Object.keys(payload).length) payload.note = 'picture sent, not stored';
  const t = typeof text === 'string' ? text : '';
  const j = JSON.stringify(payload); const cut = j.length > 8000 ? { truncated: true, preview: j.slice(0, 8000) } : payload;
  if (!t && !Object.keys(payload).length) return null;
  return { kind: kindOf(b), text: t.slice(0, 5000), payload: Object.keys(cut).length ? cut : null, raw_len: raw.length };
}
