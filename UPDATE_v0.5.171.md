# Solo Anime Studio v0.5.171 — Mix drag-region and worker recovery repair

This release targets **unnecessary live Mix work**, without changing Paint brush geometry, historical brush renderers, saved stroke formats or the tool wheel.

## Targeted changes

- `src/engine/liveBlend.worker.ts`: during live native Mix strokes, process and transfer only the latest renderer-reported dirty area. Preserve the union of provisional areas for the **final** canonical render to clear old live pixels safely. When a brush renderer cannot identify the changed area, it conservatively uses full stroke bounds: those media can still lag.
- `src/engine/StudioEngine.ts`: while a worker is processing and no new bitmap is available, do not turn that absence into a full-canvas dirty rectangle. Retain normal full redraw when no valid worker is active.
- `src/engine/LiveBlendWorker.ts`: instead of permanently disabling the worker after a failure, attempt bounded recovery on a subsequent Mix gesture (two failures maximum before staying on fallback). The active failed stroke may still use synchronous fallback; this is not a complete latency fix.
- Updated the **precompiled offline application modules** for all three source files, plus version and launch label, so the Windows launcher does not rebuild or install dependencies.

## Validation

- Isolated headless Chromium worker simulation (deterministic stand-in for geometry rasterization): 44 native Mix updates transferred 121,264 rectangle-pixels under the v170 growing-area worker versus 27,352 under v171, a 77.4% reduction. Final rendered colour at the inspected boundary and changed-pixel count matched. This is **not** full production Studio or Wacom performance validation.
- Check `tests/mix-worker-dirty-v171-browser.py` for reproduction. Full project/performance suite may still have historical version/hash guard failures.
- The original Paint brush rendering files, stored brush presets, undo semantics, and historical Blender compatibility are not modified by this change.

## Known limitations

- If a renderer reports no incremental dirty rectangle, it still uses the full stroke bounds.
- Very large projects can still stall on full-canvas snapshotting at pen-down and canonical synchronous rendering after an unfinished worker result.
- The Mix pigment algorithm is still shared across media and does not fully simulate watercolor, dry media and oil transport.
- The offline launcher needs Node.js. New startup should not need `npm install` or Vite.
