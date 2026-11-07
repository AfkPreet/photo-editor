import { makeCanvas, ctx2d, type AnyCanvas } from '../lib/canvas';
import { mulberry32, gaussian } from '../lib/random';
import { shapePath, parseSvgShape, SHAPE_OPTIONS, type ShapeId } from './shapes';
import { renderFilm } from '../engine/film';
import { LOOKS, getLook, lookParams } from './looks';
import type { Preset, Params, RenderInput } from './types';

/**
 * Shape cut-out diptych. A cluster of shapes is scattered over the photo. The
 * left panel keeps the photo only inside the shapes on a flat background; the
 * right panel keeps the photo and fills the shapes with a flat colour. Negative
 * space on one side, positive on the other.
 */

export const CUTOUT_DEFAULTS: Params = {
  shape: 'star',
  layout: 'diptych',
  count: 120,
  sizeMin: 0.022,
  sizeMax: 0.06,
  spread: 0.16,
  scatter: 0.15,
  centerX: 0.5,
  centerY: 0.45,
  rotation: 30,
  background: '#ffffff',
  maskColor: '#ffffff',
  gap: 0,
  baseLook: 'none',
  seed: 11,
  customSvg: '',
};

interface Placed {
  x: number;
  y: number;
  r: number;
  a: number;
}

function layoutShapes(p: Params, w: number, h: number): Placed[] {
  const rand = mulberry32(Number(p.seed) || 1);
  const count = Math.round(Number(p.count));
  const sizeMin = Number(p.sizeMin) * w;
  const sizeMax = Math.max(Number(p.sizeMin), Number(p.sizeMax)) * w;
  const spread = Number(p.spread) * w;
  const scatter = Number(p.scatter);
  const cx = Number(p.centerX) * w;
  const cy = Number(p.centerY) * h;
  const rotJitter = (Number(p.rotation) * Math.PI) / 180;
  const out: Placed[] = [];
  for (let i = 0; i < count; i++) {
    const outlier = rand() < scatter;
    const sigma = outlier ? spread * 2.6 : spread;
    const x = cx + gaussian(rand) * sigma;
    const y = cy + gaussian(rand) * sigma * 0.9;
    const t = Math.pow(rand(), 0.8);
    const r = (sizeMin + (sizeMax - sizeMin) * t) * (outlier ? 0.75 : 1);
    const a = (rand() * 2 - 1) * rotJitter;
    if (x < -r || y < -r || x > w + r || y > h + r) continue;
    out.push({ x, y, r, a });
  }
  // bigger shapes first so small ones read on top in the mask panel
  out.sort((m, n) => n.r - m.r);
  return out;
}

function buildPath(base: Path2D, placed: Placed[]): Path2D {
  const all = new Path2D();
  for (const s of placed) {
    const m = new DOMMatrix().translate(s.x, s.y).rotate((s.a * 180) / Math.PI).scale(s.r);
    all.addPath(base, m);
  }
  return all;
}

