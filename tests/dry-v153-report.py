from pathlib import Path
import json,hashlib,statistics
ROOT=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((ROOT/p).read_text())
before=read('test-output/v153/before/metrics.json');after=read('test-output/v153/after/metrics.json')
lines=['# Solo Anime Studio v0.5.153 — verified update and remaining limits','','30 October 2026 (IST). Baseline: the original v0.5.152 source archive.','','**Status:** functional checks pass; drawing and redraw costs are lower. This is **not a complete reference-match or zero-stutter sign-off**. Maximum-size painting and isolated latency spikes remain open.','',
'## A. What changed and why','',
'The old live path regenerated endpoint-dependent noise, pressure and bristle trajectories across a wide tip window on each move. Stable body bounds were also rescanned, live density buffers were discarded between strokes, and unchanged saved strokes rebuilt their pigment buffers on redraw. Those costs explain the slowdown found in the report.','',
'New renderer 3 separates stable contact trajectories from changing release. It caches coherent stroke-space fibre fields and per-bristle release curves, reuses live buffers, updates bounds incrementally, and caches a bounded crop of the saved pigment body. Geometry/settings edits invalidate that crop. Native hairs render in full document coordinates: caching their translated raster introduced a one-pixel coloured loop mismatch, which was found and corrected.','',
'Dry Ink clumps now merge more often through curves, with less forced separation. Fine path-following tapered hairs and local end flecks remain inside the travelled path. Paint keeps its heavier contact character. Paper stays anchored to the document and seeds remain stored with each stroke. Smoothing, stabilization and pressure capture retain their existing algorithms.','',
'## B. Existing drawing safety','',
'New stock Dry Ink and Dry Paint strokes use `dryBristleVersion: 3`. Existing version-1 and version-2 operations keep their original routes; the v1/v2 renderer files and shared paper implementation are byte-identical to v0.5.152. Customized v1/v2 presets keep their versions. The editable project format is still 3. New renderer-3 drawings require v0.5.153 or newer.','',
'This preserves the appearance already shown by v0.5.152. Earlier v148–v151 code had changed version-2 appearance without recording the application minor version per stroke; this update does not reconstruct those older appearances automatically.','',
'## C. Automated and real-app checks','',
'- 347/347 unit tests and 58/58 regression scripts pass.','- Production build and launcher/source-digest checks pass.','- 520/520 old-brush golden cases, 12 earlier saved-v1 goldens, and 24 v1 + 24 v2 independently captured saved strokes match their expected pixels.','- 12 normal-size and 4 maximum-size cases pass deterministic repeat, cache eviction, cold reload and exact live/final comparisons.','- 60 replay/history/pressure/zero-control/mirror checks pass, including geometry edits invalidating the completed body cache.','- Production pen-event tests pass preset switching, captured pressure/velocity, Undo/Redo, mirror and save/reload. PNG exports are pixel-identical at 50%, 100%, 200% and 800% zoom.','- 11 navigation/eraser/zoom/flat-paint/transform browser checks pass.','- Production load at 1280×720 and 1920×1080 has zero page/console errors.','',
'## D. Performance observations','',
'Chromium 133 on Linux, with GPU disabled, on the test host. These are browser observations, not Wacom hardware measurements. Timers include geometry and forced canvas readback. Baseline and update use the same harness. The drawing tests reuse one live raster and canvas, as the app does. The continuous stress run has no frame pauses; the interactive run yields one animation frame between moves. P95 below is the **mean of each stroke’s p95**, not a pooled percentile.','',
'| Test | v152 mean move ms | v153 mean move ms | v152 mean stroke p95 ms | v153 mean stroke p95 ms | v153 worst event ms |','|---|---:|---:|---:|---:|---:|']
for suffix,label in [('performance','Continuous stress, 70/130 px, 80 strokes'),('maximum-performance','Continuous stress, 600 px, 8 strokes'),('interactive-performance','Frame-paced drawing, all sizes, 24 strokes')]:
 a=read('validation/v153-before-'+suffix+'.json')['rows'];b=read('validation/v153-after-'+suffix+'.json')['rows']
 avg=lambda r,k:sum(x['pointerEvent'][k]for x in r)/len(r)
 lines.append(f'| {label} | {avg(a,"mean"):.2f} | {avg(b,"mean"):.2f} | {avg(a,"p95"):.2f} | {avg(b,"p95"):.2f} | {max(x["pointerEvent"]["max"]for x in b):.2f} |')
