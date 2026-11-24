# b24 progress (Silk Blend brush, base fd9e4d6 v0.5.237)
- baseline worktree: /workspace/sas_b24_base (fd9e4d6), outputs /workspace/sas_b24_out/baseline/*.txt
- baseline: vitest 430/430 pass
- design: new stroke field silkBlendVersion:1 (+silkMode/silkStrength/silkPickup/silkWetness/silkTexture), brushKind 'silk-blend'
  renderer src/engine/silkBlend.ts, hooked first in compositePaintStroke; live via LiveBlendWorker (workerBlendEligible + worker branch)
  UI: stock preset 'silk-blend' (Paint/coloring family), Silk panel in BrushStudio (mode, sliders, presets Soft/Wet/Dry, Reset),
  toolbar button + wheel slot/footer toggle, B toggles brush <-> Silk Blend
- DONE: src/core/silkBlend.ts, src/engine/silkBlend.ts, hooks (paintCompositing, LiveBlendWorker, liveBlend.worker, renderer skip mask), model validation, paintTips metadata, brushes preset (family 'blend'), BrushStudio + SilkBlendPanel, BrushPreview, PaintBrushPicker card, SilkBlendIcon, App (B toggle, toolbar buttons, menu), RadialToolbar (slot + footer SILK)
- tests edited (preset counts exclude new 'blend' family): brush-vector, coloring-core, paint-tips-v124, watercolor-removal-v132
- tests/silk-blend-v238.test.ts 14/14; vitest 444 expected
- baseline regression 52/73 (21 pre-existing fails); work same 21 names (compare outputs)
- NEXT: browser visual check + real-app perf (DPR2 2048x1152 4x) + guards (commit-band, parity, goldens, bytes harness)

## 12:45 IST update
- Version bumped to 0.5.238 (package.json, lock, buildInfo), UPDATE_v0.5.238.md, CHANGES.md entry.
- Found: GitHub Actions (desktop-update.yml) builds + publishes the release on push to main. Ran its whole test list locally (ci.sh): all pass except
  - continuous-preview-v211: Silk ignored Smoothing -> FIXED (causal lazy-rope + low-pass in SilkGesture.follow; prefix-stable; new vitest).
  - mix-v179-browser: legacy Mix-applied-to-every-preset test; Silk excluded (it is a blender, not a Mix target).
- Extra guards failing on work (commit-band, dry-v148, blender-v154, smudge-v156, dry-blend-legacy-golden, check-offline-v176): comparing with base (ci2.sh).
- Bytes harness running (h/run.sh).

## 13:05 IST update
- ci2.sh done: base fails the same 6 extra guards (dry-v148, blender-v154, smudge-v156, dry-blend-legacy-golden, check-offline-v176 identical; commit-band-v175 flaky: base 0/3 pass, work 1/3 pass, same penup-forced band assertion). Work reruns: mix-v179-browser, continuous-preview-v211, drawing-v157-parity, silk browser all PASS. vitest 445/445. Regression 52/73 with the same 21 failures and same reasons as base (stale hash ledgers etc).
- Bytes harness: compat 1240/1240, old 160/160, oldv 36/36 renders byte-identical to base; live==final 0 diff.
- Perf medians of 3 (perf_medians.txt): Silk p95 50-67 ms, pen-up 191-224, undo 123-142; base controls pencil/solid p95 33-183, pen-up 126-301, undo 107-135. Targets missed app-wide on base too; Silk is in line with existing brushes.
- Next: commit + push (CI publishes), zip, reports.

## 13:16 IST — done
- Pushed 5a6c04b to main. GitHub Actions desktop-update run 45348471116 passed and published v0.5.238 (non-draft, latest, with exe + blockmap + latest.yml, verified).
- Zip: /workspace/sas_b24_out/solo-anime-studio-v0.5.238-src.zip; REPORT.md; MASTER_REPORT_v2.md Part 18 added.

## v0.5.239 (t79u: Silk Wet like our watercolor brush) — 13:50 IST
- Studied watercolorNatural.ts / watercolorAppearance.ts (water-wet preset): swept max-coverage mask, feathered wet front, domain-warped cloud pigment variation, granulation, pool/bank darkening at the wet front (c*(1-c)), transparent layering, paper grain.
- Silk Wet v2 (silkBlendVersion:2, Wet only): wider bleed (1-3 passes), optical-density pigment mixing, uneven wet front from the same style cloud noise, darker wet edge from per-pixel swept wet mask, cloudy wash + Texture granulation. No brush colour.
- v1 strokes: frozen engine fixture compare (all modes) byte-identical. vitest 452/452. Silk browser worker parity 0 (wet v2 included). Harness: 1240/160/36 identical, livefinal 0.
- Visual: validation/silk-v239/silk-wet-watercolor.png.
- Running ci.sh work239 + regression + build.
- 14:35 IST: guards vs base all same (6 extra guards identical to base, incl. commit-band; regression 52/73 same names+reasons); CI-mirror list all pass. Optimised v2 (4px cloud lattice, grain only with Texture, LUT density, separable blur): worker CPU per stroke v2/v1 = 78/53 ms (size 30), 88/67 (size 150). Real-app perf medians unchanged within noise (perf239_medians.txt). Pushing v0.5.239.
- 14:10 IST: v0.5.239 published (Actions run 45355413184), non-draft + latest, exe/blockmap/latest.yml verified. Zip + REPORT.md + MASTER Part 19 done.

## Build A–E (owner pt81u): v0.5.240 = A+B (Brush Blend), v0.5.241 = C+D+E (Dual brush, My brushes, Tip shape)
- Base bf04939 (v0.5.239). Rules: gate new fields (old files byte-identical), never remove tools, no npm deps, push token env SAS_GH_TOKEN never printed, cite pt81u. Don't push if a guard newly fails vs base.
- v0.5.240 lives UNCOMMITTED in /workspace/sas_b24_work: src/core/brushBlend.ts, src/engine/brushBlend.ts, src/ui/BrushBlendPanel.tsx + edits (model, StudioEngine, paintTips, brushes, paintCompositing, liveBlend.worker, LiveBlendWorker, renderer, silkBlend exports, shortcuts 'j'=blendToggle, App, BrushStudio, styles). Version bumped 0.5.240, UPDATE_v0.5.240.md, CHANGES.md.
- Tests v240: tests/brush-blend-v240.test.ts (12 pass), tests/brush-blend-v240-browser.mjs (worker parity 0), tests/brush-blend-v240-ui.mjs (pass). Screenshot validation/brush-blend-v240/blend-settings-panel.png.
- 15:20 IST: all240.sh guards (sas_b24_out/ci/work240/results.txt) ALLDONE: only base-known fails (commit-band-v175, dry-v148-goldens, blender-v154-legacy, smudge-v156-visual, dry-blend-legacy-golden, check-offline-v176); regression 21 fails = same names as v239; vitest 464/464; tsc+build ok.
- 15:35 IST: bytes harness work240 (h/run240.sh, h/cmp.mjs): compat 620/620, old 80/80, oldv 36/36 identical to base; livefinal same as v239.
- Perf: perf script got a brush-blend case (BLEND_CASE=1, ONLY=). First v240 runs looked slower everywhere incl. untouched pencil/solid => box noise; building v0.5.239 control in worktree /workspace/sas_b24_v239 served on 6239 for interleaved runs (perfc239_*/perfc240_* logs).
- v0.5.241 (C+D+E) lives in worktree /workspace/sas_b24_cde (copy of v240 + brushShape.ts, stampBrush.ts, BrushShapePanel.tsx, customBrushes in project, etc.; node_modules symlink — don't commit). Unit 10 pass, browser test pass, UI test PASS after renaming checkbox to "Use dual brush". Screenshots validation/brush-shape-v241/{tip-shape-panel,my-brushes-panel}.png.
- NEXT: perf control -> commit+push v240 -> verify release -> port cde to work tree, bump 0.5.241, guards/harness/perf, push, reports (REPORT.md, zip, MASTER Part 20/21).
- 16:10 IST: interleaved perf v239 vs v240 (perf240_medians.txt): v240 same or better on every row; brush-blend p95 50/67 ms, pen-up 124/180. Committing + pushing v0.5.240.
- 16:15 IST: v0.5.240 committed 617b0cd and pushed; waiting on Actions.
- 16:20 IST: C–E ported from sas_b24_cde into work tree on top of 617b0cd; bumped 0.5.241, UPDATE_v0.5.241.md + CHANGES written. NEXT: check v240 release, then all241 guards + harness + perf.
- 16:45 IST: v0.5.240 published (run 45375835626 success), non-draft, latest; exe/blockmap/latest.yml present.
- 16:50 IST: v240 zip + MASTER Part 20 written. Guards all241 running.
- 17:20 IST: all241 guards: only new fails ink-tip-v203 + compact-brush-v207 from duplicate 'Roundness' label; renamed to 'Tip roundness (shape)' and 'Second tip count'; those + brush-settings-v202 + shape-ui pass. Regression same 21 as base, vitest 474/474.
- 16:45 IST (clock check: earlier notes' times ran ahead; real time now 16:45): v241 bytes harness compat 620/620, old 80/80, oldv 36/36 identical; livefinal same. Perf d239/d241 interleaved: Silk rows same; solid looked slower in 2 of 3 runs -> rerunning solid-only x5 (perfs*). brush-shape new case p95 ~200 / pen-up ~500 -> looking at stampBrush speed.
- 17:15 IST: solid-only x5 interleaved: v241 = v239 (p95 33/67, pen-up 135/155 vs 126/191). Made stamp live preview incremental (redraw only changed dabs; stampPlan/stampChange in stampBrush.ts, liveRaster keeps plan+canvas). Shape browser test passes (live final == reload 0; incremental preview within old-engine AA range), app commit == reload 0 diff. Next: rebuild + brush-shape perf.
- 17:25 IST: post-change checks: vitest 474/474, regression same 21 as base, check-* same as base, ink-tip/compact/brush-settings/live-brush/high-dpi pass, shape+blend UI pass. brush-shape perf (3 runs): p95 83-117 (30) / 100-183 (150), pen-up 300-470 / ~530. Committing v0.5.241.
- 16:56 IST: v0.5.241 committed dfd454d and pushed; waiting on Actions.
- note: the 17:15/17:20/17:25 IST stamps above were wrong (box clock was ~16:30-16:55 then); order is right.
- 16:57 IST: zip v241, REPORT.md (240+241) and MASTER Part 21 written (release status placeholder until Actions finishes).
- 17:15 IST: v0.5.241 published (run 45384239541 success, 17:08 IST), non-draft, latest; exe/blockmap/latest.yml verified. REPORT.md + MASTER Part 21 finalised. Build A–E DONE.

## v0.5.242 (owner pt86u): watercolor Blend must blend like watercolor; per-family Blend character
- 17:26 IST: started. Base dfd454d (v0.5.241). Plan: reproduce in app (before screenshot), study brushBlend engine + Silk Wet v2, add brushBlendVersion 2 with family profiles, tests, guards, perf, push.
- 17:33 IST: repro in real app (tests/brush-blend-v242-families-ui.mjs, validation/brush-blend-v242/families-before.png): (1) pencils (HB/2B) and G-Pen/Brush Pen? paint black instead of blending; (2) other brushes barely blend - colour refreshes every few px (no drag) and is weak; (3) zig-zag past paint pulls transparency in -> pale/white halos; (4) no family character (watercolor looks like any other).
- 17:36 IST: root causes: (a) InkDisplay.displayCleanInk shows ink-brush (G-Pen, Brush Pen…) Blend strokes as clean ink paint; (b) v1 blend refreshes the carried colour every ~3 px (pickup .03+.6p per dab) so little drag, weak strength, raw mask alpha (watercolour mask is thin); (c) v1 lerps alpha toward the sampled patch -> pulls transparency in (white halos); (d) one recipe for all brushes. Plan: brushBlendVersion 2 + bbStyle (water/dry/pencil/ink/air/oil/marker/texture/soft) in new src/engine/brushBlendStyles.ts; v1 path untouched.
- 17:39 IST: v2 engine written (src/engine/brushBlendStyles.ts), core bbStyle/blendStyleFor + validation, v1/v2 dispatch (gestureFor), displayCleanInk excludes blend strokes. v240 unit tests pinned to v1 strokes; pass.
- 17:42 IST: tests/brush-blend-v242-browser.mjs PASS (19 stock brushes, 9 styles, all distinct; alphaDrop 0 = no halos; no green; settings each >500 px; protect 0; worker live==final 0 for every family). Sheet validation/brush-blend-v242/families-sheet.png (v1 left / v2 right). Tuned pick/gain; airbrush coverage gain 2.6.
- 17:43 IST: v1 Blend strokes byte-identical vs v0.5.241 tree (78/78 renders, sas_b24_out/v1hash.mjs).
- 17:44 IST: tests/brush-blend-v242.test.ts 13/13 PASS; Blend panel now shows 'Blends like <family>'.
- 17:50 IST: real-app after run showed weak watercolor drag; tuned water profile (pick .5, drag 1.6, gain 2.6, coverage lift 2.2). v242 browser PASS, vitest 14/14.
- 17:53 IST: real-app after saved; comparison validation/brush-blend-v242/families-before-after.png built (14 brushes, 9 families).
- 18:05 IST: bytes harness work242: compat 620/620, old 80/80, oldv 36/36 identical; livefinal same as work241. Full guards (all242.sh) running.
- 18:27 IST: all242.sh finished: tsc 0, vitest 488/488, blend/shape/blend242 browser+UI all PASS, regression 21 fails = same names as base, base-known 6 fails unchanged. parity155-1 failed once under load (harness ran concurrently; color-solid paint, not Blend); rerun alone 3/3 PASS -> flake, not a new failure.
- 18:42 IST: perf v242 vs v241 (3 interleaved full runs + 6 pencil rechecks with order swapped): all cases equal within noise incl. new blend-water/blend-dry cases; perf242_medians.txt.
- 18:42 IST: committing v0.5.242 and pushing (pt86u).
- 18:42 IST: pushed bd94439; waiting for Actions.
- 19:00 IST: v0.5.242 published (run 45401103135 success, 18:54 IST, non-draft, latest, exe+blockmap+latest.yml 0.5.242). Wrote REPORT.md, solo-anime-studio-v0.5.242-src.zip and MASTER Part 22. DONE.

## v0.5.243 (owner pt88u) — remove dark wet edge, keep it on one brush
- 19:09 IST: start. Note: the screenshot attachment is private to the parent; I work from the description (dark border / tide line around blend + watercolor strokes).
- 19:11 IST: probe (tests/water-edge-v243-browser.mjs) before numbers: rim score Blend watercolor .84/1.03, Silk Wet 1.00, watercolor paint .06-.36 (gradient .36, rough .20, smooth .14, wet .12); other brushes ~0 except dry-paint/color-texture (texture, not a wet edge). Sources: brushBlendStyles water pool+edgeAlpha, silkBlend wet pool+edgeAlpha, watercolorNatural pool term + wet bank term.
- 19:19 IST: implemented edgeDarkness (stroke+brush field, 0..1; absent = old look). New watercolor-tip strokes (paint + Blend) and Silk Wet strokes save edgeDarkness 0; stock 'Watercolor Edge' (water-edge) saves 1 + adds a visible tide line in paint mode; Edge darkness slider in Brush Settings > watercolor. Probe after: Blend watercolor/Silk Wet rim gone (profile flat), no lighter rim; real-app straight watercolor strokes show no rim before or after.
- 19:23 IST: tests: tests/water-edge-v243.test.ts 7/7, water-edge-v243-browser PASS (rim metric old vs new for 23 brush/mode cases), water-edge-v243-ui real app before (v0.5.242 tree) / after + Edge darkness slider = 100 on Watercolor Edge. Count/legacy tests updated: water-edge added to the stock-count exclusion lists (same pattern as studio-ink/contour-flow); silk-wet-v239 edge test now pins a saved (no edgeDarkness) stroke; v242 tide-line test uses Watercolor Edge. vitest 488 pass. Images: validation/water-edge-v243/app-before-after.png, before-after-engine.png, watercolor-edge-brush.png.
- 19:23 IST: bumped to 0.5.243, UPDATE/CHANGES written; full guards all243.sh started (nothing else running in parallel this time).
- 19:50 IST: first all243 start failed (launched from wrong directory, ./ci.sh not found); restarted from sas_b24_out.
- 20:48 IST: all243.sh finished: tsc 0, vitest 495/495, blend/shape/blend242/edge243 browser+UI PASS, build 0, regression 21 = base names, base-known 6 unchanged. mix-v179-deep failed once (worker preview timeout, 130s vs 28s usual); rerun alone with the ci baseline 3/3 PASS (33-35s) -> flake.
- 20:50 IST: bytes harness work243: old 80/80 + oldv 36/36 identical (saved drawings unchanged), livefinal unchanged; compat 520/620: the 100 diffs are exactly the new strokes of the 5 stock watercolor presets (now edgeDarkness 0, intended); all other presets identical.
- 20:55 IST: perf v243 vs v242 (3 interleaved, alternating order): silk-wet faster (p95 100/117 vs 150/133), water-paint equal, blend-water 30 equal, blend-water 150 p95 100 vs 83 -> rechecking.
- 21:00 IST: skip the edge computation entirely when the edge is off (Blend water, Silk Wet, watercolor wet bank; byte-exact since the term was x*0). Node micro-bench: Blend water 119.0 vs 120.9 ms, Silk Wet 41.9 vs 44.1 ms (edge off vs v242 edge on).
- 21:02 IST: after the skip change: vitest 495/495, water-edge-v243-browser + brush-blend-v242-browser + silk-wet visual PASS, build 0; old-file harness again old 80/80, oldv 36/36 identical, livefinal unchanged.
- 21:07 IST: final perf (perf243c, 3 interleaved): pen-up equal or lower on every case; p95 within one-frame steps; see perf243_medians.txt. Committing + pushing v0.5.243 (pt88u).
