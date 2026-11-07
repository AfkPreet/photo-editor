import { FILM_DEFAULTS, renderFilm } from '../engine/film';
import type { Preset, Params, Control, Category } from './types';

/**
 * Looks are data: a name, a credit, and a set of engine parameters. Each is an
 * interpretation of a published body of work, built from our own curves. The
 * photographer names are credits for the inspiration, nothing more.
 */
export interface Look {
  id: string;
  name: string;
  category: Category;
  inspiredBy: string;
  tagline: string;
  aspect?: number;
  params: Params;
}

const mono = (mixRed: number, mixGreen: number, mixBlue: number): Params => ({ mono: true, mixRed, mixGreen, mixBlue });

export const LOOKS: Look[] = [
  // ——— colour ———
  {
    id: 'moody-teal',
    name: 'Moody teal',
    category: 'colour',
    inspiredBy: 'the colour-grading study at skeletorwun.com',
    tagline: 'Cool cast, navy shadows, teal mids, cream highlights, fine grain.',
    params: { levels: 0.7, brightness: -0.18, contrast: 0.4, fade: 0.05, temperature: -0.15, tint: 0.03, shadowHue: 236, shadowTint: 0.22, midHue: 204, midTint: 0.18, highlightHue: 95, highlightTint: 0.16, saturation: 1.05, vignette: 0.25, grain: 0.18, grainSize: 1.2 },
  },
  {
    id: 'kodachrome',
    name: 'Kodachrome',
    category: 'colour',
    inspiredBy: 'Steve McCurry and Fred Herzog',
    tagline: 'Deep reds and blues, warm skin, crisp contrast, barely any grain.',
    aspect: 3 / 2,
    params: { levels: 0.6, contrast: 0.35, brightness: -0.03, temperature: 0.1, tint: 0, saturation: 1.18, vibrance: 0.15, satRed: 1.35, satYellow: 1.15, satGreen: 0.9, satCyan: 0.9, satBlue: 1.25, shadowHue: 225, shadowTint: 0.08, highlightHue: 45, highlightTint: 0.06, clarity: 0.15, grain: 0.1, grainSize: 1, vignette: 0.15 },
  },
  {
    id: 'dye-transfer',
    name: 'Dye transfer',
    category: 'colour',
    inspiredBy: 'William Eggleston',
    tagline: 'Lush everyday colour: dense reds, glowing pastels, gentle contrast.',
    aspect: 3 / 2,
    params: { levels: 0.4, contrast: 0.2, brightness: 0.02, fade: 0.03, temperature: 0.08, saturation: 1.3, vibrance: 0.2, satRed: 1.4, satYellow: 1.1, satGreen: 1.1, satBlue: 1.05, satMagenta: 1.2, highlightHue: 40, highlightTint: 0.05, clarity: 0.05, grain: 0.08, vignette: 0.08 },
  },
  {
    id: 'painterly',
    name: 'Painterly',
    category: 'colour',
    inspiredBy: 'Saul Leiter',
    tagline: 'Muted, warm, softened; reds stay, everything else goes quiet.',
    params: { levels: 0.3, contrast: -0.05, brightness: 0.02, fade: 0.12, temperature: 0.18, tint: 0.05, saturation: 0.75, vibrance: 0.1, satRed: 1.4, satYellow: 1.1, satGreen: 0.7, satCyan: 0.7, satBlue: 0.8, shadowHue: 30, shadowTint: 0.14, highlightHue: 20, highlightTint: 0.12, softness: 0.25, bloom: 0.22, bloomThreshold: 0.55, bloomRadius: 1.6, grain: 0.22, grainSize: 1.6, vignette: 0.3 },
  },
  {
    id: 'layered-light',
    name: 'Layered light',
    category: 'colour',
    inspiredBy: 'Alex Webb',
    tagline: 'Crushed shadows against saturated light; colour as structure.',
    params: { levels: 0.8, contrast: 0.55, brightness: -0.12, shadows: -0.35, highlights: 0.1, temperature: 0.1, saturation: 1.25, vibrance: 0.2, satRed: 1.3, satYellow: 1.3, satBlue: 1.2, shadowHue: 230, shadowTint: 0.2, highlightHue: 40, highlightTint: 0.14, clarity: 0.3, grain: 0.1, vignette: 0.2 },
  },
  {
    id: 'cape-light',
    name: 'Cape light',
    category: 'colour',
    inspiredBy: 'Joel Meyerowitz',
    tagline: 'Large-format calm: open shadows, pastel sky, no grain, 4:5.',
    aspect: 4 / 5,
    params: { levels: 0.3, contrast: 0.05, brightness: 0.06, fade: 0.06, shadows: 0.15, temperature: -0.04, tint: -0.02, saturation: 1.05, vibrance: 0.15, satYellow: 1.1, satCyan: 1.1, satBlue: 1.1, shadowHue: 215, shadowTint: 0.08, highlightHue: 50, highlightTint: 0.08, clarity: 0.1, vignette: 0.05 },
  },
  {
    id: 'slide-film',
    name: 'Slide film',
    category: 'colour',
    inspiredBy: 'Galen Rowell and Frans Lanting',
    tagline: 'Velvia-style landscape punch: saturated greens and blues, crisp detail.',
    aspect: 3 / 2,
    params: { levels: 0.7, contrast: 0.4, shadows: -0.1, saturation: 1.35, vibrance: 0.3, satRed: 1.2, satGreen: 1.3, satBlue: 1.3, clarity: 0.2, grain: 0.05, vignette: 0.1 },
  },
  {
    id: 'snapshot-flash',
    name: 'Snapshot flash',
    category: 'colour',
    inspiredBy: 'Nan Goldin and Martin Parr',
    tagline: 'Direct flash: saturated, warm, falling off into a vignette, grainy.',
    params: { levels: 0.5, contrast: 0.3, brightness: 0.05, highlights: -0.1, temperature: 0.15, tint: -0.03, saturation: 1.35, vibrance: 0.1, satRed: 1.3, satYellow: 1.2, shadowHue: 260, shadowTint: 0.1, vignette: 0.45, grain: 0.25, grainSize: 1.3, halation: 0.12 },
  },
  {
    id: 'twilight-cinema',
    name: 'Twilight cinema',
    category: 'colour',
    inspiredBy: 'Gregory Crewdson and Todd Hido',
    tagline: 'Blue hour: teal shadows, sodium-lamp highlights, soft glow, 2.39:1.',
    aspect: 2.39,
    params: { levels: 0.5, contrast: 0.3, brightness: -0.1, fade: 0.06, temperature: -0.25, tint: 0.04, saturation: 0.9, vibrance: 0.1, satYellow: 1.2, satGreen: 0.8, satCyan: 1.1, satBlue: 1.2, shadowHue: 215, shadowTint: 0.3, midHue: 205, midTint: 0.1, highlightHue: 38, highlightTint: 0.3, bloom: 0.25, bloomThreshold: 0.6, bloomRadius: 1.5, halation: 0.08, grain: 0.12, vignette: 0.25 },
  },
  {
    id: 'pastel-light',
    name: 'Pastel light',
    category: 'colour',
    inspiredBy: 'Rinko Kawauchi',
    tagline: 'Overexposed and tender: lifted blacks, pale colour, glowing light, square.',
    aspect: 1,
    params: { levels: 0.2, contrast: -0.15, brightness: 0.22, fade: 0.1, highlights: 0.2, temperature: -0.06, tint: 0.02, saturation: 0.85, vibrance: 0.15, satCyan: 1.1, satBlue: 1.05, shadowHue: 200, shadowTint: 0.1, highlightHue: 60, highlightTint: 0.1, bloom: 0.35, bloomThreshold: 0.45, bloomRadius: 2, softness: 0.15, grain: 0.1 },
  },
  {
    id: 'tungsten-night',
    name: 'Tungsten night',
    category: 'colour',
    inspiredBy: 'CineStill 800T street photography',
    tagline: 'Neon and sodium: teal shadows, warm lights with a red halation bleed.',
    params: { levels: 0.6, contrast: 0.35, brightness: -0.1, temperature: -0.3, tint: 0.05, saturation: 1.1, satRed: 1.2, satCyan: 1.2, satBlue: 1.15, shadowHue: 195, shadowTint: 0.3, highlightHue: 25, highlightTint: 0.15, halation: 0.45, bloom: 0.1, bloomThreshold: 0.7, grain: 0.3, grainSize: 1.4, vignette: 0.2 },
  },
  // ——— mono ———
  {
    id: 'zone-system',
    name: 'Zone system',
    category: 'mono',
    inspiredBy: 'Ansel Adams',
    tagline: 'Red-filter skies, the full scale from solid black to clean white, razor detail.',
    aspect: 4 / 5,
    params: { ...mono(0.65, 0.25, 0.1), levels: 0.9, contrast: 0.45, shadows: -0.1, highlights: 0.05, clarity: 0.3, grain: 0.04, vignette: 0.08 },
  },
  {
    id: 'decisive-moment',
    name: 'Decisive moment',
    category: 'mono',
    inspiredBy: 'Henri Cartier-Bresson',
    tagline: 'Classic 35mm reportage: honest tones, soft grain, the full frame with its black border.',
    aspect: 3 / 2,
    params: { ...mono(0.3, 0.59, 0.11), levels: 0.6, contrast: 0.28, fade: 0.04, clarity: 0.1, shadowHue: 220, shadowTint: 0.03, highlightHue: 45, highlightTint: 0.05, grain: 0.22, grainSize: 1.1, vignette: 0.12, border: 0.02, borderColor: '#000000' },
  },
  {
    id: 'genesis',
    name: 'Genesis',
    category: 'mono',
    inspiredBy: 'Sebastião Salgado',
    tagline: 'Epic monochrome: deep blacks, glowing highlights, heavy grain, burned edges.',
    aspect: 3 / 2,
    params: { ...mono(0.55, 0.3, 0.15), levels: 0.9, contrast: 0.6, brightness: -0.08, shadows: -0.2, highlights: 0.15, clarity: 0.5, bloom: 0.15, bloomThreshold: 0.8, bloomRadius: 1.2, highlightHue: 50, highlightTint: 0.04, grain: 0.35, grainSize: 1.4, vignette: 0.4 },
  },
  {
    id: 'are-bure-boke',
    name: 'Are bure boke',
    category: 'mono',
    inspiredBy: 'Daido Moriyama',
    tagline: 'Grainy, blurry, out of focus: blown whites, crushed blacks, coarse grain.',
    aspect: 3 / 2,
    params: { ...mono(0.3, 0.59, 0.11), levels: 1, contrast: 0.8, brightness: -0.05, shadows: -0.4, highlights: 0.3, softness: 0.25, clarity: -0.1, grain: 0.7, grainSize: 2.2, vignette: 0.35 },
  },
  {
    id: 'rolleiflex-square',
    name: 'Rolleiflex square',
    category: 'mono',
    inspiredBy: 'Vivian Maier',
    tagline: 'Square medium format: gentle contrast, fine grain, a quiet vignette.',
    aspect: 1,
    params: { ...mono(0.35, 0.5, 0.15), levels: 0.75, contrast: 0.3, fade: 0.06, clarity: 0.08, highlightHue: 45, highlightTint: 0.04, grain: 0.15, grainSize: 1, vignette: 0.2 },
  },
  {
    id: 'geometry-of-light',
    name: 'Geometry of light',
    category: 'mono',
    inspiredBy: 'Fan Ho',
    tagline: 'Shafts of light and deep shadow: hard contrast, crushed darks, warm paper.',
    aspect: 1,
    params: { ...mono(0.5, 0.4, 0.1), levels: 0.9, contrast: 0.6, brightness: -0.1, shadows: -0.45, highlights: 0.2, clarity: 0.3, shadowHue: 220, shadowTint: 0.04, highlightHue: 40, highlightTint: 0.06, grain: 0.15, vignette: 0.3 },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    category: 'mono',
    inspiredBy: 'Irving Penn’s platinum prints',
    tagline: 'Long tonal scale, warm brown blacks, matte paper feel, a wide white border.',
    aspect: 4 / 5,
    params: { ...mono(0.3, 0.59, 0.11), levels: 0.7, contrast: 0.25, fade: 0.08, highlights: -0.05, shadowHue: 30, shadowTint: 0.12, midHue: 35, midTint: 0.08, highlightHue: 40, highlightTint: 0.1, clarity: 0.15, grain: 0.05, vignette: 0.05, border: 0.04, borderColor: '#f4efe6' },
  },
];