export async function renderCutout(input: RenderInput): Promise<AnyCanvas> {
  const { params } = input;
  let { source, width, height } = input;

  // Keep the diptych inside Safari's canvas limits on export.
  const layout = String(params.layout);
  const panels = layout === 'diptych' ? 2 : 1;
  const maxPixels = 16_000_000;
  if (width * height * panels > maxPixels) {
    const k = Math.sqrt(maxPixels / (width * height * panels));
    const w2 = Math.floor(width * k);
    const h2 = Math.floor(height * k);
    const c = makeCanvas(w2, h2);
    const cx = ctx2d(c);
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(source as CanvasImageSource, 0, 0, w2, h2);
    source = c;
    width = w2;
    height = h2;
  }

  const look = getLook(String(params.baseLook));
  if (look) {
    const bp = lookParams(look);
    await renderFilm({ ...input, source, width, height, params: { ...bp, grain: Math.min(Number(bp.grain), 0.12), border: 0 } });
  }

  const placed = layoutShapes(params, width, height);
  const base = shapePath(String(params.shape) as ShapeId, String(params.customSvg || ''));
  const path = buildPath(base, placed);
  const gap = Math.round(Number(params.gap) * width);
  const bg = String(params.background);
  const maskColor = String(params.maskColor);

  const outW = panels === 2 ? width * 2 + gap : width;
  const out = makeCanvas(outW, height);
  const ctx = ctx2d(out);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outW, height);

  const drawCutout = (ox: number) => {
    ctx.save();
    ctx.translate(ox, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.clip(path, 'nonzero');
    ctx.drawImage(source as CanvasImageSource, 0, 0);
    ctx.restore();
  };
  const drawMask = (ox: number) => {
    ctx.save();
    ctx.translate(ox, 0);
    ctx.drawImage(source as CanvasImageSource, 0, 0);
    ctx.fillStyle = maskColor;
    ctx.fill(path, 'nonzero');
    ctx.restore();
  };

  if (layout === 'diptych') {
    drawCutout(0);
    drawMask(width + gap);
  } else if (layout === 'cutout') {
    drawCutout(0);
  } else {
    drawMask(0);
  }
  return out;
}

export const cutoutPreset: Preset = {
  id: 'cutout',
  name: 'Cut-out',
  category: 'graphic',
  inspiredBy: 'the Overlaid study at skeletorwun.com',
  tagline: 'A cluster of shapes: photo inside them on one side, masked out on the other.',
  defaults: CUTOUT_DEFAULTS,
  preferredAspect: 4 / 5,
  controls: [
    { kind: 'select', key: 'shape', label: 'Shape', options: SHAPE_OPTIONS },
    { kind: 'file', key: 'customSvg', label: 'Load custom SVG shape…', accept: '.svg,image/svg+xml', parse: (text) => {
      const parsed = parseSvgShape(text);
      return parsed ? { customSvg: parsed, shape: 'custom' } : null;
    } },
    { kind: 'select', key: 'layout', label: 'Layout', options: [
      { value: 'diptych', label: 'Diptych (both panels)' },
      { value: 'cutout', label: 'Cut-out only' },
      { value: 'mask', label: 'Masked photo only' },
    ] },
    { kind: 'section', label: 'Cluster' },
    { kind: 'slider', key: 'count', label: 'Count', min: 3, max: 400, step: 1 },
    { kind: 'slider', key: 'sizeMin', label: 'Smallest size', min: 0.005, max: 0.2, step: 0.001 },
    { kind: 'slider', key: 'sizeMax', label: 'Largest size', min: 0.01, max: 0.35, step: 0.001 },
    { kind: 'slider', key: 'spread', label: 'Spread', min: 0.03, max: 0.6, step: 0.005 },
    { kind: 'slider', key: 'scatter', label: 'Outliers', min: 0, max: 1, step: 0.01 },
    { kind: 'slider', key: 'rotation', label: 'Rotation jitter', min: 0, max: 180, step: 1, unit: '°' },
    { kind: 'slider', key: 'centerX', label: 'Centre X', min: 0, max: 1, step: 0.01 },
    { kind: 'slider', key: 'centerY', label: 'Centre Y', min: 0, max: 1, step: 0.01 },
    { kind: 'button', key: 'shuffle', label: 'Shuffle layout', action: (p) => ({ seed: (Number(p.seed) * 48271 + 7) % 2147483647 }) },
    { kind: 'section', label: 'Colour' },
    { kind: 'color', key: 'background', label: 'Cut-out background' },
    { kind: 'color', key: 'maskColor', label: 'Mask colour' },
    { kind: 'slider', key: 'gap', label: 'Gap between panels', min: 0, max: 0.1, step: 0.005 },
    { kind: 'select', key: 'baseLook', label: 'Apply a look first', options: [{ value: 'none', label: 'None (original colour)' }, ...LOOKS.map((l) => ({ value: l.id, label: l.name }))] },
  ],
  render: renderCutout,
};
