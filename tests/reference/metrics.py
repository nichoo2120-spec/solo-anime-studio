import numpy as np,cv2,json,sys,glob,os
from PIL import Image
def load_ref(path='/workspace/ref_drybrush.png'):
    im=np.array(Image.open(path).convert('L')).astype(np.float32)
    im=im[14:-14,3:-14] # crop dark frame
    paper=cv2.dilate(im,np.ones((81,81),np.uint8)); paper=cv2.GaussianBlur(paper,(0,0),20)
    return np.clip(1-im/np.maximum(paper,1),0,1)
def load_layer(path):
    a=np.array(Image.open(path).convert('RGBA'))[...,3].astype(np.float32)/255
    return a
def split_strokes(A,n=None):
    B=(A>0.3).astype(np.uint8)
    D=cv2.dilate(B,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(61,41)))
    k,lab,st,_=cv2.connectedComponentsWithStats(D)
    comps=sorted(range(1,k),key=lambda i:-st[i,4])
    comps=[c for c in comps if st[c,4]>3000][:n] if n else comps[:1]
    comps=sorted(comps,key=lambda c:st[c,1])
    out=[]
    for c in comps:
        m=(lab==c)
        ys,xs=np.nonzero(m&(B>0))
        pts=np.stack([xs,ys],1).astype(np.float32)
        mean=pts.mean(0);u,s,vt=np.linalg.svd(pts-mean,full_matrices=False);ang=np.degrees(np.arctan2(vt[0,1],vt[0,0]))
        if abs(ang)>90: ang-=180*np.sign(ang)
        x,y,w,h=st[c,:4];pad=60
        x0,y0=max(0,x-pad),max(0,y-pad);x1,y1=min(A.shape[1],x+w+pad),min(A.shape[0],y+h+pad)
        crop=A[y0:y1,x0:x1].copy()
        # remove neighbours not in this component's dilation (pad region could include other strokes)
        keep=cv2.dilate((lab[y0:y1,x0:x1]==c).astype(np.uint8),np.ones((121,121),np.uint8))>0
        crop=crop*keep
        H,W=crop.shape;M=cv2.getRotationMatrix2D((W/2,H/2),ang,1.0)
        cs=int(np.ceil(np.hypot(H,W)))
        M[0,2]+=(cs-W)/2;M[1,2]+=(cs-H)/2
        rot=cv2.warpAffine(crop,M,(cs,cs),flags=cv2.INTER_CUBIC)
        out.append((np.clip(rot,0,1),ang))
    return out
def runs(col):
    d=np.diff(np.concatenate([[0],col.astype(np.int8),[0]]));return np.nonzero(d==1)[0],np.nonzero(d==-1)[0]
