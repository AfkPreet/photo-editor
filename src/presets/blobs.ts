import { makeCanvas, ctx2d, type AnyCanvas } from '../lib/canvas';
import type { Preset, Params, RenderInput } from './types';

/**
 * Blob overlay. Colour or brightness regions become connected components; each
 * one gets a box, a centre dot, a size label, links to its nearest neighbours and,
 * for the big ones, a circle. Machine-vision debug output as a graphic language.
 */

export const BLOBS_DEFAULTS: Params = {
  mode: 'bright',
  threshold: 0.72,
  hue: 200,
  hueRange: 30,
  minSat: 0.25,
  minArea: 0.00004,
  maxArea: 0.08,
  maxBlobs: 80,
  links: true,
  linkDistance: 0.14,
  labels: true,
  circles: true,
  circleSize: 0.02,
  background: 'photo',
  palette: 'cyan',
  lineWidth: 1,
};

interface Blob {
  x: number;
  y: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  r: number;
}

const PALETTES: Record<string, { box: string; dot: string; link: string; text: string; circle: string }> = {
  cyan: { box: '#3af2ff', dot: '#ff2b2b', link: '#2f5bff', text: '#3af2ff', circle: '#ff2b2b' },
  white: { box: '#ffffff', dot: '#ffffff', link: 'rgba(255,255,255,0.6)', text: '#ffffff', circle: '#ffffff' },
  green: { box: '#5dff7a', dot: '#ff3b3b', link: '#1fb84c', text: '#5dff7a', circle: '#ffd23b' },
  mono: { box: '#111111', dot: '#111111', link: 'rgba(0,0,0,0.5)', text: '#111111', circle: '#111111' },
};

function buildMask(data: Uint8ClampedArray, w: number, h: number, p: Params): Uint8Array {
  const mask = new Uint8Array(w * h);
  const mode = String(p.mode);
  const t = Number(p.threshold);
  const hue = Number(p.hue);
  const range = Number(p.hueRange);
  const minSat = Number(p.minSat);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max;
    if (mode === 'bright') {
      mask[i] = v >= t ? 1 : 0;
    } else if (mode === 'dark') {
      mask[i] = v <= 1 - t ? 1 : 0;
    } else {
      const d = max - min;
      const s = max === 0 ? 0 : d / max;
      if (s < minSat || v < 0.12) continue;
      let hh = 0;
      if (d > 0) {
        if (max === r) hh = ((g - b) / d) % 6;
        else if (max === g) hh = (b - r) / d + 2;
        else hh = (r - g) / d + 4;
        hh *= 60;
        if (hh < 0) hh += 360;
      }
      let diff = Math.abs(hh - hue);
      if (diff > 180) diff = 360 - diff;
      mask[i] = diff <= range ? 1 : 0;
    }
  }
  return mask;
}

/** Two-pass connected components (4-connectivity) with union-find. */
function components(mask: Uint8Array, w: number, h: number): Blob[] {
  const labels = new Int32Array(w * h);
  const parent: number[] = [0];
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const left = x > 0 ? labels[i - 1] : 0;
      const up = y > 0 ? labels[i - w] : 0;
      if (!left && !up) {
        labels[i] = next;
        parent.push(next);
        next++;
      } else if (left && up) {
        labels[i] = Math.min(left, up);
        if (left !== up) union(left, up);
      } else {
        labels[i] = left || up;
      }
    }
  }
  const stats = new Map<number, Blob>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = labels[y * w + x];
      if (!l) continue;
      const root = find(l);
      let s = stats.get(root);
      if (!s) {
        s = { x: 0, y: 0, area: 0, minX: x, minY: y, maxX: x, maxY: y, r: 0 };
        stats.set(root, s);
      }
      s.x += x;
      s.y += y;
      s.area++;
      if (x < s.minX) s.minX = x;
      if (x > s.maxX) s.maxX = x;
      if (y < s.minY) s.minY = y;
      if (y > s.maxY) s.maxY = y;
    }
  }
  const out: Blob[] = [];
  for (const s of stats.values()) {
    s.x /= s.area;
    s.y /= s.area;
    s.r = Math.sqrt(s.area / Math.PI);
    out.push(s);
  }
  return out;
}

export function findBlobs(source: AnyCanvas, width: number, height: number, p: Params): { blobs: Blob[]; scale: number } {
  const analysisMax = 720;
  const k = Math.min(1, analysisMax / Math.max(width, height));
  const aw = Math.max(1, Math.round(width * k));
  const ah = Math.max(1, Math.round(height * k));
  const c = makeCanvas(aw, ah);
  const cx = ctx2d(c);
  cx.drawImage(source as CanvasImageSource, 0, 0, aw, ah);
  const data = cx.getImageData(0, 0, aw, ah).data;
  const mask = buildMask(data, aw, ah, p);
  const minArea = Number(p.minArea) * aw * ah;
  const maxArea = Number(p.maxArea) * aw * ah;
  let blobs = components(mask, aw, ah).filter((b) => b.area >= Math.max(1, minArea) && b.area <= maxArea);
  blobs.sort((a, b) => b.area - a.area);
  blobs = blobs.slice(0, Math.round(Number(p.maxBlobs)));
  return { blobs, scale: 1 / k };
}

