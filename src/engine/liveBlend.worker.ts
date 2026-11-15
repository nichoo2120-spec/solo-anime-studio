import {nativePixelsDiffer} from './nativePixelDelta';
import type {Stroke} from '../core/model';
import {compositePaintStroke,strokeRasterBounds} from './paintCompositing';
import {resetWetSmudgeCaches} from './wetSmudge';
import {resetGentleBlend,applyGentleBlend} from './gentleBlend';
import {LiveStrokeRaster} from './liveRaster';
import {strokeGeometry} from './strokeGeometry';
import {finalGeometry} from './geometryCache';
import {applyNativeBrushMix} from './nativeBrushMix';
import {resetPigmentMix} from './pigmentMix';
import {drawStroke} from './renderer';
import {resetDryBristleV3MixModel} from './dryBristleV3';
import type {RasterRegion} from './liveRaster';
Object.defineProperty(globalThis,'document',{value:{createElement:(tag:string)=>{if(tag!=='canvas')throw Error('Unsupported worker element');const canvas=new OffscreenCanvas(1,1);if(pixelReplies)canvas.getContext('2d',{willReadFrequently:true});return canvas;}}});
type Message={kind:'begin'|'update'|'cancel';token:number;serial:number;width:number;height:number;base?:ImageBitmap;readFrequently?:boolean;nativeDelta?:boolean;basePixels?:Uint8ClampedArray;deltaPixels?:Uint8ClampedArray;deltaRegion?:RasterRegion;seeded?:boolean;pixelReplies?:boolean;stroke:Stroke;final:boolean};
const worker=self as unknown as {onmessage:(e:MessageEvent<Message>)=>void;postMessage:(data:unknown,transfer?:Transferable[])=>void};
let token=0,base:OffscreenCanvas|undefined,target:OffscreenCanvas|undefined,region:RasterRegion|undefined;
let deltaSupport:RasterRegion|undefined,deltaRegion:RasterRegion|undefined;
let deltaBase:Uint8ClampedArray|undefined,deltaRead:OffscreenCanvas|undefined,deltaMask:OffscreenCanvas|undefined,deltaPaint:OffscreenCanvas|undefined;
let pixelReplies=false,lastPixels:Uint8ClampedArray|undefined;
let nativeMask:OffscreenCanvas|undefined;let nativeStrokeRaster:LiveStrokeRaster|undefined;
const union=(a:RasterRegion|undefined,b:RasterRegion)=>{if(!a)return b;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};
// An unchanged native mask can report Infinity/-Infinity extrema. Never let
// those poison the accumulated region or become a zero-width bitmap crop.
function finiteRegion(value:RasterRegion,width:number,height:number,fallback:()=>RasterRegion):RasterRegion{
 const valid=(r:RasterRegion)=>[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
 const backup=valid(value)?undefined:fallback();
 const r=valid(value)?value:backup&&valid(backup)?backup:{x:0,y:0,width:1,height:1};
 const x=Math.max(0,Math.min(width-1,Math.floor(r.x))),y=Math.max(0,Math.min(height-1,Math.floor(r.y)));
 return{x,y,width:Math.max(1,Math.min(width,Math.ceil(r.x+r.width))-x),height:Math.max(1,Math.min(height,Math.ceil(r.y+r.height))-y)};
}
worker.onmessage=async({data:j})=>{
 let pendingBitmaps:ImageBitmap[]=[];
 try{
  if(j.kind!=='update'){pixelReplies=!!j.pixelReplies;lastPixels=j.basePixels?.slice();deltaSupport=j.seeded?j.deltaRegion:undefined;deltaRegion=j.deltaRegion;deltaBase=undefined;for(const c of [deltaRead,deltaMask,deltaPaint])if(c)c.width=c.height=0;deltaRead=deltaMask=deltaPaint=undefined;resetWetSmudgeCaches();resetGentleBlend();nativeStrokeRaster?.reset();nativeStrokeRaster=undefined;nativeMask=undefined;if(base)base.width=base.height=0;if(target)target.width=target.height=0;token=j.token;region=undefined;base=target=undefined;
   if(j.kind==='begin'){base=new OffscreenCanvas(j.width,j.height);target=new OffscreenCanvas(j.width,j.height);const baseContext=base.getContext('2d',{willReadFrequently:j.nativeDelta||j.readFrequently!==false})!,targetContext=target.getContext('2d',{willReadFrequently:j.nativeDelta||j.readFrequently!==false})!;if(j.nativeDelta&&j.basePixels){const pixels=baseContext.createImageData(j.width,j.height);pixels.data.set(j.basePixels);baseContext.putImageData(pixels,0,0);targetContext.putImageData(pixels,0,0);}else{baseContext.drawImage(j.base!,0,0);targetContext.drawImage(j.base!,0,0);}j.base?.close();if(j.nativeDelta){deltaRead=new OffscreenCanvas(j.basePixels?1:j.width,j.basePixels?1:j.height);const read=deltaRead.getContext('2d',{willReadFrequently:true})!;if(j.deltaPixels||j.basePixels)deltaBase=j.deltaPixels??j.basePixels;else{read.drawImage(base,0,0);deltaBase=read.getImageData(0,0,j.width,j.height).data;deltaRead.width=deltaRead.height=1;}deltaMask=new OffscreenCanvas(1,1);deltaPaint=new OffscreenCanvas(1,1);}}return;
  }
  if(j.token!==token||!base||!target)return;
  const s=j.stroke,tc=target.getContext('2d')! as unknown as CanvasRenderingContext2D,bc=base as unknown as HTMLCanvasElement;
  // v3 sends only the new dab rectangle. Previously the entire accumulated
  // stroke was read/transferred on EVERY pointer update, causing long stalls.
  let r:RasterRegion;
  // Bounds fitting is expensive on long strokes. Evaluate at most once, and
  // only if the incremental raster has no valid changed region.
  let bounds:RasterRegion|undefined;
  let geometry:ReturnType<typeof strokeGeometry>|undefined;
  const currentGeometry=()=>geometry??=j.final?finalGeometry(s):strokeGeometry(s,'live');
  const fullBounds=()=>bounds??=strokeRasterBounds(s,target!.width,target!.height,currentGeometry());
  const ownershipBounds=()=>deltaRegion&&deltaRegion.width>0&&deltaRegion.height>0?union(deltaRegion,fullBounds()):fullBounds();
  if(!!s.nativeMixVersion){
   if(!nativeMask||nativeMask.width!==target.width||nativeMask.height!==target.height){nativeMask=new OffscreenCanvas(target.width,target.height);nativeStrokeRaster=new LiveStrokeRaster();}
   // On pen up generate the canonical final brush mask from scratch (off-thread),
   // then replay once against the immutable original layer. The union region
   // also removes provisional pixels that the final fitted geometry no longer covers.
   if(j.final){nativeStrokeRaster!.reset();resetPigmentMix(tc.canvas);nativeMask.width=target.width;nativeMask.height=target.height;tc.clearRect(0,0,target.width,target.height);tc.drawImage(bc,0,0);}
   const maskContext=nativeMask.getContext('2d',{willReadFrequently:pixelReplies})! as unknown as CanvasRenderingContext2D;
   if(j.final&&s.nativeMixVersion===3){resetDryBristleV3MixModel(s);drawStroke(maskContext,s,'final',currentGeometry());}
   else nativeStrokeRaster!.paint(maskContext,s,currentGeometry());
   let updated=finiteRegion(j.final?fullBounds():nativeStrokeRaster!.lastRegion??fullBounds(),target.width,target.height,fullBounds);
   if(s.nativeMixVersion===3&&!j.final){const halo=Math.ceil(pixelReplies&&!s.transform&&!s.perspective?s.size*.75+12:s.size*1.5+12);updated=finiteRegion({x:updated.x-halo,y:updated.y-halo,width:updated.width+halo*2,height:updated.height+halo*2},target.width,target.height,fullBounds);}
   // Repaint/transfer only the changed tail while the pointer moves. The
   // accumulated union is bookkeeping for the FINAL correction only: the
   // final fitted stroke can shrink outside the last provisional footprint.
   region=union(region,updated);
   r=j.final?region:updated;
   if(r.width<1||r.height<1)r={x:0,y:0,width:1,height:1};
   applyNativeBrushMix(tc,nativeMask as unknown as HTMLCanvasElement,s,0,0,j.final&&s.nativeMixVersion===3?fullBounds():r,bc);
  }else if(s.smudgeVersion===3){r=applyGentleBlend(tc,bc,s,0,0,{x:0,y:0,width:target.width,height:target.height},bc)??{x:0,y:0,width:1,height:1};}
  else{
   r=region=union(region,s.points.length?strokeRasterBounds(s,target.width,target.height):{x:0,y:0,width:target.width,height:target.height});
   compositePaintStroke(tc,bc,s,0,0,r,bc);
  }
  r=finiteRegion(r,target.width,target.height,fullBounds);
  if(deltaBase){
   const support=ownershipBounds(),old=deltaSupport;
   if(!old)r=union(r,support);else{
    const x=Math.min(old.x,support.x),y=Math.min(old.y,support.y),right=Math.max(old.x+old.width,support.x+support.width),bottom=Math.max(old.y+old.height,support.y+support.height);
    if(old.x!==support.x)r=union(r,{x,y,width:Math.abs(old.x-support.x),height:bottom-y});
    if(old.x+old.width!==support.x+support.width)r=union(r,{x:Math.min(old.x+old.width,support.x+support.width),y,width:Math.abs(old.x+old.width-support.x-support.width),height:bottom-y});
    if(old.y!==support.y)r=union(r,{x,y,width:right-x,height:Math.abs(old.y-support.y)});
    if(old.y+old.height!==support.y+support.height)r=union(r,{x,y:Math.min(old.y+old.height,support.y+support.height),width:right-x,height:Math.abs(old.y+old.height-support.y-support.height)});
   }
   if(j.final)r=union(r,support);deltaSupport=support;
  }
  if(deltaBase){   const x=Math.floor(r.x/64)*64,y=Math.floor(r.y/64)*64,right=Math.min(target.width,Math.ceil((r.x+r.width)/64)*64),bottom=Math.min(target.height,Math.ceil((r.y+r.height)/64)*64);
   r={x,y,width:right-x,height:bottom-y};}
  // The pigment target stays exact. Transfer only tiles whose stored pixels
  // changed since the last reply, without a CPU/GPU bitmap round trip.
  if(pixelReplies&&deltaBase&&lastPixels){
   const sampled=tc.getImageData(r.x,r.y,r.width,r.height),a=sampled.data,a32=new Uint32Array(a.buffer),last32=new Uint32Array(lastPixels.buffer);let left=r.width,top=r.height,right=0,bottom=0;
   for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const at=(y*r.width+x)*4,from=((r.y+y)*target.width+r.x+x)*4;if(last32[from/4]!==a32[at/4]&&nativePixelsDiffer(lastPixels,a,from,at)){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}}
   if(right>left&&bottom>top){const x=Math.floor((r.x+left)/64)*64,y=Math.floor((r.y+top)/64)*64,ex=Math.min(target.width,Math.ceil((r.x+right)/64)*64),ey=Math.min(target.height,Math.ceil((r.y+bottom)/64)*64);r={x,y,width:ex-x,height:ey-y};}else r={x:0,y:0,width:Math.min(64,target.width),height:Math.min(64,target.height)};
   const pixels=tc.getImageData(r.x,r.y,r.width,r.height),data=pixels.data,ownership=new Uint8ClampedArray(data.length),paint=new Uint8ClampedArray(data.length),tiles:{x:number;y:number;w:number;h:number}[]=[],support=ownershipBounds(),data32=new Uint32Array(data.buffer),base32=new Uint32Array(deltaBase.buffer),paint32=new Uint32Array(paint.buffer);
   for(let y=0;y<r.height;y++)lastPixels.set(data.subarray(y*r.width*4,(y+1)*r.width*4),((r.y+y)*target.width+r.x)*4);
   for(let ty=0;ty<r.height;ty+=64)for(let tx=0;tx<r.width;tx+=64){let left=64,top=64,right=0,bottom=0;for(let y=ty;y<Math.min(ty+64,r.height);y++)for(let x=tx;x<Math.min(tx+64,r.width);x++){const at=(y*r.width+x)*4,from=((r.y+y)*target.width+r.x+x)*4;if(r.x+x<support.x||r.y+y<support.y||r.x+x>=support.x+support.width||r.y+y>=support.y+support.height||base32[from/4]===data32[at/4]||!nativePixelsDiffer(deltaBase,data,from,at))continue;ownership[at+3]=255;paint32[at/4]=data32[at/4];left=Math.min(left,x-tx);top=Math.min(top,y-ty);right=Math.max(right,x-tx+1);bottom=Math.max(bottom,y-ty+1);}tiles.push(right>left&&bottom>top?{x:r.x+tx+left,y:r.y+ty+top,w:right-left,h:bottom-top}:{x:r.x+tx,y:r.y+ty,w:0,h:0});}
   worker.postMessage({token:j.token,serial:j.serial,region:r,final:j.final,pixelData:data,maskData:ownership,paintData:paint,tiles,support},[data.buffer as ArrayBuffer,ownership.buffer as ArrayBuffer,paint.buffer as ArrayBuffer]);return;
  }
  const bitmap=await createImageBitmap(target,r.x,r.y,r.width,r.height);pendingBitmaps.push(bitmap);
  if(j.token!==token){bitmap.close();return;}
  let maskBitmap:ImageBitmap|undefined,paintBitmap:ImageBitmap|undefined,tiles:{x:number;y:number;w:number;h:number}[]|undefined;
  if(deltaBase&&deltaRead&&deltaMask&&deltaPaint){
   // Compare native pixels off the pen/UI thread. Expand to fixed document
   // tiles so the main thread can replace or clear complete ownership entries.
   const x=r.x,y=r.y,W=r.width,H=r.height;
   for(const c of [deltaRead,deltaMask,deltaPaint]){if(c.width!==W)c.width=W;if(c.height!==H)c.height=H;}
   const read=deltaRead.getContext('2d',{willReadFrequently:true})!;read.clearRect(0,0,W,H);read.drawImage(bitmap,0,0);const after=read.getImageData(0,0,W,H).data,mc=deltaMask.getContext('2d')!,pc=deltaPaint.getContext('2d')!,ownership=mc.createImageData(W,H),pixels=pc.createImageData(W,H),support=ownershipBounds();tiles=[];
   for(let ty=0;ty<H;ty+=64)for(let tx=0;tx<W;tx+=64){let left=64,top=64,right=0,bottom=0;
    for(let iy=ty;iy<Math.min(H,ty+64);iy++)for(let ix=tx;ix<Math.min(W,tx+64);ix++){const at=(iy*W+ix)*4,from=((y+iy)*target.width+x+ix)*4;if(x+ix<support.x||y+iy<support.y||x+ix>=support.x+support.width||y+iy>=support.y+support.height)continue;if(!nativePixelsDiffer(deltaBase,after,from,at))continue;ownership.data[at+3]=255;pixels.data[at]=after[at];pixels.data[at+1]=after[at+1];pixels.data[at+2]=after[at+2];pixels.data[at+3]=after[at+3];left=Math.min(left,ix-tx);top=Math.min(top,iy-ty);right=Math.max(right,ix-tx+1);bottom=Math.max(bottom,iy-ty+1);}
    tiles.push(right>left&&bottom>top?{x:x+tx+left,y:y+ty+top,w:right-left,h:bottom-top}:{x:x+tx,y:y+ty,w:0,h:0});
   }
   mc.putImageData(ownership,0,0);pc.putImageData(pixels,0,0);maskBitmap=await createImageBitmap(deltaMask);pendingBitmaps.push(maskBitmap);paintBitmap=await createImageBitmap(deltaPaint);pendingBitmaps.push(paintBitmap);
  }
  if(j.token!==token){bitmap.close();maskBitmap?.close();paintBitmap?.close();return;}
  worker.postMessage({token:j.token,serial:j.serial,bitmap,region:r,final:j.final,deltaMask:maskBitmap,deltaPaint:paintBitmap,tiles,support:deltaBase?ownershipBounds():undefined},[bitmap,...(maskBitmap?[maskBitmap]:[]),...(paintBitmap?[paintBitmap]:[])]);pendingBitmaps=[];
 }catch(error){worker.postMessage({token:j.token,serial:j.serial,error:String(error)});}finally{for(const bitmap of pendingBitmaps)bitmap.close();}
};
