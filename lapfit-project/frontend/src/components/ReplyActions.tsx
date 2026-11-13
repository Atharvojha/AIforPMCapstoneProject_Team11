import { useRef, useState } from 'react';
import type { Reply } from '../lib/types';
import { canSpeak, speak, stopSpeaking, speechLangFor } from '../lib/speech';
import { speechText, shareText, whatsappUrl, hasShareable } from '../lib/summary';
import { renderShareCard, canvasToBlob, cardLines } from '../lib/share';

/** Voice out and share out: read the answer aloud, send it on WhatsApp, or save it as a picture. All built from the answer's own text. */
export function ReplyActions({ reply }: { reply: Reply }) {
  const [speaking, setSpeaking] = useState(false); const [note, setNote] = useState(''); const canvas = useRef<HTMLCanvasElement>(null);
  if (!hasShareable(reply.blocks)) return null;
  const text = shareText(reply);
  const toggleSpeak = () => { if (speaking) { stopSpeaking(); setSpeaking(false); return; } setSpeaking(speak(speechText(reply), speechLangFor(reply.language), () => setSpeaking(false))); };
  const savePicture = async () => {
    const c = canvas.current; if (!c || !renderShareCard(reply, c)) { setNote('Nothing to put on a picture yet. Ask me something first.'); return; }
    const blob = await canvasToBlob(c); if (!blob) { setNote('Could not make the picture. Try Copy instead.'); return; }
    const file = new File([blob], 'lapfit.png', { type: 'image/png' }); const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try { if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text: 'From LapFit' }); return; } } catch { /* cancelled */ }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lapfit.png'; a.click(); setNote('Saved as a picture.');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setNote('Copied.'); } catch { setNote('Copy is blocked in this browser. Select the text instead.'); } };
  return (
    <div className="reply-actions" role="group" aria-label="Listen or share this answer">
      {canSpeak() && <button className="btn small ghost" aria-pressed={speaking} onClick={toggleSpeak}>{speaking ? '⏹ Stop' : '🔊 Read to me'}</button>}
      <a className="btn small ghost" href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer">💬 WhatsApp<span className="sr-only"> (opens in a new tab)</span></a>
      {cardLines(reply).length > 0 && <button className="btn small ghost" onClick={savePicture}>🖼 Save as picture</button>}
      <button className="btn small ghost" onClick={copy}>📋 Copy</button>
      {note && <span className="muted small" role="status">{note}</span>}
      <canvas ref={canvas} hidden width={1080} height={1080} />
    </div>
  );
}
