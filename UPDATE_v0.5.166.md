# Solo Anime Studio v0.5.166 — Blender response correction

## Scope
This is a targeted change to the **stock Blender** for new strokes only. Other Paint brushes, the Eraser, tool wheel, UI panels and existing stored strokes retain their previous renderers. It does **not** implement the proposed universal Paint/Mix tabs.

## Problems addressed in source
1. The old default Blender used a travelling reservoir, depositing carried colours as long smears that felt like painting.
2. Live blending transferred the entire accumulated stroke region for every worker update.
3. The old Blender had no direct control for the gentler local blending behaviour.

## New behaviour
- The default Blender now uses a round soft-edge local mixing nib. It averages colours beneath the brush, without adding the selected colour or dragging pigment far along the stroke.
- Default Mix = 44%, Flow = 75%, Opacity = 75%; Mix = 0% leaves the source unchanged.
- The v3 renderer processes newly added contact dabs in a worker, uses local canvas resampling, and returns only the newly dirty crop. There are **no getImageData calls** in the new Blender module.
- Stored strokes with no smudgeVersion (the historical Blender) and smudgeVersion 2 (Smudge Bristle/Blender Soft/Wet Mix) continue through their previous renderers. Previous strokes are not converted.
- Opening an older brush library upgrades the stock Blender preset **for future strokes only**; custom and previously saved project strokes are untouched.

## Checks performed in this environment
- `scripts/check-gentle-blender-v166.cjs`: PASS 17 checks using the optional available Skia canvas backend, including colour-boundary mixing, unchanged distant colours, alpha preservation, 0% mix no-op, deterministic incremental vs final rendering, new and old stroke loading.
- Version-chain/source hash regression scripts v157, v158, v161–v166: PASS 8/8.
- `npm run test:warm-cache`: PASS 20 isolated tests.
- `npm run test:raster-cache`: PASS 20 isolated tests.
- Historical golden fixture files were not modified.
- Full 69-script regression runner: did not complete before the execution time limit (first 27 scripts passed).
- `npm run build` / `tsc`: BLOCKED — Vite dependencies not installed (`vite/client` missing), registry unavailable.
- Full Vitest: NOT RUN (dependencies unavailable).
- Chromium DPR 1/2 parity, GPU/Wacom tests and target p95/pen-up/undo benchmarks: NOT VERIFIED.

## Run
The archive is a **complete source project**, not a patch. Its old compiled `dist` is intentionally excluded: building locally is necessary to use the new Blender implementation. Install Node.js and dependencies if needed, then use `START SOLO ANIME STUDIO.bat` (which installs dependencies and builds the current source). Check the version badge reads **0.5.166**. If npm/build fails, the launcher will show the error; do not run a previous dist build as v166.

## Still outstanding
The original 20 ms frame-time and 50 ms pen-up/undo performance targets are **not proven** and may still fail on the user's Windows/Wacom hardware. The full browser parity harness should be rerun before treating this as a verified production release. The other three existing smudge presets remain v2, with their prior streak properties. Universal Mix mode must wait until performance is verified.
