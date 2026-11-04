"""Package the verified source/build without overwriting earlier releases."""
import hashlib,json,zipfile,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
release_dir=root.parent/'releases';release_dir.mkdir(exist_ok=True)
read=lambda name:json.loads((root/name).read_text())
unit=read('validation/v146-unit.json');reg=read('validation/v146-regressions.json');compat=read('validation/v146-compatibility.json');matrix=read('validation/v146-coloring-render.json');feel=read('validation/v146-brush-feel.json');build=read('dist/studio-build.json');ui=read('validation/v146-ui.json');dense=read('validation/v146-dense-ui.json');navigation=read('validation/v146-navigation.json')
assert unit['numFailedTests']==0 and unit['numPassedTests']==324
assert len(reg)==58 and all(v['pass'] for v in reg)
assert len(compat)==136 and all(v['max']==0 for v in compat)
assert len(matrix['matrix'])==57 and all(v['nonempty'] and v['affectsExistingPaint'] for v in matrix['matrix'])
assert feel['translucentReplay']['max']==0 and feel['translucentLockReplay']['max']==0 and feel['translucentLockAlpha']==0
assert all(v['live']==0 and v['replay']==0 for v in read('validation/v146-maximum.json')['rows'])
assert navigation['stats']['expected']==11 and navigation['stats']['unexpected']==0
assert ui['build']['sourceDigest']==dense['build']['sourceDigest']==build['sourceDigest'] and build['version']=='0.5.146'
assert read('package.json')['version']==read('package-lock.json')['version']=='0.5.146'
hash=hashlib.sha256()
for p in sorted((root/'src').rglob('*')):
 if p.is_file():hash.update(p.relative_to(root).as_posix().encode());hash.update(p.read_text().replace('\r\n','\n').encode())
assert hash.hexdigest()==build['sourceDigest']
previous=root.parent/'recovered145/Solo_Anime_Studio_v0_5_145.zip';previous_sha=hashlib.sha256(previous.read_bytes()).hexdigest();assert previous_sha=='09db84d71254f8ed307b4fab20df6c66c0f5f84fea784adaec7762ca46f2099e'
report={'version':build['version'],'sourceDigest':build['sourceDigest'],'unit':324,'regressionScripts':58,'historicalRawFixtures':132,'historicalBlenderComposites':4,'nibSizeCases':57,'navigationBrowserTests':11,'newBlenderTranslucentReplay':'exact RGBA equality, locked and unlocked','knownIssues':['Occasional Blender frame stalls','Large size-500 marks are more expensive and show coarser detail','Physical Wacom latency/tilt untested'],'previousArchivePreserved':previous_sha}
(root/'validation/v146-release.json').write_text(json.dumps(report,indent=2))
archive=release_dir/'Solo_Anime_Studio_v0_5_146.zip'
exclude={'node_modules','dist146','.git','.vite','.cache','test-results','__pycache__'}
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  rel=p.relative_to(root)
  if p.is_file() and not p.is_symlink() and not any(x in exclude for x in rel.parts) and p.suffix not in ('.zip','.pyc','.tsbuildinfo'):z.write(p,rel.as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for required in ['package.json','src/engine/bristleSmudge.ts','src/engine/pigmentBrush.ts','dist/index.html','dist/studio-build.json','START SOLO ANIME STUDIO.bat','BRUSH_FEEL_COMPARISON_v0_5_146.png']:
  assert required in z.namelist(),required
 destination=release_dir/'verified-v146';destination.mkdir(exist_ok=True);z.extractall(destination)
 assert (destination/'dist/studio-build.json').read_bytes()==(root/'dist/studio-build.json').read_bytes()
 for p in (root/'src').rglob('*'):
  if p.is_file():assert (destination/p.relative_to(root)).read_bytes()==p.read_bytes()
 entries=len(z.infolist())
info={'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'entries':entries,'crc':'all entries passed','extractedSourceAndBuild':'match','previousArchiveSha256':previous_sha}
(release_dir/'v146-integrity.json').write_text(json.dumps(info,indent=2));print(json.dumps(info,indent=2))
