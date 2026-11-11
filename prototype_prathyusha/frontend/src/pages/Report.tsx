import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { EvidenceDrawer } from '../components/EvidenceDrawer'
import { CATEGORY_NAMES, Coverage, ErrorState, LabelChip, Skeleton, SourceTag, StatusChip, VariantBadge } from '../components/ui'
import { useProfile, WORKLOADS } from '../profile'
import { LaptopRatings } from '../components/bits'
import { useCompare } from '../compare'
import type { Bench, EvidenceItem, Finding } from '../types'

type Drawer = { ids: string[]; index: number; title: string } | null
const REASON: Record<string, string> = {
  duplicate: 'repeat copies of another review', unclear_context: 'too short to say anything useful', different_variant: 'reviewer changed their laptop’s hardware', instruction_injection: 'contains instructions aimed at software',
}

function Quotes({ items, onOpen }: { items: EvidenceItem[]; onOpen: (i: number) => void }) {
  return <ul style={{ margin: 0, paddingLeft: 18 }}>{items.slice(0, 3).map((e, i) => (
    <li key={e.claim_id}><span className="quote">“{e.quote}”</span> <button className="btn small" onClick={() => onOpen(i)}>Read the full review</button></li>))}</ul>
}

function BenchRow({ b, similar }: { b: Bench; similar?: boolean }) {
  return (
    <tr><td><SourceTag kind={b.methodology === 'manufacturer_claim' ? 'claim' : 'lab'} similar={similar} /></td>
      <td>{b.test_name}</td><td className="mono">{b.value_text} {b.unit}</td><td>{b.conditions}</td>
      <td>{b.validation_status === 'verified_on_page' ? <span className="chip ok">✓ Checked against source</span> : <span className="chip unk">Not double-checked yet</span>}</td>
      <td><a href={b.source_url} target="_blank" rel="noreferrer">Open source</a></td></tr>)
}

const FACT_NAMES: Record<string, string> = { weight_kg: 'Weight (kg)', weight_kg_curated: 'Weight (kg)', weight_kg_options: 'Weight (kg), several versions', battery_wh: 'Battery size (Wh)', ram_gb: 'Memory (GB)', ram_gb_options: 'Memory (GB), several versions',
  ram_type: 'Memory type', ram_upgradeable: 'Can memory be upgraded?', storage_gb: 'Storage (GB)', storage_gb_options: 'Storage (GB), several versions', display_size_in: 'Screen size (inches)', display_resolution: 'Screen resolution',
  display_brightness_nits: 'Screen brightness (nits)', display_peak_brightness_nits_options: 'Peak HDR brightness (nits), several versions', display_peak_brightness_nits: 'Peak HDR brightness (nits)', refresh_hz: 'Refresh rate (Hz)', refresh_hz_options: 'Refresh rate (Hz), several versions', ram_options_gb: 'Memory options (GB)' }

