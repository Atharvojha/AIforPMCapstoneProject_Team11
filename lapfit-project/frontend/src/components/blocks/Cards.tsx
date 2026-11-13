import { useState } from 'react';
import type { Block, Needs } from '../../lib/types';
import { Confetti } from '../viz/Confetti';
import { BoardHero, BoardRow } from './BoardHero';
import { useCtx } from '../ctx';
import { type Card, type SortInfo, isTie, priceKnown, musts, heroEyebrow } from './BoardLogic';

export type { Card };

/** Says how the list is ordered and why, and lets the person re-order it. Choosing a sort re-sends the same needs with `sort` and REPLACES this reply in place (the server re-runs the search; nothing is re-ordered on the device). */
function SortBar({ b }: { b: Block }) {
  const ctx = useCtx(); const sort = b.sort as SortInfo | undefined; const sorts = (b.sorts ?? []) as { key: string; label: string }[];
  if (!sort && sorts.length === 0 && !b.budget_note) return null;
  const choose = (k: { key: string; label: string }) => {
    if (k.key === sort?.key) return;
    const needs = (b.needs ?? ctx.savedNeeds()) as Needs | null;   // the same needs, a different order: the reply is replaced in place, never a new chat turn
    void ctx.resort({ ...(needs ? { needs } : {}), sort: k.key }, `Sort by ${k.label.toLowerCase()}`);
  };
  return (
    <div className="sortbar">
      {sort && <p className="sort-line"><strong>Sorted by: {sort.label}</strong>{sort.note ? <span className="muted"> {sort.note}</span> : null}</p>}
      {b.budget_note && <p className="sort-budget" role="note">{String(b.budget_note)}</p>}
      {sorts.length > 1 && <div className="sort-chips" role="group" aria-label="Sort these laptops by">{sorts.map((k) => <button type="button" key={k.key} className={`chip ${k.key === sort?.key ? 'on' : ''}`} aria-pressed={k.key === sort?.key} disabled={ctx.busy} onClick={() => choose(k)}>{k.label}</button>)}</div>}
    </div>
  );
}
const FIT = /within your budget/i;

/** The results board: a context chip, ONE best fit (two when they tie), two compact rows, and "Show N more". Everything else is in the Details sheet. */
export function CardsBlock({ b }: { b: Block }) {
  const cards = b.cards as Card[]; const [all, setAll] = useState(false);
  const explicit = cards.some((c) => musts(c).length > 0); const celebrate = b.requireAll === true && explicit && cards.length > 0;
  const fit = FIT.test(String(b.title)) && cards.length > 1; const tie = isTie(cards); const heroes = tie ? cards.slice(0, 2) : cards.slice(0, 1);
  const rest = cards.slice(heroes.length); const rows = [...rest.filter(priceKnown), ...rest.filter((c) => !priceKnown(c))]; const shown = all ? rows : rows.slice(0, 2); const hidden = rows.length - shown.length;
  return (
    <section className="cards-block board" aria-label={String(b.title)}>
      <Confetti fire={celebrate} />
      <h3 className="b-chip">{b.title}</h3>
      <SortBar b={b} />
      {cards.length > 0 && <div className={`b-heroes ${tie ? 'two' : ''}`}>{heroes.map((c) => <BoardHero key={c.variant_id} c={c} tie={tie} eyebrow={heroEyebrow(b.sort as SortInfo | undefined, fit)} />)}</div>}
      {tie && <p className="b-tie-note">The top two are about equal on price, memory and owner opinions. Open Details to choose.</p>}
      {shown.length > 0 && <div className="b-rows" aria-label="Also worth a look">{shown.map((c) => <BoardRow key={c.variant_id} c={c} hero={heroes[0]} />)}</div>}
      {hidden > 0 && <button className="btn soft small b-more" aria-expanded="false" onClick={() => setAll(true)}>Show {hidden} more</button>}
      {all && rows.length > 2 && <button className="link b-less" onClick={() => setAll(false)}>Show fewer</button>}
      {cards.length === 0 && <p className="empty-note">Nothing fits all of that yet. Try a higher budget, or make one Must a Should.</p>}
      <p className="muted small deck-note">Pictures are from the web and may not show this exact version. A “?” means the catalog does not know that value yet.</p>
    </section>
  );
}

/** The hero face, kept under its old name for other screens. */
export { BoardHero as CardView } from './BoardHero';
