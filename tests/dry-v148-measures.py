"""No alternate metric definitions: import the supplied metrics.py unchanged."""
from pathlib import Path
import json,sys,importlib.util,hashlib
import numpy as np,cv2
cv2.setNumThreads(1)
HERE=Path(__file__).resolve().parent
source=HERE/'reference/metrics.py';assert hashlib.sha256(source.read_bytes()).hexdigest()=='bca694ce831a227be994c6f4b4a7107c30c6979abf3ee3b31b5085206cafa460'
spec=importlib.util.spec_from_file_location('provided_metrics',source);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
TARGETS={'aniso_gx_gy':(None,.36),'gap_frac':(.1,.3),'perim_ratio_hull':(1.5,2.4),'tail_len_W':(.6,2.6),'midtone_frac':(.28,.55),'dens_ratio_last_first':(.55,1),'mean_alpha_hull':(.75,.85),'streaks_med':(3,6),'run_thick_med':(5,21),'period_peak':(None,.22),'flecks':(30,80),'hairlines':(4,None),'taper_end':(.33,.78)}
def finite(v):
 if isinstance(v,dict):return {k:finite(x)for k,x in v.items()}
 if isinstance(v,list):return [finite(x)for x in v]
 if isinstance(v,(float,np.floating)):return float(v)if np.isfinite(v)else None
 if isinstance(v,np.integer):return int(v)
 return v
def summary(values,lo,hi):
 check=lambda x:(lo is None or x>=lo)and(hi is None or x<=hi)
 return {'mean':float(np.mean(values)),'min':float(np.min(values)),'max':float(np.max(values)),'nPass':sum(check(x)for x in values),'n':len(values),'target':[lo,hi],'pass':len(values)==10 and check(float(np.mean(values)))and sum(check(x)for x in values)>=8,'values':values}
def process(root):
 manifest=json.loads((root/'manifest.json').read_text());rows=[]
 for r in manifest['cases']:
  parts=m.split_strokes(m.load_layer(root/r['raw']));metrics=m.analyze(parts[0][0])if parts else{};rows.append({**r,'metrics':finite(metrics)})
 groups={}
 for preset in ['dry-ink-bristle','dry-paint']:
  groups[preset]={}
  for size in manifest['sizes']:
   ids=[]
   for index in range(manifest['ids']):
    q=[r for r in rows if r['preset']==preset and r['size']==size and r['index']==index];assert len(q)==4
    avg={k:float(np.mean([r['metrics'].get(k,0)for r in q]))for k in TARGETS}
    def mean(key,**terms):return float(np.mean([r['metrics'].get(key,0)for r in q if all(r[k]==v for k,v in terms.items())]))
    ids.append({'id':q[0]['strokeId'],'appearance':avg,'opacitySpeedDelta':abs(mean('mean_alpha_hull',speed='slow')-mean('mean_alpha_hull',speed='fast')),'fraySpeedDelta':abs(mean('tail_len_W',speed='slow')-mean('tail_len_W',speed='fast')),'curveStreakDelta':mean('streaks_med',shape='sine')-mean('streaks_med',shape='straight')})
   group={'ids':ids,'appearance':{k:summary([r['appearance'][k]for r in ids],*v)for k,v in TARGETS.items()},'behaviour':{k:summary([r[k]for r in ids],lo,None)for k,lo in [('opacitySpeedDelta',.05),('fraySpeedDelta',.2),('curveStreakDelta',1)]}}
   if preset=='dry-ink-bristle'and size in [38,70]:group['smallFray']=summary([r['appearance']['tail_len_W']for r in ids],None,4)
   if preset=='dry-paint'and size==38:group['smallOpacity']=summary([r['appearance']['mean_alpha_hull']for r in ids],.5,None)
   groups[preset][str(size)]=group
 result={'metricsSourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'groups':groups,'cases':rows};(root/'metrics.json').write_text(json.dumps(finite(result),indent=2,allow_nan=False))
 for preset,sizes in groups.items():
  print(preset)
  for size,g in sizes.items():
   print('size',size)
   for name,v in {**g['appearance'],**g['behaviour']}.items():print(name,round(v['mean'],5),f"[{v['min']:.3f},{v['max']:.3f}]",str(v['nPass'])+'/'+str(v['n']),'PASS'if v['pass']else'FAIL')
 return result
if __name__=='__main__':process(Path(sys.argv[1]))
