import { useEffect, useMemo, useRef, useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { LaptopPicker } from '../components/LaptopPicker';
import { Stars } from '../components/viz/Stars';
import { loadOwned, saveOwned, newId, type OwnedLaptop } from '../lib/storage';
import { fmtWait } from '../lib/wait';
import { NumberField } from '../components/NumberField';
import { useCatalog } from '../state/useCatalog';
import { cleanMyLaptops, dateProblem, launchYearOf, minPurchaseDate, todayIso } from '../lib/launch';
import type { PickRow } from '../components/LaptopPicker';

const TOPICS: [string, string, string][] = [['battery', '🔋', 'Battery'], ['performance', '⚡', 'Speed'], ['display', '🖥️', 'Screen'], ['keyboard', '⌨️', 'Keyboard'], ['heat_noise', '🌡️', 'Heat'], ['hinge', '🧱', 'Build'], ['service', '📦', 'Service']];
const PERSONAS: [string, string][] = [['student', '🎓 Student'], ['developer', '💻 Developer'], ['gamer', '🎮 Gamer'], ['creator', '🎨 Creator'], ['professional', '💼 Work']];

/** Your laptops (kept on this device) and sharing your experience. */
export function YouScreen({ mine, share, compare, goto }: { mine: Thread; share: Thread; compare: ComparePicks; goto(t: string): void }) {
  const [tab, setTab] = useState<'mine' | 'share'>('mine');
  return (
    <section className="page-enter" aria-labelledby="you-h">
      <h2 id="you-h">You</h2>
      <div className="seg you-seg" role="tablist" aria-label="Your laptops or your experience"><button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>🧳 My laptops</button><button role="tab" aria-selected={tab === 'share'} className={tab === 'share' ? 'on' : ''} onClick={() => setTab('share')}>💬 Share my experience</button></div>
      {tab === 'mine' ? <Mine thread={mine} compare={compare} goto={goto} /> : <Share thread={share} compare={compare} goto={goto} />}
    </section>
  );
}

function Mine({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const { rows } = useCatalog(); const clean = useMemo(() => ({ ...thread, turns: thread.turns.map((t) => t.reply ? { ...t, reply: { ...t.reply, blocks: cleanMyLaptops(t.reply.blocks, (id) => (rows as PickRow[]).find((r) => r.variant_id === id)) } } : t) }) as Thread, [thread, rows]);
  const ctx = buildCtx(thread, compare, goto, () => {}); const [list, setList] = useState<OwnedLaptop[]>(() => loadOwned()); const [saved, setSaved] = useState(true); const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ id: '', name: '', date: '' }); const [row, setRow] = useState<PickRow | null>(null); const first = useRef(true); const today = todayIso(); const problem = dateProblem(f.date, row, today); const lyear = launchYearOf(row);
  const compute = (l: OwnedLaptop[]) => l.length && thread.action({ owned: l.map((o) => ({ ...(o.variant_id ? { variant_id: o.variant_id } : {}), name: o.name, purchase_date: o.purchase_date || undefined, price_paid: o.price_paid })) }, 'My laptops');
  useEffect(() => { if (first.current) { first.current = false; if (list.length) compute(list); } }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const update = (next: OwnedLaptop[]) => { setList(next); setSaved(saveOwned(next)); compute(next); };
  return (
    <div>
      <p className="muted">The list lives <strong>only on this device</strong>. I work out warranty and today’s price and keep nothing.</p>
      {!saved && <p className="notice" role="alert">Not saved on this device (browser storage is blocked). It works for this visit only.</p>}
      {list.length > 0 && <ul className="my-list">{list.map((o) => <MyRow key={o.id} o={o} onRemove={() => update(list.filter((x) => x.id !== o.id))} />)}</ul>}
      {!adding ? <button className="btn ghost" onClick={() => setAdding(true)} disabled={list.length >= 10}>＋ Add a laptop</button> : (
        <div className="details-box">
          <LaptopPicker id="mine-laptop" label="Which laptop?" value={f.id} allowFree onRow={setRow} onChange={(id, name) => setF({ ...f, id, name })} hint="Type the name. Not in the catalog is fine." />
          <label htmlFor="m-date" className="field-label">When did you buy it?</label><input id="m-date" className="date" type="date" min={minPurchaseDate(row)} max={today} value={f.date} aria-invalid={!!problem} aria-describedby="m-date-help" onChange={(e) => setF({ ...f, date: e.target.value })} />
          <p id="m-date-help" className={problem ? 'error small' : 'muted small'} role={problem ? 'alert' : undefined}>{problem ?? (lyear ? `This model launched in ${lyear}.` : 'Pick a date between 2012 and today. I do not know when this model launched.')}</p>
          <button className="btn" disabled={!f.name || !!problem || thread.busy} onClick={() => { update([...list, { id: newId(), variant_id: f.id, name: f.name, purchase_date: f.date, price_paid: null }]); setF({ id: '', name: '', date: '' }); setAdding(false); }}>Add</button>
        </div>
      )}
      <ThreadView thread={clean} ctx={ctx} />
    </div>
  );
}

/** One saved laptop: swipe left (or press the "..." button) to reveal Remove. The button is the keyboard and screen-reader route. */
function MyRow({ o, onRemove }: { o: OwnedLaptop; onRemove(): void }) {
  const [open, setOpen] = useState(false); const x0 = useRef<number | null>(null);
  const end = (x: number) => { if (x0.current != null) { const d = x - x0.current; if (d < -40) setOpen(true); else if (d > 40) setOpen(false); } x0.current = null; };
  return (
    <li className={`my-row ${open ? 'open' : ''}`}>
      <div className="my-face" onTouchStart={(e) => { x0.current = e.touches[0].clientX; }} onTouchEnd={(e) => end(e.changedTouches[0].clientX)}>
        <span className="my-name">{o.name.split(' · ')[0]}<span className="muted small">{o.purchase_date ? `bought ${o.purchase_date}` : 'purchase date not set'}</span></span>
        <button type="button" className="more-btn" aria-label={`More for ${o.name.split(' · ')[0]}`} aria-expanded={open} onClick={() => setOpen(!open)}>⋯</button>
      </div>
      {open && <button type="button" className="my-remove" aria-label={`Remove ${o.name}`} onClick={onRemove}>Remove</button>}
    </li>
  );
}

function Share({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {});
  const [id, setId] = useState(''); const [stars, setStars] = useState(0); const [topic, setTopic] = useState(''); const [note, setNote] = useState(''); const [agree, setAgree] = useState(false); const [more, setMore] = useState(false);
  const [months, setMonths] = useState<number>(6); const [persona, setPersona] = useState(''); const [receipt, setReceipt] = useState(''); const [lookup, setLookup] = useState(false);
  const len = note.trim().length; const contact = /https?:\/\/|www\.|[\w.+-]+@[\w-]+\.\w+|\b\d{10}\b/i.test(note);
  const ok = id && agree && len >= 10 && len <= 800 && !contact;
  return (
    <div>
      <div className="notice" role="note"><p><strong>Before you submit.</strong> I do not collect your name, email or phone number. A person reads every report before it is shown (usually within 48 hours) and it is labelled “owner-reported, not verified”. You get a code to check or delete it any time.</p></div>
      <LaptopPicker id="share-laptop" label="Which laptop do you own?" value={id} onChange={(v) => setId(v)} />
      <div className="field-label">How is it?</div><Stars value={stars} onChange={setStars} label="Your rating" />
      <div className="field-label">What is it about?</div><div className="chips" role="group" aria-label="Topic">{TOPICS.map(([v, i, l]) => <button type="button" key={v} className={`chip ${topic === v ? 'on' : ''}`} aria-pressed={topic === v} onClick={() => setTopic(topic === v ? '' : v)}><span aria-hidden="true">{i}</span> {l}</button>)}</div>
      <label htmlFor="x-note" className="sr-only">Your experience</label>
      <textarea id="x-note" className="big-text" rows={3} maxLength={800} value={note} onChange={(e) => setNote(e.target.value)} placeholder="In a sentence or two: what is it like to live with?" aria-invalid={contact} />
      {contact && <p className="error small">Please remove links, email addresses and phone numbers.</p>}
      <button type="button" className="link more-toggle" aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Hide' : 'Add more'} (optional)</button>
      {more && <div className="details-box"><NumberField id="months" label="Owned for" unit="months" value={months} min={0} max={120} step={1} onChange={(v) => setMonths(v ?? 0)} />
        <div className="chips" role="group" aria-label="You mostly use it as">{PERSONAS.map(([v, l]) => <button type="button" key={v} className={`chip ${persona === v ? 'on' : ''}`} aria-pressed={persona === v} onClick={() => setPersona(persona === v ? '' : v)}>{l}</button>)}</div></div>}
      <label className="check-row"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I am 18 or older and I agree to the notice above</label>
      <button className="btn big-cta" disabled={!ok || thread.busy || thread.cooldown > 0} onClick={() => thread.action({ experience: { variant_id: id, months_owned: more ? months : null, persona: persona || null, topic: topic || null, rating: stars || null, note: note.trim(), adult_confirmed: agree, consent: agree } }, 'Share my experience').then((done) => { if (done) { setId(''); setStars(0); setTopic(''); setNote(''); setAgree(false); } })}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : 'Send for review'}</button>
      <ThreadView thread={thread} ctx={ctx} />
      <button type="button" className="link more-toggle" aria-expanded={lookup} onClick={() => setLookup(!lookup)}>Already sent one? Check or delete it</button>
      {lookup && <div className="details-box"><label htmlFor="x-receipt" className="field-label">Your receipt code</label><input id="x-receipt" className="date" value={receipt} onChange={(e) => setReceipt(e.target.value.toUpperCase())} maxLength={12} autoComplete="off" />
        <div className="inline"><button className="btn small" disabled={receipt.length < 6 || thread.busy} onClick={() => thread.action({ action: 'report_status', receipt }, 'Check my report')}>Check status</button>
          <button className="btn small danger" disabled={receipt.length < 6 || thread.busy} onClick={() => { if (window.confirm('Delete this report permanently? This cannot be undone.')) thread.action({ action: 'report_delete', receipt }, 'Delete my report'); }}>Delete report</button></div></div>}
    </div>
  );
}
