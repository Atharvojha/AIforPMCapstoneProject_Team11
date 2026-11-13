import { useState } from 'react';
import type { Needs } from '../lib/types';
import { useSessionBrief, needsSummary, type SessionStore } from '../lib/session';
import { shortName } from '../lib/focus';
import { BudgetSlider, BUDGET_STEPS } from './viz/BudgetSlider';
import { cleanNeeds, sameNeeds } from '../lib/needs';
import { useCatalog } from '../state/useCatalog';

type Part = 'needs' | 'recs' | 'sel' | null;
/**
 * The three saved parts of this session, as one quiet row: My needs, Recommended, My selection.
 * Each is its own part: clearing the selection never touches the needs or the recommendations. Tap a part to open it.
 */
export function SessionBar({ store, busy, onClearFocus, onRemovePick, onClearPicks, onUpdateNeeds }: { store: SessionStore; busy: boolean; onClearFocus(): void; onRemovePick(id: string): void; onClearPicks(): void; onUpdateNeeds(n: Needs): void }) {
  const brief = useSessionBrief(store); const [open, setOpen] = useState<Part>(null); const { rows } = useCatalog();
  const [draft, setDraft] = useState<Needs | null>(null);
  const { needs, recs, focus, picks } = brief;
  if (!needs && recs.length === 0 && !focus && picks.length === 0) return null;
  const toggle = (p: Exclude<Part, null>) => { setOpen(open === p ? null : p); setDraft(null); };
  const working = draft ?? needs; const prices = rows.filter((r) => r.recommendable && r.price_inr != null).map((r) => r.price_inr as number);
  const selText = focus ? shortName(focus.name) : picks.length ? `${picks.length} picked to compare` : 'nothing yet';
  return (
    <section className="session-bar" aria-label="What I am working from">
      <div className="session-row">
        {needs && <button type="button" className={`s-part ${open === 'needs' ? 'on' : ''}`} aria-expanded={open === 'needs'} aria-controls="sess-needs" onClick={() => toggle('needs')}>
          <span className="s-k">My needs:</span> <span className="s-v">{needsSummary(needs)}</span> <span aria-hidden="true">✎</span><span className="sr-only"> Edit my needs</span></button>}
        {recs.length > 0 && <button type="button" className={`s-part ${open === 'recs' ? 'on' : ''}`} aria-expanded={open === 'recs'} aria-controls="sess-recs" onClick={() => toggle('recs')}>
          <span className="s-k">Recommended:</span> <span className="s-v">{recs.length} laptop{recs.length === 1 ? '' : 's'}</span></button>}
        {(focus || picks.length > 0) && <span className={`s-part sel ${open === 'sel' ? 'on' : ''}`}>
          <button type="button" className="s-main" aria-expanded={open === 'sel'} aria-controls="sess-sel" onClick={() => toggle('sel')}><span className="s-k">My selection:</span> <span className="s-v">{selText}</span></button>
          <button type="button" className="s-x" onClick={focus ? onClearFocus : onClearPicks} aria-label={focus ? `Clear my selection: ${shortName(focus.name)}` : 'Clear my compare picks'}><span aria-hidden="true">✕</span></button></span>}
      </div>
      {open === 'needs' && working && <div id="sess-needs" className="s-panel">
        <p className="muted small">Change the budget or remove a use, then update the results.</p>
        {working.use_cases.length > 0 && <div className="need-chips">{working.use_cases.map((u) => <span key={u} className="need-chip use">🎯 {u}<button type="button" className="need-x" aria-label={`Remove ${u}`} onClick={() => setDraft({ ...working, use_cases: working.use_cases.filter((x) => x !== u) })}>✕</button></span>)}</div>}
        {working.budget_max_inr != null ? <BudgetSlider value={working.budget_max_inr} onChange={(v) => setDraft({ ...working, budget_max_inr: v })} prices={prices} />
          : <button type="button" className="chip" onClick={() => setDraft({ ...working, budget_max_inr: BUDGET_STEPS[4] })}>＋ Add a budget</button>}
        {working.budget_max_inr != null && <button type="button" className="link small" onClick={() => setDraft({ ...working, budget_max_inr: null })}>No budget limit</button>}
        {draft && needs && !sameNeeds(draft, needs) && <button type="button" className="btn small" disabled={busy} onClick={() => { onUpdateNeeds(cleanNeeds(draft)); setDraft(null); setOpen(null); }}>Update results</button>}
      </div>}
      {open === 'recs' && <ol id="sess-recs" className="s-panel s-list" aria-label="Recommended laptops">{recs.map((r) => <li key={r.id}>{shortName(r.name)}</li>)}</ol>}
      {open === 'sel' && <div id="sess-sel" className="s-panel">
        {focus && <p className="small">Asking about <strong>{shortName(focus.name)}</strong> <button type="button" className="link small" onClick={onClearFocus}>Stop asking about it</button></p>}
        {picks.length > 0 && <ul className="s-list" aria-label="Picked to compare">{picks.map((p) => <li key={p.id}>{shortName(p.name)} <button type="button" className="need-x" aria-label={`Remove ${shortName(p.name)} from the compare picks`} onClick={() => onRemovePick(p.id)}>✕</button></li>)}</ul>}
        <p className="muted small">Your needs and the recommended list stay as they are.</p>
      </div>}
    </section>
  );
}
