import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { BottomSheet } from '../BottomSheet';
import { TrustLine } from '../TrustLine';
import { Radar } from '../viz/Radar';
import { Ring } from '../viz/Ring';
import { LaptopImage } from '../LaptopImage';
import { Provenance } from './Misc';
import { Bottles, PositionStrips } from '../viz/Looks';
import { useAllLooks } from '../../state/useLooks';
import { fromCard } from '../../lib/looks';
import { axesFor, norm } from '../../lib/viz';
import type { Block } from '../../lib/types';
import type { DetailCard, DetailTab } from '../ctx';

const TABS: { id: DetailTab; label: string }[] = [{ id: 'fit', label: 'Fit' }, { id: 'specs', label: 'Specs' }, { id: 'trust', label: 'Trust' }];
const TICK: Record<string, { icon: string; word: string }> = { true: { icon: '✓', word: 'Meets' }, false: { icon: '✗', word: 'Does not meet' }, null: { icon: '?', word: 'Unknown' } };
const storage = (g: number | null | undefined) => (g == null ? '?' : g >= 1024 ? `${g / 1024} TB` : `${g} GB`);

/** What the reply that showed this laptop says about its own links and data, read from its provenance block. Nothing is invented: no block, no label. */
export function replyFacts(blocks: Block[] | undefined) {
  const prov = blocks?.find((b) => b.type === 'provenance') as Block | undefined;
  const cards = (blocks?.filter((b) => b.type === 'cards').flatMap((b) => b.cards as DetailCard[])) ?? [];
  return { prov, cards, affiliate: !!prov?.affiliate?.links, live: !!prov?.catalog?.live };
}

