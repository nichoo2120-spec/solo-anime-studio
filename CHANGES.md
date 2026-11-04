## v0.5.175 — Less redraw after pen-up, undo and redo

- New `src/engine/commitBand.ts`: when the only change since the last exact frame is pencil/solid strokes added or removed at the end of layers, only the strip of screen those strokes cover is redrawn (same fixed-left-origin clip as live drawing). A repeat render with nothing new repaints nothing.
- Clean ink, smudge, mix and blend strokes, vector layers, rotated views, transforms, selections, mirror and any other project change (camera keys, frames, settings) keep the full redraw.
- New browser test `tests/commit-band-v175.mjs`: every band frame compared with a forced full redraw at DPR 1 and 2 (max difference 0).
- Hash ledger chain extended with `tests/fixtures/performance-v175-revisions.json`; offline bundle regenerated; `check-offline-v175`.
- Brush output byte-identical to v0.5.174.

## v0.5.174 — Scene camera, ported speed fixes, test repair

- New scene camera (CAMERA tab): keys with easing, truck/pedestal/zoom/roll, per-layer multiplane depth, frame/safe-area/field-guide overlay, drag-to-truck, preview, saved in projects, PNG sequence export through camera.
- Ported v0.5.162 editing-scene snapshot and tool-wheel offset.
- Updated 7 old preset tests to the v0.5.166 Blender; shared hash ledger for 11 old regression scripts.
- Offline bundle regenerated; check-offline-v174.
- Brush/Mix output byte-identical to v0.5.173.

## v0.5.172 — Repair offline startup

- Fixed `offline/src/main.js` importing nonexistent `./styles.css` as a JavaScript module; stylesheet remains linked in `offline/index.html`.
- Updated Windows launcher version title and added import-graph preflight to stop invalid offline builds before displaying READY.
- Added a visible browser startup status/error message and release-specific offline smoke test.
- Preserved all v0.5.171 brush/mix renderers, toolbar UI, saved project compatibility and offline vendor assets.
- **Limitation:** Full Windows/Chromium interaction cannot be executed in this environment; the fixed CSS import, asset serving and startup preflight passed isolated checks.

## v0.5.170 — Native-texture Mix mode (replaces generic blender substitution)

- Mix no longer overwrites the selected Pencil/Ink/Paint/Watercolor brush with `color-blender`. Original stroke raster is reused as the mixing coverage mask.
- New per-stroke version (`nativeMixVersion:1`) changes compositing only; old strokes retain the historical renderer and hashes.
- Native local colour averaging only changes pixels inside that exact brush coverage, including dry gap patterns; no selected pigment introduced.
- Worker coalesces live native-mix rasterization and the UI thread avoids drawing the same stroke twice.
- On pen up, the worker regenerates the canonical final mask from the immutable layer to prevent lingering changed-tail ghosts.
- Mix UI advanced controls reduced to the ones this native-mix renderer actually supports: strength and reach.
- Offline precompiled app regenerated; no npm/Vite install/build on Windows startup.

## v0.5.169 — no-install offline startup

- Precompiled the current 0.5.169 application source into 186 browser ES modules in `offline/`; scripts and paint/mix interface load from these assets.
- `scripts/launch-offline.mjs` serves the compiled app through Node built-in HTTP; no package installation, Vite server, or TypeScript production build at launch.
- `START SOLO ANIME STUDIO.bat` uses the offline launcher. `npm start` does too.
- `scripts/check-offline-v169.cjs` validates server startup and assets on a dependency-free machine.
- The old precompiled v159 bundle is used **only as a React 19 / UI icon library** with its old app mount removed. The v169 app logic and Mix UI come from v169 source.
- All drawing engine source files are unchanged from v168 except the version metadata.
- Chromium interaction and Wacom lag remain unverified in this environment.

