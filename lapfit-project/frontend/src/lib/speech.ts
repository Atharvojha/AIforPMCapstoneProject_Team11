// Voice in and voice out, using the browser's own speech features. No audio is sent to LapFit.
// (In Chrome, speech recognition sends the audio to Google's speech service; the app says so before first use.)
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Lang { code: string; label: string }
export const LANGS: Lang[] = [{ code: 'en-IN', label: 'English' }, { code: 'hi-IN', label: 'हिन्दी' }, { code: 'te-IN', label: 'తెలుగు' }, { code: 'ta-IN', label: 'தமிழ்' }];

type Rec = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void };
const recognitionCtor = (): (new () => Rec) | null => { const w = window as any; return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null; };
export const canListen = () => typeof window !== 'undefined' && !!recognitionCtor();
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof (window as any).SpeechSynthesisUtterance === 'function';

/** Speak into the box. Interim words appear as you talk; the final text replaces them. Nothing is sent until the user presses Ask. */
export function useSpeechInput(lang: string, onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false); const [error, setError] = useState<string | null>(null); const rec = useRef<Rec | null>(null); const cb = useRef(onText); cb.current = onText;
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* ignore */ } }, []);
  const stop = useCallback(() => { try { rec.current?.stop(); } catch { /* ignore */ } }, []);
  const start = useCallback(() => {
    const C = recognitionCtor(); if (!C) { setError('Voice input is not available in this browser.'); return; }
    setError(null); const r = new C(); r.lang = lang; r.interimResults = true; r.continuous = false; rec.current = r;
    r.onresult = (e: any) => { let text = ''; let final = false; for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; } cb.current(text.trim(), final); };
    r.onerror = (e: any) => { setListening(false); setError(e?.error === 'not-allowed' || e?.error === 'service-not-allowed' ? 'The microphone is blocked. Allow it in the browser to use your voice.' : e?.error === 'no-speech' ? 'I did not hear anything. Try again.' : e?.error === 'network' ? 'Voice input needs an internet connection.' : 'Voice input stopped. Please try again.'); };
    r.onend = () => setListening(false);
    try { r.start(); setListening(true); } catch { setListening(false); setError('Voice input could not start.'); }
  }, [lang]);
  return { supported: canListen(), listening, error, start, stop };
}

const pickVoice = (lang: string): SpeechSynthesisVoice | undefined => { const v = window.speechSynthesis.getVoices(); return v.find((x) => x.lang === lang) ?? v.find((x) => x.lang.startsWith(lang.slice(0, 2))); };
/** Read text aloud in the language of the answer. Returns false when the browser cannot speak. */
export function speak(text: string, lang: string, onEnd?: () => void): boolean {
  if (!canSpeak() || !text.trim()) return false;
  const synth = window.speechSynthesis; synth.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 1800)); u.lang = lang; const v = pickVoice(lang); if (v) u.voice = v; u.rate = 1;
  u.onend = () => onEnd?.(); u.onerror = () => onEnd?.(); synth.speak(u); return true;
}
export const stopSpeaking = () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } };
/** The speech language for a reply: the backend names the user's language. */
export const speechLangFor = (language: string | undefined): string => (/hindi|hinglish/i.test(language ?? '') ? 'hi-IN' : /telugu/i.test(language ?? '') ? 'te-IN' : /tamil/i.test(language ?? '') ? 'ta-IN' : 'en-IN');
