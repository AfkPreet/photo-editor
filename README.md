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

Static site. On Vercel: framework "Vite", build `npm run build`, output `dist`.
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
