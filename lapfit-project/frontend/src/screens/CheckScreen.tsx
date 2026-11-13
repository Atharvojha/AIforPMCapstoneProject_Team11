import { useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { Dropzone } from '../components/Dropzone';
import { useImageAttach } from '../components/useImageAttach';
import { LaptopPicker } from '../components/LaptopPicker';
import { getSession, setSession } from '../lib/storage';
import { fmtWait } from '../lib/wait';

const Tri = ({ label, value, onChange }: { label: string; value: boolean | null; onChange(v: boolean | null): void }) => (
  <div className="tri" role="group" aria-label={label}><span>{label}</span>{([[true, 'Yes'], [false, 'No']] as const).map(([v, t]) => <button type="button" key={t} className={`chip ${value === v ? 'on' : ''}`} aria-pressed={value === v} onClick={() => onChange(value === v ? null : v)}>{t}</button>)}</div>
);

/** Snap a picture or paste what the seller said. That is all you have to do. Details are optional. */
export function CheckScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {}); const pic = useImageAttach();
  const [hint] = useState<{ laptop?: string } | null>(() => { const p = getSession<{ laptop?: string } | null>('lapfit.prefill', null); if (p) setSession('lapfit.prefill', null); return p; });
  const [text, setText] = useState(''); const [more, setMore] = useState(!!hint); const [laptop, setLaptop] = useState(''); const [battery, setBattery] = useState(80); const [knowBattery, setKnowBattery] = useState(false);
  const [bill, setBill] = useState<boolean | null>(null); const [serial, setSerial] = useState<boolean | null>(null);
  const busy = thread.busy || thread.cooldown > 0 || pic.prep;
  const mode = pic.img ? 'picture' : more && laptop ? 'details' : text.trim().length >= 6 ? 'text' : 'none';
  const ready = mode !== 'none' && !(mode === 'picture' && !pic.consented);
  const go = async () => {
    if (!ready || busy) return;
    if (mode === 'picture' && pic.img) { const ok = await thread.action({ action: 'read_image', image: { mime: pic.img.mime, data: pic.img.data } }, '📷 Picture'); if (ok) pic.clear(); return; }
    if (mode === 'details') { await thread.action({ action: 'used_check', variant_id: laptop, listing: { battery_health_pct: knowBattery ? battery : null, has_bill: bill, has_serial: serial, reason: text.trim().slice(0, 200) || null } }, 'Check this listing'); return; }
    await thread.sendText(`The seller said: ${text.trim()}`);
  };
  return (
    <section className="page-enter" aria-labelledby="check-h">
      <h2 id="check-h">Check a seller or a listing</h2>
      <p className="muted screen-lead">Show me what you were told. I check it against the catalog, and I never say “buy” or “don’t buy”.</p>
      {hint && <p className="notice" role="note">From your picture{hint.laptop ? `: ${hint.laptop}` : ''}. Pick the laptop below.</p>}
      <Dropzone onFile={(f) => void pic.attach(f)} preview={pic.img?.previewUrl} busy={pic.prep} onClear={pic.clear} />
      {pic.err && <p className="error small" role="alert">{pic.err}</p>}
      {pic.img && !pic.consented && <label className="consent"><input type="checkbox" onChange={(e) => e.target.checked && pic.agree()} /> I understand this picture is sent to Google’s Gemini AI to be read. LapFit does not store it. I have not included faces or other people’s details.</label>}
      <p className="or-line"><span>or paste what the seller said</span></p>
      <label htmlFor="pitch" className="sr-only">What the seller said</label>
      <textarea id="pitch" className="big-text" rows={3} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="“16 GB RAM, battery lasts 2 days, 3 year warranty…”" />
      <button type="button" className="link more-toggle" aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Hide' : 'I know more: add details'} (optional)</button>
      {more && (
        <div className="details-box">
          <LaptopPicker id="chk-laptop" label="Which laptop?" value={laptop} onChange={(id) => setLaptop(id)} optional />
          <div className="inline-slider"><label className="check-row"><input type="checkbox" checked={knowBattery} onChange={(e) => setKnowBattery(e.target.checked)} /> I know the battery health</label>
            {knowBattery && <><input type="range" min={40} max={100} step={1} value={battery} onChange={(e) => setBattery(Number(e.target.value))} aria-label="Battery health percent" /><strong className="big">{battery}%</strong></>}</div>
          <Tri label="Original bill?" value={bill} onChange={setBill} /><Tri label="Serial number given?" value={serial} onChange={setSerial} />
        </div>
      )}
      <button className="btn big-cta" disabled={!ready || busy} onClick={go}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : pic.prep ? 'Getting it ready…' : mode === 'picture' ? 'Read the picture' : 'Check it'}</button>
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
