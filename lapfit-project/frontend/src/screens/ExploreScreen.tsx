import { useEffect, useMemo, useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { ValueMap, picOf, rupees } from '../components/viz/PriceMap';
import { LaptopImage } from '../components/LaptopImage';
import { NumberField } from '../components/NumberField';
import { useCatalog } from '../state/useCatalog';
import { budgetLabel } from '../components/viz/BudgetSlider';
import { fmtWait } from '../lib/wait';
import { differenceTags, fromCatalog } from '../lib/looks';
import { getJson, setJson } from '../lib/storage';
import { MarketActions } from './MarketScreen';

type Seg = 'board' | 'map' | 'market';
const SEGS: [Seg, string][] = [['board', 'Browse'], ['map', 'Value map'], ['market', 'Market']];
type R = ReturnType<typeof useCatalog>['rows'][number] & Record<string, any>;
const QUICK = [30000, 50000, 80000, 120000];
const NEEDS: [string, string, (r: R) => boolean][] = [
  ['light', 'Light to carry (under 1.5 kg)', (r) => r.weight_kg != null && r.weight_kg < 1.5], ['gpu', 'Dedicated graphics', (r) => r.gpu_class === 'dedicated'],
  ['ram', '16 GB RAM or more', (r) => (r.ram_gb ?? 0) >= 16], ['storage', '512 GB storage or more', (r) => (r.storage_gb ?? 0) >= 512],
];
const SIZES: [string, string, (r: R) => boolean][] = [['s', 'Under 14 in', (r) => r.display_size != null && r.display_size < 14], ['m', '14 in', (r) => r.display_size != null && r.display_size >= 14 && r.display_size < 15], ['l', '15 in or bigger', (r) => r.display_size != null && r.display_size >= 15]];
const SORTS: [string, string, string][] = [
  ['value', 'Most for the money', 'RAM and storage on record per rupee, best first.'], ['low', 'Price: low to high', 'Cheapest first.'], ['high', 'Price: high to low', 'Priciest first.'], ['ram', 'Most RAM', 'Most RAM first.'], ['light', 'Lightest', 'Lightest first; laptops with no recorded weight go last.'],
];
const valueScore = (r: R) => ((r.ram_gb ?? 0) / 8 + (r.storage_gb ?? 0) / 256) / ((r.price_inr as number) / 50000);
const sorters: Record<string, (a: R, b: R) => number> = {
  value: (a, b) => valueScore(b) - valueScore(a), low: (a, b) => (a.price_inr as number) - (b.price_inr as number), high: (a, b) => (b.price_inr as number) - (a.price_inr as number),
  ram: (a, b) => (b.ram_gb ?? 0) - (a.ram_gb ?? 0), light: (a, b) => (a.weight_kg ?? 99) - (b.weight_kg ?? 99),
};
const PAGE = 12; const PREF = 'lapfit.explore.v1';

/** Explore: a board you can filter and sort (default), a plain-language value map, and the market. Everything comes from the catalog list; nothing is scored by a model. */
export function ExploreScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {}); const { rows, status, load } = useCatalog(); useEffect(load, [load]);
  const [seg, setSeg] = useState<Seg>('board'); const [budget, setBudget] = useState<number | null>(null); const [brands, setBrands] = useState<Set<string>>(new Set()); const [needs, setNeeds] = useState<Set<string>>(new Set()); const [sizes, setSizes] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState('value'); const [shown, setShown] = useState(PAGE); const [noteGone, setNoteGone] = useState(() => !!getJson<{ note?: boolean }>(PREF, {}).note);
  const data = useMemo(() => (rows as R[]).filter((r) => r.recommendable && r.price_inr != null), [rows]);
  const allBrands = useMemo(() => [...new Set(data.map((r) => r.brand))].sort(), [data]);
  const looks = useMemo(() => data.map(fromCatalog), [data]);
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, k: string) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); setter(n); setShown(PAGE); };
  const filtered = useMemo(() => data.filter((r) => (budget == null || (r.price_inr as number) <= budget) && (!brands.size || brands.has(r.brand))
    && NEEDS.every(([k, , f]) => !needs.has(k) || f(r)) && (!sizes.size || SIZES.some(([k, , f]) => sizes.has(k) && f(r)))).sort(sorters[sort]), [data, budget, brands, needs, sizes, sort]);
  const tagsFor = (r: R) => differenceTags(fromCatalog(r), looks, 3).map((t) => t.txt).slice(0, 3);
  const nFilters = (budget != null ? 1 : 0) + brands.size + needs.size + sizes.size;
  const clearAll = () => { setBudget(null); setBrands(new Set()); setNeeds(new Set()); setSizes(new Set()); setShown(PAGE); };
  const pickMsg = compare.ids.length === 0 ? 'Tick two to four laptops to compare them' : compare.ids.length === 1 ? 'Pick one more to compare' : `${compare.ids.length} picked`;
  const busy = thread.busy || thread.cooldown > 0;
  const fits = () => thread.sendNeeds({ budget_max_inr: budget, budget_min_inr: null, musts: brands.size && brands.size < allBrands.length ? [{ attribute: 'brand', operator: 'not_in', value: allBrands.filter((b) => !brands.has(b)).map((b) => b.toLowerCase()) }] : [], shoulds: [], nices: [], use_cases: [] }, `What fits ${budget ? budgetLabel(budget) : 'my filters'}`);
  const sortNote = SORTS.find((s) => s[0] === sort)![2];
  return (
    <section className="page-enter explore" aria-labelledby="exp-h">
      <h2 id="exp-h">Explore laptops</h2>
      <div className="seg exp-seg" role="tablist" aria-label="Browse, value map or market">{SEGS.map(([k, l]) => <button key={k} role="tab" aria-selected={seg === k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>{l}</button>)}</div>
      {seg !== 'market' && <>
        {!noteGone && <div className="notice change-note" role="note"><p><strong>What changed.</strong> The old dot chart was hard to read, so Explore now opens as a board: filter, sort, and tick what you like. The “Value map” tab still shows every laptop at once, with plain labels instead of axes.</p><button type="button" className="link" onClick={() => { setNoteGone(true); setJson(PREF, { note: true }); }}>Got it</button></div>}
        <div className="filters" role="group" aria-label="Filters">
          <div className="filter-row"><NumberField id="ex-budget" label="Budget up to" unit="₹" value={budget} min={5000} max={1000000} step={5000} stepper={false} onChange={(v) => { setBudget(v); setShown(PAGE); }} hint={budget ? budgetLabel(budget) : 'Type a number, or tap one'} />
            <div className="chips" role="group" aria-label="Quick budgets">{QUICK.map((q) => <button type="button" key={q} className={`chip ${budget === q ? 'on' : ''}`} aria-pressed={budget === q} onClick={() => { setBudget(budget === q ? null : q); setShown(PAGE); }}>{budgetLabel(q)}</button>)}</div></div>
          <fieldset className="chip-group"><legend>Brand</legend><div className="chips brand-scroll">{allBrands.map((b) => <button type="button" key={b} className={`chip ${brands.has(b) ? 'on' : ''}`} aria-pressed={brands.has(b)} onClick={() => toggle(brands, setBrands, b)}>{b}</button>)}</div></fieldset>
          <fieldset className="chip-group"><legend>It should have</legend><div className="chips">{NEEDS.map(([k, l]) => <button type="button" key={k} className={`chip ${needs.has(k) ? 'on' : ''}`} aria-pressed={needs.has(k)} onClick={() => toggle(needs, setNeeds, k)}>{l}</button>)}</div></fieldset>
          <fieldset className="chip-group"><legend>Screen size</legend><div className="chips">{SIZES.map(([k, l]) => <button type="button" key={k} className={`chip ${sizes.has(k) ? 'on' : ''}`} aria-pressed={sizes.has(k)} onClick={() => toggle(sizes, setSizes, k)}>{l}</button>)}</div></fieldset>
        </div>
        {status === 'loading' && <p className="muted">Loading the laptops…</p>}
        {status === 'error' && <p className="error">I could not load the laptops. Check your connection and reload.</p>}
        {status === 'ready' && data.length === 0 && <p className="empty-state" role="status">No laptops with a recorded price yet, so there is nothing to show.</p>}
        <div className="board-bar"><p className="muted small" aria-live="polite">{filtered.length} of {data.length} laptops{nFilters ? <> · <button type="button" className="link" onClick={clearAll}>Clear filters</button></> : null}</p>
          {seg === 'board' && <div className="sort-wrap"><label htmlFor="ex-sort">Sort</label><select id="ex-sort" value={sort} onChange={(e) => { setSort(e.target.value); setShown(PAGE); }}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>}</div>
        {seg === 'board' && <>
          <p className="muted small sort-note">{sortNote}</p>
          {filtered.length === 0 && status === 'ready' && data.length > 0 && <p className="empty-state" role="status">Nothing matches all of those. <button type="button" className="link" onClick={clearAll}>Clear the filters</button></p>}
          <ul className="board-grid">{filtered.slice(0, shown).map((r) => { const nm = r.name.split(' · ')[0]; const tags = tagsFor(r); const on = compare.has(r.variant_id); return (
            <li key={r.variant_id} className={`bcard ${on ? 'sel' : ''}`}>
              <div className="bcard-pic"><LaptopImage pic={picOf(r)} brand={r.brand} name={nm} screen={r.display_size} weight={r.weight_kg} caption={false} /></div>
              <div className="bcard-body"><h3>{nm}</h3><p className="bprice">{rupees(r.price_inr as number)} <span className="muted small">· {r.ram_gb ?? '?'} GB RAM · {r.storage_gb ?? '?'} GB</span></p>
                {tags.length > 0 && <p className="tagrow">{tags.slice(0, 3).map((t) => <span className="tag" key={t}>{t}</span>)}</p>}
                <label className="pick"><input type="checkbox" checked={on} aria-label={`Compare ${nm}`} onChange={() => compare.toggle(r.variant_id, r.name)} /> Compare</label></div>
            </li>); })}</ul>
          {filtered.length > shown && <button type="button" className="btn ghost" onClick={() => setShown(shown + PAGE)}>Show more ({filtered.length - shown} left)</button>}
        </>}
        {seg === 'map' && <ValueMap rows={filtered} picks={compare.ids} onToggle={compare.toggle} tags={tagsFor} />}
        <div className="map-actions">
          <p className="pick-msg" aria-live="polite">{pickMsg}{compare.ids.length > 0 && <> <button className="link" onClick={compare.clear}>Clear picks</button></>}</p>
          <button className="btn" disabled={compare.ids.length < 2 || busy} onClick={() => thread.action({ action: 'compare', variant_ids: compare.ids }, `Compare ${compare.ids.length} laptops`)}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : 'Compare'}</button>
          <button className="btn ghost" disabled={busy || (budget == null && !brands.size)} onClick={fits}>Show what fits{budget ? ` ${budgetLabel(budget)}` : ''}</button>
        </div>
      </>}
      {seg === 'market' && <MarketActions thread={thread} />}
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
