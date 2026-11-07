import { makeCanvas, ctx2d, type AnyCanvas } from '../lib/canvas';
import type { Preset, Params, RenderInput } from './types';
import type { ObjectDetection, DetectedObject } from '@tensorflow-models/coco-ssd';

/**
 * Detection cut-out. An in-browser COCO-SSD model finds objects; only the
 * detected rectangles survive, pasted on a flat background with labelled boxes.
 * The model (≈6 MB) is fetched once and cached by the browser.
 */

export const DETECT_DEFAULTS: Params = {
  minScore: 0.4,
  maxDetections: 25,
  classes: 'all',
  padding: 0.01,
  labels: true,
  background: 'black',
  lineWidth: 1.2,
  keepPhoto: true,
};

const LOCAL_MODEL_URL = `${import.meta.env.BASE_URL}models/ssdlite_mobilenet_v2/model.json`;

let modelPromise: Promise<ObjectDetection> | null = null;

async function loadModel(report: (msg: string) => void): Promise<ObjectDetection> {
  if (!modelPromise) {
    modelPromise = (async () => {
      report('Loading the detector (about 6 MB, once)…');
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const coco = await import('@tensorflow-models/coco-ssd');
      try {
        return await coco.load({ base: 'lite_mobilenet_v2', modelUrl: LOCAL_MODEL_URL });
      } catch (e) {
        console.warn('Self-hosted detector failed, falling back to the TensorFlow CDN:', e);
        report('Loading the detector from the TensorFlow CDN…');
        return await coco.load({ base: 'lite_mobilenet_v2' });
      }
    })().catch((e) => {
      modelPromise = null;
      throw new Error('The detector could not be loaded. Check your connection and try again. (' + (e as Error).message + ')');
    });
  }
  return modelPromise;
}

const GROUPS: Record<string, string[] | null> = {
  all: null,
  people: ['person'],
  animals: ['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'],
  vehicles: ['bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat'],
};

function classColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  if (name === 'person') h = 8;
  return `hsl(${h} 95% 58%)`;
}

interface Cached {
  key: string;
  detections: DetectedObject[];
  scale: number;
}
let cache: Cached | null = null;

function fingerprint(data: Uint8ClampedArray, w: number, h: number): string {
  let out = `${w}x${h}`;
  const n = 48;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(((i * 7919) % 1000) / 1000 * w);
    const y = Math.floor(((i * 104729) % 1000) / 1000 * h);
    const o = (y * w + x) * 4;
    out += ',' + data[o] + data[o + 1] + data[o + 2];
  }
  return out;
}

async function detect(source: AnyCanvas, width: number, height: number, report: (m: string) => void): Promise<Cached> {
  const analysisMax = 640;
  const k = Math.min(1, analysisMax / Math.max(width, height));
  const aw = Math.max(1, Math.round(width * k));
  const ah = Math.max(1, Math.round(height * k));
  const c = makeCanvas(aw, ah);
  const cx = ctx2d(c);
  cx.drawImage(source as CanvasImageSource, 0, 0, aw, ah);
  const img = cx.getImageData(0, 0, aw, ah);
  const key = fingerprint(img.data, aw, ah);
  if (cache && cache.key === key) return { ...cache, scale: 1 / k };
  const model = await loadModel(report);
  report('Detecting…');
  const detections = await model.detect(img, 60, 0.1);
  cache = { key, detections, scale: 1 / k };
  return cache;
}

let lastReport: (m: string) => void = () => {};

export async function renderDetect(input: RenderInput): Promise<AnyCanvas> {
  const { source, width, height, params } = input;
  const { detections, scale } = await detect(source, width, height, lastReport);
  const minScore = Number(params.minScore);
  const allowed = GROUPS[String(params.classes)] ?? null;
  const pad = Number(params.padding) * width;
  const unit = Math.max(width, height) / 1400;
  const lw = Number(params.lineWidth) * unit;
  const kept = detections
    .filter((d) => d.score >= minScore && (!allowed || allowed.includes(d.class)))
    .slice(0, Math.round(Number(params.maxDetections)));

  const out = makeCanvas(width, height);
  const ctx = ctx2d(out);
  const bg = String(params.background);
  if (bg === 'photo') {
    ctx.drawImage(source as CanvasImageSource, 0, 0);
  } else if (bg === 'dim') {
    ctx.drawImage(source as CanvasImageSource, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = bg === 'white' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, width, height);
  }

  const boxes = kept.map((d) => {
    const [bx, by, bw, bh] = d.bbox;
    const x = Math.max(0, bx * scale - pad);
    const y = Math.max(0, by * scale - pad);
    const w = Math.min(width - x, bw * scale + pad * 2);
    const h = Math.min(height - y, bh * scale + pad * 2);
    return { d, x, y, w, h };
  });

  // photo fragments
  if (params.keepPhoto) {
    for (const b of boxes) ctx.drawImage(source as CanvasImageSource, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
  }
  // outlines and labels
  ctx.lineWidth = Math.max(0.8, lw);
  const fontPx = Math.max(9, 11 * unit);
  ctx.font = `700 ${fontPx}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'middle';
  for (const b of boxes) {
    const color = classColor(b.d.class);
    ctx.strokeStyle = color;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    if (params.labels) {
      const text = `${b.d.class} ${b.d.score.toFixed(2)}`;
      const tw = ctx.measureText(text).width + 8 * unit;
      const th = fontPx + 6 * unit;
      const ly = b.y - th >= 0 ? b.y - th : b.y;
      ctx.fillStyle = color;
      ctx.fillRect(b.x, ly, tw, th);
      ctx.fillStyle = '#000';
      ctx.fillText(text, b.x + 4 * unit, ly + th / 2 + 0.5);
    }
  }
  return out;
}

export const detectPreset: Preset = {
  id: 'detect',
  name: 'Detect',
  category: 'vision',
  thumbnail: false,
  tagline: 'Only what the detector recognises survives: labelled fragments on black.',
  defaults: DETECT_DEFAULTS,
  controls: [
    { kind: 'slider', key: 'minScore', label: 'Confidence', min: 0.1, max: 0.95, step: 0.01 },
    { kind: 'slider', key: 'maxDetections', label: 'Max objects', min: 1, max: 60, step: 1 },
    { kind: 'select', key: 'classes', label: 'Keep', options: [
      { value: 'all', label: 'Everything detected' },
      { value: 'people', label: 'People' },
      { value: 'animals', label: 'Animals' },
      { value: 'vehicles', label: 'Vehicles' },
    ] },
    { kind: 'slider', key: 'padding', label: 'Box padding', min: 0, max: 0.1, step: 0.002 },
    { kind: 'section', label: 'Drawing' },
    { kind: 'select', key: 'background', label: 'Background', options: [
      { value: 'black', label: 'Black' },
      { value: 'white', label: 'White' },
      { value: 'dim', label: 'Photo, dimmed' },
      { value: 'photo', label: 'Photo' },
    ] },
    { kind: 'toggle', key: 'keepPhoto', label: 'Keep photo inside boxes' },
    { kind: 'toggle', key: 'labels', label: 'Labels' },
    { kind: 'slider', key: 'lineWidth', label: 'Line weight', min: 0.5, max: 4, step: 0.1 },
  ],
  prepare: async (report) => {
    lastReport = report;
    await loadModel(report);
  },
  render: renderDetect,
};