# v0.5.165: per-project snapshot key-only autosave retention, 30s worker watchdog; brush rendering unchanged.
## v0.5.164 – emergency v163 idle-cache rollback (full project)
- `src/engine/StudioEngine.ts`: remove v163 idle buffer capture/restore to protect pointer/UI responsiveness.
- `src/engine/DrawingFrameCache.ts`: restore strict per-snapshot prefix eligibility; keep v161 parity-safe composite.
- `scripts/check-freeze-recovery-v164.cjs`, `tests/regression/performance-v164.cjs`, `tests/fixtures/performance-v164-revisions.json`: add guards and history chain; protected brush goldens untouched.
- `src/core/buildInfo.ts`, `package.json`, `UPDATE_v0.5.164.md`: new version and full release notes.

## v0.5.163 — canonical warm-prefix cache reuse (partial Phase 2)
- `src/engine/StudioEngine.ts`: capture main-thread lower-layer composite during idle Brush/Eraser frames and reuse in first active-stroke frame.
- `src/engine/DrawingFrameCache.ts`: permit a verified unchanged lower-layer prefix across target-layer-only history changes; invalidate on all other changes.
- `scripts/check-warm-performance-v163.cjs`: 20-case warm reuse and invalidation guard.
- `tests/regression/performance-v157.cjs` through `performance-v163.cjs`, `tests/fixtures/performance-v163-revisions.json`: source revision chain, protected goldens unchanged.
- `package.json`, `src/core/buildInfo.ts`, `README.md`, `UPDATE_v0.5.163.md`: version, usage and verification scope.
- Real-browser parity/benchmarks and full build are NOT VERIFIED in this environment.

## v0.5.162 — Phase 1: portable raster smoke checker
- `scripts/check-raster-v161.cjs:3`: `require('typescript')` instead of a machine-specific `/opt/nvm/...` path.
- `package.json:4`, `src/core/buildInfo.ts:2`: version v0.5.162.
- `tests/fixtures/performance-v162-revisions.json:1`, `tests/regression/performance-v157.cjs:3`, `tests/regression/performance-v158.cjs:1`, `tests/regression/performance-v161.cjs:3-11`, `tests/regression/performance-v162.cjs:1`: maintain immutable golden fixtures and chained source revision checks.
- `sas_harness/`, `exp/{harness.ts,mine.html,dryBristle.ts}`: supplied test harness included for subsequent phases.
- `UPDATE_v0.5.162.md:1`: validation and limitations.

## v0.5.161 — Step 1.1b: editing compositor consistency (not yet browser-verified)
- `src/engine/RasterSceneDisplay.ts:26-36`: canonical layer-by-layer rendering for editing; no asynchronous worker image selection (navigation thumbnails untouched).
- `src/engine/DrawingFrameCache.ts:34-76`: revert unsuccessful v160 warm-gesture invalidation, keep v159 same-snapshot safety.
- `src/core/buildInfo.ts:2`, `package.json:4`: release version 0.5.161.
- `tests/raster-scene-parity-v161.test.ts:1` (new): editing versus thumbnail compositor unit checks.
- `tests/drawing-warmup-v160.test.ts:10-29`, `scripts/check-warmup-v160.cjs:1-34`: align tests with stable snapshot warm reuse.
- `scripts/check-raster-v161.cjs:1` (new): isolated dependency-free runtime smoke.
- `tests/fixtures/performance-v161-revisions.json:1` (new) and `tests/regression/performance-v157.cjs:1-5`, `tests/regression/performance-v158.cjs:1`, `tests/regression/performance-v161.cjs:1` (new): chain source SHA changes without changing historical or frozen fixtures.
- `UPDATE_v0.5.161.md:1` (new): exact status and remaining tests; `validation/v161/*`: test logs.
- 64/64 standalone regressions pass. Full browser parity, TypeScript, Vitest, build, and performance require project dependencies and the missing perf harness; they are NOT claimed passed.

## v0.5.159 (limited source patch, unverified)
- `src/engine/DrawingFrameCache.ts:49-54`: disallow cached prefix reuse across project-snapshot changes to guard against stale first-frame pixels.
- `package.json:4`: bump source package version to v0.5.159.
- `UPDATE_v0.5.159.md`: documents limitations and outstanding lag tests.

# v0.5.158 changes relative to v0.5.157

