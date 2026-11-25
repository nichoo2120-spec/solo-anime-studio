import {BlendDabBatch,BlendPatchRaster,largeBlendSpacing,type DabBounds} from './blendDabBatch';
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
import type {Point,Stroke} from '../core/model';
import type {RasterRegion} from './liveRaster';
import type {SilkMode} from '../core/silkBlend';
import {paintNoise} from './paintingTips';

export const TILE=64,PATCH=20,CELLS=PATCH*PATCH;
export type Tile={x:number;y:number;w:number;h:number;f:Float32Array;orig:Uint8ClampedArray;changed:Uint8Array;dirty:boolean;touched:boolean;wet?:Float32Array;cloud?:Float32Array;grain?:Float32Array;pickup?:Float32Array;pickupEpoch?:Uint32Array;output?:Uint8ClampedArray};

/** Lazily loaded premultiplied float copy of the source layer, 64 px tiles. */
export class SilkSurface{
 readonly tiles=new Map<number,Tile>();
 private readonly cols:number;private readonly rows:number;
 private last?:Tile;private lastKey=-1;
 private upload?:ImageData;

 private epoch=0;
 private tileSource?:ImageData;
 private sourceX=0;
 private sourceY=0;

 constructor(readonly width:number,readonly height:number,private readonly read:CanvasRenderingContext2D,private readonly pickupScale=1){this.cols=Math.ceil(width/TILE);this.rows=Math.ceil(height/TILE);}
 tile(tx:number,ty:number):Tile|undefined{
  if(tx<0||ty<0||tx>=this.cols||ty>=this.rows)return undefined;
  const key=ty*this.cols+tx;if(key===this.lastKey)return this.last;
  let t=this.tiles.get(key);
  if(!t){
   const x=tx*TILE,y=ty*TILE,w=Math.min(TILE,this.width-x),h=Math.min(TILE,this.height-y),f=new Float32Array(TILE*TILE*4);
   const bulk=this.tileSource;
   let data:Uint8ClampedArray;
   if(bulk&&x>=this.sourceX&&y>=this.sourceY&&x+w<=this.sourceX+bulk.width&&y+h<=this.sourceY+bulk.height){
    data=new Uint8ClampedArray(w*h*4);
    for(let j=0;j<h;j++){
     const from=((y-this.sourceY+j)*bulk.width+x-this.sourceX)*4;
     data.set(bulk.data.subarray(from,from+w*4),j*w*4);
    }
   }else data=this.read.getImageData(x,y,w,h).data;
   for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=(j*w+i)*4,o=(j*TILE+i)*4,a=data[k+3],m=a/255;f[o]=data[k]*m;f[o+1]=data[k+1]*m;f[o+2]=data[k+2]*m;f[o+3]=a;}
   t={x,y,w,h,f,orig:bulk?data:new Uint8ClampedArray(data),changed:new Uint8Array(TILE*TILE),dirty:false,touched:false};
   if(this.pickupScale>1){
    const cells=(TILE/this.pickupScale)**2;
    t.output=new Uint8ClampedArray(w*h*4);
    t.pickup=new Float32Array(cells*4);
    t.pickupEpoch=new Uint32Array(cells);
   }
   this.tiles.set(key,t);
  }
  this.last=t;this.lastKey=key;return t;
 }
 /** Seed any new tiles with one clipped read for the batch. Existing float
  * tiles retain pigment deposited by earlier dabs. */
 prepare(bounds:DabBounds,init?:(tile:Tile)=>void){
  const x=Math.max(0,Math.floor(bounds.x/TILE)*TILE),y=Math.max(0,Math.floor(bounds.y/TILE)*TILE);
  const right=Math.min(this.width,Math.ceil((bounds.x+bounds.width)/TILE)*TILE);
  const bottom=Math.min(this.height,Math.ceil((bounds.y+bounds.height)/TILE)*TILE);
  if(right<=x||bottom<=y)return;
  let left=right,top=bottom,endX=x,endY=y;
  for(let ty=y/TILE;ty*TILE<bottom;ty++)for(let tx=x/TILE;tx*TILE<right;tx++){
   if(this.tiles.has(ty*this.cols+tx))continue;
   left=Math.min(left,tx*TILE);top=Math.min(top,ty*TILE);
   endX=Math.max(endX,Math.min(this.width,(tx+1)*TILE));endY=Math.max(endY,Math.min(this.height,(ty+1)*TILE));
  }
  if(endX>left&&endY>top){
   this.sourceX=left;this.sourceY=top;this.tileSource=this.read.getImageData(left,top,endX-left,endY-top);
   for(let ty=y/TILE;ty*TILE<bottom;ty++)for(let tx=x/TILE;tx*TILE<right;tx++)this.tile(tx,ty);
   this.tileSource=undefined;
  }
  if(init)for(let ty=y/TILE;ty*TILE<bottom;ty++)for(let tx=x/TILE;tx*TILE<right;tx++)init(this.tile(tx,ty)!);
 }
 nextDab(){this.epoch++;}

 /** Area-average the current premultiplied pigment into a lazy low-resolution
  * tile. One dab can reuse the same reduced texel across adjacent samples. */
 sampleReduced(x:number,y:number,out:Float32Array,o:number,original=false){
  const scale=this.pickupScale,px=Math.floor(x/scale)*scale,py=Math.floor(y/scale)*scale;
  out[o]=out[o+1]=out[o+2]=out[o+3]=0;
  if(px<0||py<0||px>=this.width||py>=this.height)return;
  const tile=this.tile(Math.floor(px/TILE),Math.floor(py/TILE))!;
  const ix=px-tile.x,iy=py-tile.y,cell=iy/scale*(TILE/scale)+ix/scale;
  const reduced=tile.pickup!,versions=tile.pickupEpoch!,at=cell*4;
  const epoch=original?1:this.epoch;
  if(versions[cell]!==epoch){
   const endX=Math.min(tile.w,ix+scale),endY=Math.min(tile.h,iy+scale);
   let r=0,g=0,b=0,a=0;
   for(let j=iy;j<endY;j++)for(let i=ix;i<endX;i++){
    if(original){
     const k=(j*tile.w+i)*4,f=tile.orig,m=f[k+3]/255;
     r+=f[k]*m;g+=f[k+1]*m;b+=f[k+2]*m;a+=f[k+3];
    }else{
     const k=(j*TILE+i)*4,f=tile.f;
     r+=f[k];g+=f[k+1];b+=f[k+2];a+=f[k+3];
    }
   }
   const area=(endX-ix)*(endY-iy);
   reduced[at]=r/area;reduced[at+1]=g/area;reduced[at+2]=b/area;reduced[at+3]=a/area;
   versions[cell]=epoch;
  }
  out[o]=reduced[at];out[o+1]=reduced[at+1];out[o+2]=reduced[at+2];out[o+3]=reduced[at+3];
 }

 /** One upload for the changed rectangle. Interior tiles may contain paint
  * from earlier batches, so repack those from the retained float surface. */
 batchBounds(all:boolean):RasterRegion|undefined{
  let x=this.width,y=this.height,right=0,bottom=0;
  for(const tile of this.tiles.values()){
   if(!(tile.dirty||all&&tile.touched))continue;
   x=Math.min(x,tile.x);y=Math.min(y,tile.y);
   right=Math.max(right,tile.x+tile.w);bottom=Math.max(bottom,tile.y+tile.h);
  }
  if(right>x&&bottom>y)return {x,y,width:right-x,height:bottom-y};
 }
 flushBatch(ctx:CanvasRenderingContext2D,all:boolean,restore:boolean,bytes:(t:Tile,target:Uint8ClampedArray)=>void,previous?:RasterRegion):RasterRegion|undefined{
  const box=union(this.batchBounds(all),previous);
  if(!box)return undefined;
  const {x,y,width,height}=box,right=x+width,bottom=y+height;
  if(!this.upload||this.upload.width!==width||this.upload.height!==height)this.upload=ctx.createImageData(width,height);
  const img=this.upload;
  // A winding stroke can leave holes between dirty tiles on the final
  // upload. Seed those from the same immutable source as the ordinary tiles.
  this.prepare({x,y,width,height});
  for(let ty=y/TILE;ty*TILE<bottom;ty++)for(let tx=x/TILE;tx*TILE<right;tx++){
   const tile=this.tile(tx,ty)!;
   const data=restore||!tile.touched?tile.orig:tile.output!;
   if(tile.dirty&&!restore)bytes(tile,data);
   for(let j=0;j<tile.h;j++){
    const start=j*tile.w*4;
    img.data.set(data.subarray(start,start+tile.w*4),((tile.y-y+j)*img.width+tile.x-x)*4);
   }
   tile.dirty=false;
  }
  ctx.putImageData(img,x,y,0,0,width,height);
  return {x,y,width,height};
 }

 /** Bilinear premultiplied sample at a canvas position (pixel centres at +.5). */
 sample(x:number,y:number,out:Float32Array,o:number){
  if(this.pickupScale>1){this.sampleReduced(x,y,out,o);return;}
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
 bytes(t:Tile,target:Uint8ClampedArray,water?:WaterFinish){
  const {w,h,f,orig,changed}=t;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   const k=(j*w+i)*4,c=j*TILE+i;
   if(!changed[c]){target[k]=orig[k];target[k+1]=orig[k+1];target[k+2]=orig[k+2];target[k+3]=orig[k+3];continue;}
   const o=c*4,a=f[o+3];
   if(a<.5){target[k]=target[k+1]=target[k+2]=target[k+3]=0;continue;}
   const m=255/a;
   if(water&&t.wet){
    // Watercolor finish (v2 Wet): pigment collects at the drying wet front and
    // settles unevenly. It only deepens the layer's own colour (optical density),
    // it never adds a new hue.
    const w=t.wet[c],bank=water.pool!==0||water.edgeAlpha!==0?ease(.04,.5,w)*(1-ease(.45,.97,w)):0;// v0.5.243: skip the edge pass when off
    let kk=1+water.pool*bank+water.cloud*(t.cloud![c]-.5)*2*w+water.grain*(t.grain![c]-.5)*2*w;kk=kk<.8?.8:kk>1.7?1.7:kk;
    target[k]=Math.round(255*Math.pow(Math.min(1,f[o]*m/255),kk));target[k+1]=Math.round(255*Math.pow(Math.min(1,f[o+1]*m/255),kk));target[k+2]=Math.round(255*Math.pow(Math.min(1,f[o+2]*m/255),kk));
    target[k+3]=Math.round(Math.min(255,a*(1+water.edgeAlpha*bank)));continue;
   }
   target[k]=Math.round(f[o]*m);target[k+1]=Math.round(f[o+1]*m);target[k+2]=Math.round(f[o+2]*m);target[k+3]=Math.round(a);
  }
 }
}

