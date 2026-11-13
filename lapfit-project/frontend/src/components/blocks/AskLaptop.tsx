import { createContext, useContext, useState } from 'react';
import { useCtx } from '../ctx';
import type { Block } from '../../lib/types';

/** Thread sets this to true when the same question came back twice in a row. */
export const AskRepeatContext = createContext(false);
export interface AskChoice { variant_id: string; label: string }
export interface AskLaptopFormProps { question: string; base: Record<string, unknown>; choices: AskChoice[]; placeholder?: string; busy: boolean; repeat?: boolean; onPost(body: Record<string, unknown>, label: string): void }

/** "Which laptop?" with buttons AND a box to type its name. Choosing or typing re-sends the original request plus the answer. */
export function AskLaptopForm({ question, base, choices, placeholder, busy, repeat = false, onPost }: AskLaptopFormProps) {
  const [text, setText] = useState(''); const t = text.trim();
  const post = () => { if (!t || busy) return; onPost({ ...base, laptop_text: t }, t); setText(''); };
  return (
    <section className="ask-laptop" aria-label={question}>
      <p className="question">{question}</p>
      {repeat
        ? <p className="notice" role="note">I still could not place that laptop. Try its full name from the box or label.</p>
        : choices.length > 0 && <div className="chips" role="group" aria-label="Pick a laptop">{choices.map((c) => <button key={c.variant_id} type="button" className="chip action" disabled={busy} onClick={() => onPost({ ...base, variant_id: c.variant_id }, c.label)}>{c.label}</button>)}</div>}
      <form className="ask-type" onSubmit={(e) => { e.preventDefault(); post(); }}>
        <label htmlFor="ask-laptop-name" className="sr-only">Type the laptop’s name</label>
        <input id="ask-laptop-name" type="text" maxLength={120} autoComplete="off" value={text} placeholder={placeholder || 'Type the laptop’s name'} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn small" disabled={busy || !t}>Send</button>
      </form>
    </section>
  );
}

export function AskLaptop({ b }: { b: Block }) {
  const ctx = useCtx(); const repeat = useContext(AskRepeatContext);
  return <AskLaptopForm question={String(b.question ?? 'Which laptop are you asking about?')} base={(b.base ?? {}) as Record<string, unknown>} choices={(Array.isArray(b.choices) ? b.choices : []) as AskChoice[]} placeholder={b.placeholder} busy={ctx.busy} repeat={repeat} onPost={(body, label) => ctx.action(body, label)} />;
}
