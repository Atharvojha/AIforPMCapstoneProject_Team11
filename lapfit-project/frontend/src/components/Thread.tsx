import { useCallback, useEffect, useRef, useState } from 'react';
import type { Thread as ThreadState } from '../state/useThread';
import { BlockView } from './blocks/BlockView';
import { CtxContext, type Ctx, type DetailCard, type DetailTab } from './ctx';
import { DetailSheet } from './blocks/DetailSheet';
import { Lappy, type Mood } from './viz/Lappy';
import { ReplyActions } from './ReplyActions';
import { fmtWait } from '../lib/wait';
import { shortName } from '../lib/focus';
import { AskRepeatContext } from './blocks/AskLaptop';

const STEPS = ['Reading your request', 'Checking the catalog', 'Counting owner opinions', 'Looking at live reviews', 'Re-checking every price'];

export function ThreadView({ thread, ctx, empty, onEdit }: { thread: ThreadState; ctx: Ctx; empty?: React.ReactNode; onEdit?(turn: { id: number; text: string }): void }) {
  const end = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<{ card: DetailCard; tab: DetailTab } | null>(null); const closeDetail = useCallback(() => setDetail(null), []);
  useEffect(() => { end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }, [thread.turns.length, thread.busy]);
  const { turns } = thread;
  const lastReplyId = [...turns].reverse().find((t) => t.reply)?.id; const lastIsReply = turns.length > 0 && turns[turns.length - 1].reply !== undefined;
  const ctx2: Ctx = { ...ctx, openDetail: (card, tab = 'fit') => { thread.setFocus({ variant_id: card.variant_id, name: card.name }); setDetail({ card, tab }); } };
  const detailBlocks = detail ? [...turns].reverse().find((t) => t.reply?.blocks.some((b) => b.type === 'cards' && (b.cards as DetailCard[]).some((x) => x.variant_id === detail.card.variant_id)))?.reply?.blocks : undefined;
  return (
    <CtxContext.Provider value={ctx2}>
      <div className="thread" aria-live="polite" aria-busy={thread.busy}>
        {turns.length === 0 && empty}
        {turns.map((t, ti) => {
          const prevAsk = [...turns.slice(0, ti)].reverse().find((x) => x.reply)?.reply?.blocks.find((b) => b.type === 'ask_laptop');
          return (
          <div className="turn" key={t.id}>
            {t.user && <div className="user-line"><p className="user-bubble">{t.user}</p>{t.typed && onEdit && !t.pending && <button type="button" className="link edit-msg" disabled={thread.busy} onClick={() => onEdit({ id: t.id, text: t.user! })} aria-label={`Edit your message: ${t.user!.slice(0, 40)}`}><span aria-hidden="true">✎</span> Edit</button>}</div>}
            {t.pending && <Waiting />}
            {t.reply && <div className="reply">
              <div className="reply-mood"><Lappy key={moodOf(t.reply)} mood={moodOf(t.reply)} size={44} /></div>
              {t.reply.blocks.map((b, i) => <div className="reveal" style={{ ['--i' as any]: Math.min(i, 8) }} key={i}><AskRepeatContext.Provider value={b.type === 'ask_laptop' && !!prevAsk && prevAsk.question === b.question}><BlockView block={b} /></AskRepeatContext.Provider></div>)}
              {t.reply.router_mode === 'fallback' && <p className="muted small">I used a simpler reader this time because the smart reader was slow. Please check what I understood.</p>}
              {t.id === lastReplyId && lastIsReply && !thread.busy && thread.focus && <FollowUps thread={thread} reply={t.reply} />}
              <ReplyActions reply={t.reply} />
            </div>}
            {t.error && <ErrorBanner thread={thread} error={t.error} />}
          </div>
        ); })}
        <div ref={end} />
      </div>
      <DetailSheet card={detail?.card ?? null} tab={detail?.tab} blocks={detailBlocks} busy={ctx.busy} onClose={closeDetail} onAction={ctx.action} />
    </CtxContext.Provider>
  );
}

const FOLLOW = ['Why this one?', 'Will it last long?', 'Common problems?', 'Can I upgrade it?'];
/** Quick follow-up questions about the laptop in focus. Tapping one sends it as typed text, so the focus travels with it. */
function FollowUps({ thread, reply }: { thread: ThreadState; reply: { blocks: { type: string; suggestions?: string[] }[] } }) {
  const own = reply.blocks.find((b) => b.type === 'laptop_answer')?.suggestions ?? [];
  const list = FOLLOW.filter((q) => !own.includes(q));
  return (
    <div className="follow-ups" role="group" aria-label={`Follow-up questions about ${shortName(thread.focus!.name)}`}>
      <p className="muted small">Ask a follow-up</p>
      <div className="chips">{list.map((q) => <button key={q} type="button" className="chip action" disabled={thread.cooldown > 0} onClick={() => { void thread.sendText(q); }}>{q}</button>)}</div>
    </div>
  );
}

/** Lappy's face follows what really happened: found something -> happy, a notice/empty result -> oops (a gentle "hmm"), otherwise calm. */
const moodOf = (r: { blocks: { type: string; cards?: unknown[] }[] }): Mood => {
  const found = r.blocks.some((b) => (b.type === 'cards' && (b.cards?.length ?? 0) > 0) || b.type === 'compare' || b.type === 'sell_plan');
  if (found) return 'happy';
  const emptyCards = r.blocks.some((b) => b.type === 'cards' && (b.cards?.length ?? 0) === 0);
  return emptyCards ? 'oops' : 'idle';
};

function Waiting() {
  const [i, setI] = useState(0); useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 1800); return () => clearInterval(t); }, []);
  return (
    <div className="waiting" role="status">
      <Lappy mood="thinking" size={64} />
      <div><p className="waiting-title">Checking the facts… <span className="muted small">this can take up to 15 seconds</span></p>
        <ol className="steps" aria-hidden="true">{STEPS.map((s, k) => <li key={s} className={k === i ? 'on' : ''}>{s}</li>)}</ol>
        <div className="skeleton-card" aria-hidden="true"><div className="skeleton-line mid" /><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>
    </div>
  );
}

export function ErrorBanner({ thread, error }: { thread: ThreadState; error: { kind: string; message: string; retryAfter?: number } }) {
  const wait = error.kind === 'rate_limited' ? thread.cooldown : 0;
  return (
    <div className="error-banner" role="alert">
      <Lappy mood="oops" size={44} />
      <div><p>{error.kind === 'rate_limited' ? (wait > 0 ? `You have sent a lot of requests from this device, so I need a short break. You can ask again in ${fmtWait(wait)}. What you typed is kept.` : 'The break is over. You can ask again now.') : error.message}</p>
        {error.kind !== 'too_large' && error.kind !== 'auth' && <button className="btn small" disabled={wait > 0 || thread.busy} onClick={() => thread.retry()}>Try again</button>}</div>
    </div>
  );
}
