import { Link } from 'react-router-dom'
import { useCompare } from '../compare'

export function CompareTray() {
  const { ids, clear } = useCompare()
  if (ids.length === 0) return null
  return (
    <div role="region" aria-label="Laptops to compare" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '10px max(16px,env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom))', zIndex: 20 }}>
      <div className="row" style={{ maxWidth: 1080, margin: '0 auto', justifyContent: 'space-between' }}>
        <span>{ids.length} laptop{ids.length === 1 ? '' : 's'} picked to compare{ids.length < 2 ? ' (pick at least 2)' : ''}</span>
        <span className="row">{ids.length >= 2 && <Link className="btn primary small" to={`/compare?ids=${ids.join(',')}`}>Compare them</Link>}<button className="btn small" onClick={clear}>Clear</button></span>
      </div>
    </div>
  )
}
