import { useCtx } from '../ctx';
import { daysOld, freshness } from '../../lib/viz';
import { TrustLine } from '../TrustLine';
import { LaptopImage } from '../LaptopImage';
import { CountUp } from '../viz/CountUp';
import { SpecPortrait } from '../viz/SpecPortrait';
import { useState } from 'react';
import { useAllLooks } from '../../state/useLooks';
import { fromCard, differenceTags } from '../../lib/looks';
import { type Card, brandOf, versionOf, priceKnown, priceShown, storage, verdictOf, musts, deltaLine, missesMust } from './BoardLogic';

const TICK: Record<string, { icon: string; word: string }> = { true: { icon: '✓', word: 'Meets' }, false: { icon: '✗', word: 'Does not meet' }, null: { icon: '?', word: 'Unknown' } };

/** Opens the Detail sheet. Until the app provides openDetail, the same card still reaches its full check. */
export function useOpenDetail() {
  const ctx = useCtx();
  return (c: Card) => { const open = (ctx as any).openDetail as ((c: Card) => void) | undefined; if (open) open(c); else ctx.action({ action: 'second_opinion', variant_id: c.variant_id }, `Second opinion on ${brandOf(c)}`); };
}

/** The compare toggle that sits on a photo or at the end of a row. Its name stays "Compare" so a screen reader hears one clear control. */
export function CompareToggle({ c, plus = false }: { c: Card; plus?: boolean }) {
  const ctx = useCtx(); const picked = ctx.compare.has(c.variant_id);
  return (
    <label className={`b-pick ${plus ? 'plus' : ''} ${picked ? 'on' : ''}`} title={`${picked ? 'Remove from' : 'Add to'} compare: ${brandOf(c)}`}>
      <input type="checkbox" checked={picked} onChange={() => ctx.compare.toggle(c.variant_id, c.name)} aria-label="Compare" />
      <span aria-hidden="true">{plus ? (picked ? '✓' : '+') : picked ? '✓ Picked' : '+ Compare'}</span>
    </label>
  );
}

function FreshTrust({ c, compact }: { c: Card; compact?: boolean }) {
  const fr = freshness(daysOld(c.as_of)); const verified = c.data_status === 'Verified'; const e = c.evidence;
  return (
    <div className={`fresh ${fr.tone}`}>
      <TrustLine compact={compact} asOf={`${c.as_of_text} (${fr.text})`} owners={e.n} verified={verified} extra={!compact && !e.enough ? `still collecting (need ${e.min_n ?? 20})` : undefined} />
    </div>
  );
}

const priceKnownOrSpecs = (l: { screen: number | null; weight: number | null }) => l.screen != null || l.weight != null;   // the drawing needs at least one recorded size

/** The best fit: seven things. Photo (with the compare toggle), name, price, why it fits, key specs, trust line, one button. */
/** How well a laptop satisfies what the person stated, from recorded values only. The reasons are one tap away. */
export function MatchPill({ c, compact = false }: { c: Card; compact?: boolean }) {
  const m = c.match; if (!m) return null;
  const tone = m.pct >= 75 ? 'high' : m.pct >= 50 ? 'mid' : 'low';
  return (
    <span className={`match-pill ${tone} ${compact ? 'compact' : ''}`}>
      <b>{m.label}</b>
      {!compact && <details className="match-why"><summary>Why {m.pct}%?</summary><ul>{m.basis.map((l, i) => <li key={i}>{l}</li>)}</ul><p className="muted small">This is a fit score from recorded values, not a promise. Anything not recorded earns nothing. The order also weighs owner opinions and your budget, so it can differ slightly from the percentages.</p></details>}
    </span>
  );
}

