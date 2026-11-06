export type ShapeId = 'star' | 'sparkle' | 'heart' | 'circle' | 'hexagon' | 'diamond' | 'triangle' | 'custom';

export const SHAPE_OPTIONS: { value: ShapeId; label: string }[] = [
  { value: 'star', label: 'Star' },
  { value: 'sparkle', label: 'Sparkle' },
  { value: 'heart', label: 'Heart' },
  { value: 'circle', label: 'Circle' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'custom', label: 'Custom SVG' },
];

function polygon(points: [number, number][]): Path2D {
  const p = new Path2D();
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  return p;
}

function starPoints(n: number, outer: number, inner: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function regular(n: number, r = 1, rot = -Math.PI / 2): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** Unit shapes centred on the origin, roughly radius 1. */
export function shapePath(id: ShapeId, custom?: string): Path2D {
  switch (id) {
    case 'star':
      return polygon(starPoints(5, 1, 0.42));
    case 'sparkle':
      return polygon(starPoints(4, 1, 0.28));
    case 'circle': {
      const p = new Path2D();
      p.arc(0, 0, 1, 0, Math.PI * 2);
      return p;
    }
    case 'hexagon':
      return polygon(regular(6, 1, 0));
    case 'diamond':
      return polygon([
        [0, -1],
        [0.62, 0],
        [0, 1],
        [-0.62, 0],
      ]);
    case 'triangle':
      return polygon(regular(3));
    case 'heart': {
      const p = new Path2D('M0 0.95 C -0.55 0.55 -1.05 0.15 -1.05 -0.3 C -1.05 -0.72 -0.72 -0.98 -0.42 -0.98 C -0.2 -0.98 -0.04 -0.86 0 -0.7 C 0.04 -0.86 0.2 -0.98 0.42 -0.98 C 0.72 -0.98 1.05 -0.72 1.05 -0.3 C 1.05 0.15 0.55 0.55 0 0.95 Z');
      return p;
    }
    case 'custom': {
      if (!custom) return shapePath('star');
      try {
        const { d, vb } = JSON.parse(custom) as { d: string; vb: number[] };
        const [x, y, w, h] = vb;
        const k = 2 / Math.max(w, h);
        const m = new DOMMatrix().scale(k).translate(-(x + w / 2), -(y + h / 2));
        const p = new Path2D();
        p.addPath(new Path2D(d), m);
        return p;
      } catch {
        return shapePath('star');
      }
    }
  }
}

/** Reads the first <path d> of an SVG file and its viewBox into a JSON string the preset can store. */
export function parseSvgShape(text: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    const path = doc.querySelector('path');
    const d = path?.getAttribute('d');
    if (!svg || !d) return null;
    let vb = (svg.getAttribute('viewBox') || '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) {
      const w = parseFloat(svg.getAttribute('width') || '0') || 100;
      const h = parseFloat(svg.getAttribute('height') || '0') || 100;
      vb = [0, 0, w, h];
    }
    return JSON.stringify({ d, vb });
  } catch {
    return null;
  }
}
