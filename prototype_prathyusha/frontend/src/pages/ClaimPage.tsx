import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { EvidenceDrawer } from '../components/EvidenceDrawer'
import { ErrorState, SourceTag, VariantBadge } from '../components/ui'
import { Bar } from '../components/bits'
import type { FreeClaim, Group, LaneItem, ModelRow, SubClaim, Verdict } from '../types'

const EXAMPLES = ['ASUS laptops are bad at holding battery', 'Which laptop has the best battery?', 'MacBook Air gets 12 hours of battery', 'HP laptops are heavy', 'Lenovo laptops have a poor screen']
const VERDICT: Record<Verdict, [string, string]> = {
  supported: ['ok', '✓ The evidence supports this'], contradicted: ['bad', '✕ The evidence says otherwise'], mixed: ['mix', '◐ Mixed: no clear answer'], insufficient: ['unk', '? Not enough evidence'],
}
const NOTE: Record<string, string> = { claimed_unverified: 'Only the maker says this. Nobody independent has tested it.', sibling_only: 'We only have information about a similar model, not this exact one.', 'manufacturer spec': 'This is the maker’s own specification.' }

function Chip({ v }: { v: Verdict }) { const [c, t] = VERDICT[v]; return <span className={`chip ${c}`}>{t}</span> }

function Item({ i, onOpen }: { i: LaneItem; onOpen?: (id: string) => void }) {
  const kind = i.kind === 'claim' ? 'claim' : i.kind
  return (
    <div className="sheet" style={{ padding: 10 }}>
      <div className="row"><SourceTag kind={kind} similar={!!i.variant_match && !['exact_listing', 'exact_family'].includes(i.variant_match)} />
        {i.validation && i.validation !== 'verified_on_page' && i.validation !== 'machine_validated' && <span className="tag">Not double-checked yet</span>}</div>
      <p>{i.kind === 'owner' ? `“${i.text}”` : i.text}</p>
      {i.review_id && onOpen && <button className="btn small" onClick={() => onOpen(i.review_id!)}>Read the full review</button>}
      {i.url && <a href={i.url} target="_blank" rel="noreferrer">Open source</a>}
    </div>
  )
}

function Lane({ title, items, empty, onOpen }: { title: string; items: LaneItem[]; empty: string; onOpen: (id: string) => void }) {
  return <div><span className="k">{title} ({items.length})</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>{items.length ? items.map((i, k) => <Item key={k} i={i} onOpen={onOpen} />) : <p className="muted">{empty}</p>}</div></div>
}

function Sub({ s, onOpen }: { s: SubClaim; onOpen: (id: string) => void }) {
  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: 'space-between' }}><h3>{s.text}</h3><Chip v={s.verdict} /></div>
      {s.note && NOTE[s.note] && <p className="muted">{NOTE[s.note]}</p>}
      {s.reason && <p>{s.reason}</p>}
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
        <Lane title="Supports it" items={s.lanes.for} empty="Nothing supports it." onOpen={onOpen} />
        <Lane title="Goes against it" items={s.lanes.against} empty="Nothing goes against it." onOpen={onOpen} />
        <Lane title="Doesn’t count here" items={s.lanes.not_applicable} empty="Nothing set aside." onOpen={onOpen} />
      </div>
      <p className="muted">We looked for evidence against this and found {s.counter.found}.</p>
      {s.doesnt_prove && <p className="muted"><strong>What this doesn’t prove:</strong> {s.doesnt_prove}</p>}
    </div>
  )
}

function Groups({ g }: { g: Group[] }) {
  return <div className="grid2">{g.map(x => <div key={x.label} className="sheet"><strong>{x.label}</strong>
    {x.value ? <div style={{ fontSize: 22 }}>{x.value}<span className="muted" style={{ fontSize: 13 }}> average · {x.models} models</span></div>
      : <><Bar pct={x.happy_pct ?? null} n={x.n ?? 0} tone={(x.happy_pct ?? 0) >= 75 ? 'ok' : (x.happy_pct ?? 0) >= 50 ? 'mix' : 'bad'} />
        <span className="muted">{(x.avg_models ?? x.models) === 1 ? 'One laptop' : `Average of ${x.avg_models ?? x.models} laptops`} · {x.happy} happy, {x.unhappy} unhappy, {x.mixed} mixed owners ({x.n} in total)</span></>}</div>)}</div>
}

function Models({ rows, title, topic }: { rows: ModelRow[]; title: string; topic?: string }) {
  return <div className="sheet"><span className="k">{title}</span><div className="tablewrap"><table><thead><tr><th>Laptop</th><th>Owners happy about {topic?.toLowerCase()}</th><th>Price</th></tr></thead><tbody>
    {rows.map(m => <tr key={m.id} style={m.in_scope ? { background: 'var(--unk-bg)' } : undefined}><td>{m.market === 'US' ? <span>{m.name}</span> : <Link to={`/laptops/${m.id}`}>{m.name}</Link>}<div className="muted">{m.brand}</div></td>
      <td style={{ minWidth: 200 }}><Bar pct={m.happy_pct} n={m.n} tone={(m.happy_pct ?? 0) >= 75 ? 'ok' : (m.happy_pct ?? 0) >= 50 ? 'mix' : 'bad'} /></td><td>{m.price_inr ? `₹${m.price_inr.toLocaleString('en-IN')}` : m.price_usd ? `$${m.price_usd.toLocaleString('en-US')}` : '—'}{m.market === 'US' && <div className="muted">US listing: evidence only</div>}</td></tr>)}
  </tbody></table></div></div>
}

