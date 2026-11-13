import { BottomSheet } from './BottomSheet';
import { Provenance } from './blocks/Misc';
import { LANGS } from '../lib/speech';
import { getVoiceLang, setVoiceLang } from './Composer';
import type { Block, Reply } from '../lib/types';
import { useState } from 'react';

/** The one place for "why should I trust this": plain reasons, what the data is, the receipt of the latest answer, Market and About, and the voice language. */
export function TrustSheet({ open, onClose, notice, footer, status, reply }: { open: boolean; onClose(): void; notice: string; footer: string; status: Block | null; reply?: Reply | null }) {
  const [lang, setLang] = useState(getVoiceLang);
  const receipt = reply?.blocks.find((b) => b.type === 'provenance');
  return (
    <BottomSheet open={open} onClose={onClose} title="Why trust this?">
      <div className="trust-sheet">
        <ul className="why">
          <li><strong>Prices have dates.</strong> Every price shows the day it was saved. It is a snapshot, not a live shop price.</li>
          <li><strong>Specs are not checked by a person yet.</strong> They come from listing data, so we say “Not human-verified”.</li>
          <li><strong>Owner opinions are counted, not invented.</strong> A computer reads real reviews, counts duplicates once, and shows how many opinions stand behind each point.</li>
          <li><strong>The AI never sets prices, specs or counts.</strong> It helps me read your question and word the answer. Every number is checked against the stored data again before you see it.</li>
          <li><strong>What you type is saved for 30 days.</strong> Everything you type or tap is kept with an anonymous daily code to fix problems and improve LapFit. Please do not type personal details. Pictures are not saved.</li>
          <li><strong>Shop links may be affiliate links.</strong> They never change what is shown or in what order.</li>
        </ul>
        <h3>What the data is</h3>
        <p>{notice}</p>
        <p className="small muted">Catalog laptops have dated prices and owner opinions. Laptops from the web are read from live pages and are not verified.</p>
        {status && <p className="small muted">{status.variants} laptops ({status.laptops_with_price} with a price), {status.reviews} reviews read, {status.opinions} owner opinions, {status.verified_variants} checked by a person.</p>}
        <p className="small muted">{footer}</p>
        <h3>Receipt for the latest answer</h3>
        {receipt ? <Provenance b={receipt} /> : <p className="small muted">Ask something first. The receipt (“How I built this answer”) then appears here.</p>}
        <h3>More</h3>
        <p className="sheet-links"><a href="#/market" onClick={onClose}>Market</a><a href="#/about" onClick={onClose}>Sources, privacy and limits</a></p>
        <label className="sheet-lang">Voice language <select value={lang} onChange={(e) => { setLang(e.target.value); setVoiceLang(e.target.value); }}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></label>
      </div>
    </BottomSheet>
  );
}
