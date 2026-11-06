# Negative Space

Your photos, three ways (four presets): a moody **film grade**, a **shape cut-out**
diptych, **blob** overlays and **detection** fragments. Everything runs in the
browser. Photos never leave the device.

Inspired by the colour, cut-out and computer-vision studies of Arihant Pradhan
(skeletorwun.com). Independent project, not affiliated.

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
  App.tsx            screens: upload → edit (preview + controls) / crop
  lib/               image loading, crop model, canvas + export helpers, PRNG
  presets/           one file per look; each exports a Preset {defaults, controls, render}
  ui/                Dropzone, CropEditor, Controls (schema-driven), Preview
public/models/       COCO-SSD lite_mobilenet_v2 (TF.js graph model)
SPEC.md              decisions and scope
```

Adding a preset: create `src/presets/<name>.ts` exporting a `Preset`, register it
in `src/presets/index.ts`. Controls are declared as data; the UI renders them.
