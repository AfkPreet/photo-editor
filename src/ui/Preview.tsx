import { useEffect, useRef } from 'react';
import type { AnyCanvas } from '../lib/canvas';

interface Props {
  canvas: AnyCanvas | null;
  compareCanvas: AnyCanvas | null;
  compare: boolean;
  busy: string | null;
  error: string | null;
}

export function Preview({ canvas, compareCanvas, compare, busy, error }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    const src = compare && compareCanvas ? compareCanvas : canvas;
    if (!el || !src) return;
    if (el.width !== src.width || el.height !== src.height) {
      el.width = src.width;
      el.height = src.height;
    }
    const ctx = el.getContext('2d')!;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(src as CanvasImageSource, 0, 0);
  }, [canvas, compareCanvas, compare]);
  return (
    <>
      <canvas ref={ref} aria-label="Preview" data-testid="preview" />
      {compare && <div className="label">Original</div>}
      {busy && (
        <div className="busy" role="status">
          {busy}
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
