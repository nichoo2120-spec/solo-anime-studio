import {HistoryTiles} from './HistoryTiles';
import type {ArtworkOrigin,Layer,Stroke,Project} from '../core/model';
import {nativePixelsDiffer} from './nativePixelDelta';
import {finalGeometry} from './geometryCache';
import {projectiveInkGeometry} from './projectiveInkGeometry';
import {drawProjectiveFlowInk,preservesFlowContour,projectedFlowBounds} from './projectiveFlowInk';
import {projectPoint} from './perspectiveWarp';
import {strokeRasterBounds} from './paintCompositing';
import {blendOperation,type LayerRenderer} from './renderer';
import {drawSolidInkV10} from './solidInkV10';
import {drawFlatInk} from './flatInk';
import {FlatLiveRaster} from './FlatLiveRaster';
import {SolidLiveRaster} from './SolidLiveRaster';
import type {strokeGeometry} from './strokeGeometry';
import type {BlendDelta,BlendBaseline,NativeMixSeed} from './LiveBlendWorker';
import type {RasterRegion} from './liveRaster';

type MixGroup={operations:Layer['operations'];renderer:LayerRenderer;revision:number;matrix:number[];width:number;height:number;frameWidth:number;frameHeight:number;sharp:HTMLCanvasElement;baseline:BlendBaseline;bytes:number};

type MixViewDelta={project:string;layer:string;before:Layer['operations'];after:Layer['operations'];renderer:LayerRenderer;matrix:number[];width:number;height:number;frameWidth:number;frameHeight:number;patch:HistoryTiles;bytes:number};

type Geometry=ReturnType<typeof strokeGeometry>;
type Box={x:number;y:number;w:number;h:number};
type Prepared={geometry:Geometry;bounds:Box;weight:number;nativePath?:{path:Path2D;dot:boolean};paths?:{scale:number;items:Path2D[]}};
type Key={operations:Layer['operations'];matrix:number[];firstClean:number;width:number;height:number;frameWidth:number;frameHeight:number;renderer?:LayerRenderer;rendererRevision?:number};
type Pending={token:number;layer:string;key:Key;operations:Layer['operations'];base:HTMLCanvasElement;timer:ReturnType<typeof setTimeout>};
type ViewPending={token:number;layer:string;key:Key;base?:Key;timer:ReturnType<typeof setTimeout>};
// Distance-anchored width profiles retain their shape at display resolution;
// routing them through a page bitmap made high-DPI and enlarged views pixelated.
export const displayCleanInk=(s:Stroke&ArtworkOrigin)=>!s.widthPointVersion&&!s.inShot&&!s.inPreviousStage&&!s.nativeMixVersion&&!s.mixStops&&!s.paintTipVersion&&!s.textureStrength&&!(s.inkTipVersion===1&&s.inkImage&&(s.inkImageAmount??1)>0)&&!(s.pressure&&s.pressureOpacity)&&(
 !!s.engineVersion&&['studio-ink','contour-flow','technical','eraser-hard','g-pen','mapping','brush-pen'].includes(s.brushKind??'technical')||s.flatNibVersion===1
);
const native=(s:Stroke)=>!s.inkProfileVersion&&!s.inkTipVersion&&!s.pressureOpacity&&!s.taperStart&&!s.taperEnd&&!(s.pressure&&s.pressureWidth!==false)&&!s.velocityTaper&&['technical','eraser-hard'].includes(s.brushKind??'technical');
const clean=displayCleanInk;

/** Clean ink uses the same display-resolution renderer at every zoom and stroke
 * count. Native bitmap prefixes retain their pixels. Scratch surfaces cover
 * individual stroke footprints for copying, avoiding whole-viewport copies per stroke. */