def analyze(R):
    ink=(R>0.5).astype(np.uint8)
    closed=cv2.morphologyEx(ink,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,9)))
    k,lab,st,_=cv2.connectedComponentsWithStats(closed)
    if k<2: return {}
    c=1+int(np.argmax(st[1:,4]));main=(lab==c)
    ys,xs=np.nonzero(main);x0,x1=xs.min(),xs.max();L=x1-x0+1
    ext=[]
    for x in range(x0,x1+1):
        yy=np.nonzero((R[:,x]>0.3)&(main[:,x]|True))[0]
        yy=yy[(yy>=ys.min()-5)&(yy<=ys.max()+5)]
        ext.append(yy.max()-yy.min()+1 if len(yy) else 0)
    ext=np.array(ext);Wd=float(np.median(ext[int(.2*L):int(.8*L)]))
    mid=range(x0+int(.2*L),x0+int(.8*L))
    nr=[];thick=[];gap=[]
    for x in mid:
        s,e=runs(R[:,x]>0.5)
        if len(s):
            nr.append(len(s));thick+=list(e-s);tot=e[-1]-s[0];gap.append(1-(e-s).sum()/max(tot,1))
    # anisotropy inside hull
    hull=cv2.dilate(main.astype(np.uint8),np.ones((9,9),np.uint8))>0
    gx=cv2.Sobel(R,cv2.CV_32F,1,0,ksize=3);gy=cv2.Sobel(R,cv2.CV_32F,0,1,ksize=3)
    aniso=float(np.mean(np.abs(gx[hull]))/max(np.mean(np.abs(gy[hull])),1e-6))
    cnts,_=cv2.findContours(main.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    cn=max(cnts,key=cv2.contourArea);per=cv2.arcLength(cn,True);hp=cv2.arcLength(cv2.convexHull(cn),True)
    # raw (unclosed) edge raggedness: contour of A>0.5 mask
    cr,_=cv2.findContours(ink,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    rawper=sum(cv2.arcLength(q,True) for q in cr if cv2.contourArea(q)>20)
    # tail
    colink=(ink[:, :]>0).sum(0)
    cov=np.array([ (R[:,x]>0.5).sum() for x in range(R.shape[1])])
    body=[x for x in range(x0,x1+1) if cov[x]>=0.5*Wd]
    xe=max(body) if body else x1; xs0=min(body) if body else x0
    anyi=np.nonzero((R>0.15).any(0))[0]
    # only count ink inside vertical window around stroke
    yc=(ys.min()+ys.max())/2
    win=(R[int(max(0,yc-1.5*Wd)):int(yc+1.5*Wd)]>0.15).any(0);anyi=np.nonzero(win)[0]
    tail=(anyi.max()-xe)/Wd;head=(xs0-anyi.min())/Wd
    # flecks
    far=cv2.dilate(main.astype(np.uint8),np.ones((7,7),np.uint8))==0
    fl=((R>0.25)&far).astype(np.uint8);k2,l2,s2,_=cv2.connectedComponentsWithStats(fl,connectivity=8)
    nfl=0;nhair=0;farea=0
    for i in range(1,k2):
        if s2[i,4]<3:continue
        nfl+=1;farea+=s2[i,4]
        pts=np.stack(np.nonzero(l2==i)[::-1],1).astype(np.float32)
        (cx,cy),(w,h),a=cv2.minAreaRect(pts);lo,hi=min(w,h),max(w,h)
        if hi>=12 and hi/max(lo,1)>=5:nhair+=1
    # tone
    fill=cv2.morphologyEx(main.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))>0
    tone=float(np.mean((R[fill]>0.1)&(R[fill]<0.9)))
    gf=float(np.mean(R[fill]<0.1)) # empty (paper-through) fraction inside hull
    q=int(.2*L);f_a=R[:,x0:x0+q][fill[:,x0:x0+q]].mean();l_a=R[:,x1-q:x1+1][fill[:,x1-q:x1+1]].mean()
    # taper
    t0=np.mean(ext[:int(.08*L)+1])/max(Wd,1);t1=np.mean(ext[-int(.08*L)-1:])/max(Wd,1)
    # periodicity
    p=np.array([R[:,x][hull[:,x]].mean() if hull[:,x].any() else 0 for x in range(x0+int(.1*L),x1-int(.1*L))]);p=p-p.mean();import scipy.ndimage as ndi;p=p-ndi.uniform_filter1d(p,61,mode='nearest')
    ac=np.correlate(p,p,'full')[len(p)-1:];ac=ac/max(ac[0],1e-9);lo=20;hi=min(len(p)//2,300)
    pk=float(ac[lo:hi].max()) if hi>lo else 0;lag=int(lo+np.argmax(ac[lo:hi])) if hi>lo else 0
    # 2D periodicity (along-x autocorr of whole interior, row-avg)
    return dict(L=int(L),W=Wd,streaks_med=float(np.median(nr)) if nr else 0,streaks_mean=float(np.mean(nr)) if nr else 0,run_thick_med=float(np.median(thick)) if thick else 0,gap_frac=float(np.mean(gap)) if gap else 0,
        aniso_gx_gy=aniso,perim_ratio_hull=float(per/hp),raw_perim_per_L=float(rawper/L),tail_len_W=float(tail),head_len_W=float(head),flecks=nfl,hairlines=nhair,fleck_area_frac=float(farea/max(fill.sum(),1)),
        midtone_frac=tone,empty_frac_in_hull=gf,dens_first20=float(f_a),dens_last20=float(l_a),dens_ratio_last_first=float(l_a/max(f_a,1e-6)),taper_start=float(t0),taper_end=float(t1),
        period_peak=pk,period_lag=lag,mean_alpha_hull=float(R[fill].mean()),ink_area_frac_hull=float((R[fill]>0.5).mean()))
if __name__=='__main__':
    ref=load_ref();ss=split_strokes(ref,4);res=[]
    for i,(R,ang) in enumerate(ss):
        m=analyze(R);m['name']=f'ref{i+1}';m['tilt_deg']=float(ang);res.append(m);Image.fromarray((255-R*255).astype(np.uint8)).save(f'/workspace/sas_b4_out/data/ref_stroke{i+1}.png')
    json.dump(res,open('/workspace/sas_b4_out/data/metrics_ref.json','w'),indent=1)
    keys=[k for k in res[0] if k!='name']
    for k in keys:print(f'{k:24s}',' '.join(f'{r[k]:9.3f}' for r in res))
