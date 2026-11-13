import type { Block } from '../../lib/types';
import { useCtx } from '../ctx';
import { storage, type CustomLaptop } from './BoardLogic';
import { rememberCustom } from './BoardCompare';

interface Item { name: string; price_inr?: number | null; price_text?: string | null; specs?: Record<string, unknown>; why?: string; source?: { url?: string; site?: string; published?: string } }
const STATUS: Record<string, string> = {
  off: 'Live web search is switched off, so I am only showing my own catalog.', limit: 'Live web search is paused for today to stay within its budget. My own catalog is still here.',
  error: 'The live web search did not work just now. Nothing is shown from the web, and I will not guess.', empty: 'The live web had nothing I could read for that. Nothing is shown, and I will not guess.',
};
const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
/** Web links open only when they are https. Anything else is shown as plain text. */
export const safeUrl = (u: unknown): string | null => (typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u) ? u : null);

/** Laptops read from the live web, outside my catalog. Everything is labelled "not verified"; the price is the page's own words; a spec that was not found stays "?". */
export function WebPicks({ b }: { b: Block }) {
  const ctx = useCtx(); const status = String(b.status ?? 'ok'); const items = (Array.isArray(b.items) ? b.items : []) as Item[]; const picked = ctx.compare.ids.slice(0, 3);
  const shown = (status === 'ok' || status === 'cached') ? items : [];
  const compare = (it: Item) => {
    const s = it.specs ?? {}; const c: CustomLaptop = { name: String(it.name).slice(0, 80) };
    if (num(it.price_inr)) c.price_inr = it.price_inr; for (const k of ['ram_gb', 'storage_gb', 'display_size', 'weight_kg'] as const) if (num(s[k])) c[k] = s[k] as number;
    if (typeof s.cpu === 'string') c.cpu = s.cpu.slice(0, 60);
    rememberCustom(c); void ctx.action({ action: 'compare', variant_ids: picked, custom: [c] }, `Compare with ${c.name}`);
  };
  return (
    <section className="web-picks" aria-label="More from the live web">
      <h3>More from the live web <span className="muted">(not in my catalog, not verified)</span></h3>
      {b.query ? <p className="muted small">You searched for “{String(b.query)}”.{b.note ? ` ${b.note}` : ''}</p> : b.note ? <p className="muted small">{String(b.note)}</p> : null}
      {STATUS[status] && shown.length === 0 && <p className="wl-status" role="status">{STATUS[status]}</p>}
      {(status === 'ok' || status === 'cached') && shown.length === 0 && <p className="wl-status" role="status">{STATUS.empty}</p>}
      {b.budget_note ? <p className="muted small" role="note">{String(b.budget_note)}</p> : null}
      {shown.length > 0 && <ul className="wp-list">{shown.map((it, i) => { const s = it.specs ?? {}; const url = safeUrl(it.source?.url); const site = it.source?.site ?? (url ? new URL(url).hostname : null);
        const price = it.price_text ? `${it.price_text} (as stated by the page)` : num(it.price_inr) ? `₹${Math.round(it.price_inr).toLocaleString('en-IN')} (as stated by the page)` : 'price not stated';
        return (
          <li key={`${it.name}-${i}`} className="wp-card">
            <h4>{it.name}</h4>
            <p className="wp-price">{price}</p>
            <p className="muted small wp-specs">{num(s.ram_gb) ? `${s.ram_gb} GB` : '?'} RAM · {num(s.storage_gb) ? storage(s.storage_gb) : '?'} storage · {num(s.display_size) ? `${s.display_size}″` : '?'} screen · {num(s.weight_kg) ? `${s.weight_kg} kg` : '? kg'} · {typeof s.cpu === 'string' && s.cpu ? s.cpu : 'processor ?'}</p>
            {it.why && <p className="wp-why">{it.why}</p>}
            <p className="small wp-source">{url ? <>Source: <a href={url} target="_blank" rel="noopener noreferrer">{site}<span className="sr-only"> (opens in a new tab)</span></a></> : site ? <>Source: {site}</> : null}{it.source?.published ? <span className="muted"> · {it.source.published}</span> : null}</p>
            <div className="wl-actions"><button type="button" className="btn small ghost" disabled={ctx.busy || picked.length === 0} onClick={() => compare(it)}>Compare with it</button>{picked.length === 0 && <span className="muted small">Pick a catalog laptop first.</span>}</div>
          </li>); })}</ul>}
      {shown.length > 0 && <p className="muted small">{String(b.fields_note ?? 'Read from web pages by an AI model and checked against their text. Not verified, may be wrong.')} A “?” means the page did not say.</p>}
    </section>
  );
}