const hash=(x:number,y:number,seed:number)=>{let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed|0,2246822519);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967295;};
const fade=(t:number)=>t*t*(3-2*t);
const ease=(a:number,b:number,v:number)=>{const t=v<=a?0:v>=b?1:(v-a)/(b-a);return t*t*(3-2*t);};
const NEG_LN=new Float32Array(1025);for(let i=0;i<=1024;i++)NEG_LN[i]=-Math.log(Math.max(1/255,i/1024));
const EXP_STEP=1/512,EXP_N=Math.ceil(6/EXP_STEP)+2,EXP_NEG=new Float32Array(EXP_N);for(let i=0;i<EXP_N;i++)EXP_NEG[i]=Math.exp(-i*EXP_STEP);
const negLn=(v:number)=>{const x=(v<0?0:v>1?1:v)*1024,i=Math.floor(x),f=x-i;return i>=1024?NEG_LN[1024]:NEG_LN[i]+(NEG_LN[i+1]-NEG_LN[i])*f;};
const expNeg=(d:number)=>{const x=d/EXP_STEP,i=Math.floor(x);if(i>=EXP_N-1)return EXP_NEG[EXP_N-1];const f=x-i;return EXP_NEG[i]+(EXP_NEG[i+1]-EXP_NEG[i])*f;};
type WaterFinish={pool:number;cloud:number;grain:number;edgeAlpha:number};
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
 private readonly batch?:BlendDabBatch;
 private readonly patchRaster?:BlendPatchRaster;
 private readonly sampled=new Float32Array(CELLS*4);
 private readonly target=new Float32Array(CELLS*4);
 private readonly scratch=new Float32Array(CELLS*4);
 private processed:number[]=[];
 private readonly path:Point[]=[];private fx=0;private fy=0;private gx=0;private gy=0;
 private next=0;private carry=0;private traveled=0;private dirX=1;private dirY=0;
 private readonly mode:SilkMode;private tune:ModeTuning;private readonly seed:number;
 dabs=0;
 constructor(private readonly s:Stroke,width:number,height:number,read:CanvasRenderingContext2D){
  const fast=s.blendRasterVersion===1;
  this.batch=fast?new BlendDabBatch():undefined;
  this.patchRaster=fast?new BlendPatchRaster(s.size):undefined;
  this.surface=new SilkSurface(width,height,read,fast?(s.size>200?4:2):1);
  this.mode=s.silkMode??'soft';this.tune=tuning(this.mode,clamp01(s.silkWetness??.35));this.seed=strokeSeed(s.id);
  if(s.silkBlendVersion===2&&this.mode==='wet'){
   // v0.5.239 watercolor Wet. Saved v1 Wet strokes keep the v0.5.238 path above.
   const wet=clamp01(s.silkWetness??.35),str=clamp01(s.silkStrength??.55)*clamp01(s.opacity);
   this.tune={pick:.2-.12*wet,mean:.3,blur:true,gain:1.9,falloff:d=>{const q=1-d*d;return q*Math.sqrt(q);}};
   // v0.5.243: edgeDarkness (new strokes 0) scales the dark wet edge; old strokes keep it (1).
   const ek=s.edgeDarkness??1;
   this.water={pool:str*(.35+.65*wet)*.3*ek,cloud:(.05+.1*wet)*(.4+.6*str),grain:clamp01(s.silkTexture??0)*.18,edgeAlpha:str*(.12+.18*wet)*ek};
   this.cloudSize=Math.max(12,s.size*.35);this.blurPasses=1+Math.round(wet*2);
  }
 }
 private water?:WaterFinish;private cloudSize=12;private blurPasses=1;
 /** Coherent watercolor fields for one tile (stroke seed, canvas coordinates): a
  * domain-warped broad "cloud" like the watercolor brush's pigment variation,
  * and fine granulation. Computed once per tile, so every dab reads the same. */
 private waterFields(t:Tile){
  if(t.wet)return;
  t.wet=new Float32Array(TILE*TILE);t.cloud=new Float32Array(TILE*TILE);t.grain=new Float32Array(TILE*TILE);
  const sx=(this.seed&65535)+17,sy=(this.seed>>>16)+29,cl=this.cloudSize,fine=Math.max(2.2,Math.min(4,this.s.size*.035));
  // The cloud is low-frequency (>=12 px), so it is evaluated on a 4 px lattice
  // and interpolated; granulation is per pixel and only when Texture is on.
  const G=TILE/4+1,lattice=this.lattice;
  for(let j=0;j<G;j++)for(let i=0;i<G;i++){const x=t.x+i*4,y=t.y+j*4,broad=paintNoise(sx+(x+y*.37)/cl,sy+(y-x*.21)/(cl*.85)),warp=(broad-.5)*1.4,patch=paintNoise(sx+91+x/(cl*.42)+warp,sy+57+y/(cl*.53)-warp*.7);lattice[j*G+i]=broad*.76+patch*.24;}
  const grain=!!this.water&&this.water.grain>0;
  for(let j=0;j<t.h;j++){const gj=j>>2,v=(j&3)/4;for(let i=0;i<t.w;i++){
   const gi=i>>2,u=(i&3)/4,k=gj*G+gi,c=j*TILE+i;
   t.cloud[c]=(lattice[k]*(1-u)+lattice[k+1]*u)*(1-v)+(lattice[k+G]*(1-u)+lattice[k+G+1]*u)*v;
   if(grain){const x=t.x+i,y=t.y+j;t.grain[c]=paintNoise(sx+171+(x+y*.27)/fine,sy+331+(y-x*.19)/fine);}else t.grain[c]=.5;
  }}
 }
 private readonly lattice=new Float32Array((TILE/4+1)*(TILE/4+1));
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
 private step(r:number){
  const spacing=Math.max(.02,Math.min(.5,this.s.tipSpacing??.08));
  return Math.max(.6,2*r*(this.batch?largeBlendSpacing(this.s.size,spacing):spacing));
 }
 /** Process every not-yet-processed dab along `points`. */
 advance(raw:Point[]){
  if(!raw.length)return;
  this.follow(raw);const points=this.path;
  if(this.next===0){const p=points[0];const r=this.radius(p.p);this.queueDab(p.x,p.y,p.p,r,this.step(r));this.carry=this.step(r);this.next=1;}
  for(;this.next<points.length;this.next++){
   const a=points[this.next-1],b=points[this.next],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
   if(len<1e-9)continue;
   this.dirX=dx/len;this.dirY=dy/len;
   while(this.carry<=len){
    const t=this.carry/len,x=a.x+dx*t,y=a.y+dy*t,p=a.p+(b.p-a.p)*t,r=this.radius(p),st=this.step(r);
    this.traveled+=st;this.queueDab(x,y,p,r,st);this.carry+=st;
   }
   this.carry-=len;
  }
  const endX=this.dirX,endY=this.dirY;
  this.batch?.run((bounds,diameter)=>{
   this.patchRaster!.ensure(Math.min(this.surface.width,diameter),Math.min(this.surface.height,diameter));
   this.surface.prepare(bounds,this.water?t=>this.waterFields(t):undefined);
  },(x,y,p,r,step,dx,dy,distance)=>{
   this.dirX=dx;this.dirY=dy;this.traveled=distance;
   this.surface.nextDab();this.dab(x,y,p,r,step);
  });
  this.dirX=endX;this.dirY=endY;
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
 private queueDab(x:number,y:number,p:number,r:number,step:number){
  if(this.batch)this.batch.add(x,y,p,r,step,this.dirX,this.dirY,this.traveled);
  else this.dab(x,y,p,r,step);
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
  if(this.water){this.waterTarget(R);}else{
  if(tune.blur){const B=this.scratch;for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){let r0=0,g0=0,b0=0,a0=0,n=0;for(let v=-1;v<=1;v++)for(let h=-1;h<=1;h++){const ii=i+h,jj=j+v;if(ii<0||jj<0||ii>=PATCH||jj>=PATCH)continue;const k=(jj*PATCH+ii)*4;r0+=R[k];g0+=R[k+1];b0+=R[k+2];a0+=R[k+3];n++;}const k=(j*PATCH+i)*4;B[k]=r0/n;B[k+1]=g0/n;B[k+2]=b0/n;B[k+3]=a0/n;}src=B;}
  const mean=tune.mean,keep=1-mean;
  for(let k=0;k<CELLS*4;k+=4){T[k]=src[k]*keep+mr*mean;T[k+1]=src[k+1]*keep+mg*mean;T[k+2]=src[k+2]*keep+mb*mean;T[k+3]=src[k+3]*keep+ma*mean;}
  }
  // 4) deposit with a smooth falloff (Blend Strength, Opacity, pressure)
  let strength=clamp01(s.silkStrength??.55)*clamp01(s.opacity)*(s.pressure?.3+.7*pr:1)*tune.gain;
  if(this.mode==='smudge')strength*=Math.exp(-this.traveled/(2*r*(4+14*clamp01(s.silkWetness??.35))));
  const alpha=1-Math.pow(1-Math.min(.95,strength*.32),u);
  if(alpha<=1e-5){this.dabs++;return;}
  if(this.batch)this.depositBatch(x,y,r,alpha,pr,T);
  else this.depositLegacy(x,y,r,alpha,pr,T);
  this.dabs++;
 }
 // Keep the exact v1/v2 deposit loop for strokes saved without the raster flag.
 private depositLegacy(x:number,y:number,r:number,alpha:number,pr:number,T:Float32Array){
  const s=this.s,tune=this.tune;
  const tex=clamp01(s.silkTexture??0),dry=this.mode==='dry',seed=this.seed,coverage=.22+.48*pr,dirX=this.dirX,dirY=this.dirY;
  const left=Math.max(0,Math.floor(x-r)),top=Math.max(0,Math.floor(y-r)),right=Math.min(this.surface.width,Math.ceil(x+r)),bottom=Math.min(this.surface.height,Math.ceil(y+r));
  if(right<=left||bottom<=top)return;
  const inv=1/r,falloff=tune.falloff,water=this.water,wetFront=.45*clamp01(s.silkWetness??.35);
  for(let ty=Math.floor(top/TILE);ty*TILE<bottom;ty++)for(let tx=Math.floor(left/TILE);tx*TILE<right;tx++){
   const t=this.surface.tile(tx,ty);if(!t)continue;
   if(water)this.waterFields(t);
   const x0=Math.max(left,t.x),x1=Math.min(right,t.x+t.w),y0=Math.max(top,t.y),y1=Math.min(bottom,t.y+t.h),f=t.f,changed=t.changed;let any=false;
   for(let py=y0;py<y1;py++){const dy=(py+.5-y)*inv,dy2=dy*dy;if(dy2>=1)continue;
    for(let px=x0;px<x1;px++){
     const dx=(px+.5-x)*inv,d2=dx*dx+dy2;if(d2>=1)continue;
     let a:number;
     if(water){
      // Irregular, soft wet front: the broad pigment cloud pulls the edge in
      // unevenly, so the blend blooms like wet paint instead of a round stamp.
      const c=(py-t.y)*TILE+px-t.x,edge=Math.sqrt(d2)*(1+wetFront*t.cloud![c]);if(edge>=1)continue;
      const cov=ease(0,.75,1-edge);if(cov>t.wet![c])t.wet![c]=cov;
      a=alpha*falloff(edge);changed[c]=1;any=true;
     }else a=alpha*falloff(Math.sqrt(d2));
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
 }
 private depositBatch(x:number,y:number,r:number,alpha:number,pr:number,T:Float32Array){
  const s=this.s,tune=this.tune;
  const tex=clamp01(s.silkTexture??0),dry=this.mode==='dry',seed=this.seed,coverage=.22+.48*pr,dirX=this.dirX,dirY=this.dirY;
  const left=Math.max(0,Math.floor(x-r)),top=Math.max(0,Math.floor(y-r)),right=Math.min(this.surface.width,Math.ceil(x+r)),bottom=Math.min(this.surface.height,Math.ceil(y+r));
  if(right<=left||bottom<=top)return;
  const inv=1/r,falloff=tune.falloff,water=this.water,wetFront=.45*clamp01(s.silkWetness??.35);
  const patch=this.patchRaster!.prepare(T,left,top,right,bottom,x,y,inv,PATCH,false);
  const reduced=patch.pixels,shift=patch.shift,stride=patch.stride;
  for(let ty=Math.floor(top/TILE);ty*TILE<bottom;ty++)for(let tx=Math.floor(left/TILE);tx*TILE<right;tx++){
   const t=this.surface.tile(tx,ty);if(!t)continue;
   if(water)this.waterFields(t);
   const x0=Math.max(left,t.x),x1=Math.min(right,t.x+t.w),y0=Math.max(top,t.y),y1=Math.min(bottom,t.y+t.h),f=t.f,changed=t.changed;let any=false;
   for(let py=y0;py<y1;py++){const dy=(py+.5-y)*inv,dy2=dy*dy;if(dy2>=1)continue;
    const reducedRow=((py-top)>>shift)*stride;
    for(let px=x0;px<x1;px++){
     const dx=(px+.5-x)*inv,d2=dx*dx+dy2;if(d2>=1)continue;
     let a:number;
     if(water){
      // Irregular, soft wet front: the broad pigment cloud pulls the edge in
      // unevenly, so the blend blooms like wet paint instead of a round stamp.
      const c=(py-t.y)*TILE+px-t.x,edge=Math.sqrt(d2)*(1+wetFront*t.cloud![c]);if(edge>=1)continue;
      const cov=ease(0,.75,1-edge);if(cov>t.wet![c])t.wet![c]=cov;
      a=alpha*falloff(edge);changed[c]=1;any=true;
     }else a=alpha*falloff(Math.sqrt(d2));
     if(tex>0){
      const grain=valueNoise(px*.55,py*.55,seed&255)*.6+valueNoise(px*.17,py*.17,(seed>>8)&255)*.4;
      if(dry){const across=dx*-dirY+dy*dirX,bristle=noise1(across*15+((seed>>16)&63),seed&1023),m=grain*.45+bristle*.55,th=1-coverage,c=clamp01((m-th+.09)/.18);a*=1-tex*(1-c*c*(3-2*c));}
      else a*=1-tex*.6*(1-grain);
     }
     if(a<=1e-5)continue;
     const position=reducedRow+((px-left)>>shift)*4;
     const o=((py-t.y)*TILE+px-t.x)*4;
     for(let c=0;c<4;c++)f[o+c]+=(reduced[position+c]-f[o+c])*a;
     changed[o>>2]=1;any=true;
    }
   }
   if(any){t.dirty=true;t.touched=true;}
  }
 }
 /** Watercolor Wet target: wider wet bleed (several soft passes), then colours
  * mix as transparent pigment (averaged optical density), so red and blue melt
  * into a deep violet the way watercolour glazes do, not a grey RGB average. */
 private waterTarget(R:Float32Array){
  const T=this.target,B=this.scratch;let src=R;
  // separable 3x3 box (edge-normalised), one to three passes by Wetness
  const H=this.hpass;
  for(let pass=0;pass<this.blurPasses;pass++){
   const out=src===B?T:B;
   for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const k=(j*PATCH+i)*4,l=i>0?k-4:k,r=i<PATCH-1?k+4:k,n=i>0&&i<PATCH-1?1/3:.5;
    if(i>0&&i<PATCH-1){H[k]=(src[l]+src[k]+src[r])*n;H[k+1]=(src[l+1]+src[k+1]+src[r+1])*n;H[k+2]=(src[l+2]+src[k+2]+src[r+2])*n;H[k+3]=(src[l+3]+src[k+3]+src[r+3])*n;}
    else{const o=i>0?l:r;H[k]=(src[k]+src[o])*n;H[k+1]=(src[k+1]+src[o+1])*n;H[k+2]=(src[k+2]+src[o+2])*n;H[k+3]=(src[k+3]+src[o+3])*n;}}
   const row=PATCH*4;
   for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){const k=(j*PATCH+i)*4;
    if(j>0&&j<PATCH-1){for(let c=0;c<4;c++)out[k+c]=(H[k-row+c]+H[k+c]+H[k+row+c])/3;}
    else{const o=j>0?k-row:k+row;for(let c=0;c<4;c++)out[k+c]=(H[k+c]+H[o+c])*.5;}}
   src=out;
  }
  // optical density per cell, and its alpha-weighted mean over the round nib
  const D=this.density;let dr=0,dg=0,db=0,ma=0,mw=0;
  for(let j=0;j<PATCH;j++)for(let i=0;i<PATCH;i++){
   const k=(j*PATCH+i)*4,a=src[k+3];
   if(a>=1){const m=1/a;D[k]=negLn(src[k]*m);D[k+1]=negLn(src[k+1]*m);D[k+2]=negLn(src[k+2]*m);}else D[k]=D[k+1]=D[k+2]=-1;
   const dx=(i+.5)/PATCH*2-1,dy=(j+.5)/PATCH*2-1,d2=dx*dx+dy*dy;if(d2>=1)continue;const w=1-d2;
   ma+=a*w;mw+=w;if(a>=1){const aw=a*w;dr+=D[k]*aw;dg+=D[k+1]*aw;db+=D[k+2]*aw;}
  }
  const wsum=ma;ma=mw>0?ma/mw:0;if(wsum>0){dr/=wsum;dg/=wsum;db/=wsum;}
  const mean=this.tune.mean,keep=1-mean;
  for(let k=0;k<CELLS*4;k+=4){
   const a=src[k+3]*keep+ma*mean;
   if(a<1e-4){T[k]=T[k+1]=T[k+2]=T[k+3]=0;continue;}
   const own=D[k]>=0,wo=own?src[k+3]*keep:0,wm=wsum>0?ma*mean:0,ws=wo+wm;
   if(ws<=0){T[k]=src[k];T[k+1]=src[k+1];T[k+2]=src[k+2];T[k+3]=a;continue;}
   const r=own?(D[k]*wo+dr*wm)/ws:dr,g=own?(D[k+1]*wo+dg*wm)/ws:dg,b=own?(D[k+2]*wo+db*wm)/ws:db;
   T[k]=expNeg(r)*a;T[k+1]=expNeg(g)*a;T[k+2]=expNeg(b)*a;T[k+3]=a;
  }
 }
 private readonly density=new Float32Array(CELLS*4);private readonly hpass=new Float32Array(CELLS*4);
 /** Write tiles to `ctx`. `all` rewrites every tile this stroke ever touched. */
 flush(ctx:CanvasRenderingContext2D,all=false):RasterRegion|undefined{
  if(this.batch)return this.surface.flushBatch(ctx,all,false,(t,bytes)=>this.surface.bytes(t,bytes,this.water));
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const t of this.surface.tiles.values()){
   if(!(t.dirty||all&&t.touched))continue;
   const img=ctx.createImageData(t.w,t.h);this.surface.bytes(t,img.data,this.water);ctx.putImageData(img,t.x,t.y);t.dirty=false;
   left=Math.min(left,t.x);top=Math.min(top,t.y);right=Math.max(right,t.x+t.w);bottom=Math.max(bottom,t.y+t.h);
  }
  return Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:undefined;
 }
 /** Put the original pixels back (used when the path changed under us). */
 restore(ctx:CanvasRenderingContext2D):RasterRegion|undefined{
  if(this.batch)return this.surface.flushBatch(ctx,true,true,()=>{});
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
