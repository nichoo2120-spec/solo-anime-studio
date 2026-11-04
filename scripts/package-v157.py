"""Package the full application, excluding installed/transient dependencies."""
from pathlib import Path
import json,hashlib,zipfile
root=Path(__file__).resolve().parents[1]
out=root.parent/'Solo_Anime_Studio_v0_5_157.zip'
skip={'node_modules','.git','.vite','.cache','playwright-report','test-results','__pycache__'}
files=[p for p in root.rglob('*') if p.is_file() and not any(part in skip for part in p.relative_to(root).parts) and not p.name.endswith('.tsbuildinfo')]
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for p in sorted(files):z.write(p,root.name+'/'+p.relative_to(root).as_posix())
with zipfile.ZipFile(out)as z:
 assert z.testzip()is None,'CRC failure'
 assert len(set(z.namelist()))==len(files),'duplicate archive entries'
 assert all('..'not in Path(n).parts for n in z.namelist()),'unsafe path'
 for p in files:assert z.read(root.name+'/'+p.relative_to(root).as_posix())==p.read_bytes(),str(p)
print(json.dumps({'path':str(out),'entries':len(files),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'crc':'all entries pass','exactSourceFiles':True},indent=2))
