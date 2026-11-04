# v0.5.179 — Native brush Mix repair

This update repairs the Mix operation used by the existing brush library. It does not replace the library with generic Blender brushes. The supplied 67-second Photoshop recording is the behavioural reference: existing pink and green are dragged into a blended transition; a loaded green brush can also lay fresh paint while picking up pink; changing the tip changes the edge and texture.

## Actual causes

- The active `nativeMixVersion: 2` renderer applied a small local blur, rather than carrying pigment along the pen path. Its final `source-atop` operation categorically prevented paint reaching transparent paper. Before testing confirmed that all 24 active Mix-capable presets had zero carried pixels beyond the painted area.
- A duplicate/no-change pen sample could leave non-finite dirty-rectangle extrema. Those poisoned the region union and produced a zero-width `createImageBitmap` crop. Two worker errors could trip the session circuit breaker. The baseline test reproduced both errors.
- A growing `mixStops` array participated in the worker's job signature, allowing changing wet pickup metadata to restart an otherwise unchanged job.
- Very small dry brush heads could retain their provisional one-point contact in the trajectory cache. This produced a few different pixels between the finished worker output and a fresh saved replay. New Mix strokes now rebuild their canonical dry contact before finishing; normal Paint and legacy strokes keep their original cache/render path.

## New stroke behaviour

New strokes capture `nativeMixVersion: 3`. A stroke-specific pigment reservoir samples the existing selected layer at fixed distances along the saved path. Pressure changes contact size and pickup. The reservoir carries sampled colour into subsequent contacts, including transparent paper, and gradually loses/replaces pigment as it moves. Native brush alpha remains the final mask, preserving the selected nib, pressure envelope, dry gaps, taper and grain.

Pure Mix defaults to **Add paint: 0%**. Increasing **Add paint** loads the currently selected colour and replenishes it while picking up canvas pigment, matching the loaded-brush part of the reference. The load is captured on the stroke and survives reload. Mix strength controls the effect; Mix reach controls how far carried pigment persists. Existing Size, Opacity, Flow, pressure and tip settings remain available.

The reservoir interpolates premultiplied colour/alpha to avoid double attenuation during pickup. Live calls append against an immutable pre-stroke layer; final output is regenerated from the complete saved stroke. There is no random per-frame variation and no new per-dab pixel readback on the input thread. Unchanged/invalid dirty bounds are sanitized before worker transfers.

Old `nativeMixVersion: 1` and `2` strokes retain the original renderer. Ordinary Paint settings and preset names are unchanged. The new optional saved field is `nativeMixPaintLoad` in [0,1], valid only for version 3. Prior applications cannot interpret new v3 strokes; keep backups when sharing projects with older app versions.

## Actual rendered checks

- All 24 active Mix-capable presets: changed colour, carried pigment beyond the existing painted area, preserved zero-alpha native brush gaps, did not inject the selected green at Add paint 0%, and did not reduce opaque canvas coverage.
- 144 baseline-v178 comparisons: all normal Paint and saved Mix v1/v2 renders remained pixel-identical, including partially transparent source paint.
- 72 small/medium/maximum-slider-size cases: saved replays and finished workers matched exact RGBA, with pressure changes, curved/reversed paths, changing speed, opacity variation and duplicate samples. Zero worker errors; zero main-thread Mix pixel readbacks.
- All 24 actual application UI presets: Mix captured version-3 pressure strokes, visibly changed the drawing canvas, and passed Undo/Redo. Add paint and the project survived saving/reopening.
- Six actual-engine mirrored cases: horizontal/vertical reflection around a custom pivot, saved replay and Undo/Redo were pixel-identical.
- Reference study: hard, soft, textured and dry tips tested with existing pink/green and with a loaded green brush over pink. The generated images were inspected directly.
- Production build and unit tests run separately. The Windows workflow additionally repeats the rendered tests, packages NSIS, verifies assets and launches the actual packaged application before publication.

Evidence is in `validation/mix-v179/` and the Desktop update workflow artifacts. Renderer test scripts are `tests/mix-v179-*.mjs`; the saved-format/routing unit tests are `tests/mix-v179.test.ts`.

## Performance and limits

`mix-v179-performance.mjs` is a single diagnostic pass per case, using software Chromium, a 281-stroke project and four pen samples per RAF. It is not a statistically controlled before/after benchmark or a physical tablet latency test. Normal DPR1 cases were approximately 17–19 ms at frame p95; DPR2 with 4× CPU slowdown remained substantially slower. Final worker settling also exceeds 50 ms in several cases. This is a functional Mix repair, not a universal lag-free claim.

Mix samples the current selected layer. It is RGB pigment transport with optional loaded colour, not Photoshop's exact proprietary engine, spectral paint mixing or a physical fluid simulation. Separate Mix passes can increase transparency coverage as pigment is deposited. Large/high-DPI canvases and mirrored synchronous paths can still stutter. Real Wacom and the user's installed Windows upgrade cycle were not tested on the user's computer.

The broader legacy regression runner has six pre-existing blockers: the historical `.dry-v148-compatibility-goldens.json.bgB73W` backup is absent from the GitHub baseline. Remaining guards pass with the explicit v179 hash-chain entries; historical expectations and missing-fixture hashes have not been altered.

## Source changes

- `src/engine/pigmentMix.ts`: new opt-in pigment reservoir, native mask compositing and optional loaded colour.
- `src/engine/nativeBrushMix.ts`: v3 routing; old v1/v2 calculations retained.
- `src/engine/liveBlend.worker.ts`: finite dirty regions, canonical final mask/composite and stale-result disposal.
- `src/engine/LiveBlendWorker.ts`: exclude transient pigment samples from the stable job signature.
- `src/engine/StudioEngine.ts`: capture new Mix version and explicit paint load.
- `src/engine/dryBristleV3.ts`, `src/engine/renderer.ts`: narrowly gated new-Mix final-contact cache reset.
- `src/core/model.ts`: validate/round-trip v3 and its optional paint load.
- `src/ui/BrushStudio.tsx`: Add paint control and accurate Mix guidance; existing layout/tools preserved.
- Version/package metadata, revision ledger, renderer tests, workflow and release notes: verification and delivery support. The release publisher now reads version-specific notes instead of reusing v178's update-delivery description.

Opening the installed app detects this version only after the tested candidate has been merged and published. The v178 release remains available.
