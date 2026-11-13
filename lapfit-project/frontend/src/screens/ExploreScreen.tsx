import { useEffect, useMemo, useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { ValueMap, picOf, rupees } from '../components/viz/PriceMap';
import { LaptopImage } from '../components/LaptopImage';
import { FilterBar } from '../components/FilterBar';
import { applyFilters, emptyFilters, explainZero, leftOutUnknown, removeDim, type Filters, type Row as R } from '../lib/explore';
import { useCatalog } from '../state/useCatalog';
import { budgetLabel } from '../components/viz/BudgetSlider';
import { fmtWait } from '../lib/wait';
import { differenceTags, fromCatalog } from '../lib/looks';
import { MarketActions } from './MarketScreen';

type Seg = 'board' | 'map' | 'market';
const SEGS: [Seg, string][] = [['board', 'Browse'], ['map', 'Value map'], ['market', 'Market']];
const SORTS: [string, string, string][] = [
  ['value', 'Most for the money', 'RAM and storage on record per rupee, best first.'], ['low', 'Price: low to high', 'Cheapest first.'], ['high', 'Price: high to low', 'Priciest first.'], ['ram', 'Most RAM', 'Most RAM first.'], ['light', 'Lightest', 'Lightest first; laptops with no recorded weight go last.'],
];
const valueScore = (r: R) => ((r.ram_gb ?? 0) / 8 + (r.storage_gb ?? 0) / 256) / ((r.price_inr as number) / 50000);
const sorters: Record<string, (a: R, b: R) => number> = {
  value: (a, b) => valueScore(b) - valueScore(a), low: (a, b) => (a.price_inr as number) - (b.price_inr as number), high: (a, b) => (b.price_inr as number) - (a.price_inr as number),
  ram: (a, b) => (b.ram_gb ?? 0) - (a.ram_gb ?? 0), light: (a, b) => (a.weight_kg ?? 99) - (b.weight_kg ?? 99),
};
const PAGE = 12;

/** Explore: browse every laptop in the catalog. Search, narrow with live-counted filters, sort, tick what you like. The value map and the market are two other views of the same list. Nothing is scored by a model. */
export function ExploreScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {}); const { rows, status, load } = useCatalog(); useEffect(load, [load]);
  const [seg, setSeg] = useState<Seg>('board'); const [f, setF] = useState<Filters>(emptyFilters()); const [sort, setSort] = useState('value'); const [shown, setShown] = useState(PAGE);
  const set = (n: Filters) => { setF(n); setShown(PAGE); };
  const data = useMemo(() => (rows as R[]).filter((r) => r.recommendable && r.price_inr != null), [rows]);
  const allBrands = useMemo(() => [...new Set(data.map((r) => r.brand))].sort(), [data]);
  const looks = useMemo(() => data.map(fromCatalog), [data]);
  const filtered = useMemo(() => applyFilters(data, f).sort(sorters[sort]), [data, f, sort]);
  const tagsFor = (r: R) => differenceTags(fromCatalog(r), looks, 3).map((t) => t.txt).slice(0, 3);
  const zero = status === 'ready' && data.length > 0 && filtered.length === 0 ? explainZero(data, f) : null;
  const left = useMemo(() => leftOutUnknown(data, f), [data, f]);
  const pickMsg = compare.ids.length === 0 ? 'Tick two to four laptops to compare them' : compare.ids.length === 1 ? 'Pick one more to compare' : `${compare.ids.length} picked`;
  const busy = thread.busy || thread.cooldown > 0; const q = f.q.trim();
  const fits = () => thread.sendNeeds({ budget_max_inr: f.budget, budget_min_inr: null, musts: f.brands.length && f.brands.length < allBrands.length ? [{ attribute: 'brand', operator: 'not_in', value: allBrands.filter((b) => !f.brands.includes(b)).map((b) => b.toLowerCase()) }] : [], shoulds: [], nices: [], use_cases: [] }, `What fits ${f.budget ? budgetLabel(f.budget) : 'my filters'}`);
  const sortNote = SORTS.find((s) => s[0] === sort)![2];
  return (
    <section className="page-enter explore" aria-labelledby="exp-h">
      <h2 id="exp-h">Browse every laptop I know</h2>
      <p className="muted exp-purpose">Filters narrow the list to laptops that fit you. Each option shows how many laptops it would leave, and an option with none is switched off.</p>
      <div className="seg exp-seg" role="tablist" aria-label="Browse, value map or market">{SEGS.map(([k, l]) => <button key={k} role="tab" aria-selected={seg === k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>{l}</button>)}</div>
      {seg !== 'market' && <>
        <form className="exp-search" role="search" onSubmit={(e) => { e.preventDefault(); }}>
          <label htmlFor="ex-q" className="field-label">Search by name, brand or spec</label>
          <div className="exp-search-row"><input id="ex-q" type="search" value={f.q} placeholder="Try “Apple”, “16 GB” or “Zenbook”" autoComplete="off" onChange={(e) => set({ ...f, q: e.target.value })} />
            <button type="button" className="btn ghost small" disabled={busy || q.length < 2} onClick={() => { void thread.action({ action: 'web_search_laptops', query: q }, `Search the web for “${q}”`); }}>Search the web too</button></div>
          <p className="muted small">The web search finds laptops outside my catalog. Those are labelled as not verified.</p>
        </form>
        <FilterBar rows={data} f={f} set={set} total={data.length} shown={filtered.length} />
        {left.map((u) => <p key={u.dim} className="muted small exp-unknown" role="note">{u.n} laptop{u.n === 1 ? ' has' : 's have'} no recorded {u.what}, so {u.n === 1 ? 'it is' : 'they are'} left out. <button type="button" className="link" onClick={() => set({ ...f, unk: [...f.unk, u.dim] })}>Include {u.n === 1 ? 'it' : 'them'}</button></p>)}
        {f.unk.length > 0 && <p className="muted small exp-unknown" role="note">Showing laptops with no recorded {f.unk.map((d) => ({ weight: 'weight', screen: 'screen size', ram: 'RAM', storage: 'storage', gpu: 'graphics', price: 'price', brand: 'brand', search: 'search' })[d]).join(' or ')} as well. <button type="button" className="link" onClick={() => set({ ...f, unk: [] })}>Leave them out</button></p>}
        {status === 'loading' && <p className="muted">Loading the laptops…</p>}
        {status === 'error' && <p className="error">I could not load the laptops. Check your connection and reload.</p>}
        {status === 'ready' && data.length === 0 && <p className="empty-state" role="status">No laptops with a recorded price yet, so there is nothing to show.</p>}
        {zero && <div className="empty-state exp-zero" role="status"><p><strong>{zero.text}</strong>{zero.dim ? <> {zero.fix} to see {zero.count}.</> : null}</p>
          <button type="button" className="btn small" onClick={() => set(zero.dim ? removeDim(f, zero.dim) : emptyFilters())}>{zero.fix}</button></div>}
        {seg === 'board' && <>
          <div className="board-bar"><div className="sort-wrap"><label htmlFor="ex-sort">Sort</label><select id="ex-sort" value={sort} onChange={(e) => { setSort(e.target.value); setShown(PAGE); }}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div><p className="muted small sort-note">{sortNote}</p></div>
          <ul className="board-grid">{filtered.slice(0, shown).map((r) => { const nm = r.name.split(' · ')[0]; const tags = tagsFor(r); const on = compare.has(r.variant_id); return (
            <li key={r.variant_id} className={`bcard ${on ? 'sel' : ''}`}>
              <div className="bcard-pic"><LaptopImage pic={picOf(r)} brand={r.brand} name={nm} screen={r.display_size} weight={r.weight_kg} caption={false} /></div>
              <div className="bcard-body"><h3>{nm}</h3><p className="bprice">{rupees(r.price_inr as number)} <span className="muted small">· {r.ram_gb ?? '?'} GB RAM · {r.storage_gb ?? '?'} GB</span></p>
                <p className="muted small">{r.weight_kg != null ? `${r.weight_kg} kg` : 'weight not recorded'}{r.display_size != null ? ` · ${r.display_size} in` : ''}</p>
                {tags.length > 0 && <p className="tagrow">{tags.slice(0, 3).map((t) => <span className="tag" key={t}>{t}</span>)}</p>}
                <label className="pick"><input type="checkbox" checked={on} aria-label={`Compare ${nm}`} onChange={() => compare.toggle(r.variant_id, r.name)} /> Compare</label></div>
            </li>); })}</ul>
          {filtered.length > shown && <button type="button" className="btn ghost" onClick={() => setShown(shown + PAGE)}>Show more ({filtered.length - shown} left)</button>}
        </>}
        {seg === 'map' && <ValueMap rows={filtered} picks={compare.ids} onToggle={compare.toggle} tags={tagsFor} />}
        <div className="map-actions">
          <p className="pick-msg" aria-live="polite">{pickMsg}{compare.ids.length > 0 && <> <button className="link" onClick={compare.clear}>Clear picks</button></>}</p>
          <button className="btn" disabled={compare.ids.length < 2 || busy} onClick={() => thread.action({ action: 'compare', variant_ids: compare.ids }, `Compare ${compare.ids.length} laptops`)}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : 'Compare'}</button>
          <button className="btn ghost" disabled={busy || (f.budget == null && !f.brands.length)} onClick={fits}>Show what fits{f.budget ? ` ${budgetLabel(f.budget)}` : ''}</button>
        </div>
      </>}
      {seg === 'market' && <MarketActions thread={thread} />}
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
