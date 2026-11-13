// Compare two or three named laptops side by side. Every value is a stored fact. No overall winner is declared.
import { resolveVariant } from './pitch.ts';
import { liveFor } from './livecards.ts';
import { fmtInr, fmtDate, fmtStorage } from '../util.ts';
import { HINGE_LABEL } from '../normalise.ts';
import { imageOf } from '../cards.ts';
import type { Deps, Row, Block } from '../types.ts';
import { askBlock } from './ask.ts';
import { findInjections } from '../util.ts';
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

export interface CustomLaptop { name: string; price_inr?: number; ram_gb?: number; storage_gb?: number; display_size?: number; weight_kg?: number; battery_wh?: number; cpu?: string }
const CB: Record<string, [number, number]> = { price_inr: [5000, 500000], ram_gb: [2, 128], storage_gb: [32, 8192], display_size: [10, 20], weight_kg: [0.5, 4], battery_wh: [10, 120] };
const CLABEL: Record<string, string> = { price_inr: 'price', ram_gb: 'RAM', storage_gb: 'storage', display_size: 'screen size', weight_kg: 'weight', battery_wh: 'battery', cpu: 'processor' };
export const YOURS = '(yours, as you entered)';
/** The user's own laptop: numbers are bounded by code, text is stripped to plain characters. Returns the cleaned laptops and what was left out. */
export function cleanCustom(raw: unknown): { laptops: CustomLaptop[]; dropped: string[] } {
  const laptops: CustomLaptop[] = []; const dropped: string[] = [];
  for (const x of (Array.isArray(raw) ? raw : []).slice(0, 2)) {
    if (!x || typeof x !== 'object') continue;
    const name = String((x as any).name ?? '').replace(/[^A-Za-z0-9 .\-+/()&']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); if (name.length < 2 || findInjections(name).length) continue;
    const c: CustomLaptop = { name };
    for (const k of Object.keys(CB)) { const v = (x as any)[k]; if (v == null || v === '') continue; if (typeof v === 'number' && isFinite(v) && v >= CB[k][0] && v <= CB[k][1]) (c as any)[k] = v; else dropped.push(`${CLABEL[k]} of ${name}`); }
    const cpu = String((x as any).cpu ?? '').replace(/[^A-Za-z0-9 \-+.()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); if (cpu && !findInjections(cpu).length) c.cpu = cpu;
    laptops.push(c);
  }
  return { laptops, dropped };
}
const customRow = (c: CustomLaptop, i: number): Row => ({ variant_id: `custom-${i + 1}`, display_name: c.name, price_inr: c.price_inr ?? null, price_as_of: null, ram_gb: c.ram_gb ?? null, storage_gb: c.storage_gb ?? null, display_size: c.display_size ?? null, weight_kg: c.weight_kg ?? null, battery_wh: c.battery_wh ?? null, cpu_text: c.cpu ?? null, gpu_text: null, hinge_type: null, warranty_years: null, os_family: '?' } as unknown as Row);

export async function compare(deps: Deps, mentions: Mention[], wantLive = false, ids?: string[], custom?: unknown): Promise<{ blocks: Block[] }> {
  const blocks: Block[] = []; const rows: Row[] = []; const seen = new Set<string>();
  for (const id of [...new Set(ids ?? [])].slice(0, 4)) {
    const v = await deps.tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: String(id) });
    if (v.found && !seen.has(v.specs.variant_id)) { seen.add(v.specs.variant_id); rows.push(v.specs); }
  }
  const cu = cleanCustom(custom); if (cu.dropped.length) blocks.push({ type: 'notice', text: `I left out values that are not believable for a laptop: ${cu.dropped.join(', ')}. They show as "?".` });
  const ms = mentions.slice(0, 3);
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i]; if (rows.length + cu.laptops.length >= 4) break;
    const res = await resolveVariant(deps, m, { pickFirst: true, web: true }); if ((res as any).assumed) blocks.push({ type: 'notice', text: `I used ${(res as any).assumed}.` });
    if (res.kind === 'ask') {
      // keep the comparison going: what is already resolved and the laptops still to read ride along, the answer fills this slot
      const rest = ms.slice(i + 1).map((x) => ({ brand: x.brand ?? null, line: x.line ?? null, ram_gb: x.ram_gb ?? null, storage_gb: x.storage_gb ?? null, price_inr: x.price_inr ?? null }));
      return { blocks: [...blocks, ...res.blocks.map((b) => (b.type === 'ask_laptop' ? { ...b, base: { action: 'compare', variant_ids: rows.map((r) => r.variant_id), rest } } : b))] };
    }
    if (res.kind !== 'one') { blocks.push(...res.blocks.filter((b) => b.type !== 'offer')); continue; }
    if (seen.has(res.variantId)) continue; seen.add(res.variantId);
    rows.push((await deps.tools.call<{ specs: Row }>('get_variant', { variant_id: res.variantId })).specs);
  }
  const total = rows.length + cu.laptops.length;
  if (total < 2) {
    if (!blocks.some((b) => b.type === 'web_laptop')) { if (!rows.length && !cu.laptops.length) { blocks.push(askBlock('Which laptops do you want to compare? Pick or type the first one.', { action: 'compare', variant_ids: [], rest: [] }, null)); return { blocks }; } blocks.push(askBlock('I need two laptops to compare. Which other laptop do you want to compare it with?', { action: 'compare', variant_ids: rows.map((r) => r.variant_id), custom: cu.laptops }, null)); return { blocks }; }
    blocks.push({ type: 'text', text: 'I need two laptops to compare. You can type the details of this one yourself and compare it.' }); return { blocks };
  }
  const all: Row[] = [...rows, ...cu.laptops.map(customRow)]; const isCustom = (i: number) => i >= rows.length;
  const table = DEFS.map((d) => {
    const nums = d.num ? all.map((r) => d.num!(r)) : []; const known = nums.filter((x): x is number => x != null);
    const bestVal = known.length > 1 && d.better ? (d.better === 'low' ? Math.min(...known) : Math.max(...known)) : null;
    const ties = bestVal != null && nums.filter((x) => x === bestVal).length > 1;
    return { label: d.label, values: all.map((r, i) => (isCustom(i) ? customValue(d.label, r) : d.get(r) ?? 'not in catalog')), best: bestVal != null && !ties ? nums.indexOf(bestVal) : null, better: d.better ?? null };
  });
  const evRows = await Promise.all(rows.map(async (r) => ({ variant_id: r.variant_id, name: r.display_name, ...(await deps.tools.call<any>('evidence_summary', { variant_id: r.variant_id })) })));
  const min = deps.settings.MIN_EVIDENCE_N ?? 20;
  const evidence = [...evRows.map((e) => ({ variant_id: e.variant_id, name: e.name, n: e.total.n, positive: e.total.positive, negative: e.total.negative, enough: e.total.n >= e.min_n, min_n: e.min_n, label: e.label })),
    ...cu.laptops.map((c, i) => ({ variant_id: `custom-${i + 1}`, name: `${c.name} ${YOURS}`, n: 0, positive: 0, negative: 0, enough: false, min_n: min, label: 'No owner opinions: this is a laptop you entered yourself.', custom: true }))];
  blocks.push({ type: 'compare', laptops: [...rows.map((r) => ({ variant_id: r.variant_id, name: r.display_name, image: imageOf(r), brand: r.brand, screen_in: r.display_size ?? null, weight_kg: r.weight_kg ?? null, data_status: r.verified ? 'Verified' : r.is_sample ? 'Sample data' : 'Imported listing data, not human-verified' })),
      ...cu.laptops.map((c, i) => ({ variant_id: `custom-${i + 1}`, name: `${c.name} ${YOURS}`, image: null, brand: null, screen_in: c.display_size ?? null, weight_kg: c.weight_kg ?? null, data_status: 'Entered by you, not checked', custom: true }))], rows: table, evidence,
    note: `The marker shows the lower price, lower weight, or higher RAM, storage or battery, when the values are known. I do not pick an overall winner: that depends on what you need.${cu.laptops.length ? ' Values for a laptop marked "yours" are what you entered; I have not checked them, and "?" means you left it blank.' : ''}` });
  if (wantLive && rows.length) blocks.push(...(await liveFor(deps, rows)));
  return { blocks };
}
function customValue(label: string, r: Row): string {
  switch (label) {
    case 'Price': return r.price_inr == null ? '?' : fmtInr(r.price_inr); case 'RAM': return r.ram_gb == null ? '?' : `${r.ram_gb} GB`; case 'Storage': return r.storage_gb == null ? '?' : fmtStorage(r.storage_gb);
    case 'Screen': return r.display_size == null ? '?' : `${r.display_size} inch`; case 'Weight': return r.weight_kg == null ? '?' : `${r.weight_kg} kg`; case 'Battery': return r.battery_wh == null ? '?' : `${r.battery_wh} Wh`;
    case 'Processor': return r.cpu_text ?? '?'; default: return '?';
  }
}
