import {renderCharacterBlend} from './characterBlend';
import type {DabBounds} from './blendDabBatch';
/** v0.5.240 Blend mode for every paint brush.
 *
 * In plain words:
 * - The brush first draws its normal stroke into a scratch mask (its own tip,
 *   texture, grain, pressure and spacing). That mask is never painted.
 * - Along the stroke, the Silk Blend tile engine picks up the colours under the
 *   nib, carries them and lays them back down, but only where the brush's own
 *   mask has coverage. A pencil therefore blends rough, a watercolour blends
 *   watery, an airbrush blends soft.
 * - No brush colour is added (unless Paint load is raised above 0).
 * - Premultiplied float maths (no halos). Only touched 64 px tiles are read or
 *   written. Reload renders one pass over the final brush mask; the blend worker
 *   uses the same function for its final result, so live final == reload.
 */
import {isMaterialBrushBlendVersion} from '../core/brushBlend';
import type {Point,Stroke} from '../core/model';
import type {RasterRegion} from './liveRaster';
import {SilkSurface,TILE,PATCH,CELLS,type Tile} from './silkBlend';
import {finalGeometry} from './geometryCache';
import {paintSamples} from './paintPass';
import {BrushBlendGestureV2,BrushBlendGestureV3,emptyBlendMask} from './brushBlendStyles';
import {projectiveInkGeometry} from './projectiveInkGeometry';

const clamp01=(v:number)=>v<0?0:v>1?1:v;
type Ctx=CanvasRenderingContext2D;
type Readable={getContext(kind:'2d',options?:unknown):unknown;width:number;height:number};

/** Lazily read alpha of the brush mask, in 64 px tiles. Each live update owns a reader for its current mask. */
class MaskReader{
 private tiles=new Map<number,Uint8Array>();
 private batchData?:ImageData;
 private rowSpans=new WeakMap<Uint8Array,Uint8Array>();
 private batchX=0;
 private batchY=0;
 invalidate(bounds?:RasterRegion){
  if(!bounds){this.tiles.clear();return;}
  const endX=bounds.x+bounds.width,endY=bounds.y+bounds.height;
  for(let ty=Math.floor(bounds.y/TILE);ty*TILE<endY;ty++)for(let tx=Math.floor(bounds.x/TILE);tx*TILE<endX;tx++)this.tiles.delete(ty*65536+tx);
 }
 prepare(bounds:DabBounds){
  const left=Math.max(0,Math.floor(bounds.x/TILE)),top=Math.max(0,Math.floor(bounds.y/TILE));
  const right=Math.min(Math.ceil(this.width/TILE),Math.ceil((bounds.x+bounds.width)/TILE));
  const bottom=Math.min(Math.ceil(this.height/TILE),Math.ceil((bounds.y+bounds.height)/TILE));
  let startX=right,startY=bottom,endX=left,endY=top;
  for(let ty=top;ty<bottom;ty++)for(let tx=left;tx<right;tx++){
   if(this.tiles.has(ty*65536+tx))continue;
   startX=Math.min(startX,tx);startY=Math.min(startY,ty);
   endX=Math.max(endX,tx+1);endY=Math.max(endY,ty+1);
  }
  if(endX<=startX||endY<=startY)return;
  const x=Math.max(0,startX*TILE-this.ox),y=Math.max(0,startY*TILE-this.oy);
  const ex=Math.min(this.ctx.canvas.width,endX*TILE-this.ox);
  const ey=Math.min(this.ctx.canvas.height,endY*TILE-this.oy);
  if(ex>x&&ey>y){
   this.batchX=x;this.batchY=y;this.batchData=this.ctx.getImageData(x,y,ex-x,ey-y);
  }
  for(let ty=startY;ty<endY;ty++)for(let tx=startX;tx<endX;tx++)this.tile(tx,ty);
  this.batchData=undefined;
 }
 constructor(private readonly ctx:Ctx,private readonly ox:number,private readonly oy:number,private readonly width:number,private readonly height:number,private readonly trackSpans=false){}

