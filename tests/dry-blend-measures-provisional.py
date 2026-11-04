"""Explicit local metric definitions. Original sas_b4_out/metrics.py was not supplied.
Do not treat these definitions as a verified reproduction of that audit.
"""
import json,sys,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull,cKDTree

DEFINITION='dry-blend-local-v1'
REPORT_DRY={'streakiness':.95,'gapFraction':.45,'raggedness':1.68,'endFray':.45,'midToneShare':1.0,'densityRatio':1.01,'meanOpacity':.51,'streakCount':14.,'streakThickness':3.,'repeatPeak':.24,'flecks':106.,'hairlines':4.,'endTaper':.92}
REPORT_TEXTURE={'streakiness':.58,'gapFraction':.15,'raggedness':1.15,'endFray':.17,'midToneShare':.88,'densityRatio':.99,'meanOpacity':.71,'streakCount':7.,'streakThickness':10.,'repeatPeak':.45,'flecks':.5,'hairlines':0.,'endTaper':.75}

def runs(mask):
 d=np.diff(np.r_[False,np.asarray(mask,dtype=bool),False].astype(np.int8));return np.flatnonzero(d==-1)-np.flatnonzero(d==1)

def outline_perimeter(mask):
 # Marching squares at the 0.5 isocontour, including Euclidean diagonal lengths.
 a=np.pad(mask.astype(np.uint8),1);code=a[:-1,:-1]+2*a[:-1,1:]+4*a[1:,1:]+8*a[1:,:-1]
 lut=np.array([0,math.sqrt(.5),math.sqrt(.5),1,math.sqrt(.5),math.sqrt(2),1,math.sqrt(.5),math.sqrt(.5),1,math.sqrt(2),math.sqrt(.5),1,math.sqrt(.5),math.sqrt(.5),0])
 return float(lut[code].sum())

