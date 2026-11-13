import { useEffect, useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { BudgetSlider } from '../components/viz/BudgetSlider';
import { PriceMap, brandColor } from '../components/viz/PriceMap';
import { useCatalog } from '../state/useCatalog';
import { budgetLabel } from '../components/viz/BudgetSlider';
import { fmtWait } from '../lib/wait';
import { MarketActions } from './MarketScreen';

type Seg = 'map' | 'list' | 'market';
const SEGS: [Seg, string][] = [['map', 'Map'], ['list', 'List'], ['market', 'Market']];

/** The laptop map: see every laptop at once, drag a budget, hide brands, tap to pick, then compare. */
export function ExploreScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {}); const { rows, status, load } = useCatalog(); useEffect(load, [load]);
  const [budget, setBudget] = useState(60000); const [hidden, setHidden] = useState<Set<string>>(new Set()); const [seg, setSeg] = useState<Seg>('map');
  const data = rows.filter((r) => r.recommendable && r.price_inr != null); const brands = [...new Set(data.map((r) => r.brand))].sort();
  const toggleBrand = (b: string) => setHidden((h) => { const n = new Set(h); n.has(b) ? n.delete(b) : n.add(b); return n; });
  const pickMsg = compare.ids.length === 0 ? 'Tap dots to pick two to four laptops' : compare.ids.length === 1 ? 'Pick one more to compare' : `${compare.ids.length} picked`;
  const busy = thread.busy || thread.cooldown > 0;
  const fits = () => thread.sendNeeds({ budget_max_inr: budget, budget_min_inr: null, musts: hidden.size ? [{ attribute: 'brand', operator: 'not_in', value: [...hidden].map((b) => b.toLowerCase()) }] : [], shoulds: [], nices: [], use_cases: [] }, `What fits ${budgetLabel(budget)}`);
  const sorted = [...data].sort((a, b) => (a.price_inr as number) - (b.price_inr as number)).filter((r) => !hidden.has(r.brand));
  return (
    <section className="page-enter explore" aria-labelledby="exp-h">
      <h2 id="exp-h">The laptop map</h2>
      <div className="seg exp-seg" role="tablist" aria-label="Map, list or market">{SEGS.map(([k, l]) => <button key={k} role="tab" aria-selected={seg === k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>{l}</button>)}</div>
      {seg !== 'market' && <>
        <BudgetSlider value={budget} onChange={setBudget} prices={data.map((r) => r.price_inr as number)} />
        {status === 'ready' && data.length === 0 && <p className="empty-state" role="status"><span aria-hidden="true">🗺️</span> No laptops with a recorded price yet, so there is nothing to plot.</p>}
        {status === 'loading' && <p className="muted">Loading the laptops…</p>}
        {status === 'error' && <p className="error">I could not load the laptops. Check your connection and reload.</p>}
        <div className="legend-chips brand-scroll" role="group" aria-label="Show or hide brands">{brands.map((b) => <button type="button" key={b} className={`brand-chip ${hidden.has(b) ? 'off' : ''}`} aria-pressed={!hidden.has(b)} onClick={() => toggleBrand(b)}><i style={{ background: brandColor(brands, b) }} />{b}</button>)}</div>
        {seg === 'map' && <PriceMap rows={rows} budget={budget} hidden={hidden} picks={compare.ids} onToggle={compare.toggle} />}
        {seg === 'list' && <ul className="map-list">{sorted.map((r) => (
          <li key={r.variant_id}><label><input type="checkbox" checked={compare.has(r.variant_id)} onChange={() => compare.toggle(r.variant_id, r.name)} /> <span className="row-name"><strong>{r.name.split(' · ')[0]}</strong><span className="muted small">{r.name.split(' · ')[1]}</span></span> <span className={`row-price ${(r.price_inr as number) > budget ? 'over' : ''}`}>₹{(r.price_inr as number).toLocaleString('en-IN')}</span></label></li>))}</ul>}
        <div className="map-actions">
          <p className="pick-msg" aria-live="polite">{pickMsg}{compare.ids.length > 0 && <> <button className="link" onClick={compare.clear}>Clear picks</button></>}</p>
          <button className="btn" disabled={compare.ids.length < 2 || busy} onClick={() => thread.action({ action: 'compare', variant_ids: compare.ids }, `Compare ${compare.ids.length} laptops`)}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : 'Compare'}</button>
          <button className="btn ghost" disabled={busy} onClick={fits}>Show what fits {budgetLabel(budget)}</button>
        </div>
      </>}
      {seg === 'market' && <MarketActions thread={thread} />}
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
