import { ctx2d, clamp, type AnyCanvas } from '../lib/canvas';
import { buildToneLut, autoLevels, tintVector } from './curves';
import { makeNoise, NOISE_SIZE } from './noise';
import { blurredSmall, sampleSmall, softenCanvas, glowPass, addBorder } from './blur';
import type { Params, RenderInput } from '../presets/types';

/**
 * The film engine. One parametric pipeline that every colour and black-and-white
 * look is expressed in, so a look is data, not code:
 *
 *   soft focus → clarity → auto levels → white balance → tone curve →
 *   (mono mixer | vibrance, saturation, per-band saturation) → split tone →
 *   vignette → grain → intensity mix → bloom / halation → border
 */

export const FILM_DEFAULTS: Params = {
  intensity: 1,
  // tone
  levels: 0.5,
  brightness: 0,
  contrast: 0.2,
  fade: 0,
  shadows: 0,
  highlights: 0,
  // colour
  mono: false,
  temperature: 0,
  tint: 0,
  saturation: 1,
  vibrance: 0,
  satRed: 1,
  satYellow: 1,
  satGreen: 1,
  satCyan: 1,
  satBlue: 1,
  satMagenta: 1,
  // black & white mixer (only when mono)
  mixRed: 0.3,
  mixGreen: 0.59,
  mixBlue: 0.11,
  // split tone
  shadowHue: 220,
  shadowTint: 0,
  midHue: 200,
  midTint: 0,
  highlightHue: 50,
  highlightTint: 0,
  // detail
  clarity: 0,
  softness: 0,
  bloom: 0,
  bloomThreshold: 0.65,
  bloomRadius: 1,
  halation: 0,
  // texture
  grain: 0,
  grainSize: 1.2,
  seed: 7,
  vignette: 0,
  // frame
  border: 0,
  borderColor: '#ffffff',
};

