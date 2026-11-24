/** v0.5.238 Silk Blend renderer (new brush, written from scratch).
 *
 * How it works, in plain words:
 * - The brush holds a small "silk patch" of paint (N x N cells, brush-local).
 * - Every dab samples the CURRENT LAYER under the nib into that patch, mixes it
 *   with what the brush already carries, and lays the result back down with a
 *   smooth falloff. Moving the brush therefore drags colour into the next colour.
 * - All maths happens in premultiplied float RGBA, so transparent paper never
 *   turns grey or dark at the edges (no halos).
 * - Dabs are placed at exact distances along the captured path. A longer path
 *   only ADDS dabs, so the live preview (incremental, in the blend worker) and a
 *   reload (one pass) run the very same operations and give the same pixels.
 * - Only 64 px tiles that a dab touched are read or written (dirty rectangles).
 */
import type {Point,Stroke} from '../../src/core/model';
import type {RasterRegion} from '../../src/engine/liveRaster';
import type {SilkMode} from '../../src/core/silkBlend';

const TILE=64,PATCH=20,CELLS=PATCH*PATCH;
type Tile={x:number;y:number;w:number;h:number;f:Float32Array;orig:Uint8ClampedArray;changed:Uint8Array;dirty:boolean;touched:boolean};

/** Lazily loaded premultiplied float copy of the source layer, 64 px tiles. */
class SilkSurface{
 readonly tiles=new Map<number,Tile>();
 private readonly cols:number;private readonly rows:number;
 private last?:Tile;private lastKey=-1;
 constructor(readonly width:number,readonly height:number,private readonly read:CanvasRenderingContext2D){this.cols=Math.ceil(width/TILE);this.rows=Math.ceil(height/TILE);}
 tile(tx:number,ty:number):Tile|undefined{
  if(tx<0||ty<0||tx>=this.cols||ty>=this.rows)return undefined;
  const key=ty*this.cols+tx;if(key===this.lastKey)return this.last;
  let t=this.tiles.get(key);
  if(!t){
   const x=tx*TILE,y=ty*TILE,w=Math.min(TILE,this.width-x),h=Math.min(TILE,this.height-y),data=this.read.getImageData(x,y,w,h).data,f=new Float32Array(TILE*TILE*4);
   for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=(j*w+i)*4,o=(j*TILE+i)*4,a=data[k+3],m=a/255;f[o]=data[k]*m;f[o+1]=data[k+1]*m;f[o+2]=data[k+2]*m;f[o+3]=a;}
   t={x,y,w,h,f,orig:new Uint8ClampedArray(data),changed:new Uint8Array(TILE*TILE),dirty:false,touched:false};this.tiles.set(key,t);
  }
  this.last=t;this.lastKey=key;return t;
 }
 /** Bilinear premultiplied sample at a canvas position (pixel centres at +.5). */
 sample(x:number,y:number,out:Float32Array,o:number){
  const fx=x-.5,fy=y-.5,ix=Math.floor(fx),iy=Math.floor(fy),ax=fx-ix,ay=fy-iy;
  out[o]=out[o+1]=out[o+2]=out[o+3]=0;
  for(let q=0;q<4;q++){
   const px=ix+(q&1),py=iy+(q>>1),wt=((q&1)?ax:1-ax)*((q>>1)?ay:1-ay);
   if(wt<=0||px<0||py<0||px>=this.width||py>=this.height)continue;
   const t=this.tile(Math.floor(px/TILE),Math.floor(py/TILE))!,p=((py-t.y)*TILE+px-t.x)*4,f=t.f;
   out[o]+=f[p]*wt;out[o+1]+=f[p+1]*wt;out[o+2]+=f[p+2]*wt;out[o+3]+=f[p+3]*wt;
  }
 }
 /** Unpremultiplied bytes for putImageData. Untouched pixels keep their exact
  * original bytes, so a Silk stroke never nudges pixels it did not paint. */
 bytes(t:Tile,target:Uint8ClampedArray){
  const {w,h,f,orig,changed}=t;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   const k=(j*w+i)*4,c=j*TILE+i;
   if(!changed[c]){target[k]=orig[k];target[k+1]=orig[k+1];target[k+2]=orig[k+2];target[k+3]=orig[k+3];continue;}
   const o=c*4,a=f[o+3];
   if(a<.5){target[k]=target[k+1]=target[k+2]=target[k+3]=0;continue;}
   const m=255/a;target[k]=Math.round(f[o]*m);target[k+1]=Math.round(f[o+1]*m);target[k+2]=Math.round(f[o+2]*m);target[k+3]=Math.round(a);
  }
 }
}

