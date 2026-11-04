# Solo Anime Studio v0.5.161 — Step 1.1b: first-frame compositor-source fix

**Scope: bug fix only. Not a full lag-fix release; not a verified Chromium parity pass.**

## Root cause reported by the 31 Oct 2026 independent browser run

At DPR 1, the first live frame intermittently differs from the synchronous full redraw by up to 7/255 in around 3,300 background pixels, spread over the page. The `RasterSceneDisplay` worker's precomposited `ImageBitmap` and the ordinary layer-by-layer Canvas 2D path use different rounding. Asynchronous worker completion chooses which path appears in a frame. Disabling the worker composite in the independent report passed 10/10 DPR-1 test runs.

## Fix in this release

- `src/engine/RasterSceneDisplay.ts`: **editing** `paint()` now always returns `undefined` for the normal `allArtwork=false` instance before scheduling worker compositing, so StudioEngine uses the *same canonical per-layer composition* on every normal editing frame. This removes the worker/main-thread source switch (rather than choosing randomly based on worker timing). The separate `allArtwork=true` navigation thumbnail compositor and navigation UI remain intact. Worker raster compositing for editing can only be re-enabled after real byte-by-byte pixel parity is demonstrated.
- `src/engine/DrawingFrameCache.ts`: revert v160's ineffective `idleWarmSinceGesture` invalidation, keeping the v159 same-project-snapshot identity guard. Warm prefixes now use the stable canonical layer source. No brush raster algorithm is changed.
- `src/core/buildInfo.ts` and `package.json`: version 0.5.161. Renderer generation is unchanged at 44; source changes do not adjust the saved-stroke format.
- `tests/raster-scene-parity-v161.test.ts`: Vitest unit assertions (not executed here) that the normal editing compositor does not choose/schedule a worker bitmap for either DPR 1 or 2 and that the separate thumbnail path is still available.
- `tests/drawing-warmup-v160.test.ts` and `scripts/check-warmup-v160.cjs`: update expectations to the revised safe canonical warm-cache strategy; keep project-snapshot invalidation tests.
- `scripts/check-raster-v161.cjs`: dependency-free isolated runtime guard at DPR 1 and DPR 2. These mock objects do **not** verify actual app pixels.
- `tests/fixtures/performance-v161-revisions.json`, `tests/regression/performance-v157.cjs`, `tests/regression/performance-v158.cjs` and new `tests/regression/performance-v161.cjs`: record chained revisions, leaving all historical revision fixtures and frozen image/hash expectations untouched.
- `CHANGES.md`: scope, test and version index.

## Verification carried out here

| Check | Result | Notes |
|---|---|---|
| Regression scripts | **PASS 64/64** | `node tests/run-regressions.cjs`, see `validation/v161/regressions.log`. All historical fixture hash guards retained. |
| Editing compositor isolated guard | **PASS 20/20** | 10 mock runs at each DPR; not real PNG comparison. |
| Warm cache isolated guard | **PASS 20/20** | 10 mock runs at each DPR; not real PNG comparison. |
| Syntactic TS transpilation | PASS 5/5 changed source/test files | Not a full TypeScript type-check. |
| Source scope | PASS | 183 source files identical to v160; only three source files changed; no old fixture JSON modified. |
| TypeScript type-check / Vitest / Vite build | **BLOCKED** | `node_modules` unavailable here; `npm install` failed with `getaddrinfo EAI_AGAIN registry.npmjs.org`. |
| Real browser `drawing-v157-parity`, `drawing-v155-parity` x10 each at DPR 1/2 | **NOT RUN** | Latest source could not be built; `sas_harness.zip` not included. |
| 520 dry goldens, v147 strokes, compatibility, old-version and live=final browser pixels | **NOT RE-RUN** | Independent test of v160 reported byte-identical hashes; source brush renderers unchanged in v161. Do not claim a new byte-for-byte browser validation. |
| 281-stroke / 10-layer CPU 4x perf, pen-up, undo and frame-time targets | **NOT RUN** | Build/harness unavailable. No claim the lag targets were reached. |

## Remaining gating issues

First obtain **10 consecutive passes each** in real Chromium for `tests/drawing-v157-parity.mjs` and `tests/drawing-v155-parity.mjs`, with `PARITY_DPRS='[1]'` and then `'[2]'` as separate groups; verify all browser goldens. Because the canonical layer-by-layer rendering may cost more work than worker compositing, benchmark before claiming a performance improvement. Then proceed to Step 1.2 (pen-up), undo, live drawing and finally Mix mode. Nothing related to Paint mode, old Blender strokes, or the tool wheel was changed here.

## Installing / launching this *complete source* package on Windows

Extract the ZIP into a **new folder** (not on top of the old project), then run `START SOLO ANIME STUDIO.bat`. That script installs dependencies on first use and builds from the current source before previewing the app. The historical `dist/` in this package is still **v0.5.158**; the starter explicitly compares the source digest and forces a fresh build. Do not open the old `dist/index.html` to test this fix. If npm cannot access the registry, it must be run on a computer with Node.js and internet for the first setup.