export async function renderFilm(input: RenderInput): Promise<AnyCanvas> {
  const { source, width, height, params } = input;
  const intensity = Number(params.intensity);
  if (intensity <= 0) return source;
  const unit = Math.max(width, height) / 1400;

  // soft focus / diffusion (blurred copy mixed over the image)
  const softness = Number(params.softness);
  if (softness > 0) softenCanvas(source, width, height, softness, 7 * unit);

  const ctx = ctx2d(source);
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;

  // local contrast needs a wide blur of the image
  const clarity = Number(params.clarity);
  const wide = clarity !== 0 ? blurredSmall(source as CanvasImageSource, width, height, 28 * unit) : null;

  const lut = buildToneLut({
    contrast: Number(params.contrast),
    fade: Number(params.fade),
    brightness: Number(params.brightness),
    shadows: Number(params.shadows),
    highlights: Number(params.highlights),
  });
  const levelsStrength = Number(params.levels);
  const lv = levelsStrength > 0 ? autoLevels(data, width, height) : { lo: 0, hi: 1 };
  const lvLo = lv.lo * levelsStrength;
  const lvScale = 1 / Math.max(0.05, 1 - lvLo - (1 - lv.hi) * levelsStrength);

  const temp = Number(params.temperature);
  const tint = Number(params.tint);
  const wbR = 1 + temp * 0.16 + tint * -0.05;
  const wbG = 1 + tint * 0.1;
  const wbB = 1 - temp * 0.16 + tint * -0.05;

  const mono = Boolean(params.mono);
  let mixR = Number(params.mixRed);
  let mixG = Number(params.mixGreen);
  let mixB = Number(params.mixBlue);
  const mixSum = mixR + mixG + mixB || 1;
  mixR /= mixSum;
  mixG /= mixSum;
  mixB /= mixSum;

  const sat = Number(params.saturation);
  const vib = Number(params.vibrance);
  const bands = [params.satRed, params.satYellow, params.satGreen, params.satCyan, params.satBlue, params.satMagenta].map(Number);
  const bandsActive = bands.some((b) => Math.abs(b - 1) > 0.001);

  const sVec = tintVector(Number(params.shadowHue));
  const mVec = tintVector(Number(params.midHue));
  const hVec = tintVector(Number(params.highlightHue));
  const sStr = Number(params.shadowTint) * 0.4;
  const mStr = Number(params.midTint) * 0.4;
  const hStr = Number(params.highlightTint) * 0.4;
  const tinting = sStr > 0 || mStr > 0 || hStr > 0;

  const vig = Number(params.vignette);
  const grain = Number(params.grain) * 0.22;
  const grainPx = Math.max(0.6, Number(params.grainSize) * Math.max(1, Math.max(width, height) / 1400));
  const coarsePx = grainPx * 3.1;
  const noise = grain > 0 ? makeNoise(Number(params.seed) || 1) : null;
  const NS = NOISE_SIZE;

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    const dy = (y - cy) / maxDist;
    const ny = y / grainPx;
    const ny0 = Math.floor(ny);
    const fy = ny - ny0;
    const ry0 = ((ny0 % NS) + NS) % NS;
    const ry1 = (ry0 + 1) % NS;
    const cy2 = y / coarsePx;
    const cy0 = Math.floor(cy2);
    const cfy = cy2 - cy0;
    const cry0 = (((cy0 + 97) % NS) + NS) % NS;
    const cry1 = (cry0 + 1) % NS;

    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let r0 = data[o] / 255;
      let g0 = data[o + 1] / 255;
      let b0 = data[o + 2] / 255;

      // local contrast (clarity): push away from the wide blur
      if (wide) {
        r0 = clamp(r0 + clarity * (r0 - sampleSmall(wide, x, y, 0) / 255), 0, 1);
        g0 = clamp(g0 + clarity * (g0 - sampleSmall(wide, x, y, 1) / 255), 0, 1);
        b0 = clamp(b0 + clarity * (b0 - sampleSmall(wide, x, y, 2) / 255), 0, 1);
      }

      // auto contrast then white balance
      let r = clamp((r0 - lvLo) * lvScale * wbR, 0, 1);
      let g = clamp((g0 - lvLo) * lvScale * wbG, 0, 1);
      let b = clamp((b0 - lvLo) * lvScale * wbB, 0, 1);

      // tone curve per channel (like a film LUT)
      r = lut[(r * 255) | 0];
      g = lut[(g * 255) | 0];
      b = lut[(b * 255) | 0];

      let L: number;
      if (mono) {
        L = mixR * r + mixG * g + mixB * b;
        r = g = b = L;
      } else {
        L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
        const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
        const d = mx - mn;
        const s = mx > 0 ? d / mx : 0;
        let k = sat * (1 + vib * (1 - s));
        if (bandsActive && d > 0.0001) {
          let hue: number;
          if (mx === r) hue = ((g - b) / d) % 6;
          else if (mx === g) hue = (b - r) / d + 2;
          else hue = (r - g) / d + 4;
          hue *= 60;
          if (hue < 0) hue += 360;
          const hi = hue / 60;
          const i0 = Math.floor(hi) % 6;
          const f = hi - Math.floor(hi);
          k *= bands[i0] * (1 - f) + bands[(i0 + 1) % 6] * f;
        }
        if (k !== 1) {
          r = L + (r - L) * k;
          g = L + (g - L) * k;
          b = L + (b - L) * k;
        }
      }

      // split tone by zone
      if (tinting) {
        const Lz = mono ? L : 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const ws = (1 - Lz) * (1 - Lz);
        const wh = Lz * Lz;
        const wm = 4 * Lz * (1 - Lz);
        const ks = sStr * ws;
        const km = mStr * wm;
        const kh = hStr * wh;
        r += ks * sVec[0] + km * mVec[0] + kh * hVec[0];
        g += ks * sVec[1] + km * mVec[1] + kh * hVec[1];
        b += ks * sVec[2] + km * mVec[2] + kh * hVec[2];
      }

      // vignette
      if (vig > 0) {
        const dx = (x - cx) / maxDist;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const t = clamp((dist - 0.45) / 0.75, 0, 1);
        const v = 1 - vig * t * t * (3 - 2 * t);
        r *= v;
        g *= v;
        b *= v;
      }

      // grain, strongest in the midtones (two octaves)
      if (noise) {
        const nx = x / grainPx;
        const nx0 = Math.floor(nx);
        const fx = nx - nx0;
        const rx0 = ((nx0 % NS) + NS) % NS;
        const rx1 = (rx0 + 1) % NS;
        const fine =
          (noise[ry0 * NS + rx0] * (1 - fx) + noise[ry0 * NS + rx1] * fx) * (1 - fy) +
          (noise[ry1 * NS + rx0] * (1 - fx) + noise[ry1 * NS + rx1] * fx) * fy;
        const cx2 = x / coarsePx;
        const cx0 = Math.floor(cx2);
        const cfx = cx2 - cx0;
        const crx0 = (((cx0 + 41) % NS) + NS) % NS;
        const crx1 = (crx0 + 1) % NS;
        const coarse =
          (noise[cry0 * NS + crx0] * (1 - cfx) + noise[cry0 * NS + crx1] * cfx) * (1 - cfy) +
          (noise[cry1 * NS + crx0] * (1 - cfx) + noise[cry1 * NS + crx1] * cfx) * cfy;
        const n = fine * 0.7 + coarse * 0.3;
        const Lg = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const mid = 1 - Math.abs(2 * Lg - 1);
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

  // glows: bloom lifts highlights softly, halation bleeds warm light around them
  const bloom = Number(params.bloom);
  if (bloom > 0) glowPass(source, width, height, { threshold: Number(params.bloomThreshold), radius: 18 * unit * Number(params.bloomRadius), strength: bloom, mode: 'screen' });
  const halation = Number(params.halation);
  if (halation > 0) glowPass(source, width, height, { threshold: 0.72, radius: 10 * unit, strength: halation, tint: [1, 0.32, 0.12], mode: 'lighter' });

  const border = Number(params.border);
  if (border > 0) return addBorder(source, width, height, border, String(params.borderColor));
  return source;
}
