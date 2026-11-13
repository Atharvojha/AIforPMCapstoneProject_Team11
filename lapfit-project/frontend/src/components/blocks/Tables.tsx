import { CopyButton } from '../CopyButton';
import { useCtx } from '../ctx';
import type { Block } from '../../lib/types';
import { CardView } from './Cards';
import { WebPanel } from './Evidence';

export { CompareBlock } from './BoardCompare';

export function TeamPlan({ b }: { b: Block }) {
  const rows = b.rows as any[]; const total = Number(b.total) || 1;
  return (
    <section className="team" aria-label="Team plan">
      <h3>One laptop per role</h3>
      <div className="share-bar" role="img" aria-label="Share of the total by role">{rows.filter((r) => r.pick).map((r, i) => <span key={r.line} className={`seg c${i % 5}`} style={{ width: `${(r.subtotal / total) * 100}%` }} title={`${r.role}: ₹${Number(r.subtotal).toLocaleString('en-IN')}`} />)}</div>
      <div className="table-wrap"><table>
        <thead><tr><th scope="col">Role</th><th scope="col">People</th><th scope="col">Budget each</th><th scope="col">Laptop</th><th scope="col">Subtotal</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.line}><th scope="row">{r.role}<br /><span className="muted small">{r.use}</span></th><td>{r.count}</td><td>{r.budget ? `₹${Number(r.budget).toLocaleString('en-IN')}` : 'any'}</td>
            <td>{r.pick ? <>{r.pick.name.split(' · ')[0]}<br /><span className="muted small">{r.pick.price_text} as of {r.pick.as_of_text}</span></> : <span className="muted">{r.note || 'No fit'}</span>}</td>
            <td>{r.pick ? `₹${Number(r.subtotal).toLocaleString('en-IN')}` : '–'}</td></tr>
        ))}</tbody>
        <tfoot><tr><th scope="row" colSpan={4}>Total for {b.laptops} laptop{b.laptops === 1 ? '' : 's'}</th><td><strong>{b.total_text}</strong></td></tr></tfoot>
      </table></div>
      {b.left_out > 0 && <p className="notice">{b.left_out} {b.left_out === 1 ? 'person has' : 'people have'} no laptop in this plan because nothing fits their budget.</p>}
      {b.note && <p className={b.over_budget ? 'error' : 'muted'}>{b.note}</p>}
      <p className="muted small">Totals are exact sums of price × people, computed by the server.</p>
    </section>
  );
}

const SRC: Record<string, string> = { rule: 'Rule', owners: 'Owners', web: 'Web' };
const httpsOnly = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u);

/** "How to get more": what else the seller can do. Each item says where it comes from; web items are links, live and not verified. */
function Boosters({ items }: { items: any[] }) {
  return (
    <div className="boosters"><h4>How to get more</h4>
      <ul className="booster-list">{items.map((x, i) => (
        <li key={i}><p><strong>{x.title}</strong> <span className={`src-tag ${x.source}`}>{SRC[x.source] ?? 'Rule'}</span>{x.gain_text && <span className="muted small"> · {x.gain_text}</span>}</p>
          {x.why && <p className="muted small">{x.why}</p>}
          {x.source === 'web' && Array.isArray(x.items) && x.items.filter((l: any) => httpsOnly(l.url)).length > 0 && <>
            <ul className="web-links">{x.items.filter((l: any) => httpsOnly(l.url)).map((l: any) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.site ?? new URL(l.url).hostname}</a>{l.snippet && <span className="muted small"> {String(l.snippet).slice(0, 140)}</span>}</li>)}</ul>
            <p className="muted small">Live, not verified.</p></>}
        </li>))}</ul></div>
  );
}

