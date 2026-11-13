import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, renderHook, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { speak, stopSpeaking, canSpeak, canListen, useSpeechInput } from '../lib/speech';
import { summaryLines, speechText, shareText, whatsappUrl, hasShareable } from '../lib/summary';
import { cardLines, renderShareCard } from '../lib/share';
import { Composer } from '../components/Composer';
import { ReplyActions } from '../components/ReplyActions';
import { fx } from './helpers';

// ---------- fakes for browser features jsdom does not have ----------
class FakeRec { static last: FakeRec | null = null; lang = ''; interimResults = false; continuous = false; onresult: any = null; onerror: any = null; onend: any = null; started = false;
  start() { this.started = true; FakeRec.last = this; } stop() { this.onend?.(); } abort() {} }
function fakeSynth() { const spoken: any[] = []; const synth = { cancel: vi.fn(), speak: vi.fn((u: any) => spoken.push(u)), getVoices: () => [{ lang: 'hi-IN', name: 'Hindi' }, { lang: 'en-IN', name: 'English India' }] };
  vi.stubGlobal('speechSynthesis', synth); vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; lang = ''; voice: any; rate = 1; onend: any; onerror: any; constructor(t: string) { this.text = t; } }); return { synth, spoken }; }
const listen = () => vi.stubGlobal('webkitSpeechRecognition', FakeRec);
afterEach(() => { vi.unstubAllGlobals(); FakeRec.last = null; });

describe('voice out', () => {
  it('speaks the text in the right language, with a matching voice, cut to a sensible length; says false when it cannot', () => {
    const { spoken, synth } = fakeSynth(); expect(canSpeak()).toBe(true); expect(speak('Namaste', 'hi-IN')).toBe(true); expect(synth.cancel).toHaveBeenCalled(); expect(spoken[0].lang).toBe('hi-IN'); expect(spoken[0].voice.name).toBe('Hindi');
    speak('x'.repeat(5000), 'en-IN'); expect(spoken[1].text.length).toBe(1800); expect(speak('   ', 'en-IN')).toBe(false);
    vi.unstubAllGlobals(); expect(canSpeak()).toBe(false); expect(speak('hi', 'en-IN')).toBe(false); expect(() => stopSpeaking()).not.toThrow();
  });
});

describe('voice in', () => {
  it('is only offered where the browser has speech recognition', () => { expect(canListen()).toBe(false); listen(); expect(canListen()).toBe(true); });
  it('starts in the chosen language, streams the words as they come, reports a blocked microphone in plain words, and stops', () => {
    listen(); const onText = vi.fn(); const { result } = renderHook(() => useSpeechInput('te-IN', onText)); act(() => result.current.start());
    expect(FakeRec.last!.lang).toBe('te-IN'); expect(FakeRec.last!.interimResults).toBe(true); expect(result.current.listening).toBe(true);
    act(() => FakeRec.last!.onresult({ results: [Object.assign([{ transcript: 'laptop under' }], { isFinal: false })] })); expect(onText).toHaveBeenLastCalledWith('laptop under', false);
    act(() => FakeRec.last!.onresult({ results: [Object.assign([{ transcript: 'laptop under 50k' }], { isFinal: true })] })); expect(onText).toHaveBeenLastCalledWith('laptop under 50k', true);
    act(() => FakeRec.last!.onerror({ error: 'not-allowed' })); expect(result.current.error).toMatch(/microphone is blocked/); expect(result.current.listening).toBe(false);
    act(() => result.current.start()); act(() => FakeRec.last!.onerror({ error: 'no-speech' })); expect(result.current.error).toMatch(/did not hear/); act(() => result.current.start()); act(() => result.current.stop()); expect(result.current.listening).toBe(false);
  });
  it('without support, start explains instead of crashing', () => { const { result } = renderHook(() => useSpeechInput('en-IN', () => {})); act(() => result.current.start()); expect(result.current.error).toMatch(/not available/); });
});