const hash=(x:number,y:number,seed:number)=>{let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed|0,2246822519);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967295;};
const fade=(t:number)=>t*t*(3-2*t);
/** Smooth value noise in [0,1], fixed to canvas coordinates (paper grain). */
function valueNoise(x:number,y:number,seed:number){
 const ix=Math.floor(x),iy=Math.floor(y),fx=fade(x-ix),fy=fade(y-iy);
 const a=hash(ix,iy,seed),b=hash(ix+1,iy,seed),c=hash(ix,iy+1,seed),d=hash(ix+1,iy+1,seed);
 return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
}
function noise1(x:number,seed:number){const ix=Math.floor(x),t=fade(x-ix),a=hash(ix,0,seed),b=hash(ix+1,0,seed);return a+(b-a)*t;}
const clamp01=(v:number)=>v<0?0:v>1?1:v;
function strokeSeed(id:string){let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

type ModeTuning={pick:number;mean:number;blur:boolean;gain:number;falloff:(d:number)=>number};
const tuning=(mode:SilkMode,wet:number):ModeTuning=>{
 switch(mode){
  case 'wet':return {pick:.24-.17*wet,mean:.22,blur:true,gain:1.75,falloff:d=>{const q=1-d*d;return q*Math.sqrt(q);}};
  case 'smudge':return {pick:.075-.06*wet,mean:0,blur:false,gain:2.2,falloff:d=>{const q=1-d*d;return q*Math.sqrt(q);}};
  case 'dry':return {pick:.3,mean:.1,blur:false,gain:2.1,falloff:d=>{const e=(1-d)/.3;return e>=1?1:e*e*(3-2*e);}};
  default:return {pick:.7,mean:.95,blur:false,gain:2.6,falloff:d=>{const q=1-d*d;return q*q;}};
 }
};

/** One Silk stroke. Feed it the growing point list; it only processes new dabs. */
export class SilkGesture{
 private surface:SilkSurface;
 private reservoir?:Float32Array;
 private readonly sampled=new Float32Array(CELLS*4);
 private readonly target=new Float32Array(CELLS*4);
 private readonly scratch=new Float32Array(CELLS*4);
 private processed:number[]=[];
 private readonly path:Point[]=[];private fx=0;private fy=0;private gx=0;private gy=0;
 private next=0;private carry=0;private traveled=0;private dirX=1;private dirY=0;
 private readonly mode:SilkMode;private readonly tune:ModeTuning;private readonly seed:number;
 dabs=0;
 constructor(private readonly s:Stroke,width:number,height:number,read:CanvasRenderingContext2D){
  this.surface=new SilkSurface(width,height,read);
  this.mode=s.silkMode??'soft';this.tune=tuning(this.mode,clamp01(s.silkWetness??.35));this.seed=strokeSeed(s.id);
 }
 /** True if the already-processed points are an exact prefix of `points`. */
 extends(points:Point[]){
  const n=this.processed.length/3;if(points.length<n)return false;
  for(let i=0;i<n;i++){const p=points[i];if(p.x!==this.processed[i*3]||p.y!==this.processed[i*3+1]||p.p!==this.processed[i*3+2])return false;}
  return true;
 }
 private radius(p:number){
  const s=this.s,pr=s.pressure?clamp01(p):1,min=s.minSize??.2;
  return Math.max(.75,s.size*.5*(s.pressure&&s.pressureWidth!==false?min+(1-min)*pr:1));
 }
 private step(r:number){return Math.max(.6,2*r*Math.max(.02,Math.min(.5,this.s.tipSpacing??.08)));}
 /** Process every not-yet-processed dab along `points`. */
 advance(raw:Point[]){
  if(!raw.length)return;
  this.follow(raw);const points=this.path;
  if(this.next===0){const p=points[0];const r=this.radius(p.p);this.dab(p.x,p.y,p.p,r,this.step(r));this.carry=this.step(r);this.next=1;}
  for(;this.next<points.length;this.next++){
   const a=points[this.next-1],b=points[this.next],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
   if(len<1e-9)continue;
   this.dirX=dx/len;this.dirY=dy/len;
   while(this.carry<=len){
    const t=this.carry/len,x=a.x+dx*t,y=a.y+dy*t,p=a.p+(b.p-a.p)*t,r=this.radius(p),st=this.step(r);
    this.traveled+=st;this.dab(x,y,p,r,st);this.carry+=st;
   }
   this.carry-=len;
  }
  for(let i=this.processed.length/3;i<raw.length;i++){const p=raw[i];this.processed.push(p.x,p.y,p.p);}
 }
 /**
  * Smoothing for Silk. A causal "lazy rope" (Smoothing slider = stabilization)
  * followed by a distance-based low-pass (smoothness). Each output point depends
  * only on the input points before it, so live drawing and reload stay identical.
  */
 private follow(raw:Point[]){
  const s=this.s,rope=Math.min(80,clamp01(s.stabilization??0)*s.size*.6),soft=Math.max(0,Math.min(1,(s.smoothness??0)/100))*s.size*.4;
  for(let i=this.path.length;i<raw.length;i++){
   const p=raw[i];
   if(i===0){this.fx=this.gx=p.x;this.fy=this.gy=p.y;this.path.push({...p});continue;}
   const dx=p.x-this.fx,dy=p.y-this.fy,d=Math.hypot(dx,dy);
   let moved=0;if(d>rope){const k=(d-rope)/d;this.fx+=dx*k;this.fy+=dy*k;moved=d-rope;}
   const a=soft>1e-6?1-Math.exp(-moved/soft):1;this.gx+=(this.fx-this.gx)*a;this.gy+=(this.fy-this.gy)*a;
   this.path.push({...p,x:this.gx,y:this.gy});
  }
 }
 private dab(x:number,y:number,p:number,r:number,step:number){
  const s=this.s,tune=this.tune,S=this.sampled,T=this.target,pr=s.pressure?clamp01(p):1;
  const u=step/(.2*r);// 1.0 at the default spacing (10% of the diameter)
  // 1) sample the layer under the nib into the brush-local patch
  for(let j=0;j<PATCH;j++){const cy=y+((j+.5)/PATCH*2-1)*r;for(let i=0;i<PATCH;i++)this.surface.sample(x+((i+.5)/PATCH*2-1)*r,cy,S,(j*PATCH+i)*4);}
  // 2) mix it into what the brush carries (Colour Pickup + Wetness)
  if(!this.reservoir)this.reservoir=S.slice();
  else{const pick=1-Math.pow(1-Math.min(.97,tune.pick*(.2+1.6*clamp01(s.silkPickup??.7))),u),R=this.reservoir;for(let k=0;k<R.length;k++)R[k]+=(S[k]-R[k])*pick;}
  const R=this.reservoir;
  // 3) build the paint that gets laid down
  let mr=0,mg=0,mb=0,ma=0,mw=0;
  for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const dx=(i+.5)/PATCH*2-1,dy=(j+.5)/PATCH*2-1,d2=dx*dx+dy*dy;if(d2>=1)continue;const w=1-d2,k=(j*PATCH+i)*4;mr+=R[k]*w;mg+=R[k+1]*w;mb+=R[k+2]*w;ma+=R[k+3]*w;mw+=w;}
  if(mw>0){mr/=mw;mg/=mw;mb/=mw;ma/=mw;}
  let src=R;
  if(tune.blur){const B=this.scratch;for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){let r0=0,g0=0,b0=0,a0=0,n=0;for(let v=-1;v<=1;v++)for(let h=-1;h<=1;h++){const ii=i+h,jj=j+v;if(ii<0||jj<0||ii>=PATCH||jj>=PATCH)continue;const k=(jj*PATCH+ii)*4;r0+=R[k];g0+=R[k+1];b0+=R[k+2];a0+=R[k+3];n++;}const k=(j*PATCH+i)*4;B[k]=r0/n;B[k+1]=g0/n;B[k+2]=b0/n;B[k+3]=a0/n;}src=B;}
  const mean=tune.mean,keep=1-mean;
  for(let k=0;k<CELLS*4;k+=4){T[k]=src[k]*keep+mr*mean;T[k+1]=src[k+1]*keep+mg*mean;T[k+2]=src[k+2]*keep+mb*mean;T[k+3]=src[k+3]*keep+ma*mean;}
  // 4) deposit with a smooth falloff (Blend Strength, Opacity, pressure)
  let strength=clamp01(s.silkStrength??.55)*clamp01(s.opacity)*(s.pressure?.3+.7*pr:1)*tune.gain;
  if(this.mode==='smudge')strength*=Math.exp(-this.traveled/(2*r*(4+14*clamp01(s.silkWetness??.35))));
  const alpha=1-Math.pow(1-Math.min(.95,strength*.32),u);
  if(alpha<=1e-5){this.dabs++;return;}
  const tex=clamp01(s.silkTexture??0),dry=this.mode==='dry',seed=this.seed,coverage=.22+.48*pr,dirX=this.dirX,dirY=this.dirY;
  const left=Math.max(0,Math.floor(x-r)),top=Math.max(0,Math.floor(y-r)),right=Math.min(this.surface.width,Math.ceil(x+r)),bottom=Math.min(this.surface.height,Math.ceil(y+r));
  if(right<=left||bottom<=top){this.dabs++;return;}
  const inv=1/r,falloff=tune.falloff;
  for(let ty=Math.floor(top/TILE);ty*TILE<bottom;ty++)for(let tx=Math.floor(left/TILE);tx*TILE<right;tx++){
   const t=this.surface.tile(tx,ty);if(!t)continue;
   const x0=Math.max(left,t.x),x1=Math.min(right,t.x+t.w),y0=Math.max(top,t.y),y1=Math.min(bottom,t.y+t.h),f=t.f,changed=t.changed;let any=false;
   for(let py=y0;py<y1;py++){const dy=(py+.5-y)*inv,dy2=dy*dy;if(dy2>=1)continue;
    for(let px=x0;px<x1;px++){
     const dx=(px+.5-x)*inv,d2=dx*dx+dy2;if(d2>=1)continue;
     let a=alpha*falloff(Math.sqrt(d2));
     if(tex>0){
      const grain=valueNoise(px*.55,py*.55,seed&255)*.6+valueNoise(px*.17,py*.17,(seed>>8)&255)*.4;
      if(dry){const across=dx*-dirY+dy*dirX,bristle=noise1(across*15+((seed>>16)&63),seed&1023),m=grain*.45+bristle*.55,th=1-coverage,c=clamp01((m-th+.09)/.18);a*=1-tex*(1-c*c*(3-2*c));}
      else a*=1-tex*.6*(1-grain);
     }
     if(a<=1e-5)continue;
     let cu=(dx+1)*.5*PATCH-.5,cv=(dy+1)*.5*PATCH-.5;cu=cu<0?0:cu>PATCH-1?PATCH-1:cu;cv=cv<0?0:cv>PATCH-1?PATCH-1:cv;
     const iu=Math.min(PATCH-2,Math.floor(cu)),iv=Math.min(PATCH-2,Math.floor(cv)),fu=cu-iu,fv=cv-iv,k00=(iv*PATCH+iu)*4,k10=k00+4,k01=k00+PATCH*4,k11=k01+4;
     const w00=(1-fu)*(1-fv),w10=fu*(1-fv),w01=(1-fu)*fv,w11=fu*fv,o=((py-t.y)*TILE+px-t.x)*4;
     for(let c=0;c<4;c++){const target=T[k00+c]*w00+T[k10+c]*w10+T[k01+c]*w01+T[k11+c]*w11;f[o+c]+=(target-f[o+c])*a;}
     changed[o>>2]=1;any=true;
    }
   }
   if(any){t.dirty=true;t.touched=true;}
  }
  this.dabs++;
 }
 /** Write tiles to `ctx`. `all` rewrites every tile this stroke ever touched. */
 flush(ctx:CanvasRenderingContext2D,all=false):RasterRegion|undefined{
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const t of this.surface.tiles.values()){
   if(!(t.dirty||all&&t.touched))continue;
   const img=ctx.createImageData(t.w,t.h);this.surface.bytes(t,img.data);ctx.putImageData(img,t.x,t.y);t.dirty=false;
   left=Math.min(left,t.x);top=Math.min(top,t.y);right=Math.max(right,t.x+t.w);bottom=Math.max(bottom,t.y+t.h);
  }
  return Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:undefined;
 }
 /** Put the original pixels back (used when the path changed under us). */
 restore(ctx:CanvasRenderingContext2D):RasterRegion|undefined{
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const t of this.surface.tiles.values()){if(!t.touched)continue;const img=ctx.createImageData(t.w,t.h);img.data.set(t.orig);ctx.putImageData(img,t.x,t.y);left=Math.min(left,t.x);top=Math.min(top,t.y);right=Math.max(right,t.x+t.w);bottom=Math.max(bottom,t.y+t.h);}
  return Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:undefined;
 }
}

