import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorState, Skeleton } from '../components/ui'

const STEPS: [string, string][] = [['identify', 'Understand which laptop you mean'], ['search', 'Search the web'], ['permission', 'Check which pages we’re allowed to read'], ['build', 'Build the report']]
const DECISION: Record<string, string> = { fetched: 'Read', link_only: 'Link only', blocked: 'Couldn’t read', rejected: 'Not used', failed: 'Couldn’t read' }

export function ResearchPage() {
  const { id = '' } = useParams()
  const q = useQuery({ queryKey: ['research', id], queryFn: () => api.researchStatus(id), refetchInterval: d => (d.state.data && ['done', 'failed'].includes(d.state.data.status) ? false : 1500) })
  const d = q.data
  if (q.isLoading) return <div className="page"><Skeleton lines={4} /></div>
  if (q.error || !d) return <div className="page"><ErrorState message={(q.error as Error)?.message ?? 'No data'} onRetry={() => q.refetch()} /></div>
  const stepState = (name: string) => d.steps.find(s => s.name === name)
  return (
    <div className="page">
      <Link to="/">← Back to laptops</Link>
      <h1>Looking up “{d.query}”</h1>
      <div className="sheet" aria-live="polite">
        {STEPS.map(([k, label]) => { const s = stepState(k); const state = s ? (s.status === 'done' ? '✓' : '…') : '○'
          return <div key={k} className="row"><span className="mono" style={{ width: 18 }}>{state}</span><strong>{label}</strong><span className="muted">{s?.detail}</span></div> })}
        {d.status === 'running' || d.status === 'queued' ? <p className="muted">Working on it. This usually takes under a minute.</p> : null}
      </div>
      {d.status === 'failed' && <div className="banner" role="alert"><strong>We couldn’t finish this lookup.</strong> {d.error}</div>}
      {d.status === 'done' && (
        <div className="sheet">
          {d.variant_id ? <>
            <p>We found official details and built a report. It has <strong>no owner reviews</strong>, so it shows nothing about what owners complain about.</p>
            <div><Link className="btn primary" to={`/laptops/${d.variant_id}`}>See if it suits me</Link></div></>
            : <p>We couldn’t read any official details for this laptop (the maker’s page may have blocked us or didn’t match). The links below may still help.</p>}
        </div>)}
      {d.links.length > 0 && <div className="sheet"><h2>Pages we found</h2>
        <div className="tablewrap"><table><thead><tr><th>Page</th><th>What we did</th><th>Why</th></tr></thead><tbody>
          {d.links.map((l, i) => <tr key={i}><td><a href={l.url} target="_blank" rel="noreferrer">{l.title || l.url}</a></td><td><span className={`chip ${l.decision === 'fetched' ? 'ok' : 'unk'}`}>{DECISION[l.decision]}</span></td><td className="muted">{l.reason}</td></tr>)}
        </tbody></table></div>
        <p className="muted">We only read official maker pages that allow it. Other pages are listed as links so you can read them yourself. We never work around a site that blocks us.</p></div>}
    </div>
  )
}
