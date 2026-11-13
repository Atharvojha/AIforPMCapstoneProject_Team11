// DEVELOPMENT ONLY (removed from the production build): every kind of backend reply, rendered with the real components, for design review.
import { CtxContext, noopCtx } from '../components/ctx';
import { BlockView } from '../components/blocks/BlockView';
import { ReplyActions } from '../components/ReplyActions';
import { Lappy } from '../components/viz/Lappy';
import { useEffect } from 'react';

const mods = import.meta.glob('../test/fixtures/*.json', { eager: true }) as Record<string, { default: { reply: any } }>;
const all: Record<string, any> = Object.fromEntries(Object.entries(mods).map(([p, m]) => [p.split('/').pop()!.replace('.json', ''), m.default.reply]));

export default function Gallery({ which }: { which: string }) {
  useEffect(() => { const t = setTimeout(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }), 300); return () => clearTimeout(t); }, [which]);
  const names = which && all[which] ? [which] : Object.keys(all);
  return (
    <CtxContext.Provider value={noopCtx}>
      <style>{'.reveal, .stamp, .radar .shape, .bar .pos, .hbar i, .tug-bar { animation: none !important; opacity: 1; } .ring .meter, .laptop-media img { transition: none !important; }'}</style>
      {which === 'moods' ? <div style={{ display: 'flex', gap: 24, padding: 16 }}>{(['idle', 'thinking', 'happy', 'oops', 'listening'] as const).map((m) => <div key={m} style={{ textAlign: 'center' }}><Lappy mood={m} size={110} /><p>{m}</p></div>)}</div> :
        names.map((n) => <section key={n}><h2 style={{ fontSize: '.9rem', opacity: .6 }}>fixture: {n}</h2><div className="thread"><div className="turn"><div className="reply">{all[n].blocks.map((b: any, i: number) => <div className="reveal" style={{ ['--i' as any]: i }} key={i}><BlockView block={b} /></div>)}<ReplyActions reply={all[n]} /></div></div></div></section>)}
    </CtxContext.Provider>
  );
}
export const fixtureNames = () => Object.keys(all);