/** The one place for everything about a laptop: Fit, Specs, Trust, with the next steps pinned at the bottom. A bottom sheet on phones, a docked pane on wide screens (BottomSheet does both). */
export function DetailSheet({ card, tab: first = 'fit', blocks, busy, onClose, onAction }: {
  card: DetailCard | null; tab?: DetailTab; blocks?: Block[]; busy: boolean; onClose: () => void; onAction: (body: Record<string, unknown>, label: string) => void;
}) {
  // every hook is called before the early return below: the sheet starts with no laptop and gets one when Details is tapped
  const [tab, setTab] = useState<DetailTab>(first); const uid = useId(); const refs = useRef<Record<string, HTMLButtonElement | null>>({}); const all = useAllLooks();
  useEffect(() => { if (card) setTab(first); }, [card?.variant_id, first]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!card) return null;
  const c = card; const look = fromCard(c); const brand = c.name.split(' · ')[0]; const version = c.name.split(' · ')[1]; const s = c.specs ?? {};
  const { prov, cards, affiliate, live } = replyFacts(blocks);
  const set = cards.some((x) => x.variant_id === c.variant_id) ? cards : [c];
  const axesAll = set.map((x) => axesFor(x)); const mine = axesAll[set.findIndex((x) => x.variant_id === c.variant_id)];
  const norms = mine.map((a, ai) => norm(a.value, axesAll.map((x) => x[ai].value), a.higherIsBetter));
  const min = c.evidence.min_n ?? 20; const verified = c.data_status === 'Verified';
  const fire = (body: Record<string, unknown>, label: string) => { onClose(); onAction(body, label); };
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab); const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
    e.preventDefault(); const n = TABS[(i + d + TABS.length) % TABS.length].id; setTab(n); refs.current[n]?.focus();
  };
  return (
    <BottomSheet open onClose={onClose} title={brand}>
      <div className="detail">
        <div className="detail-top">
          <LaptopImage pic={c.image} brand={c.brand ?? brand.split(' ')[0]} name={brand} screen={s.display_size} weight={s.weight_kg} />
          <div><p className="detail-price"><strong>{typeof c.price_inr === 'number' && c.price_inr > 0 && c.price_text ? c.price_text : '?'}</strong></p>{version && <p className="muted small">{version}</p>}
            <TrustLine asOf={c.as_of_text || '?'} owners={c.evidence.n} verified={verified} compact /></div>
        </div>
        <div className="detail-tabs" role="tablist" aria-label="About this laptop" onKeyDown={onKey}>
          {TABS.map((t) => <button key={t.id} id={`${uid}-t-${t.id}`} ref={(el) => { refs.current[t.id] = el; }} role="tab" aria-selected={tab === t.id} aria-controls={`${uid}-p`} tabIndex={tab === t.id ? 0 : -1} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <div className="detail-panel" role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-t-${tab}`} key={tab}>
          {tab === 'fit' && <>
            {c.reasons.length > 0 && <ul className="detail-reasons" aria-label="Why it fits">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
            {c.musts.length > 0 && <>
              <h3 className="detail-h">What you asked for</h3>
              <ul className="detail-musts">{c.musts.map((m, i) => <li key={i} className={`m-${String(m.ok)}`}><span className="tick" aria-hidden="true">{TICK[String(m.ok)].icon}</span><span className="sr-only">{TICK[String(m.ok)].word}: </span>{m.label}<small> {m.actual}</small></li>)}</ul></>}
            <div className="detail-viz">
              <figure><Radar axes={mine} norms={norms} name={brand} size={132} /><figcaption className="muted small">Shape, compared with the other laptops in this list. “?” means unknown.</figcaption></figure>
              <Ring value={c.evidence.n / min} label={String(c.evidence.n)} tone={c.evidence.enough ? 'good' : 'warn'} caption={c.evidence.enough ? `${c.evidence.positive} of ${c.evidence.n} owner opinions positive` : `Collecting owner opinions: ${c.evidence.n} of ${min}`} />
            </div>
            <h3 className="detail-h">How heavy it is, and where it sits</h3>
            <Bottles kg={look.weight} />
            <PositionStrips look={look} all={all} />
          </>}
          {tab === 'specs' && <>
            <ul className="detail-keys" aria-label="Key specs">
              <li><strong>{s.ram_gb != null ? `${s.ram_gb} GB` : '?'}</strong><small>RAM</small></li><li><strong>{storage(s.storage_gb)}</strong><small>Storage</small></li>
              <li><strong>{s.display_size != null ? `${s.display_size}″` : '?'}</strong><small>Screen</small></li><li><strong>{s.weight_kg != null ? `${s.weight_kg} kg` : '?'}</strong><small>Weight</small></li>
            </ul>
            <ul className="detail-specs">{c.spec_lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            {c.unknown_fields.length > 0 && <p className="muted small">Not in the catalog yet (shown as “?”): {c.unknown_fields.join(', ')}.</p>}
          </>}
          {tab === 'trust' && <>
            <TrustLine asOf={c.as_of_text || '?'} owners={c.evidence.n} verified={verified} />
            <dl className="detail-trust">
              <dt>Price</dt><dd>From a saved snapshot dated {c.as_of_text || '?'}, not a live price. The shop can differ, so check before you pay.</dd>
              <dt>Specs</dt><dd>{verified ? 'Checked by a person.' : 'Imported listing data. No person has verified it yet.'}</dd>
              <dt>Owner opinions</dt><dd>{c.evidence.text} They were read by a machine from reviews, so they are a guide, not a guarantee.</dd>
              <dt>Pictures</dt><dd>From the web. They may not show this exact version.</dd>
            </dl>
            {prov ? <Provenance b={prov} /> : <p className="muted small">The full “How I built this answer” receipt is shown under the list this laptop came from.</p>}
          </>}
        </div>
        <div className="detail-actions" role="group" aria-label={`What next for ${brand}`}>
          <button className="btn buy" disabled={busy} onClick={() => fire({ action: 'where_to_buy', variant_id: c.variant_id }, `Where to buy ${brand}`)}>
            <span>Where to buy</span>{(affiliate || live) && <span className="tags">{affiliate && <i>Affiliate</i>}{live && <i>Live</i>}</span>}</button>
          <button className="btn soft" disabled={busy} onClick={() => fire({ action: 'owner_voice', variant_id: c.variant_id }, `What owners say about ${brand}`)}>Owners say</button>
          <button className="btn soft" disabled={busy} onClick={() => fire({ action: 'second_opinion', variant_id: c.variant_id }, `Second opinion on ${brand}`)}>Full check</button>
        </div>
      </div>
    </BottomSheet>
  );
}
