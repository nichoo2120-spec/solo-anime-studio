# Solo Anime Studio v0.5.153 — verified update and remaining limits

30 October 2026 (IST). Baseline: the original v0.5.152 source archive.

**Status:** functional checks pass; drawing and redraw costs are lower. This is **not a complete reference-match or zero-stutter sign-off**. Maximum-size painting and isolated latency spikes remain open.

## A. What changed and why

The old live path regenerated endpoint-dependent noise, pressure and bristle trajectories across a wide tip window on each move. Stable body bounds were also rescanned, live density buffers were discarded between strokes, and unchanged saved strokes rebuilt their pigment buffers on redraw. Those costs explain the slowdown found in the report.

New renderer 3 separates stable contact trajectories from changing release. It caches coherent stroke-space fibre fields and per-bristle release curves, reuses live buffers, updates bounds incrementally, and caches a bounded crop of the saved pigment body. Geometry/settings edits invalidate that crop. Native hairs render in full document coordinates: caching their translated raster introduced a one-pixel coloured loop mismatch, which was found and corrected.

Dry Ink clumps now merge more often through curves, with less forced separation. Fine path-following tapered hairs and local end flecks remain inside the travelled path. Paint keeps its heavier contact character. Paper stays anchored to the document and seeds remain stored with each stroke. Smoothing, stabilization and pressure capture retain their existing algorithms.

## B. Existing drawing safety

New stock Dry Ink and Dry Paint strokes use `dryBristleVersion: 3`. Existing version-1 and version-2 operations keep their original routes; the v1/v2 renderer files and shared paper implementation are byte-identical to v0.5.152. Customized v1/v2 presets keep their versions. The editable project format is still 3. New renderer-3 drawings require v0.5.153 or newer.

This preserves the appearance already shown by v0.5.152. Earlier v148–v151 code had changed version-2 appearance without recording the application minor version per stroke; this update does not reconstruct those older appearances automatically.

## C. Automated and real-app checks

- 347/347 unit tests and 58/58 regression scripts pass.
- Production build and launcher/source-digest checks pass.
- 520/520 old-brush golden cases, 12 earlier saved-v1 goldens, and 24 v1 + 24 v2 independently captured saved strokes match their expected pixels.
- 12 normal-size and 4 maximum-size cases pass deterministic repeat, cache eviction, cold reload and exact live/final comparisons.
- 60 replay/history/pressure/zero-control/mirror checks pass, including geometry edits invalidating the completed body cache.
- Production pen-event tests pass preset switching, captured pressure/velocity, Undo/Redo, mirror and save/reload. PNG exports are pixel-identical at 50%, 100%, 200% and 800% zoom.
- 11 navigation/eraser/zoom/flat-paint/transform browser checks pass.
- Production load at 1280×720 and 1920×1080 has zero page/console errors.

## D. Performance observations

Chromium 133 on Linux, with GPU disabled, on the test host. These are browser observations, not Wacom hardware measurements. Timers include geometry and forced canvas readback. Baseline and update use the same harness. The drawing tests reuse one live raster and canvas, as the app does. The continuous stress run has no frame pauses; the interactive run yields one animation frame between moves. P95 below is the **mean of each stroke’s p95**, not a pooled percentile.

| Test | v152 mean move ms | v153 mean move ms | v152 mean stroke p95 ms | v153 mean stroke p95 ms | v153 worst event ms |
|---|---:|---:|---:|---:|---:|
| Continuous stress, 70/130 px, 80 strokes | 5.10 | 2.28 | 8.18 | 3.82 | 88.00 |
| Continuous stress, 600 px, 8 strokes | 38.24 | 11.41 | 88.14 | 22.76 | 89.60 |
| Frame-paced drawing, all sizes, 24 strokes | 17.93 | 6.49 | 38.29 | 11.95 | 50.00 |

Frame-paced drawing by size:

| Size | v152 mean ms | v153 mean ms | v153 mean stroke p95 ms | v153 worst event ms |
|---|---:|---:|---:|---:|
| 70 | 4.67 | 2.67 | 4.03 | 34.40 |
| 130 | 8.48 | 3.69 | 6.29 | 35.30 |
| 600 | 40.63 | 13.12 | 25.54 | 50.00 |

Long 2400 px stroke, size 130; ten IDs per brush, five fresh-layer redraws per ID. First render and cached redraw are reported separately.

| Brush | v152 redraw mean / worst ms | v153 redraw mean / worst ms | v153 IDs with every redraw ≤120 ms | v153 first-render mean ms |
|---|---:|---:|---:|---:|
| dry-ink-bristle | 102.37 / 172.80 | 20.62 / 83.30 | 10/10 | 132.33 |
| dry-paint | 90.69 / 221.10 | 24.46 / 153.40 | 9/10 | 102.75 |

**Open performance targets:** the strict 3 ms mean-and-p95 target is not met in every case. Maximum-size painting still has visible frame-budget spikes. The final long-stroke run also caught one Dry Paint redraw above 120 ms; this is retained in the results rather than discarded. Typical redraw cost is substantially lower, but neither the stress results nor the first-render costs justify a zero-lag claim.

## E. Visual comparison and retained targets

Inspected the actual before/after sheet, ten-ID sheet, broad overlaps, circular strokes, hooks and maximum-size output. The 240 after audit renders cover ten seeds × two presets × three sizes × straight/curve × slow/fast. Additional exercises cover pressure, colour, flow, vertical strokes, circles, hooks, broad areas and maximum size.

Dry Ink now has finer interrupted channels through curves and more connected end detail. The examples do not show square tiles or detached forward hair clusters. Paint remains heavier. **The output still has more organized longitudinal structure and shorter tails than the photographed ink reference. Very large pressure-varying strokes can expose large clump separations.** Fine-hair, fleck, edge and other reference targets remain unmet; they are not dismissed as a cleaner style selected by the artist.

The supplied `tests/reference/metrics.py` is unchanged; SHA-256 `bca694ce831a227be994c6f4b4a7107c30c6979abf3ee3b31b5085206cafa460`. No target was relaxed. A target passes only when its ten-ID mean is in range and at least eight IDs pass. Four stroke recipes are averaged per ID. The full per-ID data are in `test-output/v153/{before,after}/metrics.json`.

| Size 130 target | Ink v152 → v153 mean (v153 IDs passing) | Paint v152 → v153 mean (v153 IDs passing) |
|---|---|---|
| aniso_gx_gy −∞…0.36 | 0.467 → 0.422 (0/10; OPEN) | 0.438 → 0.369 (5/10; OPEN) |
| gap_frac 0.1…0.3 | 0.164 → 0.196 (9/10; PASS) | 0.059 → 0.095 (3/10; OPEN) |
| perim_ratio_hull 1.5…2.4 | 1.275 → 1.260 (0/10; OPEN) | 1.217 → 1.227 (0/10; OPEN) |
| tail_len_W 0.6…2.6 | 0.601 → 0.688 (9/10; PASS) | 0.438 → 0.569 (4/10; OPEN) |
| midtone_frac 0.28…0.55 | 0.502 → 0.509 (10/10; PASS) | 0.468 → 0.464 (10/10; PASS) |
| dens_ratio_last_first 0.55…1 | 0.793 → 0.800 (10/10; PASS) | 0.844 → 0.837 (10/10; PASS) |
| mean_alpha_hull 0.75…0.85 | 0.764 → 0.731 (2/10; OPEN) | 0.857 → 0.826 (7/10; OPEN) |
| streaks_med 3…6 | 5.662 → 7.575 (2/10; OPEN) | 3.500 → 5.000 (5/10; OPEN) |
| run_thick_med 5…21 | 11.425 → 8.175 (10/10; PASS) | 24.375 → 15.275 (9/10; PASS) |
| period_peak −∞…0.22 | 0.215 → 0.218 (7/10; OPEN) | 0.210 → 0.222 (6/10; OPEN) |
| flecks 30…80 | 5.675 → 22.125 (2/10; OPEN) | 0.950 → 3.450 (0/10; OPEN) |
| hairlines 4…+∞ | 0.000 → 0.200 (0/10; OPEN) | 0.000 → 0.000 (0/10; OPEN) |
| taper_end 0.33…0.78 | 0.609 → 0.697 (8/10; PASS) | 0.594 → 0.634 (10/10; PASS) |