describe('summaries and sharing are built only from the answer\'s own text', () => {
  it('every number in the spoken summary appears in the reply itself', () => {
    const r = fx('shortlist'); const text = speechText(r); const json = JSON.stringify(r);
    for (const n of text.match(/\d[\d,.]*/g) ?? []) expect(json.replace(/,/g, '')).toContain(n.replace(/,/g, '').replace(/\.$/, ''));
    expect(text).toContain('rupees'); expect(text).not.toContain('₹'); expect(summaryLines(r, 3).length).toBeGreaterThan(2);
  });
  it('covers claims, findings, sell plan and compare, and says what cannot be checked', () => {
    expect(summaryLines(fx('image_seller')).join(' ')).toMatch(/MISMATCH|Does not match/i); expect(summaryLines(fx('used')).join(' ')).toMatch(/Battery health/); expect(summaryLines(fx('sell')).join(' ')).toMatch(/might sell for/); expect(summaryLines(fx('compare')).join(' ')).toMatch(/Comparing/);
  });
  it('the share text carries the honest footer and the WhatsApp link is encoded and capped', () => {
    const t = shareText(fx('shortlist')); expect(t).toMatch(/not live prices/); const u = whatsappUrl('a & b ₹'); expect(u).toBe('https://wa.me/?text=a%20%26%20b%20%E2%82%B9'); expect(decodeURIComponent(whatsappUrl('x'.repeat(5000)).split('=')[1]).length).toBe(1500);
  });
  it('only answers with substance are shareable', () => { expect(hasShareable(fx('shortlist').blocks)).toBe(true); expect(hasShareable(fx('help').blocks)).toBe(false); expect(hasShareable(fx('catalog').blocks)).toBe(false); });
  it('the picture card draws the top picks with their dates and the honest footer; nothing to draw means false', () => {
    const texts: string[] = []; const ctx: any = { createLinearGradient: () => ({ addColorStop() {} }), beginPath() {}, moveTo() {}, arcTo() {}, fill() {}, fillRect() {}, measureText: (t: string) => ({ width: t.length * 14 }), fillText: (t: string) => texts.push(t), set fillStyle(_v: any) {}, set font(_v: string) {} };
    const c = document.createElement('canvas'); c.getContext = (() => ctx) as any; expect(cardLines(fx('shortlist')).length).toBe(3); expect(renderShareCard(fx('shortlist'), c)).toBe(true);
    const all = texts.join(' | '); expect(all).toMatch(/LapFit says/); expect(all).toMatch(/as of 10 Nov 2026/); expect(all).toMatch(/saved snapshot, not live/); expect(c.width).toBe(1080);
    expect(renderShareCard(fx('help'), c)).toBe(false);
  });
});

describe('reply actions', () => {
  it('read aloud toggles, uses the answer language, and is hidden when the browser cannot speak', async () => {
    const { synth, spoken } = fakeSynth(); render(<ReplyActions reply={{ ...fx('shortlist'), language: 'Hinglish' }} />);
    await userEvent.click(screen.getByRole('button', { name: /Read to me/ })); expect(spoken[0].lang).toBe('hi-IN'); expect(screen.getByRole('button', { name: /Stop/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Stop/ })); expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
  it('without speech support there is no read-aloud button, but sharing is still offered', () => { render(<ReplyActions reply={fx('shortlist')} />); expect(screen.queryByRole('button', { name: /Read to me/ })).toBeNull(); expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/\?text=/)); });
  it('shows nothing for an answer with nothing worth sharing', () => { const { container } = render(<ReplyActions reply={fx('help')} />); expect(container).toBeEmptyDOMElement(); });
  it('copy puts the share text on the clipboard; a blocked clipboard is explained', async () => {
    const w = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { value: { writeText: w }, configurable: true }); render(<ReplyActions reply={fx('shortlist')} />);
    await userEvent.click(screen.getByRole('button', { name: /Copy/ })); expect(w).toHaveBeenCalledWith(expect.stringContaining('not live prices')); expect(await screen.findByText('Copied.')).toBeInTheDocument();
    w.mockRejectedValue(new Error('no')); await userEvent.click(screen.getByRole('button', { name: /Copy/ })); expect(await screen.findByText(/Copy is blocked/)).toBeInTheDocument();
  });
});

