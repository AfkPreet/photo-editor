import { useCallback, useEffect, useRef } from 'react';
import { ASPECTS, resolveCrop, type CropState } from '../lib/crop';

interface Props {
  bitmap: ImageBitmap;
  crop: CropState;
  onChange: (c: CropState) => void;
  onDone: () => void;
}

interface PointerState {
  id: number;
  x: number;
  y: number;
}

const MIN_ZOOM = 0.15;
const clampZoom = (z: number) => Math.min(1, Math.max(MIN_ZOOM, z));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fixed-aspect frame over the photo: drag to move, pinch or wheel to resize, arrow keys to nudge. */
export function CropEditor({ bitmap, crop, onChange, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef<Map<number, PointerState>>(new Map());
  const gesture = useRef<{ cx: number; cy: number; zoom: number; dist: number; x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const maxW = Math.max(50, parent.clientWidth - 24);
    const maxH = Math.max(50, parent.clientHeight - 24);
    const s = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * s));
    const h = Math.max(1, Math.round(bitmap.height * s));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const r = resolveCrop(crop, bitmap.width, bitmap.height);
    const rx = r.x * s;
    const ry = r.y * s;
    const rw = r.w * s;
    const rh = r.h * s;
    ctx.fillStyle = 'rgba(10,12,16,0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(rx, ry, rw, rh);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(244,239,230,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);
    ctx.strokeStyle = 'rgba(244,239,230,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(rx + (rw * i) / 3, ry);
      ctx.lineTo(rx + (rw * i) / 3, ry + rh);
      ctx.moveTo(rx, ry + (rh * i) / 3);
      ctx.lineTo(rx + rw, ry + (rh * i) / 3);
      ctx.stroke();
    }
  }, [bitmap, crop]);

  useEffect(() => {
    draw();
    const parent = canvasRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [draw]);

  /** Image pixels per CSS pixel, measured live so window resizes and rotation never go stale. */
  const pxPerCss = () => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return bitmap.width / Math.max(1, rect.width);
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { cx: crop.cx, cy: crop.cy, zoom: crop.zoom, dist, x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.size >= 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    startGesture();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointers.current.get(e.pointerId);
    const g = gesture.current;
    if (!p || !g) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const pts = [...pointers.current.values()];
    const k = pxPerCss();
    const x = pts.reduce((a, q) => a + q.x, 0) / pts.length;
    const y = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    let zoom = g.zoom;
    if (pts.length >= 2 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoom = clampZoom(g.zoom * (g.dist / dist)); // fingers apart = tighter frame = zoom in
    }
    onChange({
      ...crop,
      zoom,
      cx: clamp01(g.cx + ((x - g.x) * k) / bitmap.width),
      cy: clamp01(g.cy + ((y - g.y) * k) / bitmap.height),
    });
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size > 0) startGesture();
    else gesture.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = (e.shiftKey ? 0.05 : 0.01);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      onChange({ ...crop, cx: clamp01(crop.cx + dx), cy: clamp01(crop.cy + dy) });
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      onChange({ ...crop, zoom: clampZoom(crop.zoom - 0.05) });
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      onChange({ ...crop, zoom: clampZoom(crop.zoom + 0.05) });
    }
  };

  const magnification = Math.round((1 / crop.zoom) * 100);

  return (
    <>
      <div className="stage">
        <canvas
          ref={canvasRef}
          className="crop-canvas"
          tabIndex={0}
          role="img"
          aria-label="Crop frame. Drag to move, pinch or scroll to resize, arrow keys to nudge, plus and minus to zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => {
            // scroll up = zoom in (tighter frame), like maps and photo viewers
            onChange({ ...crop, zoom: clampZoom(crop.zoom + e.deltaY * 0.0012) });
          }}
        />
        <div className="label">Drag to move · pinch or scroll to zoom</div>
      </div>
      <div className="panel">
        <div className="panel-scroll">
          <h2>Crop</h2>
          <p className="tagline">Pick an aspect, drag the frame, zoom with the slider.</p>
          <div className="chips" role="group" aria-label="Aspect ratio">
            {ASPECTS.map((a) => (
              <button key={a.id} type="button" aria-pressed={crop.aspect === a.id} className={'chip' + (crop.aspect === a.id ? ' active' : '')} onClick={() => onChange({ ...crop, aspect: a.id })}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="control" style={{ marginTop: 16 }}>
            <label htmlFor="crop-zoom">Zoom</label>
            <span className="val">{magnification}%</span>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={Math.round(100 / MIN_ZOOM) / 100}
              step={0.01}
              value={Math.round((1 / crop.zoom) * 100) / 100}
              onChange={(e) => onChange({ ...crop, zoom: clampZoom(1 / Number(e.target.value)) })}
            />
          </div>
          <div className="control" style={{ marginTop: 4 }}>
            <label htmlFor="crop-x">Horizontal position</label>
            <span className="val">{Math.round(crop.cx * 100)}%</span>
            <input id="crop-x" type="range" min={0} max={1} step={0.005} value={crop.cx} onChange={(e) => onChange({ ...crop, cx: Number(e.target.value) })} />
          </div>
          <div className="control">
            <label htmlFor="crop-y">Vertical position</label>
            <span className="val">{Math.round(crop.cy * 100)}%</span>
            <input id="crop-y" type="range" min={0} max={1} step={0.005} value={crop.cy} onChange={(e) => onChange({ ...crop, cy: Number(e.target.value) })} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn small ghost" type="button" onClick={() => onChange({ ...crop, cx: 0.5, cy: 0.5, zoom: 1 })}>
              Reset
            </button>
          </div>
        </div>
        <div className="exportbar">
          <button className="btn primary" type="button" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