 spans(tile:Uint8Array){return this.rowSpans.get(tile);}
 tile(tx:number,ty:number){
  const key=ty*65536+tx;let t=this.tiles.get(key);
  if(!t){t=emptyBlendMask;const x=tx*TILE,y=ty*TILE,w=Math.min(TILE,this.width-x),h=Math.min(TILE,this.height-y);
   const sx=x-this.ox,sy=y-this.oy,cw=this.ctx.canvas.width,ch=this.ctx.canvas.height;
   const ix=Math.max(0,sx),iy=Math.max(0,sy),iw=Math.min(cw,sx+w)-ix,ih=Math.min(ch,sy+h)-iy;
   if(iw>0&&ih>0){
    let spans:Uint8Array|undefined;
    const batch=this.batchData;
    const d=batch?.data??this.ctx.getImageData(ix,iy,iw,ih).data;
    const stride=batch?.width??iw,offset=batch?(iy-this.batchY)*stride+ix-this.batchX:0;
    for(let j=0;j<ih;j++){
     const row=iy-sy+j,origin=ix-sx,source=(offset+j*stride)*4+3;
     let first=TILE,last=0;
     for(let i=0;i<iw;i++){
      const alpha=d[source+i*4];if(!alpha)continue;
      if(t===emptyBlendMask){
       t=new Uint8Array(TILE*TILE);
       if(this.trackSpans){
        spans=new Uint8Array(TILE*2);
        for(let y=0;y<TILE;y++)spans[y*2]=TILE;
        this.rowSpans.set(t,spans);
       }
      }
      const column=origin+i;
      t[row*TILE+column]=alpha;
      if(first===TILE)first=column;
      last=column+1;
     }
     if(spans){spans[row*2]=first;spans[row*2+1]=last;}
    }
   }
   this.tiles.set(key,t);}
  return t;
 }
}

