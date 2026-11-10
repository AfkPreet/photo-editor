import { useCallback, useEffect, useRef, useState } from 'react';
import { loadImageFile, resizeBitmap, drawCropped, fitWithin, PREVIEW_MAX, downloadBlob, canShareFiles, shareFile, type LoadedImage } from './lib/image';
import { DEFAULT_CROP, resolveCrop, closestAspect, type CropState, type AspectId } from './lib/crop';
import { canvasToBlob, makeCanvas, ctx2d, yieldToUI, type AnyCanvas } from './lib/canvas';
import { PRESETS, CATEGORIES, getPreset } from './presets';
import type { Params, Category } from './presets/types';
import { resetDetectCache } from './presets/detect';
import { Dropzone } from './ui/Dropzone';
import { Controls } from './ui/Controls';
import { CropEditor } from './ui/CropEditor';
import { Preview } from './ui/Preview';
import { LookStrip } from './ui/LookStrip';

type Screen = 'upload' | 'edit' | 'crop';

const APP_NAME = 'Negative Space';
const THUMB_MAX = 144;

function initialParams(): Record<string, Params> {
  return Object.fromEntries(PRESETS.map((p) => [p.id, { ...p.defaults }]));
}

/** A look's preferred frame, flipped to match the photo's orientation (a 4:5 look on a landscape photo becomes 5:4). */
function orientedAspect(ratio: number, img: LoadedImage): AspectId {
  const landscape = img.width >= img.height;
  const r = (landscape && ratio < 1) || (!landscape && ratio > 1) ? 1 / ratio : ratio;
  return closestAspect(r);
}

/** Build a compare image the same size as the rendered output (borders and diptychs change the canvas size). */
function matchCompare(copy: AnyCanvas, result: AnyCanvas): AnyCanvas {
  if (result.width === copy.width && result.height === copy.height) return copy;
  const c = makeCanvas(result.width, result.height);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, result.width, result.height);
  const src = copy as CanvasImageSource;
  if (result.height === copy.height && result.width >= copy.width * 2) {
    ctx.drawImage(src, 0, 0);
    ctx.drawImage(src, result.width - copy.width, 0);
  } else if (result.width >= copy.width && result.height >= copy.height) {
    ctx.drawImage(src, (result.width - copy.width) / 2, (result.height - copy.height) / 2);
  } else {
    const k = Math.min(result.width / copy.width, result.height / copy.height);
    const w = copy.width * k;
    const h = copy.height * k;
    ctx.drawImage(src, (result.width - w) / 2, (result.height - h) / 2, w, h);
  }
  return c;
}

const CREDITS =
  'Looks are inspired by the published work of Ansel Adams, Henri Cartier-Bresson, Sebastião Salgado, Daido Moriyama, Vivian Maier, Fan Ho, Irving Penn, Steve McCurry, Fred Herzog, William Eggleston, Saul Leiter, Alex Webb, Joel Meyerowitz, Galen Rowell, Frans Lanting, Rinko Kawauchi, Gregory Crewdson, Todd Hido, Nan Goldin and Martin Parr, and by the studies at skeletorwun.com. Names are credits, not endorsements. Independent project.';

