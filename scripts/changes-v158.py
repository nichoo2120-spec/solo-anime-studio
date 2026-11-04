"""Enumerate delivery changes against an independently preserved v157 folder."""
from pathlib import Path
import difflib,hashlib,sys
root=Path(__file__).resolve().parents[1]
baseline=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/'Solo_Anime_Studio_v0_5_157'
skip={'node_modules','.git','.vite','.cache','playwright-report','test-results'}
def collect(base):
 return {p.relative_to(base).as_posix():p for p in base.rglob('*') if p.is_file() and not any(part in skip for part in p.relative_to(base).parts) and not p.name.endswith('.tsbuildinfo')}
a,b=collect(baseline),collect(root)
lines=['# v0.5.158 changes relative to v0.5.157','','Line locations refer to delivered v158 files unless marked old. Each changed source/test hunk is indexed. New and generated files are indexed at line 1. Historical golden hashes and previous revision records are unchanged.','','Runtime: cached-prefix clear/blit, Pencil contact bounds, Dry V3 capsule scanline bounds, native canvas release and release metadata. See UPDATE_v0.5.158.md for rationale and validation.','','## Source, tests and documentation','']
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
  lines.append(f'- `{name}:{span}`: {tag}; v157 lines {i+1}–{j}.')
lines+=['','## Generated build and verification artifacts','']
for name,old,new in generated:lines.append(f'- `{name}:1`'+(' (old): removed/replaced generated artifact.' if not new else ': generated verification/build artifact.'))
lines+=['','- `CHANGES.md:1`: this complete change index.','','The v157 ZIP is external to this project and is not modified. Full artifact/package checks are recorded in `validation/v158-package.json`.']
(root/'CHANGES.md').write_text('\n'.join(lines)+'\n')
print(f'Indexed {len(lines)} change-description lines.')
