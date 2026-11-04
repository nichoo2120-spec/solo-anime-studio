# Solo Anime Studio v0.5.155 — Performance P1

**Date:** 30 October 2026 (IST). **Baseline:** v0.5.154. **Scope:** the first performance phase in `MASTER_REPORT_v2.md`.

The master report says to work one phase at a time. This release implements **P.1: cached layers and changed-area drawing presentation**. It preserves the approved brushes and workspace. **It does not complete the entire performance roadmap or eliminate all lag.** P.2 (small wet-smudge readbacks) and P.3 (classic Blender, pen-up/undo and ink startup) remain open. Blender appearance tuning and the other roadmap stages are deferred.

## Result

The common drawing display is cheaper at normal CPU speed. In the production-app fixture, median composition cost changes from **19.0 → 3.5 ms for Pencil**, **18.9 → 2.6 ms for Solid Paint**, and **20.9 → 7.5 ms for Dry Ink**. Their median drawing frame time is now about 16.7 ms in that run.

The 4× CPU stress case still has substantial stalls. Classic Blender has worse p95 in this sample; Pencil p95 at CPU 4× also worsens. These are recorded below, not hidden behind the median improvement. The app should not yet be described as universally smooth.

**Safety:** 38 actual live display cases / 494 snapshots match a forced full redraw **pixel-for-pixel**; maximum raw RGBA difference is 0. All 520 historical brush goldens, six frozen Blender/dry outputs and saved dry compatibility checks pass. Brush renderers, stroke metadata, presets, geometry/input code, canonical rendering and UI files are unchanged.

## Cause and implementation

The existing engine already retains stroke masks and layer bitmaps, but the main drawing canvas was cleared and recomposited in full while a pen moved. Stable layers were scaled/blended again even when only a small tail changed. At DPR 2, multiple display-sized ink surfaces could also evict each other from the existing 64 MiB ink cache.

The new `DrawingFrameCache`:

1. Captures the exact composited pixels below the active layer at display resolution.
2. Retains independent upper ink surfaces before their layer opacity/blend operation. This prevents the upper layers from evicting the live ink cache. Multiply/screen and layer opacity still operate against the current painted pixels; upper layers are not flattened into an incorrect transparent group.
3. Prepares snapshots from ink that the ordinary idle render has already produced. It does not run an idle render loop. Unchanged static layers can survive an active-layer-only commit.
4. Restores and recomposites only the changed device-pixel region during ordinary unrotated drawing. The rasterizer's dirty footprint is used when available. Native ink conservatively includes the old/new stroke footprint so changes to end tessellation cannot leave stale pixels.
5. Invalidates for project/layer content, renderer revision, viewport, DPR and camera changes. Load/dispose releases the new surfaces. Its prefix is limited to 32 MiB and the combined snapshot cache to 64 MiB; unsupported larger cases use the original rendering path.

Two visual safeguards were required by actual image comparisons:

- At fractional scales, native Canvas bitmap sampling changes phase when its left clip edge changes. The optimized update keeps the scanline origin fixed and updates a horizontal band rather than shifting the sampling phase. Filtering, zoom resolution and stroke geometry remain unchanged; no blur was added.
- Rotated page edges acquired small coverage differences under cached copying/clipping. Rotated drawing uses the original full rendering path. Mirror drawing, selections/transforms and active navigation also retain their original paths. Their correctness is tested, but this phase does not promise a speed-up for those paths.

The `InkDisplay` addition is a two-line borrowed-surface accessor. Copies are made immediately, so an evicted or reused ink canvas cannot silently change the retained snapshot. No ink/dry/watercolor/smudge deposition algorithm was edited.

## Production measurements

The report's separate detailed performance prompt and profiling scripts were referenced but not included among the available attachments. This release uses a new reproducible production-app harness grounded in the master report's setup. The numbers below are **paired v154/v155 runs of that harness**, not a claim to reproduce the author's exact timings.

- Viewport: 2048×1152; DPR 2; Chromium 133; software canvas (`--disable-gpu`).
- Project: 1920×1080, 281 deterministic saved strokes on six layers (90 colour, 150 ink, 41 pencil).
- Input: 200 pen samples over one second, with varying pressure, delivered coalesced at animation frames.
- Both normal CPU and CDP 4× slowdown were exercised. Timed jobs ran alone.
- Frame values are rAF intervals during input, excluding the first interval. Composition values come from the existing `compositionAndOverlaysMs` profiler and include render work around pen-up; they are submission timings, not display scanout latency.
- These are single runs per case, with different observed frame counts as the app falls behind. Cold setup, worker completion and batching affect the tails. They are observations, not confidence intervals or universal speed guarantees.

All values below are milliseconds, **v154 → v155**. Frame counts are **v154 / v155**.

### CPU 1×