export function BoardHero({ c, eyebrow, tie = false }: { c: Card; eyebrow: string | null; tie?: boolean }) {
  const ctx = useCtx(); const open = useOpenDetail(); const s = c.specs ?? {}; const brand = brandOf(c); const version = versionOf(c); const verdict = verdictOf(c); const must = musts(c);
  const [drawing, setDrawing] = useState(false); const photo = !!c.image && !drawing; const all = useAllLooks(); const look = fromCard(c); const tags = differenceTags(look, all, 2);
  return (
    <article className={`bhero ${tie ? 'tie' : ''}`} aria-label={c.name}>
      <div className="bhero-photo">
        {photo || !priceKnownOrSpecs(look)
          ? <LaptopImage pic={c.image} brand={c.brand ?? brand.split(' ')[0]} name={brand} screen={s.display_size} weight={s.weight_kg} />
          : <div className="look-art"><SpecPortrait look={look} /><span className="look-note">{c.image ? 'Drawn from the specs, not a photo' : 'Drawn from the specs. No photo on file for this laptop'}</span></div>}
        {priceKnownOrSpecs(look) && c.image && <button type="button" className="look-switch" aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>{photo ? 'Show drawing' : 'Show photo'}</button>}
        <CompareToggle c={c} />
      </div>
      <div className="bhero-body">
        {(eyebrow || tie) && <p className="b-eyebrow">{tie && <b className="tie-tag">Tie</b>}{eyebrow}</p>}
        <h4 className="b-name">{brand}</h4>
        {version && <p className="b-version">{version}</p>}
        <p className="b-price"><strong>{priceKnown(c) ? <CountUp to={c.price_inr as number} text={c.price_text} /> : '?'}</strong></p>
        <MatchPill c={c} />
        {tags.length > 0 && <ul className="b-tags" aria-label="What stands out">{tags.map((t) => <li key={t.txt} className={`tag ${t.hi ? 'hi' : ''}`}>{t.txt}</li>)}</ul>}
        {verdict && <p className="b-verdict">{verdict}</p>}
        {must.length > 0 && (
          <ul className="musts" aria-label="Your Must items">{must.map((m, i) => (
            <li key={i} className={`must ${String(m.ok)}`}><span className="tick" aria-hidden="true">{TICK[String(m.ok)].icon}</span><span className="sr-only">{TICK[String(m.ok)].word}: </span>{m.label}<span className="muted small"> ({m.actual})</span></li>
          ))}</ul>
        )}
        <ul className="b-specs" aria-label="Key specs">
          <li>{s.ram_gb != null ? `${s.ram_gb} GB RAM` : '? RAM'}</li><li>{storage(s.storage_gb)}{s.storage_gb == null ? ' storage' : ''}</li>
          <li>{s.display_size != null ? `${s.display_size}″` : '? screen'}</li><li>{s.weight_kg != null ? `${s.weight_kg} kg` : '? weight'}</li>
        </ul>
        <FreshTrust c={c} />
        <div className="b-actions">
          <button className="btn b-details" onClick={() => open(c)}>Details</button>
          <button className="btn soft b-buy" disabled={ctx.busy} onClick={() => ctx.action({ action: 'where_to_buy', variant_id: c.variant_id }, `Where to buy ${brand}`)}><span aria-hidden="true">🛒</span> Where to buy</button>
        </div>
      </div>
    </article>
  );
}

/** A compact row: thumbnail, name and price, how it differs from the best fit, and a compare toggle. Tapping the row opens the details. */
export function BoardRow({ c, hero }: { c: Card; hero: Card }) {
  const open = useOpenDetail(); const s = c.specs ?? {}; const brand = brandOf(c);
  return (
    <article className="brow" aria-label={c.name}>
      <button className="brow-main" onClick={() => open(c)} aria-label={`Details: ${brand}`}>
        <span className="brow-thumb" aria-hidden="true"><LaptopImage pic={c.image} brand={c.brand ?? brand.split(' ')[0]} name={brand} screen={s.display_size} weight={s.weight_kg} caption={false} /></span>
        <span className="brow-text">
          <span className="brow-top"><strong className="brow-name">{brand}</strong><strong className="brow-price">{priceShown(c)}</strong></span>
          <MatchPill c={c} compact />
          <span className={`brow-delta ${missesMust(c) ? 'miss' : ''}`}>{deltaLine(c, hero)}{missesMust(c) ? ' · misses a Must' : ''}</span>
          <FreshTrust c={c} compact />
        </span>
      </button>
      <CompareToggle c={c} plus />
    </article>
  );
}