export function SellPlan({ b }: { b: Block }) {
  const ctx = useCtx(); const top = Number(b.new_price) || 1; const pct = (n: number) => `${Math.max(0, Math.min(100, (n / top) * 100))}%`;
  const hasRange = !!(b.range && b.range.low_text && b.range.high_text); const factors = (b.factors as any[] | undefined) ?? []; const unknown = (b.unknown as string[] | undefined) ?? [];
  const checklist = Array.isArray(b.checklist) ? (b.checklist as string[]) : []; const boosters = Array.isArray(b.boosters) ? (b.boosters as any[]) : [];
  return (
    <section className="sell" aria-label="Sell plan">
      <h3>Selling your {String(b.laptop).split(' · ')[0]}</h3>
      {hasRange ? <>
        <p className="range"><span className="muted small">A used laptop like this might sell for</span><br /><strong>{b.range.low_text} to {b.range.high_text}</strong></p>
        <div className="range-track" role="img" aria-label={`Between ${b.range.low_text} and ${b.range.high_text}, on a scale up to the new price ${b.new_price_text}`}>
          <span className="zone" style={{ left: pct(b.range.low), width: `calc(${pct(b.range.high)} - ${pct(b.range.low)})` }} />{b.list_at != null && <span className="pin" style={{ left: pct(b.list_at) }} title={`Suggested asking price ${b.list_at_text}`} />}
        </div>
        <div className="range-scale muted small"><span>₹0</span><span>New: {b.new_price_text}</span></div>
        <p>{b.new_price_text ? <>Price when new: {b.new_price_text} (as of {b.as_of}). </> : null}{b.list_at_text ? <>A sensible asking price: <strong>{b.list_at_text}</strong>.</> : null}</p>
      </> : <p className="notice" role="status">{b.needs_paid_price ? 'No price on file for this laptop, so there is no range yet. Tell me what you paid and I will work it out.' : 'No range could be worked out yet.'}</p>}
      {factors.length > 0 && <><h4>How this was worked out</h4>
        <ul className="factor-bars">{factors.map((f) => <li key={f.label}><span>{f.label}</span><span className="fbar" aria-hidden="true"><i style={{ width: `${Math.max(4, Math.min(100, f.factor * 100))}%` }} /></span><strong>×{f.factor}</strong></li>)}</ul></>}
      {unknown.length > 0 && <p className="notice">The range is wider because I do not know: {unknown.join(', ')}. <button className="link" onClick={() => ctx.goto('sell')}>Add details</button></p>}
      {boosters.length > 0 && <Boosters items={boosters} />}
      {checklist.length > 0 && <div className="sell-checklist"><h4>Before you list it</h4>
        <ul className="plain-list">{checklist.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <p className="inline"><CopyButton text={checklist.map((t) => `- ${t}`).join('\n')} label="Copy list" />{typeof b.copy_text === 'string' && b.copy_text && <CopyButton text={b.copy_text} label="Copy the whole plan" />}</p></div>}
      {checklist.length === 0 && typeof b.copy_text === 'string' && b.copy_text && <p className="inline"><CopyButton text={b.copy_text} label="Copy the whole plan" /></p>}
      {((b.fixes as any[]) ?? []).map((f) => <p key={f.fix} className={`fix ${f.worth_it ? 'good' : 'warn'}`}><strong>{f.fix}:</strong> costs about ₹{f.cost.toLocaleString('en-IN')}, adds about ₹{f.adds.toLocaleString('en-IN')}, net {f.net >= 0 ? '+' : '−'}₹{Math.abs(f.net).toLocaleString('en-IN')}. {f.worth_it ? 'Worth doing.' : 'Not worth doing.'} <span className="muted small">({f.cost_basis})</span></p>)}
      <ul className="muted small">{((b.disclaimers as string[]) ?? []).map((d) => <li key={d}>{d}</li>)}</ul>
    </section>
  );
}

export function MyLaptopsBlock({ b }: { b: Block }) {
  const ctx = useCtx();
  return (
    <section className="mine" aria-label="My laptops">
      <h3>Your laptops</h3>
      <ul className="list">{(b.items as any[]).map((it, i) => (
        <li key={i} className="mine-item">
          {!it.found ? <p>{it.input}: {it.note}</p> : <>
            <h4>{String(it.name).split(' · ')[0]}</h4>
            {it.warranty && <p><span className={`pill ${it.warranty.status}`}>{it.warranty.status === 'active' ? `Warranty ends ${it.warranty.ends_text}` : it.warranty.status === 'expired' ? `Warranty ended ${it.warranty.ends_text}` : 'Warranty unknown'}</span> {it.warranty.status === 'active' && `(${it.warranty.days_left} days left)`} <span className="muted small">{it.warranty.rule ?? it.warranty.note}</span></p>}
            {it.price_now_text && <p>Price now {it.price_now_text} <span className="muted small">as of {it.as_of}</span>{it.gap_text ? `. ${it.gap_text}` : ''}</p>}
            {it.resale && <p className="muted small">Sample resale range {it.resale.low_text} to {it.resale.high_text}. {it.resale.note}</p>}
            <p className="card-actions"><button className="btn small ghost" onClick={() => ctx.action({ action: 'owner_voice', variant_id: it.variant_id }, `What owners say about ${it.name}`)}>What owners say</button></p>
          </>}
        </li>
      ))}</ul>
      <p className="muted small">{b.note}</p>
    </section>
  );
}

export function MarketPulse({ b }: { b: Block }) {
  const ctx = useCtx(); const top = Math.max(1, ...(b.most_reviewed as any[]).map((m) => m.reviews));
  return (
    <section className="market" aria-label="Market pulse">
      <h3>Market pulse <span className="muted small">last {b.window_days} days</span></h3>
      <h4>Most reviewed laptops in the dataset</h4>
      <ul className="list">{(b.most_reviewed as any[]).map((m) => <li key={m.variant_id} className="bar-row"><button className="link" onClick={() => ctx.action({ action: 'owner_voice', variant_id: m.variant_id }, `What owners say about ${m.name}`)}>{m.name.split(' · ')[0]}</button> <span className="muted small">{m.reviews} reviews · {m.price_text} as of {m.as_of}</span><span className="hbar" aria-hidden="true"><i style={{ width: `${(m.reviews / top) * 100}%` }} /></span></li>)}</ul>
      {b.price_drops.length > 0 && <><h4>Price drops</h4><ul className="list">{(b.price_drops as any[]).map((p) => <li key={p.variant_id}>{p.name}: ₹{p.from_inr} → ₹{p.to_inr}</li>)}</ul></>}
      {b.requests_by_budget.length > 0 && <><h4>What people ask for</h4><ul className="list">{(b.requests_by_budget as any[]).map((r) => <li key={r.budget_band}>{r.budget_band}: {r.requests} requests</li>)}</ul></>}
      <ul className="muted small">{(b.notes as string[]).map((n) => <li key={n}>{n}</li>)}</ul>
      <WebPanel web={b.web} title="Across the Indian laptop market, from the web" />
    </section>
  );
}

export function BrandInsights({ b }: { b: Block }) {
  return (
    <section className="brands" aria-label="Brand insights">
      <h3>By brand</h3><p className="muted small">{b.note} Counts are {b.label}.</p>
      <div className="cards">{(b.brands as any[]).map((x) => {
        const tot = x.positive + x.negative || 1;
        return (
          <article className="card" key={x.brand}>
            <h4>{x.brand}</h4>
            <p>{x.laptops} laptop{x.laptops === 1 ? '' : 's'} in the catalog · ₹{Number(x.min_price).toLocaleString('en-IN')}{x.max_price !== x.min_price ? ` to ₹${Number(x.max_price).toLocaleString('en-IN')}` : ''}</p>
            {x.enough && <div className="bar" role="img" aria-label={`${x.positive} positive and ${x.negative} negative of ${x.n}`}><span className="pos" style={{ width: `${(x.positive / tot) * 100}%` }} /><span className="neg" style={{ width: `${(x.negative / tot) * 100}%` }} /></div>}
            <p className={x.enough ? '' : 'muted'}>{x.opinion_text}</p>
            {x.enough && x.top_complaints.length > 0 && <p className="small">Most common complaints: {x.top_complaints.map((c: any) => `${c.topic} (${c.n})`).join(', ')}.</p>}
          </article>
        );
      })}</div>
      <WebPanel web={b.web} title={b.brands.length === 1 ? `What the web says about ${b.brands[0].brand}` : 'What the web says about laptop brands'} />
    </section>
  );
}
export { CardView };
