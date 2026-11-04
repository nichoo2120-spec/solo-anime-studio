# Solo Anime Studio v0.5.156 — Brush responsiveness

**Baseline:** v0.5.155. This update targets the specific costs found during brush-lag profiling. It improves several expensive paths, but it does **not** eliminate all lag. Physical Wacom and iMac testing is still needed.

## What was found and changed

1. The classic Blender copied an increasingly large portion of the stroke into a checkpoint every few dabs. Newer wet smudges also read a separate undo patch for every dab. A bounded rollback cache now saves smaller contact-region patches for groups of dabs, together with the matching pigment state. It retains up to 64 entries and 16 MiB of pixel patches per gesture; if the limit cannot accommodate a patch, the existing source-based replay remains the safe fallback. Canonical one-shot rendering does not create rollback checkpoints.
2. The smudge renderer deposits colour directly into its own work surface; its normal paint mask is unused. The live path avoids creating two unnecessary full-page paint masks for those smudges.
3. On the first Ink or Hard Eraser stroke over painted content, an array copy prevented reuse of the already rendered layer and replayed all underlying paint. Preserving the array identity lets the existing native layer cache serve that prefix.

The pigment calculations, pressure response, stroke geometry, smoothing, stabilization, preset settings and UI are unchanged. The four affected source files have explicitly recorded before/after hashes in the regression guards; the remaining protected brush, input and UI sources retain their original hashes. The changed renderers were compared with frozen v155 images and earlier Blender goldens.

## Production-app measurements

Production app, Chromium 133 software canvas, viewport 2048×1152 at DPR 2, 1920×1080 project with 281 saved strokes on six layers. Each gesture uses 200 synthetic pen samples over one second, coalesced at animation frames with varying pressure. Timed cases ran alone. Values are milliseconds, **v0.5.155 → v0.5.156**, one paired run per case. The count column is the number of observed frame intervals (before / after). Frame values are requestAnimationFrame intervals, not physical pen-to-display latency. Composition is the engine's Canvas submission timing and includes work around pen-up.

| Brush | Frame median | Frame p95 | Composition median | Frames |
|---|---:|---:|---:|---:|
| HB Pencil | 16.7 → 16.7 | 33.4 → 50.0 | 3.8 → 4.6 | 49 / 41 |
| Technical Ink | 16.7 → 16.7 | 183.3 → 83.3 | 14.1 → 10.9 | 21 / 38 |
| Dry Ink | 16.7 → 16.7 | 33.4 → 33.4 | 6.9 → 6.4 | 45 / 48 |
| Solid Paint | 16.7 → 16.7 | 33.4 → 33.3 | 2.8 → 2.8 | 56 / 54 |
| Smudge Bristle | 16.7 → 16.7 | 33.4 → 33.4 | 7.3 → 7.4 | 50 / 48 |
| Blender Soft | 16.7 → 16.7 | 33.4 → 33.4 | 7.2 → 7.3 | 51 / 50 |
| Wet Mix | 16.7 → 16.7 | 33.4 → 33.4 | 7.7 → 8.4 | 49 / 48 |
| Classic Blender | 99.9 → 16.7 | 166.7 → 50.0 | 83.4 → 5.5 | 11 / 49 |
| Hard Eraser | 16.7 → 16.7 | 183.3 → 50.0 | 12.6 → 9.3 | 21 / 41 |

A separate three-run-per-version Pencil check had a median p95 of 33.4 → 33.3 ms. One new-version run still reached 50 ms at p95. Individual runs vary and the Pencil path itself was not changed, so these data do not establish a general Pencil speed-up or rule out a regression on another machine. Pen-up values also vary, and are not all improved.

A 24-frame animation with visible onion skin and 200% zoom was also repeated twice on each version. The before frame medians were 33.3 and 16.7 ms; the after medians were 16.7 and 16.7 ms. All four p95 values were approximately 33.4–33.5 ms. The original separate v156 run also had a 33.3 ms median. Frame rates vary across runs, so neither consistently smooth animation nor a causal regression is established by these samples.

### CPU 4× slowdown

The same fixture was measured under browser CPU throttling. Only three representative brushes were repeated here. These individual cases contain very few observed frames, so they are useful stress warnings, not stable percentiles or an iMac performance prediction.

| Brush | Frame p95 | Composition median | Pen-up wall time | Frames |
|---|---:|---:|---:|---:|
| Technical Ink | 1483.2 → 800.0 | 617.4 → 140.8 | 732.2 → 843.2 | 1 / 5 |
| Smudge Bristle | 399.9 → 349.9 | 212.7 → 172.4 | 384.4 → 337.1 | 4 / 5 |
| Classic Blender | 1516.6 → 350.1 | 497.3 → 164.9 | 351.6 → 303.3 | 3 / 5 |

