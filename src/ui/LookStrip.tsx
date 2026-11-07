import { useEffect, useRef } from 'react';
import type { Preset, Category } from '../presets/types';
import { CATEGORIES } from '../presets';
import type { AnyCanvas } from '../lib/canvas';

interface Props {
  presets: Preset[];
  activeId: string;
  thumbs: Record<string, AnyCanvas>;
  category: Category | 'all';
  onCategory: (c: Category | 'all') => void;
  onPick: (id: string) => void;
}

function Thumb({ canvas }: { canvas?: AnyCanvas }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canvas) return;
    el.width = canvas.width;
    el.height = canvas.height;
    el.getContext('2d')!.drawImage(canvas as CanvasImageSource, 0, 0);
  }, [canvas]);
  return <canvas ref={ref} className={canvas ? 'thumb' : 'thumb empty'} aria-hidden="true" />;
}

export function LookStrip({ presets, activeId, thumbs, category, onCategory, onPick }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const shown = presets.filter((p) => category === 'all' || p.category === category);

  // keep the active card in view, scrolling only the strip itself (never the page or panel)
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    if (!strip || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = Math.max(0, left - 8);
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 8;
  }, [activeId, category]);

  return (
    <div className="lookbar">
      <div className="cats" role="tablist" aria-label="Look categories">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={'chip' + (category === c.id ? ' active' : '')} onClick={() => onCategory(c.id)} title={c.blurb}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="lookstrip" ref={stripRef} role="listbox" aria-label="Looks">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            role="option"
            aria-selected={p.id === activeId}
            aria-label={p.name}
            data-id={p.id}
            className={'look-card' + (p.id === activeId ? ' active' : '')}
            onClick={() => onPick(p.id)}
            title={p.tagline}
          >
            {p.thumbnail === false ? <div className="thumb ph" aria-hidden="true">[ ]</div> : <Thumb canvas={thumbs[p.id]} />}
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
