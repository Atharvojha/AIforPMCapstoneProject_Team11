// F07 Market pulse (no model) and F10 Brand insights. Counts only; no ranking of brands.
import type { Deps, Block, Row } from '../types.ts';
import { fmtInr, fmtDate } from '../util.ts';

export async function marketPulse(deps: Deps): Promise<{ blocks: Block[] }> {
  const t = await deps.tools.call<any>('trending', { days: 30 });
  const all = await deps.tools.call<{ rows: Row[] }>('find_variants', {});
  const byReviews = [...all.rows].sort((a, b) => b.review_count - a.review_count).slice(0, 5);
  const blocks: Block[] = [];
  blocks.push({ type: 'market_pulse', window_days: t.days,
    most_reviewed: byReviews.map((r) => ({ variant_id: r.variant_id, name: r.display_name, reviews: r.review_count, price_text: r.price_inr ? fmtInr(r.price_inr) : null, as_of: fmtDate(r.price_as_of) })),
    most_viewed: t.most_viewed, requests_by_budget: t.requests_by_budget, price_drops: t.price_drops, total_requests: t.total_requests,
    notes: [ 'Most reviewed counts reviews in the recorded dataset, not sales.',
      t.total_requests ? `${t.total_requests} requests in the last ${t.days} days.` : 'No requests recorded in the last 30 days yet, so there is no demand trend to show.',
      t.price_drops.length ? '' : 'Each laptop has a single price on file so far, so I cannot show price drops.'].filter(Boolean) });
  return { blocks };
}

export async function brandInsights(deps: Deps, brand: string | null): Promise<{ blocks: Block[] }> {
  const r = await deps.tools.call<any>('brand_stats', { brand: brand ?? '' });
  if (!r.brands.length) return { blocks: [{ type: 'text', text: brand ? `I have no ${brand} laptops in the catalog.` : 'No brand data is available.' }] };
  return { blocks: [{ type: 'brand_insights', min_n: r.min_n, label: r.label,
    brands: r.brands.map((b: any) => ({ ...b, enough: b.n >= r.min_n, opinion_text: b.n >= r.min_n ? `${b.positive} of ${b.n} owner opinions are positive.` : `Not enough owner evidence yet (n = ${b.n}; we need at least ${r.min_n}).` })),
    note: 'Counts by brand across the laptops in this catalog. Small catalogs say little about a whole brand, and I do not rank brands.' }] };
}
