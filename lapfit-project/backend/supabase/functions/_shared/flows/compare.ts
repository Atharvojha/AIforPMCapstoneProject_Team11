// Compare two or three named laptops side by side. Every value is a stored fact. No overall winner is declared.
import { resolveVariant } from './pitch.ts';
import { liveFor } from './livecards.ts';
import { fmtInr, fmtDate, fmtStorage } from '../util.ts';
import { HINGE_LABEL } from '../normalise.ts';
import { imageOf } from '../cards.ts';
import type { Deps, Row, Block } from '../types.ts';
import type { Mention } from '../router.ts';

type Def = { label: string; get: (r: Row) => string | null; num?: (r: Row) => number | null; better?: 'low' | 'high' };
const DEFS: Def[] = [
  { label: 'Price', get: (r) => (r.price_inr == null ? null : `${fmtInr(r.price_inr)} (as of ${fmtDate(r.price_as_of)})`), num: (r) => r.price_inr, better: 'low' },
  { label: 'RAM', get: (r) => (r.ram_gb == null ? null : `${r.ram_gb} GB`), num: (r) => r.ram_gb, better: 'high' },
  { label: 'Storage', get: (r) => (r.storage_gb == null ? null : fmtStorage(r.storage_gb)), num: (r) => r.storage_gb, better: 'high' },
  { label: 'Screen', get: (r) => (r.display_size == null ? null : `${r.display_size} inch`) },
  { label: 'Weight', get: (r) => (r.weight_kg == null ? null : `${r.weight_kg} kg`), num: (r) => r.weight_kg, better: 'low' },
  { label: 'Processor', get: (r) => r.cpu_text },
  { label: 'Graphics', get: (r) => r.gpu_text },
  { label: 'Battery', get: (r) => (r.battery_wh == null ? null : `${r.battery_wh} Wh`), num: (r) => r.battery_wh, better: 'high' },
  { label: 'Type', get: (r) => (r.hinge_type ? HINGE_LABEL[r.hinge_type] : null) },
  { label: 'Warranty', get: (r) => (r.warranty_years == null ? null : `${r.warranty_years} year${r.warranty_years === 1 ? '' : 's'}`) },
  { label: 'Operating system', get: (r) => (r.os_family === 'macos' ? 'macOS' : 'Windows') },
];

export async function compare(deps: Deps, mentions: Mention[], wantLive = false, ids?: string[]): Promise<{ blocks: Block[] }> {
  const blocks: Block[] = []; const rows: Row[] = []; const seen = new Set<string>();
  for (const id of [...new Set(ids ?? [])].slice(0, 4)) {
    const v = await deps.tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: String(id) });
    if (v.found) rows.push(v.specs);
  }
  for (const m of ids ? [] : mentions.slice(0, 3)) {
    const res = await resolveVariant(deps, m, { pickFirst: true }); if ((res as any).assumed) blocks.push({ type: 'notice', text: `I used ${(res as any).assumed}.` });
    if (res.kind !== 'one') {
      // keep the comparison in the follow-up: each choice re-sends the whole request with this laptop made exact
      for (const b of res.blocks) if (b.type === 'choices') b.choices = (b.choices as any[]).map((c) => ({ label: c.label, send: `compare ${mentions.map((x) => (x === m ? c.label.split(' · ')[0] : x.line)).join(' vs ')}` }));
      blocks.push(...res.blocks); continue;
    }
    if (seen.has(res.variantId)) continue; seen.add(res.variantId);
    rows.push((await deps.tools.call<{ specs: Row }>('get_variant', { variant_id: res.variantId })).specs);
  }
  if (rows.length < 2 && blocks.some((b) => b.type === 'choices')) return { blocks };
  if (rows.length < 2) { blocks.push({ type: 'text', text: rows.length ? 'I need two laptops to compare. Which other one?' : 'Name two laptops to compare, for example "MacBook Air M1 vs Asus TUF Gaming".' }); return { blocks }; }
  const table = DEFS.map((d) => {
    const nums = d.num ? rows.map((r) => d.num!(r)) : []; const known = nums.filter((x): x is number => x != null);
    const bestVal = known.length > 1 && d.better ? (d.better === 'low' ? Math.min(...known) : Math.max(...known)) : null;
    const ties = bestVal != null && nums.filter((x) => x === bestVal).length > 1;
    return { label: d.label, values: rows.map((r) => d.get(r) ?? 'not in catalog'), best: bestVal != null && !ties ? nums.indexOf(bestVal) : null, better: d.better ?? null };
  });
  const ev = await Promise.all(rows.map(async (r) => ({ variant_id: r.variant_id, name: r.display_name, ...(await deps.tools.call<any>('evidence_summary', { variant_id: r.variant_id })) })));
  blocks.push({ type: 'compare', laptops: rows.map((r) => ({ variant_id: r.variant_id, name: r.display_name, image: imageOf(r), brand: r.brand, screen_in: r.display_size ?? null, weight_kg: r.weight_kg ?? null, data_status: r.verified ? 'Verified' : r.is_sample ? 'Sample data' : 'Imported listing data, not human-verified' })), rows: table,
    evidence: ev.map((e) => ({ variant_id: e.variant_id, name: e.name, n: e.total.n, positive: e.total.positive, negative: e.total.negative, enough: e.total.n >= e.min_n, min_n: e.min_n, label: e.label })),
    note: 'The marker shows the lower price, lower weight, or higher RAM, storage or battery, when the values are known. I do not pick an overall winner: that depends on what you need.' });
  if (wantLive) blocks.push(...(await liveFor(deps, rows)));
  return { blocks };
}
