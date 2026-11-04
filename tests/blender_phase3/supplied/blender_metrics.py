#!/usr/bin/env python3
"""Blender metrics. Usage: python3 blender_metrics.py data/TAG  [--check]
Reads <case>__out.png / <case>__base.png made by blend_run.mjs (900x300, visible edge x=430 (blue round caps overlap red),
blender drags left->right along y=150 from x=180 to 720). Writes data/TAG/metrics.json.
--check compares against the Blender v2 targets (TARGETS below) and exits 1 on any fail."""
import sys,json,glob,os,numpy as np
from PIL import Image
RED=np.array([214,40,40.]);BLUE=np.array([29,78,216.]);AX=RED-BLUE;EDGE=430;END=720
def rgb(p):
    a=np.array(Image.open(p).convert('RGBA')).astype(float);al=a[...,3:]/255;return a[...,:3]*al+255*(1-al)
def tval(img):return ((img-BLUE)@AX)/(AX@AX)
def rb_case(out,base,size):
    t=tval(out);tb=tval(base);band=slice(150-size//4,150+size//4+1)
    tm=t[band].mean(0);x=np.arange(out.shape[1])
    blue=(x>EDGE)&(x<END+size)
    cols=np.nonzero((tm>.08)&blue)[0];carry=int(cols.max()-EDGE) if len(cols) else 0
    at=lambda d:round(float(tm[EDGE+d]),3)
    t10=tm[EDGE+10];hl=next((d for d in range(10,END-EDGE) if tm[EDGE+d]<t10/2),END-EDGE)
    xm=EDGE+40;prof=np.abs(t[:,xm]-tb[:,xm]);pk=prof.max()
    edge=int((prof>.1*pk).sum()-(prof>.9*pk).sum()) if pk>.02 else -1
    seg=t[band,EDGE+10:EDGE+10+max(60,size)];streak=float(seg.std(0).mean())
    # repeat: autocorrelation of the detrended band profile in the blue half
    p=tm[EDGE+10:END];p=p-np.convolve(p,np.ones(41)/41,'same');p=p[20:-20]
    rep=0.
    if p.std()>1e-4:
        ac=np.correlate(p,p,'full')[len(p)-1:];ac/=ac[0];rep=float(ac[8:min(200,len(ac))].max())
    d=np.abs(out-base).max(2);off=int((d[:150-size]>8).sum()+(d[150+size:]>8).sum()) if size<150 else 0
    return dict(carry_red_into_blue_px=carry,carry_x_size=round(carry/size,2),red_t_at_edge_plus=dict(**{str(k):at(k) for k in (10,40,100,200)}),
                half_life_px=int(hl),edge_10_90_px=edge,streak_std=round(streak,4),repeat_peak=round(rep,3),off_stroke_changed_px=off)
def white_case(out,base):
    d=np.abs(out-base).max(2);band=d[130:171];x=np.arange(out.shape[1])
    cols=np.nonzero((band.mean(0)>8)&(x>215))[0];return dict(smear_on_white_px=int(cols.max()-215) if len(cols) else 0,
        smear_strength_at_plus60=round(float(band[:,275].mean()/255),3))
SIZE={'rb_s30':30,'rb_s130':130}
TARGETS={ # Blender v2 (smudgeVersion 2) at default settings, size 70 unless noted
 'rb_mid.carry_x_size':('>=',3.0),'rb_mid.red_t_at_edge_plus.40':('>=',.35),'rb_mid.red_t_at_edge_plus.100':('>=',.2),
 'rb_mid.half_life_px':('>=',105),'rb_mid.edge_10_90_px':('>=',12),'rb_mid.repeat_peak':('<=',.35),
 'rb_mid.off_stroke_changed_px':('<=',0),'rb_s130.carry_x_size':('>=',1.6),'rb_s30.carry_x_size':('>=',3.0),
 'w_patch.smear_on_white_px':('>=',140),'w_empty.changed_px':('<=',0),
 'pressure_gap.heavy_minus_light_carry_px':('>=',40),'speed_gap.slow_vs_fast_t40':('>=',.05),
}
def get(m,k):
    for p in k.split('.'):m=m[p]
    return m
if __name__=='__main__':
    d=sys.argv[1];res={}
    for p in sorted(glob.glob(f'{d}/*__out.png')):
        n=os.path.basename(p).split('__')[0];out=rgb(p);base=rgb(p.replace('__out','__base'))
        if n=='w_empty':res[n]=dict(changed_px=int((np.abs(out-base).max(2)>8).sum()))
        elif n.startswith('w_'):res[n]=white_case(out,base)
        else:res[n]=rb_case(out,base,SIZE.get(n,70))
    if 'rb_heavy' in res:res['pressure_gap']=dict(heavy_minus_light_carry_px=res['rb_heavy']['carry_red_into_blue_px']-res['rb_light']['carry_red_into_blue_px'])
    if 'rb_slow' in res:res['speed_gap']=dict(slow_vs_fast_t40=round(abs(res['rb_slow']['red_t_at_edge_plus']['40']-res['rb_fast']['red_t_at_edge_plus']['40']),3))
    pf=f'{d}/perf.json'
    if os.path.exists(pf):
        P=json.load(open(pf));res['perf']={k:dict(mean=round(np.mean([r['mean'] for r in v]),2),p95=round(np.mean([r['p95'] for r in v]),2),max=max(r['max'] for r in v)) for k,v in P.items()}
        TARGETS['perf.s130.p95']=('<=',3.0)
    json.dump(res,open(f'{d}/metrics.json','w'),indent=1)
    for k,v in res.items():print(k.ljust(10),v)
    if '--check' in sys.argv:
        bad=0
        for k,(op,v) in TARGETS.items():
            try:x=get(res,k)
            except KeyError:print('MISSING',k);bad+=1;continue
            ok=x>=v if op=='>=' else x<=v;bad+=not ok;print(('PASS' if ok else 'FAIL').ljust(5),k,x,op,v)
        sys.exit(1 if bad else 0)
