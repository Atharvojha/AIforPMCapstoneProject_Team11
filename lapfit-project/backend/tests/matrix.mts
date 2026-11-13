import { getDb } from './helpers.ts';
import { handleQuery } from '../supabase/functions/_shared/handler.ts';
import { loadSettings } from '../supabase/functions/_shared/settings.ts';
import { CASES } from './inputs.ts';
const { tools } = await getDb();
const settings = await loadSettings(tools);
let bad = 0;
for (const c of CASES) {
  const r = await handleQuery({ tools, model: null, settings, requestId: 'm-' + c.id }, { text: c.text, ...(c.extra ?? {}) });
  const want = [c.flow].flat(); const ok = want.includes(String(r.flow)) || (r.flow === null && ['empty','spaces'].includes(c.id)); if (!ok) bad++;
  const types = r.blocks.map((b: any) => b.type === 'cards' ? `cards(${b.cards.length})` : b.type);
  console.log(`${ok ? 'OK ' : 'XX '} ${c.id.padEnd(16)} flow=${String(r.flow).padEnd(18)} ${types.join(',')}`);
}
console.log('mismatches:', bad); process.exit(0);
