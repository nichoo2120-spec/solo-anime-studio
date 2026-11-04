# Codex task, PART 2 of 3 (Solo Anime Studio v0.5.146 -> v0.5.147): Dry Brush

Phase 1 (test rig) is already done in this repo. Do ONLY Phase 2 now. Do not start Phase 3.

IMPORTANT: Attached to this message are 3 files you did not have before: ref_drybrush.png (the reference picture), metrics.py (the measuring standard) and dryBristle.ts (a prototype of the new dry brush model). Use metrics.py as the SINGLE source of truth for every acceptance number. If your Phase 1 metric definitions differ from metrics.py, switch your test rig to metrics.py, re-run the baseline and report the new baseline BEFORE changing any brush code. Do not relax any target.


## Hard rules
* Engine-only changes for the dry and blend brushes. Do NOT change the UI layout, toolbar, other brushes, project format version, or the old render paths. UI: only add the new preset entries and the few new sliders listed below.
* Old strokes and saved projects must render **byte-identical** to v0.5.146. Add a golden test for that (render an old `dry` stroke, an old `color-blender` stroke and an old `color-texture` stroke before/after; compare PNG bytes or per-pixel equality).
* New behaviour is gated by new stroke fields: `dryBristleVersion: 1` and `smudgeVersion: 2`, set only by the new presets via `brushStrokeMetadata` (src/core/paintTips.ts L31-37). Branch on them before the existing `engineVersion` switch (src/engine/renderer.ts, `drawStroke`).
* Deterministic: the same stroke must always render the same pixels. Seed from the stroke id (like `colorSeed`/`watercolorSeedFor`). No `Math.random`, no frame/time dependence.
* Live drawing and final replay must match (same pixels after pen-up).
* Keep `npm test` (vitest, currently 63 files / 324 tests), `npm run build`, `npm run test:regression` (58 scripts), and `tsc --noEmit` green.
* Do not touch /workspace/sas_b4. Work on a branch/copy.

## Reference
* Reference image: `ref_drybrush.png` (four black ink dry-bristle strokes on white paper: dense opaque start, streaky split bristle trails, ragged frayed edges, hairlines and flecks flying off the end, paper grain showing in dry areas, tapered uneven ends).
* A working standalone prototype of the dry bristle model is in `sas_b4_out/prototype/dryBristle.ts` (function `drawDryBristle` + `applyTooth`) with a harness `harness.ts` (`H.proto`). Use it as the starting algorithm. It already matches the reference in 9 of 13 numeric measures. Do not copy its performance profile (it renders the whole stroke at once, ~100 ms for 480 px): make it incremental.
* Current problems (measured): Dry Brush is a grey blotchy slab (streak directionality gx/gy .95, mean opacity .51, slow and fast strokes pixel-identical). Blender smears only 35–121 px (0.5–1.7× size) and is 11–15 % red at 40 px past a red|blue edge.


