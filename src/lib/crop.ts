import type { CropRect } from './image';

export type AspectId = 'original' | '4:5' | '1:1' | '3:4' | '2:3' | '3:2' | '16:9' | '9:16';

export const ASPECTS: { id: AspectId; label: string; ratio?: number }[] = [
  { id: 'original', label: 'Original' },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

/** Crop state kept resolution-independent: centre as fractions, zoom as fraction of the largest fitting rect. */
export interface CropState {
  aspect: AspectId;
  cx: number;
  cy: number;
  zoom: number;
}

export const DEFAULT_CROP: CropState = { aspect: 'original', cx: 0.5, cy: 0.5, zoom: 1 };

export function aspectRatioFor(id: AspectId, imgW: number, imgH: number): number {
  const a = ASPECTS.find((x) => x.id === id);
  return a?.ratio ?? imgW / imgH;
}

export function closestAspect(ratio: number): AspectId {
  let best: AspectId = 'original';
  let bestDiff = Infinity;
  for (const a of ASPECTS) {
    if (!a.ratio) continue;
    const d = Math.abs(Math.log(a.ratio / ratio));
    if (d < bestDiff) {
      bestDiff = d;
      best = a.id;
    }
  }
  return best;
}

/** Resolve the crop state into a pixel rect inside an image of the given size. */
export function resolveCrop(state: CropState, imgW: number, imgH: number): CropRect {
  const ratio = aspectRatioFor(state.aspect, imgW, imgH);
  let w = imgW;
  let h = imgW / ratio;
  if (h > imgH) {
    h = imgH;
    w = imgH * ratio;
  }
  const zoom = Math.min(1, Math.max(0.15, state.zoom));
  w *= zoom;
  h *= zoom;
  let x = state.cx * imgW - w / 2;
  let y = state.cy * imgH - h / 2;
  x = Math.min(Math.max(0, x), imgW - w);
  y = Math.min(Math.max(0, y), imgH - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}
