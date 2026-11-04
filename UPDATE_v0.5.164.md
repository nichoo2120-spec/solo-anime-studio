# Solo Anime Studio v0.5.164 – emergency responsiveness recovery

## Status
Reverted the **unverified v0.5.163 lower-layer idle cache reuse** because the user reported that the brush and mouse became unusably laggy. This is a corrective rollback to the earlier v0.5.162 display pipeline, **not** a claim that the overall animation app meets the performance goals. Full browser validation is pending.

## Files changed
- `src/engine/StudioEngine.ts` — disable the v163 canvas-sized `capture()` during idle frames and full-resolution `restore()` on each idle render. The original active-stroke caching remains, as does the v161 pixel-parity-safe rendering path.
- `src/engine/DrawingFrameCache.ts` — revert v163's reuse of cached pixels across unrelated project snapshots, retaining v159's strict same-snapshot check.
- `src/core/buildInfo.ts`, `package.json` — bump to v0.5.164.
- `scripts/check-freeze-recovery-v164.cjs` and `tests/regression/performance-v164.cjs` — new dependency-free regression guards.
- `tests/fixtures/performance-v164-revisions.json` — record source version history without altering protected visual golden fixtures.
- `tests/regression/performance-v157.cjs` through `performance-v163.cjs` — make all historical guards verify the v164 revision chain.
- `CHANGES.md` — record this release.

## Verification completed
- `npm run test:freeze-recovery`: 20/20 lightweight guards PASS.
- `npm run test:warm-cache`: 20/20 mock cases PASS.
- `npm run test:raster-cache`: 20/20 mock cases PASS.
- `npm run test:warm-performance`: PASS (explicitly verifies the v163 idle-capture path is retired).
- `node tests/run-regressions.cjs`: **67/67 PASS** (historical source guards + new rollback guard, but not full browser pixel goldens).
- `typescript.transpileModule`: 0 syntax diagnostics for the three updated engine/version modules.
- `src/engine/StudioEngine.ts` and `DrawingFrameCache.ts` are byte-identical to the v0.5.162 files; no brush-appearance code changed.

## Test limitations
Source regressions are **not** proof of performance. There is no verified v164 Chromium parity, p95 frame, pen-up, undo or real pen measurement. `dist/` is the older compiled v0.5.158 release and the Windows launcher rebuilds the v164 source when npm packages are available. The entire package is supplied as a full ZIP, with no separate patch file. Mix mode remains untouched.