const union=(a:RasterRegion|undefined,b:RasterRegion|undefined)=>{if(!a)return b;if(!b)return a;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};
const signature=(s:Stroke)=>JSON.stringify({...s,points:undefined});
let live:{id:string;target:unknown;base:unknown;signature:string;gesture:SilkGesture}|undefined;

/** Canonical one-pass render (reload, export, undo replay, previews): read the
 * layer under the stroke, process every dab, write the touched tiles once. */
export function renderSilkStroke(ctx:CanvasRenderingContext2D,s:Stroke):RasterRegion|undefined{
 if(s.opacity<=0||!s.points.length)return undefined;
 const g=new SilkGesture(s,ctx.canvas.width,ctx.canvas.height,ctx);g.advance(s.points);return g.flush(ctx);
}
/** Live, incremental render. `base` is the untouched layer; `ctx` shows base +
 * stroke. Returns only the tiles changed by this call (the dirty rectangle). */
export function applySilkBlend(ctx:CanvasRenderingContext2D,_mask:unknown,s:Stroke,_x=0,_y=0,_region?:RasterRegion,base?:HTMLCanvasElement|OffscreenCanvas,writeAll=false):RasterRegion|undefined{
 if(!base)return renderSilkStroke(ctx,s);
 if(s.opacity<=0||!s.points.length)return undefined;
 const sig=signature(s);let restored:RasterRegion|undefined;
 if(live&&(live.id!==s.id||live.target!==ctx.canvas||live.base!==base||live.signature!==sig||!live.gesture.extends(s.points))){
  if(live.id===s.id&&live.target===ctx.canvas&&live.base===base)restored=live.gesture.restore(ctx);
  live=undefined;
 }
 if(!live){const read=(base as HTMLCanvasElement).getContext('2d')! as CanvasRenderingContext2D;live={id:s.id,target:ctx.canvas,base,signature:sig,gesture:new SilkGesture(s,base.width,base.height,read)};}
 live.gesture.advance(s.points);
 return union(restored,live.gesture.flush(ctx,writeAll||!!restored));
}
export function resetSilkBlend(){live=undefined;}
