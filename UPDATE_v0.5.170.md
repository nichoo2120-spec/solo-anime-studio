# Solo Anime Studio v0.5.170 — Native-brush colour mixing and lower pointer-thread work

## Fault confirmed in v0.5.167–169

The Mix button ran the selected brush through `mixifiedBrushSettings()` which overwrote its `brushTip` and `brushKind` to `color-blender` / `coloring-blender`. All brushes were consequently rendered using a generic Blender tip, not their native pencil, watercolor, dry bristle, or flat brush appearance. The normal and blending rasterizers were also both doing work during pointer movement.

## Fix delivered

- `src/core/brushes.ts`: Mix now retains all the **original selected brush settings and renderer identity**. `nativeMixEnabled` is the only new input-mode flag. No presets are deleted from save compatibility; stock Blender-only presets remain hidden from selectable lists.
- `src/engine/StudioEngine.ts`: Native Mix is captured as a versioned property (`nativeMixVersion:1`, `nativeMixAmount`, `nativeMixRadius`) on **new strokes only**, without overwriting `brushKind`, `brushTip`, dry-bristle, watercolor, pencil, texture, pressure or other style settings. This mode bypasses the legacy watercolor Pickup channel. The live stroke raster on the UI thread is skipped while the native Mix worker is available, retaining a synchronous fallback when the worker is unavailable.
- `src/engine/nativeBrushMix.ts` (new): mixes neighbouring pigments only in the exact original brush alpha mask. The source layer is sampled in bounded dirty rectangles, mixed by local Canvas downsample/upsample and applied with `source-atop`, preserving opacity and dry gaps. The selected paint color is **not** deposited. The mix is not the old long-streak smudge.
- `src/engine/liveBlend.worker.ts` and `LiveBlendWorker.ts`: live updates are processed on an existing coalescing worker; main thread avoids the duplicate brush rendering. Final stroke raster is rebuilt off-thread from the source layer and final geometry so old provisional pixels are not retained.
- `src/engine/paintCompositing.ts`: new native Mix compositing branch takes precedence only when `nativeMixVersion === 1`; all old strokes use unchanged branches.
- `src/core/model.ts`: validates the new opt-in stroke version on project load, including parameter limits.
- `src/ui/BrushStudio.tsx`: Mix strength and Mix radius controls, removing misleading legacy Blend controls that this mode did not implement.
- `offline/src/**`: **187 modules precompiled from the current v0.5.170 sources**. Node.js launcher requires no install or build on normal opening.

## Verified here

- 24/24 selectable Pencil, Ink, Paint, Watercolor presets retained the exact ordinary brush type/style metadata in Mix input mode, never `color-blender`.
- 4 retired blending-only preset identities hidden but still present for old project/preset compatibility.
- Chromium Canvas component test on an isolated mask: red/blue mix into intermediate colors; no selected green introduced; unchanged outside mask; dry mask gaps preserved; amount=0 unchanged; 25% has smaller change than 100%; alpha unchanged. This test **does not** load the full Studio app.
- 20/20 isolated raster/cache checks and 20/20 cache warmup checks passed (mock environments; not full-browser parity).
- Offline startup test served 12 required files with HTTP 200, missing files HTTP 404, and no npm install. The compiled App module loaded with a lightweight DOM stub; full UI interaction was not verified.

## Not verified and known limits

- Full Solo Anime Studio browser render, tablet latency or responsiveness, frame-rate targets, complete Vitest and production Vite build were **not** verified: the browser navigation here is restricted and the app's normal npm dependencies are not available. This is not a guarantee that the remaining lag is fixed.
- Mixing is texture-footprint-aware **local digital pigment averaging**, not a fully physically simulated wet watercolor/oil diffusion system. Mix radius maxes out to keep per-update image processing bounded. Multiple colors on the active layer can be blended; the algorithm never creates original brush paint when in Mix mode.
- Other unrelated drawing performance bottlenecks may remain. The native mixing worker can fall back to synchronous rendering on browsers that do not support OffscreenCanvas or worker Canvas operations.

## How to start

Close all older Studio windows and terminal sessions so port `5211` is free. Extract the whole ZIP into a new folder. Run `START SOLO ANIME STUDIO.bat` (Node.js required). Verify version badge is v0.5.170. First test Solid Paint, then paint red and blue adjacent on the same layer; switch to Mix on Solid Paint, Dry Ink, Pencil and Watercolor to compare textures. Keep backups of important projects.
