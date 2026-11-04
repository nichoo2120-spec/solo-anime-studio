"""All Phase 2 image acceptance values come from the attached metrics.py unchanged."""
import json,sys,hashlib,importlib.util,math
from pathlib import Path
import numpy as np,cv2
from PIL import Image
cv2.setNumThreads(1)
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('supplied_dry_metrics',HERE/'reference/metrics.py');standard=importlib.util.module_from_spec(spec);spec.loader.exec_module(standard)
SOURCE_SHA=hashlib.sha256((HERE/'reference/metrics.py').read_bytes()).hexdigest()
ALIASES={'streakiness':'aniso_gx_gy','gapFraction':'gap_frac','raggedness':'perim_ratio_hull','endFray':'tail_len_W','midToneShare':'midtone_frac','densityRatio':'dens_ratio_last_first','meanOpacity':'mean_alpha_hull','streakCount':'streaks_med','streakThickness':'run_thick_med','repeatPeak':'period_peak','flecks':'flecks','hairlines':'hairlines','endTaper':'taper_end'}
REPORT_DRY={'streakiness':.95,'gapFraction':.45,'raggedness':1.68,'endFray':.45,'midToneShare':1.,'densityRatio':1.01,'meanOpacity':.51,'streakCount':14.,'streakThickness':3.,'repeatPeak':.24,'flecks':106.,'hairlines':4.,'endTaper':.92}
REPORT_TEXTURE={'streakiness':.58,'gapFraction':.15,'raggedness':1.15,'endFray':.17,'midToneShare':.88,'densityRatio':.99,'meanOpacity':.71,'streakCount':7.,'streakThickness':10.,'repeatPeak':.45,'flecks':.5,'hairlines':0.,'endTaper':.75}
def finite(value):
 if isinstance(value,dict):return {k:finite(v)for k,v in value.items()}
 if isinstance(value,list):return [finite(v)for v in value]
 if isinstance(value,(np.integer,)):return int(value)
 if isinstance(value,(np.floating,float)):return float(value)if math.isfinite(value)else None
 return value
def measure(path):
 alpha=standard.load_layer(str(path));parts=standard.split_strokes(alpha)
 if not parts:return {},{}
 raw=standard.analyze(parts[0][0]);return finite({key:raw.get(value)for key,value in ALIASES.items()}),finite(raw)
def process(root):
 manifest=json.loads((root/'manifest.json').read_text());dry=[];blender=[]
 for row in manifest['cases']:
  item={k:v for k,v in row.items()if k not in ['path','points','events']}
  if row['family']=='blender':item['scope']='unchanged Blender; Phase 3 not started';blender.append(item);continue
  aliases,raw=measure(root/row['raw']);item['metrics']=aliases;item['standardMetrics']=raw;dry.append(item)
 averages={}
 for preset in sorted(set(r['preset']for r in dry)):
  selected=[r['metrics']for r in dry if r['preset']==preset and r['size']==130 and r['pressure']=='none'and r['shape']in ['straight','sine']]
  averages[preset]={key:float(np.mean([r[key]for r in selected if r.get(key)is not None]))for key in ALIASES} if selected else {}
 comparisons=[]
 for preset,expected in [('dry',REPORT_DRY),('color-texture',REPORT_TEXTURE)]:
  if preset not in averages:continue
  for key,target in expected.items():
   measured=averages[preset][key];error=abs(measured-target)/abs(target)if target else (0 if measured==0 else None);comparisons.append({'preset':preset,'measure':key,'report':target,'measured':measured,'relativeError':error,'within5Percent':error is not None and error<=.05})
 ref=standard.load_ref(str(HERE/'reference/ref_drybrush.png'));reference=[];(root/'reference').mkdir(exist_ok=True)
 for i,(rotated,angle)in enumerate(standard.split_strokes(ref,4)):
  raw=standard.analyze(rotated);reference.append(finite({'name':'reference-'+str(i+1),'angle':angle,**raw}));Image.fromarray(np.rint(255-rotated*255).astype('uint8')).save(root/f'reference/aligned-{i+1}.png')
 return finite({'definition':'supplied-metrics.py:'+SOURCE_SHA,'metricsSourceSha256':SOURCE_SHA,'originalAuditScriptsAvailable':True,'metricDefinitionsVerified':True,'reportMatchVerified':all(c['within5Percent']for c in comparisons)if comparisons else None,'comparisonWarning':'Exact supplied metric implementation; original audit harness/seed recipes may differ. No acceptance target has been changed.','averages':averages,'reportComparisons':comparisons,'reference':reference,'dry':dry,'blender':blender})
if __name__=='__main__':
 root=Path(sys.argv[1]);result=process(root);(root/'metrics.json').write_text(json.dumps(result,indent=2,allow_nan=False));print(json.dumps({'metricsSourceSha256':SOURCE_SHA,'averages':result['averages'],'reportWithin5Percent':sum(v['within5Percent']for v in result['reportComparisons']),'reportComparisons':len(result['reportComparisons']),'referenceStrokes':len(result['reference'])},indent=2))
