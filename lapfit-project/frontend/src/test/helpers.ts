import type { Reply } from '../lib/types';
const mods = import.meta.glob('./fixtures/*.json', { eager: true }) as Record<string, { default: { request: any; reply: Reply } }>;
export const fixtures: Record<string, { request: any; reply: Reply }> = Object.fromEntries(Object.entries(mods).map(([p, m]) => [p.split('/').pop()!.replace('.json', ''), m.default]));
export const fx = (name: string) => { const f = fixtures[name]; if (!f) throw new Error(`no fixture ${name}`); return f.reply; };
export const okResponse = (reply: Reply, init: ResponseInit = {}) => new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
export const cfg = { url: 'https://example.supabase.co', key: 'public-anon' };
