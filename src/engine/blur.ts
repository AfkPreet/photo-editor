import { makeCanvas, ctx2d, type AnyCanvas } from '../lib/canvas';

/** Separable box blur, three passes (≈ gaussian), in place on RGBA bytes. */
export function boxBlur(data: Uint8ClampedArray, w: number, h: number, radius: number, passes = 3): void {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(w * h * 4);
  const src = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) src[i] = data[i];
  const div = r * 2 + 1;
  for (let p = 0; p < passes; p++) {
    // horizontal
    for (let y = 0; y < h; y++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) acc += src[(y * w + Math.min(w - 1, Math.max(0, k))) * 4 + c];
        for (let x = 0; x < w; x++) {
          tmp[(y * w + x) * 4 + c] = acc / div;
          const addX = Math.min(w - 1, x + r + 1);
          const subX = Math.max(0, x - r);
          acc += src[(y * w + addX) * 4 + c] - src[(y * w + subX) * 4 + c];
        }
      }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) acc += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * 4 + c];
        for (let y = 0; y < h; y++) {
          src[(y * w + x) * 4 + c] = acc / div;
          const addY = Math.min(h - 1, y + r + 1);
          const subY = Math.max(0, y - r);
          acc += tmp[(addY * w + x) * 4 + c] - tmp[(subY * w + x) * 4 + c];
        }
      }
    }
  }
  for (let i = 0; i < data.length; i++) if ((i & 3) !== 3) data[i] = src[i];
}

export interface SmallBlur {
  canvas: AnyCanvas;
  data: Uint8ClampedArray;
  w: number;
  h: number;
  /** small px per source px */
  scale: number;
}

/** Downscale the source to ≤ maxW wide and blur it; `radius` is in source pixels. */
export function blurredSmall(source: CanvasImageSource, width: number, height: number, radius: number, maxW = 320): SmallBlur {
  const scale = Math.min(1, maxW / Math.max(width, height));
  const w = Math.max(2, Math.round(width * scale));
  const h = Math.max(2, Math.round(height * scale));
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  boxBlur(img.data, w, h, Math.max(1, radius * scale));
  ctx.putImageData(img, 0, 0);
  return { canvas: c, data: img.data, w, h, scale };
}

/** Bilinear sample of a small RGBA buffer at source coordinates. */
export function sampleSmall(s: SmallBlur, x: number, y: number, c: number): number {
  const fx = Math.min(s.w - 1.001, Math.max(0, x * s.scale));
  const fy = Math.min(s.h - 1.001, Math.max(0, y * s.scale));
  const x0 = fx | 0;
  const y0 = fy | 0;
  const tx = fx - x0;
  const ty = fy - y0;
  const i00 = (y0 * s.w + x0) * 4 + c;
  const i10 = i00 + 4;
  const i01 = i00 + s.w * 4;
  const i11 = i01 + 4;
  return (s.data[i00] * (1 - tx) + s.data[i10] * tx) * (1 - ty) + (s.data[i01] * (1 - tx) + s.data[i11] * tx) * ty;
}

/** Mix a blurred copy over the canvas (diffusion / soft focus). */
export function softenCanvas(canvas: AnyCanvas, width: number, height: number, amount: number, radius: number): void {
  if (amount <= 0) return;
  const small = blurredSmall(canvas as CanvasImageSource, width, height, radius, 480);
  const ctx = ctx2d(canvas);
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small.canvas as CanvasImageSource, 0, 0, width, height);
  ctx.restore();
}

export interface GlowOptions {
  threshold: number;
  radius: number;
  strength: number;
  /** Optional RGB multiplier for the glow (halation is warm red). */
  tint?: [number, number, number];
  mode: 'screen' | 'lighter';
}

/** Blurred highlights added back on top: bloom (screen) or halation (additive, tinted). */
export function glowPass(canvas: AnyCanvas, width: number, height: number, opt: GlowOptions): void {
  if (opt.strength <= 0) return;
  const scale = Math.min(1, 320 / Math.max(width, height));
  const w = Math.max(2, Math.round(width * scale));
  const h = Math.max(2, Math.round(height * scale));
  const c = makeCanvas(w, h);
  const sctx = ctx2d(c);
  sctx.drawImage(canvas as CanvasImageSource, 0, 0, w, h);
  const img = sctx.getImageData(0, 0, w, h);
  const d = img.data;
  const t = opt.threshold;
  const tint = opt.tint ?? [1, 1, 1];
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const keep = t >= 1 ? 0 : Math.max(0, (l - t) / (1 - t));
    d[i] = d[i] * keep * tint[0];
    d[i + 1] = d[i + 1] * keep * tint[1];
    d[i + 2] = d[i + 2] * keep * tint[2];
  }
  boxBlur(d, w, h, Math.max(1, opt.radius * scale));
  sctx.putImageData(img, 0, 0);
  const ctx = ctx2d(canvas);
  ctx.save();
  ctx.globalCompositeOperation = opt.mode;
  ctx.globalAlpha = Math.min(1, opt.strength);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c as CanvasImageSource, 0, 0, width, height);
  ctx.restore();
}

/** Return a new canvas with a flat border around the image. */
export function addBorder(canvas: AnyCanvas, width: number, height: number, fraction: number, color: string): AnyCanvas {
  const b = Math.round(Math.min(width, height) * fraction);
  if (b <= 0) return canvas;
  const out = makeCanvas(width + b * 2, height + b * 2);
  const ctx = ctx2d(out);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas as CanvasImageSource, b, b);
  return out;
}