Line locations refer to delivered v158 files unless marked old. Each changed source/test hunk is indexed. New and generated files are indexed at line 1. Historical golden hashes and previous revision records are unchanged.

Runtime: cached-prefix clear/blit, Pencil contact bounds, Dry V3 capsule scanline bounds, native canvas release and release metadata. See UPDATE_v0.5.158.md for rationale and validation.

## Source, tests and documentation

- `README.md:1`: replace; v157 lines 1–1.
- `UPDATE_v0.5.158.md:1` (new, 45 lines).
- `package.json:4`: replace; v157 lines 4–4.
- `scripts/changes-v158.py:1` (new, 29 lines).
- `scripts/package-smoke-v158.mjs:1` (new, 5 lines).
- `scripts/package-v158.py:1` (new, 19 lines).
- `scripts/report-v158.py:1` (new, 33 lines).
- `src/core/buildInfo.ts:2`: replace; v157 lines 2–2.
- `src/engine/DrawingFrameCache.ts:85–89`: replace; v157 lines 85–87.
- `src/engine/dryBristleV3.ts:166–174`: replace; v157 lines 166–166.
- `src/engine/liveRaster.ts:55–59`: replace; v157 lines 55–55.
- `src/engine/liveRaster.ts:61`: delete; v157 lines 57–57.
- `src/engine/renderer.ts:96`: replace; v157 lines 96–96.
- `tests/drawing-v158-animation.mjs:1` (new, 17 lines).
- `tests/drawing-v158-ui.mjs:1` (new, 32 lines).
- `tests/fixtures/performance-v158-24frames.json:1` (new, 1 lines).
- `tests/fixtures/performance-v158-revisions.json:1` (new, 22 lines).
- `tests/fixtures/v158-deposit-reference.ts:1` (new, 5 lines).
- `tests/performance-v158-app.mjs:1` (new, 35 lines).
- `tests/performance-v158-controlled.mjs:1` (new, 35 lines).
- `tests/performance-v158.test.ts:1` (new, 8 lines).
- `tests/precision-v158.mjs:1` (new, 5 lines).
- `tests/profile-v158.mjs:1` (new, 35 lines).
- `tests/react-moves-v158.mjs:1` (new, 16 lines).
- `tests/regression/blender-v154.cjs:4`: insert; v157 lines 4–3.
- `tests/regression/blender-v154.cjs:8`: replace; v157 lines 7–7.
- `tests/regression/performance-v155.cjs:5–6`: replace; v157 lines 5–5.
- `tests/regression/performance-v157.cjs:3–4`: replace; v157 lines 3–3.
- `tests/regression/performance-v158.cjs:1` (new, 1 lines).
- `tests/sheet-v158.mjs:1` (new, 3 lines).

## Generated build and verification artifacts

