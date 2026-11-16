import {nativePixelsDiffer} from './nativePixelDelta';
import type {Point,Stroke} from '../core/model';
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
Object.defineProperty(globalThis,'document',{value:{createElement:(tag:string)=>{if(tag!=='canvas')throw Error('Unsupported worker element');return new OffscreenCanvas(1,1);}}});
type Message={kind:'begin'|'update'|'cancel';token:number;serial:number;width:number;height:number;base?:ImageBitmap;readFrequently?:boolean;nativeDelta?:boolean;basePixels?:Uint8ClampedArray;deltaPixels?:Uint8ClampedArray;deltaRegion?:RasterRegion;seeded?:boolean;compactReplies?:boolean;reuseSurfaces?:boolean;stroke?:Stroke;pointDelta?:Point[];resetPoints?:boolean;final?:boolean};
const worker=self as unknown as {onmessage:(e:MessageEvent<Message>)=>void;postMessage:(data:unknown,transfer?:Transferable[])=>void};
let surfaceMode:boolean|undefined;
let token=0,base:OffscreenCanvas|undefined,target:OffscreenCanvas|undefined,region:RasterRegion|undefined;
let deltaSupport:RasterRegion|undefined,deltaRegion:RasterRegion|undefined;
let deltaBase:Uint8ClampedArray|undefined,deltaRead:OffscreenCanvas|undefined,deltaMask:OffscreenCanvas|undefined,deltaPaint:OffscreenCanvas|undefined;
let pigmentPoints=0;
let compactReplies=false,lastPixels:Uint8ClampedArray|undefined;
let nativeMask:OffscreenCanvas|undefined;let nativeStrokeRaster:LiveStrokeRaster|undefined;
let activeStroke:Stroke|undefined,activeStrokeToken=0;
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
// Long Mix gestures can contain thousands of tiny tablet samples. The pigment
// pickup and saved stroke keep every captured point; only the provisional brush
// mask uses a size-aware spatial reduction so its geometry stays responsive.
function mixPreviewGeometryStroke(stroke:Stroke):Stroke{
 const source=stroke.points;if(source.length<96)return stroke;
 const spacing=Math.max(2,Math.min(6,(stroke.size||32)*.035));
 const kept:Point[]=[source[0]];let last=source[0];
 for(let i=1;i<source.length-1;i++){
  const p=source[i],next=source[i+1],distance=Math.hypot(p.x-last.x,p.y-last.y);
  const incoming=Math.hypot(p.x-source[i-1].x,p.y-source[i-1].y),outgoing=Math.hypot(next.x-p.x,next.y-p.y);
  const dot=incoming>1e-4&&outgoing>1e-4?((p.x-source[i-1].x)*(next.x-p.x)+(p.y-source[i-1].y)*(next.y-p.y))/(incoming*outgoing):1;
  const pressureChange=Math.abs(p.p-last.p)>.035,velocityChange=Math.abs((p.v??1)-(last.v??1))>.12;
  if(distance>=spacing||pressureChange||velocityChange||dot<.82){kept.push(p);last=p;}
 }
 const end=source[source.length-1];if(last!==end)kept.push(end);
 return kept.length===source.length?stroke:{...stroke,points:kept};
}

