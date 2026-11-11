import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { EvidenceDrawer } from '../components/EvidenceDrawer'
import { ErrorState } from '../components/ui'
import type { ListingResponse, Verdict } from '../types'

const KEY = 'lapfit.listing.text.v1'
const EXAMPLES = [
  'ASUS TUF Gaming F15 Core i5 10th Gen\n8 GB RAM, 512 GB SSD, 15.6 inch FHD 144Hz, 48Wh battery, up to 12 hours of battery life. Premium build quality, never lags. Best laptop for gaming and video editing. Runs cool and quiet',
  'Acer Aspire 5 Intel Core i3 11th Gen, 8GB RAM, 256GB SSD, 14 inch, 1.5 kg. Battery backup up to 10 hours. Great for coding and students. Sturdy metal body. Free DOS',
  'HP Pavilion Ryzen 5 5600H | 8GB RAM | 16GB RAM DDR4 | 512GB SSD | 70Wh battery with 20 hours backup | Brand new 2023 model',
]
const CHIP: Record<Verdict, [string, string]> = {
  supported: ['ok', '✓ Checks out'], contradicted: ['bad', '✕ Doesn’t add up'], mixed: ['mix', '◐ Partly, or it depends'], insufficient: ['unk', '? Only the seller’s word'],
}
const KIND: Record<string, string> = { battery: 'Battery', spec: 'Spec', fit: 'Good for…', experience: 'How it feels', marketing: 'Praise with no number' }

export function ListingPage() {
  const [text, setText] = useState(() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })
  const [res, setRes] = useState<ListingResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const nav = useNavigate()

  async function run(e?: FormEvent) {
    e?.preventDefault()
    if (text.trim().length < 8) return
    setBusy(true); setErr(null); setCopied(false)
    try { try { localStorage.setItem(KEY, text) } catch { /* not saved */ } setRes(await api.listing(text)) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  async function copyQs() {
    const t = (res?.questions ?? []).map((q, i) => `${i + 1}. ${q}`).join('\n')
    try { await navigator.clipboard.writeText(t); setCopied(true) } catch { setCopied(false) }
  }
  async function lookUp() { if (!res?.lookup) return; try { const r = await api.researchStart(res.lookup.query); nav(`/research/${r.job_id}`) } catch (x) { setErr((x as Error).message) } }

  return (
    <div className="page">
      <h1>Check a listing before you buy.</h1>
      <form onSubmit={run} className="sheet">
        <label htmlFor="listing" className="muted">Paste the listing, the ad, or what the shop told you, for any laptop. No link needed: copy the text.</label>
        <textarea id="listing" className="big" style={{ minHeight: 170 }} value={text} onChange={e => setText(e.target.value)} placeholder={'For example:\nAcer Aspire 5, Core i3, 8GB RAM, 256GB SSD, battery backup up to 10 hours, sturdy metal body, great for coding'} />
        <div className="row"><button className="btn primary" type="submit" disabled={busy || text.trim().length < 8}>{busy ? 'Checking… (about 10 seconds)' : 'Check this listing'}</button>
          <span className="muted">Try:</span>{EXAMPLES.map((x, i) => <button key={i} type="button" className="btn small" onClick={() => setText(x)}>Example {i + 1}</button>)}</div>
      </form>
      {err && <ErrorState message={err} />}

      {res && <>
        <div className="sheet" aria-live="polite">
          {res.title && <span className="k">{res.title}</span>}
          <p style={{ fontSize: 17, margin: 0 }}>{res.summary.text}</p>
          {res.ignored_instructions && <div className="banner">Some lines looked like instructions to the software, so we ignored them.</div>}
          {res.evidence_note && <p className="muted">{res.evidence_note}{res.matched && <> <Link to={`/laptops/${res.matched.id}`}>Open its full report</Link></>}</p>}
        </div>

        {res.claims.map(c => {
          const [tone, label] = CHIP[c.verdict]
          return (
            <div key={c.id} className="sheet claim">
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="tag">{KIND[c.kind] ?? c.kind}</span><span className={`chip ${tone}`}>{label}</span></div>
              <p style={{ margin: 0, fontSize: 16 }}>“{c.text}”</p>
              <p style={{ margin: 0 }}>{c.headline}</p>
              {c.details.filter(Boolean).map((d, i) => <p key={i} className="muted" style={{ margin: 0 }}>{d}</p>)}
              {c.quotes.map(q => <div key={q.review_id} className="quote"><span className="muted">{q.side === 'happy' ? 'A happy owner wrote:' : 'An unhappy owner wrote:'}</span><p style={{ margin: '2px 0' }}>“{q.quote}”</p>
                <button className="btn small" onClick={() => setDrawer(q.review_id)}>Read the full review</button></div>)}
              {c.links.length > 0 && <div>{c.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>{l.label}</a>)}</div>}
              <div className="muted">Where this comes from: {c.source_label}</div>
              {c.ask && <div className="ask"><strong>Ask:</strong> {c.ask}</div>}
            </div>)
        })}

        {res.questions.length > 0 && <div className="sheet"><span className="k">Ask the seller</span>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>{res.questions.map(q => <li key={q}>{q}</li>)}</ol>
          <div className="row"><button className="btn small" onClick={copyQs}>{copied ? 'Copied' : 'Copy these questions'}</button></div></div>}

        {res.lookup && <div className="banner info"><strong>We have no owner reviews of this exact model.</strong> {res.lookup.why}
          {res.lookup.available ? <div style={{ marginTop: 6 }}><button className="btn small primary" onClick={lookUp}>Look it up online</button> <span className="muted">Uses a small search quota. No owner reviews, only official and lab pages.</span></div> : <span> Online lookup is not switched on.</span>}</div>}

        <div className="sheet"><span className="k">How this was done</span>
          <p style={{ margin: 0 }}>{res.ai.by === 'language model'
            ? <>A language model ({res.ai.model}, running on this computer, {res.ai.seconds}s) split your text into separate claims. It can only copy words that are really in your text. </>
            : <>{res.ai.note ?? 'A simple rule-based splitter separated your text into claims. '} </>}
            Everything after that is code: counting owners, arithmetic, and our suggested numbers. The model never decides a verdict.</p></div>
        {res.limits && <div className="sheet"><span className="k">Keep in mind</span><ul style={{ margin: 0, paddingLeft: 18 }}>{res.limits.map(l => <li key={l}>{l}</li>)}</ul></div>}
      </>}
      {drawer && <EvidenceDrawer ids={[drawer]} index={0} setIndex={() => {}} onClose={() => setDrawer(null)} title="What the owner wrote" />}
    </div>
  )
}
