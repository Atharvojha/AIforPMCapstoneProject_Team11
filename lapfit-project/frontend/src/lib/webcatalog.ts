// The second tier: laptops read from live web pages into a table. Never verified; unknown stays unknown.
import type { CustomLaptop } from '../components/blocks/BoardLogic';
import type { Look } from './looks';
import { getSession, setSession } from './storage';

export interface WebSpecs { ram_gb?: number | null; storage_gb?: number | null; display_size?: number | null; weight_kg?: number | null; battery_wh?: number | null; cpu?: string | null; gpu?: string | null }
export interface WebMatch { pct: number; label: string; basis: string[] }
export interface WebRow { key: string; name: string; brand: string; price_inr: number | null; price_text: string | null; price_as_of: string | null; specs: WebSpecs; source: { url?: string; site?: string }; match?: WebMatch }
export const WEB_PAGE = 24;
export const WEB_SORTS: [string, string][] = [['match', 'Best match'], ['low', 'Price: low to high'], ['high', 'Price: high to low']];
const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v) && v > 0;

export const sortWeb = (rows: WebRow[], sort: string): WebRow[] => {
  const price = (r: WebRow, miss: number) => (num(r.price_inr) ? r.price_inr : miss);
  const out = [...rows];
  if (sort === 'low') out.sort((a, b) => price(a, Infinity) - price(b, Infinity));
  else if (sort === 'high') out.sort((a, b) => price(b, -1) - price(a, -1));
  else out.sort((a, b) => (b.match?.pct ?? -1) - (a.match?.pct ?? -1));   // stable: the same match keeps the order the server sent
  return out;
};

/** A date in the page-state form "2026-11-02" read as "2 Nov 2026"; anything else is shown as given. */
export const asOf = (d: string | null | undefined): string | null => { if (!d) return null; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d); if (!m) return d; return `${Number(m[3])} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}`; };

export const customOf = (r: Pick<WebRow, 'name' | 'price_inr' | 'specs'>): CustomLaptop => {
  const s = r.specs ?? {}; const c: CustomLaptop = { name: String(r.name).slice(0, 80) };
  if (num(r.price_inr)) c.price_inr = r.price_inr;
  for (const k of ['ram_gb', 'storage_gb', 'display_size', 'weight_kg', 'battery_wh'] as const) if (num(s[k])) c[k] = s[k] as number;
  if (typeof s.cpu === 'string' && s.cpu) c.cpu = s.cpu.slice(0, 60);
  return c;
};
/** The drawn portrait follows the parsed values; a missing value draws nothing. */
export const webLook = (r: WebRow): Look => ({ id: r.key, name: r.name, brand: r.brand, price: num(r.price_inr) ? r.price_inr : null, ram: num(r.specs?.ram_gb) ? r.specs.ram_gb! : null, screen: num(r.specs?.display_size) ? r.specs.display_size! : null, weight: num(r.specs?.weight_kg) ? r.specs.weight_kg! : null, battery: num(r.specs?.battery_wh) ? r.specs.battery_wh! : null, hz: null, gpu: /rtx|gtx|radeon rx|arc a/i.test(r.specs?.gpu ?? '') ? 'dedicated' : null });

/** "See all laptops from the web" from a result: the budget travels with the click. */
const KEY = 'lapfit.explore.web', EVT = 'lapfit:web-tier';
export const openWebTier = (budget: number | null) => { setSession(KEY, { budget }); try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } };
export const takeWebTier = (): { budget: number | null } | null => { const v = getSession<{ budget: number | null } | null>(KEY, null); if (v) setSession(KEY, null); return v; };
export const WEB_TIER_EVENT = EVT;
