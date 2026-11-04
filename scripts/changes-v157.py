"""Enumerate delivery changes against an independently preserved v156 folder."""
from pathlib import Path
import difflib,hashlib,sys
root=Path(__file__).resolve().parents[1]
baseline=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/'Solo_Anime_Studio_v0_5_156'
skip={'node_modules','.git','.vite','.cache','playwright-report','test-results'}
def collect(base):
 return {p.relative_to(base).as_posix():p for p in base.rglob('*') if p.is_file() and not any(part in skip for part in p.relative_to(base).parts) and not p.name.endswith('.tsbuildinfo')}
a,b=collect(baseline),collect(root)
lines=['# v0.5.157 changes relative to v0.5.156','','Line locations refer to the delivered v157 file unless marked “old”. Added files are indexed from their first line; changed source/test hunks list each affected line range. Generated bundles and evidence are indexed at line 1 (binary files have no meaningful source line). No historical golden expectations were regenerated.','','## Runtime changes','','- `src/engine/HistoryTiles.ts:1`: exact before/after native tiles, capped tile size, completion checks and release.','- `src/engine/renderer.ts:1`: bounded exact Undo/Redo, replay capture skipping, canonical native result adoption, cropped Pencil bitmap retention and explicit pending-result ownership.','- `src/engine/pencilFinal.worker.ts:1`: canonical worker math retained, transfer cropped bitmap plus native rect.','- `src/engine/LiveBlendWorker.ts:1` and `src/engine/liveBlend.worker.ts:1`: coalesced off-thread live blending using the existing pigment math.','- `src/engine/DrawingFrameCache.ts:1`: bounded larger prefix/upper caches and changed-tail dirty coverage.','- `src/engine/InkDisplay.ts:1`: native ink-base preparation, unnecessary pure-ink revision invalidation avoided.','- `src/engine/StudioEngine.ts:1`: worker/adoption integration, fixed scanline origin, settled upper-ink reuse, cancelable idle warm-up and redundant selection notification removal.','- `src/core/buildInfo.ts:1`, `package.json:1`, `README.md:1`: release identity and usage notes.','','## Source, tests, and documentation line index','']
generated=[]
for name in sorted(set(a)|set(b)):
 if name=='CHANGES.md':continue
 old=a.get(name);new=b.get(name)
 if old and new and old.read_bytes()==new.read_bytes():continue
 if name.startswith(('dist/','validation/','test-output/')):generated.append((name,old,new));continue
 if not new:lines.append(f'- `{name}:1` (old): removed/generated replacement.');continue
 try:newlines=new.read_text().splitlines();oldlines=old.read_text().splitlines() if old else []
 except UnicodeError:lines.append(f'- `{name}:1`: binary artifact changed.');continue
 if not old:lines.append(f'- `{name}:1` (new, {len(newlines)} lines).');continue
 for tag,i,j,k,l in difflib.SequenceMatcher(a=oldlines,b=newlines,autojunk=False).get_opcodes():
  if tag=='equal':continue
  span=str(k+1) if l<=k+1 else f'{k+1}–{l}'
  lines.append(f'- `{name}:{span}`: {tag}; v156 lines {i+1}–{j}.')
lines+=['','## Generated build and verification artifacts','']
for name,old,new in generated:lines.append(f'- `{name}:1`'+(' (old): removed/replaced generated artifact.' if not new else ': generated verification/build artifact.'))
lines+=['','- `CHANGES.md:1`: this complete change index.','','The v156 ZIP is external to this project and is not modified. Full artifact/package checks are recorded in `validation/v157-package.json`.']
(root/'CHANGES.md').write_text('\n'.join(lines)+'\n')
print(f'Indexed {len(lines)} change-description lines.')