export class InkDisplay{
 private flatLive=new FlatLiveRaster();
 private solidLive=new SolidLiveRaster();
 private surface?:HTMLCanvasElement;private scratch?:HTMLCanvasElement;private preview?:HTMLCanvasElement;
 private key?:Key;private liveKey?:{base:Key;stroke:Stroke;geometry?:Geometry};
 private layers=new Map<string,{key:Key;surface:HTMLCanvasElement}>();
 private prefixes=new Map<string,{operations:Layer['operations'];canvas:HTMLCanvasElement;renderer:LayerRenderer;revision:number}>();
 private mixViewHistory=new Map<Layer['operations'][number],MixViewDelta>();private mixViewBytes=0;private readonly mixViewBudget=64*1024*1024;
 private mixRebase=new Map<string,{project:string;operations:Layer['operations']}>();
 private mixGroups=new Map<string,MixGroup>();private mixGroupBytes=0;private readonly mixGroupBudget=64*1024*1024;
 private nativeFallback?:{base:Key;stroke:string;rect?:Box};
 private nativePreview?:{base:Key;stroke:string;result:HTMLCanvasElement;delta:BlendDelta;group?:MixGroup;target?:{layer:Layer;project:string;frame?:string};box?:Box;cutMask:HTMLCanvasElement;cutPatch:HTMLCanvasElement;rect?:Box;revision:number};
 private lastLive?:{id:string;base:Key;picture:HTMLCanvasElement};private worker?:Worker;private pending?:Pending;private serial=0;
 constructor(private request:()=>void=()=>{}){}
 private prepared=new Map<Stroke,Prepared>();private preparedWeight=0;private pathBatches=0;
 private viewWorker?:Worker;private viewPending?:ViewPending;private viewSerial=0;private viewFailed=false;
 private navigationWorker?:Worker;private navigationSerial=0;private navigationGeneration=0;
 private navigationStates=new Map<string,{operations:Layer['operations'];firstClean:number;renderer:LayerRenderer;revision:number;width:number;height:number}>();
 private navigationJobs=new Map<number,{finish:(data:{bitmap?:ImageBitmap;rebuild?:boolean;error?:string})=>void;timer:ReturnType<typeof setTimeout>}>();
 /** Native-resolution navigation is built off-thread, separately from sharp view finishing. */
 async navigationBitmap(layer:Layer,p:Project,renderer:LayerRenderer):Promise<ImageBitmap|undefined>{
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return;
  const generation=this.navigationGeneration;
  let firstClean=0;for(let i=layer.operations.length-1;i>=0;i--){const op=layer.operations[i];if(op.kind!=='stroke'||!clean(op)){firstClean=i+1;break;}}
  if(firstClean===layer.operations.length)return;
  // Navigation workers only know the original stroke geometry. A warped ink
  // stroke must not be painted at its unwarped coordinates by that worker.
  // Keep the established raster navigation fallback; settled frames use
  // the sharp main-thread ink path below.
  if(layer.operations.slice(firstClean).some(op=>op.kind==='stroke'&&op.perspective))return;
  const previous=this.navigationStates.get(layer.id),append=!!previous&&previous.renderer===renderer&&previous.revision===renderer.displayRevision&&previous.width===p.width&&previous.height===p.height&&previous.firstClean===firstClean&&previous.operations.length<=layer.operations.length&&previous.operations.every((op,i)=>op===layer.operations[i]);
  let base:ImageBitmap|undefined;
  try{
   if(!append&&firstClean)base=await createImageBitmap(this.prefix(layer,p,firstClean,renderer));
   if(generation!==this.navigationGeneration){base?.close();return;}
   const worker=this.navigationWorker??=new Worker(new URL('./navigationInk.worker.ts',import.meta.url),{type:'module'}),token=++this.navigationSerial;
   const failed=()=>{if(this.navigationWorker!==worker)return;this.navigationWorker=undefined;worker.terminate();this.navigationStates.clear();for(const job of this.navigationJobs.values()){clearTimeout(job.timer);job.finish({error:'Navigation worker unavailable'});}this.navigationJobs.clear();};
   worker.onerror=event=>{event.preventDefault();failed();};worker.onmessageerror=failed;
   worker.onmessage=({data}:{data:{token:number;bitmap?:ImageBitmap;rebuild?:boolean;error?:string}})=>{const job=this.navigationJobs.get(data.token);if(!job){data.bitmap?.close();return;}clearTimeout(job.timer);this.navigationJobs.delete(data.token);job.finish(data);};
   const result=await new Promise<{bitmap?:ImageBitmap;rebuild?:boolean;error?:string}>(finish=>{const timer=setTimeout(failed,15000);this.navigationJobs.set(token,{finish,timer});const parts=layer.operations.slice(append?previous!.operations.length:firstClean);worker.postMessage({token,layer:layer.id,width:p.width,height:p.height,append,parts,base},base?[base]:[]);});
   if(result.rebuild){this.navigationStates.delete(layer.id);return this.navigationBitmap(layer,p,renderer);}
   if(result.bitmap){this.navigationStates.delete(layer.id);this.navigationStates.set(layer.id,{operations:layer.operations,firstClean,renderer,revision:renderer.displayRevision,width:p.width,height:p.height});while(this.navigationStates.size>4)this.navigationStates.delete(this.navigationStates.keys().next().value!);return result.bitmap;}
  }catch{base?.close();}
 }
 clear(){
  for(const entry of this.mixViewHistory.values())entry.patch.clear();this.mixViewHistory.clear();this.mixViewBytes=0;this.mixRebase.clear();
  for(const group of this.mixGroups.values()){group.sharp.width=group.sharp.height=0;const seed=group.baseline.seed;if(seed)seed.mask.width=seed.mask.height=seed.paint.width=seed.paint.height=0;}this.mixGroups.clear();this.mixGroupBytes=0;
  this.navigationGeneration++;this.navigationWorker?.terminate();this.navigationWorker=undefined;this.navigationStates.clear();for(const job of this.navigationJobs.values()){clearTimeout(job.timer);job.finish({error:"Navigation cancelled"});}this.navigationJobs.clear();
  this.viewSerial++;this.viewWorker?.terminate();this.viewWorker=undefined;if(this.viewPending)clearTimeout(this.viewPending.timer);this.viewPending=undefined;this.viewFailed=false;
  this.serial++;this.worker?.terminate();this.worker=undefined;if(this.pending){clearTimeout(this.pending.timer);this.pending.base.width=this.pending.base.height=0;}this.pending=undefined;this.lastLive=undefined;
  this.flatLive.clear();
  this.solidLive.clear();
  for(const c of [this.surface,this.scratch,this.preview,...[...this.layers.values()].map(v=>v.surface),...[...this.prefixes.values()].map(v=>v.canvas)])if(c)c.width=c.height=0;
  this.prefixes.clear();
  this.layers.clear();
  this.clearNativePreview();this.surface=this.scratch=this.preview=undefined;this.key=undefined;this.liveKey=undefined;this.prepared.clear();this.preparedWeight=0;this.pathBatches=0;
 }
 private prepare(s:Stroke,liveGeometry?:Geometry,cache=true):Prepared{
  const cached=cache&&!liveGeometry&&this.prepared.get(s);
  if(cached){this.prepared.delete(s);this.prepared.set(s,cached);return cached;}
  const sourceContour=!!s.perspective&&preservesFlowContour(s),geometry=liveGeometry??(s.perspective&&!sourceContour?projectiveInkGeometry(s):finalGeometry(s));let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  const visit=(point:{x:number;y:number})=>{const p=sourceContour?projectPoint(point,s.perspective!):point;x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);};
  geometry.points.forEach(visit);for(const c of geometry.cubics){visit(c.a);visit(c.c1);visit(c.c2);visit(c.b);}
  let pad=s.size*Math.max(1,s.maxSize??1)+2;
  if(sourceContour){const b=projectedFlowBounds(s,geometry,pad)!;x=b.left;y=b.top;right=b.right;bottom=b.bottom;pad=0;
  }
  const result={geometry,bounds:{x:x-pad,y:y-pad,w:right-x+pad*2,h:bottom-y+pad*2},weight:s.points.length+geometry.points.length+geometry.cubics.length*4};
  // This is a cache budget, never a rendering/quality cutoff.
  if(cache&&!liveGeometry&&result.weight<=100000){
   this.prepared.set(s,result);this.preparedWeight+=result.weight;
   this.trim();
  }
  return result;
 }
 private screenBounds(s:Stroke,b:Box,m:DOMMatrix,w:number,h:number):Box|undefined{
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const ox of [b.x,b.x+b.w])for(const oy of [b.y,b.y+b.h]){
   let x=ox,y=oy;if(s.transform&&!s.perspective){const [a,b,c,d,e,f]=s.transform;const X=a*x+c*y+e;y=b*x+d*y+f;x=X;}
   const X=m.a*x+m.c*y+m.e,Y=m.b*x+m.d*y+m.f;
   left=Math.min(left,X);top=Math.min(top,Y);right=Math.max(right,X);bottom=Math.max(bottom,Y);
  }
  const x=Math.max(0,Math.floor(left)),y=Math.max(0,Math.floor(top));right=Math.min(w,Math.ceil(right));bottom=Math.min(h,Math.ceil(bottom));
  return right>x&&bottom>y?{x,y,w:right-x,h:bottom-y}:undefined;
 }
 private trim(){
  while(this.prepared.size>2048||this.preparedWeight>100000||this.pathBatches>2048){const first=this.prepared.keys().next().value!,p=this.prepared.get(first)!;this.preparedWeight-=p.weight;this.pathBatches-=p.paths?.items.length??0;this.prepared.delete(first);}
 }
 /** Paint beneath ink is independent of the camera. Own a copy because the
  * renderer reuses mutable layer canvases. Bound retained copies to 32 MiB. */
 private prefix(layer:Layer,p:Project,end:number,renderer:LayerRenderer){
  const cached=this.prefixes.get(layer.id);
  if(cached&&cached.renderer===renderer&&cached.revision===renderer.displayRevision&&cached.canvas.width===p.width&&cached.canvas.height===p.height&&cached.operations.length===end&&cached.operations.every((op,i)=>op===layer.operations[i])){this.prefixes.delete(layer.id);this.prefixes.set(layer.id,cached);return cached.canvas;}
  // A first ink/eraser stroke above paint already has an exact native layer
  // bitmap. Preserve its operation-array identity so getDisplay can reuse it;
  // slicing the whole array forced every underlying paint stroke to replay.
  const operations=end===layer.operations.length?layer.operations:layer.operations.slice(0,end),source=renderer.prefixSnapshot(layer,p,end),bytes=p.width*p.height*4;
  if(bytes>32*1024*1024)return source;
  if(cached){cached.canvas.width=cached.canvas.height=0;this.prefixes.delete(layer.id);}
  let total=bytes;for(const item of this.prefixes.values())total+=item.canvas.width*item.canvas.height*4;
  while(this.prefixes.size&&(this.prefixes.size>=4||total>32*1024*1024)){const id=this.prefixes.keys().next().value!,old=this.prefixes.get(id)!;total-=old.canvas.width*old.canvas.height*4;old.canvas.width=old.canvas.height=0;this.prefixes.delete(id);}
  const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;canvas.getContext('2d')!.drawImage(source,0,0);this.prefixes.set(layer.id,{operations,canvas,renderer,revision:renderer.displayRevision});return canvas;
 }
 /** Keep earlier ink sharp around later native paint edits. Only pixels a
  * native edit actually changes are replaced by its canonical raster result. */
 private paintPrefix(out:CanvasRenderingContext2D,layer:Layer,p:Project,end:number,renderer:LayerRenderer,m:DOMMatrix,w:number,h:number){
  const ops=layer.operations.slice(0,end),first=ops.findIndex(op=>op.kind==='stroke'&&clean(op));
  const bitmap=(n:number)=>renderer.prefixSnapshot(layer,p,n);
  const place=(source:CanvasImageSource,x=0,y=0)=>{out.save();out.setTransform(m);out.globalAlpha=1;out.imageSmoothingEnabled=Math.hypot(m.a,m.b)<=1+1e-7;out.imageSmoothingQuality='high';out.drawImage(source,x,y);out.restore();};
  if(first<0){place(this.prefix(layer,p,end,renderer));return;}
  if(first)place(bitmap(first));
  let i=first;
  while(i<ops.length){
   const start=i,isInk=ops[i].kind==='stroke'&&clean(ops[i] as Stroke);while(i<ops.length&&(ops[i].kind==='stroke'&&clean(ops[i] as Stroke))===isInk)i++;
   if(isInk){this.paintStrokes(out,ops.slice(start,i) as Stroke[],m,w,h);continue;}
   let rx=p.width,ry=p.height,rr=0,rb=0;for(const op of ops.slice(start,i)){const b=op.kind==='stroke'?strokeRasterBounds(op,p.width,p.height):op.kind==='image'?{x:op.x,y:op.y,width:op.width,height:op.height}:{x:0,y:0,width:p.width,height:p.height};rx=Math.min(rx,b.x);ry=Math.min(ry,b.y);rr=Math.max(rr,b.x+b.width);rb=Math.max(rb,b.y+b.height);}rx=Math.max(0,Math.floor(rx));ry=Math.max(0,Math.floor(ry));rr=Math.min(p.width,Math.ceil(rr));rb=Math.min(p.height,Math.ceil(rb));const rw=rr-rx,rh=rb-ry;if(rw<=0||rh<=0)continue;
   const nativeBefore=bitmap(start),before=nativeBefore.getContext('2d')!.getImageData(rx,ry,rw,rh).data;
   const group=i===end&&end===layer.operations.length?this.rememberMixGroup(layer,p,renderer,m,out.canvas,nativeBefore,{x:rx,y:ry,width:rw,height:rh}):undefined;
   const after=bitmap(i).getContext('2d')!.getImageData(rx,ry,rw,rh).data;
   const seed=this.nativePatch(out,before,after,rx,ry,rw,rh,m,!!group);if(group)this.retainMixCuts(group,seed);
  }
  out.globalCompositeOperation='source-over';out.globalAlpha=1;
 }
 private nativePatch(out:CanvasRenderingContext2D,before:Uint8ClampedArray,after:Uint8ClampedArray,rx:number,ry:number,rw:number,rh:number,m:DOMMatrix,retain=false):NativeMixSeed|undefined{
  const place=(source:CanvasImageSource,x=0,y=0)=>{out.save();out.setTransform(m);out.globalAlpha=1;out.imageSmoothingEnabled=Math.hypot(m.a,m.b)<=1+1e-7;out.imageSmoothingQuality='high';out.drawImage(source,x,y);out.restore();};
   let left=rw,top=rh,right=0,bottom=0;const changed=(k:number)=>nativePixelsDiffer(before,after,k);
   for(let k=0;k<before.length;k+=4)if(changed(k)){const index=k/4,x=index%rw,y=Math.floor(index/rw);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
   if(right<=left||bottom<=top)return;
   const tileLeft=Math.floor((rx+left)/64),tileTop=Math.floor((ry+top)/64),tilesWide=Math.ceil((rx+right)/64)-tileLeft,tileBoxes:(Box|undefined)[]=retain?new Array(tilesWide*(Math.ceil((ry+bottom)/64)-tileTop)):[];
   const W=right-left,H=bottom-top,mask=document.createElement('canvas'),patch=document.createElement('canvas');mask.width=patch.width=W;mask.height=patch.height=H;const mc=mask.getContext('2d')!,pc=patch.getContext('2d')!,ownership=mc.createImageData(W,H),pixels=pc.createImageData(W,H);
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){const from=((top+y)*rw+left+x)*4,to=(y*W+x)*4;if(changed(from)){ownership.data[to+3]=255;pixels.data[to]=after[from];pixels.data[to+1]=after[from+1];pixels.data[to+2]=after[from+2];pixels.data[to+3]=after[from+3];if(retain){const gx=rx+left+x,gy=ry+top+y,index=(Math.floor(gy/64)-tileTop)*tilesWide+Math.floor(gx/64)-tileLeft,old=tileBoxes[index];if(old){const right=Math.max(old.x+old.w,gx+1),bottom=Math.max(old.y+old.h,gy+1);old.x=Math.min(old.x,gx);old.y=Math.min(old.y,gy);old.w=right-old.x;old.h=bottom-old.y;}else tileBoxes[index]={x:gx,y:gy,w:1,h:1};}}}
   mc.putImageData(ownership,0,0);pc.putImageData(pixels,0,0);out.globalCompositeOperation='destination-out';place(mask,rx+left,ry+top);out.globalCompositeOperation='source-over';place(patch,rx+left,ry+top);out.globalCompositeOperation='source-over';out.globalAlpha=1;
   if(retain){const tiles=new Map<string,Box>();for(const box of tileBoxes)if(box)tiles.set(Math.floor(box.x/64)*64+','+Math.floor(box.y/64)*64,box);return{mask,paint:patch,box:{x:rx+left,y:ry+top,w:W,h:H},tiles};}
   mask.width=mask.height=patch.width=patch.height=0;
 }
 private draw(ctx:CanvasRenderingContext2D,s:Stroke,p:Prepared,scale:number){
  const g=p.geometry;if(!g.points.length)return;
  ctx.save();if(s.transform&&!s.perspective)ctx.transform(...s.transform);
  if(native(s)){
   if(!p.nativePath){const path=new Path2D(),dot=!g.cubics.length;if(dot)path.arc(g.points[0].x,g.points[0].y,s.size/2,0,Math.PI*2);else{path.moveTo(g.points[0].x,g.points[0].y);for(const c of g.cubics)path.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.b.x,c.b.y);}p.nativePath={path,dot};}
   if(p.nativePath.dot){ctx.fillStyle=s.color;ctx.fill(p.nativePath.path);}else{ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(p.nativePath.path);}
  }else{
   // Round sampling density upward: paths remain at least display-resolution,
   // and wheel/pan frames within that range can reuse the exact same contour.
   const quality=Math.max(1,Math.ceil(scale*2-1e-6)/2);
   let paths=p.paths?.scale===quality?p.paths.items:undefined;
   if(!paths){paths=[];if(s.perspective&&preservesFlowContour(s))drawProjectiveFlowInk(ctx,s,g,quality,paths);else if(s.flatNibVersion===1)drawFlatInk(ctx,s,g,undefined,quality,paths);else drawSolidInkV10(ctx,s,g,undefined,quality,paths);
    if(this.prepared.get(s)===p){this.pathBatches-=p.paths?.items.length??0;p.paths=undefined;if(paths.length<=2048){p.paths={scale:quality,items:paths};this.pathBatches+=paths.length;}this.trim();}
   }
   ctx.fillStyle=s.color;for(const path of paths)ctx.fill(path);
  }
  ctx.restore();
 }
 /** Build sharp post-navigation pixels off-thread, keeping the cached document
  * responsive while a complex pressure-ink layer is refined. */
 primeView(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer):boolean{
  if(this.viewFailed||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return true;
  // Post-navigation worker paths rebuild unprojected geometry. Skip only
  // that worker when a projective clean-ink stroke is present; the settled
  // main-thread paint still redraws at the full device pixel ratio.
  if(layer.operations.some(op=>op.kind==='stroke'&&op.perspective))return true;
  let firstClean=0;for(let i=layer.operations.length-1;i>=0;i--){const op=layer.operations[i];if(op.kind!=='stroke'||!clean(op)){firstClean=i+1;break;}}if(firstClean===layer.operations.length)return true;
  const m=ctx.getTransform(),matrix=[m.a,m.b,m.c,m.d,m.e,m.f],w=ctx.canvas.width,h=ctx.canvas.height,cached=this.layers.get(layer.id),key:Key={operations:layer.operations,matrix,firstClean,width:w,height:h,frameWidth:p.width,frameHeight:p.height,renderer,rendererRevision:firstClean?renderer.displayRevision:0};
  if(cached&&cached.key.operations===key.operations&&cached.key.renderer===renderer&&cached.key.rendererRevision===key.rendererRevision&&cached.key.width===w&&cached.key.height===h&&cached.key.frameWidth===p.width&&cached.key.frameHeight===p.height&&cached.key.matrix.every((v,i)=>v===matrix[i]))return true;
  if(layer.operations.slice(0,firstClean).some(op=>op.kind==='stroke'&&clean(op)))return true;
  if(this.viewPending)return false;
  const fail=()=>{if(this.viewPending)clearTimeout(this.viewPending.timer);this.viewPending=undefined;this.viewWorker?.terminate();this.viewWorker=undefined;this.viewFailed=true;this.request();};
  try{const worker=this.viewWorker??=new Worker(new URL('./inkView.worker.ts',import.meta.url),{type:'module'}),token=++this.viewSerial,job:ViewPending={token,layer:layer.id,key,base:cached?.key,timer:setTimeout(fail,10000)};this.viewPending=job;
   worker.onerror=worker.onmessageerror=()=>{if(this.viewWorker===worker)fail();};worker.onmessage=({data}:{data:{token:number;bitmap?:ImageBitmap;error?:string}})=>{if(this.viewPending!==job||data.token!==token){data.bitmap?.close();return;}clearTimeout(job.timer);this.viewPending=undefined;if(data.error||!data.bitmap){fail();return;}
    const entry=this.layers.get(job.layer);if(entry?.key===job.base){const surface=document.createElement('canvas');surface.width=w;surface.height=h;surface.getContext('2d')!.drawImage(data.bitmap,0,0);entry?.surface&&(entry.surface.width=entry.surface.height=0);this.layers.delete(job.layer);this.layers.set(job.layer,{key,surface});let bytes=0;for(const item of this.layers.values())bytes+=item.surface.width*item.surface.height*4;while(this.layers.size>1&&(this.layers.size>8||bytes>64*1024*1024)){const id=this.layers.keys().next().value!,old=this.layers.get(id)!;bytes-=old.surface.width*old.surface.height*4;old.surface.width=old.surface.height=0;this.layers.delete(id);}this.liveKey=undefined;this.lastLive=undefined;}
    data.bitmap.close();this.request();};
   const parts=(layer.operations.slice(firstClean) as Stroke[]).map(stroke=>({stroke,geometry:this.prepared.get(stroke)?.geometry})),base=firstClean?createImageBitmap(this.prefix(layer,p,firstClean,renderer)):Promise.resolve(undefined);
   base.then(bitmap=>{if(this.viewPending!==job){bitmap?.close();return;}worker.postMessage({token,width:w,height:h,matrix,parts,base:bitmap},bitmap?[bitmap]:[]);}).catch(()=>{if(this.viewPending===job)fail();});return false;
  }catch{fail();return true;}
 }
 private rememberMixView(previous:Layer,layer:Layer,p:Project,renderer:LayerRenderer,m:DOMMatrix,before:HTMLCanvasElement,after:HTMLCanvasElement){
  const op=layer.operations.at(-1);if(!op||op.kind!=='stroke'||!op.nativeMixVersion&&op.paintTipVersion!==2&&op.dryBristleVersion!==3||this.mixViewHistory.has(op))return;
  const b=strokeRasterBounds(op,p.width,p.height),box=this.screenBounds({...op,transform:undefined,perspective:undefined},{x:b.x,y:b.y,w:b.width,h:b.height},m,before.width,before.height);if(!box)return;
  const x=Math.max(0,box.x-4),y=Math.max(0,box.y-4),right=Math.min(before.width,box.x+box.w+4),bottom=Math.min(before.height,box.y+box.h+4),rect={x,y,width:right-x,height:bottom-y},bytes=rect.width*rect.height*8;if(bytes>this.mixViewBudget)return;
  while(this.mixViewHistory.size&&(this.mixViewBytes+bytes>this.mixViewBudget||this.mixViewHistory.size>=160)){const oldest=this.mixViewHistory.keys().next().value!,entry=this.mixViewHistory.get(oldest)!;this.mixViewHistory.delete(oldest);this.mixViewBytes-=entry.bytes;entry.patch.clear();}
  // Display history is optional; canonical undo remains available if a
  // device cannot allocate another view patch.
  let patch:HistoryTiles|undefined;try{patch=new HistoryTiles(before,rect);patch.finish(after);this.mixViewHistory.set(op,{project:p.id,layer:layer.id,before:previous.operations,after:layer.operations,renderer,matrix:[m.a,m.b,m.c,m.d,m.e,m.f],width:before.width,height:before.height,frameWidth:p.width,frameHeight:p.height,patch,bytes});this.mixViewBytes+=bytes;}catch{patch?.clear();}
 }
 private restoreMixView(out:CanvasRenderingContext2D,key:Key,layer:Layer,p:Project,renderer:LayerRenderer){
  const old=key.operations,next=layer.operations,undo=next.length<old.length&&next.every((op,i)=>op===old[i]),redo=old.length<next.length&&old.every((op,i)=>op===next[i]);if(!undo&&!redo)return false;
  const source=undo?old:next,start=undo?next.length:old.length,patches=source.slice(start).map((op,i)=>{const d=this.mixViewHistory.get(op);return d&&d.project===p.id&&d.layer===layer.id&&d.renderer===renderer&&d.width===out.canvas.width&&d.height===out.canvas.height&&d.frameWidth===p.width&&d.frameHeight===p.height&&d.matrix.every((v,j)=>v===key.matrix[j])&&d.before.length===start+i&&d.before.every((v,j)=>v===source[j])?d:undefined;});
  if(!patches.every(d=>!!d))return false;for(const d of undo?patches.reverse():patches)d!.patch.restore(out,undo?'before':'after');
  this.clearNativePreview();const group=this.mixGroups.get(layer.id);if(group){this.mixGroups.delete(layer.id);this.mixGroupBytes-=group.bytes;group.sharp.width=group.sharp.height=0;const seed=group.baseline.seed;if(seed)seed.mask.width=seed.mask.height=seed.paint.width=seed.paint.height=0;}
  this.mixRebase.set(layer.id,{project:p.id,operations:layer.operations});this.lastLive=undefined;this.liveKey=undefined;return true;
 }
 private rememberMixGroup(layer:Layer,p:Project,renderer:LayerRenderer,m:DOMMatrix,sharp:HTMLCanvasElement,native:HTMLCanvasElement,region:RasterRegion){
  const bytes=p.width*p.height*4+sharp.width*sharp.height*4;if(bytes>this.mixGroupBudget)return undefined;
  const old=this.mixGroups.get(layer.id);if(old){this.mixGroupBytes-=old.bytes;old.sharp.width=old.sharp.height=0;const seed=old.baseline.seed;if(seed)seed.mask.width=seed.mask.height=seed.paint.width=seed.paint.height=0;this.mixGroups.delete(layer.id);}
  const copy=document.createElement('canvas');copy.width=sharp.width;copy.height=sharp.height;copy.getContext('2d')!.drawImage(sharp,0,0);
  const group:MixGroup={operations:layer.operations,renderer,revision:renderer.displayRevision,matrix:[m.a,m.b,m.c,m.d,m.e,m.f],width:sharp.width,height:sharp.height,frameWidth:p.width,frameHeight:p.height,sharp:copy,baseline:{pixels:native.getContext('2d')!.getImageData(0,0,p.width,p.height).data,region},bytes};
  this.mixGroups.set(layer.id,group);this.mixGroupBytes+=bytes;
  while(this.mixGroupBytes>this.mixGroupBudget){const id=this.mixGroups.keys().next().value!,entry=this.mixGroups.get(id)!;this.mixGroups.delete(id);this.mixGroupBytes-=entry.bytes;entry.sharp.width=entry.sharp.height=0;const seed=entry.baseline.seed;if(seed)seed.mask.width=seed.mask.height=seed.paint.width=seed.paint.height=0;}
  return group;
 }
 private retainMixCuts(group:MixGroup,seed:NativeMixSeed|undefined){
  const old=group.baseline.seed,oldBytes=old?old.mask.width*old.mask.height*8:0,newBytes=seed?seed.mask.width*seed.mask.height*8:0;
  if(old){old.mask.width=old.mask.height=old.paint.width=old.paint.height=0;}group.baseline.seed=undefined;this.mixGroupBytes-=oldBytes;group.bytes-=oldBytes;
  if(!seed)return false;
  if(group.bytes+newBytes>this.mixGroupBudget){seed.mask.width=seed.mask.height=seed.paint.width=seed.paint.height=0;return false;}
  group.baseline.seed=seed;group.bytes+=newBytes;this.mixGroupBytes+=newBytes;
  while(this.mixGroupBytes>this.mixGroupBudget){const id=this.mixGroups.keys().next().value!,entry=this.mixGroups.get(id)!;this.mixGroups.delete(id);this.mixGroupBytes-=entry.bytes;entry.sharp.width=entry.sharp.height=0;const seed=entry.baseline.seed;if(seed)seed.mask.width=seed.mask.height=seed.paint.width=seed.paint.height=0;}
  return true;
 }
 /** Compare the entire last native group against its stable sharp base. This
  * also restores sharp ink when later Mix passes undo an earlier pixel change. */
 mixBaseline(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer):BlendBaseline|undefined{
  let end=0;for(let i=layer.operations.length-1;i>=0;i--)if(layer.operations[i].kind!=='stroke'||!clean(layer.operations[i] as Stroke)){end=i+1;break;}
  this.paintRegion(ctx,layer,p,end,undefined,undefined,renderer,false);
  const m=ctx.getTransform(),matrix=[m.a,m.b,m.c,m.d,m.e,m.f],old=this.mixGroups.get(layer.id),same=old&&old.renderer===renderer&&old.revision===renderer.displayRevision&&old.width===ctx.canvas.width&&old.height===ctx.canvas.height&&old.frameWidth===p.width&&old.frameHeight===p.height&&old.operations.length===layer.operations.length&&old.operations.every((op,i)=>op===layer.operations[i])&&matrix.every((v,i)=>v===old.matrix[i]);
  const rebase=this.mixRebase.get(layer.id);this.mixRebase.delete(layer.id);if(rebase?.project===p.id&&rebase.operations===layer.operations)return this.rememberMixGroup(layer,p,renderer,m,this.surface!,renderer.prefixSnapshot(layer,p),{x:0,y:0,width:0,height:0})?.baseline;
  if(same){this.mixGroups.delete(layer.id);this.mixGroups.set(layer.id,old);return old.baseline;}
  if(old){this.mixGroups.delete(layer.id);this.mixGroupBytes-=old.bytes;old.sharp.width=old.sharp.height=0;const seed=old.baseline.seed;if(seed)seed.mask.width=seed.mask.height=seed.paint.width=seed.paint.height=0;}
  if(!layer.operations.length||clean(layer.operations.at(-1) as Stroke))return this.rememberMixGroup(layer,p,renderer,m,this.surface!,renderer.prefixSnapshot(layer,p),{x:0,y:0,width:0,height:0})?.baseline;
  const out=this.surface!.getContext('2d')!;out.resetTransform();out.clearRect(0,0,this.surface!.width,this.surface!.height);this.paintPrefix(out,layer,p,end,renderer,m,this.surface!.width,this.surface!.height);
  return this.mixGroups.get(layer.id)?.baseline;
 }
 /** A committed native stroke already has a sharp, worker-updated view.
  * Keep that view while finalizing, then promote it without replaying old paint. */
 private presentCommittedMix(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer,present=true){
  const n=this.nativePreview,entry=this.layers.get(layer.id),key=entry?.key,last=layer.operations.at(-1);
  if(!n||!n.group||!n.group.sharp.width||!key||key!==n.base||!last||last.kind!=='stroke'||last.id!==n.stroke||layer.operations.length!==key.operations.length+1||!key.operations.every((op,i)=>op===layer.operations[i]))return false;
  const m=ctx.getTransform(),matrix=[m.a,m.b,m.c,m.d,m.e,m.f];
  if(key.renderer!==renderer||key.width!==ctx.canvas.width||key.height!==ctx.canvas.height||key.frameWidth!==p.width||key.frameHeight!==p.height||!matrix.every((v,i)=>v===key.matrix[i]))return false;
  const previous={...layer,operations:key.operations};
  if(!this.paintNativePreview(ctx,previous,p,renderer,last,n.result,finalGeometry(last),n.delta,present))return false;
  if(n.delta.final){
   const sharp=this.preview!,scratch=this.surface!;this.rememberMixView(previous,layer,p,renderer,m,scratch,sharp);
   this.key={...key,operations:layer.operations,firstClean:layer.operations.length,rendererRevision:renderer.displayRevision};this.surface=sharp;this.preview=scratch;
   this.layers.set(layer.id,{key:this.key,surface:sharp});n.group.operations=layer.operations;n.group.revision=renderer.displayRevision;if(n.delta.support)n.group.baseline.region=n.delta.support;const keep=n.box&&n.delta.tiles.size?this.retainMixCuts(n.group,{mask:n.cutMask,paint:n.cutPatch,box:n.box,tiles:new Map(n.delta.tiles)}):(this.retainMixCuts(n.group,undefined),false);this.clearNativePreview(!!keep);this.request();
  }
  return true;
 }
 setPendingNativeLayer(layer:Layer,p:Project){const n=this.nativePreview;if(n&&layer.operations.at(-1)?.id===n.stroke)n.target={layer,project:p.id,frame:p.animation?.activeFrameId};}
 paintPendingNative(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer){const target=this.nativePreview?.target;if(target&&target.layer.id===layer.id&&target.project===p.id&&target.frame===p.animation?.activeFrameId&&target.layer.operations.length<=layer.operations.length&&target.layer.operations.every((op,i)=>op===layer.operations[i])&&this.presentCommittedMix(ctx,target.layer,p,renderer))return true;const entry=this.layers.get(layer.id),key=entry?.key,m=ctx.getTransform();if(!entry||!key||key.renderer!==renderer||key.width!==ctx.canvas.width||key.height!==ctx.canvas.height||key.frameWidth!==p.width||key.frameHeight!==p.height||![m.a,m.b,m.c,m.d,m.e,m.f].every((v,i)=>v===key.matrix[i])||key.operations.length>layer.operations.length||!key.operations.every((op,i)=>op===layer.operations[i]))return false;ctx.save();ctx.resetTransform();ctx.globalAlpha=layer.opacity;ctx.drawImage(entry.surface,0,0);ctx.restore();return true;}
 finishNativePreview(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer){this.presentCommittedMix(ctx,layer,p,renderer,false);}
 paint(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,live?:Stroke,geometry?:Geometry,renderer?:LayerRenderer):boolean{
  if(!live&&renderer&&this.presentCommittedMix(ctx,layer,p,renderer))return true;
  const m=ctx.getTransform(),scale=Math.hypot(m.a,m.b);
  if(!ctx.canvas.width||!ctx.canvas.height||!Number.isFinite(scale)||scale<=0||!layer.operations.length&&!live||live&&!clean(live))return false;
  let firstClean=0;
  for(let i=layer.operations.length-1;i>=0;i--){const op=layer.operations[i];if(op.kind!=='stroke'||!clean(op)){firstClean=i+1;break;}}
  if(firstClean===layer.operations.length&&!live&&!layer.operations.some(op=>op.kind==='stroke'&&clean(op))||firstClean&&!renderer)return false;
  this.paintRegion(ctx,layer,p,firstClean,live,geometry,renderer);return true;
 }
 /** Apply a live native paint result only where it changes the sharp layer.
  * Restoring its dirty footprint avoids a whole-layer sharp/blur switch. */
 private clearNativePreview(keepCuts=false){const n=this.nativePreview;if(n&&!keepCuts)for(const c of [n.cutMask,n.cutPatch])c.width=c.height=0;this.nativePreview=undefined;this.nativeFallback=undefined;}
 paintNativePreview(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer,live:Stroke,result:HTMLCanvasElement,geometry?:Geometry,delta?:BlendDelta,present=true,paintMask?:HTMLCanvasElement){
  if(!delta)return this.paintNativeFallback(ctx,layer,p,renderer,live,result,geometry,paintMask);
  if(clean(live)||!layer.operations.some(op=>op.kind==='stroke'&&clean(op)))return false;
  let end=0;for(let i=layer.operations.length-1;i>=0;i--)if(layer.operations[i].kind!=='stroke'||!clean(layer.operations[i] as Stroke)){end=i+1;break;}
  const m=ctx.getTransform(),w=ctx.canvas.width,h=ctx.canvas.height;this.paintRegion(ctx,layer,p,end,undefined,undefined,renderer,false);
  const preview=this.preview??=document.createElement('canvas'),old=this.nativePreview;
  const same=!!old&&old.base===this.key&&old.stroke===live.id&&old.result===result&&old.delta===delta&&preview.width===w&&preview.height===h;
  if(preview.width!==w)preview.width=w;if(preview.height!==h)preview.height=h;
  if(!same){this.clearNativePreview();this.nativePreview={base:this.key!,stroke:live.id,result,delta,cutMask:document.createElement('canvas'),cutPatch:document.createElement('canvas'),revision:-1};}
  const n=this.nativePreview!;
  const candidate=this.mixGroups.get(layer.id);n.group=candidate?.baseline===delta.group?candidate:undefined;
  const seed=n.group?.baseline.seed;
  if(seed&&n.revision===-1&&!n.box){
   for(const [cut,source]of [[n.cutMask,seed.mask],[n.cutPatch,seed.paint]]){cut.width=source.width;cut.height=source.height;cut.getContext('2d',{willReadFrequently:true})!.drawImage(source,0,0);}
   n.box={...seed.box};
  }
  if(n.revision!==delta.revision){
   let left=p.width,top=p.height,right=0,bottom=0;for(const b of delta.tiles.values()){left=Math.min(left,b.x);top=Math.min(top,b.y);right=Math.max(right,b.x+b.w);bottom=Math.max(bottom,b.y+b.h);}
   const W=right-left,H=bottom-top,box=delta.tiles.size?{x:left,y:top,w:W,h:H}:undefined,oldBox=n.box;
   const sameBox=!!box&&!!oldBox&&box.x===oldBox.x&&box.y===oldBox.y&&box.w===oldBox.w&&box.h===oldBox.h;
   const expand=(b:Box|undefined,pad=2)=>b?{x:Math.max(0,b.x-pad),y:Math.max(0,b.y-pad),w:Math.min(w,b.x+b.w+pad)-Math.max(0,b.x-pad),h:Math.min(h,b.y+b.h+pad)-Math.max(0,b.y-pad)}:undefined;
   const rect=box?expand(this.screenBounds(live,box,m,w,h)):undefined;
   const partial=same&&sameBox&&!!delta.dirty&&delta.revision>0&&!delta.final,dirty=delta.dirty;
   const clip=partial&&dirty?expand(this.screenBounds(live,{x:dirty.x,y:dirty.y,w:dirty.width,h:dirty.height},m,w,h),4):undefined;
   const pc=preview.getContext('2d')!;pc.resetTransform();pc.globalAlpha=1;pc.globalCompositeOperation='source-over';const stable=n.group?.sharp??this.surface!;
   if(!delta.revision){
    pc.clearRect(0,0,w,h);pc.drawImage(this.surface!,0,0);
    const region=n.group?.baseline.region;n.rect=rect??(region&&region.width&&region.height?expand(this.screenBounds(live,{x:region.x,y:region.y,w:region.width,h:region.height},m,w,h)):undefined);
   }else{
    if(!same||delta.final){pc.clearRect(0,0,w,h);pc.drawImage(stable,0,0);}
    else if(partial){if(clip){pc.clearRect(clip.x,clip.y,clip.w,clip.h);pc.drawImage(stable,clip.x,clip.y,clip.w,clip.h,clip.x,clip.y,clip.w,clip.h);}}
    else if(rect||n.rect){const a=rect??n.rect!,b=n.rect??a,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),W=Math.max(a.x+a.w,b.x+b.w)-x,H=Math.max(a.y+a.h,b.y+b.h)-y;pc.clearRect(x,y,W,H);pc.drawImage(stable,x,y,W,H,x,y,W,H);}
    if(box){
     for(const [cut,source]of [[n.cutMask,delta.mask],[n.cutPatch,delta.patch]]){
      const cc=cut.getContext('2d',{willReadFrequently:true})!;
      if(!sameBox||cut.width!==W||cut.height!==H||!dirty){if(cut.width!==W)cut.width=W;if(cut.height!==H)cut.height=H;cc.clearRect(0,0,W,H);cc.drawImage(source,left,top,W,H,0,0,W,H);}
      else{const x=Math.max(left,dirty.x),y=Math.max(top,dirty.y),right=Math.min(left+W,dirty.x+dirty.width),bottom=Math.min(top+H,dirty.y+dirty.height);if(right>x&&bottom>y){cc.clearRect(x-left,y-top,right-x,bottom-y);cc.drawImage(source,x,y,right-x,bottom-y,x-left,y-top,right-x,bottom-y);}}
     }
     if(!partial||clip){pc.save();if(partial&&clip){pc.beginPath();pc.rect(clip.x,clip.y,clip.w,clip.h);pc.clip();}pc.setTransform(m);pc.globalAlpha=1;pc.imageSmoothingEnabled=Math.hypot(m.a,m.b)<=1+1e-7;pc.imageSmoothingQuality='high';pc.globalCompositeOperation='destination-out';pc.drawImage(n.cutMask,left,top);pc.globalCompositeOperation='source-over';pc.drawImage(n.cutPatch,left,top);pc.restore();}
    }
    n.box=box;n.rect=rect;
   }
   delta.dirty=undefined;n.revision=delta.revision;
  }
  this.liveKey=undefined;if(present){ctx.save();ctx.resetTransform();ctx.globalAlpha=layer.opacity;ctx.drawImage(preview,0,0);ctx.restore();}return true;
 }
 private paintNativeFallback(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer,live:Stroke,result:HTMLCanvasElement,geometry?:Geometry,paintMask?:HTMLCanvasElement){
  if(clean(live)||!layer.operations.some(op=>op.kind==='stroke'&&clean(op)))return false;
  let end=0;for(let i=layer.operations.length-1;i>=0;i--)if(layer.operations[i].kind!=='stroke'||!clean(layer.operations[i] as Stroke)){end=i+1;break;}
  const m=ctx.getTransform(),w=ctx.canvas.width,h=ctx.canvas.height;this.paintRegion(ctx,layer,p,end,undefined,undefined,renderer,false);
  const b=strokeRasterBounds(live,p.width,p.height,geometry),rect=this.screenBounds(live,{x:b.x,y:b.y,w:b.width,h:b.height},m,w,h),old=this.nativeFallback,preview=this.preview??=document.createElement('canvas');if(preview.width!==w)preview.width=w;if(preview.height!==h)preview.height=h;const pc=preview.getContext('2d')!;pc.resetTransform();pc.globalAlpha=1;pc.globalCompositeOperation='source-over';
  let restore=old&&old.base===this.key&&old.stroke===live.id?rect:undefined;
  if(restore&&old?.rect){const x=Math.min(restore.x,old.rect.x),y=Math.min(restore.y,old.rect.y);restore={x,y,w:Math.max(restore.x+restore.w,old.rect.x+old.rect.w)-x,h:Math.max(restore.y+restore.h,old.rect.y+old.rect.h)-y};}
  if(restore){pc.clearRect(restore.x,restore.y,restore.w,restore.h);pc.drawImage(this.surface!,restore.x,restore.y,restore.w,restore.h,restore.x,restore.y,restore.w,restore.h);}else{pc.clearRect(0,0,w,h);pc.drawImage(this.surface!,0,0);}
  const direct=paintMask&&!live.nativeMixVersion&&live.brushTip!=='color-blender'&&(live.tool==='eraser'||live.watercolorEngine!==1||!live.watercolorMode||live.watercolorMode==='glaze');
  if(direct){pc.save();pc.setTransform(m);pc.globalAlpha=live.opacity;pc.globalCompositeOperation=live.tool==='eraser'?'destination-out':'source-over';pc.drawImage(paintMask,0,0);pc.restore();}
  else if(b.width&&b.height){const baseline=renderer.getDisplay(layer,p);if(baseline!==result){const before=baseline.getContext('2d')!.getImageData(b.x,b.y,b.width,b.height).data,after=result.getContext('2d')!.getImageData(b.x,b.y,b.width,b.height).data;this.nativePatch(pc,before,after,b.x,b.y,b.width,b.height,m);}}
  this.nativeFallback={base:this.key!,stroke:live.id,rect};this.liveKey=undefined;ctx.save();ctx.resetTransform();ctx.globalAlpha=layer.opacity;ctx.drawImage(preview,0,0);ctx.restore();return true;
 }
 baseReady(layer:Layer,p:Project,matrix:number[],width:number,height:number,renderer:LayerRenderer){const key=this.layers.get(layer.id)?.key;return !!key&&key.operations===layer.operations&&key.frameWidth===p.width&&key.frameHeight===p.height&&key.width===width&&key.height===height&&key.renderer===renderer&&key.rendererRevision===(key.firstClean?renderer.displayRevision:0)&&matrix.every((v,i)=>v===key.matrix[i]);}
 /** Prepare the existing native paint prefix before the first clean-ink
  * contact. This creates no provisional stroke and does not change artwork. */
 primeBase(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,renderer:LayerRenderer){
  let firstClean=0;for(let i=layer.operations.length-1;i>=0;i--){const op=layer.operations[i];if(op.kind!=='stroke'||!clean(op)){firstClean=i+1;break;}}
  this.paintRegion(ctx,layer,p,firstClean,undefined,undefined,renderer,false);
 }
 /** Borrow only until the next paint; callers retaining pixels must copy. */
 cachedSurface(layer:string){return this.layers.get(layer)?.surface;}
 private paintStrokes(out:CanvasRenderingContext2D,strokes:Stroke[],m:DOMMatrix,w:number,h:number,live?:Stroke,geometry?:Geometry){
  const scale=Math.hypot(m.a,m.b);
   for(const s of strokes){
    if(s.opacity===0)continue;
    if(!native(s)&&s.flatNibVersion!==1&&!s.transform&&!s.perspective&&(s===live||this.solidLive.matches(s))){const direct=s.tool==='brush'&&s.opacity===1,picture=this.solidLive.paint(s,s===live&&geometry?geometry:finalGeometry(s),m,w,h,direct?out.canvas:undefined,direct?{}:undefined);this.rememberLivePaths(s,this.solidLive.lastPaths,s===live);out.resetTransform();out.globalAlpha=s.opacity;out.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';if(direct)out.clearRect(0,0,w,h);out.drawImage(picture,0,0);continue;}
    if(s.flatNibVersion===1&&!s.transform&&!s.perspective&&(s===live||this.flatLive.matches(s))){const picture=this.flatLive.paint(s,s===live&&geometry?geometry:finalGeometry(s),m,w,h);if(s!==live&&this.flatLive.lastPaths){const prepared=this.prepare(s),paths=this.flatLive.lastPaths;if(this.prepared.get(s)===prepared&&paths.items.length<=2048){this.pathBatches-=prepared.paths?.items.length??0;prepared.paths=paths;this.pathBatches+=paths.items.length;this.trim();}}out.resetTransform();out.globalAlpha=s.opacity;out.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';out.drawImage(picture,0,0);continue;}
    const prepared=this.prepare(s,s===live?geometry:undefined,s!==live),rect=this.screenBounds(s,prepared.bounds,m,w,h);if(!rect)continue;
    // Opaque paint is associative source-over. A native stroke is one Canvas
    // operation, so it can also apply its opacity/eraser directly to this layer.
    if(native(s)||s.tool==='brush'&&s.opacity===1){
     out.setTransform(m);out.globalAlpha=s.opacity;out.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';this.draw(out,s,prepared,scale);out.resetTransform();continue;
    }
    const scratch=this.scratch??=document.createElement('canvas');const W=Math.min(w-rect.x,Math.ceil(rect.w/64)*64),H=Math.min(h-rect.y,Math.ceil(rect.h/64)*64);if(scratch.width<W||scratch.height<H||scratch.width>w-rect.x||scratch.height>h-rect.y||scratch.width*scratch.height>W*H*4){scratch.width=W;scratch.height=H;}
    const sc=scratch.getContext('2d')!;sc.resetTransform();sc.clearRect(0,0,scratch.width,scratch.height);sc.setTransform(m.a,m.b,m.c,m.d,m.e-rect.x,m.f-rect.y);this.draw(sc,s,prepared,scale);
    out.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';out.globalAlpha=s.opacity;
    // Copy only this stroke's footprint, not the whole viewport per stroke.
    out.drawImage(scratch,0,0,rect.w,rect.h,rect.x,rect.y,rect.w,rect.h);
   }
  out.resetTransform();out.globalAlpha=1;out.globalCompositeOperation='source-over';
 }
 private rememberLivePaths(s:Stroke,paths:{scale:number;items:Path2D[]}|undefined,live:boolean){if(live||!paths)return;const prepared=this.prepare(s);if(this.prepared.get(s)===prepared&&paths.items.length<=2048){this.pathBatches-=prepared.paths?.items.length??0;prepared.paths=paths;this.pathBatches+=paths.items.length;this.trim();}}
 private failPending(){
  const job=this.pending;if(!job)return;clearTimeout(job.timer);job.base.width=job.base.height=0;this.pending=undefined;this.worker?.terminate();this.worker=undefined;
  const entry=this.layers.get(job.layer);if(entry){entry.surface.width=entry.surface.height=0;this.layers.delete(job.layer);}this.lastLive=undefined;this.request();
 }
 private finishPending(data:{token:number;bitmap?:ImageBitmap;error?:string}){
  const job=this.pending;if(!job||data.token!==job.token){data.bitmap?.close();return;}if(data.error||!data.bitmap){this.failPending();return;}
  clearTimeout(job.timer);this.pending=undefined;const entry=this.layers.get(job.layer),key=entry?.key;
  // History edits, a new document or a changed camera must never receive an
  // obsolete preview. Later strokes can append to this verified prefix.
  if(entry&&key&&key.width===job.key.width&&key.height===job.key.height&&key.frameWidth===job.key.frameWidth&&key.frameHeight===job.key.frameHeight&&key.firstClean===job.key.firstClean&&key.renderer===job.key.renderer&&key.rendererRevision===job.key.rendererRevision&&key.matrix.every((n,i)=>n===job.key.matrix[i])&&job.operations.length<=key.operations.length&&job.operations.every((op,i)=>op===key.operations[i])){
   const ctx=entry.surface.getContext('2d')!;ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,entry.surface.width,entry.surface.height);ctx.drawImage(data.bitmap,0,0);entry.key={...key,operations:job.operations};this.request();
  }
  data.bitmap.close();
 }
 private deferFinal(layer:Layer,s:Stroke,key:Key,m:DOMMatrix,w:number,h:number){
  if(this.pending||s.points.length<160||native(s)||s.flatNibVersion===1||s.transform||s.perspective||!this.lastLive||this.lastLive.id!==s.id||this.lastLive.base!==key||w*h*4>32*1024*1024||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return false;
  try{
   const worker=this.worker??=new Worker(new URL('./inkDisplay.worker.ts',import.meta.url),{type:'module'});worker.onmessage=e=>this.finishPending(e.data);worker.onerror=()=>this.failPending();worker.onmessageerror=()=>this.failPending();
   const base=this.surface!,picture=document.createElement('canvas');picture.width=w;picture.height=h;picture.getContext('2d')!.drawImage(this.lastLive.picture,0,0);
   const snapshot=createImageBitmap(base),token=++this.serial,job:Pending={token,layer:layer.id,key,operations:layer.operations,base,timer:setTimeout(()=>this.failPending(),5000)};this.pending=job;this.surface=picture;
   // Keep the old base untouched until its bitmap snapshot has completed.
   snapshot.then(bitmap=>{if(this.pending!==job){bitmap.close();return;}base.width=base.height=0;worker.postMessage({token,stroke:s,geometry:finalGeometry(s),matrix:[m.a,m.b,m.c,m.d,m.e,m.f],width:w,height:h,base:bitmap},[bitmap]);}).catch(()=>this.failPending());return true;
  }catch{return false;}
 }
 private paintRegion(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,firstClean:number,live?:Stroke,geometry?:Geometry,renderer?:LayerRenderer,present=true){
  const m=ctx.getTransform(),scale=Math.hypot(m.a,m.b),w=ctx.canvas.width,h=ctx.canvas.height;
  const cached=this.layers.get(layer.id);this.key=cached?.key;this.surface=cached?.surface;
  const matrix=[m.a,m.b,m.c,m.d,m.e,m.f],key=this.key;
  const sameView=!!key&&key.width===w&&key.height===h&&key.frameWidth===p.width&&key.frameHeight===p.height&&key.renderer===renderer&&key.rendererRevision===(firstClean?renderer?.displayRevision:0)&&matrix.every((n,i)=>n===key.matrix[i]);
  if(!sameView||key!.operations!==layer.operations){
   const surface=this.surface??=document.createElement('canvas');if(surface.width!==w)surface.width=w;if(surface.height!==h)surface.height=h;
   const out=surface.getContext('2d')!;out.resetTransform();out.globalAlpha=1;out.globalCompositeOperation='source-over';
   const append=sameView&&key!.firstClean===firstClean&&key!.operations.length<=layer.operations.length&&key!.operations.every((op,i)=>op===layer.operations[i]);
   const restored=sameView&&!!renderer&&this.restoreMixView(out,key!,layer,p,renderer);
   if(!restored){
   if(!append){out.clearRect(0,0,w,h);if(firstClean&&renderer)this.paintPrefix(out,layer,p,firstClean,renderer,m,w,h);out.resetTransform();}
   const added=append?layer.operations.slice(key!.operations.length):[],last=added[0];
   const deferred=added.length===1&&last.kind==='stroke'&&this.deferFinal(layer,last,key!,m,w,h);
   if(!deferred)this.paintStrokes(out,layer.operations.slice(append?key!.operations.length:firstClean) as Stroke[],m,w,h);
   }
   this.key={operations:layer.operations,matrix,firstClean,width:w,height:h,frameWidth:p.width,frameHeight:p.height,renderer,rendererRevision:firstClean?renderer?.displayRevision:0};
  }
  const entry=cached&&cached.key===this.key&&cached.surface===this.surface?cached:{key:this.key!,surface:this.surface!};
  this.layers.delete(layer.id);this.layers.set(layer.id,entry);
  let bytes=0;for(const entry of this.layers.values())bytes+=entry.surface.width*entry.surface.height*4;
  while(this.layers.size>8||this.layers.size>1&&bytes>64*1024*1024){const oldest=this.layers.keys().next().value!,entry=this.layers.get(oldest)!;bytes-=entry.surface.width*entry.surface.height*4;entry.surface.width=entry.surface.height=0;this.layers.delete(oldest);}
  let picture=this.surface!;
  if(live){
   const direct=!native(live)&&live.flatNibVersion!==1&&!live.transform&&!live.perspective&&live.tool==='brush'&&live.opacity===1;
   if(direct){this.flatLive.clear();picture=this.solidLive.paint(live,geometry??finalGeometry(live),m,w,h,this.surface,this.key);this.liveKey=undefined;}
   else{
   const previous=this.liveKey;
   if(!previous||previous.base!==this.key||previous.stroke!==live||previous.geometry!==geometry){
    const preview=this.preview??=document.createElement('canvas');if(preview.width!==w)preview.width=w;if(preview.height!==h)preview.height=h;
    const pc=preview.getContext('2d')!;pc.resetTransform();pc.globalAlpha=1;pc.globalCompositeOperation='source-over';
    if(!native(live)&&!live.transform&&!live.perspective){
     const raster=live.flatNibVersion===1?this.flatLive:this.solidLive;if(live.flatNibVersion===1)this.solidLive.clear();else this.flatLive.clear();
     const picture=raster.paint(live,geometry??finalGeometry(live),m,w,h),rect=previous&&previous.base===this.key&&previous.stroke===live?raster.lastRegion:undefined;
     const x=rect?.x??0,y=rect?.y??0,W=rect?.w??w,H=rect?.h??h;
     if(W&&H){pc.clearRect(x,y,W,H);pc.drawImage(this.surface!,x,y,W,H,x,y,W,H);pc.globalAlpha=live.opacity;pc.globalCompositeOperation=live.tool==='eraser'?'destination-out':'source-over';pc.drawImage(picture,x,y,W,H,x,y,W,H);}
     pc.globalAlpha=1;pc.globalCompositeOperation='source-over';
    }else{pc.clearRect(0,0,w,h);pc.drawImage(this.surface!,0,0);this.paintStrokes(pc,[live],m,w,h,live,geometry);}
    this.liveKey={base:this.key!,stroke:live,geometry};
   }
   picture=this.preview!;
   }
   this.lastLive={id:live.id,base:this.key!,picture};
  }
  if(present){ctx.save();ctx.resetTransform();ctx.globalAlpha=layer.opacity;ctx.globalCompositeOperation=blendOperation(layer.blend);ctx.drawImage(picture,0,0);ctx.restore();}
 }
}
