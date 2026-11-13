import { useCallback, useEffect, useRef, useState } from 'react';
import { sendQuery } from '../lib/api';
import { useApiConfig } from './api-context';
import { NumberField } from './NumberField';
import { budgetLabel } from './viz/BudgetSlider';
import { SpecPortrait } from './viz/SpecPortrait';
import { MatchPill } from './blocks/BoardHero';
import { safeUrl } from './blocks/WebPicks';
import { storage } from './blocks/BoardLogic';
import { WEB_PAGE, WEB_SORTS, asOf, sortWeb, webLook, type WebRow } from '../lib/webcatalog';
import { QUICK_PRICES } from '../lib/explore';

export interface WebQuery { brand: string | null; q: string; budget: number | null }
export interface WebState { rows: WebRow[]; total: number | null; status: 'loading' | 'ready' | 'error'; more: boolean; brands: string[]; note: string; loadMore(): void }

/** The rows of the web table, fetched with no model on the server. A change of brand, budget or words starts again at the first page; "Show more" asks for the next page by offset. */
export function useWebCatalog({ brand, q, budget }: WebQuery): WebState {
  const cfg = useApiConfig(); const [rows, setRows] = useState<WebRow[]>([]); const [total, setTotal] = useState<number | null>(null); const [status, setStatus] = useState<WebState['status']>('loading');
  const [more, setMore] = useState(false); const [brands, setBrands] = useState<string[]>([]); const [note, setNote] = useState(''); const gen = useRef(0); const seen = useRef(0);
  const ask = useCallback(async (offset: number, g: number) => {
    if (!cfg) { setStatus('error'); return; }
    const body: Record<string, unknown> = { action: 'web_catalog', offset, limit: WEB_PAGE }; if (brand) body.brand = brand; if (q.trim().length > 0) body.q = q.trim(); if (budget != null) body.budget_max_inr = budget;
    const r = await sendQuery(cfg, body); if (g !== gen.current) return;
    const b = r.ok ? r.reply.blocks.find((x) => x.type === 'web_catalog') : null;
    if (!b) { setStatus('error'); setMore(false); return; }
    const got = (Array.isArray(b.rows) ? b.rows : []) as WebRow[]; setTotal(typeof b.total === 'number' ? b.total : got.length); setNote(typeof b.note === 'string' ? b.note : '');
    setRows((old) => (offset === 0 ? got : [...old, ...got.filter((x) => !old.some((o) => o.key === x.key))])); seen.current = offset + got.length;
    setBrands((old) => [...new Set([...old, ...got.map((x) => x.brand).filter(Boolean)])].sort()); setStatus('ready'); setMore(false);
  }, [cfg, brand, q, budget]);
  useEffect(() => { const g = ++gen.current; setStatus('loading'); const t = setTimeout(() => { void ask(0, g); }, q.trim() ? 300 : 0); return () => clearTimeout(t); }, [ask, q]);
  const loadMore = useCallback(() => { setMore(true); void ask(seen.current, gen.current); }, [ask]);
  return { rows, total, status, more, brands, note, loadMore };
}

