# Negative Space — spec and decision log

Working title. A browser photo tool that turns your photos into three looks
inspired by the skeletorwun.com portfolio: a moody film grade, shape cut-out
diptychs, and computer-vision overlays. Everything runs client-side; photos never
leave the device.

Owner: Preet (afkpreet/photo-editor). Built with Claude Code, Nov 2026.

## Decisions (what we chose, what we rejected, why)

| # | Decision | Rejected | Why |
|---|----------|----------|-----|
| 1 | Hybrid pipeline: deterministic browser presets first, one AI preset later (phase 2) | AI image model for every preset | Img2img cannot draw clean masks or detection boxes, costs ₹3–12 per image that the owner pays for public users, and changes photo content |
| 2 | Own effect family and name; credit the inspiration on the About screen | Naming the app after the portfolio or its editor | Public app cloning a living creator's signature tool is not fair to him |
| 3 | Grade tuned by eye and by numbers against the public before/after pair, expressed as our own parametric curves | Shipping a LUT lifted from his images, or feeding his images to an AI model as style reference | A look is not copyrightable; his images are |
| 4 | Static web app, Vite + React + TypeScript, deployed on Vercel, installable as a PWA | Python batch script | Preet works on iPad; must run on a phone/tablet with no backend |
| 5 | CPU typed-array pipeline for the grade (preview at ≤1400 px, export at full resolution) | WebGL shaders | Simpler, fast enough (≈1 s for a 12 MP export), no shader debugging on Safari |
| 6 | Own connected-components implementation for blob overlays | OpenCV.js (≈8 MB wasm) | Blob tracking on a still needs only thresholding + labelling; 8 MB is not worth it |
| 7 | In-browser COCO-SSD (TF.js) for detection boxes, model self-hosted | Server-side YOLO, OpenCV.js | No backend, no per-image cost, works offline once cached; TF.js only loads when Detect is opened |
| 8 | Global crop step (aspect presets, drag + zoom) shared by all presets | Per-preset crop with corner handles | Works on touch, one mental model |

## Presets (phase 1)

1. **Film grade** — tone curve (contrast, fade, shadows, highlights), temperature,
   split-tone (shadow tint teal/navy, highlight tint), saturation, vignette, grain
   (clumpy, luminance-weighted), intensity mix. Defaults approximate the reference
   grade: strong contrast, cool cast, blue-teal shadows, overall darker.
2. **Cut-out** — shapes (star, heart, circle, sparkle, hexagon, diamond, custom SVG)
   scattered in a cluster (count, size range, spread, rotation, centre, seed).
   Output: diptych of photo-inside-shapes on a background colour + shapes masked
   over the photo; or either panel alone. Default aspect 4:5.
3. **Blobs** — threshold (bright / dark / colour window) → connected components →
   boxes, centre dots, size labels, nearest-neighbour links, circles around the big
   ones; over the photo, dimmed, or on black/white; four palettes.
4. **Detect** — in-browser COCO-SSD (TF.js, lazy-loaded, weights self-hosted under
   `public/models/`) keeps detected rectangles as photo fragments on black with
   labelled boxes; confidence, class group, padding, labels, line weight.

Shared: upload (drag/drop, file picker, paste), crop (aspect chips, drag, zoom),
hold-to-compare with the original, export PNG/JPEG at full resolution (capped at
16 MP for Safari), share sheet on devices that support it, installable PWA.

## Status (Nov 2026)

Phase 1 built and verified with Playwright on desktop and iPhone viewports:
upload → each preset → export. Grade defaults were tuned numerically against the
public before/after frame (RMSE 40 → 18 on that frame).

## Phase 2 (not built yet)

AI "Re-grade" preset: Vercel serverless function calling an image-edit model
(Gemini Flash Image or Flux Kontext) with the look described in words only, daily
spend cap, per-IP rate limit, result cached. Needs an API key in Vercel env.

## Non-goals

No accounts, no uploads to a server, no analytics in phase 1, no video.

## Running

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
npm run preview
```

Deploy: GitHub Pages via `.github/workflows/pages.yml` on push to `main`
(https://afkpreet.github.io/photo-editor/). Vercel works too (import the repo,
Vite preset). Decision 9: GitHub Pages chosen because the Vercel connector could
not create projects (403) and Pages needs no extra account.