def repeat_metric(alpha,path,size):
 x0,x1=int(path[0][0]),int(path[-1][0]);xs=np.arange(max(0,x0),min(alpha.shape[1],x1));cy=np.interp(xs,[p[0] for p in path],[p[1] for p in path]);tracks=[]
 for off in np.linspace(-.25,.25,7)*size:
  ys=np.clip(np.rint(cy+off).astype(int),0,alpha.shape[0]-1);v=alpha[ys,xs].astype(float);v-=ndi.gaussian_filter1d(v,8);tracks.append(v)
 v=np.array(tracks);v-=v.mean(axis=1,keepdims=True);var=float((v*v).sum());n=v.shape[1]
 if var<1e-9 or n<40:return 0.,None
 best=-1.;lagbest=None
 for lag in range(max(12,int(size*.18)),min(n//2,320)):
  a,b=v[:,:-lag],v[:,lag:];den=math.sqrt(float((a*a).sum()*(b*b).sum()));corr=float((a*b).sum())/den if den else 0
  if corr>best:best,lagbest=corr,lag
 return max(0.,best),lagbest

def dry_metrics(rgba,path,size):
 a=rgba[:,:,3].astype(float)/255;h,w=a.shape;mask=a>=.12;support=a>=.03
 if not support.any():return {'empty':True}
 labels,count=ndi.label(mask,np.ones((3,3)));areas=np.bincount(labels.ravel());areas[0]=0;main=labels==areas.argmax();filled=ndi.binary_fill_holes(main)
 boundary=filled&~ndi.binary_erosion(filled);ys,xs=np.nonzero(boundary)
 hull=ConvexHull(np.column_stack([xs,ys])) if len(xs)>2 else None
 hull_perimeter=float(hull.area) if hull is not None else 0
 hull_mask=np.zeros_like(mask)
 if hull is not None:
  image=Image.new('1',(w,h));ImageDraw.Draw(image).polygon([tuple(v) for v in hull.points[hull.vertices]],fill=1);hull_mask=np.asarray(image,dtype=bool)
 x0,x1=path[0][0],path[-1][0];length=max(1,x1-x0);left=max(0,int(x0));right=min(w,int(x1)+1);xx=np.arange(left,right);center=np.interp(xx,[p[0] for p in path],[p[1] for p in path]);yy=np.arange(h)[:,None];corridor=np.abs(yy-center[None,:])<=size*.48;body=a[:,left:right]
 gx=float(np.abs(np.diff(a,axis=1)).sum());gy=float(np.abs(np.diff(a,axis=0)).sum());streaks=[];thickness=[];widths=[]
 for fraction in [.3,.4,.5,.6,.7]:
  x=int(x0+fraction*length);profile=a[:,max(0,x-2):min(w,x+3)].mean(axis=1);cut=profile>=.5;rr=runs(cut);streaks.append(len(rr));thickness.extend(rr.tolist());live=np.flatnonzero(profile>=.12);widths.append(live[-1]-live[0]+1 if live.size else 0)
 width=float(np.mean(widths)) or float(size);mass=(body*corridor).sum(axis=0);peak=float(mass.max()) if mass.size else 0;dense=np.flatnonzero(mass>=peak*.6);last_dense=left+int(dense[-1]) if dense.size else x1;farthest=int(np.max(np.nonzero(mask)[1])) if mask.any() else last_dense
 end_x=min(w-1,int(x1-size*.12));end_profile=a[:,max(0,end_x-2):min(w,end_x+3)].mean(axis=1);live=np.flatnonzero(end_profile>=.12);end_width=live[-1]-live[0]+1 if live.size else 0
 component_slices=ndi.find_objects(labels);flecks=hairlines=outside_flecks=0
 for i,sl in enumerate(component_slices,1):
  if sl is None or i==areas.argmax():continue
  height=sl[0].stop-sl[0].start;width_c=sl[1].stop-sl[1].start;area=areas[i];long=max(height,width_c);short=max(1,min(height,width_c))
  if 1<=area<=64:flecks+=1;outside_flecks+=int(sl[1].start>=x1)
  if long>=12 and long/short>=5:hairlines+=1
 repeat,lag=repeat_metric(a,path,size);fifth=max(1,int(body.shape[1]*.2));start_density=float(body[:,:fifth][corridor[:,:fifth]].mean());end_density=float(body[:,-fifth:][corridor[:,-fifth:]].mean())
 return {'streakiness':gx/max(1e-12,gy),'gapFraction':float(((a<.12)&hull_mask).sum()/max(1,hull_mask.sum())),'raggedness':outline_perimeter(filled)/max(1,hull_perimeter),'endFray':max(0,farthest-last_dense)/width,'midToneShare':float(((a>=.1)&(a<=.9)&support).sum()/support.sum()),'densityRatio':end_density/max(1e-12,start_density),'meanOpacity':float(a[support].mean()),'streakCount':float(np.mean(streaks)),'streakThickness':float(np.mean(thickness)) if thickness else 0.,'repeatPeak':repeat,'repeatLag':lag,'flecks':flecks,'flyingFlecks':outside_flecks,'hairlines':hairlines,'endTaper':float(end_width/width),'bodyWidth':width,'supportPixels':int(support.sum()),'paintAlphaMass':float(a.sum()),'rightClipped':bool(mask[:,-1].any()),'bottomClipped':bool(mask[-1,:].any()),'topClipped':bool(mask[0,:].any())}

def carrier_share(rgb,source,destination):
 axis=np.asarray(source,dtype=float)-destination;den=float(axis@axis)
 return np.clip((np.asarray(rgb,dtype=float)-destination)@axis/den,0,1) if den else np.zeros(np.asarray(rgb).shape[:-1])

def blender_metrics(before,after,row):
 delta=np.abs(after.astype(np.int16)-before.astype(np.int16));changed=delta.max(axis=2)>0;direction=-1 if row['reverse'] else 1;edge=450;size=row['size'];path=np.array(row['path']);order=np.argsort(path[:,0]);px,py=path[order,0],path[order,1];source=np.array([29,78,216] if row['reverse'] else [214,40,40]);destination=np.array([214,40,40] if row['reverse'] else [29,78,216]);rgb=after[:,:,:3]
 shares={}
 for distance in [40,90,130]:
  x=edge+direction*distance;y=int(np.interp(x,px,py));patch=rgb[max(0,y-2):min(260,y+3),x-2:x+3];shares[str(distance)]=float(carrier_share(patch,source,destination).mean())
 yy,xx=np.nonzero(delta.max(axis=2)>8);d=(xx-edge)*direction;smear=int(d[d>0].max()) if np.any(d>0) else 0
 dense=[]
 for a,b in zip(path[:-1],path[1:]):
  n=max(1,math.ceil(np.linalg.norm(b-a)));dense.extend(a+(b-a)*np.arange(n)[:,None]/n)
 dense=np.array(dense+[path[-1]]);yy_all,xx_all=np.nonzero(changed);outside=0
 if len(xx_all):
  distance=cKDTree(dense).query(np.column_stack([xx_all+.5,yy_all+.5]))[0];outside=int((distance>size*.5+2).sum())
 xs=np.arange(edge+direction*11,721 if direction>0 else 179,direction);ys=np.clip(np.rint(np.interp(xs,px,py)).astype(int),0,259);center=rgb[ys,xs].astype(float);continuity=float(np.abs(np.diff(center,axis=0)).max()) if len(center)>1 else 0
 return {'smearLength':smear,'smearBrushWidths':smear/size,'carriedShare':shares,'outsideFootprintPixels':outside,'changedPixels':int(changed.sum()),'maxNeighborColorStep':continuity}

def summarize(rows,root):
 dry=[];blend=[]
 for row in rows:
  raw=np.asarray(Image.open(root/row['raw']).convert('RGBA'))
  if row['family']=='blender':
   before=np.asarray(Image.open(root/row['before']).convert('RGBA'));metrics=blender_metrics(before,raw,row)
  else:metrics=dry_metrics(raw,row['path'],row['size'])
  item={k:v for k,v in row.items() if k not in ['path','points','events']};item['metrics']=metrics;(blend if row['family']=='blender' else dry).append(item)
 averages={}
 for preset in ['dry','color-texture']:
  selected=[r['metrics'] for r in dry if r['preset']==preset and r['size']==130 and r['pressure']=='none' and r['shape'] in ['straight','sine']];averages[preset]={key:float(np.mean([m[key] for m in selected])) for key in REPORT_DRY}
 comparisons=[]
 for preset,expected in [('dry',REPORT_DRY),('color-texture',REPORT_TEXTURE)]:
  for key,target in expected.items():
   measured=averages[preset][key];error=abs(measured-target)/abs(target) if target else (0 if measured==0 else None);comparisons.append({'preset':preset,'measure':key,'report':target,'measured':measured,'relativeError':error,'within5Percent':error is not None and error<=.05})
 return {'definition':DEFINITION,'originalAuditScriptsAvailable':False,'reportMatchVerified':False,'comparisonWarning':'Independent metric definitions and fixture recipe. Original audit/reference/prototype were not supplied; numerical agreement is not certified. No acceptance threshold has been changed.','averages':averages,'reportComparisons':comparisons,'dry':dry,'blender':blend}

if __name__=='__main__':
 root=Path(sys.argv[1]);manifest=json.loads((root/'manifest.json').read_text());result=summarize(manifest['cases'],root);(root/'metrics.json').write_text(json.dumps(result,indent=2));print(json.dumps({'metricCases':len(result['dry'])+len(result['blender']),'averages':result['averages'],'originalAuditComparison':'unverified — missing source metric definitions/reference'},indent=2))
