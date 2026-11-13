import { useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { LaptopPicker } from '../components/LaptopPicker';
import { TrustLine } from '../components/TrustLine';
import { fmtWait } from '../lib/wait';

const FACES: { id: string; icon: string; label: string }[] = [{ id: 'excellent', icon: '😍', label: 'Like new' }, { id: 'good', icon: '🙂', label: 'Good' }, { id: 'fair', icon: '😐', label: 'Worn' }, { id: 'poor', icon: '😟', label: 'Rough' }];
const QUESTIONS = ['Which laptop is it?', 'How old, and in what shape?', 'Anything else you know?'];

/** The newest sell_plan block in this thread (the numbers come from the server, nothing is computed here). */
const lastPlan = (thread: Thread) => { for (let i = thread.turns.length - 1; i >= 0; i--) { const b = thread.turns[i].reply?.blocks.find((x) => x.type === 'sell_plan'); if (b) return b; if (thread.turns[i].pending) return null; } return null; };

/** What is my laptop worth? Three questions, one at a time, ending in a worth hero. */
export function SellScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {});
  const plan = lastPlan(thread);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(plan ? 3 : 0);
  const [id, setId] = useState(''); const [name, setName] = useState(''); const [age, setAge] = useState(2); const [cond, setCond] = useState('good'); const [knowBat, setKnowBat] = useState(false); const [bat, setBat] = useState(85); const [cracked, setCracked] = useState(false); const [urgent, setUrgent] = useState(false);
  const busy = thread.busy || thread.cooldown > 0;
  const ask = async () => { setStep(3); await thread.action({ action: 'sell_plan', variant_id: id, sell: { age_years: age, condition: cond, battery_health_pct: knowBat ? bat : null, cracked_screen: cracked || null, urgent } }, `Sell plan for ${name.split(' · ')[0] || 'my laptop'}`); };
  const low = plan?.range?.low_text, high = plan?.range?.high_text;
  return (
    <section className="page-enter sell-screen" aria-labelledby="sell-h">
      <h2 id="sell-h">What’s my laptop worth?</h2>
      {step < 3 && (
        <div className="q-step">
          <p className="q-count" aria-live="polite"><span className="q-dots" aria-hidden="true">{QUESTIONS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</span>Question {step + 1} of 3</p>
          <h3 className="q-title">{QUESTIONS[step]}</h3>
          {step === 0 && <LaptopPicker id="sell-laptop" label="Which laptop?" value={id} onChange={(v, n) => { setId(v); setName(n); }} />}
          {step === 1 && <>
            <div className="dial"><label htmlFor="age">How old? <strong className="big">{age === 0 ? 'Less than a year' : `${age} year${age === 1 ? '' : 's'}`}</strong></label><input id="age" type="range" min={0} max={8} step={1} value={age} onChange={(e) => setAge(Number(e.target.value))} /></div>
            <div className="faces" role="radiogroup" aria-label="Condition">{FACES.map((f) => <button type="button" key={f.id} role="radio" aria-checked={cond === f.id} className={`face ${cond === f.id ? 'on' : ''}`} onClick={() => setCond(f.id)}><span aria-hidden="true">{f.icon}</span>{f.label}</button>)}</div>
          </>}
          {step === 2 && <>
            <p className="muted small">Skip anything you do not know. Unknowns widen the range, they are never guessed.</p>
            <div className="dial"><label className="check-row"><input type="checkbox" checked={knowBat} onChange={(e) => setKnowBat(e.target.checked)} /> I know the battery health</label>
              {knowBat && <><input type="range" min={40} max={100} step={1} value={bat} onChange={(e) => setBat(Number(e.target.value))} aria-label="Battery health percent" /><strong className="big">{bat}%</strong></>}</div>
            <div className="chips"><button type="button" className={`chip ${cracked ? 'on' : ''}`} aria-pressed={cracked} onClick={() => setCracked(!cracked)}>💥 Cracked screen</button><button type="button" className={`chip ${urgent ? 'on' : ''}`} aria-pressed={urgent} onClick={() => setUrgent(!urgent)}>⚡ Need to sell fast</button></div>
          </>}
          <div className="q-nav">
            {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep((step - 1) as 0 | 1)}>Back</button>}
            {step < 2 ? <button type="button" className="btn" disabled={step === 0 && !id} onClick={() => setStep((step + 1) as 1 | 2)}>Next</button>
              : <button type="button" className="btn" disabled={!id || busy} onClick={ask}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : 'Show me the range'}</button>}
          </div>
        </div>
      )}
      {step === 3 && plan && (
        <div className="worth-hero" role="region" aria-label="What your laptop is worth">
          <p className="worth-eyebrow">A used {String(plan.laptop).split(' · ')[0]} might sell for</p>
          <p className="worth-range"><strong>{low && high ? `${low} to ${high}` : '?'}</strong></p>
          <TrustLine asOf={plan.as_of ?? '?'} owners={null} verified={false} extra="Sample assumptions, no real sales yet" />
          <p className="muted small">A guide, not a promise. No real used-price data is connected yet.</p>
          <button type="button" className="btn ghost small" onClick={() => setStep(0)}>Change my answers</button>
        </div>
      )}
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
