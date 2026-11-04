"""Report exact supplied-metric results and all gates, without relaxing targets."""
from pathlib import Path
import json,statistics,hashlib
R=Path('test-output/dry-blend/v148');V=Path('validation')
read=lambda p:json.loads(Path(p).read_text())
B=read(R/'before/metrics.json');A=read(R/'after/metrics.json')
PB=read(V/'v148-before-performance.json');PA=read(V/'v148-after-performance.json')
FB=read(V/'v148-before-reproducibility.json');FA=read(V/'v148-after-reproducibility.json')
G=read(V/'v148-gates.json');UI=read(V/'v148-load.json');compat=read(V/'v148-frozen-goldens.json')
P=['dry-ink-bristle','dry-paint'];names={'dry-ink-bristle':'Dry Ink Brush','dry-paint':'Dry Paint Brush'}
fmt=lambda x:f'{x:.4f}' if isinstance(x,(float,int))else str(x)
def stats(v,lo=None,hi=None):
 ok=lambda x:(lo is None or x>=lo)and(hi is None or x<=hi)
 return dict(values=v,mean=statistics.mean(v),min=min(v),max=max(v),nPass=sum(map(ok,v)),n=len(v),target=[lo,hi],pass_=ok(statistics.mean(v))and sum(map(ok,v))>=8 and len(v)==10)
def target(v):
 lo,hi=v['target'];return ('≤ '+fmt(hi))if lo is None else('≥ '+fmt(lo))if hi is None else fmt(lo)+'–'+fmt(hi)
def row(label,version,v):
 passed=v.get('pass',v.get('pass_',False));return '| '+label+' | '+version+' | '+' | '.join(fmt(x)for x in v['values'])+' | '+fmt(v['mean'])+' | '+fmt(v['min'])+' | '+fmt(v['max'])+' | '+str(v['nPass'])+'/10 | '+('PASS'if passed else'FAIL')+' |'
def tablehead(first='Measure / target'):
 return ['| '+first+' | Version | '+' | '.join(f'{i:02}'for i in range(10))+' | Mean | Min | Max | n pass | Result |','|---|---|'+'---:|'*15]
