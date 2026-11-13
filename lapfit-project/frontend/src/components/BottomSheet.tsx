import { useEffect, useRef, type ReactNode } from 'react';

/** One sheet component for the whole app: a bottom sheet on phones, a docked pane at >= 1024px. Escape and the backdrop close it, focus moves in and returns, the page behind does not scroll. */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null); const back = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement; const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], button, a, [tabindex]')?.focus(), 30);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { clearTimeout(t); document.removeEventListener('keydown', key); document.body.style.overflow = prev; (back.current as HTMLElement | null)?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-grab" aria-hidden="true" />
        <header className="sheet-head"><h2>{title}</h2><button className="sheet-close" onClick={onClose} aria-label="Close">✕</button></header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