/** Read-only all-layers sample (opaque snapshot) clipped to its rectangle. */
export type BlendSampleSource={data:Uint8ClampedArray;x:number;y:number;width:number;height:number};
const samples=new Map<string,BlendSampleSource>();let sampleBytes=0;
let liveSample:BlendSampleSource|undefined;
/** Register a decoded all-layers snapshot (renderer prepare, or the live stroke). */
export function registerBlendSample(png:string,source:BlendSampleSource){
 if(samples.has(png))return;samples.set(png,source);sampleBytes+=source.data.length;
 while(sampleBytes>512*1024*1024&&samples.size>1){const first=samples.keys().next().value!;sampleBytes-=samples.get(first)!.data.length;samples.delete(first);}
}
export const hasBlendSample=(png:string)=>samples.has(png);
/** The whole-page snapshot taken at pen-down, for the stroke being drawn. */
export function setLiveBlendSample(source:BlendSampleSource|undefined){liveSample=source;}
export function blendSampleFor(s:Stroke){
 if(s.bbSample!=='all')return undefined;
 return (s.bbSamplePng?samples.get(s.bbSamplePng):undefined)??liveSample;
}
/** Decode a saved all-layers sample (main thread or worker). */
export async function decodeBlendSample(png:string,rect:{x:number;y:number;width:number;height:number}){
 if(samples.has(png))return;
 let source:CanvasImageSource;let close:(()=>void)|undefined;
 if(typeof Image==='undefined'){const match=/^data:([^;,]+);base64,(.*)$/s.exec(png);if(!match)return;const raw=atob(match[2]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const bitmap=await createImageBitmap(new Blob([bytes],{type:match[1]}));source=bitmap;close=()=>bitmap.close();}
 else{const image=new Image();image.src=png;await image.decode();source=image;}
 const c:{getContext(k:'2d',o?:unknown):unknown}=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(rect.width,rect.height):Object.assign(document.createElement('canvas'),{width:rect.width,height:rect.height});
 const ctx=c.getContext('2d',{willReadFrequently:true}) as Ctx;ctx.drawImage(source,0,0);close?.();
 registerBlendSample(png,{data:ctx.getImageData(0,0,rect.width,rect.height).data,...rect});
}
export function sampleFromCanvas(c:Readable,rect:{x:number;y:number;width:number;height:number}):BlendSampleSource{
 const ctx=c.getContext('2d') as Ctx;return {data:ctx.getImageData(rect.x,rect.y,rect.width,rect.height).data,...rect};
}
export function sampleSnapshot(src:BlendSampleSource,x:number,y:number,out:Float32Array,o:number){
 const fx=x-.5-src.x,fy=y-.5-src.y,ix=Math.floor(fx),iy=Math.floor(fy),ax=fx-ix,ay=fy-iy;
 out[o]=out[o+1]=out[o+2]=out[o+3]=0;
 for(let q=0;q<4;q++){const px=ix+(q&1),py=iy+(q>>1),wt=((q&1)?ax:1-ax)*((q>>1)?ay:1-ay);if(wt<=0||px<0||py<0||px>=src.width||py>=src.height)continue;
  const k=(py*src.width+px)*4,a=src.data[k+3],m=a/255;out[o]+=src.data[k]*m*wt;out[o+1]+=src.data[k+1]*m*wt;out[o+2]+=src.data[k+2]*m*wt;out[o+3]+=a*wt;}
}
/** Clean brush off: the colour carried in from the previous blend stroke. */
export function decodeCarry(b64:string|undefined):Float32Array|undefined{
 if(!b64)return undefined;let raw:string;try{raw=atob(b64);}catch{return undefined;}if(raw.length!==256)return undefined;
 const out=new Float32Array(CELLS*4);
 for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const u=Math.min(7,Math.floor(i*8/PATCH)),v=Math.min(7,Math.floor(j*8/PATCH)),k=(v*8+u)*4,a=raw.charCodeAt(k+3),m=a/255,o=(j*PATCH+i)*4;out[o]=raw.charCodeAt(k)*m;out[o+1]=raw.charCodeAt(k+1)*m;out[o+2]=raw.charCodeAt(k+2)*m;out[o+3]=a;}
 return out;
}
/** Read an 8x8 carried colour around a point of a layer canvas. */
export function encodeCarry(layer:Readable,x:number,y:number,radius:number){
 const ctx=layer.getContext('2d') as Ctx,r=Math.max(1,Math.round(radius)),left=Math.round(x-r),top=Math.round(y-r),size=r*2;
 const bytes=new Uint8Array(256);
 const ix=Math.max(0,left),iy=Math.max(0,top),iw=Math.min(layer.width,left+size)-ix,ih=Math.min(layer.height,top+size)-iy;
 if(iw>0&&ih>0){const d=ctx.getImageData(ix,iy,iw,ih).data;
  for(let v=0;v<8;v++)for(let u=0;u<8;u++){let r0=0,g0=0,b0=0,a0=0,n=0;const x0=Math.floor(u*size/8),x1=Math.max(x0+1,Math.floor((u+1)*size/8)),y0=Math.floor(v*size/8),y1=Math.max(y0+1,Math.floor((v+1)*size/8));
   for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const px=left+xx-ix,py=top+yy-iy;n++;if(px<0||py<0||px>=iw||py>=ih)continue;const k=(py*iw+px)*4,a=d[k+3];r0+=d[k]*a;g0+=d[k+1]*a;b0+=d[k+2]*a;a0+=a;}
   const o=(v*8+u)*4;if(a0>0){bytes[o]=Math.round(r0/a0);bytes[o+1]=Math.round(g0/a0);bytes[o+2]=Math.round(b0/a0);}bytes[o+3]=Math.round(a0/Math.max(1,n));}}
 let s='';for(let i=0;i<256;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);
}

