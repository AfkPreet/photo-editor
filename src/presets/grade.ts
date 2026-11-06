import { ctx2d, clamp } from '../lib/canvas';
import { mulberry32 } from '../lib/random';
import type { Preset, Params, RenderInput } from './types';

/**
 * Film grade. Our own parametric look inspired by a moody, cool, high-contrast
 * grade: strong tone curve, cool white balance, navy shadows, teal mids, cream
 * highlights, a touch of vignette and clumpy grain.
 */

export const GRADE_DEFAULTS: Params = {
  intensity: 1,
  levels: 0.7,
  brightness: -0.18,
  contrast: 0.4,
  fade: 0.05,
  shadows: 0,
  highlights: 0,
  temperature: -0.15,
  tint: 0.03,
  shadowHue: 236,
  shadowTint: 0.22,
  midHue: 204,
  midTint: 0.18,
  highlightHue: 95,
  highlightTint: 0.16,
  saturation: 1.05,
  vignette: 0.25,
  grain: 0.18,
  grainSize: 1.2,
  seed: 7,
};

/** Monotone cubic interpolation (Fritsch–Carlson) through sorted control points. */
function monotoneCurve(xs: number[], ys: number[]): (x: number) => number {
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

function buildToneLut(p: Params): Float32Array {
  const contrast = Number(p.contrast);
  const fade = Number(p.fade);
  const brightness = Number(p.brightness);
  const shadows = Number(p.shadows);
  const highlights = Number(p.highlights);
  const xs = [0, 0.25, 0.5, 0.75, 1];
  const ys = [
    clamp(fade * 0.6, 0, 0.4),
    clamp(0.25 - contrast * 0.14 + shadows * 0.12 + brightness * 0.12 + fade * 0.25, 0.02, 0.6),
    clamp(0.5 + brightness * 0.25, 0.15, 0.85),
    clamp(0.75 + contrast * 0.12 + highlights * 0.12 + brightness * 0.1, 0.4, 0.98),
    1,
  ];
  // keep strictly increasing
  for (let i = 1; i < ys.length; i++) if (ys[i] <= ys[i - 1] + 0.01) ys[i] = ys[i - 1] + 0.01;
  const curve = monotoneCurve(xs, ys);
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) lut[i] = clamp(curve(i / 255), 0, 1);
  return lut;
}

/** Zero-mean RGB direction for a hue, so tinting shifts colour without shifting brightness much. */
function tintVector(hueDeg: number): [number, number, number] {
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

/** Coarse noise grid sampled bilinearly, giving clumpy film-like grain rather than per-pixel static. */
function makeNoise(seed: number, size = 192): Float32Array {
  const rand = mulberry32(seed);
  const n = new Float32Array(size * size);
  for (let i = 0; i < n.length; i++) n[i] = rand() * 2 - 1;
  return n;
}

/** Black/white points from a luma histogram of a subsample (0.5% and 99.5% percentiles). */
function autoLevels(data: Uint8ClampedArray, width: number, height: number): { lo: number; hi: number } {
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 200_000)));
  let count = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const o = (y * width + x) * 4;
      const l = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) | 0;
      hist[l]++;
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
  if (hi - lo < 16) return { lo: 0, hi: 255 };
  return { lo: lo / 255, hi: hi / 255 };
}

