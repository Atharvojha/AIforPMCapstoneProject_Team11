// The "answer receipt": which sources fed this answer, how fresh they are, and which checks ran. Built from what is in the reply,
// so it cannot claim a source the answer did not use.
import type { Block, Settings } from './types.ts';

export interface ProvenanceInput { blocks: Block[]; routerMode: string | null; reasonsMode?: string; lenses?: string[]; degraded?: string | null; settings: Settings; gateRan: boolean; liveProvider?: string | null; affiliateLinks?: boolean; vision?: boolean }

const CATALOG_BLOCKS = new Set(['where_to_buy', 'image_read', 'cards', 'compare', 'sell_plan', 'my_laptops', 'team_plan', 'market_pulse', 'findings', 'claims', 'evidence', 'laptop_answer']);

export function buildProvenance(i: ProvenanceInput): Block | null {
  const ds = i.settings.DATA_STATUS ?? {};
  const catalogUsed = i.blocks.some((b) => CATALOG_BLOCKS.has(b.type));
  let opinions = 0; let datasetBlocks = false;
  for (const b of i.blocks) {
    if (b.type === 'cards') for (const c of b.cards ?? []) opinions += Number(c.evidence?.n ?? 0);
    else if (b.type === 'evidence') { datasetBlocks = true; for (const t of b.topics ?? []) opinions += Number(t.n ?? 0); }
    else if (b.type === 'compare') for (const e of b.evidence ?? []) opinions += Number(e.n ?? 0);
    else if (b.type === 'brand_insights') { datasetBlocks = true; for (const x of b.brands ?? []) opinions += Number(x.n ?? 0); }
    else if (b.type === 'market_pulse') datasetBlocks = true;
    else if (b.type === 'laptop_answer') { datasetBlocks = datasetBlocks || (b.sections ?? []).some((x: any) => x.kind === 'owners'); }
    else if (b.type === 'claims') for (const r of b.rows ?? []) opinions += Number(r.evidence?.n ?? 0);
  }
  const imageSites = new Set<string>(); for (const b of i.blocks) { for (const c of (b.type === 'cards' ? b.cards ?? [] : [])) if (c.image) imageSites.add(c.image.site ?? 'the web'); for (const l of (b.type === 'compare' ? b.laptops ?? [] : [])) if (l.image) imageSites.add(l.image.site ?? 'the web'); }
  const lenses = i.lenses ?? []; const datasetUsed = opinions > 0 || datasetBlocks || lenses.length > 0;
  const liveBlocks = [...i.blocks.filter((b) => b.type === 'live_reviews' && b.status !== 'off'), ...i.blocks.filter((b) => (b.type === 'market_pulse' || b.type === 'brand_insights') && b.web && b.web.status !== 'off').map((b) => b.web), ...i.blocks.filter((b) => b.type === 'web_picks' && b.status !== 'off'), ...i.blocks.filter((b) => b.type === 'laptop_answer').flatMap((b) => (b.sections ?? []).filter((x: any) => x.web && x.web.status !== 'off').map((x: any) => x.web))];
  const liveItems = liveBlocks.reduce((n, b) => n + (b.items?.length ?? 0), 0);
  const liveStatuses = [...new Set(liveBlocks.map((b) => String(b.status)))];
  if (!catalogUsed && !datasetUsed && !liveBlocks.length) return null;
  const reader = i.routerMode === 'model' ? 'AI model' : i.routerMode === 'fallback' ? 'rules (the AI model was slow or unavailable)' : i.routerMode === 'form' ? 'your form (no reading needed)' : i.routerMode === 'offline' ? 'rules' : 'none needed';
  const readerLabel = i.vision ? 'AI model (it read your picture)' : reader;
  const wording = i.reasonsMode === 'model' ? 'AI model, every number checked' : i.reasonsMode === 'template' ? 'templates (the AI model was slow)' : 'templates';
  return {
    type: 'provenance',
    catalog: { used: catalogUsed, prices_as_of: ds.prices_as_of ?? null, verified: Number(ds.verified_variants ?? 0) > 0, live: false },
    dataset: { used: datasetUsed, opinions, machine_read: true, lenses, reviews_total: ds.reviews ?? null, dated: Number(ds.reviews_with_dates ?? 0) > 0 },
    live: { used: liveBlocks.length > 0, items: liveItems, statuses: liveStatuses, provider: i.liveProvider ?? null, fetched_at: liveBlocks.map((b) => b.fetched_at).filter(Boolean).sort().pop() ?? null },
    ai: { reader: readerLabel, wording, degraded: i.degraded ?? null },
    images: { used: imageSites.size > 0, sites: [...imageSites] },
    checks: { gate: i.gateRan }, affiliate: { links: !!i.affiliateLinks },
  };
}
