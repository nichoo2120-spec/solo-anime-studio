# Solo Anime Studio v0.5.163 — Phase 2, canonical lower-layer cache reuse (partial)

**Status: performance optimization implemented, not performance-certified.** This is a complete project archive, not a patch. The verified v0.5.161 fix to the asynchronous first-frame source switch is preserved. Mix mode is untouched.

## Changes

- `src/engine/StudioEngine.ts` — during an idle frame with Brush/Eraser selected, capture the below-active-layer pixels *before* the active layer is drawn. Those pixels are generated using the existing canonical, main-thread Canvas 2D composite. On later idle or active-stroke frames, restore that exact prefix instead of repainting lower layers. No raster worker, new blending operation or brush algorithm is introduced.
- `src/engine/DrawingFrameCache.ts` — permit reuse of the cached lower-layer prefix when undo, redo or a new stroke changes only the active layer, but only when renderer, revision, size, DPR, view, target index, project settings, and **all lower-layer object identities** match. If a lower layer or view changes, invalidate as before. Other project changes are rejected if the target has no lower layers.
- `scripts/check-warm-performance-v163.cjs` — new focused 20-case cache-eligibility test and source-wiring check.
- `tests/fixtures/performance-v163-revisions.json` and `tests/regression/performance-v157.cjs` through `performance-v163.cjs` — versioned SHA chain, with protected brush-golden fixture files unchanged.
- `package.json`, `src/core/buildInfo.ts` — version 0.5.163.

## Verification performed here

- `npm run test:warm-performance` with globally available TypeScript via `NODE_PATH`: PASS, 20/20 mock cases across DPR 1 and 2.
- `npm run test:warm-cache` with globally available TypeScript: PASS, 20/20 mock cases.
- `npm run test:raster-cache` with globally available TypeScript: PASS, 20/20 mock cases.
- All five standalone historical revision guards (v157, v158, v161, v162, v163): PASS.
- Standalone TypeScript transpilation of the three changed TS modules: PASS (zero syntactic diagnostics).
- Full regression runner **did not finish within the available execution window**, so it is **not a pass**.
- `tsc -b`, Vitest, Vite build and the user-provided Chromium parity/performance harness: **not run successfully** because npm dependencies are unavailable and registry download is blocked. The current `dist/` is an older build and the Windows launcher will rebuild from source after dependency installation. No new browser FPS, undo/pen-up or hash measurements are claimed.

## Performance before vs after (ms)

| Target | v0.5.161 previous real-browser baseline | v0.5.163 newly measured | Goal |
|---|---:|---:|---:|
| Frame p95 | 33–183 | Not measured | <=20 |
| Pen-up | 141–421 | Not measured | <=50 |
| Undo | ink30 busy 235; busy10 306 | Not measured | <=190 / <=175 (Phase 2) |
| First frame DPR 2 | ~200–300 | Not measured | <=270 |
| Longest task | 172–391 | Not measured | <=50 |
| Pencil/solid readbacks | 12–24 / stroke | Not measured (unchanged code) | 0 / move |

**No claim of completed lag fix.** Do not proceed to Mix before full visual parity (40/40 real browser), TypeScript/Vitest/build, and performance benchmarks pass. Preserve the existing tool wheel and Paint brush pixels.
