export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Create a canvas; OffscreenCanvas when available (workers, Safari 16.4+). */
export function makeCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: AnyCanvas): Ctx2D {
  const ctx = c.getContext('2d', { willReadFrequently: true }) as Ctx2D | null;
  if (!ctx) throw new Error('2D canvas is not available in this browser.');
  return ctx;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Convert a canvas to a Blob (PNG or JPEG). */
export async function canvasToBlob(c: AnyCanvas, type: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed.'))), type, quality);
  });
}