lines+=['','Frame-paced drawing by size:','','| Size | v152 mean ms | v153 mean ms | v153 mean stroke p95 ms | v153 worst event ms |','|---|---:|---:|---:|---:|']
a=read('validation/v153-before-interactive-performance.json')['rows'];b=read('validation/v153-after-interactive-performance.json')['rows']
for size in [70,130,600]:
 aa=[x for x in a if x['size']==size];bb=[x for x in b if x['size']==size]
 lines.append(f'| {size} | {avg(aa,"mean"):.2f} | {avg(bb,"mean"):.2f} | {avg(bb,"p95"):.2f} | {max(x["pointerEvent"]["max"]for x in bb):.2f} |')
lines+=['','Long 2400 px stroke, size 130; ten IDs per brush, five fresh-layer redraws per ID. First render and cached redraw are reported separately.','','| Brush | v152 redraw mean / worst ms | v153 redraw mean / worst ms | v153 IDs with every redraw ≤120 ms | v153 first-render mean ms |','|---|---:|---:|---:|---:|']
a=read('validation/v153-before-long-replay.json');b=read('validation/v153-after-long-replay.json')
for preset in ['dry-ink-bristle','dry-paint']:
 aa=[x for x in a if x['preset']==preset];bb=[x for x in b if x['preset']==preset]
 lines.append(f'| {preset} | {statistics.mean(x["mean"]for x in aa):.2f} / {max(x["max"]for x in aa):.2f} | {statistics.mean(x["mean"]for x in bb):.2f} / {max(x["max"]for x in bb):.2f} | {sum(x["pass"]for x in bb)}/10 | {statistics.mean(x["cold"]["ms"]for x in bb):.2f} |')
lines+=['','**Open performance targets:** the strict 3 ms mean-and-p95 target is not met in every case. Maximum-size painting still has visible frame-budget spikes. The final long-stroke run also caught one Dry Paint redraw above 120 ms; this is retained in the results rather than discarded. Typical redraw cost is substantially lower, but neither the stress results nor the first-render costs justify a zero-lag claim.','',
'## E. Visual comparison and retained targets','',
'Inspected the actual before/after sheet, ten-ID sheet, broad overlaps, circular strokes, hooks and maximum-size output. The 240 after audit renders cover ten seeds × two presets × three sizes × straight/curve × slow/fast. Additional exercises cover pressure, colour, flow, vertical strokes, circles, hooks, broad areas and maximum size.','',
'Dry Ink now has finer interrupted channels through curves and more connected end detail. The examples do not show square tiles or detached forward hair clusters. Paint remains heavier. **The output still has more organized longitudinal structure and shorter tails than the photographed ink reference. Very large pressure-varying strokes can expose large clump separations.** Fine-hair, fleck, edge and other reference targets remain unmet; they are not dismissed as a cleaner style selected by the artist.','',
'The supplied `tests/reference/metrics.py` is unchanged; SHA-256 `bca694ce831a227be994c6f4b4a7107c30c6979abf3ee3b31b5085206cafa460`. No target was relaxed. A target passes only when its ten-ID mean is in range and at least eight IDs pass. Four stroke recipes are averaged per ID. The full per-ID data are in `test-output/v153/{before,after}/metrics.json`.','',
'| Size 130 target | Ink v152 → v153 mean (v153 IDs passing) | Paint v152 → v153 mean (v153 IDs passing) |','|---|---|---|']
for key in after['groups']['dry-ink-bristle']['130']['appearance']:
 cells=[]
 for preset in ['dry-ink-bristle','dry-paint']:
  a=before['groups'][preset]['130']['appearance'][key];b=after['groups'][preset]['130']['appearance'][key]
  cells.append(f'{a["mean"]:.3f} → {b["mean"]:.3f} ({b["nPass"]}/10; {"PASS"if b["pass"]else"OPEN"})')
 lo,hi=b['target'];target=f'{lo if lo is not None else "−∞"}…{hi if hi is not None else "+∞"}'
 lines.append('| '+key+' '+target+' | '+' | '.join(cells)+' |')
