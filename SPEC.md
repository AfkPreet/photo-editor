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

## Phase 2 decisions (Nov 2026)

| # | Decision | Rejected | Why |
|---|----------|----------|-----|
| 10 | One parametric film engine (`src/engine/film.ts`); every colour and mono look is a parameter set in `src/presets/looks.ts` | A hand-written pipeline per look | Looks become data: adding one is a 10-line entry, and every slider works for every look |
| 11 | Looks are interpretations of published bodies of work, built from our own curves, credited by name | Copying LUTs or training on the photographers' images | A look is not copyrightable; their images are. Names are credits, not endorsements |
| 12 | Look strip with live thumbnails of the user's own photo, filtered by category | Tabs per preset | 21 presets do not fit in tabs; a thumbnail is the fastest way to choose |
| 13 | Collapsible control groups, Tone open by default | One long slider list | 45 sliders per look is a wall; grouped, the common ones stay one tap away |
| 14 | Clarity, soft focus, bloom and halation run on a ≤320 px downscale and are composited back | Full-resolution blurs | Same look, 20× cheaper; iPad exports stay around a second |
| 15 | Detect keeps a static icon instead of a live thumbnail | Running the model for the strip | Loading 18 MB and running inference just to draw a 92 px card is not worth it |
| 16 | Share is two taps: first renders and prepares the file, second opens the share sheet | One tap that renders then shares | Browsers expire the tap's activation within seconds; a full-size render can take longer, so the sheet silently fails |
| 17 | One canvas cap (16 MP) enforced on every output, including borders and diptychs | Capping only the loaded photo | iOS Safari refuses larger canvases and exports come out blank |
| 18 | Renders yield to the browser every 64 rows and honour cancellation | One synchronous loop | Slider drags stay responsive and the busy label actually paints |
| 19 | Plain toggle buttons for categories, looks and aspect chips | ARIA listbox/tab/radio roles | Those roles promise arrow-key navigation we do not implement; honest buttons are better than half a pattern |
| 20 | A look's preferred frame follows the photo's orientation (4:5 becomes 5:4 on a landscape photo) | Fixed ratio | A portrait crop forced onto a landscape photo throws most of it away |

### Review (Nov 2026)

A five-dimension review (engine maths, React state, browser compatibility,
usability/accessibility, preset data) produced 32 findings; the verifier pass
confirmed 5 before hitting a usage limit and the rest were adjudicated by hand.
All 32 were fixed in the follow-up commit: intensity now blends toward the
untouched photo and scales soft focus, bloom, halation and border; thumbnails
attenuate grain; an all-zero mono mixer falls back to luma; clarity samples the
blur once per pixel; renders yield and cancel; borders and diptychs respect the
canvas cap; sharing is two-step with cancel detection; the crop editor supports
pinch, keyboard nudging and position sliders and measures its scale live; file
input, hold-to-compare and live regions are keyboard and screen-reader
friendly; touch targets grow on coarse pointers; look names wrap to two lines;
long filenames truncate; the detect cache key is unambiguous and resets per
photo; the cut-out thumbnail shows a single panel.

### Looks

| Look | Category | Inspired by | Signature in the engine |
|------|----------|-------------|-------------------------|
| Moody teal | colour | the skeletorwun.com grading study | cool WB, navy/teal split tone, cream highlights |
| Kodachrome | colour | Steve McCurry, Fred Herzog | reds and blues up, warm skin, crisp, little grain |
| Dye transfer | colour | William Eggleston | dense reds, pastel glow, gentle contrast |
| Painterly | colour | Saul Leiter | muted, warm, soft focus, bloom, reds kept |
| Layered light | colour | Alex Webb | crushed shadows, saturated light, clarity |
| Cape light | colour | Joel Meyerowitz | open shadows, pastel sky, no grain, 4:5 |
| Slide film | colour | Galen Rowell, Frans Lanting | Velvia-style greens and blues, clarity |
| Snapshot flash | colour | Nan Goldin, Martin Parr | saturated, warm, strong vignette, grain, halation |
| Twilight cinema | colour | Gregory Crewdson, Todd Hido | teal shadows, sodium highlights, bloom, 2.39:1 |
| Pastel light | colour | Rinko Kawauchi | overexposed, lifted blacks, bloom, square |
| Tungsten night | colour | CineStill 800T street work | teal shadows, red halation, grain |
| Zone system | mono | Ansel Adams | red-filter mix, full scale, clarity, 4:5 |
| Decisive moment | mono | Henri Cartier-Bresson | neutral mix, soft grain, black border, 3:2 |
| Genesis | mono | Sebastião Salgado | deep blacks, glowing highlights, heavy grain, vignette |
| Are bure boke | mono | Daido Moriyama | blown whites, crushed blacks, soft focus, coarse grain |
| Rolleiflex square | mono | Vivian Maier | gentle contrast, fine grain, square |
| Geometry of light | mono | Fan Ho | hard contrast, crushed darks, warm paper, square |
| Platinum | mono | Irving Penn's platinum prints | long scale, warm brown blacks, wide white border, 4:5 |

Plus Cut-out (graphic), Blobs and Detect (vision) from phase 1. Cut-out can
apply any look first.

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

Phase 2 (film engine, 18 looks, look strip with live thumbnails, collapsible
controls) built and verified the same way on a sample of looks plus Cut-out and
Detect, locally and on the live GitHub Pages site.

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