export const FILM_CONTROLS: Control[] = [
  { kind: 'slider', key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01 },
  { kind: 'section', label: 'Tone' },
  { kind: 'slider', key: 'levels', label: 'Auto contrast (haze cut)', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.01 },
  { kind: 'slider', key: 'contrast', label: 'Contrast', min: -0.5, max: 1, step: 0.01 },
  { kind: 'slider', key: 'fade', label: 'Fade (lift blacks)', min: 0, max: 0.5, step: 0.01 },
  { kind: 'slider', key: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.01 },
  { kind: 'slider', key: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.01 },
  { kind: 'section', label: 'Colour', collapsed: true },
  { kind: 'toggle', key: 'mono', label: 'Black & white' },
  { kind: 'slider', key: 'temperature', label: 'Temperature (cool ↔ warm)', min: -1, max: 1, step: 0.01 },
  { kind: 'slider', key: 'tint', label: 'Tint (magenta ↔ green)', min: -1, max: 1, step: 0.01 },
  { kind: 'slider', key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01 },
  { kind: 'slider', key: 'vibrance', label: 'Vibrance', min: -1, max: 1, step: 0.01 },
  { kind: 'slider', key: 'satRed', label: 'Reds', min: 0, max: 2, step: 0.01 },
  { kind: 'slider', key: 'satYellow', label: 'Yellows', min: 0, max: 2, step: 0.01 },
  { kind: 'slider', key: 'satGreen', label: 'Greens', min: 0, max: 2, step: 0.01 },
  { kind: 'slider', key: 'satCyan', label: 'Cyans', min: 0, max: 2, step: 0.01 },
  { kind: 'slider', key: 'satBlue', label: 'Blues', min: 0, max: 2, step: 0.01 },
  { kind: 'slider', key: 'satMagenta', label: 'Magentas', min: 0, max: 2, step: 0.01 },
  { kind: 'section', label: 'Black & white mix', collapsed: true },
  { kind: 'slider', key: 'mixRed', label: 'Red channel', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'mixGreen', label: 'Green channel', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'mixBlue', label: 'Blue channel', min: 0, max: 1, step: 0.01 },
  { kind: 'section', label: 'Split tone', collapsed: true },
  { kind: 'slider', key: 'shadowHue', label: 'Shadow hue', min: 0, max: 360, step: 1, unit: '°' },
  { kind: 'slider', key: 'shadowTint', label: 'Shadow tint', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'midHue', label: 'Midtone hue', min: 0, max: 360, step: 1, unit: '°' },
  { kind: 'slider', key: 'midTint', label: 'Midtone tint', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'highlightHue', label: 'Highlight hue', min: 0, max: 360, step: 1, unit: '°' },
  { kind: 'slider', key: 'highlightTint', label: 'Highlight tint', min: 0, max: 1, step: 0.01 },
  { kind: 'section', label: 'Detail & glow', collapsed: true },
  { kind: 'slider', key: 'clarity', label: 'Clarity (local contrast)', min: -0.5, max: 1, step: 0.01 },
  { kind: 'slider', key: 'softness', label: 'Soft focus', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'bloom', label: 'Bloom', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'bloomThreshold', label: 'Bloom starts at', min: 0, max: 0.95, step: 0.01 },
  { kind: 'slider', key: 'bloomRadius', label: 'Bloom radius', min: 0.3, max: 3, step: 0.1 },
  { kind: 'slider', key: 'halation', label: 'Halation (red bleed)', min: 0, max: 1, step: 0.01 },
  { kind: 'section', label: 'Texture', collapsed: true },
  { kind: 'slider', key: 'grain', label: 'Grain', min: 0, max: 1, step: 0.01 },
  { kind: 'slider', key: 'grainSize', label: 'Grain size', min: 0.6, max: 4, step: 0.1 },
  { kind: 'button', key: 'reseed', label: 'New grain pattern', action: (p) => ({ seed: (Number(p.seed) * 7919 + 13) % 100000 }) },
  { kind: 'slider', key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
  { kind: 'section', label: 'Frame', collapsed: true },
  { kind: 'slider', key: 'border', label: 'Border', min: 0, max: 0.15, step: 0.005 },
  { kind: 'color', key: 'borderColor', label: 'Border colour' },
];

export function lookParams(look: Look): Params {
  return { ...FILM_DEFAULTS, ...look.params };
}

export function makeLookPreset(look: Look): Preset {
  return {
    id: look.id,
    name: look.name,
    tagline: look.tagline,
    category: look.category,
    inspiredBy: look.inspiredBy,
    preferredAspect: look.aspect,
    defaults: lookParams(look),
    controls: FILM_CONTROLS,
    render: renderFilm,
  };
}

export const LOOK_PRESETS: Preset[] = LOOKS.map(makeLookPreset);

export function getLook(id: string): Look | undefined {
  return LOOKS.find((l) => l.id === id);
}
