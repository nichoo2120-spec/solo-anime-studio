# Solo Anime Studio v0.5.173 — Mix not working / Ink bypass repair

## Confirmed issue

v0.5.172 could render **Ink Mix** strokes through the fast clean-Ink display instead of the native Mix compositor. This presented normal paint where the user expected colour mixing. The prior two-resampling mixing kernel was also barely visible except at very sharp colour boundaries.

## Targeted changes

1. `src/engine/InkDisplay.ts`: any stroke with nativeMixVersion now bypasses the clean-ink fast path, including saved v1 and new v2 Mix strokes. Ordinary Ink strokes retain the old fast path.
2. `src/engine/StudioEngine.ts`: new Mix strokes use `nativeMixVersion:2`; the worker live path and synchronous fallback accept both versions. A clear message is shown when the user tries to Mix on an empty active layer.
3. `src/engine/nativeBrushMix.ts`: native Mix v2 uses a local Canvas-filtered pigment blend, clipped to the *original selected brush's own mask*. Older v1 Mix strokes still run the original v1 code path. This is local colour averaging, not a simulation of physical pigment chemistry.
4. `src/engine/liveBlend.worker.ts`, `LiveBlendWorker.ts`, `paintCompositing.ts`, and `src/core/model.ts`: version-2 routing and project validation; version 1 retained.
5. `src/ui/BrushStudio.tsx`: clearer same-layer setup guidance, no old Blender tip in the stroke-style selector.
6. `offline/src/...`: matching precompiled browser modules (not only source changes). Updated `scripts/launch-offline.mjs`, Windows BAT and build version badge to `0.5.173`.

## Scope and constraints

- The existing Paint brush engines, brush style texture/masks, tool wheel layout, project geometry, and normal Paint output were not intentionally modified.
- Mix works on colours already present **on the same selected raster layer**. This update does **not** enable mixing paint from another layer. Switch to Paint and put two adjacent colours on one layer before testing Mix.
- New v2 strokes use wider kernel filtering to make mixing easier to see; performance on complex 4K/Wacom projects has not been measured here. The older v1 Mix compositing code remains available for saved projects.
- Full UI navigation / pen tablet input cannot be run in this tool environment. No claim that all lag or all brush material behaviours are corrected.

## Tests run

- `node scripts/check-mix-v173.mjs` — 24 regular brush presets keep brush identity; Ink Mix skips fast Ink; original Ink fast path retained; old and new Mix saved strokes validate.
- `python tests/native-mix-v173-browser.py` — isolated Chromium colour transitions, texture gap preservation, unchanged outside pixels, no selected colour injection, 0 strength, v1/v2 behaviour distinction.
- `python tests/mix-worker-dirty-v173-browser.py` — isolated Chromium worker dirty-region render and final correction with v2 stroke.
- `node scripts/check-native-mix-v170.mjs` and earlier v170/v171 Chromium test cases — pass.
- `node scripts/check-offline-v173.cjs` — dependency-free offline startup and asset availability.
- `node --check` on modified compiled JavaScript; TypeScript transpilation checks.
