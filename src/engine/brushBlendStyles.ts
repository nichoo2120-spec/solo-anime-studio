/** v0.5.242 Blend mode v2: every brush family blends in its own style.
 *
 * In plain words:
 * - Same idea as v1 (pick up the colours under the nib, carry them, lay them
 *   down only where the brush's own stroke has coverage), but the carried colour
 *   is held much longer, so colour is really dragged from one area into the next.
 * - Paint is never thinned by empty paper: blending only moves colour around and
 *   can spread paint outward, so there are no pale or white halos.
 * - Each family has its own recipe (BlendStyle):
 *   water   soft wet bleed, transparent pigment mixing (optical density), an
 *           uneven blooming wet front, a darker tide line, cloudy wash and grain
 *           (the Silk Wet v2 / watercolor brush logic).
 *   dry     rough, broken, grainy, scratchy drag along the stroke (bristle gaps).
 *   pencil  graphite smudge with paper tooth, gentle and fine.
 *   ink     wet ink smear: crisp edge, long drag, subtractive mixing.
 *   air     very soft, wide, airy blur.
 *   oil     thick buttery drag with soft bristle streaks.
 *   marker  even, transparent marker bleed with subtractive mixing.
 *   texture blend through a canvas grain.
 *   soft    smooth soft blending.
 * - Pure function of the saved stroke (seeded noise in canvas coordinates), so
 *   the worker's live result, the final result and a reload are identical.
 */
import type {Point,Stroke} from '../core/model';
import type {BlendStyle} from '../core/brushBlend';
import type {RasterRegion} from './liveRaster';
import {SilkSurface,TILE,PATCH,CELLS,type Tile} from './silkBlend';
import {paintNoise} from './paintingTips';