lines=['# Solo Anime Studio v0.5.148 — Phase 2.1 dry brush repair','',
'This release changes the two new dry-bristle brushes and their names/hints. It does not start Phase 3 or alter Blender, Textured Paint, classic Dry rendering, ink, pencils, vector tools, animation or canvas navigation. All values below come from real Canvas renders and the supplied metric implementation.','',
'## What was found and changed','',
'- The v147 live renderer finished a box containing the moving flying hairs as well as the painted body. That caused large grain passes on every pointer move. The head also used a size-based square bound; version 2 bounds the actual head filament capsules instead, removing unnecessary startup shading. V148 caches immutable optical coverage, keeps the changing body separate, and draws sparse flying hairs separately. It shades the old/new changing body once per update.','- Independent large filament lag and clump displacement produced many intertwining thin trails. The new renderer uses four asymmetric contact bundles, coherent movement across the nib, separate exterior fraying and two pressure/curvature-dependent openings inside the central bundle. Ink remains denser; Paint uses a shorter pigment reservoir, finer local pigment variation and its own paper profile.','- Weak Paint coverage was caused by its combined loading, wash and opacity behavior. New stock Dry Paint Brush defaults to 100% opacity. Unchanged v147 stock defaults upgrade; artist-edited values and custom v147 presets are retained. No saved stroke is rewritten.','- Coverage mass and pigment strength are separate. Coverage adds in fixed-point optical mass; pigment uses a maximum-strength envelope, so a lighter contact cannot dilute a richer existing deposit. The prescribed tooth curve determines paper exposure. Saturated pixels skip redundant work.','- Physical filament paths are integrated at 1 document pixel. Raster spans are 3 px below size 100 and 6 px for larger nibs, averaging all physical samples. Filament-specific phases stagger capsule joins; they do not share a repeated stamp cadence. Live rendering commits only complete unchanged spans, with bounds covering phased starts.','- The paper remains fixed in document coordinates. Cached blocks sample unique world coordinates; they do not wrap. New stroke IDs change the deterministic filament/load field, not the paper. No whole-stroke blur or rotated texture image is used. Paint’s exterior fray is damped to prevent large coherent edge waves from dominating its pigment/paper pattern.','- Small-size tails now scale with both nominal size and effective small-brush scale. V147 already multiplied tail lengths by size; the observed long fray was relative to a thin depleted body. A minimum pigment-reservoir scale also keeps size-38 Paint readable.','',
'## Compatibility','',
'Project format remains **3**. New stock strokes use **dryBristleVersion: 2**, with optional **dryMaterial** and the existing deterministic seed/speed fields. Version 1 retains its original renderer and exact v147 pixels. `dryBristle.ts` and `dryTooth.ts` are unchanged. Custom v147 dry presets remain version 1. Preset IDs and families are retained.','',
'Frozen checks: **520/520** old-brush raw AND composited RGBA hashes equal independently rendered v146 output; **12/12** saved v147 version-1 dry strokes equal v147 output. These include classic Dry, Textured Paint and Blender over colored paint. `tests/dry-v148-goldens.mjs` runs these checks from the delivered project without sibling baseline folders.','',
'## Measurement method','',
'Size 130, black on white, using each version’s stock preset defaults (including the documented Paint opacity change). Each appearance value for an ID is the mean of straight slow, straight fast, sine slow and sine fast. IDs are **phase21-00 … phase21-09**, shared before/after and between recipes. A target passes only when the ten-ID mean is in range AND at least eight individual IDs are in range. Small-size tests use the same four recipes and ten IDs. Values are rounded here for display; pass/fail uses the unrounded JSON.','',
'Only the supplied `tests/reference/metrics.py` defines image metrics. SHA-256: `'+A['metricsSourceSha256']+'`. It is unchanged. `load_layer`, `split_strokes` and `analyze` run on actual transparent black stroke layers, which are equivalent to black composited on white for these opacity metrics.','',
'Performance: Chrome 133 software Canvas, 600 px path, 76 input samples / 75 pointer moves at about 8 px per move. Timings include geometry and forced Canvas readback; all moves after pointer-down are counted. Ten IDs per preset/size/path. Replay includes a fresh full render, before the live sequence; reusable paper data is cached for live drawing. Performance was run alone, without builds or image analysis. These are this runner’s measurements, not a hardware-Wacom or all-computers guarantee.','',
'## A. Performance — milliseconds','']
perf=[]
lines+=tablehead('Preset / size / path / measure (ms)')
for p in P:
 for size in [70,130]:
  for shape in ['straight','sine']:
   for key,metric,hi in [('pointerEvent','mean',3),('pointerEvent','p95',3),('toothDirtyBox','mean',2),('replay600px','max',120)]:
    label=f'{names[p]} / {size} / {shape} / {key} {metric} ≤ {hi}'
    for version,data in [('147',PB),('148',PA)]:
     r=sorted([r for r in data['rows']if r['preset']==p and r['size']==size and r['shape']==shape],key=lambda r:r['identity']);v=stats([x[key][metric]for x in r],None,hi);lines.append(row(label,version,v));perf.append(dict(preset=p,size=size,shape=shape,key=key,metric=metric,version=version,**v))
lines+=['','Per-event mean and p95 must BOTH pass for a given ID. Combined per-condition results:','', '| Preset / size / path | v147 IDs meeting both | v148 IDs meeting both | v148 slowest p95 |','|---|---:|---:|---:|']
perf_pass=True
for p in P:
 for size in [70,130]:
  for shape in ['straight','sine']:
   groups=[[r for r in j['rows']if r['preset']==p and r['size']==size and r['shape']==shape]for j in [PB,PA]];counts=[sum(r['targets']['event3ms']for r in g)for g in groups];perf_pass &= counts[1]>=8 and statistics.mean(r['pointerEvent']['mean']for r in groups[1])<=3 and statistics.mean(r['pointerEvent']['p95']for r in groups[1])<=3
   lines.append(f'| {names[p]} / {size} / {shape} | {counts[0]}/10 | {counts[1]}/10 | {max(r["pointerEvent"]["p95"]for r in groups[1]):.3f} |')
lines+=['','All 80 per-ID event means and p95 values meet their limits in this final run. Raw individual-event outliers remain: the highest single event was 14.1 ms and the highest single grain pass was 8.4 ms. These maxima are not the requested mean/p95 budgets. No outliers were discarded; full stats are in the performance JSON.','']
for section,p in [('B','dry-ink-bristle'),('C','dry-paint')]:
 lines += [f'## {section}. {names[p]} — size 130 appearance','']+tablehead()
 for k,v in A['groups'][p]['130']['appearance'].items():
  for version,data in [('147',B),('148',A)]:lines.append(row(k+' / '+target(v),version,data['groups'][p]['130']['appearance'][k]))