These figures still show major stalls under the artificial slowdown. In particular, Technical Ink pen-up takes longer in this sample despite lower composition time. More work on pen-up/undo, smudge sampling, and dense or rotated/mirrored displays remains.

### Isolated smudge measurements

A separate fixed-work test ran 160 updates per gesture, three gestures for each preset and size. It includes a full-base copy and a one-pixel completion read per update. The p95 column is the median of the three gesture p95 values. Read counts include those completion reads and are for one complete fixed-work gesture; they should not be directly compared with the production-app frame counts.

| Brush | Size | Update p95 (ms) | Pixel reads |
|---|---:|---:|---:|
| Smudge Bristle | 30 | 3.4 → 3.3 | 1899 → 1307 |
| Smudge Bristle | 130 | 3.1 → 3.3 | 1162 → 851 |
| Blender Soft | 30 | 2.7 → 2.9 | 1899 → 1307 |
| Blender Soft | 130 | 3.8 → 3.2 | 1162 → 851 |
| Wet Mix | 30 | 3.0 → 3.1 | 1899 → 1307 |
| Wet Mix | 130 | 2.8 → 2.8 | 1162 → 851 |
| Classic Blender | 30 | 4.9 → 2.2 | 1031 → 1307 |
| Classic Blender | 130 | 4.5 → 2.6 | 664 → 851 |

The newer smudges still read the sampled colour at each contact; they are **not** readback-free. Classic Blender now performs more small grouped patch reads in this test, but avoids repeatedly copying the whole growing stroke. Results vary by browser, device and artwork.

## Verification

- TypeScript and production Vite build: PASS.
- Unit tests: 375/375 in 72 files; regression scripts: 61/61.
- 64 actual v155/v156 Blender renders: canonical images identical, including 12–500 px, straight/curved paths, pressure and transparent/opaque layers. Incremental replay and backward tail edits also match the canonical output pixel-for-pixel in these cases.
- 64 wet-smudge checks cover live/final replay, reload, transparency, controls, seeds and transformed contacts; six frozen v153 Blender/dry outputs remain byte-identical.
- 38 live display cases compare actual engine output to a forced full redraw: all captured RGBA pixels match. Includes Pencil, Ink, Dry Ink, Dry Paint, Solid Paint, smudges, both erasers, different zooms, rotated/mirrored fallback, and layer blends.
- 520 historical brush goldens and 12 saved v147 dry strokes match exactly.
- Production UI exercised pressure and velocity capture, settings, custom tips, mirror, Undo/Redo and project reload. The 24-frame animation/onion-skin check covers current-cel isolation, history and frame stepping.

`blender_v156_comparison.png` contains actual rendered before/after examples; the purpose is to check preservation of the existing appearance. `performance_v156.png` charts the single normal-CPU runs. Detailed raw timings and test logs are under `validation/`. The older v155 archive remains separate.

## Files changed

- `src/engine/SmudgeRollback.ts`: bounded grouped rollback patches and state.
- `src/engine/wetSmudge.ts` and `src/engine/bristleSmudge.ts`: use grouped rollback during live blending and skip unneeded canonical checkpoints.
- `src/engine/LivePaintingRaster.ts`: skip unused smudge masks.
- `src/engine/InkDisplay.ts`: reuse the full existing paint-layer prefix.
- `src/core/buildInfo.ts`, `package.json`, and `README.md`: version and release information.
- New v156 tests, frozen v155 smudge expectations, source-revision guards, benchmark scripts, results and this report. The inherited source guards retain explicit before/after hashes for the two deliberately optimized Blender files.

## Remaining limits

The wet-smudge sampling path still performs per-contact reads; low-opacity blending also needs region reads. Heavy projects, large surfaces, rotated/mirrored views, and pen-up or undo can still stutter. Synthetic pen input and software rendering cannot establish the actual latency on a 2017 iMac or Wacom tablet. The brush appearance was intentionally preserved; this is a performance update rather than a Blender appearance redesign.

## Reproduce

Install dependencies, then run `npx tsc -b`, `npx vitest run`, `npm run -s test:regression` and `npx vite build`. Browser checks require Playwright Chromium or `CHROMIUM_PATH`. Run the scripts `tests/smudge-v156-visual.mjs`, `tests/blender-v154-legacy.mjs`, `tests/blender-v154-properties.mjs`, `tests/drawing-v155-parity.mjs`, `tests/dry-v148-goldens.mjs`, `tests/drawing-v156-ui.mjs` and `tests/drawing-v156-animation.mjs`. The benchmark scripts are `tests/performance-v156-app.mjs` and `tests/performance-v156-smudge.mjs`; see the scripts and archived JSON for their parameters. For a new paired comparison, provide an unmodified v155 project as `PERF_ROOT` or `COMPARE_ROOT`.
