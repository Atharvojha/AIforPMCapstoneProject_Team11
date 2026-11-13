import { useEffect, useState } from 'react';
import { useCtx } from '../ctx';
import type { Block, Needs, RawCriterion } from '../../lib/types';
import { moveNeed, parseBudget, inr, sameNeeds, cleanNeeds, type Tier } from '../../lib/needs';
import { loadChecks, saveChecks, setSession } from '../../lib/storage';
import { useApiConfig } from '../api-context';
import { reportClick } from '../../lib/clientLog';
import { fmtDateShort } from '../../lib/dates';
import { BudgetSlider, BUDGET_STEPS } from '../viz/BudgetSlider';
import { useCatalog } from '../../state/useCatalog';

export const Notice = ({ b }: { b: Block }) => <p className="notice" role="note">{b.text}</p>;
export const TextBlock = ({ b }: { b: Block }) => <p className="text">{b.text}</p>;

export function Choices({ b }: { b: Block }) {
  const ctx = useCtx();
  return (
    <div className="choices" role="group" aria-label={b.question}>
      <p className="question">{b.question}</p>
      <div className="chips">
        {(b.choices as { label: string; send: string }[]).map((c) => (
          <button key={c.label} className="chip action" disabled={ctx.busy} onClick={() => (c.send.endsWith(' ') ? ctx.prefill(c.send) : ctx.sendText(c.send))}>{c.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Offer({ b }: { b: Block }) {
  const ctx = useCtx();
  return (
    <div className="offer">
      <span>{b.label}</span>
      {b.needs ? <button className="btn small" disabled={ctx.busy} onClick={() => ctx.sendNeeds(b.needs as Needs)}>Show these</button>
        : <button className="btn small" onClick={() => ctx.goto('find')}>Pick what matters to you</button>}
    </div>
  );
}

const TIERS: { key: Tier; label: string; hint: string }[] = [{ key: 'musts', label: 'Must', hint: 'filters the list' }, { key: 'shoulds', label: 'Should', hint: 'ranks higher' }, { key: 'nices', label: 'Nice', hint: 'small bonus' }];
const ORDER: Tier[] = ['shoulds', 'musts', 'nices'];
const label = (c: RawCriterion) => c.label ?? `${c.attribute} ${String(c.value)}`;

/** What I understood, as chips you tap. Tap a chip to change how much it matters (Should, Must, Nice); ✕ removes it; drag the budget. */
export function Understood({ b }: { b: Block }) {
  const ctx = useCtx(); const original = b.needs as Needs; const { rows } = useCatalog();
  const [needs, setNeeds] = useState<Needs>(original); const [budget, setBudget] = useState<number | null>(original.budget_max_inr);
  useEffect(() => { setNeeds(original); setBudget(original.budget_max_inr); }, [b]);   // eslint-disable-line react-hooks/exhaustive-deps
  const edited: Needs = { ...needs, budget_max_inr: budget }; const changed = !sameNeeds(edited, original);
  const prices = rows.filter((r) => r.recommendable && r.price_inr != null).map((r) => r.price_inr as number);
  const all = TIERS.flatMap(({ key }) => needs[key].map((c, i) => ({ c, key, i })));
  const cycle = (key: Tier, i: number) => setNeeds(moveNeed(needs, key, i, ORDER[(ORDER.indexOf(key) + 1) % ORDER.length]));
  return (
    <section className="understood" aria-label="What I understood">
      <details className="understood-fold">
      <summary><span className="u-label">What I understood</span><span className="u-sum">{needs.use_cases.map((u) => `🎯 ${u}`).join(' · ')}{needs.use_cases.length && budget != null ? ' · ' : ''}{budget != null ? `up to ₹${budget.toLocaleString('en-IN')}` : 'no budget limit'}</span><span className="u-edit">Change</span></summary>
      <div className="need-chips">
        {needs.use_cases.map((u) => <span key={u} className="need-chip use">🎯 {u}</span>)}
        {all.map(({ c, key, i }) => (
          <span key={`${key}${i}`} className={`need-chip tier-${key} ${c.supported === false ? 'unsupported' : ''}`}>
            <button type="button" className="need-main" onClick={() => cycle(key, i)} aria-label={`${label(c)}: ${TIERS.find((t) => t.key === key)!.label}. Tap to change how much it matters.`}>
              <span className="tier-badge">{TIERS.find((t) => t.key === key)!.label}</span>{label(c)}{c.supported === false && <em> (cannot be checked yet)</em>}</button>
            <button type="button" className="need-x" aria-label={`Remove ${label(c)}`} onClick={() => setNeeds(moveNeed(needs, key, i, null))}>✕</button>
          </span>
        ))}
      </div>
      {budget != null ? <BudgetSlider value={budget} onChange={setBudget} prices={prices} /> : <button type="button" className="chip" onClick={() => setBudget(BUDGET_STEPS[4])}>＋ Add a budget</button>}
      {budget != null && <button type="button" className="link small" onClick={() => setBudget(null)}>No budget limit</button>}
      <p className="muted small">{b.matched === 0 ? 'No laptop meets every Must yet. Tap a Must to make it a Should, or raise the budget.' : `${b.matched} laptop${b.matched === 1 ? '' : 's'} in the catalog meet every Must.`} <strong>Must</strong> filters, <strong>Should</strong> ranks higher, <strong>Nice</strong> is a small bonus.</p>
      {changed && <button className="btn" disabled={ctx.busy} onClick={() => ctx.sendNeeds(cleanNeeds(edited))}>Update results</button>}
      </details>
    </section>
  );
}

const SEV: Record<string, { icon: string; word: string }> = { warn: { icon: '!', word: 'Check' }, info: { icon: 'i', word: 'Note' }, ok: { icon: '✓', word: 'OK' } };
const RANK: Record<string, number> = { warn: 0, info: 1, ok: 2 };
/** The check result: a verdict line made only from the counts of what the checks returned (never "buy" or "don't buy"), the 4 most important findings, and the rest behind "Show all". */
export function Findings({ b }: { b: Block }) {
  const [all, setAll] = useState(false);
  const f = b.findings as { severity: string; text: string }[]; const count = (k: string) => f.filter((x) => x.severity === k).length; const warn = count('warn');
  const sorted = [...f].sort((x, y) => (RANK[x.severity] ?? 3) - (RANK[y.severity] ?? 3)); const shown = all ? sorted : sorted.slice(0, 4);
  const tone = warn > 0 ? 'warn' : 'ok';
  return (
    <section className="findings" aria-label="Findings">
      <div className={`verdict-hero ${tone}`}>
        <span className="verdict-mark" aria-hidden="true">{warn > 0 ? '!' : '✓'}</span>
        <div><h3>What I found</h3>
          <p className="verdict-line"><strong>{warn > 0 ? `${warn} thing${warn === 1 ? '' : 's'} to ask about before you pay` : 'Nothing flagged in what I could check'}</strong></p>
          <p className="muted small">{count('ok')} look fine · {count('info')} note{count('info') === 1 ? '' : 's'}.</p></div>
      </div>
      {f.length === 0 && <p className="empty-note">Nothing to flag. That is not a guarantee, so check the seller and the return policy.</p>}
      <ul className="list">{shown.map((x, i) => (
        <li key={i} className={`finding ${x.severity}`}><span className="sev" aria-hidden="true">{SEV[x.severity]?.icon ?? '·'}</span><span className="sr-only">{SEV[x.severity]?.word}: </span>{x.text}</li>
      ))}</ul>
      {f.length > 4 && <button type="button" className="link show-all" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${f.length}`}</button>}
      {b.note && <p className="muted small">{b.note}</p>}
    </section>
  );
}

export function Checklist({ b }: { b: Block }) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => loadChecks());
  const items = b.items as string[]; const done = items.filter((t) => checks[`${b.title}|${t}`]).length;
  const toggle = (t: string) => { const next = { ...checks, [`${b.title}|${t}`]: !checks[`${b.title}|${t}`] }; setChecks(next); saveChecks(next); };
  return (
    <section className="checklist" aria-label={b.title}>
      <h3>{b.title} <span className="muted small">({done} of {items.length}, kept on this device)</span></h3>
      <ul className="list">{items.map((t) => (
        <li key={t}><label><input type="checkbox" checked={!!checks[`${b.title}|${t}`]} onChange={() => toggle(t)} /> {t}</label></li>
      ))}</ul>
    </section>
  );
}

const STATUS: Record<string, string> = { supported: 'Matches the catalog', contradicts: 'Does not match', not_in_catalog: 'Not in catalog', cant_check: "Can't be checked", not_checked: 'Not checked yet', verdict: 'Checked by a person' };
const STAMP: Record<string, string> = { supported: 'MATCH', contradicts: 'MISMATCH', not_in_catalog: 'NOT IN CATALOG', cant_check: 'OPINION', not_checked: 'UNCHECKED', verdict: 'VERIFIED' };
export function Claims({ b }: { b: Block }) {
  return (
    <section className="claims" aria-label={`Seller claims about ${b.laptop}`}>
      <h3>Seller claims</h3>
      <ul className="list">{(b.rows as any[]).map((r, i) => (
        <li key={i} className={`claim ${r.status}`}>
          <span className={`stamp ${r.status}`} aria-hidden="true">{STAMP[r.status] ?? r.status}</span>
          <p className="claim-text">“{r.claim_text}”</p>
          <p><span className={`pill ${r.status}`}>{r.label ?? STATUS[r.status] ?? r.status}</span> {r.detail}</p>
          {r.status === 'verdict' && <p className="muted small">Based on {r.sample_size ?? '?'} reports. Approved by {r.approver}{r.date ? `, ${String(r.date).slice(0, 10)}` : ''}.</p>}
          {r.evidence && <p className="muted small">Owner opinions on {r.evidence.topic}: {r.evidence.enough ? `${r.evidence.positive} positive, ${r.evidence.negative} negative of ${r.evidence.n}` : `not enough evidence (n = ${r.evidence.n})`} (machine-read).</p>}
        </li>
      ))}</ul>
      <p className="muted small">I never give a verdict that a person has not approved.</p>
    </section>
  );
}

export function Receipt({ b }: { b: Block }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="receipt" aria-label="Your receipt code">
      <p>{b.text}</p>
      <p className="code" aria-live="polite">{b.receipt}</p>
      <button className="btn small" onClick={async () => { try { await navigator.clipboard.writeText(String(b.receipt)); setCopied(true); } catch { /* clipboard blocked */ } }}>{copied ? 'Copied' : 'Copy code'}</button>
    </section>
  );
}
export function FormRequest({ b }: { b: Block }) {
  const ctx = useCtx();
  return <div className="offer"><span>{b.text}</span><button className="btn small" onClick={() => ctx.goto('share')}>Open the form</button></div>;
}
/** "Here's what I saw": what the vision model read from a picture, to be checked by the user before anything depends on it. */
export function ImageRead({ b }: { b: Block }) {
  const ctx = useCtx();
  return (
    <section className={`image-read ${b.readable ? '' : 'unreadable'}`} aria-label="What I read from your picture">
      <h3>📷 Here’s what I saw <span className="muted small">({b.kind_label})</span></h3>
      {b.fields.length > 0 && <ul className="field-chips">{(b.fields as { label: string; value: string }[]).map((f) => <li key={f.label}><span className="muted small">{f.label}</span><strong>{f.value}</strong></li>)}</ul>}
      {b.claims.length > 0 && <><p className="small muted">Claims I found in the picture:</p><ul className="list">{(b.claims as string[]).map((c) => <li key={c}>“{c}”</li>)}</ul></>}
      {b.concerns.length > 0 && <ul className="concerns">{(b.concerns as string[]).map((c) => <li key={c}>⚠ {c}</li>)}</ul>}
      <p className="muted small">{b.note}</p>
      {b.readable && <button className="link" onClick={() => { setSession('lapfit.prefill', { laptop: b.fields.find((f: any) => f.label === 'Laptop')?.value ?? '' }); ctx.goto('check'); }}>Not right? Type the details instead</button>}
    </section>
  );
}

/** The answer receipt: where every part of this answer came from, how fresh it is, and what was checked. */
export function Provenance({ b }: { b: Block }) {
  const when = b.catalog.prices_as_of ? fmtDateShort(b.catalog.prices_as_of) : null;
  return (
    <details className="receipt-card">
      <summary><span aria-hidden="true">🧾</span> How I built this answer</summary>
      <dl>
        {b.catalog.used && <><dt>📦 Catalog</dt><dd>Specs and prices from a <strong>saved snapshot{when ? ` (${when})` : ''}, not live</strong>. {b.catalog.verified ? 'Some specs are checked by a person.' : 'No person has verified the specs yet.'}</dd></>}
        {b.dataset.used && <><dt>💬 Owner opinions</dt><dd>{b.dataset.opinions > 0 ? <><strong>{b.dataset.opinions}</strong> opinions</> : 'Opinions'} read by a machine from {b.dataset.reviews_total ?? 'the'} dataset reviews{b.dataset.dated ? '' : ', which have no dates'}. Duplicates counted once.{b.dataset.lenses?.length ? ` Used as a stand-in for: ${b.dataset.lenses.join(', ')}.` : ''}</dd></>}
        {b.live.used && <><dt>🌐 Live web</dt><dd>{b.live.items > 0 ? <><strong>{b.live.items}</strong> web excerpt{b.live.items === 1 ? '' : 's'}</> : 'No usable results'}{b.live.provider ? ` via ${b.live.provider}` : ''}{b.live.fetched_at ? `, fetched ${new Date(b.live.fetched_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}. Not verified, and not counted in the owner numbers.</dd></>}
        <dt>🤖 AI</dt><dd>Reading your request: {b.ai.reader}. Wording: {b.ai.wording}.{b.ai.degraded ? ' You are in a lighter mode right now.' : ''} The AI never decides prices, specs or counts.</dd>
        {b.images?.used && <><dt>🖼️ Pictures</dt><dd>From the web ({(b.images.sites as string[]).join(', ')}), <strong>not verified</strong>. They may not show this exact version, and their licence is not verified. A drawn laptop is shown where there is no picture.</dd></>}
        {b.checks.gate && <><dt>✅ Re-checked</dt><dd>Every price, spec and count was compared with the stored data again before you saw it.</dd></>}
        {b.affiliate.links && <><dt>🔗 Links</dt><dd>Shop links may be affiliate links. They never change what is shown or in what order.</dd></>}
      </dl>
    </details>
  );
}

/** Shop links, with a plain disclosure when any of them earns us money. */
export function WhereToBuy({ b }: { b: Block }) {
  const cfg = useApiConfig();
  return (
    <section className="buy" aria-label={`Where to buy ${b.name}`}>
      <h3>🛒 Where to buy <span className="muted small">{String(b.name).split(' · ')[0]}</span></h3>
      <p className="muted small">{b.note}</p>
      <ul className="shops">{(b.links as { id: string; name: string; url: string; affiliate: boolean }[]).filter((l) => /^https:\/\//.test(l.url)).map((l) => (
        <li key={l.id}><a className="btn ghost shop" href={l.url} target="_blank" rel={l.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} onClick={() => cfg && reportClick(cfg, { retailer: l.id, variantId: b.variant_id, from: 'where_to_buy' })}>
          Search on {l.name}{l.affiliate && <span className="aff-tag">Affiliate link</span>}<span className="sr-only"> (opens in a new tab)</span> ↗</a></li>
      ))}</ul>
      {b.disclosure && <p className="disclosure" role="note">{b.disclosure}</p>}
    </section>
  );
}

export function DataStatus({ b }: { b: Block }) {
  return (
    <dl className="data-status">
      <dt>📦 Catalog</dt><dd>{b.variants} laptop versions; {b.laptops_with_price} have an Indian price, all from a <strong>saved snapshot dated {b.prices_as_of ? fmtDateShort(b.prices_as_of) : 'unknown'}</strong>. {b.verified_variants} verified by a person.</dd>
      <dt>💬 Owner opinions</dt><dd>{b.opinions} opinions read by a machine from {b.reviews} reviews ({(b.review_sources as any[]).map((s) => `${s.id.includes('FLIPKART') ? 'Flipkart' : 'Amazon'} ${s.region}: ${s.reviews}${s.quotable ? '' : ', internal use only'}`).join('; ')}). {b.reviews_with_dates} of the reviews carry a date.</dd>
      <dt>🌐 Live web reviews</dt><dd>{b.live_source ? `Fetched on request via ${b.live_source}.` : 'Fetched on request when a source is configured.'} Not verified, and never mixed into the numbers above.</dd>
    </dl>
  );
}
export const Unknown = ({ b }: { b: Block }) => <p className="muted small">(This answer part, “{b.type}”, is not shown in this version of the app.)</p>;
export { inr };
