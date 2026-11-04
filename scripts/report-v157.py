"""Summarize labeled shipped-project diagnostics; never substitute for sas_b15."""
from pathlib import Path
import json,statistics
root=Path(__file__).resolve().parents[1]
v=root/'validation'
files={tag:json.loads((v/f'v157-diagnostic-{tag}-app-performance.json').read_text()) for tag in ['before','after','cpu1','dpr1']}
def group(tag):
 out={}
 for row in files[tag]['rows']:out.setdefault((row['preset'],row['size']),[]).append(row)
 assert all(len(r)==3 for r in out.values()), 'Need exactly three repeats for each diagnostic case'
 assert not files[tag]['errors'],files[tag]['errors']
 assert all(not r['workerTimeout'] for r in files[tag]['rows'])
 return out
groups={k:group(k) for k in files}
def med(rows,key):
 vals=[]
 for r in rows:
  val=r
  for token in key.split('.'):val=val[token]
  vals.append(val)
 return statistics.median(vals)
def number(n):return f'{n:.1f}'
metrics=[('p95 frame','frame.p95'),('p95 input*','input.p95'),('Longest task','longestTaskMs'),('Pen-up 2 RAF','penUpMs'),('Tracked settle**','settledPenUpMs'),('Undo wall***','undoWallMs'),('Main reads','readbacks')]
lines=['# v0.5.157 performance status','','**Partial improvement; the requested lag targets are not all met.** Brush preservation and functional checks pass. These measurements must not be presented as the author’s acceptance benchmark.','','## Required acceptance benchmark','','The supplied report names `sas_b15_out/lib.mjs`, `matrix.mjs`, `dirty.mjs`, `livefinal.mjs`, `tables.md`, `proj/busy.solo.json` and `proj/busy10.solo.json`. Those files were not included or available. The reported Chrome 156 / CDP 200 Hz, 30 brush-size combinations and busy10 comparison could not be run.','','| Requested metric | v156 from the user’s report, median 3 | v157 in that exact harness |','|---|---|---|','| Frame p95 ≤20 ms | 67–233 ms | Not measured; harness absent |','| Pen-up ≤50 ms | 299–635 ms | Not measured; harness absent |','| Undo ≤50 ms | 97–6867 ms | Not measured; harness absent |','| Longest task ≤50 ms | 219–613 ms | Not measured; harness absent |','','The user’s numbers above were not mixed with our local measurements. Exact dirty-area limits, first-stroke deadlines, Pencil worker reply ≤16 ms, the author’s live/final test and busy10 acceptance remain unverified. The shipped diagnostics below also exceed the frame/pen-up targets.','','## Separate shipped-project diagnostic: same local browser before and after','','Method: `tests/performance-v157-app.mjs`, based on the app’s existing v156 diagnostic. Production builds, headless Chromium 133, software Canvas/GPU disabled, 2048×1152 viewport, DPR2, CPU4 throttle; 1920×1080, six layers, 281 saved strokes. Two hundred synthetic DOM pen samples over one second, coalesced into the next RAF. **Not CDP pen delivery and not the unavailable busy/busy10 project.** Four representative preset-size pairs, three repetitions each. Builds assert the source digest before running. Timing jobs run alone, sequentially.','','Every displayed diagnostic number is the median of three runs of the per-run metric, not a pooled percentile. Extremely slow runs can contain only a few presentation frames; their p95 is correspondingly coarse. Numbers are specific to this headless host.','','| Preset | Size | '+' | '.join(n+' v156 → v157' for n,k in metrics)+' |','|---|---|'+'|'.join(['---']*len(metrics))+'|']
summary=[]
for case,before in groups['before'].items():
 after=groups['after'][case]
 row={'preset':case[0],'size':case[1],'metrics':{key:{'v156':med(before,key),'v157':med(after,key)} for _,key in metrics}}
 summary.append(row)
 lines.append('| '+case[0]+' | '+str(case[1])+' | '+' | '.join(number(med(before,k))+' → '+number(med(after,k)) for _,k in metrics)+' |')
lines += ['','The measured frame p95 worsened for Pencil and Dry Ink in this diagnostic. Those regressions remain a performance concern; this build is not certified as faster for every brush. Pen-up and Undo gains must not be presented as universal frame-rate gains.','','All durations are milliseconds. Main reads are counts per stroke, including release; only the four supported blending worker paths promise zero main-thread per-dab reads. Pencil and Solid Paint still use their original live pigment implementation.','','* Input is the app’s latest-dispatched-sample to canvas-refresh instrumentation. It does not measure real Wacom latency or prove that the freshest asynchronous pigment result is visible.','** Tracked settle waits for outstanding Pencil/LiveBlend worker messages plus two RAFs. It does not track the separate InkDisplay worker. Pen-up is two RAFs after release, not a universal canonical-final deadline.','*** Undo wall includes Playwright click/automation and two presentation RAFs. It is deliberately not reported as the tile-blit function’s execution time. Native blit hits and exact pixels are checked separately.','','## Additional v157 configurations, median 3','','Same diagnostic, four representative presets; no v156 run for these configurations.','','| Configuration | Preset | Size | '+' | '.join(n for n,k in metrics)+' |','|---|---|---|'+'|'.join(['---']*len(metrics))+'|']
for tag,label in [('cpu1','DPR2 CPU1'),('dpr1','DPR1 CPU4')]:
 for case,rows in groups[tag].items():lines.append('| '+label+' | '+case[0]+' | '+str(case[1])+' | '+' | '.join(number(med(rows,k)) for _,k in metrics)+' |')
lines += ['','## What remains expensive','','- Full/first/settled scene presentation, native finishing and layer copies remain material costs. Tiled native history restoration alone does not make the entire displayed Undo complete in 50 ms.','- Canvas scan conversion requires the fixed left clip origin for exact output. Full first frames and separate layer blend operations are retained. The requested tight dirty-box and no-full-frame conditions are not claimed.','- The worker avoids blocking input with blending readbacks, but it can lag behind incoming samples. It coalesces pending updates instead of growing a queue. Consecutive strokes can force an exact synchronous fallback.','- Idle ink warm-up is implemented; a universal ≤50 ms first-stroke task is not proven.','- Unsupported/mirrored worker paths and budget-evicted history still use canonical synchronous work.','- The exploratory 27-stroke run before the final settled-upper-cache change is not release evidence and is excluded from these tables.','','## Functional evidence','','See `v157-verification.md`, all final v157 logs/JSON, `UPDATE_v0.5.157.md` and `CHANGES.md`. Brush math and all frozen expected hash fixtures are unchanged. No real Wacom or Radeon GPU was tested.']
(v/'v157-performance-results.md').write_text('\n'.join(lines)+'\n')
(v/'v157-performance-summary.json').write_text(json.dumps({'method':'Separate shipped project diagnostic; NOT sas_b15 acceptance harness','medianOf':3,'comparison':summary},indent=2)+'\n')
print('Created labeled median-of-three diagnostic report; official acceptance remains unverified.')