| Brush | Composition median | Frame median | Frame p95 | Frames |
|---|---:|---:|---:|---:|
| HB Pencil 70 | 19.0 → 3.5 | 33.3 → 16.7 | 50.1 → 33.4 | 29 / 51 |
| Technical Ink 70 | 161.4 → 11.7 | 166.7 → 16.7 | 416.6 → 166.7 | 5 / 28 |
| Dry Ink 150 | 20.9 → 7.5 | 50.0 → 16.7 | 66.7 → 66.6 | 22 / 39 |
| Solid Paint 70 | 18.9 → 2.6 | 33.3 → 16.7 | 50.0 → 33.4 | 30 / 51 |
| Smudge Bristle 30 | 29.9 → 7.1 | 50.0 → 16.7 | 66.7 → 50.1 | 22 / 47 |
| Classic Blender 30 | 86.3 → 61.9 | 100.0 → 83.4 | 133.4 → 266.6 | 12 / 10 |
| Hard Eraser 70 | 180.1 → 11.1 | 216.6 → 16.7 | 466.6 → 150.0 | 4 / 25 |

### CPU 4× stress

| Brush | Composition median | Frame median | Frame p95 | Frames |
|---|---:|---:|---:|---:|
| HB Pencil 70 | 105.1 → 30.2 | 200.0 → 283.2 | 299.9 → 350.0 | 5 / 5 |
| Technical Ink 70 | 759.7 → 680.9 | 1900.0 → 1699.9 | 1900.0 → 1699.9 | 1 / 1 |
| Dry Ink 150 | 100.1 → 49.1 | 266.7 → 216.7 | 316.7 → 316.7 | 4 / 5 |
| Solid Paint 70 | 129.2 → 16.9 | 266.7 → 100.1 | 300.0 → 299.8 | 4 / 9 |
| Smudge Bristle 30 | 250.2 → 176.4 | 299.9 → 233.3 | 333.3 → 299.9 | 4 / 5 |
| Classic Blender 30 | 985.4 → 1123.1 | 266.7 → 300.1 | 1049.9 → 1399.9 | 3 / 3 |
| Hard Eraser 70 | 849.3 → 696.0 | 2133.2 → 1749.9 | 2133.2 → 1749.9 | 1 / 1 |

These stress results do **not** meet a general smooth-drawing target. In particular, classic Blender remains problematic and its p95 worsens in this run. The source of each individual tail spike was not established. Its renderer is byte-identical; the original per-dab/replay work remains, and the new display snapshots add bounded copying. P.2/P.3 and repeated end-to-end stress measurements are still necessary.

`validation/v155-before-app-performance.json` and `v155-after-app-performance.json` retain per-case frame counts, p50/p95/max, render/raster/geometry timings, readback counts, pen-up and undo observations. Readback counts do not measure the cost per call and vary with the number of rendered frames. This phase does not claim to remove smudge readbacks or improve every pen-up/undo case.

`performance_v155.png` shows the normal-CPU measurements, including the classic Blender p95 regression. The full 4× results are above.

## Visual and regression verification

| Check | Result |
|---|---|
| `npx tsc -b` | PASS |
| `npx vitest run` | 369/369 tests, 70 files PASS |
| `npm run -s test:regression` | 60/60 scripts PASS |
| Production Vite build | PASS; served build/source digest verified by the UI test |
| Actual live display vs forced full redraw | 38 cases, 494 snapshots, raw RGBA max difference 0 |
| Historical brush goldens | 520/520 byte-identical |
| Saved v147 dry outputs | 12/12 byte-identical |
| Saved dry v1/v2 | 24/24 + 24/24 byte-identical |
| Classic Blender revisions + dry frozen v153 outputs | 6/6 byte-identical, including reload |
| Wet-smudge replay/live/final, alpha, controls, seeds and transforms | 64/64 checks PASS |
| Protected v154 input, UI, presets and renderer source | 27 SHA-256 checks PASS |
| Production UI | Pressure capture, presets, custom Mix tips, mirror, Undo/Redo and save/reload PASS |
| Layout/wheel | All 12 tools at 1024×600, 1280×720 and 1920×1080 in Draw/Animate; menu access and wheel park/expand/drag PASS |

The 38 display cases exercise Pencil, Technical Ink, G-Pen, Dry Ink, Dry Paint, Solid Paint, all three wet smudges, both erasers, transparent layer blending, multiply/screen upper layers, page edges, 200% and 800% zoom, panning, viewport resize, an empty bottom target layer and both mirror axes. Rotated and mirrored cases verify the safe fallback. Comparisons use the actual `StudioEngine`: each optimized live frame is captured, its presentation cache is invalidated, and a synchronous full redraw of the same state is captured for comparison. This avoids comparing two different input traces.