Small sizes (after; means across ten IDs):

| Brush / size | Flecks | Hairlines | Perimeter / hull | Mean alpha |
|---|---:|---:|---:|---:|
| dry-ink-bristle / 38 | 1.77 | 0.00 | 1.146 | 0.532 |
| dry-ink-bristle / 70 | 8.80 | 0.40 | 1.236 | 0.491 |
| dry-paint / 38 | 0.17 | 0.00 | 1.125 | 0.669 |
| dry-paint / 70 | 1.27 | 0.03 | 1.149 | 0.624 |

## F. Toolbar and menu fixes

All 12 inspector tools are visible and hittable at 1024×600, 1280×720 and 1920×1080 in Draw and Animate. Each of the twelve tested shortcuts highlights exactly one button. Tools stay above transform settings. Edit/Animation popups are viewport-bounded, scrollable, keyboard-navigable and their last enabled items are hittable. The existing wheel has a compact left-panel parking row; parking, expanding and dragging pass, and it no longer overlaps the Layers heading by default. User-chosen floating placement remains available.

## G. Changed source files

- `src/core/brushes.ts`
- `src/core/buildInfo.ts`
- `src/core/dryBrush.ts`
- `src/core/model.ts`
- `src/engine/LivePaintingRaster.ts`
- `src/engine/StudioEngine.ts`
- `src/engine/brushRaster.ts`
- `src/engine/dryBristleV3.ts`
- `src/engine/liveRaster.ts`
- `src/engine/paintCompositing.ts`
- `src/engine/painting.ts`
- `src/engine/renderer.ts`
- `src/styles.css`
- `src/ui/App.tsx`
- `src/ui/BrushStudio.tsx`
- `src/ui/RadialToolbar.tsx`

Also changed: `package.json`, `README.md`; added v153 browser/performance/render/report harnesses, saved-stroke goldens and comparison images. The two historic stock-contract tests now expect renderer 3 for future stock strokes; legacy golden values were not changed. New routing is required in shared dispatch, metadata, validation, crop padding, input and preview code so every entry point recognizes version 3. Old routes remain intact.

## H. Files and remaining limits

- `test-output/v153/Dry_Brush_v152_vs_v153.png`: photograph vs v152/v153, pressure and small sizes.
- `test-output/v153/ten-stroke-identities.png`: all ten IDs.
- `test-output/v153/areas-curves-maximum.png`: fills, overlaps, hooks, circles and 600 px marks.
- `test-output/v153/exercises/`: individual rendered exercises and captured stroke parameters.
- `validation/v153-*.json` and logs: detailed verification and observations.

This is a procedural bristle engine, not an exact reproduction of scanned ink. Reference matching and maximum-size latency remain unfinished. Physical Wacom input, Windows/iMac performance and cross-browser pixel equivalence have not been established. Pixel determinism claims apply under identical rendering conditions.

Rerun: `npm test`, `npm run test:regression`, `npm run build`; then use the `tests/dry-v153-*.mjs` harnesses with Playwright Chromium installed (or `CHROMIUM_PATH` set). Optional `--baseline` runs use `DRY_BASELINE_ROOT` or the documented extracted sibling folder. Python image analysis uses `tests/dry-blend-requirements.txt`. Frozen compatibility checks run without needing the old project.
