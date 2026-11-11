import type { Label, ReqStatus } from '../types'

/** One shared vocabulary for the whole app. See docs/COPY_GUIDE.md. */
export function StatusChip({ status }: { status: ReqStatus }) {
  const m = {
    met: ['ok', '✓ Yes'], not_met: ['bad', '✕ No'], spec_mismatch: ['neq', '✕ Below what you asked'], unknown: ['unk', '? Can’t tell yet'],
  }[status] as [string, string]
  return <span className={`chip ${m[0]}`}>{m[1]}</span>
}

export function LabelChip({ label, basis, provisional }: { label: Label; basis?: string | null; provisional?: boolean }) {
  const m = {
    strong: ['ok', '✓ Good'], good_with_tradeoffs: ['mix', '◐ OK, with trade-offs'], weak: ['bad', '✕ Poor'], not_enough_evidence: ['unk', '? Not enough information'],
  }[label] as [string, string]
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className={`chip ${m[0]}`}>{m[1]}</span>
      {basis === 'spec' && <span className="tag" title="Worked out from the listing details, not from reviews">from listing details</span>}
      {provisional && <span className="tag" title="We are still reading reviews, so this may change">early result</span>}
    </span>
  )
}

export function Coverage({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100)
  return (
    <div className="row" style={{ flexWrap: 'nowrap', minWidth: 140 }} aria-label={`${label ?? 'How much we know'} ${pct}%`}>
      <div className="cov"><i style={{ width: `${pct}%` }} /><u /></div>
      <span className="mono">{pct}%</span>
    </div>
  )
}

export function VariantBadge({ match }: { match: string }) {
  const text: Record<string, string> = { exact_listing: 'This exact listing', exact_family: 'Same model, same family', sibling_cpu: 'Similar model (different processor)', sibling_other: 'Similar model', family_only: 'Same range, different model', unknown: 'Version unknown' }
  return <span className="badge">{text[match] ?? match}</span>
}

/** Where a piece of information comes from, in words. */
export function SourceTag({ kind, similar }: { kind: 'spec' | 'lab' | 'owner' | 'claim'; similar?: boolean }) {
  const t = { spec: 'Listing details', lab: 'Lab test', owner: 'Owner reviews', claim: 'Maker’s claim' }[kind]
  return <span className={`tag${similar ? ' sib' : ''}`}>{t}{similar ? ' · similar model' : ''}</span>
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="sheet" aria-busy="true" aria-label="Loading">{Array.from({ length: lines }).map((_, i) => <div key={i} className="skel" style={{ width: `${90 - i * 12}%` }} />)}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner" role="alert">
      <strong>That didn’t work.</strong> <span>{message}</span>
      {onRetry && <div style={{ marginTop: 8 }}><button className="btn small" onClick={onRetry}>Try again</button></div>}
    </div>
  )
}

export const CATEGORY_NAMES: Record<string, string> = {
  performance: 'Speed (processor)', memory: 'Memory (RAM)', gpu: 'Graphics (for games, video)', battery: 'Battery', display: 'Screen', thermals_noise: 'Heat and fan noise',
  portability: 'Weight and size', keyboard_trackpad: 'Keyboard and touchpad', ports_connectivity: 'Ports and Wi-Fi', upgradeability: 'Can you upgrade it?',
  build_reliability: 'Build and durability', value: 'Value for money', delivery_or_seller: 'Delivery or seller', other: 'Other',
}
