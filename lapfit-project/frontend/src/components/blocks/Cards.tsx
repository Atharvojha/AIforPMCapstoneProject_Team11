import { useState } from 'react';
import type { Block } from '../../lib/types';
import { Confetti } from '../viz/Confetti';
import { BoardHero, BoardRow } from './BoardHero';
import { type Card, isTie, priceKnown, musts } from './BoardLogic';

export type { Card };
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
      {cards.length > 0 && <div className={`b-heroes ${tie ? 'two' : ''}`}>{heroes.map((c) => <BoardHero key={c.variant_id} c={c} tie={tie} eyebrow={fit ? 'Best fit for what you said' : null} />)}</div>}
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