export interface WebPick { key: string; name: string }
/** Tier two of Explore. Cards are never photos: a drawing from the parsed values. Everything is labelled "not verified". */
export function WebTier({ w, brand, setBrand, budget, setBudget, picked, onPick, full, busy }: {
  w: WebState; brand: string | null; setBrand(b: string | null): void; budget: number | null; setBudget(n: number | null): void; picked: string[]; onPick(r: WebRow): void; full: boolean; busy: boolean;
}) {
  const [sort, setSort] = useState('match'); const rows = sortWeb(w.rows, sort); const left = (w.total ?? 0) - w.rows.length;
  const sortNote = sort === 'match' ? 'Best fit first, among the laptops shown. Rows with no fit score go last.' : sort === 'low' ? 'Cheapest first, among the laptops shown. A laptop with no stated price goes last.' : 'Priciest first, among the laptops shown. A laptop with no stated price goes last.';
  return (
    <div className="web-tier">
      <div className="fb-row web-filter" role="group" aria-label="Brand from the web">
        {w.brands.map((b) => <button key={b} type="button" className={`chip opt ${brand === b ? 'on' : ''}`} aria-pressed={brand === b} onClick={() => setBrand(brand === b ? null : b)}><span>{b}</span></button>)}
      </div>
      <div className="web-budget">
        <NumberField id="web-budget" label="Up to (₹)" unit="₹" value={budget} min={5000} max={1000000} step={5000} stepper={false} onChange={setBudget} hint={budget ? budgetLabel(budget) : 'Type a number, or tap one'} />
        <div className="chips" role="group" aria-label="Quick price limits from the web">{QUICK_PRICES.map((q) => <button key={q} type="button" className={`chip opt ${budget === q ? 'on' : ''}`} aria-pressed={budget === q} onClick={() => setBudget(budget === q ? null : q)}><span>Up to {budgetLabel(q)}</span></button>)}</div>
      </div>
      <div className="board-bar"><div className="sort-wrap"><label htmlFor="web-sort">Sort</label><select id="web-sort" value={sort} onChange={(e) => setSort(e.target.value)}>{WEB_SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div><p className="muted small sort-note">{sortNote}</p></div>
      {w.status === 'loading' && w.rows.length === 0 && <p className="muted" role="status">Loading the laptops from the web…</p>}
      {w.status === 'error' && <p className="error" role="alert">I could not load the laptops from the web just now. Nothing is shown, and I will not guess.</p>}
      {w.status === 'ready' && w.rows.length === 0 && (w.total ?? 0) === 0 && (brand || budget != null
        ? <p className="empty-state" role="status">No laptop from the web fits these filters. Remove one to see more.</p>
        : <p className="empty-state" role="status">I have not collected laptops from the web yet. Use “Search the web too” above and the laptops I find will be kept here.</p>)}
      {w.rows.length > 0 && <>
        <p className="fb-count" role="status" aria-live="polite"><strong>Showing {w.rows.length} of {w.total ?? w.rows.length}</strong></p>
        {w.note && <p className="muted small">{w.note}</p>}
        <ul className="board-grid web-grid">{rows.map((r) => { const url = safeUrl(r.source?.url); const site = r.source?.site ?? (url ? new URL(url).hostname : null); const s = r.specs ?? {}; const on = picked.includes(r.key); const date = asOf(r.price_as_of);
          const price = typeof r.price_inr === 'number' ? (r.price_text || `₹${Math.round(r.price_inr).toLocaleString('en-IN')}`) : null; const nf = 'not stated on the page';
          return (
            <li key={r.key} className={`bcard web-card ${on ? 'sel' : ''}`}>
              <div className="bcard-pic"><SpecPortrait look={webLook(r)} /></div>
              <div className="bcard-body">
                <p className="web-tag"><span className="tag">From the web, not verified</span></p>
                <h3>{r.name}</h3>
                <p className="bprice">{price ?? <span className="muted">price not stated</span>}{price && <span className="muted small"> {date ? `· price as of ${date}` : '· date not stated'}</span>}</p>
                <ul className="wp-specs-list muted small" aria-label="Key specs">
                  <li>RAM: {typeof s.ram_gb === 'number' ? `${s.ram_gb} GB` : nf}</li><li>Storage: {typeof s.storage_gb === 'number' ? storage(s.storage_gb) : nf}</li>
                  <li>Screen: {typeof s.display_size === 'number' ? `${s.display_size}″` : nf}</li><li>Weight: {typeof s.weight_kg === 'number' ? `${s.weight_kg} kg` : nf}</li>
                </ul>
                {r.match && <MatchPill c={{ match: r.match } as any} />}
                <p className="small wp-source">{url ? <>Source: <a href={url} target="_blank" rel="noopener noreferrer">{site}<span className="sr-only"> (opens in a new tab)</span></a></> : site ? <>Source: {site}</> : null}</p>
                <label className="pick"><input type="checkbox" checked={on} disabled={busy || (!on && full)} aria-label={`Compare ${r.name}`} onChange={() => onPick(r)} /> Compare</label>
              </div>
            </li>); })}</ul>
        {left > 0 && <button type="button" className="btn ghost" disabled={w.more} onClick={w.loadMore}>{w.more ? 'Loading…' : `Show ${Math.min(WEB_PAGE, left)} more`}</button>}
      </>}
    </div>
  );
}
