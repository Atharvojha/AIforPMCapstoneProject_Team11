import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { EvidenceDrawer } from './EvidenceDrawer'
import type { Category } from '../types'

export function Bar({ pct, n, tone }: { pct: number | null; n: number; tone?: string }) {
  if (pct === null) return <span className="muted">{n > 0 ? `${n} owner${n === 1 ? '' : 's'} so far` : 'no owner wrote about this'}</span>
  return (
    <div className="barrow" title={`${pct}% of ${n} owners were happy`}>
      <div className="bar"><i className={tone} style={{ width: `${pct}%` }} /></div>
      <span className="mono">{pct}%<span className="muted"> · {n}</span></span>
    </div>
  )
}

/** Click a topic to read what owners actually wrote (exact sentences; each opens the full review). */
export function OwnerWords({ id, topic, label }: { id: string; topic: string; label: string }) {
  const q = useQuery({ queryKey: ['opinions', id, topic], queryFn: () => api.opinions(id, topic) })
  const [open, setOpen] = useState<string | null>(null)
  if (q.isLoading) return <div className="skel" style={{ width: '60%' }} />
  if (q.error || !q.data) return <p className="muted">Could not load what owners wrote.</p>
  const d = q.data
  const col = (title: string, rows: { review_id: string; quote: string }[], n: number) => (
    <div><span className="k">{title} ({n})</span>
      {rows.length === 0 ? <p className="muted">Nobody.</p> : rows.map(r => (
        <p key={r.review_id} style={{ margin: '6px 0' }}>“{r.quote}{r.quote.length >= 235 ? '…' : ''}” <button className="btn small" onClick={() => setOpen(r.review_id)}>Full review</button></p>))}</div>)
  return (
    <div className="sheet" style={{ background: 'var(--bg)' }}>
      <strong>What owners wrote about {label.toLowerCase()}</strong>
      <div className="grid2">{col('Happy', d.examples.positive, d.counts.positive)}{col('Unhappy', d.examples.negative, d.counts.negative)}</div>
      {d.counts.mixed > 0 && <p className="muted">{d.counts.mixed} owner{d.counts.mixed === 1 ? '' : 's'} had mixed feelings.</p>}
      {open && <EvidenceDrawer ids={[open]} index={0} setIndex={() => {}} onClose={() => setOpen(null)} title="What the owner wrote" />}
    </div>
  )
}

export function CategoryGrid({ cats, laptopId, top = 4 }: { cats: Category[]; laptopId?: string; top?: number }) {
  const [all, setAll] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const sorted = [...cats].sort((a, b) => b.weight - a.weight)
  const list = all ? sorted : sorted.slice(0, top)
  return (
    <div>
      <div className="catgrid">
        {list.map(c => (
          <div key={c.topic}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {laptopId && c.n > 0 ? <button className="linkbtn" aria-expanded={sel === c.topic} onClick={() => setSel(sel === c.topic ? null : c.topic)}>{c.label} ▾</button> : <span>{c.label}</span>}
              <span className={`chip ${c.tone}`}>{c.rating}</span></div>
            <Bar pct={c.happy_pct} n={c.n} tone={c.tone} />
          </div>))}
      </div>
      {laptopId && sel && <div style={{ marginTop: 10 }}><OwnerWords id={laptopId} topic={sel} label={cats.find(c => c.topic === sel)?.label ?? sel} /></div>}
      {cats.length > top && <button className="btn small" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? 'Show fewer topics' : `Show all ${cats.length} topics`}</button>}
    </div>
  )
}

export function MatchBreakdown({ cats, score }: { cats: Category[]; score: number | null }) {
  const rows = [...cats].filter(c => c.weight > 0).sort((a, b) => b.weight - a.weight)
  return (
    <details>
      <summary style={{ cursor: 'pointer' }} className="muted">How is the {score ?? '—'} worked out?</summary>
      <p className="muted" style={{ margin: '8px 0' }}>Each topic counts as much as it matters for what you told us. For each topic we use a cautious score (what we can be fairly sure of given how many owners wrote about it), so few reviews pull the score down. Topics with fewer than 3 owners are left out, and no score is shown if less than half of what matters to you has reviews.</p>
      <div className="tablewrap"><table><thead><tr><th>Topic</th><th>Matters to you</th><th>Owners</th><th>Happy / unhappy</th><th>Cautious score</th></tr></thead><tbody>
        {rows.map(c => <tr key={c.topic}><td>{c.label}</td><td>{Math.round(c.weight * 100)}%</td><td>{c.n}</td><td>{c.happy} / {c.unhappy}</td><td>{c.lb === null ? 'left out (fewer than 3 owners)' : `${c.lb}/100`}</td></tr>)}
      </tbody></table></div>
    </details>
  )
}

/** Topic-by-topic ratings for one laptop (all 10 topics; click one to read the owners' words). */
export function LaptopRatings({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['ratings', id], queryFn: () => api.ratings(id) })
  if (q.isLoading) return <div className="skel" />
  if (!q.data) return null
  return (
    <div className="sheet"><h2>What owners say, topic by topic</h2>
      <p className="muted">The share of owners who were happy about each topic, and how many owners wrote about it. Click a topic to read their words.</p>
      <CategoryGrid cats={q.data.categories} laptopId={id} top={10} /></div>
  )
}
