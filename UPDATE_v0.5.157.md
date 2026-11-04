# Solo Anime Studio v0.5.157 — Brush performance

This is a performance test build based on v0.5.156. Brush presets, pigment algorithms, project format, smoothing, stabilization and toolbar layout are unchanged. The production build is included.

**Status: useful engine changes are verified, but the requested lag acceptance targets are NOT all achieved or verified. Do not describe this release as lag-free.** See `validation/v157-performance-results.md` for measured diagnostics and the missing acceptance-harness limitation.

## What changed

### Exact tiled Undo and Redo

The old renderer rejected a history patch above 4 MiB, making broad strokes and padded Dry strokes replay previous operations on Undo. Cold replay also captured new patches while rebuilding. Redo replayed paint again.

History now reserves exact before/after pixels in at most 256×256 native tiles. The per-operation 4 MiB exclusion is removed. Undo and Redo validate the operation prefix and restore integer-aligned tiles. Cold multi-operation replay does not capture new patches. A single cold operation still captures history, preserving the existing incremental API. Cold loaded documents retain a suitable baseline checkpoint.

The combined history/checkpoint/finished-stroke budget is **128 MiB**, reserving both before and after tiles. Evicted history safely falls back to canonical replay; the entire unlimited undo stack is not guaranteed to remain a blit. This budget excludes ordinary layer canvases and other display caches.

### Reuse finished paint and crop Pencil transfers

Modern non-mirrored native paint is finalized using the existing geometry and paint code, composed onto its original layer, then adopted as the native layer result after the immutable operation is committed. The renderer validates the complete operation prefix before adopting. It retains exact before/after history tiles. An incompatible case keeps the existing canonical fallback.

Pencil still receives its canonical final pass from the existing worker. The worker now transfers only the affected rectangle as an ImageBitmap. The main thread retains that bitmap directly instead of drawing and cropping a full-page reply. Its temporary display renderer does not create undo patches. Exports never use provisional Pencil pixels.

### Move blending work off the input thread

Blender, Smudge Bristle, Blender Soft and Wet Mix use a new live worker when the browser supports it. A native source bitmap is taken once; the worker runs the **existing browser Canvas blending algorithms**. One update is in flight and the latest input replaces queued intermediate input. Native result patches are copied back for presentation. The final canonical layer is adopted only after completion.

This removes main-thread per-dab readbacks on the tested worker path. **It does not eliminate Canvas readbacks inside the worker or replace Canvas with an approximate CPU pigment model.** This approach preserves exact browser output. The current returned patch conservatively covers the accumulated stroke box.

Pending paint is distinct from canonical rendering: export, reload and a subsequent stroke cannot pick up a provisional layer. Rapid consecutive input can synchronously settle the preceding paint if its worker is still busy. Unsupported browsers, mirrored painting, errors and worker timeouts retain the existing synchronous path. These fallbacks can still stall. Stale completions are rejected after document changes.

### Retain bounded display caches and avoid unrelated invalidations

The display prefix can now retain up to **128 MiB**, with **256 MiB total** for its prefix and upper-layer ink copies. A native 4096×2304 surface remains cached. Very large device-pixel surfaces can still exceed the cap and use the original rendering path.

Native ink invalidation follows changed cubic segments, adjacent joins and moving end tapers instead of always covering the whole path. A changed start taper retains the conservative full-stroke fallback. Unchanged upper ink copies are also reused on the settled frame after a stroke, preventing a redundant upper-layer rebuild at pen-up. Layer reference/view validation still rejects stale copies. Pure ink surfaces no longer invalidate on an unrelated raster revision; mixed paint prefixes still do.

Idle preparation warms the existing ink/eraser base without a fake stroke. It is canceled when input starts or its document/view becomes stale. Empty selection clearing no longer sends redundant React-facing notifications.

**Preserved accuracy fallbacks:** the first cached drawing frame still uses the original redraw. The left clip origin stays at zero because a tight moving left edge changed native pixels, including integer zoom on a 4K surface. Individual upper-layer blend operations remain separate; flattening multiply/screen layers would change their interaction with new paint. These are remaining performance costs, not completed parts of Phase C.

## Verification

Detailed results and rerun commands are in `validation/v157-verification.md`. Frozen expected output hashes were not rewritten.

- Same browser v156/v157: 520 historical raw/composited cases, 12 saved v147 strokes and six frozen legacy Blender/dry cases match exactly. Saved-stroke repeat rendering is deterministic.
- 48 live blending-worker preview/final cases match canonical RGBA; zero main-thread getImageData calls on that path.
- 22 actual StudioEngine commits, including long Pencil input, match a fresh canonical native render with zero RGBA difference.
- 38 mixed-layer live-display cases at DPR 1/2 match forced full redraw, including zoom, page edges, mirror, rotation, bottom layer and resize.
- Two native 4096×2304 display tests match full redraw exactly and retain the enlarged prefix cache.
- Seven large-stroke Undo/Redo cases match canonical rendering; 20 undos followed by 20 redos preserve exact hashes and use history blits when retained.
- 46 delayed-result, export, history, clear, unsupported-worker and budget-eviction assertions pass.
- Production React instrumentation observes zero commits during pointermove in seven brush families. All four blending families have zero main-thread move readbacks on the worker path.
- Smudge controls, alpha preservation, immutable source, transformations and deterministic reload pass existing rendered checks.
- Production UI checks pass for controls, custom presets, pressure/velocity capture, mirror, Undo/Redo and project reload. A 24-frame animation check preserves adjacent frames, onion skin, frame switching and Undo/Redo.

## Files and compatibility

Runtime source changes: `src/engine/HistoryTiles.ts`, `renderer.ts`, `pencilFinal.worker.ts`, `LiveBlendWorker.ts`, `liveBlend.worker.ts`, `DrawingFrameCache.ts`, `InkDisplay.ts`, `StudioEngine.ts`, plus `src/core/buildInfo.ts` and package version. `CHANGES.md` records changed line ranges, tests, explicit source-hash revision chains and documentation.

The v0.5.156 archive is preserved. Existing saved projects keep format 3 and their original stroke metadata/renderers. No preset or drawing migration is needed.

## Remaining limits

- The author's `sas_b15_out` CDP benchmark, exact busy/busy10 projects, dirty-region checker and live/final harness were not included in the supplied files and were not available in this workspace. Its requested 30-row acceptance comparison cannot be reproduced or certified. No substitute data is presented as that benchmark.
- The shipped app diagnostic is separately labeled, uses synthetic coalesced DOM pen events, and waits separately for final brush workers. It still shows frames and pen-up work over the targets; measured Pencil and Dry Ink frame p95 also worsened in the representative local comparison. These are unresolved performance concerns. A canvas refresh/input latency sample does not prove that a delayed worker has already presented the newest pigment pixels.
- Cached native history blits do not remove the cost of recomposing the complete displayed scene on Undo/Redo. Budget-evicted history still replays.
- Final geometry, canonical native paint finishing, layer copies, software Canvas composition and some worker replies can still exceed a frame. Large/native unsupported or mirrored blending can still block.
- No real Wacom, iMac/Radeon GPU or the user's own hardware was available. Browser Canvas output can differ across browser versions; same-browser before/after output is the preservation criterion.