The largest new snapshot allocation in these display tests was **33,600,000 bytes**, below the 64 MiB cap. This is the new snapshot cache only, not total canvas/browser memory. The existing overlay memory issue is not addressed here.

### 24-frame animation check

The production app was tested in **ANIMATE**, with **24 drawings, DPR 2, 200% zoom and visible onion skin**, including a 281-stroke active frame. Drawing changes only the current cel; neighboring cels remain unchanged. Undo/Redo and stepping away/back pass, with no runtime errors.

In that normal-CPU test, frame median/p95/max were **16.7 / 33.3 / 50.1 ms**. This closes the report's missing functional animation/onion check for this fixture; it is not a real-tablet or 4× CPU animation stress sign-off.

## Source changes

Line ranges refer to the final v155 source.

| File | Lines | Purpose |
|---|---|---|
| `README.md` | 1 | Current release and report pointer. |
| `package.json` | 4 | Version 0.5.155. |
| `src/core/buildInfo.ts` | 2 | Release 155 / renderer identity 41. |
| `src/engine/DrawingFrameCache.ts` | 1–108 (new) | Bounded lower-scene and upper-ink snapshots, invalidation, pixel-aligned dirty bounds and safe reuse. |
| `src/engine/InkDisplay.ts` | 153–154 | Read-only borrowed-surface getter; the drawing algorithms are unchanged. |
| `src/engine/StudioEngine.ts` | 1, 55–56, 98, 440, 460–471, 474, 476, 487–488, 496–497, 586 | Integrate cached drawing presentation, warm already-rendered upper layers, preserve fallbacks, release caches and expose dirty-pixel timings. |

New tests/support:

- `tests/drawing-frame-cache-v155.test.ts`: invalidation, transformed bounds, old/new footprint union, idle setup and memory fallback.
- `tests/drawing-v155-harness.ts`, `drawing-v155.html`, `drawing-v155-parity.mjs`: actual-engine pixel comparisons.
- `tests/performance-v155-fixture.ts`, `performance-v155-app.mjs`, `performance-v155-chart.py`: deterministic dense scene, production before/after benchmark and chart.
- `tests/drawing-v155-ui.mjs`, `drawing-v155-layout.mjs`, `drawing-v155-animation.mjs`: production controls, layout and 24-cel onion-skin checks.
- `tests/regression/performance-v155.cjs` and `tests/fixtures/performance-v155-*.json`: frozen source guard and replayable fixtures.
- `validation/v155-*`: detailed results and logs. Internal UI screenshots are not release images.

## Reproduce

Install the project's dependencies and Playwright Chromium, or set `CHROMIUM_PATH` to a compatible installed browser. The optional chart requires Python NumPy and Matplotlib.

```sh
npx tsc -b
npx vitest run
npm run -s test:regression
npx vite build --emptyOutDir
node tests/drawing-v155-parity.mjs
node tests/drawing-v155-ui.mjs
node tests/drawing-v155-layout.mjs
node tests/drawing-v155-animation.mjs
node tests/dry-v148-goldens.mjs
node tests/dry-v153-compatibility.mjs
node tests/blender-v154-legacy.mjs
node tests/blender-v154-properties.mjs
```

Run the production benchmark alone. An old extracted project is needed only for a new baseline run:

```sh
PERF_ROOT=/absolute/path/Solo_Anime_Studio_v0_5_154 PERF_TAG=before node tests/performance-v155-app.mjs
PERF_TAG=after node tests/performance-v155-app.mjs
python3 tests/performance-v155-chart.py
```

## Remaining work and limits

1. **P.2:** remove/reduce small wet-smudge per-dab pixel readback and unnecessary replay. No wet-smudge renderer was changed here.
2. **P.3:** classic Blender stalls, pen-up/undo replay and first-ink setup. These remain visible in the stress results; no all-lag-fixed claim is made.
3. Rotated and mirrored drawing use the original presentation path. Their correctness is preserved; further performance work needs equivalent visual proof.
4. Physical Wacom, the iMac/Radeon GPU and Boot Camp drivers were not available. Tests used synthetic pen events and software canvas.
5. Only one new-smudge preset was profiled in the full production performance matrix. All three have correctness/replay checks; performance profiling of all three belongs in P.2.
6. The general 4× CPU responsiveness target remains open. The animation/onion check was at normal CPU speed.
7. The report's later tool/menu cleanup, Mirror OFF/tab clipping, Blender feel tuning and tween/inbetween roadmap were not mixed into this first performance phase. The approved dry-brush appearance remains intact.

The previous v154 archive remains unchanged, SHA-256 `1819125c3857860dc965ec04bbd752af08717e567c53dbf1b4a9ff395d9a2ec0`. The new ZIP contains the complete v155 project, source, tests, fixtures, report and chart, with no `node_modules` or generated `dist`.
