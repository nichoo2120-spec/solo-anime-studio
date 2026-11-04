import type {Layer,Stroke,Project} from '../core/model';
import {finalGeometry} from './geometryCache';
import {blendOperation,type LayerRenderer} from './renderer';
import {drawSolidInkV10} from './solidInkV10';
import {drawFlatInk} from './flatInk';
import {FlatLiveRaster} from './FlatLiveRaster';
import {SolidLiveRaster} from './SolidLiveRaster';
import type {strokeGeometry} from './strokeGeometry';

type Geometry=ReturnType<typeof strokeGeometry>;
type Box={x:number;y:number;w:number;h:number};
type Prepared={geometry:Geometry;bounds:Box;weight:number;nativePath?:{path:Path2D;dot:boolean};paths?:{scale:number;items:Path2D[]}};
type Key={operations:Layer['operations'];matrix:number[];firstClean:number;width:number;height:number;frameWidth:number;frameHeight:number;renderer?:LayerRenderer;rendererRevision?:number};
type Pending={token:number;layer:string;key:Key;operations:Layer['operations'];base:HTMLCanvasElement;timer:ReturnType<typeof setTimeout>};
type ViewPending={token:number;layer:string;key:Key;base?:Key;timer:ReturnType<typeof setTimeout>};
export const displayCleanInk=(s:Stroke)=>!s.nativeMixVersion&&!s.mixStops&&!s.paintTipVersion&&!s.perspective&&!s.textureStrength&&!(s.pressure&&s.pressureOpacity)&&(
 !!s.engineVersion&&['technical','eraser-hard','g-pen','mapping','brush-pen'].includes(s.brushKind??'technical')||s.flatNibVersion===1
);
const native=(s:Stroke)=>!s.pressureOpacity&&!s.taperStart&&!s.taperEnd&&!(s.pressure&&s.pressureWidth!==false)&&!s.velocityTaper&&['technical','eraser-hard'].includes(s.brushKind??'technical');
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
  this.navigationGeneration++;this.navigationWorker?.terminate();this.navigationWorker=undefined;this.navigationStates.clear();for(const job of this.navigationJobs.values()){clearTimeout(job.timer);job.finish({error:"Navigation cancelled"});}this.navigationJobs.clear();
  this.viewSerial++;this.viewWorker?.terminate();this.viewWorker=undefined;if(this.viewPending)clearTimeout(this.viewPending.timer);this.viewPending=undefined;this.viewFailed=false;
  this.serial++;this.worker?.terminate();this.worker=undefined;if(this.pending){clearTimeout(this.pending.timer);this.pending.base.width=this.pending.base.height=0;}this.pending=undefined;this.lastLive=undefined;
  this.flatLive.clear();
  this.solidLive.clear();
  for(const c of [this.surface,this.scratch,this.preview,...[...this.layers.values()].map(v=>v.surface),...[...this.prefixes.values()].map(v=>v.canvas)])if(c)c.width=c.height=0;
  this.prefixes.clear();
  this.layers.clear();
  this.surface=this.scratch=this.preview=undefined;this.key=undefined;this.liveKey=undefined;this.prepared.clear();this.preparedWeight=0;this.pathBatches=0;
 }
 private prepare(s:Stroke,liveGeometry?:Geometry,cache=true):Prepared{
  const cached=cache&&!liveGeometry&&this.prepared.get(s);
  if(cached){this.prepared.delete(s);this.prepared.set(s,cached);return cached;}
  const geometry=liveGeometry??finalGeometry(s);let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  const visit=(p:{x:number;y:number})=>{x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);};
  geometry.points.forEach(visit);for(const c of geometry.cubics){visit(c.a);visit(c.c1);visit(c.c2);visit(c.b);}
  const pad=s.size*Math.max(1,s.maxSize??1)+2;
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
   let x=ox,y=oy;if(s.transform){const [a,b,c,d,e,f]=s.transform;const X=a*x+c*y+e;y=b*x+d*y+f;x=X;}
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
  const operations=end===layer.operations.length?layer.operations:layer.operations.slice(0,end),source=renderer.getDisplay({...layer,operations},p),bytes=p.width*p.height*4;
  if(bytes>32*1024*1024)return source;
  if(cached){cached.canvas.width=cached.canvas.height=0;this.prefixes.delete(layer.id);}
  let total=bytes;for(const item of this.prefixes.values())total+=item.canvas.width*item.canvas.height*4;
  while(this.prefixes.size&&(this.prefixes.size>=4||total>32*1024*1024)){const id=this.prefixes.keys().next().value!,old=this.prefixes.get(id)!;total-=old.canvas.width*old.canvas.height*4;old.canvas.width=old.canvas.height=0;this.prefixes.delete(id);}
  const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;canvas.getContext('2d')!.drawImage(source,0,0);this.prefixes.set(layer.id,{operations,canvas,renderer,revision:renderer.displayRevision});return canvas;
 }
 private draw(ctx:CanvasRenderingContext2D,s:Stroke,p:Prepared,scale:number){
  const g=p.geometry;if(!g.points.length)return;
  ctx.save();if(s.transform)ctx.transform(...s.transform);
  if(native(s)){
   if(!p.nativePath){const path=new Path2D(),dot=!g.cubics.length;if(dot)path.arc(g.points[0].x,g.points[0].y,s.size/2,0,Math.PI*2);else{path.moveTo(g.points[0].x,g.points[0].y);for(const c of g.cubics)path.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.b.x,c.b.y);}p.nativePath={path,dot};}
   if(p.nativePath.dot){ctx.fillStyle=s.color;ctx.fill(p.nativePath.path);}else{ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(p.nativePath.path);}
  }else{
   // Round sampling density upward: paths remain at least display-resolution,
   // and wheel/pan frames within that range can reuse the exact same contour.
   const quality=Math.max(1,Math.ceil(scale*2-1e-6)/2);
   let paths=p.paths?.scale===quality?p.paths.items:undefined;
   if(!paths){paths=[];if(s.flatNibVersion===1)drawFlatInk(ctx,s,g,undefined,quality,paths);else drawSolidInkV10(ctx,s,g,undefined,quality,paths);
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
  let firstClean=0;for(let i=layer.operations.length-1;i>=0;i--){const op=layer.operations[i];if(op.kind!=='stroke'||!clean(op)){firstClean=i+1;break;}}if(firstClean===layer.operations.length)return true;
  const m=ctx.getTransform(),matrix=[m.a,m.b,m.c,m.d,m.e,m.f],w=ctx.canvas.width,h=ctx.canvas.height,cached=this.layers.get(layer.id),key:Key={operations:layer.operations,matrix,firstClean,width:w,height:h,frameWidth:p.width,frameHeight:p.height,renderer,rendererRevision:firstClean?renderer.displayRevision:0};
  if(cached&&cached.key.operations===key.operations&&cached.key.renderer===renderer&&cached.key.rendererRevision===key.rendererRevision&&cached.key.width===w&&cached.key.height===h&&cached.key.frameWidth===p.width&&cached.key.frameHeight===p.height&&cached.key.matrix.every((v,i)=>v===matrix[i]))return true;
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
 paint(ctx:CanvasRenderingContext2D,layer:Layer,p:Project,live?:Stroke,geometry?:Geometry,renderer?:LayerRenderer):boolean{
  const m=ctx.getTransform(),scale=Math.hypot(m.a,m.b);
  if(!ctx.canvas.width||!ctx.canvas.height||!Number.isFinite(scale)||scale<=0||!layer.operations.length&&!live||live&&!clean(live))return false;
  let firstClean=0;
  for(let i=layer.operations.length-1;i>=0;i--){const op=layer.operations[i];if(op.kind!=='stroke'||!clean(op)){firstClean=i+1;break;}}
  if(firstClean===layer.operations.length&&!live||firstClean&&!renderer)return false;
  this.paintRegion(ctx,layer,p,firstClean,live,geometry,renderer);return true;
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
    if(!native(s)&&s.flatNibVersion!==1&&!s.transform&&(s===live||this.solidLive.matches(s))){const direct=s.tool==='brush'&&s.opacity===1,picture=this.solidLive.paint(s,s===live&&geometry?geometry:finalGeometry(s),m,w,h,direct?out.canvas:undefined,direct?{}:undefined);this.rememberLivePaths(s,this.solidLive.lastPaths,s===live);out.resetTransform();out.globalAlpha=s.opacity;out.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';if(direct)out.clearRect(0,0,w,h);out.drawImage(picture,0,0);continue;}
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
   if(!append){out.clearRect(0,0,w,h);if(firstClean&&renderer){out.setTransform(m);out.imageSmoothingEnabled=scale<=1+1e-7;out.imageSmoothingQuality='high';out.drawImage(this.prefix(layer,p,firstClean,renderer),0,0);out.resetTransform();}}
   const added=append?layer.operations.slice(key!.operations.length):[],last=added[0];
   const deferred=added.length===1&&last.kind==='stroke'&&this.deferFinal(layer,last,key!,m,w,h);
   if(!deferred)this.paintStrokes(out,layer.operations.slice(append?key!.operations.length:firstClean) as Stroke[],m,w,h);
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