export async function renderGrade(input: RenderInput): Promise<RenderInput['source']> {
  const { source, width, height, params } = input;
  const ctx = ctx2d(source);
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const intensity = Number(params.intensity);
  if (intensity <= 0) return source;

  const lut = buildToneLut(params);
  const levelsStrength = Number(params.levels);
  const lv = levelsStrength > 0 ? autoLevels(data, width, height) : { lo: 0, hi: 1 };
  const lvLo = lv.lo * levelsStrength;
  const lvScale = 1 / (1 - lvLo - (1 - lv.hi) * levelsStrength);
  const temp = Number(params.temperature);
  const tint = Number(params.tint);
  const wbR = 1 + temp * 0.16 + tint * -0.05;
  const wbG = 1 + tint * 0.1;
  const wbB = 1 - temp * 0.16 + tint * -0.05;
  const sVec = tintVector(Number(params.shadowHue));
  const mVec = tintVector(Number(params.midHue));
  const hVec = tintVector(Number(params.highlightHue));
  const sStr = Number(params.shadowTint) * 0.4;
  const mStr = Number(params.midTint) * 0.4;
  const hStr = Number(params.highlightTint) * 0.4;
  const sat = Number(params.saturation);
  const vig = Number(params.vignette);
  const grain = Number(params.grain) * 0.22;
  const longEdge = Math.max(width, height);
  const grainPx = Math.max(0.6, Number(params.grainSize) * Math.max(1, longEdge / 1400));
  const coarsePx = grainPx * 3.1;
  const noise = grain > 0 ? makeNoise(Number(params.seed) || 1) : null;
  const NS = 192;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    const dy = (y - cy) / maxDist;
    // noise row coordinates
    const ny = y / grainPx;
    const ny0 = Math.floor(ny);
    const fy = ny - ny0;
    const ry0 = ((ny0 % NS) + NS) % NS;
    const ry1 = (ry0 + 1) % NS;
    const cy2 = y / coarsePx;
    const cy0 = Math.floor(cy2);
    const cfy = cy2 - cy0;
    const cry0 = ((cy0 + 97) % NS + NS) % NS;
    const cry1 = (cry0 + 1) % NS;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const r0 = data[o] / 255;
      const g0 = data[o + 1] / 255;
      const b0 = data[o + 2] / 255;

      // auto contrast (haze cut), then white balance
      let r = clamp((r0 - lvLo) * lvScale * wbR, 0, 1);
      let g = clamp((g0 - lvLo) * lvScale * wbG, 0, 1);
      let b = clamp((b0 - lvLo) * lvScale * wbB, 0, 1);

      // tone curve (per channel, like a film LUT)
      r = lut[(r * 255) | 0];
      g = lut[(g * 255) | 0];
      b = lut[(b * 255) | 0];

      // zone tints
      let L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const ws = (1 - L) * (1 - L);
      const wh = L * L;
      const wm = 4 * L * (1 - L);
      const ks = sStr * ws;
      const km = mStr * wm;
      const kh = hStr * wh;
      r += ks * sVec[0] + km * mVec[0] + kh * hVec[0];
      g += ks * sVec[1] + km * mVec[1] + kh * hVec[1];
      b += ks * sVec[2] + km * mVec[2] + kh * hVec[2];

      // saturation around luma
      L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = L + (r - L) * sat;
      g = L + (g - L) * sat;
      b = L + (b - L) * sat;

      // vignette
      if (vig > 0) {
        const dx = (x - cx) / maxDist;
        const d = Math.sqrt(dx * dx + dy * dy);
        const t = clamp((d - 0.45) / 0.75, 0, 1);
        const v = 1 - vig * t * t * (3 - 2 * t);
        r *= v;
        g *= v;
        b *= v;
      }

      // grain, strongest in the midtones
      if (noise) {
        const nx = x / grainPx;
        const nx0 = Math.floor(nx);
        const fx = nx - nx0;
        const rx0 = ((nx0 % NS) + NS) % NS;
        const rx1 = (rx0 + 1) % NS;
        const n00 = noise[ry0 * NS + rx0];
        const n10 = noise[ry0 * NS + rx1];
        const n01 = noise[ry1 * NS + rx0];
        const n11 = noise[ry1 * NS + rx1];
        const fine = (n00 * (1 - fx) + n10 * fx) * (1 - fy) + (n01 * (1 - fx) + n11 * fx) * fy;
        const cx2 = x / coarsePx;
        const cx0 = Math.floor(cx2);
        const cfx = cx2 - cx0;
        const crx0 = ((cx0 + 41) % NS + NS) % NS;
        const crx1 = (crx0 + 1) % NS;
        const coarse =
          (noise[cry0 * NS + crx0] * (1 - cfx) + noise[cry0 * NS + crx1] * cfx) * (1 - cfy) +
          (noise[cry1 * NS + crx0] * (1 - cfx) + noise[cry1 * NS + crx1] * cfx) * cfy;
        const n = fine * 0.7 + coarse * 0.3;
        const mid = 1 - Math.abs(2 * L - 1);
        const amt = grain * (0.35 + 0.65 * mid);
        r += n * amt;
        g += n * amt;
        b += n * amt;
      }

      if (intensity < 1) {
        r = r0 + (r - r0) * intensity;
        g = g0 + (g - g0) * intensity;
        b = b0 + (b - b0) * intensity;
      }
      data[o] = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0;
      data[o + 1] = g <= 0 ? 0 : g >= 1 ? 255 : (g * 255 + 0.5) | 0;
      data[o + 2] = b <= 0 ? 0 : b >= 1 ? 255 : (b * 255 + 0.5) | 0;
    }
    if (input.signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
  }
  ctx.putImageData(img, 0, 0);
  return source;
}

export const gradePreset: Preset = {
  id: 'grade',
  name: 'Grade',
  tagline: 'Moody film colour: cool cast, navy shadows, teal mids, grain.',
  defaults: GRADE_DEFAULTS,
  controls: [
    { kind: 'slider', key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01 },
    { kind: 'section', label: 'Tone' },
    { kind: 'slider', key: 'levels', label: 'Auto contrast (haze cut)', min: 0, max: 1, step: 0.01 },
    { kind: 'slider', key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.01 },
    { kind: 'slider', key: 'contrast', label: 'Contrast', min: -0.5, max: 1, step: 0.01 },
    { kind: 'slider', key: 'fade', label: 'Fade (lift blacks)', min: 0, max: 0.5, step: 0.01 },
    { kind: 'slider', key: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.01 },
    { kind: 'slider', key: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.01 },
    { kind: 'section', label: 'Colour' },
    { kind: 'slider', key: 'temperature', label: 'Temperature (cool ↔ warm)', min: -1, max: 1, step: 0.01 },
    { kind: 'slider', key: 'tint', label: 'Tint (magenta ↔ green)', min: -1, max: 1, step: 0.01 },
    { kind: 'slider', key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01 },
    { kind: 'section', label: 'Split tone' },
    { kind: 'slider', key: 'shadowHue', label: 'Shadow hue', min: 0, max: 360, step: 1, unit: '°' },
    { kind: 'slider', key: 'shadowTint', label: 'Shadow tint', min: 0, max: 1, step: 0.01 },
    { kind: 'slider', key: 'midHue', label: 'Midtone hue', min: 0, max: 360, step: 1, unit: '°' },
    { kind: 'slider', key: 'midTint', label: 'Midtone tint', min: 0, max: 1, step: 0.01 },
    { kind: 'slider', key: 'highlightHue', label: 'Highlight hue', min: 0, max: 360, step: 1, unit: '°' },
    { kind: 'slider', key: 'highlightTint', label: 'Highlight tint', min: 0, max: 1, step: 0.01 },
    { kind: 'section', label: 'Texture' },
    { kind: 'slider', key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
    { kind: 'slider', key: 'grain', label: 'Grain', min: 0, max: 1, step: 0.01 },
    { kind: 'slider', key: 'grainSize', label: 'Grain size', min: 0.6, max: 4, step: 0.1 },
    { kind: 'button', key: 'reseed', label: 'New grain pattern', action: (p) => ({ seed: (Number(p.seed) * 7919 + 13) % 100000 }) },
  ],
  render: renderGrade,
};
