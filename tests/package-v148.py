"""Package verified Phase 2.1 source/build; preserve the v147 archive."""
from pathlib import Path
import json,hashlib,zipfile
root=Path(__file__).resolve().parents[1];out=root.parent/'releases';out.mkdir(exist_ok=True)
read=lambda p:json.loads((root/p).read_text())
a=read('test-output/dry-blend/v148/acceptance.json');b=read('dist/studio-build.json')
assert a['acceptanceComplete'] and not a['phase3Started'];assert b['version']=='0.5.148'
assert a['sourceDigest']==b['sourceDigest'];assert read('package.json')['version']==read('package-lock.json')['version']=='0.5.148'
h=hashlib.sha256()
for p in sorted((root/'src').rglob('*')):
 if p.is_file():h.update(p.relative_to(root).as_posix().encode());h.update(p.read_text().replace('\r\n','\n').encode())
assert h.hexdigest()==b['sourceDigest']
previous=root.parent/'recovered148/Solo_Anime_Studio_v0_5_147.zip';oldhash=hashlib.sha256(previous.read_bytes()).hexdigest();assert oldhash=='1439587c21c7068500c6f9279f4d88b077126df117e3eb2c5678b61324108da1'
release={'version':'0.5.148','phase':'2.1','phase3Started':False,'sourceDigest':b['sourceDigest'],'numericAcceptanceComplete':True,'referenceMatchComplete':False,'unitTests':343,'regressionScripts':58,'oldV146Exact':520,'savedV147Exact':12,'newReproducibilityCasesExact':12,'newPropertyChecks':56,'browserNavigationTests':11,'loadConsoleErrors':0,'previousArchiveSha256':oldhash,'remainingLimitations':a['remainingLimitations']+['Parallel bristle channels and similar macro silhouettes remain more regular than the reference']}
(root/'validation/v148-release.json').write_text(json.dumps(release,indent=2))
archive=out/'Solo_Anime_Studio_v0_5_148.zip';exclude={'node_modules','dist148','.git','.vite','.cache','test-results','__pycache__'}
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for p in sorted(root.rglob('*')):
  rel=p.relative_to(root)
  if p.is_file() and not p.is_symlink() and not any(x in exclude for x in rel.parts) and p.suffix not in {'.zip','.pyc','.tsbuildinfo'}:z.write(p,rel.as_posix())
with zipfile.ZipFile(archive)as z:
 assert z.testzip()is None
 for name in ['package.json','src/engine/dryBristleV2.ts','src/engine/dryBristle.ts','src/engine/dryTooth.ts','dist/index.html','dist/studio-build.json','START SOLO ANIME STUDIO.bat','UPDATE_v0.5.148.md','test-output/dry-blend/v148/v148-reference-comparison.png','tests/fixtures/dry-v148-compatibility-goldens.json','public/fonts/DM-Sans.ttf','public/fonts/Manrope.ttf']:assert name in z.namelist(),name
 checked=0
 for folder in ['src','dist','public']:
  for p in (root/folder).rglob('*'):
   if p.is_file():assert z.read(p.relative_to(root).as_posix())==p.read_bytes();checked+=1
 count=len(z.infolist())
assert hashlib.sha256(previous.read_bytes()).hexdigest()==oldhash
integrity={'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'entries':count,'crc':'all entries passed','sourceBuildAndAssetsCompared':checked,'sourceDigest':b['sourceDigest'],'v147ArchivePreserved':oldhash}
(out/'v148-integrity.json').write_text(json.dumps(integrity,indent=2));print(json.dumps(integrity,indent=2))
