import { useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';
import { Dropzone } from '../components/Dropzone';
import { useImageAttach } from '../components/useImageAttach';
import { LaptopPicker } from '../components/LaptopPicker';
import { CheckDetails, hasKnown, noKnown, type Known } from '../components/CheckDetails';
import { getSession, setSession } from '../lib/storage';
import { fmtWait } from '../lib/wait';

/** Check a seller or a listing: 1 add the listing, 2 say which laptop (optional), 3 anything you already know (optional). One button. */
export function CheckScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {}); const pic = useImageAttach();
  const [hint] = useState<{ laptop?: string } | null>(() => { const p = getSession<{ laptop?: string } | null>('lapfit.prefill', null); if (p) setSession('lapfit.prefill', null); return p; });
  const [text, setText] = useState(''); const [laptop, setLaptop] = useState({ id: '', text: '' }); const [more, setMore] = useState(false); const [k, setK] = useState<Known>(noKnown);
  const busy = thread.busy || thread.cooldown > 0 || pic.prep;
  const named = !!laptop.id || laptop.text.length >= 3;
  const mode = pic.img ? 'picture' : named || hasKnown(k) ? 'details' : text.trim().length >= 6 ? 'text' : 'none';
  const ready = mode !== 'none' && !(mode === 'picture' && !pic.consented);
  const go = async () => {
    if (!ready || busy) return;
    if (mode === 'picture' && pic.img) { const ok = await thread.action({ action: 'read_image', image: { mime: pic.img.mime, data: pic.img.data } }, 'Picture'); if (ok) pic.clear(); return; }
    if (mode === 'details') {
      const listing: Record<string, unknown> = {};
      if (k.price != null) listing.price_inr = k.price; if (k.age != null) listing.age_years = k.age; if (k.battery != null) listing.battery_health_pct = k.battery;
      if (k.warranty === 'yes' && k.warrantyMonths != null) listing.seller_warranty_months = k.warrantyMonths; if (k.warranty === 'no') listing.seller_warranty_months = 0;
      if (k.bill != null) listing.has_bill = k.bill; if (k.box != null) listing.has_box = k.box; if (text.trim()) listing.reason = text.trim().slice(0, 200);
      await thread.action({ action: 'used_check', ...(laptop.id ? { variant_id: laptop.id } : laptop.text ? { laptop_text: laptop.text } : {}), listing }, `Check this listing${laptop.text ? `: ${laptop.text}` : ''}`); return;
    }
    await thread.sendText(`The seller said: ${text.trim()}`);
  };
  return (
    <section className="page-enter check-screen" aria-labelledby="check-h">
      <h2 id="check-h">Check a seller or a listing</h2>
      <p className="muted screen-lead">Show me what you were told. I check it against the catalog, and I never say “buy” or “don’t buy”.</p>
      {hint && <p className="notice" role="note">From your picture{hint.laptop ? `: ${hint.laptop}` : ''}. Name the laptop in step 2.</p>}
      <div className="step-card" role="group" aria-labelledby="chk-s1">
        <h3 id="chk-s1" className="step-h"><span className="step-n" aria-hidden="true">1</span>Add the listing</h3>
        <Dropzone onFile={(f) => void pic.attach(f)} preview={pic.img?.previewUrl} busy={pic.prep} onClear={pic.clear} />
        {pic.err && <p className="error small" role="alert">{pic.err}</p>}
        {pic.img && !pic.consented && <label className="consent"><input type="checkbox" onChange={(e) => e.target.checked && pic.agree()} /> I understand this picture is sent to Google’s Gemini AI to be read. LapFit does not store it. I have not included faces or other people’s details.</label>}
        <p className="or-line"><span>or paste what the seller said</span></p>
        <label htmlFor="pitch" className="sr-only">What the seller said</label>
        <textarea id="pitch" className="big-text" rows={3} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="“16 GB RAM, battery lasts 2 days, 3 year warranty…”" />
      </div>
      <div className="step-card" role="group" aria-labelledby="chk-s2">
        <h3 id="chk-s2" className="step-h"><span className="step-n" aria-hidden="true">2</span>Which laptop? <span className="muted small">(optional)</span></h3>
        <LaptopPicker id="chk-laptop" label="Laptop name" value={laptop.id} onChange={(id, name, free) => setLaptop({ id, text: free ? name : '' })} allowFree optional hint="Type the name from the listing. Not in the catalog is fine." />
      </div>
      <div className="step-card" role="group" aria-labelledby="chk-s3">
        <h3 id="chk-s3" className="step-h"><span className="step-n" aria-hidden="true">3</span>Anything you already know <span className="muted small">(optional)</span></h3>
        <button type="button" className="link more-toggle" aria-expanded={more} aria-controls="chk-more" onClick={() => setMore(!more)}>{more ? 'Hide the details' : 'Add what you know: price, age, battery, warranty'}</button>
        <div id="chk-more" hidden={!more}>{more && <CheckDetails k={k} onChange={setK} />}</div>
      </div>
      <button className="btn big-cta" disabled={!ready || busy} onClick={go}>{thread.cooldown > 0 ? `Wait ${fmtWait(thread.cooldown)}` : pic.prep ? 'Getting it ready…' : mode === 'picture' ? 'Read the picture' : 'Check it'}</button>
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
