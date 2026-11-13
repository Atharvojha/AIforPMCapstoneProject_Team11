import { useEffect, useRef, useState } from 'react';

/** Copy text with the clipboard, or an old-fashioned fallback, and show a visible "Copied" for a moment. */
export async function copyText(text: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand?.('copy') ?? false; document.body.removeChild(ta); return ok;
  } catch { return false; }
}

export function CopyButton({ text, label, className = 'btn ghost small' }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle'); const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  const go = async () => { const ok = await copyText(text); setState(ok ? 'ok' : 'fail'); window.clearTimeout(t.current); t.current = window.setTimeout(() => setState('idle'), 2200); };
  return <><button type="button" className={className} onClick={go}>{state === 'ok' ? 'Copied' : label}</button><span className="sr-only" role="status">{state === 'ok' ? 'Copied to clipboard' : state === 'fail' ? 'Could not copy. Select the text and copy it yourself.' : ''}</span>{state === 'fail' && <span className="error small">Could not copy. Select the text and copy it yourself.</span>}</>;
}