export class BrushBlendGesture{
 readonly surface:SilkSurface;
 private reservoir?:Float32Array;
 private readonly sampled=new Float32Array(CELLS*4);private readonly target=new Float32Array(CELLS*4);private readonly scratch=new Float32Array(CELLS*4);private readonly hpass=new Float32Array(CELLS*4);
 private next=0;private carry=0;private traveled=0;private count=0;
 private readonly p:{amount:number;pickup:number;wet:number;mix:number;flow:number;stretch:number;load:number;pressure:boolean;protect:boolean;color:[number,number,number];spacing:number};
 private readonly path:Point[]=[];private fx=0;private fy=0;
 dabs=0;
 constructor(private readonly s:Stroke,width:number,height:number,read:Ctx,private mask:MaskReader,private readonly sample?:BlendSampleSource){
  this.surface=new SilkSurface(width,height,read);
  const hex=/^#[\da-f]{6}$/i.test(s.color)?s.color:'#000000';
  this.p={amount:clamp01(s.bbAmount??.85),pickup:clamp01(s.bbPickup??.5),wet:clamp01(s.bbWetness??.4),mix:clamp01(s.bbMix??.6),flow:clamp01(s.bbFlow??.6),stretch:clamp01(s.bbStretch??.45),load:clamp01(s.bbPaintLoad??0),pressure:s.bbPressure!==false,protect:!!s.bbProtectAlpha,
   color:[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)],spacing:Math.max(.03,Math.min(.5,s.tipSpacing??.08))};
  this.reservoir=decodeCarry(s.bbCarry);
 }
 setMask(mask:MaskReader){this.mask=mask;}
 get pointCount(){return this.count;}
 private radius(p:number){const s=this.s,pr=s.pressure?clamp01(p):1,min=s.minSize??.2;return Math.max(1,s.size*.5*(s.pressure&&s.pressureWidth!==false?min+(1-min)*pr:1)*1.35+1.5);}
 private step(r:number){return Math.max(.6,2*r*this.p.spacing);}
 /** Process new path points (the path must only grow). */
 advance(points:Point[]){
  if(!points.length)return;
  for(let i=this.count;i<points.length;i++)this.path.push(points[i]);this.count=points.length;
  const path=this.path;
  if(this.next===0){const q=path[0],r=this.radius(q.p);this.dab(q.x,q.y,q.p,r,this.step(r));this.carry=this.step(r);this.next=1;}
  for(;this.next<path.length;this.next++){
   const a=path[this.next-1],b=path[this.next],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-9)continue;
   while(this.carry<=len){const t=this.carry/len,x=a.x+dx*t,y=a.y+dy*t,p=a.p+(b.p-a.p)*t,r=this.radius(p),st=this.step(r);this.traveled+=st;this.dab(x,y,p,r,st);this.carry+=st;}
   this.carry-=len;
  }
 }
 private dab(x:number,y:number,p:number,r:number,step:number){
  const P=this.p,S=this.sampled,T=this.target,pr=this.s.pressure?clamp01(p):1,u=step/(.2*r);
  // 1) sample under the nib (current layer as it is now, or the all-layers snapshot)
  for(let j=0;j<PATCH;j++){const cy=y+((j+.5)/PATCH*2-1)*r;for(let i=0;i<PATCH;i++){const cx=x+((i+.5)/PATCH*2-1)*r,o=(j*PATCH+i)*4;if(this.sample)sampleSnapshot(this.sample,cx,cy,S,o);else this.surface.sample(cx,cy,S,o);}}
  // 2) Colour Pickup / Load
  if(!this.reservoir)this.reservoir=S.slice();
  else{const pick=1-Math.pow(1-Math.min(.97,.03+.6*P.pickup),u),R=this.reservoir;for(let k=0;k<R.length;k++)R[k]+=(S[k]-R[k])*pick;}
  const R=this.reservoir;
  // 3) Mix (canvas vs carried), Wetness (soft bleed + averaging), Paint load
  for(let k=0;k<CELLS*4;k++)T[k]=S[k]*P.mix+R[k]*(1-P.mix);
  const passes=Math.round(P.wet*2);let src:Float32Array=T;
  for(let pass=0;pass<passes;pass++){const out=src===T?this.scratch:T,H=this.hpass,row=PATCH*4;
   for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const k=(j*PATCH+i)*4,l=i>0?k-4:k,rr=i<PATCH-1?k+4:k,n=i>0&&i<PATCH-1?1/3:.5;for(let c=0;c<4;c++)H[k+c]=(i>0&&i<PATCH-1)?(src[l+c]+src[k+c]+src[rr+c])*n:(src[k+c]+src[i>0?l+c:rr+c])*n;}
   for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const k=(j*PATCH+i)*4;for(let c=0;c<4;c++)out[k+c]=(j>0&&j<PATCH-1)?(H[k-row+c]+H[k+c]+H[k+row+c])/3:(H[k+c]+H[j>0?k-row+c:k+row+c])*.5;}
   src=out;}
  if(src!==T)T.set(src);
  if(P.wet>0){let mr=0,mg=0,mb=0,ma=0,mw=0;for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const dx=(i+.5)/PATCH*2-1,dy=(j+.5)/PATCH*2-1,d2=dx*dx+dy*dy;if(d2>=1)continue;const w=1-d2,k=(j*PATCH+i)*4;mr+=T[k]*w;mg+=T[k+1]*w;mb+=T[k+2]*w;ma+=T[k+3]*w;mw+=w;}
   if(mw>0){const m=P.wet*.55,keep=1-m;mr/=mw;mg/=mw;mb/=mw;ma/=mw;for(let k=0;k<CELLS*4;k+=4){T[k]=T[k]*keep+mr*m;T[k+1]=T[k+1]*keep+mg*m;T[k+2]=T[k+2]*keep+mb*m;T[k+3]=T[k+3]*keep+ma*m;}}}
  if(P.load>0){const L=P.load,keep=1-L,[cr,cg,cb]=P.color;for(let k=0;k<CELLS*4;k+=4){T[k]=T[k]*keep+cr*L;T[k+1]=T[k+1]*keep+cg*L;T[k+2]=T[k+2]*keep+cb*L;T[k+3]=T[k+3]*keep+255*L;}}
  // 4) Flow, pressure and Stretch (drag length) give this dab's strength
  let strength=clamp01(this.s.opacity)*P.flow*(P.pressure&&this.s.pressure?.3+.7*pr:1);
  if(P.stretch<1)strength*=Math.exp(-this.traveled/(2*r*(1+P.stretch*P.stretch*40)));
  const alpha=1-Math.pow(1-Math.min(.95,strength*.55),u);
  this.dabs++;if(alpha<=1e-5)return;
  const left=Math.max(0,Math.floor(x-r)),top=Math.max(0,Math.floor(y-r)),right=Math.min(this.surface.width,Math.ceil(x+r)),bottom=Math.min(this.surface.height,Math.ceil(y+r));if(right<=left||bottom<=top)return;
  const inv=1/r,protect=P.protect;
  for(let ty=Math.floor(top/TILE);ty*TILE<bottom;ty++)for(let tx=Math.floor(left/TILE);tx*TILE<right;tx++){
   const t=this.surface.tile(tx,ty);if(!t)continue;const m=this.mask.tile(tx,ty);
   const x0=Math.max(left,t.x),x1=Math.min(right,t.x+t.w),y0=Math.max(top,t.y),y1=Math.min(bottom,t.y+t.h),f=t.f,changed=t.changed;let any=false;
   for(let py=y0;py<y1;py++){const dy=(py+.5-y)*inv,dy2=dy*dy;if(dy2>=1)continue;
    for(let px=x0;px<x1;px++){
     const dx=(px+.5-x)*inv,d2=dx*dx+dy2;if(d2>=1)continue;const c=(py-t.y)*TILE+px-t.x,cov=m[c];if(!cov)continue;
     const d=Math.sqrt(d2),fall=d<.65?1:(()=>{const e=(1-d)/.35;return e*e*(3-2*e);})(),a=alpha*fall*cov/255;if(a<=1e-5)continue;
     let cu=(dx+1)*.5*PATCH-.5,cv=(dy+1)*.5*PATCH-.5;cu=cu<0?0:cu>PATCH-1?PATCH-1:cu;cv=cv<0?0:cv>PATCH-1?PATCH-1:cv;
     const iu=Math.min(PATCH-2,Math.floor(cu)),iv=Math.min(PATCH-2,Math.floor(cv)),fu=cu-iu,fv=cv-iv,k00=(iv*PATCH+iu)*4,k10=k00+4,k01=k00+PATCH*4,k11=k01+4,w00=(1-fu)*(1-fv),w10=fu*(1-fv),w01=(1-fu)*fv,w11=fu*fv,o=c*4;
     if(protect){
      // Lock transparency: blend colour only, keep this pixel's alpha.
      const pa=f[o+3];if(pa<.5)continue;const ta=T[k00+3]*w00+T[k10+3]*w10+T[k01+3]*w01+T[k11+3]*w11;if(ta<.5)continue;const sc=pa/ta;
      for(let ch=0;ch<3;ch++){const target=(T[k00+ch]*w00+T[k10+ch]*w10+T[k01+ch]*w01+T[k11+ch]*w11)*sc;f[o+ch]+=(target-f[o+ch])*a;}
     }else for(let ch=0;ch<4;ch++){const target=T[k00+ch]*w00+T[k10+ch]*w10+T[k01+ch]*w01+T[k11+ch]*w11;f[o+ch]+=(target-f[o+ch])*a;}
     changed[c]=1;any=true;
    }
   }
   if(any){t.dirty=true;t.touched=true;}
  }
 }
 /** Unpremultiplied bytes; Blend Amount mixes the result with the original. */
 private bytes(t:Tile,target:Uint8ClampedArray){
  const {w,h,f,orig,changed}=t,amount=this.p.amount;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   const k=(j*w+i)*4,c=j*TILE+i;
   if(!changed[c]){target[k]=orig[k];target[k+1]=orig[k+1];target[k+2]=orig[k+2];target[k+3]=orig[k+3];continue;}
   const o=c*4,om=orig[k+3]/255;let r=f[o],g=f[o+1],b=f[o+2],a=f[o+3];
   if(amount<1){r=orig[k]*om+(r-orig[k]*om)*amount;g=orig[k+1]*om+(g-orig[k+1]*om)*amount;b=orig[k+2]*om+(b-orig[k+2]*om)*amount;a=orig[k+3]+(a-orig[k+3])*amount;}
   if(a<.5){target[k]=target[k+1]=target[k+2]=target[k+3]=0;continue;}
   const m=255/a;target[k]=Math.round(r*m);target[k+1]=Math.round(g*m);target[k+2]=Math.round(b*m);target[k+3]=Math.round(a);
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

/** Match how the paint renderer positions affine masks, including saved copies. */
function blendTransform(s:Stroke){
 return isMaterialBrushBlendVersion(s.brushBlendVersion)&&!s.perspective&&(s.stampVersion!==1||s.rasterTransformVersion===1)?s.transform:undefined;
}
export function blendTransformScale(s:Stroke){
 const matrix=blendTransform(s);if(!matrix)return 1;
 const [a,b,c,d]=matrix,trace=a*a+b*b+c*c+d*d,det=a*d-b*c;
 return Math.max(.001,Math.sqrt((trace+Math.sqrt(Math.max(0,trace*trace-4*det*det)))*.5));
}

/** The dab path used for the canonical (final / reload) result. */
export function blendPath(s:Stroke):Point[]{
 if(isMaterialBrushBlendVersion(s.brushBlendVersion)&&(s.transform||s.perspective)){
  const geometry=s.perspective?projectiveInkGeometry(s):finalGeometry(s);
  const path=paintSamples(geometry,.25).points;
  const matrix=blendTransform(s);if(!matrix)return path;
  const [a,b,c,d,e,f]=matrix;
  return path.map(p=>({...p,x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f}));
 }
 if(s.points.length<2)return s.points;
 const pts=paintSamples(finalGeometry(s),.25).points;
 return pts.length?pts:s.points;
}
const union=(a:RasterRegion|undefined,b:RasterRegion|undefined)=>{if(!a)return b;if(!b)return a;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};

/** Canonical one-pass render: `ctx` holds the layer before the stroke, `mask`
 * holds the brush's own final stroke raster at (maskX, maskY). */
export function renderBrushBlend(ctx:Ctx,mask:Readable,s:Stroke,maskX=0,maskY=0,read?:Ctx,previous?:RasterRegion):RasterRegion|undefined{
 if(s.opacity<=0||!s.points.length)return undefined;
 if(s.brushBlendVersion===7)return renderCharacterBlend(ctx,mask as HTMLCanvasElement,s,blendPath(s),maskX,maskY,read,previous,blendSampleFor(s),decodeCarry(s.bbCarry),blendTransformScale(s));
 const W=ctx.canvas.width,H=ctx.canvas.height,reader=new MaskReader(mask.getContext('2d') as Ctx,maskX,maskY,W,H,s.blendRasterVersion===2);
 const g=gestureFor(s,W,H,read??ctx,reader);g.advance(blendPath(s));return g.flush(ctx,true,previous);
}

/** Live (blend worker): incremental dabs over the growing brush mask. The final
 * call restores the live pixels and renders the canonical pass. */
/** v1 strokes keep the frozen v0.5.240 recipe; v2 strokes blend in their family style. */
type AnyGesture=BrushBlendGesture|BrushBlendGestureV2|BrushBlendGestureV3;
function gestureFor(s:Stroke,W:number,H:number,read:Ctx,reader:MaskReader):AnyGesture{
 if(s.brushBlendVersion===3||isMaterialBrushBlendVersion(s.brushBlendVersion))return new BrushBlendGestureV3(s,W,H,read,reader,blendSampleFor(s),decodeCarry(s.bbCarry),sampleSnapshot,blendTransformScale(s));
 return s.brushBlendVersion===2?new BrushBlendGestureV2(s,W,H,read,reader,blendSampleFor(s),decodeCarry(s.bbCarry),sampleSnapshot):new BrushBlendGesture(s,W,H,read,reader,blendSampleFor(s));
}
let live:{id:string;target:unknown;gesture:AnyGesture;mask?:MaskReader;source?:Readable}|undefined;
let characterLive:{id:string;target:unknown;region?:RasterRegion}|undefined;
export function resetBrushBlend(){live=undefined;characterLive=undefined;}
export function brushBlendNeedsDab(ctx:Ctx,s:Stroke){
 const current=live;
 return !current||current.id!==s.id||current.target!==ctx.canvas||
  !(current.gesture instanceof BrushBlendGestureV3)||current.gesture.needsDab(s.points);
}
export function applyBrushBlendLive(ctx:Ctx,mask:Readable,s:Stroke,base:Readable,final:boolean,livePath:Point[],maskDirty?:RasterRegion):RasterRegion|undefined{
 if(s.opacity<=0||!s.points.length)return undefined;
 const read=base.getContext('2d') as Ctx,W=ctx.canvas.width,H=ctx.canvas.height;
 if(s.brushBlendVersion===7){
  const previous=characterLive?.id===s.id&&characterLive.target===ctx.canvas?characterLive.region:undefined;
  const changed=renderBrushBlend(ctx,mask,s,0,0,read,previous);
  characterLive=final?undefined:{id:s.id,target:ctx.canvas,region:changed};
  return changed;
 }
 if(final){
  if(s.blendRasterVersion!==undefined){
   const previous=live&&live.id===s.id&&live.target===ctx.canvas?live.gesture.surface.batchBounds(true):undefined;
   live=undefined;
   return renderBrushBlend(ctx,mask,s,0,0,read,previous);
  }
  const restored=live&&live.id===s.id&&live.target===ctx.canvas?live.gesture.restore(ctx):undefined;live=undefined;
  return union(restored,renderBrushBlend(ctx,mask,s,0,0,read));
 }
 let restored:RasterRegion|undefined;
 if(live&&(live.id!==s.id||live.target!==ctx.canvas||live.gesture.pointCount>livePath.length)){if(live.id===s.id&&live.target===ctx.canvas)restored=live.gesture.restore(ctx);live=undefined;}
 const previous=s.blendRasterVersion!==undefined&&live?.source===mask?live.mask:undefined;
 const reader=previous??new MaskReader(mask.getContext('2d') as Ctx,0,0,W,H,s.blendRasterVersion===2);
 previous?.invalidate(maskDirty);
 if(!live)live={id:s.id,target:ctx.canvas,gesture:gestureFor(s,W,H,read,reader),mask:reader,source:mask};
 else{live.gesture.setMask(reader);live.mask=reader;live.source=mask;}
 live.gesture.advance(livePath);
 return union(restored,live.gesture.flush(ctx,!!restored));
}
