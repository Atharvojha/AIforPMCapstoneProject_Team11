import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { ErrorState, Skeleton } from '../components/ui'

export function AboutPage() {
  const q = useQuery({ queryKey: ['trust'], queryFn: api.trust })
  const d = q.data
  return (
    <div className="page">
      <h1>About LapFit: how it works and how far to trust it</h1>
      <div className="sheet"><span className="k">How it works</span>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>You describe what you need. We turn it into needs and suggest numbers (RAM, storage, weight…).</li>
          <li>A language model on this computer reads each owner review and notes which topics the owner talks about and whether they were happy.</li>
          <li>Plain code then counts different owners, checks listing details against your needs, and ranks laptops. The model never decides the result.</li>
          <li>Every point opens the exact words an owner wrote, or the source page.</li>
          <li>When we do not know, we say so. “No information” is never treated as “no problem”.</li></ol></div>
      <div className="sheet"><span className="k">Where the AI is, and where it is not</span><ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><strong>Reads owner reviews (AI, done ahead of time).</strong> A language model (Llama 3.1, running on this computer) reads every review once and notes the topics and whether the owner was happy. Those notes are stored.</li>
        <li><strong>Splits a pasted listing into claims (AI, while you wait).</strong> The same model separates your pasted text into claims. It may only copy words that are really in your text.</li>
        <li><strong>Finds similar reviews (AI embeddings).</strong> A small model turns sentences into numbers so “battery dies fast” and “poor backup” are found together.</li>
        <li><strong>Everything else is code, not AI:</strong> your needs sheet, the suggested numbers, ranking, counting owners, the battery arithmetic and every verdict. If the model is switched off, listings are split by simple rules and the page says so.</li>
        <li><strong>What it is not:</strong> a chatbot. It cannot answer from general knowledge. It answers only from owner words, listing details and numbers it can show you, and otherwise says “not enough evidence”.</li></ul></div>
      <div className="sheet"><span className="k">Plain-word glossary</span><ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><strong>Happy %</strong>: of the owners who wrote about a topic, the share who were positive (a “mixed” opinion counts half).</li>
        <li><strong>Not enough reviews</strong>: fewer than 3 owners wrote about it.</li>
        <li><strong>Our suggestion</strong>: a rule of thumb, not a measurement.</li>
        <li><strong>Misses a need</strong>: the listing is below a number you gave us.</li></ul></div>
      {q.isLoading && <Skeleton lines={4} />}
      {q.error && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {d && <>
        <div className="sheet"><span className="k">What you should not rely on yet</span><ul style={{ margin: 0, paddingLeft: 18 }}>{d.limits.map(l => <li key={l}>{l}</li>)}</ul></div>
        <div className="sheet"><h2>Our own tests, including the bad results</h2><p className="muted">{d.note}</p>
          <div className="tablewrap"><table><thead><tr><th>What we test</th><th>First result (honest)</th><th>After fixes</th><th>What it means</th></tr></thead><tbody>
            {d.items.map(i => <tr key={i.id}><td><strong>{i.title}</strong><div className="muted">{i.question}</div></td><td>{i.first}<div className="muted">{i.first_note}</div></td><td>{i.now ?? '—'}</td><td>{i.meaning}</td></tr>)}
          </tbody></table></div><p className="muted">The “First result” column is the one to believe.</p></div>
        <div className="sheet"><h2>What the data is</h2><p>{d.data.laptops_in_catalogue} laptops sold in India (the ones we recommend) plus {d.data.us_laptops_as_evidence ?? 0} laptops sold in the US that count only as extra evidence for brand claims. {d.data.owner_reviews.toLocaleString()} owner reviews. {d.data.lab_or_maker_records} lab or maker records.</p></div>
      </>}
    </div>
  )
}