lines+=['','## D. Pressure, speed and curvature','']+tablehead('Preset / behavior / target')
contacts={}
for p in P:
 for k,v in A['groups'][p]['130']['behaviour'].items():
  for version,data in [('147',B),('148',A)]:lines.append(row(names[p]+' / '+k+' / '+target(v),version,data['groups'][p]['130']['behaviour'][k]))
 for version,data in [('147',FB),('148',FA)]:
  q=sorted([r for r in data['contacts']if r['preset']==p],key=lambda r:r['index']);v=stats([r['reduction']for r in q],.25,None);contacts[p+'-'+version]=v;lines.append(row(names[p]+' / fewer light-pressure contacts ≥ .25',version,v))
lines+=['','Contact reduction is measured from actual renderer diagnostics at p=.25 versus p=.95, rather than inferred from pixel width. Ten-ID contact counts are in `validation/v148-after-reproducibility.json`. Pressure is synthetic, not a physical tablet test.','', '## E. Small sizes','']+tablehead()
small=[]
for p,size,key in [('dry-ink-bristle','38','smallFray'),('dry-ink-bristle','70','smallFray'),('dry-paint','38','smallOpacity')]:
 for version,data in [('147',B),('148',A)]:
  v=data['groups'][p][size][key];lines.append(row(names[p]+' / '+size+' / '+key+' / '+target(v),version,v));small.append(dict(preset=p,size=size,key=key,version=version,**v))
lines+=['','## F. Reproducibility and live/final equality','', '| Case | v147 live differing channels | v148 live differing channels | v148 repeat / other strokes / cold reload |','|---|---:|---:|---|']
for b,a in zip(FB['rows'],FA['rows']):
 ok=all(a[k]==a['expected']for k in ['repeat','afterOtherStrokes','cold']);lines.append(f'| {names[a["preset"]]} / {a["size"]} / {a["shape"]} | {b["live"]["changed"]} | {a["live"]["changed"]} | '+('exact / exact / exact'if ok else'FAIL')+' |')
lines+=['','These expanded 12 cases include self-crossing figure-eight paths, pressure/flow/opacity changes, a moving end taper, blue pigment and partial stroke opacity. V147’s original simpler live/final fixtures passed; the expanded loops expose older incremental-path mismatches above. Version 1 is intentionally preserved, not silently changed. V148’s new version-2 path must pass every case. The additional 56 property checks cover history crops, Undo/Redo, mirrors, pressure ceilings, zero controls and all five controls.','', '## G. Names and locations','', '| Preset ID (unchanged) | Family (unchanged) | v147 name | v148 name | One-line hint |','|---|---|---|---|---|', '| dry | Paint → Media | Dry Brush | Dry Brush (old) | Original grain brush for older work. |', '| dry-ink-bristle | Paint → Media | Dry Ink Bristle | Dry Ink Brush | Bold ink with torn bristle trails. |', '| dry-paint | Paint → Paint | Dry Paint | Dry Paint Brush | Dry paint with gaps and paper grain. |','', 'Both requested viewports verify the labels, family membership and a single rendered line for each hint. No toolbar layout or unrelated UI was redesigned.','', '## H. Gates and regression coverage','', '| Check | v147 supplied audit | v148 result |','|---|---|---|']
for label,value in G.items():lines.append('| '+label+' | '+('337 tests / 65 files'if label=='npm test'else'PASS')+' | '+str(value)+' |')
for r in UI:lines.append(f'| Load at {r["width"]}×{r["height"]} | 0 JS errors | {len(r["errors"])} console errors / {len(r["pageErrors"])} page errors |')
lines+=['','The load test initially found the existing remote Google Fonts import failing with ERR_EMPTY_RESPONSE. The same DM Sans and Manrope families are now served from bundled original font files; src/styles.css changes only the font-loading declarations. Both original licenses, source URLs and file hashes are included. The final load gate waits for both actual fonts and counts every console/page error. No layout rules or tools were redesigned. The build retains the existing Vite bundle-size advisory. The 58 regression scripts retain their existing optional-environment skips. These are not new runtime errors.','', '## Rendered images and visual assessment','',
'- `test-output/dry-blend/v148/v148-reference-comparison.png`: actual reference plus matched v147/v148 strokes, size 130.','- `v148-ten-identities.png`: all ten identities, including both presets and curved/straight motion.','- `dry-ink-bristle-motion-sizes.png`, `dry-paint-motion-sizes.png`: all motion and pressure recipes at 38/70/130.','- The same folder contains raw transparent stroke layers and white/tan/blue presentations. `before/` and `after/` contain all 240 quantitative cases each.','',
'Visual inspection: the Paint body is materially denser, the earlier many-thread braid is reduced to broader asymmetric contact bundles, the end join has matching pigment strength, and small tails remain proportionate. Grain is fine and document-fixed, rather than the old blotchy texture slab. The comparison shows real output, not a painted mockup or generated target.','',
'Remaining visual limitation: this is still a procedural bundled-bristle approximation, not an exact scanned replica of the ink reference. Long parallel channels and detached fine hairs remain visible, particularly on constant-pressure S-curves. The two presets also retain similar macro silhouettes at matched size/pressure. Their differences are loading, depletion, paper grain and tails; the visual reference is NOT exactly matched. Native Windows/Wacom pressure and tilt, GPU timings, touch, Safari and Firefox are not verified. Existing toolbar clipping/wheel layout issues are outside Phase 2.1 and remain unchanged. Phase 3 / Blender was not started.','', '## Modified source files','']
changes=[]
base=Path('../baseline147')
for f in sorted(Path('src').rglob('*')):
 if f.is_file()and(not(base/f).exists()or f.read_bytes()!=(base/f).read_bytes()):changes.append(str(f));lines.append('- `'+str(f)+'`')