worker.onmessage=async({data:j})=>{
 let pendingBitmaps:ImageBitmap[]=[];
 try{
  if(j.kind!=='update'){
   activeStroke=undefined;activeStrokeToken=0;
   compactReplies=!!j.compactReplies;pigmentPoints=0;
   if(j.basePixels){if(lastPixels?.length===j.basePixels.length)lastPixels.set(j.basePixels);else lastPixels=j.basePixels.slice();}else if(j.kind!=='cancel'||!j.reuseSurfaces)lastPixels=undefined;
   deltaSupport=j.seeded?j.deltaRegion:undefined;deltaRegion=j.deltaRegion;deltaBase=undefined;
   for(const c of [deltaRead,deltaMask,deltaPaint])if(c)c.width=c.height=0;deltaRead=deltaMask=deltaPaint=undefined;
   resetWetSmudgeCaches();resetGentleBlend();if(target)resetPigmentMix(target as unknown as HTMLCanvasElement,true);nativeStrokeRaster?.reset();token=j.token;region=undefined;
   if(nativeMask)nativeMask.getContext('2d')!.reset();
   if(j.kind==='cancel'){if(!j.reuseSurfaces){if(target)resetPigmentMix(target as unknown as HTMLCanvasElement);for(const c of [base,target,nativeMask])if(c)c.width=c.height=0;base=target=nativeMask=undefined;nativeStrokeRaster=undefined;lastPixels=undefined;surfaceMode=undefined;}return;}
   const readFrequently=j.nativeDelta||j.readFrequently!==false;
   if(!base||!target||base.width!==j.width||base.height!==j.height||surfaceMode!==readFrequently){
    if(target)resetPigmentMix(target as unknown as HTMLCanvasElement);if(base)base.width=base.height=0;if(target)target.width=target.height=0;
    base=new OffscreenCanvas(j.width,j.height);target=new OffscreenCanvas(j.width,j.height);surfaceMode=readFrequently;
   }
   const baseContext=base.getContext('2d',{willReadFrequently:readFrequently})!,targetContext=target.getContext('2d',{willReadFrequently:readFrequently})!;
   if(j.nativeDelta&&j.basePixels){const pixels=baseContext.createImageData(j.width,j.height);pixels.data.set(j.basePixels);baseContext.putImageData(pixels,0,0);targetContext.putImageData(pixels,0,0);}
   else{baseContext.clearRect(0,0,j.width,j.height);targetContext.clearRect(0,0,j.width,j.height);baseContext.drawImage(j.base!,0,0);targetContext.drawImage(j.base!,0,0);}j.base?.close();
   if(j.nativeDelta){deltaRead=new OffscreenCanvas(j.basePixels?1:j.width,j.basePixels?1:j.height);const read=deltaRead.getContext('2d',{willReadFrequently:true})!;if(j.deltaPixels||j.basePixels)deltaBase=j.deltaPixels??j.basePixels;else{read.drawImage(base,0,0);deltaBase=read.getImageData(0,0,j.width,j.height).data;deltaRead.width=deltaRead.height=1;}deltaMask=new OffscreenCanvas(1,1);deltaPaint=new OffscreenCanvas(1,1);}
   return;
  }
  if(j.token!==token||!base||!target)return;
  let s:Stroke;
  if(j.pointDelta){
   if(!j.stroke)throw Error('Missing stroke metadata');
   const {points:_points,...metadata}=j.stroke;
   const reset=!!j.resetPoints||!activeStroke||activeStrokeToken!==j.token||activeStroke.id!==j.stroke.id;
   let current:Stroke;
   if(reset)current={...metadata,points:[]};
   else{current=activeStroke!;Object.assign(current,metadata);}
   current.points.push(...j.pointDelta);activeStroke=current;activeStrokeToken=j.token;s=current;
  }else{
   if(!j.stroke)return;
   s=j.stroke;activeStroke=s;activeStrokeToken=j.token;
  }
  const tc=target.getContext('2d')! as unknown as CanvasRenderingContext2D,bc=base as unknown as HTMLCanvasElement;
  // v3 sends only the new dab rectangle. Previously the entire accumulated
  // stroke was read/transferred on EVERY pointer update, causing long stalls.
  let r:RasterRegion;
  // Bounds fitting is expensive on long strokes. Evaluate at most once, and
  // only if the incremental raster has no valid changed region.
  let bounds:RasterRegion|undefined;
  let geometry:ReturnType<typeof strokeGeometry>|undefined;
  const currentGeometry=()=>geometry??=j.final?finalGeometry(s):strokeGeometry(s.nativeMixVersion?mixPreviewGeometryStroke(s):s,'live');
  const fullBounds=()=>bounds??=strokeRasterBounds(s,target!.width,target!.height,currentGeometry());
  const ownershipBounds=()=>deltaRegion&&deltaRegion.width>0&&deltaRegion.height>0?union(deltaRegion,fullBounds()):fullBounds();
  if(!!s.nativeMixVersion||(s.paintTipVersion===2||s.dryBristleVersion===3)&&s.brushTip!=='color-blender'){
   if(!nativeMask||nativeMask.width!==target.width||nativeMask.height!==target.height){nativeMask=new OffscreenCanvas(target.width,target.height);nativeStrokeRaster??=new LiveStrokeRaster();}
   // Rebuild the canonical final mask, but retain carried pigment: contacts
   // depend only on the unchanged raw path, not the provisional brush geometry.
   // Restore only the old/final footprint before applying that final mask.
   if(j.final){nativeStrokeRaster!.reset();nativeMask.getContext('2d')!.reset();const restore=finiteRegion(union(region,fullBounds()),target.width,target.height,fullBounds);tc.clearRect(restore.x,restore.y,restore.width,restore.height);tc.drawImage(bc,restore.x,restore.y,restore.width,restore.height,restore.x,restore.y,restore.width,restore.height);}
   const maskContext=nativeMask.getContext('2d')! as unknown as CanvasRenderingContext2D;
   if(j.final){resetDryBristleV3MixModel(s);drawStroke(maskContext,s,'final',currentGeometry());}
   else nativeStrokeRaster!.paint(maskContext,s,currentGeometry());
   let updated=finiteRegion(j.final?fullBounds():nativeStrokeRaster!.lastRegion??fullBounds(),target.width,target.height,fullBounds);
   if(s.nativeMixVersion===3&&!j.final){
    if(compactReplies&&!s.transform&&!s.perspective){
     // Only new pigment contacts can change the carried-colour field. Include
     // their footprint, rather than adding a full nib halo to the entire tail.
     const halo=Math.ceil(s.size*1.5+12);let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
     for(let i=Math.max(0,pigmentPoints-1);i<s.points.length;i++){const p=s.points[i];left=Math.min(left,p.x-halo);top=Math.min(top,p.y-halo);right=Math.max(right,p.x+halo);bottom=Math.max(bottom,p.y+halo);}
     if(Number.isFinite(left))updated=finiteRegion(union(updated,{x:left,y:top,width:right-left,height:bottom-top}),target.width,target.height,fullBounds);
    }else{const halo=Math.ceil(s.size*1.5+12);updated=finiteRegion({x:updated.x-halo,y:updated.y-halo,width:updated.width+halo*2,height:updated.height+halo*2},target.width,target.height,fullBounds);}
    pigmentPoints=s.points.length;
   }
   // Repaint/transfer only the changed tail while the pointer moves. The
   // accumulated union is bookkeeping for the FINAL correction only: the
   // final fitted stroke can shrink outside the last provisional footprint.
   region=union(region,updated);
   r=j.final?region:updated;
   if(r.width<1||r.height<1)r={x:0,y:0,width:1,height:1};
   if(s.nativeMixVersion)applyNativeBrushMix(tc,nativeMask as unknown as HTMLCanvasElement,s,0,0,j.final&&s.nativeMixVersion===3?fullBounds():r,bc);
   else{tc.clearRect(r.x,r.y,r.width,r.height);tc.drawImage(bc,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);compositePaintStroke(tc,nativeMask as unknown as HTMLCanvasElement,s,0,0,r,bc);}
  }else if(s.smudgeVersion===3){r=applyGentleBlend(tc,bc,s,0,0,{x:0,y:0,width:target.width,height:target.height},bc)??{x:0,y:0,width:1,height:1};}
  else{
   r=region=union(region,s.points.length?strokeRasterBounds(s,target.width,target.height):{x:0,y:0,width:target.width,height:target.height});
   compositePaintStroke(tc,bc,s,0,0,r,bc);
  }
  r=finiteRegion(r,target.width,target.height,fullBounds);
  if(deltaBase){
   const support=ownershipBounds(),old=deltaSupport;
   // A retained compact mask already owns unchanged historical support.
   // Expanding its bounding box does not change pixels outside the dab.
   if(!old)r=union(r,support);else if(!compactReplies){
    const x=Math.min(old.x,support.x),y=Math.min(old.y,support.y),right=Math.max(old.x+old.width,support.x+support.width),bottom=Math.max(old.y+old.height,support.y+support.height);
    if(old.x!==support.x)r=union(r,{x,y,width:Math.abs(old.x-support.x),height:bottom-y});
    if(old.x+old.width!==support.x+support.width)r=union(r,{x:Math.min(old.x+old.width,support.x+support.width),y,width:Math.abs(old.x+old.width-support.x-support.width),height:bottom-y});
    if(old.y!==support.y)r=union(r,{x,y,width:right-x,height:Math.abs(old.y-support.y)});
    if(old.y+old.height!==support.y+support.height)r=union(r,{x,y:Math.min(old.y+old.height,support.y+support.height),width:right-x,height:Math.abs(old.y+old.height-support.y-support.height)});
   }
   if(j.final&&!compactReplies)r=union(r,support);deltaSupport=support;
  }
  if(deltaBase){   const x=Math.floor(r.x/64)*64,y=Math.floor(r.y/64)*64,right=Math.min(target.width,Math.ceil((r.x+r.width)/64)*64),bottom=Math.min(target.height,Math.ceil((r.y+r.height)/64)*64);
   r={x,y,width:right-x,height:bottom-y};}
  // The pigment target stays exact. Transfer only tiles whose stored pixels
  // changed since the last reply. Keep the original native bitmap conversion
  // for identical pigment values; ownership masks use direct pixel buffers.
  if(compactReplies&&deltaBase&&lastPixels){
   const sampledX=r.x,sampledY=r.y,sampledWidth=r.width;const sampled=tc.getImageData(r.x,r.y,r.width,r.height),a=sampled.data,a32=new Uint32Array(a.buffer),last32=new Uint32Array(lastPixels.buffer);let left=r.width,top=r.height,right=0,bottom=0;
   for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const at=(y*r.width+x)*4,from=((r.y+y)*target.width+r.x+x)*4;if(last32[from/4]!==a32[at/4]&&nativePixelsDiffer(lastPixels,a,from,at)){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}}
   if(right>left&&bottom>top){const x=Math.floor((r.x+left)/64)*64,y=Math.floor((r.y+top)/64)*64,ex=Math.min(target.width,Math.ceil((r.x+right)/64)*64),ey=Math.min(target.height,Math.ceil((r.y+bottom)/64)*64);r={x,y,width:ex-x,height:ey-y};}else r={x:r.x,y:r.y,width:Math.min(64,r.width),height:Math.min(64,r.height)};
   // Reuse the first readback when packing the smaller changed rectangle.
   const data=new Uint8ClampedArray(r.width*r.height*4); for(let y=0;y<r.height;y++){const from=((r.y+y-sampledY)*sampledWidth+r.x-sampledX)*4;data.set(a.subarray(from,from+r.width*4),y*r.width*4);}const ownership=new Uint8ClampedArray(data.length),paint=new Uint8ClampedArray(data.length),tiles:{x:number;y:number;w:number;h:number}[]=[],support=ownershipBounds(),data32=new Uint32Array(data.buffer),base32=new Uint32Array(deltaBase.buffer),paint32=new Uint32Array(paint.buffer);
   for(let y=0;y<r.height;y++)lastPixels.set(data.subarray(y*r.width*4,(y+1)*r.width*4),((r.y+y)*target.width+r.x)*4);
   for(let ty=0;ty<r.height;ty+=64)for(let tx=0;tx<r.width;tx+=64){let left=64,top=64,right=0,bottom=0;for(let y=ty;y<Math.min(ty+64,r.height);y++)for(let x=tx;x<Math.min(tx+64,r.width);x++){const at=(y*r.width+x)*4,from=((r.y+y)*target.width+r.x+x)*4;if(r.x+x<support.x||r.y+y<support.y||r.x+x>=support.x+support.width||r.y+y>=support.y+support.height||base32[from/4]===data32[at/4]||!nativePixelsDiffer(deltaBase,data,from,at))continue;ownership[at+3]=255;paint32[at/4]=data32[at/4];left=Math.min(left,x-tx);top=Math.min(top,y-ty);right=Math.max(right,x-tx+1);bottom=Math.max(bottom,y-ty+1);}tiles.push(right>left&&bottom>top?{x:r.x+tx+left,y:r.y+ty+top,w:right-left,h:bottom-top}:{x:r.x+tx,y:r.y+ty,w:0,h:0});}
   const bitmap=await createImageBitmap(target,r.x,r.y,r.width,r.height);pendingBitmaps.push(bitmap);if(j.token!==token)return;worker.postMessage({token:j.token,serial:j.serial,region:r,final:j.final,bitmap,maskData:ownership,paintData:paint,tiles,support},[bitmap,ownership.buffer as ArrayBuffer,paint.buffer as ArrayBuffer]);pendingBitmaps=[];return;
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
