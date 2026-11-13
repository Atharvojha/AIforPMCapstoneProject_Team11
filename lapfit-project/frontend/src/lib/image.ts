// Prepare a picture before it leaves the device: re-encoded as a small JPEG (this also removes location and camera details),
// at most 1280 pixels on the long side and about 500 KB. Nothing is uploaded until the user presses the button.
export interface PreparedImage { mime: 'image/jpeg'; data: string; bytes: number; width: number; height: number; previewUrl: string }
export const MAX_SIDE = 1280; export const MAX_BYTES = 500_000;

export function fitWithin(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
const toB64 = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('read_failed')); r.readAsDataURL(blob); });
const toBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', q));

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!/^image\//.test(file.type)) throw new Error('That file is not a picture.');
  if (file.size > 25_000_000) throw new Error('That picture is very large. Please pick a smaller one.');
  let bmp: ImageBitmap | HTMLImageElement;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('I could not open that picture. If it is a HEIC photo, take a screenshot of it or choose a JPEG or PNG.'); }
  const { w, h } = fitWithin(bmp.width, bmp.height); const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); if (!ctx) throw new Error('This browser cannot prepare pictures.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);
  let q = 0.85; let blob = await toBlob(c, q);
  while (blob && blob.size > MAX_BYTES && q > 0.4) { q -= 0.1; blob = await toBlob(c, q); }
  if (!blob || blob.size > MAX_BYTES * 1.4) throw new Error('I could not make that picture small enough. Try a screenshot instead.');
  return { mime: 'image/jpeg', data: await toB64(blob), bytes: blob.size, width: w, height: h, previewUrl: URL.createObjectURL(blob) };
}