export default function App() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [preview, setPreview] = useState<ImageBitmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [cropTouched, setCropTouched] = useState(false);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [allParams, setAllParams] = useState<Record<string, Params>>(initialParams);
  const [thumbs, setThumbs] = useState<Record<string, AnyCanvas>>({});

  const [rendered, setRendered] = useState<AnyCanvas | null>(null);
  const [sourcePreview, setSourcePreview] = useState<AnyCanvas | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingShare, setPendingShare] = useState<{ file: File; name: string } | null>(null);

  const cropButtonRef = useRef<HTMLButtonElement>(null);
  const prevScreen = useRef<Screen>('upload');

  const preset = getPreset(presetId);
  const params = allParams[presetId] ?? preset.defaults;

  const onFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setLoadError(null);
      try {
        const img = await loadImageFile(file);
        const fit = fitWithin(img.width, img.height, PREVIEW_MAX);
        const pv = await resizeBitmap(img.full, fit.w, fit.h);
        resetDetectCache();
        setImage((old) => {
          old?.full.close();
          return img;
        });
        setPreview((old) => {
          old?.close();
          return pv;
        });
        const p = getPreset(presetId);
        setCrop({ ...DEFAULT_CROP, aspect: p.preferredAspect ? orientedAspect(p.preferredAspect, img) : 'original' });
        setCropTouched(false);
        setThumbs({});
        setStatus(null);
        setPendingShare(null);
        setScreen('edit');
      } catch (e) {
        setLoadError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [presetId],
  );

  const choosePreset = useCallback(
    (id: string) => {
      const p = getPreset(id);
      setPresetId(p.id);
      if (!cropTouched && image) setCrop((c) => ({ ...c, aspect: p.preferredAspect ? orientedAspect(p.preferredAspect, image) : 'original' }));
      setStatus(null);
    },
    [cropTouched, image],
  );

  const patchParams = useCallback(
    (patch: Params) => setAllParams((all) => ({ ...all, [presetId]: { ...all[presetId], ...patch } })),
    [presetId],
  );

  const resetParams = useCallback(() => setAllParams((all) => ({ ...all, [presetId]: { ...preset.defaults } })), [presetId, preset]);

  // a prepared share file is only valid for the settings it was rendered with
  useEffect(() => setPendingShare(null), [presetId, params, crop]);

  // return focus to the toolbar when the crop screen closes
  useEffect(() => {
    if (prevScreen.current === 'crop' && screen === 'edit') cropButtonRef.current?.focus();
    prevScreen.current = screen;
  }, [screen]);

  // Interactive preview render, debounced and cancellable.
  useEffect(() => {
    if (!image || !preview || screen !== 'edit') return;
    const ac = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setBusy('Rendering…');
        await yieldToUI(); // let the busy label paint before the pixel loop starts
        if (cancelled) return;
        const full = resolveCrop(crop, image.width, image.height);
        const s = preview.width / image.width;
        const out = fitWithin(full.w, full.h, PREVIEW_MAX);
        const src = drawCropped(preview, { x: full.x * s, y: full.y * s, w: full.w * s, h: full.h * s }, out.w, out.h);
        const copy = makeCanvas(out.w, out.h);
        ctx2d(copy).drawImage(src as CanvasImageSource, 0, 0);
        if (preset.prepare) await preset.prepare((m) => !cancelled && setBusy(m));
        if (cancelled) return;
        const result = await preset.render({ source: src, width: out.w, height: out.h, fullRes: false, scale: out.w / full.w, params, signal: ac.signal });
        if (cancelled) return;
        setSourcePreview(matchCompare(copy, result));
        setRendered(result);
        setRenderError(null);
      } catch (e) {
        if (!cancelled && (e as Error).name !== 'AbortError') setRenderError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(null);
      }
    }, 40);
    return () => {
      cancelled = true;
      ac.abort();
      clearTimeout(timer);
    };
  }, [image, preview, crop, preset, params, screen]);

  // Live thumbnails for the look strip: every look rendered on a tiny copy of the current crop.
  useEffect(() => {
    if (!image || !preview || screen === 'upload') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const full = resolveCrop(crop, image.width, image.height);
      const s = preview.width / image.width;
      const out = fitWithin(full.w, full.h, THUMB_MAX);
      const base = drawCropped(preview, { x: full.x * s, y: full.y * s, w: full.w * s, h: full.h * s }, out.w, out.h);
      const next: Record<string, AnyCanvas> = {};
      for (const p of PRESETS) {
        if (p.thumbnail === false) continue;
        if (cancelled) return;
        const copy = makeCanvas(out.w, out.h);
        ctx2d(copy).drawImage(base as CanvasImageSource, 0, 0);
        try {
          next[p.id] = await p.render({ source: copy, width: out.w, height: out.h, fullRes: false, scale: out.w / full.w, params: { ...p.defaults, ...(p.thumbnailParams ?? {}) } });
        } catch {
          /* a failing thumbnail just stays empty */
        }
        await yieldToUI();
        if (!cancelled) setThumbs({ ...next });
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [image, preview, crop, screen]);

  const doExport = useCallback(
    async (kind: 'png' | 'jpeg' | 'share') => {
      if (!image) return;
      // Second tap on Share: the file is ready, so call the share sheet right inside this gesture.
      if (kind === 'share' && pendingShare) {
        const r = await shareFile(pendingShare.file, APP_NAME);
        if (r === 'unsupported') downloadBlob(pendingShare.file, pendingShare.name);
        setStatus(r === 'shared' ? `Shared ${pendingShare.name}` : r === 'cancelled' ? 'Share cancelled.' : `Sharing is not available here, so ${pendingShare.name} was downloaded instead.`);
        setPendingShare(null);
        return;
      }
      setExporting(true);
      setStatus('Rendering full size…');
      try {
        await yieldToUI(); // let the status and disabled buttons paint first
        const full = resolveCrop(crop, image.width, image.height);
        const src = drawCropped(image.full, full, full.w, full.h);
        if (preset.prepare) await preset.prepare(setStatus);
        const result = await preset.render({ source: src, width: full.w, height: full.h, fullRes: true, scale: 1, params });
        const type = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
        const blob = await canvasToBlob(result, type, 0.92);
        const name = `${image.name}-${preset.id}.${kind === 'jpeg' ? 'jpg' : 'png'}`;
        if (kind === 'share') {
          setPendingShare({ file: new File([blob], name, { type: blob.type }), name });
          setStatus(`Ready · ${result.width}×${result.height} px. Tap “Share now” to open the share sheet.`);
        } else {
          downloadBlob(blob, name);
          setStatus(`Saved ${name} · ${result.width}×${result.height} px`);
        }
      } catch (e) {
        setStatus('Export failed: ' + (e as Error).message);
      } finally {
        setExporting(false);
      }
    },
    [image, crop, preset, params, pendingShare],
  );

  const reset = useCallback(() => {
    setScreen('upload');
    setRendered(null);
    setSourcePreview(null);
    setThumbs({});
    setStatus(null);
    setPendingShare(null);
    setImage((old) => {
      old?.full.close();
      return null;
    });
    setPreview((old) => {
      old?.close();
      return null;
    });
  }, []);

  const countIn = (c: Category) => PRESETS.filter((p) => p.category === c).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
          {APP_NAME}
          {screen !== 'upload' && image && <small title={image.name}>· {image.name}</small>}
        </div>
        <div className="spacer" />
        {screen !== 'upload' && (
          <>
            <button ref={cropButtonRef} className="btn small" type="button" onClick={() => setScreen(screen === 'crop' ? 'edit' : 'crop')} aria-pressed={screen === 'crop'}>
              Crop
            </button>
            <button className="btn small ghost" type="button" onClick={reset}>
              New photo
            </button>
          </>
        )}
      </header>

      {screen === 'upload' && (
        <main className="upload">
          <h1>Your photo, {PRESETS.length} ways.</h1>
          <p>Film and print looks inspired by the great photographers, a shape cut-out, and machine-vision overlays. Everything runs in your browser. Photos never leave your device.</p>
          <Dropzone onFile={onFile} busy={loading} error={loadError} />
          <div className="cat-grid" role="group" aria-label="Categories">
            {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
              <div className="look" key={c.id}>
                <b>
                  {c.label} · {countIn(c.id as Category)}
                </b>
                <span>{c.blurb}</span>
              </div>
            ))}
          </div>
          <p className="fineprint">{CREDITS}</p>
        </main>
      )}

      {screen === 'crop' && preview && (
        <main className="editor">
          <CropEditor
            bitmap={preview}
            crop={crop}
            onChange={(c) => {
              setCrop(c);
              setCropTouched(true);
            }}
            onDone={() => setScreen('edit')}
          />
        </main>
      )}

      {screen === 'edit' && image && (
        <main className="editor">
          <div className="stage">
            <Preview canvas={rendered} compareCanvas={sourcePreview} compare={compare} busy={busy} error={renderError} />
            <button
              className="btn small hold"
              type="button"
              aria-label="Hold to see the original"
              aria-pressed={compare}
              onPointerDown={() => setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              onPointerCancel={() => setCompare(false)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setCompare(true);
                }
              }}
              onKeyUp={() => setCompare(false)}
              onBlur={() => setCompare(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Hold: original
            </button>
          </div>
          <aside className="panel">
            <div className="panel-scroll">
              <LookStrip presets={PRESETS} activeId={presetId} thumbs={thumbs} category={category} onCategory={setCategory} onPick={choosePreset} />
              <h2>{preset.name}</h2>
              {preset.inspiredBy && (
                <p className="credit">
                  Inspired by <b>{preset.inspiredBy}</b>
                </p>
              )}
              <p className="tagline">{preset.tagline}</p>
              <Controls controls={preset.controls} params={params} onChange={patchParams} />
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn small ghost" type="button" onClick={resetParams}>
                  Reset {preset.name.toLowerCase()}
                </button>
              </div>
            </div>
            <div className="exportbar">
              <button className="btn primary" type="button" disabled={exporting} onClick={() => doExport('png')}>
                {exporting ? 'Rendering…' : 'Download PNG'}
              </button>
              <button className="btn" type="button" disabled={exporting} onClick={() => doExport('jpeg')}>
                JPEG
              </button>
              {canShareFiles() && (
                <button className={'btn' + (pendingShare ? ' primary' : '')} type="button" disabled={exporting} onClick={() => doExport('share')}>
                  {pendingShare ? 'Share now' : 'Share'}
                </button>
              )}
              <div className="meta" role="status" aria-live="polite">
                {status ?? ''}
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
