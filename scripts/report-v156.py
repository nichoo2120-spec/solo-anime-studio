from pathlib import Path
import json, statistics
from PIL import Image, ImageDraw, ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path(__file__).resolve().parent.parent
v=root/'validation'
def rows(tag):return json.loads((v/f'v156-{tag}-app-performance.json').read_text())['rows']
before=rows('before-clean');after=rows('after-clean');stress_before=rows('before-stress-clean');stress_after=rows('after-stress-clean')
assert len(before)==len(after)==9 and len(stress_before)==len(stress_after)==3
for a,b in zip(before,after):assert a['preset']==b['preset']
for a,b in zip(stress_before,stress_after):assert a['preset']==b['preset']
labels={'hb':'HB Pencil','technical':'Technical Ink','dry-ink-bristle':'Dry Ink','color-solid':'Solid Paint','smudge-bristle':'Smudge Bristle','blender-soft':'Blender Soft','wet-mix':'Wet Mix','color-blender':'Classic Blender','eraser-hard':'Hard Eraser'}
fig,ax=plt.subplots(figsize=(11,6.6));y=list(range(len(before)));bar=.36
ax.barh([i-bar/2 for i in y],[r['frame']['p95'] for r in before],height=bar,label='v0.5.155',color='#8a98a7')
ax.barh([i+bar/2 for i in y],[r['frame']['p95'] for r in after],height=bar,label='v0.5.156',color='#12a6ac')
ax.set_yticks(y,[labels[r['preset']] for r in before]);ax.invert_yaxis();ax.set_xlabel('95th percentile frame interval (ms) — lower is better');ax.set_title('Brush responsiveness in a dense drawing',loc='left',weight='bold',fontsize=15)
ax.grid(axis='x',alpha=.16);ax.set_axisbelow(True);ax.legend(loc='upper right',bbox_to_anchor=(1,1.08),ncol=2,frameon=False);ax.spines[['top','right']].set_visible(False)
fig.text(.11,.01,'Single paired run per brush · 281 strokes / 6 layers · software canvas · DPR 2\nPencil follow-up: 3 runs per version had a median p95 of 33 ms; one v156 run reached 50 ms.',fontsize=8.5,color='#46596b')
fig.tight_layout(rect=(0,.07,1,1));fig.savefig(root/'performance_v156.png',dpi=140);plt.close(fig)
before_image=Image.open(v/'v156-before-smudge-output.png').convert('RGB');after_image=Image.open(v/'v156-after-smudge-output.png').convert('RGB')
sheet=Image.new('RGB',(before_image.width*2+36,before_image.height+65),'white');draw=ImageDraw.Draw(sheet)
try:font=ImageFont.truetype('DejaVuSans-Bold.ttf',22)
except OSError:font=ImageFont.load_default()
draw.text((18,12),'v0.5.155 — before',fill='#142b40',font=font);draw.text((before_image.width+18,12),'v0.5.156 — after',fill='#142b40',font=font)
sheet.paste(before_image,(0,60));sheet.paste(after_image,(before_image.width+36,60));sheet.save(root/'blender_v156_comparison.png')
normal='\n'.join(f"| {labels[a['preset']]} | {a['frame']['p50']:.1f} → {b['frame']['p50']:.1f} | {a['frame']['p95']:.1f} → {b['frame']['p95']:.1f} | {a['composition']['p50']:.1f} → {b['composition']['p50']:.1f} | {a['frame']['n']} / {b['frame']['n']} |" for a,b in zip(before,after))
stress='\n'.join(f"| {labels[a['preset']]} | {a['frame']['p95']:.1f} → {b['frame']['p95']:.1f} | {a['composition']['p50']:.1f} → {b['composition']['p50']:.1f} | {a['penUpMs']:.1f} → {b['penUpMs']:.1f} | {a['frame']['n']} / {b['frame']['n']} |" for a,b in zip(stress_before,stress_after))
mini_before=json.loads((v/'v156-before-smudge-performance.json').read_text())['rows'];mini_after=json.loads((v/'v156-after-smudge-performance.json').read_text())['rows']
def mini(r,p,s):return [x for x in r if x['preset']==p and x['size']==s]
minit='\n'.join(f"| {labels[p]} | {s} | {statistics.median(x['p95'] for x in mini(mini_before,p,s)):.1f} → {statistics.median(x['p95'] for x in mini(mini_after,p,s)):.1f} | {mini(mini_before,p,s)[0]['reads']} → {mini(mini_after,p,s)[0]['reads']} |" for p in ['smudge-bristle','blender-soft','wet-mix','color-blender'] for s in [30,130])
animation=lambda tag:json.loads((v/f'v156-animation-{tag}.json').read_text())['frameMs']
a0,a1,a2,a3=(animation(tag) for tag in ['before1','before2','after1','after2'])
pencil_before=rows('before-pencil-check');pencil_after=rows('after-pencil-check')
pb=statistics.median(r['frame']['p95'] for r in pencil_before);pa=statistics.median(r['frame']['p95'] for r in pencil_after)
report=f'''# Solo Anime Studio v0.5.156 — Brush responsiveness

**Baseline:** v0.5.155. This update targets the specific costs found during brush-lag profiling. It improves several expensive paths, but it does **not** eliminate all lag. Physical Wacom and iMac testing is still needed.

## What was found and changed

1. The classic Blender copied an increasingly large portion of the stroke into a checkpoint every few dabs. Newer wet smudges also read a separate undo patch for every dab. A bounded rollback cache now saves smaller contact-region patches for groups of dabs, together with the matching pigment state. It retains up to 64 entries and 16 MiB of pixel patches per gesture; if the limit cannot accommodate a patch, the existing source-based replay remains the safe fallback. Canonical one-shot rendering does not create rollback checkpoints.
2. The smudge renderer deposits colour directly into its own work surface; its normal paint mask is unused. The live path avoids creating two unnecessary full-page paint masks for those smudges.
3. On the first Ink or Hard Eraser stroke over painted content, an array copy prevented reuse of the already rendered layer and replayed all underlying paint. Preserving the array identity lets the existing native layer cache serve that prefix.

The pigment calculations, pressure response, stroke geometry, smoothing, stabilization, preset settings and UI are unchanged. The four affected source files have explicitly recorded before/after hashes in the regression guards; the remaining protected brush, input and UI sources retain their original hashes. The changed renderers were compared with frozen v155 images and earlier Blender goldens.

## Production-app measurements

Production app, Chromium 133 software canvas, viewport 2048×1152 at DPR 2, 1920×1080 project with 281 saved strokes on six layers. Each gesture uses 200 synthetic pen samples over one second, coalesced at animation frames with varying pressure. Timed cases ran alone. Values are milliseconds, **v0.5.155 → v0.5.156**, one paired run per case. The count column is the number of observed frame intervals (before / after). Frame values are requestAnimationFrame intervals, not physical pen-to-display latency. Composition is the engine's Canvas submission timing and includes work around pen-up.

| Brush | Frame median | Frame p95 | Composition median | Frames |
|---|---:|---:|---:|---:|
{normal}

A separate three-run-per-version Pencil check had a median p95 of {pb:.1f} → {pa:.1f} ms. One new-version run still reached 50 ms at p95. Individual runs vary and the Pencil path itself was not changed, so these data do not establish a general Pencil speed-up or rule out a regression on another machine. Pen-up values also vary, and are not all improved.

A 24-frame animation with visible onion skin and 200% zoom was also repeated twice on each version. The before frame medians were {a0['p50']:.1f} and {a1['p50']:.1f} ms; the after medians were {a2['p50']:.1f} and {a3['p50']:.1f} ms. All four p95 values were approximately 33.4–33.5 ms. The original separate v156 run also had a 33.3 ms median. Frame rates vary across runs, so neither consistently smooth animation nor a causal regression is established by these samples.

### CPU 4× slowdown

The same fixture was measured under browser CPU throttling. Only three representative brushes were repeated here. These individual cases contain very few observed frames, so they are useful stress warnings, not stable percentiles or an iMac performance prediction.

| Brush | Frame p95 | Composition median | Pen-up wall time | Frames |
|---|---:|---:|---:|---:|
{stress}

These figures still show major stalls under the artificial slowdown. In particular, Technical Ink pen-up takes longer in this sample despite lower composition time. More work on pen-up/undo, smudge sampling, and dense or rotated/mirrored displays remains.

### Isolated smudge measurements

A separate fixed-work test ran 160 updates per gesture, three gestures for each preset and size. It includes a full-base copy and a one-pixel completion read per update. The p95 column is the median of the three gesture p95 values. Read counts include those completion reads and are for one complete fixed-work gesture; they should not be directly compared with the production-app frame counts.

| Brush | Size | Update p95 (ms) | Pixel reads |
|---|---:|---:|---:|
{minit}

The newer smudges still read the sampled colour at each contact; they are **not** readback-free. Classic Blender now performs more small grouped patch reads in this test, but avoids repeatedly copying the whole growing stroke. Results vary by browser, device and artwork.

## Verification

- TypeScript and production Vite build: PASS.
- Unit tests: 375/375 in 72 files; regression scripts: 61/61.
- 64 actual v155/v156 Blender renders: canonical images identical, including 12–500 px, straight/curved paths, pressure and transparent/opaque layers. Incremental replay and backward tail edits also match the canonical output pixel-for-pixel in these cases.
- 64 wet-smudge checks cover live/final replay, reload, transparency, controls, seeds and transformed contacts; six frozen v153 Blender/dry outputs remain byte-identical.
- 38 live display cases compare actual engine output to a forced full redraw: all captured RGBA pixels match. Includes Pencil, Ink, Dry Ink, Dry Paint, Solid Paint, smudges, both erasers, different zooms, rotated/mirrored fallback, and layer blends.
- 520 historical brush goldens and 12 saved v147 dry strokes match exactly.
- Production UI exercised pressure and velocity capture, settings, custom tips, mirror, Undo/Redo and project reload. The 24-frame animation/onion-skin check covers current-cel isolation, history and frame stepping.

`blender_v156_comparison.png` contains actual rendered before/after examples; the purpose is to check preservation of the existing appearance. `performance_v156.png` charts the single normal-CPU runs. Detailed raw timings and test logs are under `validation/`. The older v155 archive remains separate.

## Files changed

- `src/engine/SmudgeRollback.ts`: bounded grouped rollback patches and state.
- `src/engine/wetSmudge.ts` and `src/engine/bristleSmudge.ts`: use grouped rollback during live blending and skip unneeded canonical checkpoints.
- `src/engine/LivePaintingRaster.ts`: skip unused smudge masks.
- `src/engine/InkDisplay.ts`: reuse the full existing paint-layer prefix.
- `src/core/buildInfo.ts`, `package.json`, and `README.md`: version and release information.
- New v156 tests, frozen v155 smudge expectations, source-revision guards, benchmark scripts, results and this report. The inherited source guards retain explicit before/after hashes for the two deliberately optimized Blender files.

## Remaining limits

The wet-smudge sampling path still performs per-contact reads; low-opacity blending also needs region reads. Heavy projects, large surfaces, rotated/mirrored views, and pen-up or undo can still stutter. Synthetic pen input and software rendering cannot establish the actual latency on a 2017 iMac or Wacom tablet. The brush appearance was intentionally preserved; this is a performance update rather than a Blender appearance redesign.

## Reproduce

Install dependencies, then run `npx tsc -b`, `npx vitest run`, `npm run -s test:regression` and `npx vite build`. Browser checks require Playwright Chromium or `CHROMIUM_PATH`. Run the scripts `tests/smudge-v156-visual.mjs`, `tests/blender-v154-legacy.mjs`, `tests/blender-v154-properties.mjs`, `tests/drawing-v155-parity.mjs`, `tests/dry-v148-goldens.mjs`, `tests/drawing-v156-ui.mjs` and `tests/drawing-v156-animation.mjs`. The benchmark scripts are `tests/performance-v156-app.mjs` and `tests/performance-v156-smudge.mjs`; see the scripts and archived JSON for their parameters. For a new paired comparison, provide an unmodified v155 project as `PERF_ROOT` or `COMPARE_ROOT`.
'''
(root/'UPDATE_v0.5.156.md').write_text(report)
print('Report and comparison assets generated.')
