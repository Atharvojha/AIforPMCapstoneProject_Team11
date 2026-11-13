import { useRef, useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { LaptopPicker, type PickRow } from '../components/LaptopPicker';
import { NumberField } from '../components/NumberField';
import { SellFactors } from '../components/SellFactors';
import { TrustLine } from '../components/TrustLine';
import { maxAgeYears } from '../lib/launch';
import { loadOwned, type OwnedLaptop } from '../lib/storage';
import { fmtWait } from '../lib/wait';

const SHAPES: { id: string; label: string; line: string }[] = [
  { id: 'excellent', label: 'Like new', line: 'No marks you can see.' }, { id: 'good', label: 'Good', line: 'Light signs of use, nothing that bothers.' },
  { id: 'fair', label: 'Worn', line: 'Visible scratches or dents.' }, { id: 'poor', label: 'Rough', line: 'Damage that affects looks or use.' },
];
const QUESTIONS = ['Which laptop is it?', 'How old is it?', 'What shape is it in?', 'Anything else?'];

/** The newest sell_plan block in this thread (the numbers come from the server, nothing is computed here). */
const lastPlan = (thread: Thread) => { for (let i = thread.turns.length - 1; i >= 0; i--) { const b = thread.turns[i].reply?.blocks.find((x) => x.type === 'sell_plan'); if (b) return b; if (thread.turns[i].pending) return null; } return null; };

/** What is my laptop worth? Four short questions, one at a time, ending in a worth range (or a "what did you pay?" when the price is not on file). */
export function SellScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {});
  const plan = lastPlan(thread);
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(plan ? 4 : 0);
  const [lap, setLap] = useState({ id: '', name: '', free: false }); const [row, setRow] = useState<PickRow | null>(null);
  const [age, setAge] = useState<number | null>(2); const [cond, setCond] = useState('good'); const [bat, setBat] = useState<number | null>(null); const [flags, setFlags] = useState<string[]>([]); const [paid, setPaid] = useState<number | null>(null); const [notes, setNotes] = useState('');
  const [owned] = useState<OwnedLaptop[]>(() => loadOwned()); const ageFrom = (d: string) => { const t = new Date(d); if (isNaN(+t)) return null; const y = (Date.now() - +t) / 31557600000; return Math.max(0, Math.floor(y)); };
  const pickOwned = (o: OwnedLaptop) => { setLap({ id: o.variant_id || '', name: o.name, free: !o.variant_id }); const a = ageFrom(o.purchase_date); if (a != null) setAge(a); if (o.price_paid) setPaid(o.price_paid); };
  const last = useRef<Record<string, unknown> | null>(null); const [paidAsk, setPaidAsk] = useState<number | null>(null);
  const busy = thread.busy || thread.cooldown > 0;
  const custom = !lap.id; const needPaid = custom || (row != null && row.price_inr == null);
  const maxAge = maxAgeYears(row);
  const body = (p: number | null): Record<string, unknown> => ({
    action: 'sell_plan', ...(lap.id ? { variant_id: lap.id } : { custom_name: lap.name.slice(0, 80) }), ...(p != null ? { paid_inr: p } : {}), age_years: age ?? 0, condition: cond,
    ...(bat != null ? { battery_health_pct: bat } : {}), ...(flags.length ? { flags } : {}), ...(notes.trim() ? { notes: notes.trim().slice(0, 300) } : {}),
  });
  const send = async (p: number | null) => { const b = body(p); last.current = b; setStep(4); await thread.action(b, `Sell plan for ${lap.name.split(' · ')[0] || 'my laptop'}`); };
  const resend = async () => { if (!last.current || paidAsk == null) return; const b = { ...last.current, paid_inr: paidAsk }; last.current = b; await thread.action(b, 'Sell plan with what I paid'); };
  const low = plan?.range?.low_text, high = plan?.range?.high_text; const noRange = plan && !(low && high);
  const ready = step === 0 ? !!lap.name || !!lap.id : true;
  return (
    <section className="page-enter sell-screen" aria-labelledby="sell-h">
      <h2 id="sell-h">What’s my laptop worth?</h2>
      {step < 4 && (
        <div className="q-step">
          <p className="q-count" aria-live="polite"><span className="q-dots" aria-hidden="true">{QUESTIONS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</span>Question {step + 1} of 4</p>
          <h3 className="q-title">{QUESTIONS[step]}</h3>
          {step === 0 && owned.length > 0 && <div className="owned-pick" role="group" aria-label="Your saved laptops"><p className="muted small">Your laptops, saved on this device (tap one, or type or choose another below)</p>
            <div className="chips">{owned.map((o) => <button type="button" key={o.id} className={`chip ${lap.name === o.name ? 'on' : ''}`} aria-pressed={lap.name === o.name} onClick={() => pickOwned(o)}>{o.name.split(' · ')[0]}{o.purchase_date ? <span className="muted small"> · bought {o.purchase_date.slice(0, 7)}</span> : null}</button>)}</div></div>}
          {step === 0 && <LaptopPicker id="sell-laptop" label="Laptop name" value={lap.id} indiaOnly allowFree onRow={setRow} onChange={(id, name, free) => setLap({ id, name, free: !!free })} hint="Laptops sold in India. Not in the list? Type it anyway." />}
          {step === 1 && <>
            <NumberField id="sell-age" label="Age in years" unit="years" value={age} min={0} max={maxAge} step={1} onChange={setAge} hint={`0 means less than a year.${row && maxAge ? ` This model is at most ${maxAge} year${maxAge === 1 ? '' : 's'} old.` : ''}`} />
          </>}
          {step === 2 && <div className="shapes" role="radiogroup" aria-label="Condition">{SHAPES.map((f) => <button type="button" key={f.id} role="radio" aria-checked={cond === f.id} className={`shape ${cond === f.id ? 'on' : ''}`} onClick={() => setCond(f.id)}><strong>{f.label}</strong><span className="muted small">{f.line}</span></button>)}</div>}
          {step === 3 && <>
            <p className="muted small">Skip anything you do not know. Unknowns widen the range, they are never guessed.</p>
            <NumberField id="sell-bat" label="Battery health" unit="%" value={bat} min={30} max={100} step={1} onChange={setBat} hint="Leave empty if you have not checked." />
            {needPaid && <NumberField id="sell-paid" label="What did you pay?" unit="₹" value={paid} min={1000} max={1000000} step={1000} stepper={false} onChange={setPaid} hint={custom ? 'I have no price on file for a laptop that is not in the catalog.' : 'I have no rupee price on file for this model.'} />}
            <SellFactors value={flags} onChange={setFlags} />
            <label htmlFor="sell-notes" className="field-label">Anything else (type it)</label>
            <textarea id="sell-notes" className="big-text" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="“Bought in a sale, used mostly for office work…”" />
          </>}
          <div className="q-nav">
            {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep((step - 1) as 0 | 1 | 2)}>Back</button>}
            {step < 3 ? <button type="button" className="btn" disabled={!ready} onClick={() => setStep((step + 1) as 1 | 2 | 3)}>Next</button>
              : <button type="button" className="btn" disabled={busy} onClick={() => void send(paid)}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : 'Show me the range'}</button>}
          </div>
        </div>
      )}
      {step === 4 && plan && (
        <div className="worth-hero" role="region" aria-label="What your laptop is worth">
          <p className="worth-eyebrow">A used {String(plan.laptop ?? lap.name).split(' · ')[0]} might sell for</p>
          {!noRange && <p className="worth-range"><strong>{low} to {high}</strong></p>}
          {(noRange || plan.needs_paid_price) && (
            <div className="paid-ask">
              <p>{noRange ? 'I cannot give a range without a price to start from.' : 'This range starts from a price I do not have on file.'}</p>
              <NumberField id="sell-paid2" label="What did you pay?" unit="₹" value={paidAsk} min={1000} max={1000000} step={1000} stepper={false} onChange={setPaidAsk} />
              <button type="button" className="btn small" disabled={busy || paidAsk == null || !last.current} onClick={() => void resend()}>Update the range</button>
            </div>
          )}
          <TrustLine asOf={plan.as_of ?? '?'} owners={null} verified={false} extra="Sample assumptions, no real sales yet" />
          <p className="muted small">A guide, not a promise. No real used-price data is connected yet.</p>
          <button type="button" className="btn ghost small" onClick={() => setStep(0)}>Change my answers</button>
        </div>
      )}
      {step === 4 && !plan && (thread.busy ? <p className="muted" role="status">Working it out…</p> : <button type="button" className="btn ghost small" onClick={() => setStep(0)}>Change my answers</button>)}
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