## PHASE 2 — Dry Bristle engine
Implement `src/engine/dryBristle.ts` (production version of the prototype), integrate for strokes with `dryBristleVersion===1` (draw into the same scratch mask / `pass.mask` used by `drawPainting`, so `compositePaintStroke` and undo/redo stay unchanged).
Requirements:
* Bristle table per stroke (seeded): N≈clamp(size×0.6, 24, 140); each bristle has lateral offset, stiffness/lag, paint load (lower at edges), depletion length, width, pressure threshold, tail length, start delay, clump id. ~25–35 % are "hair" bristles with long thin tails.
* Per 1 px step along the Catmull-Rom resampled path: bristle follows target by lag (fans/crosses in curves, splits at turns), clump wander, edge fray jitter, load depletion `exp(-d/depLen)` where `depLen` shrinks with speed (`speedDry`), skip-noise dashes, pressure drops bristles whose threshold > pressure.
* End: bristles lift by stiffness within `liftMul×size`, coast along the last tangent for their tail length with fading alpha (hairlines), plus flecks (~0.45×size×`flecks` tiny dashes thrown past the end).
* Paper tooth post-pass on the dirty box only: `A' = smoothstep(.18,.78, A + (.5 − tooth(x,y))·k·4A(1−A))`, tooth = 3-octave value noise (~2.2 px), blur 0.7 px, optional wash 0.12–0.2.
* Speed: record `Point.v` for the new brush the same way coloring strokes do (StudioEngine.ts L374: `p.v=.65` + velocity update) so speed affects depletion.
* Incremental rendering: append new steps only. Budget: ≤ 3 ms per pointer event (8 px × ≤100 bristles), tooth pass ≤ 2 ms on the new dirty box, full replay of a 600 px stroke at size 130 ≤ 120 ms. Measure and print these.
* Presets (add to `stockPresets`): **Dry Ink Bristle** (size 90, load .97, depletion 15, speedDry 2.6, lag .55, clumps 16, clumpAmp .30, fray .09, hair .35, flecks 1.8, liftMul .8, tooth .9 @2.2 px, blur .7, wash .15, opacity 1) and **Dry Paint** (size 70, load .85, depletion 6, speedDry 2.0, lag .45, clumps 10, clumpAmp .22, fray .14, hair .20, flecks 1.0, liftMul 1.0, tooth .6 @3 px, blur .5, wash .25, opacity .9). Keep the old **Dry Brush** preset untouched (rename the label to "Dry Brush (classic)" only if the owner agrees).
* UI: expose only 5 sliders in the brush panel for the new brushes: Bristle load, Dry-out distance, Speed dry-out, Edge fray, Paper tooth. Everything else stays in the preset.

Numeric acceptance (render the Phase 1 strokes at size 130, mean of straight slow/fast + sine slow/fast, black on white). Reference range comes from `ref_drybrush.png` (four strokes aligned to horizontal; computed by `sas_b4_out/metrics.py`):
| Measure | Must be in |
|---|---|
| gx/gy streakiness | ≤ 0.36 (reference .20–.32; v0.5.146: .95) |
| gap fraction | .10–.30 |
| perimeter ÷ hull perimeter | 1.5–2.4 |
| end fray length ÷ width | .6–2.6 |
| mid-tone share | .28–.55 |
| last20/first20 density | .55–1.0 |
| mean opacity | .75–.85 |
| streak count (runs across) | 3–6 |
| streak thickness | 5–21 px |
| within-stroke repeat peak | ≤ .22 |
| flecks | 30–80 |
| hairlines | ≥ 4 (prototype has only 1: raise hair-bristle count/length until ≥ 4 without breaking the others) |
| end taper | .33–.78 |
| slow vs fast | mean opacity differs ≥ 0.05 and end fray differs ≥ 0.2 W (prototype only has ~0.02 → increase `speedDry` effect) |
| light vs heavy pressure | light pressure (0.25) has ≥ 25 % fewer bristles touching than heavy (0.95) (width alone is not enough) |
| sine vs straight | bristle splits visible: ≥ 1 more streak in the sine bends |
| determinism | same stroke rendered twice = identical bytes |
| old dry/textured strokes | byte-identical to v0.5.146 |

Screenshots required in `test-output/dry-blend/` and in the PR: the same strokes as `ref_drybrush.png`: straight-slow, straight-fast, sine, bell pressure, light, heavy, zigzag, short, long; black on white, tan, blue; plus a side-by-side montage with the reference (`compare_vs_reference.png` layout: reference row, v0.5.146 Dry Brush, v0.5.146 Textured bristle, new Dry Ink Bristle, new Dry Paint).


## Deliverables
* Code + tests + `tests/baseline/*.json` + screenshots in `test-output/dry-blend/` + `UPDATE_v0.5.147.md` (what changed, parameters, measured before/after table, known limits).
* Print final numbers for every acceptance row (pass/fail), and test counts for `npm test`, `npm run test:regression`, `npm run build`.
* If a numeric target cannot be reached, report the real number and why, do not lower the target silently.