type Ctx=CanvasRenderingContext2D;
export interface BlendMask{tile(tx:number,ty:number):Uint8Array}
export type BlendSnapshot={data:Uint8ClampedArray;x:number;y:number;width:number;height:number};
const clamp01=(v:number)=>v<0?0:v>1?1:v;
const ease=(a:number,b:number,v:number)=>{const t=v<=a?0:v>=b?1:(v-a)/(b-a);return t*t*(3-2*t);};
const fade=(t:number)=>t*t*(3-2*t);
const hash=(x:number,y:number,seed:number)=>{let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed|0,2246822519);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967295;};
function valueNoise(x:number,y:number,seed:number){const ix=Math.floor(x),iy=Math.floor(y),fx=fade(x-ix),fy=fade(y-iy),a=hash(ix,iy,seed),b=hash(ix+1,iy,seed),c=hash(ix,iy+1,seed),d=hash(ix+1,iy+1,seed);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
function noise1(x:number,seed:number){const ix=Math.floor(x),t=fade(x-ix),a=hash(ix,0,seed),b=hash(ix+1,0,seed);return a+(b-a)*t;}
function strokeSeed(id:string){let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const NEG_LN=new Float32Array(1025);for(let i=0;i<=1024;i++)NEG_LN[i]=-Math.log(Math.max(1/255,i/1024));
const negLn=(v:number)=>{const x=(v<0?0:v>1?1:v)*1024,i=Math.floor(x),f=x-i;return i>=1024?NEG_LN[1024]:NEG_LN[i]+(NEG_LN[i+1]-NEG_LN[i])*f;};

type Profile={pick:number;mean:number;blur:number;density:boolean;gain:number;drag:number;fall:(d:number)=>number};
const soft=(d:number)=>{const q=1-d*d;return q*Math.sqrt(q);};
const edge=(w:number)=>(d:number)=>{const e=(1-d)/w;return e>=1?1:e*e*(3-2*e);};
/** Family recipes. pick = how fast the brush reloads with the colour under it,
 * mean = how much the nib averages (soft blur), blur = extra bleed passes,
 * density = transparent pigment mixing, drag = how long colour is carried. */
export const blendProfiles:Record<BlendStyle,Profile>={
 water:{pick:.5,mean:.3,blur:1,density:true,gain:2.6,drag:1.6,fall:soft},
 dry:{pick:.45,mean:.04,blur:0,density:false,gain:2.6,drag:1.7,fall:edge(.22)},
 pencil:{pick:.8,mean:.3,blur:0,density:false,gain:2.1,drag:.8,fall:d=>{const q=1-d*d;return q*Math.sqrt(q);}},
 ink:{pick:.55,mean:0,blur:0,density:true,gain:2.4,drag:2.2,fall:edge(.14)},
 air:{pick:1,mean:.85,blur:1,density:false,gain:2,drag:.6,fall:d=>{const q=1-d*d;return q*q;}},
 oil:{pick:.5,mean:.08,blur:0,density:false,gain:2.4,drag:2,fall:edge(.3)},
 marker:{pick:.75,mean:.45,blur:0,density:true,gain:1.8,drag:1,fall:edge(.2)},
 texture:{pick:.55,mean:.2,blur:0,density:false,gain:2.1,drag:1.2,fall:soft},
 soft:{pick:.7,mean:.55,blur:1,density:false,gain:1.8,drag:1,fall:d=>{const q=1-d*d;return q*q;}},
};
type WaterFinish={pool:number;cloud:number;grain:number;edgeAlpha:number};

export class BrushBlendGestureV2{
 readonly surface:SilkSurface;
 private reservoir?:Float32Array;
 private readonly sampled=new Float32Array(CELLS*4);private readonly target=new Float32Array(CELLS*4);private readonly scratch=new Float32Array(CELLS*4);private readonly hpass=new Float32Array(CELLS*4);private readonly density=new Float32Array(CELLS*4);
 private next=0;private carry=0;private traveled=0;private count=0;private dirX=1;private dirY=0;
 private readonly style:BlendStyle;private readonly prof:Profile;private readonly seed:number;
 private readonly p:{amount:number;pickup:number;wet:number;mix:number;flow:number;stretch:number;load:number;pressure:boolean;protect:boolean;color:[number,number,number];spacing:number};
 private readonly water?:WaterFinish;private readonly blurPasses:number;private readonly mean:number;private readonly cloudSize:number;private readonly wetFront:number;
 private readonly path:Point[]=[];
 dabs=0;
 constructor(private readonly s:Stroke,width:number,height:number,read:Ctx,private mask:BlendMask,private readonly sample:BlendSnapshot|undefined,carry:Float32Array|undefined,private readonly sampleAt:(src:BlendSnapshot,x:number,y:number,out:Float32Array,o:number)=>void){
  this.surface=new SilkSurface(width,height,read);
  const hex=/^#[\da-f]{6}$/i.test(s.color)?s.color:'#000000';
  this.p={amount:clamp01(s.bbAmount??.85),pickup:clamp01(s.bbPickup??.5),wet:clamp01(s.bbWetness??.4),mix:clamp01(s.bbMix??.6),flow:clamp01(s.bbFlow??.6),stretch:clamp01(s.bbStretch??.45),load:clamp01(s.bbPaintLoad??0),pressure:s.bbPressure!==false,protect:!!s.bbProtectAlpha,
   color:[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)],spacing:Math.max(.03,Math.min(.5,s.tipSpacing??.08))};
  this.style=s.bbStyle??'soft';this.prof=blendProfiles[this.style];this.seed=strokeSeed(s.id);
  const wet=this.p.wet;
  // Wetness: more bleed passes and more averaging; the watercolor family bleeds most.
  this.blurPasses=this.prof.blur?this.prof.blur+Math.round(wet*(this.style==='water'?2:1)):(this.style==='dry'||this.style==='ink'?0:Math.round(wet*1.2));
  this.mean=this.prof.mean+(1-this.prof.mean)*wet*(this.style==='dry'?.1:this.style==='ink'?.15:.35);
  this.cloudSize=Math.max(12,s.size*.35);this.wetFront=.45*wet;
  if(this.style==='water'){const str=clamp01(.35+.6*this.p.flow)*clamp01(s.opacity),rough=s.brushTip==='water-rough'||s.brushTip==='water-flat';
   const ek=s.edgeDarkness??1;// v0.5.243: no dark wet edge unless the brush asks for it
   this.water={pool:str*(.35+.65*wet)*.3*ek,cloud:(.05+.1*wet)*(.4+.6*str),grain:rough?.2:.11,edgeAlpha:str*(.12+.18*wet)*ek};}
  this.reservoir=carry;
 }
 setMask(mask:BlendMask){this.mask=mask;}
 get pointCount(){return this.count;}
 private radius(p:number){const s=this.s,pr=s.pressure?clamp01(p):1,min=s.minSize??.2;return Math.max(1,s.size*.5*(s.pressure&&s.pressureWidth!==false?min+(1-min)*pr:1)*1.35+1.5);}
 private step(r:number){return Math.max(.6,2*r*this.p.spacing);}
 advance(points:Point[]){
  if(!points.length)return;
  for(let i=this.count;i<points.length;i++)this.path.push(points[i]);this.count=points.length;
  const path=this.path;
  if(this.next===0){const q=path[0],r=this.radius(q.p);this.dab(q.x,q.y,q.p,r,this.step(r));this.carry=this.step(r);this.next=1;}
  for(;this.next<path.length;this.next++){
   const a=path[this.next-1],b=path[this.next],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-9)continue;
   this.dirX=dx/len;this.dirY=dy/len;
   while(this.carry<=len){const t=this.carry/len,x=a.x+dx*t,y=a.y+dy*t,p=a.p+(b.p-a.p)*t,r=this.radius(p),st=this.step(r);this.traveled+=st;this.dab(x,y,p,r,st);this.carry+=st;}
   this.carry-=len;
  }
 }
 /** Watercolor fields per tile (seeded, canvas coordinates): broad warped cloud + grain. */
 private readonly lattice=new Float32Array((TILE/4+1)*(TILE/4+1));
 private waterFields(t:Tile){
  if(t.wet)return;
  t.wet=new Float32Array(TILE*TILE);t.cloud=new Float32Array(TILE*TILE);t.grain=new Float32Array(TILE*TILE);
  const sx=(this.seed&65535)+17,sy=(this.seed>>>16)+29,cl=this.cloudSize,fine=Math.max(2.2,Math.min(4,this.s.size*.035)),G=TILE/4+1,lattice=this.lattice;
  for(let j=0;j<G;j++)for(let i=0;i<G;i++){const x=t.x+i*4,y=t.y+j*4,broad=paintNoise(sx+(x+y*.37)/cl,sy+(y-x*.21)/(cl*.85)),warp=(broad-.5)*1.4,patch=paintNoise(sx+91+x/(cl*.42)+warp,sy+57+y/(cl*.53)-warp*.7);lattice[j*G+i]=broad*.76+patch*.24;}
  for(let j=0;j<t.h;j++){const gj=j>>2,v=(j&3)/4;for(let i=0;i<t.w;i++){const gi=i>>2,u=(i&3)/4,k=gj*G+gi,c=j*TILE+i;
   t.cloud[c]=(lattice[k]*(1-u)+lattice[k+1]*u)*(1-v)+(lattice[k+G]*(1-u)+lattice[k+G+1]*u)*v;
   const x=t.x+i,y=t.y+j;t.grain[c]=paintNoise(sx+171+(x+y*.27)/fine,sy+331+(y-x*.19)/fine);}}
 }
 /** Bleed passes (separable 3x3 box) and the nib mean, linear or as pigment density. */
 private build(){
  const T=this.target,B=this.scratch,H=this.hpass,row=PATCH*4;let src:Float32Array=T;
  for(let pass=0;pass<this.blurPasses;pass++){const out=src===T?B:T;
   for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const k=(j*PATCH+i)*4,l=i>0?k-4:k,r=i<PATCH-1?k+4:k,inner=i>0&&i<PATCH-1;for(let c=0;c<4;c++)H[k+c]=inner?(src[l+c]+src[k+c]+src[r+c])/3:(src[k+c]+src[i>0?l+c:r+c])*.5;}
   for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const k=(j*PATCH+i)*4,inner=j>0&&j<PATCH-1;for(let c=0;c<4;c++)out[k+c]=inner?(H[k-row+c]+H[k+c]+H[k+row+c])/3:(H[k+c]+H[j>0?k-row+c:k+row+c])*.5;}
   src=out;}
  if(src!==T)T.set(src);
  const mean=this.mean,keep=1-mean;if(mean<=0)return;
  if(this.prof.density){
   // Transparent pigment: average optical density (red + blue -> violet, not grey).
   const D=this.density;let dr=0,dg=0,db=0,ma=0,mw=0;
   for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const k=(j*PATCH+i)*4,a=T[k+3];
    if(a>=1){const m=1/a;D[k]=negLn(T[k]*m);D[k+1]=negLn(T[k+1]*m);D[k+2]=negLn(T[k+2]*m);}else D[k]=D[k+1]=D[k+2]=-1;
    const dx=(i+.5)/PATCH*2-1,dy=(j+.5)/PATCH*2-1,d2=dx*dx+dy*dy;if(d2>=1)continue;const w=1-d2;ma+=a*w;mw+=w;if(a>=1){const aw=a*w;dr+=D[k]*aw;dg+=D[k+1]*aw;db+=D[k+2]*aw;}}
   const wsum=ma;ma=mw>0?ma/mw:0;if(wsum>0){dr/=wsum;dg/=wsum;db/=wsum;}
   for(let k=0;k<CELLS*4;k+=4){const a=T[k+3]*keep+ma*mean;if(a<1e-4){T[k]=T[k+1]=T[k+2]=T[k+3]=0;continue;}
    const own=D[k]>=0,wo=own?T[k+3]*keep:0,wm=wsum>0?ma*mean:0,ws=wo+wm;if(ws<=0){T[k+3]=a;continue;}
    const r=own?(D[k]*wo+dr*wm)/ws:dr,g=own?(D[k+1]*wo+dg*wm)/ws:dg,b=own?(D[k+2]*wo+db*wm)/ws:db;
    T[k]=Math.exp(-r)*a;T[k+1]=Math.exp(-g)*a;T[k+2]=Math.exp(-b)*a;T[k+3]=a;}
  }else{
   let mr=0,mg=0,mb=0,ma=0,mw=0;for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const dx=(i+.5)/PATCH*2-1,dy=(j+.5)/PATCH*2-1,d2=dx*dx+dy*dy;if(d2>=1)continue;const w=1-d2,k=(j*PATCH+i)*4;mr+=T[k]*w;mg+=T[k+1]*w;mb+=T[k+2]*w;ma+=T[k+3]*w;mw+=w;}
   if(mw>0){mr/=mw;mg/=mw;mb/=mw;ma/=mw;for(let k=0;k<CELLS*4;k+=4){T[k]=T[k]*keep+mr*mean;T[k+1]=T[k+1]*keep+mg*mean;T[k+2]=T[k+2]*keep+mb*mean;T[k+3]=T[k+3]*keep+ma*mean;}}
  }
 }
 private dab(x:number,y:number,p:number,r:number,step:number){
  const P=this.p,S=this.sampled,T=this.target,pr=this.s.pressure?clamp01(p):1,u=step/(.2*r),style=this.style,prof=this.prof;
  for(let j=0;j<PATCH;j++){const cy=y+((j+.5)/PATCH*2-1)*r;for(let i=0;i<PATCH;i++){const cx=x+((i+.5)/PATCH*2-1)*r,o=(j*PATCH+i)*4;if(this.sample)this.sampleAt(this.sample,cx,cy,S,o);else this.surface.sample(cx,cy,S,o);}}
  // Colour Pickup: the brush reloads slowly, so colour is dragged along.
  if(!this.reservoir)this.reservoir=S.slice();
  else{const pick=1-Math.pow(1-Math.min(.9,prof.pick*(.03+.5*Math.pow(P.pickup,1.3))),u),R=this.reservoir;for(let k=0;k<R.length;k++)R[k]+=(S[k]-R[k])*pick;}
  const R=this.reservoir;
  for(let k=0;k<CELLS*4;k++)T[k]=S[k]*P.mix+R[k]*(1-P.mix);
  this.build();
  if(P.load>0){const L=P.load,keep=1-L,[cr,cg,cb]=P.color;for(let k=0;k<CELLS*4;k+=4){T[k]=T[k]*keep+cr*L;T[k+1]=T[k+1]*keep+cg*L;T[k+2]=T[k+2]*keep+cb*L;T[k+3]=T[k+3]*keep+255*L;}}
  let strength=clamp01(this.s.opacity)*P.flow*(P.pressure&&this.s.pressure?.3+.7*pr:1)*prof.gain;
  if(P.stretch<1)strength*=Math.exp(-this.traveled/(2*r*(1+P.stretch*P.stretch*40*prof.drag)));
  const alpha=1-Math.pow(1-Math.min(.95,strength*.4),u);
  this.dabs++;if(alpha<=1e-5)return;
  const left=Math.max(0,Math.floor(x-r)),top=Math.max(0,Math.floor(y-r)),right=Math.min(this.surface.width,Math.ceil(x+r)),bottom=Math.min(this.surface.height,Math.ceil(y+r));if(right<=left||bottom<=top)return;
  const inv=1/r,protect=P.protect,fall=prof.fall,seed=this.seed,dirX=this.dirX,dirY=this.dirY,water=!!this.water,wetFront=this.wetFront;
  const coverage=.3+.45*pr*(.5+.5*P.flow),covGain=(style==='air'?2.6:style==='water'?2.2:1)/255;
  for(let ty=Math.floor(top/TILE);ty*TILE<bottom;ty++)for(let tx=Math.floor(left/TILE);tx*TILE<right;tx++){
   const t=this.surface.tile(tx,ty);if(!t)continue;const m=this.mask.tile(tx,ty);if(water)this.waterFields(t);
   const x0=Math.max(left,t.x),x1=Math.min(right,t.x+t.w),y0=Math.max(top,t.y),y1=Math.min(bottom,t.y+t.h),f=t.f,changed=t.changed;let any=false;
   for(let py=y0;py<y1;py++){const dy=(py+.5-y)*inv,dy2=dy*dy;if(dy2>=1)continue;
    for(let px=x0;px<x1;px++){
     const dx=(px+.5-x)*inv,d2=dx*dx+dy2;if(d2>=1)continue;const c=(py-t.y)*TILE+px-t.x,cov=m[c];if(!cov)continue;
     let d=Math.sqrt(d2);
     if(water){d*=1+wetFront*t.cloud![c];if(d>=1)continue;const wc=ease(0,.75,1-d);if(wc>t.wet![c])t.wet![c]=wc;}
     // the brush's own coverage, lifted so thin washes still blend fully
     let a=alpha*fall(d)*Math.sqrt(Math.min(1,cov*covGain));
     if(style==='dry'){const across=dx*-dirY+dy*dirX,bristle=noise1(across*15+((seed>>16)&63),seed&1023),grain=valueNoise(px*.55,py*.55,seed&255),mm=grain*.4+bristle*.6,th=1-coverage,cc=clamp01((mm-th+.08)/.16);
      a*=cc*cc*(3-2*cc)*(.7+.6*noise1(across*46+((seed>>8)&63),(seed>>4)&1023));}
     else if(style==='pencil'){const g=valueNoise(px*.85,py*.85,seed&255)*.7+valueNoise(px*.27,py*.27,(seed>>8)&255)*.3;a*=.2+.8*clamp01((g-.18)/.5);}
     else if(style==='texture'){const g=valueNoise(px*.33,py*.33,seed&255)*.6+valueNoise(px*.11,py*.11,(seed>>8)&255)*.4;a*=.2+.8*clamp01((g-.3)/.35);}
     else if(style==='oil'){const across=dx*-dirY+dy*dirX;a*=.62+.38*noise1(across*9+((seed>>16)&63),seed&1023);}
     if(a<=1e-5)continue;if(a>1)a=1;
     let cu=(dx+1)*.5*PATCH-.5,cv=(dy+1)*.5*PATCH-.5;cu=cu<0?0:cu>PATCH-1?PATCH-1:cu;cv=cv<0?0:cv>PATCH-1?PATCH-1:cv;
     const iu=Math.min(PATCH-2,Math.floor(cu)),iv=Math.min(PATCH-2,Math.floor(cv)),fu=cu-iu,fv=cv-iv,k00=(iv*PATCH+iu)*4,k10=k00+4,k01=k00+PATCH*4,k11=k01+4,w00=(1-fu)*(1-fv),w10=fu*(1-fv),w01=(1-fu)*fv,w11=fu*fv,o=c*4;
     const ta=T[k00+3]*w00+T[k10+3]*w10+T[k01+3]*w01+T[k11+3]*w11;if(ta<.5)continue;
     const pa=f[o+3];
     // Colour moves toward the carried colour; alpha never drops (no halos),
     // and paint may spread outward into empty paper (unless protected).
     const na=protect?pa:pa+(Math.max(pa,ta)-pa)*a;if(na<.5)continue;
     const inT=1/ta,inP=pa>=.5?1/pa:0;
     for(let ch=0;ch<3;ch++){const tc=(T[k00+ch]*w00+T[k10+ch]*w10+T[k01+ch]*w01+T[k11+ch]*w11)*inT,pc=pa>=.5?f[o+ch]*inP:tc;f[o+ch]=(pc+(tc-pc)*a)*na;}
     f[o+3]=na;changed[c]=1;any=true;
    }
   }
   if(any){t.dirty=true;t.touched=true;}
  }
 }
 private bytes(t:Tile,target:Uint8ClampedArray){
  const {w,h,f,orig,changed}=t,amount=this.p.amount,water=this.water;const edgeOn=!!water&&(water.pool!==0||water.edgeAlpha!==0);// v0.5.243: no edge pass when the edge is off
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   const k=(j*w+i)*4,c=j*TILE+i;
   if(!changed[c]){target[k]=orig[k];target[k+1]=orig[k+1];target[k+2]=orig[k+2];target[k+3]=orig[k+3];continue;}
   const o=c*4,om=orig[k+3]/255;let r=f[o],g=f[o+1],b=f[o+2],a=f[o+3];
   if(amount<1){r=orig[k]*om+(r-orig[k]*om)*amount;g=orig[k+1]*om+(g-orig[k+1]*om)*amount;b=orig[k+2]*om+(b-orig[k+2]*om)*amount;a=orig[k+3]+(a-orig[k+3])*amount;}
   if(a<.5){target[k]=target[k+1]=target[k+2]=target[k+3]=0;continue;}
   const m=255/a;
   if(water&&t.wet){
    // Watercolor finish: pigment collects at the drying wet front (tide line),
    // settles in clouds and paper grain. It deepens the existing colour only.
    const wv=t.wet[c],bank=edgeOn?ease(.04,.5,wv)*(1-ease(.45,.97,wv)):0,am=amount;
    let kk=1+(water.pool*bank+water.cloud*(t.cloud![c]-.5)*2*wv+water.grain*(t.grain![c]-.5)*2*wv)*am;kk=kk<.8?.8:kk>1.7?1.7:kk;
    target[k]=Math.round(255*Math.pow(Math.min(1,r*m/255),kk));target[k+1]=Math.round(255*Math.pow(Math.min(1,g*m/255),kk));target[k+2]=Math.round(255*Math.pow(Math.min(1,b*m/255),kk));
    target[k+3]=Math.round(Math.min(255,a*(1+water.edgeAlpha*bank*am)));continue;
   }
   target[k]=Math.round(r*m);target[k+1]=Math.round(g*m);target[k+2]=Math.round(b*m);target[k+3]=Math.round(a);
  }
 }
 flush(ctx:Ctx,all=false):RasterRegion|undefined{
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const t of this.surface.tiles.values()){if(!(t.dirty||all&&t.touched))continue;const img=ctx.createImageData(t.w,t.h);this.bytes(t,img.data);ctx.putImageData(img,t.x,t.y);t.dirty=false;left=Math.min(left,t.x);top=Math.min(top,t.y);right=Math.max(right,t.x+t.w);bottom=Math.max(bottom,t.y+t.h);}
  return Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:undefined;
 }
 restore(ctx:Ctx):RasterRegion|undefined{
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const t of this.surface.tiles.values()){if(!t.touched)continue;const img=ctx.createImageData(t.w,t.h);img.data.set(t.orig);ctx.putImageData(img,t.x,t.y);left=Math.min(left,t.x);top=Math.min(top,t.y);right=Math.max(right,t.x+t.w);bottom=Math.max(bottom,t.y+t.h);}
  return Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:undefined;
 }
}
