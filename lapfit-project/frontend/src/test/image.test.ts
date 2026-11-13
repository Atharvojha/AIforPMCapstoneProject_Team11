import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prepareImage, MAX_BYTES } from '../lib/image';

afterEach(() => { vi.unstubAllGlobals(); });
describe('picture preparation', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000 }))); (URL as any).createObjectURL = vi.fn(() => 'blob:preview');
    const sizes = [900_000, 700_000, 400_000]; let n = 0; const draws: any[] = [];
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ fillRect() {}, drawImage: (...a: any[]) => draws.push(a), set fillStyle(_v: string) {} })) as any;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, _t?: string, q?: number) { (globalThis as any).__q = [...((globalThis as any).__q ?? []), q]; cb(new Blob([new Uint8Array(sizes[Math.min(n++, sizes.length - 1)])], { type: 'image/jpeg' })); } as any;
    (globalThis as any).__q = [];
  });
  it('resizes to at most 1280 pixels, re-encodes as JPEG at lower quality until small enough, and returns base64 plus a preview', async () => {
    const p = await prepareImage(new File(['x'], 'a.png', { type: 'image/png' })); expect(p.mime).toBe('image/jpeg'); expect(p.width).toBe(1280); expect(p.height).toBe(960); expect(p.bytes).toBeLessThanOrEqual(MAX_BYTES); expect(p.data.length).toBeGreaterThan(100); expect(p.previewUrl).toBe('blob:preview');
    const q = (globalThis as any).__q as number[]; expect(q[0]).toBeCloseTo(0.85); expect(q.length).toBe(3); expect(q[2]).toBeLessThan(q[0]);
  });
  it('refuses non-pictures, giant files, and files the browser cannot open (with advice for HEIC)', async () => {
    await expect(prepareImage(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow(/not a picture/);
    const big = new File(['x'], 'b.png', { type: 'image/png' }); Object.defineProperty(big, 'size', { value: 30_000_000 }); await expect(prepareImage(big)).rejects.toThrow(/very large/);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode'); })); await expect(prepareImage(new File(['x'], 'c.heic', { type: 'image/heic' }))).rejects.toThrow(/HEIC/);
  });
});