export function ClaimPage() {
  const [text, setText] = useState('')
  const [res, setRes] = useState<FreeClaim | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<string | null>(null)

  async function run(e?: FormEvent) {
    e?.preventDefault()
    if (text.trim().length < 3) return
    setBusy(true); setErr(null)
    try { setRes(await api.claimFree(text.trim())) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const r = res?.result

  return (
    <div className="page">
      <h1>Is that true? Check any claim.</h1>
      <form onSubmit={run} className="sheet">
        <label className="muted" htmlFor="claim">Type what you heard or what you want to know. Name a brand, a model, or no laptop at all.</label>
        <input id="claim" style={{ fontSize: 16, padding: 12 }} value={text} onChange={e => setText(e.target.value)} placeholder="For example: ASUS laptops are bad at holding battery" />
        <div className="row"><button className="btn primary" type="submit" disabled={busy || text.trim().length < 3}>{busy ? 'Checking…' : 'Check it'}</button>
          {EXAMPLES.map(x => <button type="button" key={x} className="btn small" onClick={() => { setText(x) }}>{x}</button>)}</div>
      </form>
      {err && <ErrorState message={err} />}
      {res && <>
        <div className="sheet" aria-live="polite">
          <p className="muted">You asked: “{res.claim}”</p>
          {res.verdict && <div className="row"><Chip v={res.verdict} /></div>}
          {res.headline && <p style={{ fontSize: 17 }}>{res.headline}</p>}
          {res.mode_note && <p className="muted">{res.mode_note}</p>}
        </div>
        {res.mode === 'compare' && res.compare_ids && <div className="sheet"><Link className="btn primary" to={`/compare?ids=${res.compare_ids.join(',')}`}>Compare these {res.compare_ids.length} laptops</Link></div>}
        {res.mode === 'laptop' && r && <>
          <div className="sheet"><div className="row" style={{ justifyContent: 'space-between' }}><h2>{r.variant.display_name}</h2><VariantBadge match="exact_listing" /></div>
            <p>We understood your claim as: <strong>“{r.claim_understood_as}”</strong></p>
            {r.instruction_ignored && <div className="banner">Part of your text looked like instructions to the software, so we ignored it.</div>}
            {r.verdict && <div className="row"><Chip v={r.verdict} /><span className="muted">{r.what_we_could_check}</span></div>}
            {r.clarifier && <p className="muted">{r.clarifier}</p>}
            {!r.supported && r.message && <p>{r.message}</p>}</div>
          {r.subclaims.map((s, i) => <Sub key={i} s={s} onOpen={id => setDrawer(id)} />)}
          <p className="muted"><Link to={`/laptops/${r.variant.id}`}>Open the full report for this laptop</Link></p></>}
        {res.groups && <Groups g={res.groups} />}
        {res.word_hits && <div className="sheet"><span className="k">Owners who used the word “{res.word_hits.word}” ({res.word_hits.reviews} review{res.word_hits.reviews === 1 ? '' : 's'})</span>
          {res.word_hits.reviews === 0 ? <p className="muted">No owner of these laptops used that word.</p> : res.word_hits.examples.map(e => <div key={e.review_id}><p>“…{e.quote}…”</p><button className="btn small" onClick={() => setDrawer(e.review_id)}>Read the full review</button></div>)}</div>}
        {res.mode === 'numeric' && res.numeric_models && <div className="sheet"><span className="k">{res.attribute}, lowest first</span><div className="tablewrap"><table><tbody>
          {res.numeric_models.map(m => <tr key={m.id} style={m.in_scope ? { background: 'var(--unk-bg)' } : undefined}><td><Link to={`/laptops/${m.id}`}>{m.name}</Link></td><td>{m.value}</td></tr>)}</tbody></table></div></div>}
        {res.mode !== 'numeric' && res.models && res.models.length > 0 && <>
          {res.mode === 'generic' && res.best && res.best.length > 0 && <Models rows={res.best} title={`Best for ${res.topic_label?.toLowerCase()}`} topic={res.topic_label} />}
          {res.mode === 'generic' && res.worst && res.worst.length > 0 && <Models rows={res.worst} title={`Weakest for ${res.topic_label?.toLowerCase()}`} topic={res.topic_label} />}
          {res.mode !== 'generic' && <Models rows={res.models.filter(m => m.in_scope)} title={`Every ${res.scope} laptop, best first`} topic={res.topic_label} />}</>}
        {res.suggestions && res.suggestions.length > 0 && res.mode !== 'generic' && <Models rows={res.suggestions} title={res.suggestions_title ?? 'Suggestions'} topic={res.topic_label} />}
        {res.mode === 'generic' && res.brands && <div className="sheet"><span className="k">By brand</span><Groups g={res.brands} /></div>}
        {res.examples && (res.examples.happy.length > 0 || res.examples.unhappy.length > 0) && <div className="grid2">
          <div className="sheet"><span className="k">What happy owners wrote</span>{res.examples.happy.map(e => <div key={e.review_id}><p>“{e.quote}{e.quote.length >= 235 ? '…' : ''}”</p><button className="btn small" onClick={() => setDrawer(e.review_id)}>Read the full review</button></div>)}</div>
          <div className="sheet"><span className="k">What unhappy owners wrote</span>{res.examples.unhappy.map(e => <div key={e.review_id}><p>“{e.quote}{e.quote.length >= 235 ? '…' : ''}”</p><button className="btn small" onClick={() => setDrawer(e.review_id)}>Read the full review</button></div>)}</div></div>}
        {res.limits && <div className="sheet"><span className="k">Keep in mind</span><ul style={{ margin: 0, paddingLeft: 18 }}>{res.limits.map(l => <li key={l}>{l}</li>)}</ul></div>}
      </>}
      {drawer && <EvidenceDrawer ids={[drawer]} index={0} setIndex={() => {}} onClose={() => setDrawer(null)} title="What the owner wrote" />}
    </div>
  )
}