export async function renderBlobs(input: RenderInput): Promise<AnyCanvas> {
  const { source, width, height, params } = input;
  const { blobs, scale } = findBlobs(source, width, height, params);
  const pal = PALETTES[String(params.palette)] ?? PALETTES.cyan;
  const out = makeCanvas(width, height);
  const ctx = ctx2d(out);
  const bg = String(params.background);
  if (bg === 'black' || bg === 'white') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.drawImage(source as CanvasImageSource, 0, 0);
    if (bg === 'dim') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, width, height);
    }
  }
  const unit = Math.max(width, height) / 1400; // keeps stroke/text weight consistent across resolutions
  const lw = Number(params.lineWidth) * unit;
  const pts = blobs.map((b) => ({ x: b.x * scale, y: b.y * scale, r: b.r * scale, b }));

  // links to nearest neighbours
  if (params.links && pts.length > 1) {
    const maxD = Number(params.linkDistance) * width;
    ctx.strokeStyle = pal.link;
    ctx.lineWidth = Math.max(0.6, lw * 0.8);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const near: { d: number; j: number }[] = [];
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue;
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= maxD) near.push({ d, j });
      }
      near.sort((a, b) => a.d - b.d);
      for (const n of near.slice(0, 2)) {
        if (n.j < i) continue; // draw each pair once
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[n.j].x, pts[n.j].y);
      }
    }
    ctx.stroke();
  }

  // boxes
  ctx.strokeStyle = pal.box;
  ctx.lineWidth = Math.max(0.7, lw);
  for (const p of pts) {
    const x0 = p.b.minX * scale;
    const y0 = p.b.minY * scale;
    const w0 = (p.b.maxX - p.b.minX + 1) * scale;
    const h0 = (p.b.maxY - p.b.minY + 1) * scale;
    ctx.strokeRect(x0, y0, w0, h0);
  }

  // circles around the big ones
  if (params.circles) {
    const big = Number(params.circleSize) * width;
    ctx.strokeStyle = pal.circle;
    ctx.lineWidth = Math.max(1, lw * 1.6);
    for (const p of pts) {
      if (p.r < big) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.6 + 6 * unit, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // centre dots and labels
  ctx.fillStyle = pal.dot;
  const dot = Math.max(1.2, 2.2 * unit);
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, dot, 0, Math.PI * 2);
    ctx.fill();
  }
  if (params.labels) {
    ctx.fillStyle = pal.text;
    ctx.font = `${Math.max(8, 9.5 * unit)}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'middle';
    for (const p of pts) {
      ctx.save();
      ctx.translate(p.x + dot + 3 * unit, p.y - dot - 2 * unit);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`r:${Math.max(1, Math.round(p.r))}px`, 0, 0);
      ctx.restore();
    }
  }
  return out;
}

export const blobsPreset: Preset = {
  id: 'blobs',
  name: 'Blobs',
  tagline: 'Bright or coloured regions become boxes, dots, links and labels, like a vision debug view.',
  defaults: BLOBS_DEFAULTS,
  controls: [
    { kind: 'select', key: 'mode', label: 'Find regions by', options: [
      { value: 'bright', label: 'Brightness (highlights)' },
      { value: 'dark', label: 'Darkness (shadows)' },
      { value: 'colour', label: 'Colour window' },
    ] },
    { kind: 'slider', key: 'threshold', label: 'Threshold', min: 0.2, max: 0.98, step: 0.01 },
    { kind: 'slider', key: 'hue', label: 'Hue (colour mode)', min: 0, max: 360, step: 1, unit: '°' },
    { kind: 'slider', key: 'hueRange', label: 'Hue range', min: 5, max: 90, step: 1, unit: '°' },
    { kind: 'slider', key: 'minSat', label: 'Min saturation (colour mode)', min: 0, max: 1, step: 0.01 },
    { kind: 'section', label: 'Blobs' },
    { kind: 'slider', key: 'minArea', label: 'Smallest blob', min: 0.00001, max: 0.005, step: 0.00001 },
    { kind: 'slider', key: 'maxArea', label: 'Largest blob', min: 0.001, max: 0.5, step: 0.001 },
    { kind: 'slider', key: 'maxBlobs', label: 'Max blobs', min: 1, max: 400, step: 1 },
    { kind: 'section', label: 'Drawing' },
    { kind: 'select', key: 'background', label: 'Background', options: [
      { value: 'photo', label: 'Photo' },
      { value: 'dim', label: 'Photo, dimmed' },
      { value: 'black', label: 'Black' },
      { value: 'white', label: 'White' },
    ] },
    { kind: 'select', key: 'palette', label: 'Palette', options: [
      { value: 'cyan', label: 'Cyan / red / blue' },
      { value: 'white', label: 'White' },
      { value: 'green', label: 'Green / amber' },
      { value: 'mono', label: 'Black ink' },
    ] },
    { kind: 'slider', key: 'lineWidth', label: 'Line weight', min: 0.5, max: 4, step: 0.1 },
    { kind: 'toggle', key: 'links', label: 'Link neighbours' },
    { kind: 'slider', key: 'linkDistance', label: 'Link distance', min: 0.02, max: 0.5, step: 0.01 },
    { kind: 'toggle', key: 'labels', label: 'Size labels' },
    { kind: 'toggle', key: 'circles', label: 'Circle the big ones' },
    { kind: 'slider', key: 'circleSize', label: 'Big means radius over', min: 0.005, max: 0.1, step: 0.001 },
  ],
  render: renderBlobs,
};
