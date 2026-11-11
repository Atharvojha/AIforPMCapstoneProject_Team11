import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { AdviceResponse, SearchResponse } from '../types'
import { ErrorState } from '../components/ui'
import { CategoryGrid, MatchBreakdown } from '../components/bits'
import { useCompare } from '../compare'
import { useProfile } from '../profile'
import { loadNeeds } from '../needsStore'

const KEY = 'lapfit.needs.text.v1'
const EXAMPLES = [
  'I am a CS student. Mostly coding, some video editing. Budget around 60k. I want it fast and light, with good battery.',
  'Gaming and streaming, under 80k. I do not want it to heat up.',
  'Just college work, YouTube and Zoom. Cheap and long battery, I carry it daily.',
]

export function Home() {
  const [text, setText] = useState(() => { try { return loadNeeds()?.text ?? localStorage.getItem(KEY) ?? '' } catch { return '' } })
  const [res, setRes] = useState<AdviceResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { setProfile } = useProfile()
  const cmp = useCompare()
  const [q, setQ] = useState('')
  const [found, setFound] = useState<SearchResponse | null>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const [usedSaved, setUsedSaved] = useState(false)
  useEffect(() => { if ((loc.state as { run?: boolean } | null)?.run && text.trim().length >= 3) go() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function go(e?: FormEvent) {
    e?.preventDefault()
    if (text.trim().length < 3) return
    setBusy(true); setErr(null)
    try {
      try { localStorage.setItem(KEY, text) } catch { /* not saved */ }
      const sv = loadNeeds(); const useSaved = !!sv && sv.text.trim() === text.trim()
      const r = await api.advice(text.trim(), useSaved ? sv!.overrides : undefined); setRes(r); setProfile(r.profile); setUsedSaved(useSaved)
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  async function find(e: FormEvent) { e.preventDefault(); if (q.trim()) { try { setFound(await api.search(q.trim())) } catch (x) { setErr((x as Error).message) } } }
  async function lookUp() { try { const r = await api.researchStart(q.trim()); nav(`/research/${r.job_id}`) } catch (x) { setErr((x as Error).message) } }

  return (
    <div className="page">
      <h1>Tell us what you need. We’ll find the laptop.</h1>
      <p className="muted" style={{ margin: 0 }}>Don’t know the numbers? <Link to="/needs">Build your needs sheet</Link>: every category, with a suggested number for each.</p>
      <form onSubmit={go} className="sheet">
        <label htmlFor="needs" className="muted">Write it like you would ask a friend: what you’ll use it for, your budget, what matters to you.</label>
        <textarea id="needs" className="big" value={text} onChange={e => setText(e.target.value)} placeholder="For example: I’m a student, I code and edit videos sometimes, budget 60k, want it light with good battery" />
        <div className="row"><button className="btn primary" type="submit" disabled={busy || text.trim().length < 3}>{busy ? 'Finding…' : 'Find my laptops'}</button>
          <span className="muted">Try:</span>{EXAMPLES.map((x, i) => <button key={i} type="button" className="btn small" onClick={() => setText(x)}>Example {i + 1}</button>)}</div>
      </form>
      {err && <ErrorState message={err} />}

      {res && <>
        {!res.reading.complete && <div className="banner info">We are still reading owner reviews ({res.reading.reviews_left.toLocaleString()} left). Ratings fill in as we go, and “Not enough reviews” means we have not got there yet.</div>}
        {usedSaved && <div className="banner info">Using your saved needs sheet (your levels, numbers and brands). <Link to="/needs">Edit it</Link></div>}
        <div className="sheet" aria-live="polite"><span className="k">What we understood</span>
          {res.needs.understood.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{res.needs.understood.map(u => <li key={u}>{u}</li>)}</ul>
            : <p>We could not pick out what you will use it for. Try adding words like coding, gaming, studies, video editing, or a budget.</p>}
          <p className="muted">Not right? Change your text above and press the button again.</p></div>

        <div className="sheet"><span className="k">What to look for (our suggestion)</span>
          <div className="tablewrap"><table><thead><tr><th>Look for</th><th>Aim for</th><th>Why</th></tr></thead><tbody>
            {res.recommended.map(r => <tr key={r.key}><td><strong>{r.label}</strong></td><td>{r.text}{r.you_asked ? <div className="muted">You asked for {r.you_asked}</div> : null}</td><td className="muted">{r.why}{r.sources.length > 0 ? <div>{r.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>{s.label}</a>)}</div> : <div>Rule of thumb, no source</div>}</td></tr>)}
          </tbody></table></div>
          <p className="muted">These are rules of thumb, not measurements. Where a vendor page states a number, the source is linked. They keep you from buying a laptop that struggles with what you do.</p></div>

        <h2>Laptops for you, best match first</h2>
        {res.laptops.map((l, i) => (
          <div key={l.id} className="sheet">
            <div className="row cardhead" style={{ justifyContent: 'space-between' }}>
              <div className="row" style={{ flexWrap: 'nowrap' }}><span className="rank">{i + 1}</span><div><strong>{l.name}</strong><div className="muted">{l.price_inr ? `₹${l.price_inr.toLocaleString('en-IN')}` : 'Price not known'} · {l.reviews} owner reviews</div></div></div>
              <div className="verdictbox"><span className={`chip ${l.tone}`}>{l.verdict}</span>{l.score !== null && <div className="muted" title="Based on what owners wrote, weighted by what matters to you">Owner-review match {l.score}/100</div>}</div>
            </div>
            <div className="pills">{l.checks.filter(c => c.status !== 'ok').map(c => <span key={c.label} className={`chip ${c.status === 'miss' ? (c.hard ? 'bad' : 'mix') : 'unk'}`} title={`${c.need}. This laptop: ${c.have}`}>{c.status === 'miss' ? '✕' : '?'} {c.label}: {c.have} (wanted: {c.need})</span>)}
              {l.warnings.map(w => <span key={w} className="chip mix">⚠ {w}</span>)}
              {l.checks.some(c => c.status === 'ok') && <span className="muted">✓ Meets: {l.checks.filter(c => c.status === 'ok').map(c => c.label).join(', ')}</span>}</div>
            <div className="specs">{l.specs.map(s => <div key={s.label}><b>{s.label}</b>{s.value}</div>)}</div>
            <CategoryGrid cats={l.categories} laptopId={l.id} />
            {l.score !== null && <MatchBreakdown cats={l.categories} score={l.score} />}
            <div className="row"><Link className="btn small primary" to={`/laptops/${l.id}`}>Full details and evidence</Link>
              <button className="btn small" aria-pressed={cmp.has(l.id)} onClick={() => cmp.toggle(l.id)}>{cmp.has(l.id) ? '✓ In compare' : 'Add to compare'}</button></div>
          </div>))}
        <p className="muted">{res.note} Bars show the share of owners who were happy about that topic, then how many owners wrote about it.</p>
      </>}

      <details className="sheet"><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Already know which laptop? Search by name</summary>
        <form onSubmit={find} className="row" style={{ marginTop: 10 }}><input aria-label="Laptop name" style={{ flex: 1, minWidth: 180 }} placeholder="For example: MacBook Air M1, or ASUS Zenbook 14 OLED" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn primary" type="submit">Search</button></form>
        {found && <div style={{ marginTop: 10 }}>
          {found.intent === 'out_of_scope' && <p>{found.message}</p>}
          {found.matches.map(m => <div key={m.variant_id} className="row" style={{ justifyContent: 'space-between', margin: '6px 0' }}><span>{m.display_name}</span><Link className="btn small" to={`/laptops/${m.variant_id}`}>Open</Link></div>)}
          {found.intent === 'laptop' && found.matches.length === 0 && <div className="banner info"><strong>We don’t have this laptop.</strong> {found.research_offer?.available
            ? <div style={{ marginTop: 6 }}>We can look it up on the maker’s official pages. It takes under a minute and has no owner reviews. <button className="btn small primary" onClick={lookUp}>Look it up online</button></div> : ' Online lookup is not switched on.'}</div>}
        </div>}
      </details>
    </div>
  )
}
