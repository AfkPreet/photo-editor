# Negative Space

Your photo, 21 ways. Eighteen film and print **looks** inspired by well-known
photographers (Kodachrome, dye transfer, zone system, are-bure-boke, platinum and
more), a **shape cut-out** diptych, **blob** overlays and **detection** fragments.
Everything runs in the browser. Photos never leave the device.

Looks are interpretations built from our own curves and credited by name; the
names are credits, not endorsements. The cut-out, blob and teal-grade ideas come
from the studies at skeletorwun.com. Independent project, not affiliated.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve dist/ on :4173
```

## Deploy

**GitHub Pages (default).** `.github/workflows/pages.yml` builds on every push to
`main` and force-pushes `dist/` to the `gh-pages` branch, which GitHub serves at
https://afkpreet.github.io/photo-editor/. If the site does not appear after the
first run, set Settings → Pages → Source to "Deploy from a branch", branch
`gh-pages`, folder `/ (root)`. The build sets `BASE_PATH=/photo-editor/` so
assets, the service worker and the detector weights resolve under the sub-path.

**Vercel (optional).** Import the repo; framework "Vite", build `npm run build`,
output `dist`, no `BASE_PATH`.

The detector weights live in `public/models/` and are served with the site.

## Layout

```
src/
  App.tsx            screens: upload → edit (preview + look strip + controls) / crop
  engine/            the film engine: curves, levels, blur/glow passes, grain, film.ts
  lib/               image loading, crop model, canvas + export helpers, PRNG
  presets/           looks.ts (18 looks as data), cutout, blobs, detect, registry
  ui/                Dropzone, CropEditor, LookStrip, Controls (schema-driven), Preview
public/models/       COCO-SSD lite_mobilenet_v2 (TF.js graph model)
SPEC.md              decisions and scope
```

Adding a look: add an entry to `LOOKS` in `src/presets/looks.ts` (name, credit,
tagline, optional aspect, engine parameters). Adding a different kind of preset:
create `src/presets/<name>.ts` exporting a `Preset`, register it in
`src/presets/index.ts`. Controls are declared as data; the UI renders them.
