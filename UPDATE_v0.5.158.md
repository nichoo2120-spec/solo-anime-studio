# Solo Anime Studio v0.5.158 — Drawing performance follow-up

Continues the remaining lag work from v0.5.157. The five runtime files changed are listed below. Preset names, brush settings, pigment equations, pressure response, project format, UI and drawing geometry are preserved. Performance measurements and their limits are in `validation/v158-performance-results.md`.

## Problems found and corrections

1. **Cached-background compositing:** CPU profiles show substantial time in Canvas restore/compositing operations. The drawing prefix used the non-default `copy` blend mode on every growing stroke frame. It now clears the same integer device-pixel rectangle, then uses normal source-over to blit onto transparent pixels. Transparent prefix pixels and fractional page edges remain exact. The fixed left scanline origin is retained; this update does not reintroduce the previous tight-clip pixel errors.
2. **Oversized Pencil updates:** the growing graphite path was padded by a full brush size on every side, although its maximum round contact radius is half the size. The changing curve/taper window is unchanged; only its empty surrounding area is reduced. Mask copying, graphite finishing and display invalidation process less empty paper. Existing saved Pencil rendering is unchanged.
3. **Dry Ink/Dry Paint capsule scanning:** a thin diagonal bristle segment previously examined its entire axis-aligned box. Each scanline now uses a conservative bound around the portion of the segment that can touch that row. The original distance, coverage, pigment mass and tone calculations are unchanged. An extra pixel guards floating-point boundaries; near-horizontal segments keep the original bound.
4. **Document canvas cleanup:** clearing a renderer dropped native layer/scratch references without explicitly releasing their large backing surfaces. Owned native canvases now reset their dimensions when cleared. This avoids retaining those buffers until garbage collection after reloads and provisional Pencil completion. Exports own separate composed surfaces.

## Changed runtime files

- `src/engine/DrawingFrameCache.ts`: integer-pixel prefix restore without copy blending.
- `src/engine/liveRaster.ts`: graphite contact-radius bounds for growing strokes.
- `src/engine/dryBristleV3.ts`: conservative scanline bounds for bristle capsules.
- `src/engine/renderer.ts`: explicit release of owned native layer/scratch surfaces.
- `src/core/buildInfo.ts`: v0.5.158, renderer revision 44.

`package.json`, `README.md`, tests, recorded source-revision guards and documentation are updated. `CHANGES.md` indexes the exact file/line changes. Historical expected output hashes and earlier revision records were not regenerated.

## Correctness verification

- 385 unit tests and 63 regression scripts pass; TypeScript and the production build pass.
- A property test compares the actual optimized capsule integrator with a frozen, independently copied v157 implementation for 1,000 seeded cases. Optical mass and tone arrays are identical, including reverse, nearly horizontal, subpixel, clipped and pre-covered segments.
- Same-browser v157/v158: 90 Pencil/Dry cases across six brush sizes, three paths, pressure variation, taper and light/dark colors match exactly. This includes 1,170 growing-stroke frames and 90 canonical finished renders.
- 520 historical brush cases, 12 saved v147 strokes, six legacy Blender/dry cases and saved-stroke determinism match the unmodified v157 renderer on the same browser.
- All 38 live-display/full-redraw cases pass with zero channel differences, including DPR1/2, zoom, mixed-layer blending, mirror, rotation, page edges and resize.
- Two native 4096×2304 display cases retain their prefix cache and match a full redraw exactly.
- 22 actual engine commits match a fresh canonical render. The 48 existing blending-worker cases remain pixel-exact with zero main-thread reads on that path.
- Seven large history cases and 20 undos/20 redos preserve exact pixels. Pending-result ownership, clear/export/fallback and history eviction checks pass.
- Production UI checks pass for brush controls, pressure/velocity capture, custom preset persistence, mirror, Undo/Redo and save/reload. The 24-frame animation check preserves adjacent drawings, onion skin and frame switching.
- React instrumentation still observes zero pointermove commits in seven tested brush families; the four worker blending families retain zero main-thread move readbacks.

## Performance measurement

CPU profiles were used to locate work, not as acceptance timings. A separate comparison uses identical five-sample batches for 40 move frames per stroke, avoiding the earlier diagnostic's sparse-frame p95 problem. The existing coalesced-input project diagnostic is also compared separately. Reported timing tables use the median of three runs per case, with the same local browser and sequential timing jobs.

The author's original `sas_b15_out` CDP harness and exact busy/busy10 projects are still unavailable. These shipped-project diagnostics do not certify that missing 30-case acceptance matrix. See the measured tables for gains, regressions and unmet targets; no hardware Wacom/iMac/Radeon latency claim is made.

## Delivery and limits

The complete project includes the matching production build, tests, raw results and a file/line change index. Extract into a new folder, launch normally and check **Help → About → 0.5.158**. The v157 archive is preserved and its saved checksum is verified. The packager derives the filename from the versioned folder and validates a temporary ZIP before replacing the new archive atomically.

This remains the existing Canvas renderer, with its original safe mirror, rotated-view and unsupported-worker fallbacks. The first/full settled frames, separate layer blend operations, canonical finishing and history eviction fallback can still cost more than one frame. This update does not claim that every brush and hardware configuration is lag-free.
