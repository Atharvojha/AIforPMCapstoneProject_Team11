import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ErrorState } from '../components/ui'
import { loadNeeds, saveNeeds } from '../needsStore'
import type { NeedsSheet, Overrides, Scale, SheetCategory } from '../types'

const EXAMPLES = [
  'I am a CS student. Mostly coding, some video editing. Budget around 60k. I want it fast and light, with good battery.',
  'Gaming and streaming, under 80k. I do not want it to heat up.',
  'Just college work, YouTube and Zoom. Cheap and long battery, I carry it daily.',
]
const LEVELS = ['Don’t care', 'Nice to have', 'Important', 'Must have']
const HARD_OF: Record<string, string> = { ram_gb: 'ram_gb_min', storage_gb: 'storage_gb_min', battery_h: 'battery_h_min', weight_kg_max: 'weight_kg_max' }
const OWNER_KEYS = ['performance', 'memory', 'battery', 'display', 'thermals_noise', 'portability', 'keyboard_trackpad', 'build_reliability', 'value', 'ports_connectivity']
const TIER = ['', 'basic', 'mid', 'strong', 'very strong']

/** A number line: red below our minimum, amber up to the comfortable level, green beyond. The black tick is the number you chose. */
function ScaleBar({ sc, min, ideal, yours }: { sc: Scale; min: number; ideal: number; yours: number | null }) {
  const lo = sc.steps[0], hi = sc.steps[sc.steps.length - 1]
  const p = (v: number) => Math.max(0, Math.min(100, (sc.lower_is_better ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo)) * 100))
  const a = p(min), b = p(ideal), cur = p(yours ?? min)
  const fmt = (v: number) => sc.unit ? `${v} ${sc.unit}` : TIER[v] ?? String(v)
  return (
    <div className="scalewrap">
      <div className="scale" role="img" aria-label={`${sc.label}: minimum ${fmt(min)}, comfortable ${fmt(ideal)}${yours ? `, you chose ${fmt(yours)}` : ''}`}>
        <i className="z-r" style={{ width: `${a}%` }} /><i className="z-a" style={{ width: `${Math.max(0, b - a)}%` }} /><i className="z-g" style={{ width: `${100 - b}%` }} />
        <b className="tick" style={{ left: `${cur}%` }} />
      </div>
      <div className="scalelab"><span>{fmt(sc.lower_is_better ? hi : lo)}</span><span>minimum {fmt(min)}</span><span>comfortable {fmt(ideal)}</span><span>{fmt(sc.lower_is_better ? lo : hi)}</span></div>
    </div>
  )
}

function Row({ c, onLevel, onStep, onReset }: { c: SheetCategory; onLevel: (l: number) => void; onStep: (dir: 1 | -1) => void; onReset: () => void }) {
  const n = c.number
  const canStep = !!n && !!HARD_OF[n.spec] && !!n.scale
  const cur = n ? (n.yours ?? n.minimum) : 0
  return (
    <div className="sheet need">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}><strong>{c.label}</strong><div className="muted">{c.means}</div></div>
        {c.owner_rated || c.key === 'gpu'
          ? <div className="seg" role="group" aria-label={`How much ${c.label} matters`}>{LEVELS.map((l, i) => <button key={l} type="button" aria-pressed={c.level === i} onClick={() => onLevel(i)}>{l}</button>)}</div>
          : <span className="chip unk">{c.level_name}</span>}
      </div>
      <div className="muted">{c.why}</div>
      {n && n.scale && <>
        <ScaleBar sc={n.scale} min={n.minimum} ideal={n.ideal} yours={n.yours} />
        <div className="row">
          {canStep && <><button type="button" className="btn small" aria-label={`Lower ${c.label} target`} onClick={() => onStep(-1)}>−</button>
            <span><strong>{n.yours ? 'Your number: ' : 'Our suggestion: '}{n.scale.lower_is_better ? 'under ' : 'at least '}{cur} {n.scale.unit}</strong></span>
            <button type="button" className="btn small" aria-label={`Raise ${c.label} target`} onClick={() => onStep(1)}>+</button>
            {n.yours !== null && <button type="button" className="btn small" onClick={onReset}>Back to our suggestion</button>}</>}
          {!canStep && <span><strong>Aim for: </strong>{n.text}</span>}
        </div>
        <div className="muted">{n.why}{n.sources.length > 0 ? n.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>{s.label}</a>) : <div>Rule of thumb, no source</div>}</div>
      </>}
      {n && !n.scale && <div><strong>Aim for: </strong>{n.text}</div>}
    </div>
  )
}

