import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { buildCtx, type ComparePicks } from '../components/ctx';

/** The two market questions. Used inside Explore (Market segment) and by the standalone #/market route. */
export function MarketActions({ thread }: { thread: Thread }) {
  const off = thread.busy || thread.cooldown > 0;
  return (
    <div className="market-box">
      <p className="muted">Counts only, with the evidence behind each. I do not rank brands, and small numbers are marked.</p>
      <div className="chips market-actions">
        <button className="btn" disabled={off} onClick={() => thread.sendText('what is trending right now')}>Market pulse</button>
        <button className="btn" disabled={off} onClick={() => thread.sendText('which brand is more reliable for laptops')}>Brand insights</button>
      </div>
    </div>
  );
}

export function MarketScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const ctx = buildCtx(thread, compare, goto, () => {});
  return (
    <section className="page-enter" aria-labelledby="exp-h">
      <h2 id="exp-h">Market and brands</h2>
      <MarketActions thread={thread} />
      <ThreadView thread={thread} ctx={ctx} />
    </section>
  );
}
