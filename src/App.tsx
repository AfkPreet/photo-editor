import { useCallback, useEffect, useState } from 'react';
import { loadImageFile, resizeBitmap, drawCropped, fitWithin, PREVIEW_MAX, downloadBlob, canShareFiles, shareBlob, type LoadedImage } from './lib/image';
import { DEFAULT_CROP, resolveCrop, closestAspect, type CropState } from './lib/crop';
import { canvasToBlob, makeCanvas, ctx2d, type AnyCanvas } from './lib/canvas';
import { PRESETS, getPreset } from './presets';
import type { Params } from './presets/types';
import { Dropzone } from './ui/Dropzone';
import { Controls } from './ui/Controls';
import { CropEditor } from './ui/CropEditor';
import { Preview } from './ui/Preview';

type Screen = 'upload' | 'edit' | 'crop';

const APP_NAME = 'Negative Space';

function initialParams(): Record<string, Params> {
  return Object.fromEntries(PRESETS.map((p) => [p.id, { ...p.defaults }]));
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [preview, setPreview] = useState<ImageBitmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [cropTouched, setCropTouched] = useState(false);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [allParams, setAllParams] = useState<Record<string, Params>>(initialParams);

  const [rendered, setRendered] = useState<AnyCanvas | null>(null);
  const [sourcePreview, setSourcePreview] = useState<AnyCanvas | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const preset = getPreset(presetId);
  const params = allParams[presetId] ?? preset.defaults;

  const onFile = useCallback(async (file: File) => {
    setLoading(true);
    setLoadError(null);
    try {
      const img = await loadImageFile(file);
      const fit = fitWithin(img.width, img.height, PREVIEW_MAX);
      const pv = await resizeBitmap(img.full, fit.w, fit.h);
      setImage((old) => {
        old?.full.close();
        return img;
      });
      setPreview((old) => {
        old?.close();
        return pv;
      });
      setCrop(DEFAULT_CROP);
      setCropTouched(false);
      setStatus(null);
      setScreen('edit');
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const choosePreset = useCallback(
    (id: string) => {
      const p = getPreset(id);
      setPresetId(p.id);
      if (p.preferredAspect && !cropTouched) setCrop((c) => ({ ...c, aspect: closestAspect(p.preferredAspect!) }));
      setStatus(null);
    },
    [cropTouched],
  );

  const patchParams = useCallback(
    (patch: Params) => setAllParams((all) => ({ ...all, [presetId]: { ...all[presetId], ...patch } })),
    [presetId],
  );

  const resetParams = useCallback(() => setAllParams((all) => ({ ...all, [presetId]: { ...preset.defaults } })), [presetId, preset]);

  // Interactive preview render, debounced and cancellable.
  useEffect(() => {
    if (!image || !preview || screen !== 'edit') return;
    const ac = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setBusy('Rendering…');
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
        setSourcePreview(copy);
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

  const doExport = useCallback(
    async (kind: 'png' | 'jpeg' | 'share') => {
      if (!image) return;
      setExporting(true);
      setStatus('Rendering full size…');
      try {
        const full = resolveCrop(crop, image.width, image.height);
        const src = drawCropped(image.full, full, full.w, full.h);
        if (preset.prepare) await preset.prepare(setStatus);
        const result = await preset.render({ source: src, width: full.w, height: full.h, fullRes: true, scale: 1, params });
        const type = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
        const blob = await canvasToBlob(result, type, 0.92);
        const name = `${image.name}-${preset.id}.${kind === 'jpeg' ? 'jpg' : 'png'}`;
        if (kind === 'share') {
          const ok = await shareBlob(blob, name, APP_NAME);
          if (!ok) downloadBlob(blob, name);
        } else {
          downloadBlob(blob, name);
        }
        setStatus(`Saved ${name} · ${result.width}×${result.height} px`);
      } catch (e) {
        setStatus('Export failed: ' + (e as Error).message);
      } finally {
        setExporting(false);
      }
    },
    [image, crop, preset, params],
  );

  const reset = useCallback(() => {
    setScreen('upload');
    setRendered(null);
    setSourcePreview(null);
    setStatus(null);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
          {APP_NAME}
          {screen !== 'upload' && image && <small>· {image.name}</small>}
        </div>
        <div className="spacer" />
        {screen !== 'upload' && (
          <>
            <nav className="tabs" aria-label="Looks">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className={'tab' + (p.id === presetId ? ' active' : '')} aria-pressed={p.id === presetId} onClick={() => choosePreset(p.id)}>
                  {p.name}
                </button>
              ))}
            </nav>
            <button className="btn small" type="button" onClick={() => setScreen(screen === 'crop' ? 'edit' : 'crop')} aria-pressed={screen === 'crop'}>
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
          <h1>Your photos, three ways.</h1>
          <p>A film grade, shape cut-outs and computer-vision overlays. Everything runs in your browser. Photos never leave your device.</p>
          <Dropzone onFile={onFile} busy={loading} error={loadError} />
          <div className="looks" aria-label="Looks">
            {PRESETS.map((p) => (
              <div className="look" key={p.id}>
                <b>{p.name}</b>
                <span>{p.tagline}</span>
              </div>
            ))}
          </div>
          <p className="fineprint">
            Inspired by the colour, cut-out and computer-vision studies of Arihant Pradhan (skeletorwun.com). Independent project, not affiliated.
          </p>
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
              onPointerDown={() => setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              onPointerCancel={() => setCompare(false)}
            >
              Hold: original
            </button>
          </div>
          <aside className="panel">
            <div className="panel-scroll">
              <h2>{preset.name}</h2>
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
                <button className="btn" type="button" disabled={exporting} onClick={() => doExport('share')}>
                  Share
                </button>
              )}
              {status && (
                <div className="meta" role="status">
                  {status}
                </div>
              )}
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
