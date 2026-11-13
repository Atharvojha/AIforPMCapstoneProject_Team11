import { useEffect, useState } from 'react';
import { prepareImage, type PreparedImage } from '../lib/image';
import { getJson, setJson } from '../lib/storage';

const CONSENT = 'lapfit.imgconsent.v1';
/** Attach a picture (already shrunk on the device), with the one-time consent that it will be read by Gemini. */
export function useImageAttach() {
  const [img, setImg] = useState<PreparedImage | null>(null); const [err, setErr] = useState(''); const [prep, setPrep] = useState(false);
  const [ok, setOkState] = useState(() => getJson<boolean>(CONSENT, false));
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.previewUrl); }, [img]);
  const attach = async (f: File | null | undefined) => { if (!f) return; setErr(''); setPrep(true); try { setImg(await prepareImage(f)); } catch (e) { setErr((e as Error).message); } finally { setPrep(false); } };
  const agree = () => { setOkState(true); setJson(CONSENT, true); };
  return { img, err, prep, consented: ok, attach, agree, clear: () => setImg(null) };
}