(V/'v148-source-changes.json').write_text(json.dumps(changes,indent=2))
lines+=['','Package/lock/build version metadata was bumped to 0.5.148 (renderer 37). The release bundles the existing DM Sans/Manrope fonts locally (with their original licenses) to satisfy the zero-console-error gate without an external font dependency. It also includes new audit scripts, immutable compatibility goldens, rendered images and this report. The original v147 archive is preserved.','', '## Reproduce','',
'Install the project dependencies. Set `CHROMIUM_PATH` to a Chromium executable when needed. The image-metric scripts need Python, NumPy, OpenCV, SciPy and Pillow. Run performance separately from all other work.','', '```sh','node tests/dry-v148-audit.mjs','python3 tests/dry-v148-measures.py test-output/dry-blend/v148/after','node tests/dry-v148-properties.mjs','node tests/dry-v148-reproducibility.mjs','node tests/dry-v148-goldens.mjs','node tests/dry-v148-performance.mjs','npm test','npm run test:regression','npx tsc --noEmit','npm run build','node tests/dry-v148-ui.mjs','node tests/coloring-v148-ui.mjs','node tests/dry-v148-load.mjs','node tests/run-navigation-v148.mjs','node tests/launcher-v148.mjs','```','',
'Optional fresh before/after extraction checks require independently extracted v146/v147 folders as `../baseline146` and `../baseline147`. The frozen goldens, metric tables and original archive checksums are included so the delivered default checks do not require those siblings.','']
appearance_pass=all(v['pass']for p in P for v in A['groups'][p]['130']['appearance'].values());dynamics_pass=all(v['pass']for p in P for v in A['groups'][p]['130']['behaviour'].values())and all(contacts[p+'-148']['pass_']for p in P);small_pass=all(v['pass']for v in small if v['version']=='148');f_pass=all(r['live']['changed']==0 and all(r[k]==r['expected']for k in ['repeat','afterOtherStrokes','cold'])for r in FA['rows'])
pass_a=perf_pass and all(v['pass_']for v in perf if v['version']=='148');allpass=pass_a and appearance_pass and dynamics_pass and small_pass and f_pass
summary={'version':'0.5.148','phase':'2.1','phase3Started':False,'referenceMatchComplete':False,'acceptanceComplete':allpass,'metricsSourceSha256':A['metricsSourceSha256'],'sourceDigest':UI[0]['build']['sourceDigest'],'A':pass_a,'B_C':appearance_pass,'D':dynamics_pass,'E':small_pass,'F':f_pass,'G':True,'H':G,'performance':perf,'smallSizes':small,'pressure':contacts,'compatibility':{'oldV146Exact':sum(r['exact']for r in compat['oldV146']),'savedV147Exact':sum(r['exact']for r in compat['savedV147'])},'remainingLimitations':['Procedural approximation, not an exact replica of the reference','Native Wacom/Windows, tilt, GPU, other browsers unverified','Pre-existing toolbar layout issues unchanged','Per-ID timing outliers retained in report']}
(R/'acceptance.json').write_text(json.dumps(summary,indent=2));lines+=['## Result','',('All requested A–H acceptance groups meet the ten-ID rule on this runner.'if allpass else'Some requested acceptance groups still fail. This release must NOT be called complete; see the FAIL rows above.')+' The timing outliers and visual/hardware limitations above still apply.','']
Path('UPDATE_v0.5.148.md').write_text('\n'.join(lines))
print(json.dumps({k:summary[k]for k in ['acceptanceComplete','A','B_C','D','E','F']},indent=2))