vi.mock('../lib/image', async (orig) => { const m: any = await orig(); return { ...m, prepareImage: vi.fn() }; });
import * as imageLib from '../lib/image';
const prepared = { mime: 'image/jpeg' as const, data: 'QUJD', bytes: 120_000, width: 800, height: 600, previewUrl: 'blob:p' };
describe('composer: text, voice and pictures', () => {
  const setup = (props: any = {}) => { const onSend = vi.fn().mockResolvedValue(true); const onSendImage = vi.fn().mockResolvedValue(true); render(<Composer onSend={onSend} onSendImage={onSendImage} busy={false} cooldown={0} {...props} />); fireEvent.click(screen.getByRole('button', { name: /Ask a follow-up/ })); return { onSend, onSendImage }; };
  const attach = async () => { (imageLib.prepareImage as any).mockResolvedValue(prepared); const input = document.querySelector('input[type=file]') as HTMLInputElement; await userEvent.upload(input, new File(['x'], 'p.png', { type: 'image/png' })); };
  beforeEach(() => { (imageLib.prepareImage as any).mockReset(); localStorage.clear(); });

  it('shows no microphone where speech is unsupported, and a photo button only when pictures are supported by the screen', () => { setup(); expect(screen.queryByRole('button', { name: /Speak/ })).toBeNull(); expect(screen.getByRole('button', { name: /Add a picture/ })).toBeInTheDocument(); });
  it('a picture needs a one-time consent before it can be sent; the button then says Read picture; the text box is cleared after success', async () => {
    const { onSendImage } = setup(); await attach(); expect(await screen.findByAltText('The picture you attached')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Read picture' })).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/sent to Google’s Gemini AI/)); const go = screen.getByRole('button', { name: 'Read picture' }); expect(go).toBeEnabled(); await userEvent.click(go);
    await waitFor(() => expect(onSendImage).toHaveBeenCalledWith({ image: { mime: 'image/jpeg', data: 'QUJD' }, preview: 'blob:p' }, '')); await waitFor(() => expect(screen.queryByAltText('The picture you attached')).toBeNull());
    expect(JSON.parse(localStorage.getItem('lapfit.imgconsent.v1')!)).toBe(true);
  });
  it('a picture can be removed before sending, and consent is remembered next time', async () => { localStorage.setItem('lapfit.imgconsent.v1', 'true'); setup(); await attach(); expect(screen.queryByLabelText(/sent to Google/)).toBeNull(); await userEvent.click(screen.getByRole('button', { name: 'Remove the picture' })); expect(screen.queryByAltText('The picture you attached')).toBeNull(); });
  it('a picture that cannot be prepared shows a plain error and nothing is sent', async () => { const { onSendImage } = setup(); (imageLib.prepareImage as any).mockRejectedValue(new Error('I could not open that picture. If it is a HEIC photo, take a screenshot of it.')); await userEvent.upload(document.querySelector('input[type=file]') as HTMLInputElement, new File(['x'], 'p.heic', { type: 'image/heic' })); expect(await screen.findByRole('alert')).toHaveTextContent(/HEIC/); expect(onSendImage).not.toHaveBeenCalled(); });
  it('a pasted picture is attached; pasting text is left alone', async () => { setup(); (imageLib.prepareImage as any).mockResolvedValue(prepared); const box = screen.getByLabelText('Your message'); fireEvent.paste(box, { clipboardData: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } }); expect(await screen.findByAltText('The picture you attached')).toBeInTheDocument(); });
  it('a dropped picture is attached', async () => { setup(); (imageLib.prepareImage as any).mockResolvedValue(prepared); fireEvent.drop(document.querySelector('form')!, { dataTransfer: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } }); expect(await screen.findByAltText('The picture you attached')).toBeInTheDocument(); });
  it('without a picture handler the composer is text only', () => { render(<Composer onSend={vi.fn()} busy={false} cooldown={0} />); expect(screen.queryByRole('button', { name: /Add a picture/ })).toBeNull(); });

  it('voice: needs a one-time consent, then fills the box with what you say in the chosen language; nothing is sent until you press Ask', async () => {
    listen(); const { onSend } = setup(); const mic = screen.getByRole('button', { name: /Speak your question/ }); expect(screen.queryByLabelText(/may send my voice/)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Voice language'), 'hi-IN'); await userEvent.click(mic); expect(FakeRec.last).toBeNull();   // first tap asks for consent, it does not listen
    await userEvent.click(screen.getByLabelText(/may send my voice to its speech service/)); expect(FakeRec.last!.lang).toBe('hi-IN'); expect(screen.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true'); expect(screen.queryByLabelText(/may send my voice/)).toBeNull();
    act(() => FakeRec.last!.onresult({ results: [Object.assign([{ transcript: 'mujhe 50k ke andar laptop' }], { isFinal: true })] })); expect(screen.getByLabelText('Your message')).toHaveValue('mujhe 50k ke andar laptop'); expect(onSend).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ask' })); expect(onSend).toHaveBeenCalledWith('mujhe 50k ke andar laptop');
  });
  it('voice keeps what was already typed and a blocked microphone is explained', async () => {
    listen(); localStorage.setItem('lapfit.voiceconsent.v1', 'true'); setup(); await userEvent.type(screen.getByLabelText('Your message'), 'laptop for'); await userEvent.click(screen.getByRole('button', { name: /Speak your question/ }));
    act(() => FakeRec.last!.onresult({ results: [Object.assign([{ transcript: 'coding' }], { isFinal: true })] })); expect(screen.getByLabelText('Your message')).toHaveValue('laptop for coding');
    act(() => FakeRec.last!.onerror({ error: 'not-allowed' })); expect(await screen.findByRole('alert')).toHaveTextContent(/microphone is blocked/);
  });
});
