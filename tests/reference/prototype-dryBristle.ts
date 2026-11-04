// PROTOTYPE (experiment only, not wired into the app): per-bristle dry brush.
// Pure function: (points, params) -> alpha canvas. Deterministic from params.seed + points.
export type BPoint={x:number;y:number;p:number;v?:number};
export type DryParams={size:number;seed:number;
 bristles?:number;       // count; default from size
 load?:number;           // 0..1 starting paint load (bristle mean)
 depletion?:number;      // mean runout length in multiples of size
 speedDry?:number;       // extra dry-out at speed (0..3)
 lag?:number;            // bristle follow lag (multiples of size), splits at turns
 fray?:number;           // edge ragged amplitude (fraction of radius)
 tooth?:number;          // paper tooth interaction 0..1
 toothScale?:number;     // px size of paper tooth
 hair?:number;           // fraction of bristles that fly off at end
 flecks?:number;         // fleck density
 clumps?:number;         // bristles per clump
 widthMul?:number;
 pressureThreshold?:number; // how strongly light pressure drops bristles 0..1
 tailMul?:number;
 clumpAmp?:number;
 liftMul?:number;
};
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ss=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function rng32(seed:number){let a=seed>>>0||1;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x:number,y:number,s:number){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,2246822519);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function vnoise(x:number,y:number,s:number){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function n1(x:number,s:number){const xi=Math.floor(x),f=x-xi,u=f*f*(3-2*f);return hash2(xi,0,s)*(1-u)+hash2(xi+1,0,s)*u;}
type R={x:number;y:number;tx:number;ty:number;p:number;v:number;d:number};
function resample(pts:BPoint[]):R[]{
 const out:R[]=[];if(!pts.length)return out;if(pts.length===1){return [{x:pts[0].x,y:pts[0].y,tx:1,ty:0,p:pts[0].p,v:pts[0].v??.65,d:0}];}
 const P=pts;const cr=(a:number,b:number,c:number,d:number,t:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
 let d=0,prev:{x:number;y:number}|undefined;
 for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];const L=Math.hypot(p2.x-p1.x,p2.y-p1.y),n=Math.max(1,Math.ceil(L));
  for(let k=0;k<n;k++){const t=k/n,x=cr(p0.x,p1.x,p2.x,p3.x,t),y=cr(p0.y,p1.y,p2.y,p3.y,t);if(prev)d+=Math.hypot(x-prev.x,y-prev.y);prev={x,y};
   out.push({x,y,tx:0,ty:0,p:p1.p+(p2.p-p1.p)*t,v:(p1.v??.65)+((p2.v??.65)-(p1.v??.65))*t,d});}}
 const l=P[P.length-1];if(prev)d+=Math.hypot(l.x-prev.x,l.y-prev.y);out.push({x:l.x,y:l.y,tx:0,ty:0,p:l.p,v:l.v??.65,d});
 for(let i=0;i<out.length;i++){const a=out[Math.max(0,i-4)],b=out[Math.min(out.length-1,i+4)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1;out[i].tx=dx/m;out[i].ty=dy/m;}
 return out;
}
export function drawDryBristle(mask:HTMLCanvasElement,pts:BPoint[],o:DryParams){
 const S=o.size,Rr=S/2,seed=o.seed|0,rnd=rng32(seed*7919+13);
 const N=o.bristles??Math.round(clamp(S*.95,24,140)),load0=o.load??.9,dep=o.depletion??8,spd=o.speedDry??1.3,lagM=o.lag??.55,fray=o.fray??.09,hairF=o.hair??.12,clumpN=o.clumps??9,wMul=o.widthMul??1.0,pthr=o.pressureThreshold??.55,tailMul=o.tailMul??1;
 const path=resample(pts);if(!path.length)return;
 const ctx=mask.getContext('2d')!;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#000';
 const total=path[path.length-1].d,K=Math.max(2,Math.round(N/clumpN));
 type B={o:number;stiff:number;lagPx:number;load:number;dep:number;w:number;thr:number;tail:number;clump:number;span:number;hair:boolean;ph:number;delay:number;fr:number;x:number;y:number;alive:boolean;px:number;py:number};
 const bs:B[]=[];
 for(let i=0;i<N;i++){const oo=((i+.15+.7*rnd())/N)*2-1,edge=Math.abs(oo),stiff=.15+.85*Math.pow(rnd(),.8);
  const hair=rnd()<hairF&&edge>.15;
  bs.push({o:oo,stiff,lagPx:S*lagM*(.1+1.0*(1-stiff)),load:clamp(load0*(.55+.45*rnd())*(1-.55*ss(.7,1,edge)),.05,1),
   dep:S*dep*(.25+2.2*Math.pow(rnd(),1.6))*(1-.35*ss(.6,1,edge)),w:(.8+1.7*Math.pow(rnd(),2))*Math.max(1,S/55)*wMul,thr:Math.pow(rnd(),1.4)*pthr,
   tail:S*(hair?(.7+1.5*rnd()):(.04+.55*Math.pow(rnd(),2)))*tailMul,clump:Math.min(K-1,Math.floor((oo*.5+.5)*K+ (rnd()-.5)*.8)),span:S*(o.liftMul??1)*(.15+1.6*Math.pow(1-stiff,1.2)),hair,delay:S*.12*Math.pow(rnd(),1.5)*(.3+Math.abs(oo)),ph:rnd()*1000,fr:fray*(.3+.7*edge)*(.5+rnd()),x:0,y:0,alive:false,px:0,py:0});}
 const clumpPh=Array.from({length:K},()=>rnd()*1000);
 const seg=(b:B,x0:number,y0:number,x1:number,y1:number,a:number)=>{if(a<.012)return;ctx.globalAlpha=Math.min(1,a);ctx.lineWidth=b.w;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();};
 const attack=S*.18;
 for(let k=0;k<path.length;k++){
  const q=path[k],nx=-q.ty,ny=q.tx,d=q.d;
  const speed=clamp((.65-q.v)/.5+0.0,0,1.4)*0+clamp((1-q.v)/.85,0,1);
  const wp=.5+.5*Math.pow(clamp(q.p),.7);
  const toEnd=total-d;
  for(const b of bs){
   const cj=(n1(d*.012+clumpPh[b.clump],seed+3)-.5)*2*(o.clumpAmp??.22);
   const fj=(n1(d*.05+b.ph,seed+9)-.5)*2*b.fr;
   const lat=(b.o*wp+cj*(1-Math.abs(b.o)*.3)+fj);
   const tx=q.x+nx*lat*Rr,ty=q.y+ny*lat*Rr;
   if(!b.alive){b.x=tx;b.y=ty;b.alive=true;b.px=tx;b.py=ty;}
   const kk=1-Math.exp(-1/Math.max(1,b.lagPx));b.x+=(tx-b.x)*kk;b.y+=(ty-b.y)*kk;
   // contact
   const pres=q.p,cp=ss(b.thr-.06,b.thr+.06,pres);
   const liftStart=b.span,lift=ss(liftStart,0,toEnd)*0+ss(0,1,1-clamp(toEnd/ b.span));
   const depLen=b.dep/(1+spd*speed*1.6);
   const load=b.load*(d<attack?1:Math.exp(-(d-attack)/depLen));
   const skip=ss(.14,.42,n1(d*.045+b.ph*3.1,seed+5)*.6+.4*n1(d*.011+b.ph,seed+11));
   const edgeFade=1-.0;
   const att=d<attack?(.75+.25*d/attack):1;
   let a=(d<b.delay?0:1)*load*cp*(1-lift)*(.2+.8*skip)*att*edgeFade;
   if(b.hair)a*=.85;
   seg(b,b.px,b.py,b.x,b.y,a);b.px=b.x;b.py=b.y;
  }
 }
 // tails: bristles keep coasting along the last tangent and lift off
 const e=path[path.length-1];
 for(const b of bs){
  const lastLoad=b.load*Math.exp(-Math.max(0,total-attack)/(b.dep/(1+spd*clamp((1-e.v)/.85)*1.6)));
  if(lastLoad<.03)continue;const steps=Math.round(b.tail);let px=b.px,py=b.py;
  const curl=(rnd()-.5)*.0025;let tx=e.tx,ty=e.ty;
  for(let s=1;s<=steps;s++){const t=s/steps,a=lastLoad*Math.pow(1-t,b.hair?.7:1.6)*(.35+.65*ss(.2,.5,n1(s*.07+b.ph,seed+17)))*(b.hair?.9:.8)*ss(0,.05,1);
   const c=Math.cos(curl),sn=Math.sin(curl),ntx=tx*c-ty*sn,nty=tx*sn+ty*c;tx=ntx;ty=nty;
   const nx=px+tx,ny=py+ty;seg(b,px,py,nx,ny,a*(b.hair?1:.9));px=nx;py=ny;}
 }
 // flecks: tiny dashes thrown past the end and along the final third
 const fl=Math.round((o.flecks??1)*S*.45);
 for(let i=0;i<fl;i++){const t=Math.pow(rnd(),1.5),dd=total-S*(.4)+t*S*1.9,lat=(rnd()*2-1)*Rr*.95,len=1+rnd()*(2+6*rnd()),aa=(.25+.6*rnd())*(1-t*.6)*(o.load??.9);
  let q=path[path.length-1];let ex=0;if(dd<=total){let j=path.length-1;while(j>0&&path[j].d>dd)j--;q=path[j];}else ex=dd-total;
  const nx=-q.ty,ny=q.tx,x=q.x+q.tx*ex+nx*lat,y=q.y+q.ty*ex+ny*lat;ctx.globalAlpha=aa;ctx.lineWidth=.8+rnd()*1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+q.tx*len,y+q.ty*len);ctx.stroke();}
 ctx.restore();
}
/** Paper tooth: dry paint only sticks to raised paper where load is low. In-place on alpha of the bbox. */
export function applyTooth(mask:HTMLCanvasElement,color:string,o:{tooth:number;scale:number;seed:number;blur?:number;wash?:number}){
 const w=mask.width,h=mask.height,ctx=mask.getContext('2d')!;if(o.blur){const t=document.createElement('canvas');t.width=w;t.height=h;const tc=t.getContext('2d')!;tc.filter=`blur(${o.blur}px)`;tc.drawImage(mask,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(t,0,0);}
 const img=ctx.getImageData(0,0,w,h),d=img.data;
 const m=/#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color)!,r=parseInt(m[1],16),g=parseInt(m[2],16),b=parseInt(m[3],16);
 const sc=o.scale,k=o.tooth;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,A=d[j+3]/255;
  if(A>0.004){const t=.5*vnoise(x/sc,y/sc,o.seed)+.3*vnoise(x/(sc*2.3)+7,y/(sc*2.3)+3,o.seed+1)+.2*vnoise(x/(sc*6)+1,y/(sc*6)+9,o.seed+2);
   const bump=Math.min(1,4*A*(1-A)+.35*(1-A)*A*0)+0;
   const e=A+(.5-t)*2*k*(Math.min(1,A*(1-A)*4)*.9+(A<.5?A*.4:0));
   let aa=ss(.18,.78,e);if(o.wash){const wv=.65*vnoise(x/22,y/5,o.seed+21)+.35*vnoise(x/6,y/2.5,o.seed+22);aa*=1-o.wash*wv;}d[j+3]=Math.round(255*aa);}
  d[j]=r;d[j+1]=g;d[j+2]=b;}
 ctx.putImageData(img,0,0);
}
