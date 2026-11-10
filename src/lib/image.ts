import { makeCanvas, ctx2d, MAX_CANVAS_PIXELS, type AnyCanvas } from './canvas';

export interface LoadedImage {
  name: string;
  /** Full-resolution bitmap, EXIF orientation already applied. */
  full: ImageBitmap;
  width: number;
  height: number;
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp'];

/** Longest edge for the interactive preview. Export always uses the full bitmap. */
export const PREVIEW_MAX = 1400;

/** Guard for very large photos: keeps canvases inside Safari limits and iPad memory sane. */
const MAX_PIXELS = MAX_CANVAS_PIXELS;

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error('This photo could not be opened. Try a JPEG, PNG, WebP, AVIF, GIF or BMP.');
    }
  }
  let full = bitmap;
  const pixels = bitmap.width * bitmap.height;
  if (pixels > MAX_PIXELS) {
    const s = Math.sqrt(MAX_PIXELS / pixels);
    full = await resizeBitmap(bitmap, Math.round(bitmap.width * s), Math.round(bitmap.height * s));
    bitmap.close();
  }
  return { name: stripExtension(file.name) || 'photo', full, width: full.width, height: full.height };
}

export async function resizeBitmap(src: ImageBitmap, w: number, h: number): Promise<ImageBitmap> {
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return createImageBitmap(c as unknown as CanvasImageSource);
}

export function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '');
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draw the crop region of `src` into a new canvas of the requested output size. */
export function drawCropped(src: CanvasImageSource, crop: CropRect, outW: number, outH: number): AnyCanvas {
  const c = makeCanvas(outW, outH);
  const ctx = ctx2d(c);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);
  return c;
}

export function fitWithin(w: number, h: number, max: number): { w: number; h: number; scale: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), scale };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

/** Must be called synchronously inside a user gesture: browsers expire share activation within seconds. */
export async function shareFile(file: File, title: string): Promise<ShareResult> {
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    return (err as DOMException).name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}