export function NeedsPage() {
  const saved = useRef(loadNeeds())
  const [text, setText] = useState(saved.current?.text ?? '')
  const [ov, setOv] = useState<Overrides>(saved.current?.overrides ?? {})
  const [sheet, setSheet] = useState<NeedsSheet | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<null | boolean>(null)
  const nav = useNavigate()

  async function load(t: string, o: Overrides) {
    setBusy(true); setErr(null)
    try { setSheet(await api.needs(t.trim(), o)) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  useEffect(() => { if (saved.current?.text) load(saved.current.text, saved.current.overrides) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function build(e?: FormEvent) { e?.preventDefault(); if (text.trim().length < 3) return; setOv({}); setDone(null); load(text, {}) }
  function edit(next: Overrides) { setOv(next); setDone(null); load(text, next) }

  const levels = () => Object.fromEntries(OWNER_KEYS.map(k => [k, sheet!.categories.find(c => c.key === k)!.level]))
  function setLevel(c: SheetCategory, l: number) {
    if (!sheet) return
    if (c.key === 'gpu') return edit({ ...ov, needs_gpu: l >= 2 })
    edit({ ...ov, importance: { ...levels(), ...(ov.importance ?? {}), [c.key]: l } })
  }
  function step(c: SheetCategory, dir: 1 | -1) {
    const n = c.number; if (!n?.scale) return
    const key = HARD_OF[n.spec], steps = n.scale.steps, cur = n.yours ?? n.minimum
    let i = steps.findIndex(s => s >= cur - 1e-9); if (i < 0) i = steps.length - 1
    const j = Math.max(0, Math.min(steps.length - 1, i + dir))
    edit({ ...ov, hard: { ...(ov.hard ?? {}), [key]: steps[j] } })
  }
  const reset = (c: SheetCategory) => edit({ ...ov, hard: { ...(ov.hard ?? {}), [HARD_OF[c.number!.spec]]: null } })
  const toggleUse = (k: string) => { const on = new Set(sheet!.uses.filter(u => u.on).map(u => u.key)); on.has(k) ? on.delete(k) : on.add(k); edit({ ...ov, uses: [...on], importance: undefined }) }
  const toggleBrand = (k: string) => { const a = new Set(sheet!.brands.filter(b => b.avoid).map(b => b.key)); a.has(k) ? a.delete(k) : a.add(k); edit({ ...ov, brands_avoid: [...a] }) }
  const setBudget = (v: string) => { const n = Number(v.replace(/[^\d]/g, '')); edit({ ...ov, hard: { ...(ov.hard ?? {}), budget_inr_max: n > 0 ? n : null } }) }
  function save(go: boolean) { const ok = saveNeeds(text, ov); setDone(ok); if (ok && go) nav('/', { state: { run: true } }) }

  return (
    <div className="page">
      <h1>My needs</h1>
      <p className="muted" style={{ margin: 0 }}>Don’t know the numbers? Describe yourself in your own words. We turn it into a needs sheet with a suggested number for everything, and you can change anything.</p>
      <form onSubmit={build} className="sheet">
        <label htmlFor="needs" className="muted">What you’ll use it for, your budget, what matters to you.</label>
        <textarea id="needs" className="big" value={text} onChange={e => setText(e.target.value)} placeholder="For example: I’m a student, I code and edit videos sometimes, budget 60k, want it light with good battery" />
        <div className="row"><button className="btn primary" type="submit" disabled={busy || text.trim().length < 3}>{busy ? 'Working…' : 'Build my needs sheet'}</button>
          <span className="muted">Try:</span>{EXAMPLES.map((x, i) => <button key={i} type="button" className="btn small" onClick={() => setText(x)}>Example {i + 1}</button>)}</div>
      </form>
      {err && <ErrorState message={err} />}

      {sheet && <>
        <div className="sheet" aria-live="polite"><span className="k">What we understood</span>
          {sheet.needs.understood.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{sheet.needs.understood.map(u => <li key={u}>{u}</li>)}</ul> : <p style={{ margin: 0 }}>We could not pick out your uses. Tap them below or add words like coding, gaming, studies.</p>}</div>

        <div className="sheet"><span className="k">What you’ll do with it (tap to change)</span>
          <div className="pills">{sheet.uses.map(u => <button key={u.key} type="button" className="btn small" aria-pressed={u.on} onClick={() => toggleUse(u.key)}>{u.on ? '✓ ' : ''}{u.label}</button>)}</div></div>

        <div className="sheet"><span className="k">Budget and brands</span>
          <div className="row"><label htmlFor="budget">Budget up to ₹</label><input id="budget" inputMode="numeric" style={{ width: 130 }} defaultValue={sheet.budget_inr_max ?? ''} key={sheet.budget_inr_max ?? 'none'} onBlur={e => setBudget(e.target.value)} placeholder="no limit" /></div>
          <div className="row"><span className="muted">Skip these brands:</span>{sheet.brands.map(b => <button key={b.key} type="button" className="btn small" aria-pressed={b.avoid} onClick={() => toggleBrand(b.key)}>{b.avoid ? '✕ ' : ''}{b.label}</button>)}</div></div>

        <h2>What matters to you, and the number to aim for</h2>
        {sheet.categories.map(c => <Row key={c.key} c={c} onLevel={l => setLevel(c, l)} onStep={d => step(c, d)} onReset={() => reset(c)} />)}
        {sheet.needs.cannot_check.length > 0 && <div className="banner info">We can’t check these for you yet, so check them yourself: {sheet.needs.cannot_check.join(', ')}.</div>}
        <p className="muted">{sheet.note}</p>

        <div className="sheet savebar">
          <button className="btn primary" onClick={() => save(true)}>Save and find laptops</button>
          <button className="btn" onClick={() => save(false)}>Save my needs</button>
          {done === true && <span className="muted" role="status">Saved in this browser.</span>}{done === false && <span role="alert">Could not save (browser storage is off).</span>}
        </div>
      </>}
    </div>
  )
}
