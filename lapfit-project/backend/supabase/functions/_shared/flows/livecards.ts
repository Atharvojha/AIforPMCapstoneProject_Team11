import { liveReviews } from '../live.ts';
import type { Deps, Row, Block } from '../types.ts';

/** One live-reviews block per laptop. Never throws; always says what happened. */
export async function liveFor(deps: Deps, rows: Row[], topic?: string): Promise<Block[]> {
  // laptops are fetched in parallel: each one is an independent web search
  return Promise.all(rows.map(async (r) => {
    const res = await liveReviews({ tools: deps.tools, source: deps.live ?? null, settings: deps.settings, variantId: r.variant_id, laptop: r.display_name.split(' · ')[0], topic });
    return { type: 'live_reviews', laptop: r.display_name, variant_id: r.variant_id, topic: topic ?? null, status: res.status, provider: res.provider, fetched_at: res.fetched_at, note: res.note, items: res.items } as Block;
  }));
}
