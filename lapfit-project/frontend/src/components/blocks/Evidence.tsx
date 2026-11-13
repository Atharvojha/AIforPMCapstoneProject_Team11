import { useCtx } from '../ctx';
import type { Block } from '../../lib/types';
import { Ring } from '../viz/Ring';
import { Source } from './Source';

const TOPIC: Record<string, { label: string; icon: string }> = { battery: { label: 'Battery', icon: '🔋' }, heat_noise: { label: 'Heat and noise', icon: '🌡️' }, keyboard: { label: 'Keyboard', icon: '⌨️' }, display: { label: 'Display', icon: '🖥️' }, performance: { label: 'Performance', icon: '⚡' }, hinge: { label: 'Build and hinge', icon: '🧱' }, service: { label: 'Delivery and service', icon: '📦' }, general: { label: 'General', icon: '💬' } };

export function EvidenceBlock({ b }: { b: Block }) {
  const topics = b.topics as any[]; const name = String(b.laptop).split(' · ')[0];
  return (
    <section className="evidence vibe" aria-label={`Owner opinions on ${b.laptop}`}>
      <h3>What owners say <span className="muted small">about {name}</span></h3>
      <p className="muted small"><Source kind="dataset" /> Opinions read by a machine from reviews in the recorded dataset (not human-verified). Duplicates are counted once. The dataset has no dates, so I cannot say how recent they are.</p>
      {topics.length === 0 && <p className="muted">No owner opinions recorded for this laptop yet, so I will not guess.</p>}
      <ul className="topics">{topics.map((t) => {
        const total = t.positive + t.negative || 1; const meta = TOPIC[t.topic] ?? { label: t.topic, icon: '💬' };
        return (
          <li key={t.topic} className={`topic ${t.enough ? 'enough' : 'thin'}`}>
            <div className="topic-head"><span className="emoji" aria-hidden="true">{meta.icon}</span><strong>{meta.label}</strong> <span className="chip-n">n = {t.n}</span></div>
            {t.enough ? (
              <>
                <div className="bar" role="img" aria-label={`${t.positive} positive and ${t.negative} negative of ${t.n}`}><span className="pos" style={{ width: `${(t.positive / total) * 100}%` }} /><span className="neg" style={{ width: `${(t.negative / total) * 100}%` }} /></div>
                <p className="small">👍 {t.positive} positive · 👎 {t.negative} negative{t.other_polarity ? ` · ${t.other_polarity} neutral or mixed` : ''}</p>
                {t.quotes?.length > 0 && <ul className="quotes">{t.quotes.map((q: any) => <li key={q.claim_id} className={`bubble ${q.polarity}`}><blockquote>“{q.quote}”</blockquote><span className="muted small">{q.source}{q.region ? `, ${q.region}` : ''} · machine-read · {q.attribution}</span></li>)}</ul>}
              </>
            ) : <div className="ghost"><Ring value={t.n / b.min_n} label={String(t.n)} tone="warn" size={56} /><p className="muted small">Not enough evidence yet (n = {t.n}; we need at least {b.min_n}), so no percentages or quotes are shown.</p></div>}
          </li>
        );
      })}</ul>
    </section>
  );
}

export function OwnerReports({ b }: { b: Block }) {
  return (
    <section className="owner-reports" aria-label="Approved owner reports">
      <h3>Reports from owners on LapFit</h3>
      <p className="muted small">{b.label}. {b.note}</p>
      {(b.rows as any[]).length > 0 && <ul className="quotes">{(b.rows as any[]).map((r, i) => <li key={i} className="bubble"><blockquote>“{r.note}”</blockquote><span className="muted small">{[r.persona, r.months_owned != null ? `${r.months_owned} months` : null, r.rating ? `${r.rating}/5` : null].filter(Boolean).join(' · ')}</span></li>)}</ul>}
    </section>
  );
}

const safeUrl = (u: string) => /^https:\/\//i.test(u);
export function LiveReviews({ b }: { b: Block }) {
  const items = b.items as { snippet: string; url: string; site: string; kind: string }[]; const name = String(b.laptop).split(' · ')[0];
  if (b.status === 'off') return null;
  return (
    <section className="live" aria-label={`Live web reviews of ${name}`}>
      <h3><span className="pulse" aria-hidden="true" /> From the web, right now <span className="badge live-badge">Live, not verified</span></h3>
      <p className="muted small"><Source kind="web" /> {b.note}{b.fetched_at ? ` Fetched ${new Date(b.fetched_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}</p>
      {items.length > 0 && <ul className="live-list">{items.filter((i) => safeUrl(i.url)).map((i, k) => (
        <li key={k}><span className="site-dot" aria-hidden="true">{(i.site || '?')[0].toUpperCase()}</span><div><p>“{i.snippet}”</p><a href={i.url} target="_blank" rel="noopener noreferrer">{i.site || 'Open source'}<span className="sr-only"> (opens in a new tab)</span> ↗</a></div></li>
      ))}</ul>}
    </section>
  );
}

/** What the wider web says (market or brand). Always labelled live and not verified, always linked, never mixed into the dataset numbers. */
export function WebPanel({ web, title }: { web?: any; title: string }) {
  if (!web || web.status === 'off') return null;
  const items = ((web.items ?? []) as { snippet: string; url: string; site: string; published?: string | null }[]).filter((i) => safeUrl(i.url));
  return (
    <section className="live web-panel" aria-label={title}>
      <h4><span className="pulse" aria-hidden="true" /> {title} <span className="badge live-badge">Live, not verified</span></h4>
      <p className="muted small"><Source kind="web" /> {web.note}{web.fetched_at ? ` Fetched ${new Date(web.fetched_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}</p>
      {items.length > 0 && <ul className="live-list">{items.map((i, k) => (
        <li key={k}><span className="site-dot" aria-hidden="true">{(i.site || '?')[0].toUpperCase()}</span><div><p>“{i.snippet}”</p><a href={i.url} target="_blank" rel="noopener noreferrer">{i.site || 'Open source'}{i.published ? ` · ${new Date(i.published).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''}<span className="sr-only"> (opens in a new tab)</span> ↗</a></div></li>
      ))}</ul>}
    </section>
  );
}

export function TopicBoard({ b }: { b: Block }) {
  const ctx = useCtx();
  return (
    <section aria-label="Owners by topic"><h3>Best on {b.topic} according to owners</h3><p className="muted small">{b.note}</p>
      <ul className="list">{(b.rows as any[]).map((r) => <li key={r.variant_id}><button className="link" onClick={() => ctx.action({ action: 'owner_voice', variant_id: r.variant_id, topic: b.topic }, `What owners say about ${r.name}`)}>{r.name}</button> <span className="muted small">{r.positive} positive of {r.n}</span></li>)}</ul></section>
  );
}
