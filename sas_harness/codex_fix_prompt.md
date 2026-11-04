# Codex task: Solo Anime Studio v0.5.156 → v0.5.157 (performance only)

## Hard rules
1. Start from the full v0.5.156 app folder. Return the **whole app folder** as a zip, with UPDATE_v0.5.157.md and CHANGES.md (file:line for every change).
2. **Do not change how any brush looks.** All output hashes must be byte-identical to v0.5.156.
   - Compare against v156 on the **same browser**. The frozen golden hashes depend on the browser (on Chrome 156, only 448/520 match the frozen file for both v154 and v156).
   - Must pass: 520/520 dry goldens, 12/12 v147 saved strokes, the blender legacy entries, determinism, and live = final (max diff 0).
3. tsc, vitest, regression and build must all pass. Add tests for every change.
4. Measure with the perf harness included in the zip: lib.mjs, matrix.mjs, proj/busy.solo.json, proj/busy10.solo.json. Do not invent your own. Report a median of 3 runs for every number.
   - Setup: Chrome, DPR 2, 2048×1152, CPU throttle 4×, CDP pen events at 200 Hz.
   - Brushes: ink, pencil, dry-ink, dry-paint, solid, blender, smudge-bristle, blender-soft, wet-mix, eraser.
   - Sizes: 30, 70 and 150.

## Current numbers (v156, median of 3)
- p95 frame: 67–233 ms
- pen-up: 299–635 ms
- undo: up to 6.9 s at size 150 and about 3 s for every dry brush
- longest task: 219–613 ms

## Phase A: Undo/redo as a blit (biggest problem)
Cause, in renderer.ts:
- L78 `if(bytes>4*1024*1024||op.kind==='vector')return;` saves no pre-op patch when the stroke's box is over 4 MiB. Size 150 is always over. Dry brushes are over at any size, because padding is size*3+12 (core/dryBrush.ts L6).
- Undo then goes through get() (L99) and replays the layer from a checkpoint up to 24 ops back (L70).
- During the replay, beforeOperation (L71–80) copies patches again. That was 33 s of a 42 s undo in one profile.

Fix:
- Always keep a pre-op patch for the stroke's dirty region. Use tiles (for example 256 px) or a compressed/off-thread copy so large strokes are covered too. Keep a memory budget and fall back to replay only when the budget is exceeded.
- Skip patch capture while replaying.
- Redo should also be a blit.

Tests:
- Undo and redo ≤50 ms at size 150, and for dry-ink, dry-paint and pencil at all sizes.
- 20 undos followed by 20 redos must give identical hashes.

## Phase B: Pen-up ≤50 ms
- Commit the live result as the final pixels instead of rendering the stroke again. Where the final pass must differ, it has to be proven identical, or run on a worker or in idle time without blocking input.
- Pencil: the pencilFinal worker reply must not do work on the main thread over 16 ms.

Tests:
- Pen-up ≤50 ms for all brushes at all sizes.
- No long task over 50 ms after pen-up.
- live = final, max diff 0.

## Phase C: Frame cost (p95 ≤20 ms)
- StudioEngine.ts L467: at fractional zoom, the dirty rect turns into a full-width band (`x:0`). Use an integer-aligned clip rect with a 1–2 px pad instead.
- DrawingFrameCache.begin: the first frame of a stroke is a full redraw. Build the prefix cache before the stroke starts (on pointerdown, or when idle).
- DrawingFrameCache ~L57–62: the native-ink region is the union of the whole old and new stroke. Use only the newly added segments plus pad.
- StudioEngine.ts L496: upper layers are drawn one by one every frame. Cache one "above" composite per stroke, and respect blend modes such as multiply.
- The 32 MiB maxBytes cap turns the cache off on bigger windows. Use tiles or raise the cap so a 4K window still uses the cache.

Tests:
- p95 frame ≤20 ms and input latency p95 ≤1 frame (16.7 ms) on busy and busy10.
- The cleared area per frame must be ≤ the stroke's dirty box plus pad (use dirty.mjs).
- There must be no full-canvas frames inside a stroke.

## Phase D: No per-dab readbacks for smudge and blender
- wetSmudge.ts: L88 calls getImageData per dab, L69 matchesSource does 2 full-box reads, and L112 reads back again when opacity is below 1.
- bristleSmudge.ts: L35, L50 and L65.
- SmudgeRollback.ts L19.
- Fix: keep a CPU mirror (Float32/Uint8 copy) of the region under the stroke, taken once at pointerdown. Smudge on the mirror, then putImageData the dirty rect once per frame. The math must stay bit-identical.

Tests:
- 0 getImageData calls per pointermove; at most 1 at pointerdown.
- Smudge and blender p95 ≤20 ms at sizes 30, 70 and 150.
- Hashes identical.

## Phase E: First-stroke warm-up and React
- InkDisplay.ts paintRegion (L203) and deferFinal (L193) still cause a stall of about 0.5 s on the first ink or eraser stroke. Pre-warm these surfaces on load or when idle.
- Check that App.tsx (L74) does not re-render on each pointermove. In the dev build it costs about 0.7 s per stroke. Move per-move state out of React state.

Tests:
- First stroke longest task ≤50 ms.
- 0 React commits per pointermove (React Profiler).

## Deliver
- A results table in the same format as tables.md, v156 vs v157, median of 3.
- Also report CPU 1× results and DPR 1 results.
- List anything you could not reach and explain why.