- `dist/assets/index-BJdKzHnh.js:1` (old): removed/replaced generated artifact.
- `dist/assets/index-CIH9yT-9.js:1`: generated verification/build artifact.
- `dist/assets/index-Ckto4kzW.js:1` (old): removed/replaced generated artifact.
- `dist/assets/index-DBEZO6J4.js:1` (old): removed/replaced generated artifact.
- `dist/assets/index-aYWEzhyt.js:1`: generated verification/build artifact.
- `dist/assets/index-ki79pGx1.js:1`: generated verification/build artifact.
- `dist/assets/pencilFinal.worker-BcoS0Qx0.js:1`: generated verification/build artifact.
- `dist/index.html:1`: generated verification/build artifact.
- `dist/studio-build.json:1`: generated verification/build artifact.
- `validation/v117-regressions.json:1`: generated verification/build artifact.
- `validation/v157-same-browser.json:1`: generated verification/build artifact.
- `validation/v158-4k.json:1`: generated verification/build artifact.
- `validation/v158-4k.log:1`: generated verification/build artifact.
- `validation/v158-after-brushes.png:1`: generated verification/build artifact.
- `validation/v158-animation.json:1`: generated verification/build artifact.
- `validation/v158-animation.log:1`: generated verification/build artifact.
- `validation/v158-baseline-app-performance.json:1`: generated verification/build artifact.
- `validation/v158-baseline-dry-ink-bristle-150-0.cpuprofile:1`: generated verification/build artifact.
- `validation/v158-baseline-hb-150-0.cpuprofile:1`: generated verification/build artifact.
- `validation/v158-baseline-preservation.json:1`: generated verification/build artifact.
- `validation/v158-baseline-technical-150-0.cpuprofile:1`: generated verification/build artifact.
- `validation/v158-before-brushes.png:1`: generated verification/build artifact.
- `validation/v158-blender-controls-ui.png:1`: generated verification/build artifact.
- `validation/v158-build.log:1`: generated verification/build artifact.
- `validation/v158-clean-build.log:1`: generated verification/build artifact.
- `validation/v158-coalesced-after.json:1`: generated verification/build artifact.
- `validation/v158-coalesced-after.log:1`: generated verification/build artifact.
- `validation/v158-coalesced-before.json:1`: generated verification/build artifact.
- `validation/v158-coalesced-before.log:1`: generated verification/build artifact.
- `validation/v158-coalesced-cpu1.json:1`: generated verification/build artifact.
- `validation/v158-coalesced-cpu1.log:1`: generated verification/build artifact.
- `validation/v158-coalesced-dpr1.json:1`: generated verification/build artifact.
- `validation/v158-coalesced-dpr1.log:1`: generated verification/build artifact.
- `validation/v158-commit.json:1`: generated verification/build artifact.
- `validation/v158-commit.log:1`: generated verification/build artifact.
- `validation/v158-controlled-after.json:1`: generated verification/build artifact.
- `validation/v158-controlled-after.log:1`: generated verification/build artifact.
- `validation/v158-controlled-before.json:1`: generated verification/build artifact.
- `validation/v158-controlled-before.log:1`: generated verification/build artifact.
- `validation/v158-display-parity.json:1`: generated verification/build artifact.
- `validation/v158-display-parity.log:1`: generated verification/build artifact.
- `validation/v158-focused-unit.log:1`: generated verification/build artifact.
- `validation/v158-frozen-goldens.log:1`: generated verification/build artifact.
- `validation/v158-history.json:1`: generated verification/build artifact.
- `validation/v158-history.log:1`: generated verification/build artifact.
- `validation/v158-lifecycle.json:1`: generated verification/build artifact.
- `validation/v158-lifecycle.log:1`: generated verification/build artifact.
- `validation/v158-package.json:1`: generated verification/build artifact.
- `validation/v158-performance-results.md:1`: generated verification/build artifact.
- `validation/v158-precision-after.json:1`: generated verification/build artifact.
- `validation/v158-precision-before.json:1`: generated verification/build artifact.
- `validation/v158-precision.json:1`: generated verification/build artifact.
- `validation/v158-precision.log:1`: generated verification/build artifact.
- `validation/v158-prefix-app-performance.json:1`: generated verification/build artifact.
- `validation/v158-prefix-dry-ink-bristle-150-0.cpuprofile:1`: generated verification/build artifact.
- `validation/v158-prefix-hb-150-0.cpuprofile:1`: generated verification/build artifact.
- `validation/v158-prefix-parity.log:1`: generated verification/build artifact.
- `validation/v158-prefix-technical-150-0.cpuprofile:1`: generated verification/build artifact.
- `validation/v158-profile-baseline.log:1`: generated verification/build artifact.
- `validation/v158-profile-prefix.log:1`: generated verification/build artifact.
- `validation/v158-react-moves.json:1`: generated verification/build artifact.
- `validation/v158-react-moves.log:1`: generated verification/build artifact.
- `validation/v158-regressions.log:1`: generated verification/build artifact.
- `validation/v158-same-browser.json:1`: generated verification/build artifact.
- `validation/v158-same-browser.log:1`: generated verification/build artifact.
- `validation/v158-saved-dry.log:1`: generated verification/build artifact.
- `validation/v158-sheet.log:1`: generated verification/build artifact.
- `validation/v158-tsc.log:1`: generated verification/build artifact.
- `validation/v158-ui.json:1`: generated verification/build artifact.
- `validation/v158-ui.log:1`: generated verification/build artifact.
- `validation/v158-unit.log:1`: generated verification/build artifact.
- `validation/v158-verification.md:1`: generated verification/build artifact.
- `validation/v158-worker.json:1`: generated verification/build artifact.
- `validation/v158-worker.log:1`: generated verification/build artifact.

