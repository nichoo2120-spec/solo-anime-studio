# Codex task — Solo Anime Studio v0.5.153 → v0.5.154: Blender v2 (Phase 3)

You get: the full app folder `Solo_Anime_Studio_v0_5_153` (zip) and `blender_inputs.zip`
(blender_metrics.py, blend_run.mjs, hlib.mjs, montage.py, blender_baseline.png, data/v153/*).
Work in order: **3A, then 3B, then 3C**. Each sub-phase ends with a STOP CHECK: run the gates, print the
numbers. If a gate fails, fix it before moving on. **After 3C, stop. Do not start any other phase.**

## What the user wants (plain words)
The Blender should feel like a wet brush that really picks paint up and drags it. Drag from red into blue:
red should travel a long way (about 3× the brush size), fade slowly and mix into purple, soft at the
edges with fine bristle streaks, not a short blotchy smear that dies after ~30 px. Pressing harder
should carry more paint; moving fast should smear longer but thinner. The "Mix tips" panel must do something.

## What is wrong now (checked in v0.5.153 source)
* `src/engine/bristleSmudge.ts` (78 lines), class `SmudgeGesture` (L26-70):
  * The brush "load" is a 24×24 buffer (`const N=24`, L9; `load` L29).
  * L52: `pickup = 1 - exp(-travel / (size*0.28))`. L53 then pulls the load toward what is under the
    nib by `pickup` **every dab**. At size 70 that is a ~20 px time constant, so the load is fully
    replaced by the canvas colour after ~20-60 px. The carried colour is never "mass"; it is just a
    running average that gets overwritten. This is the root cause of the short smear.
  * The sample is read from `this.work` (already-smudged canvas), so the brush re-picks what it just laid.
  * L56: deposit `amount = 1 - exp(-level*travel/(size*.06)*1.5)` ≈ 1 every dab → the stamp covers the
    canvas almost fully each step, which also kills carry and gives the visible stamp repeats.
  * Pressure only enters through `dab.level`; speed has no real effect.
* Dispatch: `src/engine/paintCompositing.ts` L20 (`coloringEngine===1 && brushTip==='color-blender'` →
  `coloringAppearanceVersion===3 ? applyBristleSmudge : ===2 ? applyColorSmudge : applyColorBlend`).
* Preset: `src/core/brushes.ts` L27 `preset('color-blender','Blender','Paint',{brushKind:'coloring-blender',
  coloringAppearanceVersion:3, size:60, flow:.85, …})`. It is the only blender/smudge preset.
* Stroke metadata: `src/core/paintTips.ts` `brushStrokeMetadata` L32-36 (return object on L34).
  `sanitizeBrush` is `src/core/brushes.ts` L47 (special-cases L54-55 for coloring/blender).
* Stroke validation on load: `src/core/model.ts` L86-87 (coloringAppearanceVersion / blendPreserveAlpha).
  Any new stroke field must be accepted there or saved projects will fail to load.
* Stroke creation: `src/engine/StudioEngine.ts` **L385** (`this.stroke={id:…, ...brushStrokeMetadata(this.brush), …}`;
  `colorSeed=watercolorSeedFor(this.stroke.id)` is set there for coloringEngine 1). In v146 this was L374.
* **Mix tips** panel: `src/ui/BrushStudio.tsx` L36-40 (Tip A / Tip B / Blend, writes `mixTipA/mixTipB/mixBlend`
  onto the brush). The renderer reads them at `src/engine/painting.ts` L42 (`mixedNib`, `src/engine/paintingTips.ts` L47).
  They never reach the stroke: `brushStrokeMetadata` does not copy them and `sanitizeBrush` drops them, and
  `model.ts` does not validate them. So the panel is inert. Note: the panel shows only for Paint brushes that are
  not watercolor / coloring / dry (L36 condition), so it is a *nib mixer*, not a colour mixer.

## Measured baseline (v0.5.153, blender_metrics.py, red|blue edge at x=430, stroke x180→720, y=150)
| Measure | v153 now | Target (v2) |
|---|---|---|
| carry of red into blue, size 70 (band mean red share > .08) | 66 px = 0.94× size | ≥ 3.0× size |
| red share at +40 / +100 / +200 px, size 70 | .24 / .02 / .00 | ≥ .35 / ≥ .20 / > 0 and decreasing |
| half-life of red share after the edge | 30 px | ≥ 105 px |
| size 30 / size 130 carry | 0.93× / 1.02× | ≥ 3.0× / ≥ 1.6× |
| red patch dragged on white, smear length | 100 px (9 % strength at +60) | ≥ 140 px |
| pressure .25 vs .95 carry | 41 vs 63 px (gap 22) | gap ≥ 40 px |
| slow vs fast, red share at +40 | .221 vs .229 (no difference) | differ ≥ .05 |
| stamp repeat (autocorrelation peak) | .52 (visible stamping) | ≤ .35 |
| vertical edge 10-90 % width at +40 px | 60 px | ≥ 12 px (stay soft) |
| pixels changed outside stroke / on empty layer | 0 / 0 | 0 / 0 |
| per-event live cost size 130 (incl. 1400×500 base copy), p95 | 3.27 ms | ≤ 3.0 ms, no frame > 16 ms |
Picture: blender_baseline.png (top: size 70, middle: size 130, bottom: red patch on white).

## Hard rules
1. Do not change old strokes: every stroke without `smudgeVersion` renders **byte-identical** to v0.5.153
   (classic Blender v3/v2/v1, all brushes). The old `SmudgeGesture`, `applyColorSmudge`, `applyColorBlend`
   code paths stay as they are.
2. New behaviour only behind a new stroke field `smudgeVersion: 2`, set by `brushStrokeMetadata` only for the
   new presets. Branch in `paintCompositing.ts` L20 **before** the existing choice. Add the field to
   `model.ts` validation (accept only 2, only with coloringEngine 1 + brushTip 'color-blender').
3. The dry brush v1/v2/v3 and all 520 old-brush golden hashes stay unchanged (run the existing
   brush-compatibility tests; add a v153 golden for 3 old blender strokes + 3 dry strokes before you change code).
4. Deterministic: seed from the stroke id (`watercolorSeedFor(id)`, already stored as `colorSeed`). No
   `Math.random`, no time, no frame-rate dependence. Same stroke → same pixels, every time.
5. Live drawing and the final render after pen-up must match (max channel diff ≤ 1, ≥ 99.9 % identical pixels).
   Keep the incremental update + checkpoints (every 4 dabs) design.
6. Per-event cost ≤ 3 ms p95 at size 130 (method: blend_run.mjs `perf.json`), no new long frames
   (> 16 ms) while drawing a 160-move stroke.
7. Keep the v153 toolbar, tool wheel, shortcuts, and all UI layout. UI changes allowed only: new preset
   entries, and the small Blender settings block in 3C.
8. Keep green: `npx tsc -b`, `npx vitest run`, `npm run -s test:regression`, `npx vite build`.
9. Bump version to 0.5.154 in package.json.

## PHASE 3A — Wet reservoir engine (smudgeVersion 2)  — STOP CHECK after
New class `WetSmudgeGesture` in a new file `src/engine/wetSmudge.ts` (do not edit `SmudgeGesture`).
* Reservoir: per-gesture premultiplied RGBA buffer 32×32 with a real **paint mass** (0..1 per cell),
  started by loading from the canvas at the first dab.
* Per dab (travel = new arc length since last dab):
  * `give = depositRate(pressure) · (1 − exp(−travel/(size·0.5)))` — fraction of reservoir laid down.
  * `pick = mixAmount · (1 − exp(−travel/(size·pickupLen)))` — fraction of canvas colour taken in,
    sampled from the **base** canvas (pre-stroke) blended with what this gesture already laid, weighted by alpha.
  * reservoir = reservoir·(1−pick) + canvas·pick; then mass decays `exp(−travel/(size·holdLen))`
    (holdLen default 3.5, so colour lasts ~3× size).
  * Deposit: composite the reservoir through the nib alpha with `amount = give·mass` (never ≈1 each dab).
* Bristles: low-amplitude, seeded per-bristle streak mask along the stroke direction (strength `smearStreak` .5),
  fixed per stroke (seed), so streaks run along the path and do not repeat per dab. Sub-dab jitter from the seed
  to break stamp repeats.
* Pressure: scales give and hold (heavy = carries further and lays more). Speed: faster = longer,
  thinner smear (lower give per px, higher hold), slow = more thorough mix.
* Respect `blendPreserveAlpha`, layer opacity, transform/perspective (reuse `contactMatrix`).
* STOP CHECK 3A: tsc, vitest, run `node blend_run.mjs v154 PORT` with the presets from 3B temporarily
  wired via ov `{smudgeVersion:2}` (or a test hook), `python3 blender_metrics.py data/v154 --check`. Print the table.

## PHASE 3B — Presets + old-stroke safety  — STOP CHECK after
* New presets (Paint category, Blender family next to the old one):
  * **Smudge Bristle**: size 60, mixAmount .75, pickupLen .9, holdLen 3.5, smearStreak .5.
  * **Blender Soft**: soft round nib, mixAmount .85, holdLen 4.5, smearStreak .15.
  * **Wet Mix**: like Smudge Bristle plus `useSelectedColour` .25 (adds a bit of the current colour).
  * Keep **Blender** (classic `color-blender`) exactly as is.
* `brushStrokeMetadata`, `sanitizeBrush` and `model.ts` know the new fields (`smudgeVersion`, `mixAmount`,
  `pickupLen`, `holdLen`, `smearStreak`, `useSelectedColour`), clamped to sane ranges.
* Tests: golden test that old blender strokes (v1/v2/v3) and old saved projects render byte-identical;
  determinism test (same stroke twice → same hash); live vs final test; 520 old-brush hashes unchanged.
* STOP CHECK 3B: all gates + `blender_metrics.py --check` on **Smudge Bristle** must PASS every target.
  Also report Blender Soft numbers (it should be softer: edge_10_90 larger, streak_std lower).

## PHASE 3C — Make "Mix tips" work + small UI  — STOP CHECK after
* Copy `mixTipA`, `mixTipB`, `mixBlend` onto the stroke in `brushStrokeMetadata` (only when Tip A ≠ Tip B and
  0.01 < Blend < 0.99), keep them in `sanitizeBrush`, accept them in `model.ts`. Old strokes have no such fields,
  so they are unchanged. Add a vitest: with Blend 50 % the rendered stroke differs from Blend 0 %; saving and
  reloading a preset keeps the values.
* In BrushStudio, for the new blender presets only, add sliders: Mix (mixAmount), Hold (holdLen),
  Streaks (smearStreak), Add colour (useSelectedColour). Nothing else in the UI moves.
* STOP CHECK 3C: all gates, metrics PASS, and a UI check that the toolbar has all 12 tools and the wheel
  still works.

## Acceptance (all must hold at the end)
`python3 blender_metrics.py data/v154 --check` → every line PASS for Smudge Bristle (the script's TARGETS),
plus rules 1-9 above.

## Deliverables (then STOP)
* `UPDATE_v0.5.154.md` in the app root: what changed, file list with line ranges, the before/after metrics
  table (v153 baseline above vs v154), perf table, test counts, and anything you could not meet and why.
* New tests (vitest + regression scripts) and `blender_v154.png` made with `montage.py` from your run.
* Return **the whole app folder** `Solo_Anime_Studio_v0_5_154` as one zip (source, tests, package.json,
  UPDATE doc; no node_modules, no dist).