export function Report() {
  const { id = '' } = useParams()
  const { profile, has } = useProfile()
  const [drawer, setDrawer] = useState<Drawer>(null)
  const cmp = useCompare()
  const q = useQuery({ queryKey: ['fit', id, profile], queryFn: () => api.fit(id, profile) })
  const d = q.data

  if (q.isLoading) return <div className="page"><Skeleton lines={4} /><Skeleton lines={5} /></div>
  if (q.error || !d) return <div className="page"><ErrorState message={(q.error as Error)?.message ?? 'No data'} onRetry={() => q.refetch()} /><Link to="/">Back to search</Link></div>

  const open = (f: Finding, i: number, label: string) => setDrawer({ ids: f.evidence.map(e => e.review_id), index: i, title: `${label}: ${CATEGORY_NAMES[f.category] ?? f.category}` })
  const lanes = d.independent_tests_and_specs.lanes
  const findings = [...d.dealbreakers.map(f => ({ f, kind: 'serious' })), ...d.watchouts.map(f => ({ f, kind: 'check' }))]
  const cats = Object.entries(d.ratings.categories)
  const price = d.gate.find(g => g.requirement === 'budget_inr_max')

  return (
    <div className="page">
      <Link to="/">← Back to laptops</Link>
      <div className="sheet">
        <div className="row" style={{ justifyContent: 'space-between' }}><h1 style={{ fontSize: 24 }}>{d.variant.display_name}</h1><VariantBadge match={d.variant.variant_confidence} /></div>
        <p className="muted">{d.variant.listing_title}</p>
        <p className="muted">{d.owner_analysis.state === 'not_available' ? 'Looked up online from official pages' : `${d.variant.review_count} owner reviews on the listing`}{price ? ` · price ${price.have}` : ''}</p>
        <div className="row"><Link className="btn small" to={`/claim?laptop=${d.variant.id}`}>Check a claim about this laptop</Link>
          <button className="btn small" aria-pressed={cmp.has(d.variant.id)} onClick={() => cmp.toggle(d.variant.id)}>{cmp.has(d.variant.id) ? '✓ Added to compare' : 'Add to compare'}</button></div>
      </div>

      {!has && <div className="banner info"><strong>Tell us what you’ll use it for.</strong> Without that we can’t check this laptop against your needs. <Link to="/">Describe what you need</Link></div>}
      {d.status !== 'complete' && d.owner_analysis.state === 'not_run' && <div className="banner info" role="status"><strong>Two levels of detail.</strong> The topic ratings above come from a quick pass over every owner review. The detailed problem list with exact quotes further down has not been built for this laptop yet, so a missing problem there does not mean it has none.</div>}
      {d.status !== 'complete' && d.owner_analysis.state !== 'not_run' && <div className="banner" role="status"><strong>{d.owner_analysis.state === 'not_available' ? 'Looked up online.' : 'Early results.'}</strong> {d.warnings.map((w, i) => <span key={i}>{w} </span>)}</div>}

      <LaptopRatings id={d.variant.id} />
      <details className="sheet" open>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How to read this page</summary>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div><span className="k">Answers to your must-haves</span>
            <div className="row" style={{ marginTop: 6 }}><StatusChip status="met" /><StatusChip status="not_met" /><StatusChip status="spec_mismatch" /><StatusChip status="unknown" /></div>
            <p className="muted" style={{ marginTop: 6 }}>“Can’t tell yet” means we found no reliable information. It never means “yes”.</p></div>
          <div><span className="k">Owner reviews</span>
            <p style={{ marginTop: 6 }}><span className="chip bad">! Serious problem</span> two or more different owners clearly report it, and it matters to you.</p>
            <p style={{ marginTop: 6 }}><span className="chip mix">◐ Worth checking</span> one owner reports it, or it is not one of your top priorities.</p></div>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>On the first page we rank laptops for what you asked; here you see the evidence behind one laptop. Every point opens the exact review or source behind it.</p>
      </details>

      <div className="sheet"><span className="k">In short</span>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{d.summary.lines.map((l, i) => <li key={i}>{l.text}</li>)}</ul></div>

      <div className="sheet"><h2>1 · Does it meet your must-haves?</h2>
        {d.gate.length === 0 ? <p className="muted">You haven’t set any must-haves yet (for example a budget or minimum RAM). <Link to="/">Describe them on the first page</Link></p> : (
          <div className="tablewrap"><table><thead><tr><th>You asked for</th><th>What we found</th><th>Answer</th><th>Where this comes from</th></tr></thead><tbody>
            {d.gate.map(g => <tr key={g.requirement}><td>{g.label}</td><td className="mono">{g.have}</td><td><StatusChip status={g.status} /></td>
              <td>{g.source_id ? <SourceTag kind="spec" /> : <span className="muted">{g.note || '—'}</span>}</td></tr>)}
          </tbody></table></div>)}
        {d.gate.filter(g => g.note).map(g => <p key={g.requirement} className="muted">{g.label}: {g.note}</p>)}
      </div>

      <div className="sheet"><h2>2 · What owners complain about</h2>
        {d.owner_analysis.state !== 'not_available' && <p className="muted">Based on {d.owner_analysis.processed} of {d.owner_analysis.representatives} different owner reviews read so far.</p>}
        {d.owner_analysis.state === 'not_run' && <p>We have not done the detailed reading for this laptop, so this section is empty. The topic ratings above come from a quicker pass over every review. A missing problem here does not mean it has none.</p>}
        {d.owner_analysis.state === 'not_available' && <p>No owner reviews are available for this laptop because it was looked up online. This section is empty, which does not mean it has no problems.</p>}
        {!['not_run', 'not_available'].includes(d.owner_analysis.state) && findings.length === 0 && <p>No clear problems found in the reviews read so far.</p>}
        {findings.map(({ f, kind }) => (
          <div key={kind + f.category} className="sheet">
            <div className="row"><span className={`chip ${kind === 'serious' ? 'bad' : 'mix'}`}>{kind === 'serious' ? '! Serious problem' : '◐ Worth checking'}</span><strong>{CATEGORY_NAMES[f.category] ?? f.category}</strong>
              <span className="tag">{f.distinct_reports} {f.distinct_reports === 1 ? 'owner reports' : 'different owners report'} it</span></div>
            <Quotes items={f.evidence} onOpen={i => open(f, i, kind === 'serious' ? 'Serious problem' : 'Worth checking')} />
            <p className="muted">{f.rule}</p>
          </div>))}
      </div>

      <div className="sheet"><h2>3 · How well it suits what you’ll do</h2>
        {d.fit_by_use.length === 0 ? <p className="muted">Pick what you’ll use the laptop for in <Link to="/">your needs on the first page</Link> to see this.</p> : (
          <div className="tablewrap"><table><thead><tr><th>You’ll use it for</th><th>How well it suits</th><th>How much we know</th><th>Held back by</th></tr></thead><tbody>
            {d.fit_by_use.map(f => <tr key={f.workload}><td>{WORKLOADS[f.workload] ?? f.workload}</td><td><LabelChip label={f.label} provisional={f.provisional} /></td><td><Coverage value={f.coverage} /></td>
              <td>{f.driven_by_weak.length ? f.driven_by_weak.map(c => CATEGORY_NAMES[c]).join(', ') : '—'}</td></tr>)}</tbody></table></div>)}
      </div>

      <div className="sheet"><h2>4 · Rating by area</h2>
        <p className="muted">How much we know about what matters to you: <strong>{Math.round(d.ratings.coverage * 100)}%</strong>.
          {d.ratings.score_visible ? <> Score for you: <strong className="mono">{Math.round(d.ratings.score ?? 0)} out of 100</strong>. This blends the areas below by how much each matters to you. It is not a grade or a ranking, and a poor area can still be a dealbreaker.</> : d.owner_analysis.state === 'not_available' ? ' No score because we have no owner reviews for this laptop.' : d.ratings.provisional ? ' No score yet because we haven’t finished reading the reviews.' : ' That is below 60%, so we show no score.'} We never give an overall rank.</p>
        <p className="muted">“Based on” shows what each rating rests on: listing details, lab tests, and the number of different owners who wrote about it.</p>
        <div className="tablewrap"><table><thead><tr><th>Area</th><th>How it looks</th><th>How much it matters to you</th><th>Based on</th></tr></thead><tbody>
          {cats.map(([c, r]) => <tr key={c}><td>{CATEGORY_NAMES[c]}</td><td><LabelChip label={r.label} basis={r.basis} provisional={r.provisional} /></td><td className="mono">{r.weight ? `${Math.round(r.weight)}%` : '—'}</td>
            <td><span className="row" style={{ gap: 4 }}>
              <span className={`cell ${r.evidence.spec ? 'has' : 'none'}`} title="Listing details">Listing {r.evidence.spec || '–'}</span>
              <span className={`cell ${r.evidence.lab_exact + r.evidence.lab_sibling ? 'has' : 'none'}`} title="Lab tests">Lab {r.evidence.lab_exact + r.evidence.lab_sibling ? r.evidence.lab_exact + r.evidence.lab_sibling + (r.evidence.lab_exact === 0 ? ' (similar model)' : '') : '–'}</span>
              <span className={`cell ${r.evidence.owner ? 'has' : 'none'}`} title="Different owners who wrote about this">Owners {r.evidence.owner || '–'}</span></span></td></tr>)}
        </tbody></table></div>
      </div>

      <div className="sheet"><h2>5 · What owners say overall</h2>
        <p>{d.set_aside.total_reviews} reviews on the listing. Not counted: {Object.entries(d.set_aside.by_reason).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${REASON[r] ?? r.replace(/_/g, ' ')}`).join(', ') || 'none'}.</p>
        {d.disagreements.map(x => (
          <div key={x.category} className="sheet"><strong>Owners disagree about: {CATEGORY_NAMES[x.category]}</strong>
            <div className="grid2"><div><span className="k">Happy owners</span><ul style={{ margin: 0, paddingLeft: 18 }}>{x.side_positive.map(e => <li key={e.claim_id}>“{e.quote}”</li>)}</ul></div>
              <div><span className="k">Unhappy owners</span><ul style={{ margin: 0, paddingLeft: 18 }}>{x.side_negative.map(e => <li key={e.claim_id}>“{e.quote}”</li>)}</ul></div></div>
            <p className="muted">We show both sides instead of averaging them. Their situations may differ.</p></div>))}
      </div>

      <div className="sheet"><h2>6 · Lab tests and official details</h2>
        {lanes.lab_exact.length + lanes.lab_sibling.length + lanes.manufacturer_claims.length === 0 ? <p className="muted">We have no lab test or maker’s claim recorded for this laptop.</p> : (
          <div className="tablewrap"><table><thead><tr><th>Type</th><th>Test</th><th>Result</th><th>How it was tested</th><th>Checked?</th><th></th></tr></thead><tbody>
            {lanes.lab_exact.map(b => <BenchRow key={b.id} b={b} />)}
            {lanes.manufacturer_claims.map(b => <BenchRow key={b.id} b={b} />)}
            {lanes.lab_sibling.map(b => <BenchRow key={b.id} b={b} similar />)}</tbody></table></div>)}
        {lanes.lab_sibling.length > 0 && <p className="muted">“Similar model” rows come from a slightly different version of this laptop (for example a different processor). We show them for context and never count them as this laptop’s result.</p>}
        {lanes.manufacturer_claims.length > 0 && <p className="muted">A maker’s claim is what the company says. It is not independent proof.</p>}
      </div>

      {d.independent_tests_and_specs.curated_spec_facts.length > 0 && <div className="sheet"><h2>Official details we found, and where they come from</h2>
        <div className="tablewrap"><table><thead><tr><th>Detail</th><th>Value</th><th>Exact words on the page</th><th>Source</th></tr></thead><tbody>
          {d.independent_tests_and_specs.curated_spec_facts.map((f, i) => <tr key={i}><td>{FACT_NAMES[f.attribute] ?? f.attribute.replace(/_/g, ' ')}</td>
            <td className="mono">{f.value_text.replace(/,/g, ', ')}{f.unit ? ` ${f.unit}` : ''}{f.variant_match !== 'exact_family' && f.variant_match !== 'exact_listing' ? ' (similar model)' : ''}</td>
            <td className="muted">{f.quote ? `“${f.quote.slice(0, 140)}”` : '—'}</td>
            <td>{f.source?.url ? <a href={f.source.url} target="_blank" rel="noreferrer">{(f.source.attribution_text || f.source.publisher || 'Open source').slice(0, 70)}</a> : '—'}{f.validation_status === 'machine_validated' ? <div className="muted">read by our software</div> : f.validation_status === 'verified_on_page' ? <div className="muted">checked against the page</div> : <div className="muted">not double-checked yet</div>}</td></tr>)}
        </tbody></table></div>
        <p className="muted">Short quotes only, each with a link to its source. Details can differ by country and by version of the laptop.</p></div>}

      <div className="sheet"><h2>7 · What we couldn’t find out</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{d.gaps.length === 0 ? <li>Nothing important is missing for your priorities.</li> : d.gaps.map((g, i) => <li key={i}><strong>{g.label ?? CATEGORY_NAMES[g.category] ?? g.category.replace(/_/g, ' ')}</strong>: {g.reason}</li>)}</ul>
      </div>

      {drawer && <EvidenceDrawer ids={drawer.ids} index={drawer.index} setIndex={i => setDrawer({ ...drawer, index: i })} onClose={() => setDrawer(null)} title={drawer.title} />}
    </div>
  )
}
