import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { CATEGORY_NAMES, ErrorState, LabelChip, Skeleton, StatusChip } from '../components/ui'
import { useProfile, WORKLOADS } from '../profile'

export function ComparePage() {
  const [sp] = useSearchParams()
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean)
  const { profile, has } = useProfile()
  const q = useQuery({ queryKey: ['compare', ids, profile], queryFn: () => api.compare(ids, profile), enabled: ids.length >= 2 })
  const d = q.data

  if (ids.length < 2) return <div className="page"><h1>Compare laptops</h1><p>Pick at least two laptops using “Add to compare” on the laptop list, then come back here. <Link to="/">Find laptops</Link></p></div>
  if (q.isLoading) return <div className="page"><Skeleton lines={5} /></div>
  if (q.error || !d) return <div className="page"><ErrorState message={(q.error as Error)?.message ?? 'No data'} onRetry={() => q.refetch()} /></div>
  const cols = d.laptops
  const name = (id: string) => cols.find(c => c.id === id)?.display_name.split(' · ')[0] ?? id

  return (
    <div className="page">
      <Link to="/">← Back to laptops</Link>
      <h1>Comparing {cols.length} laptops</h1>
      <p className="muted">Same rows for every laptop. We never pick a winner: you decide. Where we know more about one laptop than another, we say so.</p>
      {!has && <div className="banner info">You haven’t set your needs, so must-haves and fit can’t be compared. <Link to="/">Describe what you need</Link></div>}
      {d.notes.map((n, i) => <div key={i} className="banner" role="note">{n}</div>)}

      <div className="tablewrap"><table>
        <thead><tr><th style={{ position: 'sticky', left: 0, background: 'var(--bg)' }}> </th>{cols.map(c => (
          <th key={c.id}><Link to={`/laptops/${c.id}`}>{c.display_name}</Link>
            <div className="muted" style={{ fontWeight: 400 }}>{c.owner_analysis.state === 'complete' ? 'Owner reviews read' : `Owner reviews: ${c.owner_analysis.processed} of ${c.owner_analysis.representatives} read`}</div></th>))}</tr></thead>
        <tbody>
          <tr><th colSpan={cols.length + 1}>Facts from the listing</th></tr>
          {d.specs.map(s => <tr key={s.attribute}><td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}><strong>{s.label}</strong></td>
            {cols.map(c => { const v = s.values[c.id]; return <td key={c.id} className="mono">{v ? <>{v.display}{v.similar_model && <span className="tag sib" style={{ marginLeft: 6 }}>similar model</span>}</> : <span className="muted">not found</span>}</td> })}</tr>)}

          <tr><th colSpan={cols.length + 1}>Your must-haves</th></tr>
          {d.must_haves.length === 0 && <tr><td colSpan={cols.length + 1} className="muted">You haven’t set must-haves yet.</td></tr>}
          {d.must_haves.map(m => <tr key={m.requirement}><td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>{m.label}</td>
            {cols.map(c => <td key={c.id}>{m.cells[c.id] ? <><StatusChip status={m.cells[c.id].status} /><div className="muted mono">{m.cells[c.id].have}</div></> : '—'}</td>)}</tr>)}

          <tr><th colSpan={cols.length + 1}>What owners complain about (from reviews read so far)</th></tr>
          <tr><td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Serious problems</td>{cols.map(c => <td key={c.id}>{d.problems[c.id].serious.length ? d.problems[c.id].serious.map(p => <div key={p.category}><span className="chip bad">! {CATEGORY_NAMES[p.category]}</span> <span className="muted">{p.owners} owners</span></div>) : <span className="muted">none found yet</span>}</td>)}</tr>
          <tr><td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Worth checking</td>{cols.map(c => <td key={c.id}>{d.problems[c.id].check.length ? d.problems[c.id].check.map(p => <div key={p.category}><span className="chip mix">◐ {CATEGORY_NAMES[p.category]}</span> <span className="muted">{p.owners}</span></div>) : <span className="muted">none found yet</span>}</td>)}</tr>

          {d.fit_by_use.length > 0 && <><tr><th colSpan={cols.length + 1}>How well each suits what you’ll do</th></tr>
            {d.fit_by_use.map(f => <tr key={f.workload}><td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>{WORKLOADS[f.workload] ?? f.workload}</td>
              {cols.map(c => <td key={c.id}>{f.cells[c.id] ? <LabelChip label={f.cells[c.id]!.label} provisional={f.cells[c.id]!.provisional} /> : '—'}</td>)}</tr>)}</>}

          <tr><th colSpan={cols.length + 1}>Rating by area (highlighted where the laptops differ)</th></tr>
          {d.areas.map(a => <tr key={a.category} style={a.differs ? { outline: '2px solid var(--accent)', outlineOffset: -2 } : undefined}>
            <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>{CATEGORY_NAMES[a.category]}{a.differs && <span className="badge" style={{ marginLeft: 6 }}>differs</span>}</td>
            {cols.map(c => <td key={c.id}><LabelChip label={a.cells[c.id].label} basis={a.cells[c.id].basis} provisional={a.cells[c.id].provisional} /></td>)}</tr>)}

          <tr><th colSpan={cols.length + 1}>How much we know about what matters to you</th></tr>
          <tr><td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Information we have</td>{cols.map(c => <td key={c.id} className="mono">{Math.round(c.knowledge * 100)}%</td>)}</tr>
        </tbody></table></div>

      <div className="sheet"><h2>What changes if you pick another</h2>
        {d.differences.map(x => <div key={x.laptop_id}><strong>{name(x.laptop_id)}</strong> compared with <strong>{name(x.versus)}</strong>:
          {x.lines.length ? <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{x.lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <span className="muted"> no measurable differences found</span>}</div>)}
        <p className="muted">Only facts we know for both laptops are compared. “Similar model” values are shown above but never used here.</p></div>
    </div>
  )
}
