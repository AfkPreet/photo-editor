import { useEffect, useRef } from 'react';
import { ASPECTS, resolveCrop, type CropState } from '../lib/crop';

interface Props {
  bitmap: ImageBitmap;
  crop: CropState;
  onChange: (c: CropState) => void;
  onDone: () => void;
}

export function CropEditor({ bitmap, crop, onChange, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; scale: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const maxW = parent.clientWidth - 24;
    const maxH = parent.clientHeight - 24;
    const s = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * s));
    const h = Math.max(1, Math.round(bitmap.height * s));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
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
    canvas.dataset.scale = String(s);
  }, [bitmap, crop]);

  return (
    <>
      <div className="stage">
        <canvas
          ref={canvasRef}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            const canvas = canvasRef.current!;
            canvas.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, cx: crop.cx, cy: crop.cy, scale: Number(canvas.dataset.scale) || 1 };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = (e.clientX - d.x) / d.scale / bitmap.width;
            const dy = (e.clientY - d.y) / d.scale / bitmap.height;
            onChange({ ...crop, cx: Math.min(1, Math.max(0, d.cx + dx)), cy: Math.min(1, Math.max(0, d.cy + dy)) });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => {
            const z = Math.min(1, Math.max(0.15, crop.zoom - e.deltaY * 0.0012));
            onChange({ ...crop, zoom: z });
          }}
        />
        <div className="label">Drag to move the frame</div>
      </div>
      <div className="panel">
        <div className="panel-scroll">
          <h2>Crop</h2>
          <p className="tagline">Pick an aspect, drag the frame, zoom with the slider.</p>
          <div className="chips" role="radiogroup" aria-label="Aspect ratio">
            {ASPECTS.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={crop.aspect === a.id} className={'chip' + (crop.aspect === a.id ? ' active' : '')} onClick={() => onChange({ ...crop, aspect: a.id })}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="control" style={{ marginTop: 16 }}>
            <label htmlFor="crop-zoom">Zoom</label>
            <span className="val">{Math.round(crop.zoom * 100)}%</span>
            <input id="crop-zoom" type="range" min={0.15} max={1} step={0.01} value={crop.zoom} onChange={(e) => onChange({ ...crop, zoom: Number(e.target.value) })} />
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
