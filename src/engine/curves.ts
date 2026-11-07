import { clamp } from '../lib/canvas';

/** Monotone cubic interpolation (Fritsch–Carlson) through sorted control points. */
export function monotoneCurve(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

export interface ToneParams {
  contrast: number;
  fade: number;
  brightness: number;
  shadows: number;
  highlights: number;
}

/** 256-entry tone curve: contrast pivots the quarter points, brightness moves the middle, fade lifts black. */
export function buildToneLut(p: ToneParams): Float32Array {
  const xs = [0, 0.25, 0.5, 0.75, 1];
  const ys = [
    clamp(p.fade * 0.6, 0, 0.4),
    clamp(0.25 - p.contrast * 0.14 + p.shadows * 0.12 + p.brightness * 0.12 + p.fade * 0.25, 0.02, 0.6),
    clamp(0.5 + p.brightness * 0.25, 0.15, 0.85),
    clamp(0.75 + p.contrast * 0.12 + p.highlights * 0.12 + p.brightness * 0.1, 0.4, 0.98),
    1,
  ];
  for (let i = 1; i < ys.length; i++) if (ys[i] <= ys[i - 1] + 0.01) ys[i] = ys[i - 1] + 0.01;
  const curve = monotoneCurve(xs, ys);
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) lut[i] = clamp(curve(i / 255), 0, 1);
  return lut;
}

/** Black/white points from a luma histogram of a subsample (0.5% and 99.5% percentiles). */
export function autoLevels(data: Uint8ClampedArray, width: number, height: number): { lo: number; hi: number } {
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 200_000)));
  let count = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const o = (y * width + x) * 4;
      hist[(0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) | 0]++;
      count++;
    }
  }
  const loTarget = count * 0.005;
  const hiTarget = count * 0.995;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= loTarget) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= count - hiTarget) {
      hi = i;
      break;
    }
  }
  if (hi - lo < 16) return { lo: 0, hi: 1 };
  return { lo: lo / 255, hi: hi / 255 };
}

/** Zero-mean RGB direction for a hue, so tinting shifts colour without shifting brightness much. */
export function tintVector(hueDeg: number): [number, number, number] {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const i = Math.floor(h);
  const f = h - i;
  const q = 1 - f;
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0: r = 1; g = f; b = 0; break;
    case 1: r = q; g = 1; b = 0; break;
    case 2: r = 0; g = 1; b = f; break;
    case 3: r = 0; g = q; b = 1; break;
    case 4: r = f; g = 0; b = 1; break;
    default: r = 1; g = 0; b = q;
  }
  const mean = (r + g + b) / 3;
  return [r - mean, g - mean, b - mean];
}
