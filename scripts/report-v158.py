from pathlib import Path
import json,statistics as st
root=Path(__file__).resolve().parents[1];v=root/'validation'
def read(name):
 x=json.loads((v/name).read_text());assert not x['errors'];assert all(not r['workerTimeout']for r in x['rows']);groups={}
 for r in x['rows']:groups.setdefault((r['preset'],r['size']),[]).append(r)
 assert all(len(a)==3 for a in groups.values());return groups
sets={k:read('v158-'+k+'.json')for k in ['controlled-before','controlled-after','coalesced-before','coalesced-after','coalesced-cpu1','coalesced-dpr1']}
def m(rows,key):
 a=[]
 for r in rows:
  for k in key.split('.'):r=r[k]
  a.append(r)
 return st.median(a)
def table(before,after,metrics):
 lines=['| Brush | Size | '+' | '.join(label+' v157 → v158'for label,k in metrics)+' |','|---|---|'+'|'.join(['---']*len(metrics))+'|']
 for case,b in sets[before].items():
  a=sets[after][case];lines.append('| '+case[0]+' | '+str(case[1])+' | '+' | '.join(f'{m(b,k):.1f} → {m(a,k):.1f}'for label,k in metrics)+' |')
 return lines
lines=['# v0.5.158 performance results','','**The update reduces routine brush work. The 20 ms frame / 50 ms release targets are still not met in this headless CPU4 test.** No universal lag-free or hardware-Wacom claim is made.','','## Method and comparability','','Both versions run in the same local Chromium 133, headless with GPU disabled, production builds validated against their source digest. Viewport 2048×1152, DPR2, CPU throttle 4×. The shipped fixture has 281 strokes, six layers and a 1920×1080 document. Timing jobs run sequentially, without builds or other test jobs. Each table cell is the median of three per-run metrics. Native `getImageData` readbacks are counted on the main thread. All durations are milliseconds.','','CPU profiles were used for discovery and are not included in these timing tables. The author’s original CDP `sas_b15_out` harness, exact busy/busy10 projects and its 30-case matrix remain unavailable. These are separately labeled shipped-project diagnostics, not substitutes for that acceptance test.','','## Controlled input: same work every frame','','Two hundred pen samples, five samples per animation frame, produce 40 move frames in every case. Geometry, pressure, event timestamps and batch sizes match between versions. If the application is slow, elapsed time grows; this is a throughput diagnostic, not a claim of real-time 200 Hz hardware delivery. This avoids comparing p95 values based on only two or three frames.','','The background restore, narrower Pencil contact rectangle and conservative Dry capsule bounds preserve tested pixels. The mean and median frame gains do not eliminate long first/settled frames.','']
controlled=[('Frame p50','frame.p50'),('Frame p95','frame.p95'),('Frame mean','frame.mean'),('Raster mean','raster.mean'),('Composition mean','composition.mean'),('Input p95*','input.p95'),('Pen-up 2RAF','penUpMs')]
lines+=table('controlled-before','controlled-after',controlled)
lines+=['','## Existing coalesced-input diagnostic','','The shipped v157-style diagnostic sends the same 200 synthetic DOM pen samples over one second, coalescing them into the next RAF. Slow runs can contain few frames, so p95 is coarse and burst size varies with frame cost. These results are reported separately from the controlled comparison.','']
coalesced=[('Frame p95','frame.p95'),('Input p95*','input.p95'),('Longest task','longestTaskMs'),('Pen-up 2RAF','penUpMs'),('Tracked settle**','settledPenUpMs'),('Undo wall***','undoWallMs'),('Main reads','readbacks')]
lines+=table('coalesced-before','coalesced-after',coalesced)
regressed=[]
for case,b in sets['coalesced-before'].items():
 if round(m(sets['coalesced-after'][case],'frame.p95'),1)>round(m(b,'frame.p95'),1):regressed.append(case[0])
lines+=['',('Observed coalesced frame-p95 regressions: '+', '.join(regressed)+'. These remain visible in the table and are not hidden by the controlled averages.')if regressed else'All four measured coalesced frame-p95 medians improved or remained equal at the displayed precision; this does not certify unmeasured brushes or hardware.','','* Input is latest-dispatched-sample to canvas submission, not display scanout or physical pen latency. An asynchronous canvas refresh need not contain the freshest worker pigment.','** Tracked settle waits for Pencil/LiveBlend worker messages plus two RAFs; the separate InkDisplay worker is not tracked. The two-RAF release metric is not a universal canonical-finish deadline.','*** Undo wall includes automation and presentation, not only native history blits.','','## Additional v158 configurations, median of three','','Pencil and Dry Ink at size 150 in the coalesced diagnostic; no additional v157 comparison for these configurations.','','| Configuration | Brush | Frame p95 | Raster mean | Pen-up 2RAF | Tracked settle | Undo wall |','|---|---|---|---|---|---|---|']
for key,label in [('coalesced-cpu1','DPR2 CPU1'),('coalesced-dpr1','DPR1 CPU4')]:
 for case,rows in sets[key].items():lines.append('| '+label+' | '+case[0]+' | '+' | '.join(f'{m(rows,k):.1f}'for k in ['frame.p95','raster.mean','penUpMs','settledPenUpMs','undoWallMs'])+' |')
lines+=['','## Verification and remaining cost','','- 385 unit tests, 63 regression scripts, TypeScript and the production build pass.','- The actual optimized capsule integrator matches the frozen v157 integrator in 1,000 deterministic property cases.','- 90 Pencil/Dry cases, 1,170 growing frames and 90 finished renders match v157 exactly across six sizes and three paths.','- Historical 520-case, saved v147, legacy, worker, native commit, mirror, Undo/Redo, reload, 4K, zoom and animation checks pass. See UPDATE_v0.5.158.md and the included raw JSON/logs.','- First/full/settled scene composition remains expensive. The fixed left clip origin and separate blend operations are retained for pixel accuracy.','- Pixel-exact canonical finishing, pending-worker fallback and budget-evicted history replay can still exceed one frame.','- The original external acceptance harness, real Wacom input, iMac/Radeon GPU and the user’s own browser/hardware have not been tested.']
(v/'v158-performance-results.md').write_text('\n'.join(lines)+'\n');print('Wrote median-of-three performance tables with limits and regressions retained.')
