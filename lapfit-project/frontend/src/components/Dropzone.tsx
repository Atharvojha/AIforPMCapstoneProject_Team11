import { useRef, useState } from 'react';

/** A big, friendly place to drop, snap or paste a picture. */
export function Dropzone({ onFile, preview, busy, onClear }: { onFile(f: File): void; preview?: string | null; busy?: boolean; onClear?(): void }) {
  const input = useRef<HTMLInputElement>(null); const [over, setOver] = useState(false);
  return (
    <div className={`dropzone ${over ? 'over' : ''} ${preview ? 'has' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      onPaste={(e) => { const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); onFile(f); } }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {preview ? (
        <div className="drop-preview"><img src={preview} alt="The picture you added" /><button type="button" className="link" onClick={onClear}>Remove picture</button></div>
      ) : (
        <button type="button" className="drop-btn" onClick={() => input.current?.click()} disabled={busy} aria-label="Add a picture: camera or gallery">
          <span className="drop-icon" aria-hidden="true">📷</span><strong>{busy ? 'Getting it ready…' : 'Snap, drop or paste a picture'}</strong>
          <span className="muted small">A listing, a seller’s chat, a battery screen or the laptop itself</span>
        </button>
      )}
    </div>
  );
}