lines+=['','Small sizes (after; means across ten IDs):','','| Brush / size | Flecks | Hairlines | Perimeter / hull | Mean alpha |','|---|---:|---:|---:|---:|']
for p in ['dry-ink-bristle','dry-paint']:
 for size in ['38','70']:
  g=after['groups'][p][size]['appearance'];lines.append(f'| {p} / {size} | {g["flecks"]["mean"]:.2f} | {g["hairlines"]["mean"]:.2f} | {g["perim_ratio_hull"]["mean"]:.3f} | {g["mean_alpha_hull"]["mean"]:.3f} |')
lines+=['','## F. Toolbar and menu fixes','',
'All 12 inspector tools are visible and hittable at 1024×600, 1280×720 and 1920×1080 in Draw and Animate. Each of the twelve tested shortcuts highlights exactly one button. Tools stay above transform settings. Edit/Animation popups are viewport-bounded, scrollable, keyboard-navigable and their last enabled items are hittable. The existing wheel has a compact left-panel parking row; parking, expanding and dragging pass, and it no longer overlaps the Layers heading by default. User-chosen floating placement remains available.','',
'## G. Changed source files','']
base=ROOT.parent/'baseline152/Solo_Anime_Studio_v0_5_152'
for p in sorted((ROOT/'src').rglob('*')):
 if p.is_file():
  old=base/p.relative_to(ROOT)
  if not old.exists()or p.read_bytes()!=old.read_bytes():lines.append('- `'+str(p.relative_to(ROOT))+'`')
lines+=['','Also changed: `package.json`, `README.md`; added v153 browser/performance/render/report harnesses, saved-stroke goldens and comparison images. The two historic stock-contract tests now expect renderer 3 for future stock strokes; legacy golden values were not changed. New routing is required in shared dispatch, metadata, validation, crop padding, input and preview code so every entry point recognizes version 3. Old routes remain intact.','',
'## H. Files and remaining limits','',
'- `test-output/v153/Dry_Brush_v152_vs_v153.png`: photograph vs v152/v153, pressure and small sizes.','- `test-output/v153/ten-stroke-identities.png`: all ten IDs.','- `test-output/v153/areas-curves-maximum.png`: fills, overlaps, hooks, circles and 600 px marks.','- `test-output/v153/exercises/`: individual rendered exercises and captured stroke parameters.','- `validation/v153-*.json` and logs: detailed verification and observations.','',
'This is a procedural bristle engine, not an exact reproduction of scanned ink. Reference matching and maximum-size latency remain unfinished. Physical Wacom input, Windows/iMac performance and cross-browser pixel equivalence have not been established. Pixel determinism claims apply under identical rendering conditions.','',
'Rerun: `npm test`, `npm run test:regression`, `npm run build`; then use the `tests/dry-v153-*.mjs` harnesses with Playwright Chromium installed (or `CHROMIUM_PATH` set). Optional `--baseline` runs use `DRY_BASELINE_ROOT` or the documented extracted sibling folder. Python image analysis uses `tests/dry-blend-requirements.txt`. Frozen compatibility checks run without needing the old project.','']
(ROOT/'UPDATE_v0.5.153.md').write_text('\n'.join(lines))
print('Wrote report with actual successes and open targets.')
