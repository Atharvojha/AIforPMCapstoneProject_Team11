import { useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { Composer } from '../components/Composer';
import { VibePicker, AskCta, useVibes } from '../components/VibePicker';
import { buildCtx, type ComparePicks } from '../components/ctx';

/** The home screen, one screen and no wizard: tiles, a budget, "Or just tell me" (type, speak or photo), one sticky button. */
export function AskScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null);
  const ctx = buildCtx(thread, compare, goto, (t) => setPrefill({ text: t, n: Date.now() }));
  const v = useVibes((n, l) => thread.sendNeeds(n, l), (t) => thread.sendText(t));
  const first = thread.turns.length === 0;
  return (
    <section className={`page-enter ask ${first ? 'ask-first' : ''}`} aria-labelledby="ask-h">
      <h2 id="ask-h" className="sr-only">Ask LapFit</h2>
      <ThreadView thread={thread} ctx={ctx} empty={<VibePicker v={v} />} />
      <Composer variant={first ? 'bar' : 'full'} onSend={(t) => thread.sendText(t)} onSendImage={(i) => thread.action({ action: 'read_image', image: i.image }, '📷 Picture')} busy={thread.busy} cooldown={thread.cooldown} prefill={prefill} focusName={thread.focus?.name} onClearFocus={thread.clearFocus} />
      {first && <AskCta v={v} busy={thread.busy} />}
      {!first && <p className="center"><button className="link" onClick={thread.clear}>Start over</button></p>}
    </section>
  );
}
