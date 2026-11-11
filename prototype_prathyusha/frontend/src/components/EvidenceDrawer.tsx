import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { CATEGORY_NAMES, ErrorState, Skeleton } from './ui'

function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const parts: (string | { m: string })[] = []
  let pos = 0
  for (const [s, e] of sorted) {
    if (s < pos) continue
    if (s > pos) parts.push(text.slice(pos, s))
    parts.push({ m: text.slice(s, e) })
    pos = e
  }
  parts.push(text.slice(pos))
  return <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{parts.map((p, i) => typeof p === 'string' ? <span key={i}>{p}</span> : <mark key={i}>{p.m}</mark>)}</p>
}

export function EvidenceDrawer({ ids, index, setIndex, onClose, title }: { ids: string[]; index: number; setIndex: (i: number) => void; onClose: () => void; title: string }) {
  const id = ids[index]
  const q = useQuery({ queryKey: ['review', id], queryFn: () => api.review(id), enabled: !!id })
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="drawer" aria-describedby="ev-desc">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
            <Dialog.Close asChild><button className="btn small">Close</button></Dialog.Close>
          </div>
          <p id="ev-desc" className="muted">These are the owner’s exact words. The highlighted text is what we based the finding on.</p>
          {q.isLoading && <Skeleton lines={4} />}
          {q.error && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
          {q.data && (
            <Tabs.Root defaultValue="quote">
              <Tabs.List className="row" aria-label="Views">
                <Tabs.Trigger value="quote">The review</Tabs.Trigger>
                <Tabs.Trigger value="source">Where it’s from</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="quote" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <div className="row"><span className="tag">Owner review</span><span className="mono">{q.data.review.id}</span>
                  {q.data.review.rating != null && <span className="tag">★ {q.data.review.rating}</span>}
                  {q.data.duplicates > 1 && <span className="tag">{q.data.duplicates} identical copies count as one review</span>}</div>
                {q.data.review.title && <strong>{q.data.review.title}</strong>}
                <div className="quote"><Highlighted text={q.data.review.original_text} ranges={q.data.claims.filter(c => c.quote_valid).map(c => [c.quote_start, c.quote_end] as [number, number])} /></div>
                {q.data.claims.length > 0 && (
                  <div><span className="k">What we took from this review</span>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {q.data.claims.map(c => <li key={c.id}>{CATEGORY_NAMES[c.category] ?? c.category}: {c.claim_text} <span className="muted">({c.polarity === 'negative' ? 'unhappy' : c.polarity === 'positive' ? 'happy' : c.polarity}, {c.strength === 'clear' ? 'clear' : 'lukewarm'})</span>
                        {!c.quote_valid && <span className="chip bad"> we could not match this to the review text</span>}</li>)}
                    </ul></div>)}
                {q.data.review.config_mismatch_hint === 'hardware_modified' && <div className="banner">This owner says they changed their laptop’s hardware, so their experience may not match the laptop as sold.</div>}
                {q.data.review.flag && <div className="banner">This review contains instructions aimed at software, so we ignore it.</div>}
                <p className="muted">Version: this exact listing. Date: not shown in our data source.</p>
              </Tabs.Content>
              <Tabs.Content value="source" style={{ marginTop: 10 }}>
                {q.data.source && <div className="sheet">
                  <div><span className="k">Where the reviews come from</span><p>{q.data.source.publisher}</p></div>
                  <div><span className="k">Usage rules</span><p>{q.data.source.licence_status}</p></div>
                  <a href={q.data.source.url} target="_blank" rel="noreferrer">Open the data source</a>
                  <p className="muted">The review text is shown unchanged. This prototype uses it for course and research only.</p>
                </div>}
              </Tabs.Content>
            </Tabs.Root>
          )}
          {ids.length > 1 && <div className="row"><button className="btn small" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
            <span className="mono">{index + 1} / {ids.length}</span>
            <button className="btn small" disabled={index === ids.length - 1} onClick={() => setIndex(index + 1)}>Next</button></div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