- `CHANGES.md:1`: this complete change index.

The v157 ZIP is external to this project and is not modified. Full artifact/package checks are recorded in `validation/v158-package.json`.

## v0.5.160 — first-frame cache guard (unverified release checkpoint)
- `src/engine/DrawingFrameCache.ts:38-40,43,62-75`: prevent warmed prefix / upper-ink snapshots serving first stroke frame.
- `tests/drawing-warmup-v160.test.ts:1-40`: add cache-first-frame test cases (not executed with Vitest).
- `scripts/check-warmup-v160.cjs:1-31`: add independently run focused smoke validator (20/20).
- `package.json:3,12`: bump version and add smoke-test script.
- `UPDATE_v0.5.160.md:1`: test scope, limitations and unmeasured targets.
- `validation/v160/*`: evidence logs for attempted checks.

## v0.5.166 — targeted Blender response and colour mixing
- src/engine/gentleBlend.ts (new): version-gated local diffusion for new Blender strokes. Softens neighbouring source colours inside a round brush instead of accumulating a carried-pigment streak; incremental dabs, bounded crop, zero getImageData calls.
- src/engine/liveBlend.worker.ts: v3 worker sends only the latest affected sub-rectangle rather than repeatedly transferring the entire stroke-bounding rectangle. v2 and historical rendering path unchanged.
- src/engine/paintCompositing.ts: dispatch v3 strokes to gentle blending; preserve legacy unversioned and v2 dispatches.
- src/core/brushes.ts: change the stock Blender (future strokes only) to a gentle round v3 preset, and migrate saved stock preset settings without changing project strokes. Historical Smudge Bristle, Blender Soft, Wet Mix presets unchanged.
- src/core/smudge.ts, src/core/model.ts: accept a tagged v3 stroke while retaining old validation and defaults.
- src/ui/BrushStudio.tsx: show local blend Mix control and explanatory hint for v3; retain v2 Hold/Streaks/Add colour controls.
- src/core/buildInfo.ts, package.json: v0.5.166; new check command.
- tests/fixtures/performance-v166-revisions.json, tests/regression/performance-v166.cjs, scripts/check-gentle-blender-v166.cjs: source-chain guards and isolated blend tests; historical golden references not updated.
- Historical performance regression scripts now append v166 file-hash revisions instead of incorrectly treating source changes as unrecorded.

## v0.5.171 — bounded Mix worker updates

- `src/engine/liveBlend.worker.ts`: incremental native-mix frames composite and transfer only the changed tail region; reserve the cumulative union for canonical pen-up correction.
- `src/engine/StudioEngine.ts`: don't default to a full canvas dirty rect when a still-active Mix worker has not produced new pixels; allow one bounded worker restart on later gestures.
- `src/engine/LiveBlendWorker.ts`: worker failure is no longer an irreversible global state after one error; a two-failure circuit breaker prevents unlimited respawns.
- `offline/src/engine/{liveBlend.worker,StudioEngine,LiveBlendWorker}.js`, `offline/src/core/buildInfo.js`: regenerated directly from the corresponding current TypeScript source and versioned as v0.5.171, keeping startup offline.
- `tests/mix-worker-dirty-v171-browser.py`, `tests/mix-recovery-v171.mjs`, `scripts/check-offline-v171.cjs`: focused verification; see `UPDATE_v0.5.171.md` for limitations.

## v0.5.173 — Mix visibility and clean-Ink fast-path fix

Mix now goes through the native Mix compositing path even for fast clean Ink strokes; v2 uses a stronger local filtered colour transition. Older v1 algorithm remains available, and saved version 1/2 strokes validate. Compiled offline JS, launcher, and documentation updated. See UPDATE_v0.5.173.md.
