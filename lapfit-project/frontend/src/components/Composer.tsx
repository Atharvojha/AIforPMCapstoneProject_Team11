import { useEffect, useRef, useState } from 'react';
import { prepareImage, type PreparedImage } from '../lib/image';
import { useSpeechInput, LANGS } from '../lib/speech';
import { getJson, setJson } from '../lib/storage';
import { fmtWait } from '../lib/wait';
import { shortName } from '../lib/focus';

const MAX = 4000; const CONSENT = 'lapfit.imgconsent.v1'; const VOICE = 'lapfit.voiceconsent.v1';
export interface SendImage { image: { mime: string; data: string }; preview: string }

/**
 * The message box. Type, speak, or attach a picture (camera, gallery, paste or drag). Nothing is sent until the user presses the button.
 * The text is cleared only after the server has answered, so a failure never loses what was typed.
 */
const BAR_HINTS = ['Or just tell me: laptop for coding under 60k', 'mujhe 50k ke andar laptop chahiye', 'A stylish laptop with good battery life', 'MacBook Air M1 vs IdeaPad 3'];
const LANG_KEY = 'lapfit.voicelang'; export const LANG_EVENT = 'lapfit:voicelang';
/** The voice language is one choice for the whole app: the Trust sheet and the message box share it. */
export const setVoiceLang = (code: string) => { setJson(LANG_KEY, code); window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: code })); };
export const getVoiceLang = () => getJson<string>(LANG_KEY, 'en-IN');
export function Composer({ onSend, onSendImage, busy, cooldown, prefill, placeholder, label = 'Your message', variant = 'full', focusName, onClearFocus, editing, onCancelEdit }: { focusName?: string; onClearFocus?(): void; editing?: boolean; onCancelEdit?(): void; variant?: 'full' | 'bar'; onSend(text: string): Promise<boolean> | void; onSendImage?(img: SendImage, text: string): Promise<boolean> | void; busy: boolean; cooldown: number; prefill?: { text: string; n: number } | null; placeholder?: string; label?: string }) {
  const [text, setText] = useState(''); const ref = useRef<HTMLTextAreaElement>(null); const file = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<PreparedImage | null>(null); const [imgErr, setImgErr] = useState(''); const [prep, setPrep] = useState(false);
  const [lang, setLang] = useState(getVoiceLang); const [hintI, setHintI] = useState(0); const base = useRef('');
  const [askVoice, setAskVoice] = useState(false);
  // after the first reply the box is a small pill that opens into the panel (it never sits over the reading area)
  const dock = variant === 'full'; const [open, setOpen] = useState(false); const wrap = useRef<HTMLDivElement>(null); const pill = useRef<HTMLButtonElement>(null); const focusNext = useRef(false); const quiet = useRef(false);
  const [imgOk, setImgOk] = useState(() => getJson<boolean>(CONSENT, false)); const [voiceOk, setVoiceOk] = useState(() => getJson<boolean>(VOICE, false));
  const mic = useSpeechInput(lang, (t) => setText((base.current ? base.current + ' ' : '') + t));
  useEffect(() => { const on = (e: Event) => setLang((e as CustomEvent<string>).detail); window.addEventListener(LANG_EVENT, on); return () => window.removeEventListener(LANG_EVENT, on); }, []);
  useEffect(() => {   // the "just tell me" bar shows a new example every few seconds (not for people who asked for less motion)
    if (variant !== 'bar' || placeholder || text || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const t = setInterval(() => setHintI((i) => (i + 1) % BAR_HINTS.length), 4000); return () => clearInterval(t);
  }, [variant, placeholder, text]);
  useEffect(() => { if (prefill) { setText(prefill.text); if (dock) { focusNext.current = true; setOpen(true); } ref.current?.focus(); } }, [prefill]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (dock && text.trim() !== '') setOpen(true); }, [dock]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && focusNext.current) { focusNext.current = false; ref.current?.focus(); } }, [open]);
  const collapse = (back = true) => {
    if (!dock) return; if (mic.listening) mic.stop();
    const inside = !!wrap.current && wrap.current.contains(document.activeElement); setOpen(false);
    if (inside && back) { quiet.current = true; setTimeout(() => { pill.current?.focus(); quiet.current = false; }, 0); }
  };
  useEffect(() => {   // outside click or tap collapses the panel; what was typed is kept
    if (!dock || !open) return; const on = (e: Event) => { if (wrap.current && !wrap.current.contains(e.target as Node)) collapse(false); };
    document.addEventListener('pointerdown', on); document.addEventListener('mousedown', on); return () => { document.removeEventListener('pointerdown', on); document.removeEventListener('mousedown', on); };
  });
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.previewUrl); }, [img]);

  const attach = async (f: File | undefined | null) => {
    if (!f) return; setImgErr(''); setPrep(true);
    try { setImg(await prepareImage(f)); } catch (e) { setImgErr((e as Error).message); } finally { setPrep(false); }
  };
  const disabled = busy || cooldown > 0 || prep || (img ? !imgOk : text.trim() === '');
  const submit = async () => {
    if (disabled) return;
    if (img && onSendImage) { const ok = await onSendImage({ image: { mime: img.mime, data: img.data }, preview: img.previewUrl }, text.trim()); if (ok) { setImg(null); setText(''); collapse(); } return; }
    const ok = await onSend(text.trim()); if (ok) { setText(''); collapse(); }
  };
  const toggleMic = () => { if (mic.listening) { mic.stop(); return; } if (!voiceOk) { setAskVoice(true); return; } base.current = text.trim(); mic.start(); };
  const form = (
    <form id="composer-panel" className={`composer ${variant === 'bar' ? 'bar' : ''} ${text || img || mic.listening || askVoice ? 'has-content' : ''} ${mic.listening ? 'listening' : ''}`} onSubmit={(e) => { e.preventDefault(); submit(); }}
      onDragOver={(e) => { if (onSendImage) e.preventDefault(); }} onDrop={(e) => { if (!onSendImage) return; e.preventDefault(); void attach(e.dataTransfer.files?.[0]); }}>
      {img && (
        <div className="attachment"><img src={img.previewUrl} alt="The picture you attached" /><div><strong>Picture ready</strong><span className="muted small">{Math.round(img.bytes / 1024)} KB, resized on your device</span></div>
          <button type="button" className="link" onClick={() => setImg(null)} aria-label="Remove the picture">Remove</button></div>
      )}
      {img && !imgOk && (
        <label className="consent"><input type="checkbox" onChange={(e) => { if (e.target.checked) { setImgOk(true); setJson(CONSENT, true); } }} /> I understand this picture is sent to Google’s Gemini AI (or Anthropic’s Claude when Gemini is busy) to be read. LapFit does not store it. I have not included faces or other people’s details.</label>
      )}
      {mic.supported && !voiceOk && askVoice && (
        <label className="consent"><input type="checkbox" onChange={(e) => { if (e.target.checked) { setVoiceOk(true); setJson(VOICE, true); setAskVoice(false); base.current = text.trim(); mic.start(); } }} /> I understand my browser may send my voice to its speech service (Google, in Chrome) to turn it into text. LapFit never receives the audio.</label>
      )}
      {editing && <p className="editing-note" role="status"><strong>Editing your message</strong> <span className="muted small">Sending replaces it and the replies after it. Esc to cancel.</span> <button type="button" className="link" onClick={() => { onCancelEdit?.(); setText(''); }}>Cancel</button></p>}
      {focusName && (
        <div className="focus-chip" role="group" aria-label="What I am answering about"><span className="focus-chip-text">Asking about: <strong>{shortName(focusName)}</strong></span>
          {onClearFocus && <button type="button" className="focus-x" onClick={onClearFocus} aria-label={`Stop asking about ${shortName(focusName)}`}><span aria-hidden="true">✕</span></button>}</div>
      )}
      <label htmlFor="composer-input" className="sr-only">{label}</label>
      <textarea id="composer-input" ref={ref} rows={variant === 'bar' ? 1 : 2} maxLength={MAX} value={text} placeholder={mic.listening ? 'Listening… speak now' : (placeholder ?? (focusName ? 'Ask about this laptop, or a new one' : variant === 'bar' ? BAR_HINTS[hintI] : 'e.g. laptop for coding under 60k, not HP'))} onChange={(e) => setText(e.target.value)}
        onPaste={(e) => { const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/')); if (f && onSendImage) { e.preventDefault(); void attach(f); } }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
      {focusName && <p className="muted small focus-guard">I answer from the catalog, owner reviews and web pages, and I only talk about laptops. I can’t promise how long a laptop will last.</p>}
      {(mic.error || imgErr) && <p className="error small" role="alert">{imgErr || mic.error}</p>}
      <div className="composer-row">
        <div className="tools">
          {onSendImage && <><input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="tool" onClick={() => file.current?.click()} aria-label="Add a picture: camera or gallery" disabled={busy || prep}>📷<span className="tool-label">Photo</span></button></>}
          {mic.supported && <>
            <button type="button" className={`tool ${mic.listening ? 'on' : ''}`} onClick={toggleMic} aria-pressed={mic.listening} aria-label={mic.listening ? 'Stop listening' : 'Speak your question'} disabled={busy}>{mic.listening ? '⏹' : '🎤'}<span className="tool-label">{mic.listening ? 'Stop' : 'Speak'}</span></button>
            <select className="lang" aria-label="Voice language" value={lang} onChange={(e) => setVoiceLang(e.target.value)} disabled={mic.listening}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></>}
        </div>
        <span className="muted small hint">{text.length > MAX - 500 ? `${text.length} / ${MAX}` : 'Enter to send'}</span>
        <button className="btn" type="submit" disabled={disabled}>{cooldown > 0 ? `Wait ${fmtWait(cooldown)}` : prep ? 'Preparing…' : busy ? 'Working…' : img ? 'Read picture' : editing ? 'Resend' : 'Ask'}</button>
      </div>
    </form>
  );
  const canHover = () => typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
  const expand = (focusInput: boolean) => { if (focusInput) focusNext.current = true; setOpen(true); };
  // one tree for both variants, so the typed text survives the first reply switching the bar into the pill
  return (
    <div ref={wrap} className={dock ? `composer-dock ${open ? 'open' : 'closed'}` : 'composer-plain'} onKeyDown={(e) => { if (!dock || e.key !== 'Escape' || !open) return; e.stopPropagation(); if (editing) { onCancelEdit?.(); setText(''); } else collapse(); }}>
      {dock && <button ref={pill} type="button" className="ask-pill" aria-expanded={open} aria-controls="composer-panel" hidden={open}
        onClick={() => expand(true)} onFocus={() => { if (!quiet.current) expand(true); }} onMouseEnter={() => { if (canHover()) expand(false); }}>
        <span aria-hidden="true">💬</span><span className="pill-text">Ask a follow-up</span>{focusName && <span className="pill-chip">{shortName(focusName)}</span>}{text.trim() !== '' && <span className="pill-draft" aria-label="Your draft is kept">draft</span>}
      </button>}
      <div className={dock ? 'dock-panel' : undefined} hidden={dock && !open}>{form}</div>
    </div>
  );
}
