import { useState } from 'react';
import type { Thread } from '../state/useThread';
import { ThreadView } from '../components/Thread';
import { Composer } from '../components/Composer';
import { SessionBar } from '../components/SessionBar';
import { VibePicker, AskCta, useVibes } from '../components/VibePicker';
import { buildCtx, type ComparePicks } from '../components/ctx';

/** The home screen, one screen and no wizard: tiles, a budget, "Or just tell me" (type, speak or photo), one sticky button. */
export function AskScreen({ thread, compare, goto }: { thread: Thread; compare: ComparePicks; goto(t: string): void }) {
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null); const [editing, setEditing] = useState<number | null>(null);
  const ctx = buildCtx(thread, compare, goto, (t) => setPrefill({ text: t, n: Date.now() }));
  const v = useVibes((n, l) => thread.sendNeeds(n, l), (t) => thread.sendText(t));
  const first = thread.turns.length === 0;
  const send = async (t: string) => { if (editing != null) { const ok = await thread.edit(editing, t); if (ok) setEditing(null); return ok; } return thread.sendText(t); };
  return (
    <section className={`page-enter ask ${first ? 'ask-first' : 'ask-docked'}`} aria-labelledby="ask-h">
      <h2 id="ask-h" className="sr-only">Ask LapFit</h2>
      {!first && <SessionBar store={thread.session} busy={thread.busy || thread.cooldown > 0} onClearFocus={thread.clearFocus} onRemovePick={compare.remove} onClearPicks={compare.clear} onUpdateNeeds={(n) => { void thread.sendNeeds(n); }} />}
      <ThreadView thread={thread} ctx={ctx} empty={<VibePicker v={v} />} onEdit={(t) => { setEditing(t.id); setPrefill({ text: t.text, n: Date.now() }); }} />
      <Composer variant={first ? 'bar' : 'full'} onSend={send} onSendImage={(i) => thread.action({ action: 'read_image', image: i.image }, '📷 Picture')} busy={thread.busy} cooldown={thread.cooldown} prefill={prefill} focusName={thread.focus?.name} onClearFocus={thread.clearFocus} editing={editing != null} onCancelEdit={() => setEditing(null)} />
      {first && <AskCta v={v} busy={thread.busy} />}
      {!first && <p className="center"><button className="link" onClick={() => { thread.clear(); compare.clear(); setEditing(null); }}>Start over</button></p>}
    </section>
  );
}
