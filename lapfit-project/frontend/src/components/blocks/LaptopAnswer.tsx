import { useCtx } from '../ctx';
import type { Block } from '../../lib/types';
import { Source } from './Source';
import { WebPanel } from './Evidence';

type Section = { kind: 'catalog' | 'owners' | 'web'; title: string; items: string[]; web?: any };
const TAG = { catalog: 'catalog', owners: 'dataset', web: 'web' } as const;
const asText = (v: unknown) => (typeof v === 'string' && v.trim() ? v : '?');

/** An answer about one laptop. Each part says where it came from; the guardrail says what I will not say. Everything is plain text. */
export function LaptopAnswer({ b }: { b: Block }) {
  const ctx = useCtx(); const l = (b.laptop ?? {}) as Record<string, unknown>;
  const sections = (Array.isArray(b.sections) ? b.sections : []) as Section[]; const sugg = (Array.isArray(b.suggestions) ? b.suggestions : []) as string[];
  return (
    <section className="laptop-answer vibe" aria-label={`Answer about ${asText(l.name)}`}>
      <p className="la-laptop"><strong>{asText(l.name)}</strong><span className="muted small"> {asText(l.price_text)} · {asText(l.as_of_text)}</span></p>
      <h3 className="la-head">{asText(b.headline)}</h3>
      {sections.map((s, i) => {
        const web = s.kind === 'web' ? s.web : undefined; const live = web && (web.status === 'ok' || web.status === 'cached') && (web.items?.length ?? 0) > 0;
        return (
          <div className={`la-section la-${s.kind}`} key={i}>
            <h4><Source kind={TAG[s.kind] ?? 'catalog'} /> {s.title}</h4>
            {(s.items?.length ?? 0) > 0 && <ul className="la-items">{s.items.map((t, k) => <li key={k}>{asText(t)}</li>)}</ul>}
            {web && (live ? <WebPanel web={web} title="Live web pages" />
              : <p className="la-webnote muted small" data-status={web.status}>{asText(web.note)}</p>)}
          </div>
        );
      })}
      {typeof b.guardrail === 'string' && b.guardrail && <aside className="la-guard" aria-label="What I can and can’t say"><strong>What I can and can’t say</strong><p>{b.guardrail}</p></aside>}
      {sugg.length > 0 && <div className="chips la-sugg" role="group" aria-label="Suggested follow-ups">{sugg.map((q) => <button key={q} type="button" className="chip action" disabled={ctx.busy} onClick={() => ctx.sendText(q)}>{q}</button>)}</div>}
    </section>
  );
}
