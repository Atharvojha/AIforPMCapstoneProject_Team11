// WHERE TO BUY. Links to shops, with an affiliate tag where one is configured. Nothing here is read by ranking, filtering,
// the pre-send gate or the wording: a commission can never change what is shown or in what order (tested).
import { fmtInr, fmtDate } from '../util.ts';
import type { Deps, Block, Row, Settings } from '../types.ts';

export interface Retailer { id: string; name: string; search: string; tag_param: string | null; tag: string }
export interface BuyLink { id: string; name: string; url: string; affiliate: boolean }

const clean = (s: string) => s.replace(/[^\w\s.+-]/g, ' ').replace(/\s+/g, ' ').trim();
/** The search text for a laptop: brand and model name, without the version suffix. */
export const searchText = (r: Pick<Row, 'brand' | 'marketing_name' | 'display_name'>) => {
  const name = r.marketing_name || r.display_name.split(' · ')[0];
  return clean(name.toLowerCase().startsWith(String(r.brand).toLowerCase()) ? name : `${r.brand} ${name}`).slice(0, 120);   // the model name often already starts with the brand
};

export function buildLinks(retailers: Retailer[] | undefined, q: string): BuyLink[] {
  const out: BuyLink[] = [];
  for (const r of Array.isArray(retailers) ? retailers : []) {
    if (!r?.id || !r.name || typeof r.search !== 'string' || !/^https:\/\//.test(r.search)) continue;
    let url = r.search.replace('{q}', encodeURIComponent(q)); const tag = (r.tag ?? '').trim();
    const affiliate = !!(tag && r.tag_param);
    if (affiliate) url += `${url.includes('?') ? '&' : '?'}${encodeURIComponent(r.tag_param!)}=${encodeURIComponent(tag)}`;
    out.push({ id: r.id, name: r.name, url, affiliate });
  }
  return out;
}

export async function whereToBuy(deps: Deps, variantId: string): Promise<Block[]> {
  const v = await deps.tools.call<{ found: boolean; specs: Row }>('get_variant', { variant_id: variantId });
  if (!v.found) return [{ type: 'text', text: 'That laptop is not in the catalog.' }];
  const row = v.specs; const links = buildLinks(deps.settings.RETAILERS, searchText(row)); const aff = links.some((l) => l.affiliate);
  return [{
    type: 'where_to_buy', variant_id: row.variant_id, name: row.display_name, query: searchText(row), links,
    price_text: row.price_inr != null ? fmtInr(row.price_inr) : null, as_of_text: row.price_as_of ? fmtDate(row.price_as_of) : null,
    note: row.price_inr != null ? `The price at the shop can differ from my saved price (${fmtInr(row.price_inr)} as of ${fmtDate(row.price_as_of)}). Check it before you pay, and check that the exact version matches.` : 'Check the price and the exact version at the shop before you pay.',
    disclosure: aff ? String(deps.settings.AFFILIATE_DISCLOSURE ?? '') : null,
  }];
}

/** Records that someone opened a shop link. No identity: the visitor is a salted daily hash. Only known shops are counted. */
export async function logClick(deps: Deps, o: { variantId?: string; retailer: string; visitor?: string; from?: string }): Promise<boolean> {
  const r = (Array.isArray(deps.settings.RETAILERS) ? (deps.settings.RETAILERS as Retailer[]) : []).find((x) => x.id === o.retailer); if (!r) return false;
  await deps.tools.call('log_click', { variant_id: o.variantId, retailer: r.id, affiliate: !!((r.tag ?? '').trim() && r.tag_param), visitor: o.visitor, from_flow: o.from });
  return true;
}
