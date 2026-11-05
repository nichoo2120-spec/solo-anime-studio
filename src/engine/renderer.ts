import {cameraAt,cameraMatrix,layerDepth} from '../animation/sceneCamera';
import {originalShotArtwork,shotFrame,type ShotFrame} from '../core/shotFrame';
import {HistoryTiles} from './HistoryTiles';
import {dryRasterPadding} from '../core/dryBrush';
import {resetDryBristleV3MixModel} from './dryBristleV3';
import {compositePaintStroke,strokeRasterBounds} from './paintCompositing';
import type {Layer,Point,Project,Stroke,Matrix} from '../core/model';
import {pressureWidth} from '../core/geometry';
import type {strokeGeometry} from './strokeGeometry';
import {drawModernStroke} from './brushRaster';
import {drawVector} from './vector';
import {finalGeometry} from './geometryCache';
import {mapPoint,scaleOf} from './strokeSelection';
import {projectPoint} from './perspectiveWarp';
import {flattenCubic} from './strokeGeometry';
export const makeCanvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
export const context=(c:HTMLCanvasElement)=>c.getContext('2d',{willReadFrequently:true})!;
export const blendOperation=(mode:Layer['blend']):GlobalCompositeOperation=>mode==='add'?'lighter':mode&&mode!=='normal'?mode:'source-over';
type HistoryDelta={id:string;prefix:Layer['operations'];operation:Layer['operations'][number];patch:HistoryTiles;width:number;height:number;bytes:number};
const releaseRaster=(c:HTMLCanvasElement|ImageBitmap)=>{if('close' in c)c.close();else c.width=c.height=0;};
export type ExportOptions={transparent?:boolean;width?:number;height?:number;layerId?:string;includeReferences?:boolean;/** v174: 1-based exposure number; render through the scene camera. */cameraFrame?:number};
let reflectedSurface:HTMLCanvasElement|undefined;
let vectorSurface:HTMLCanvasElement|undefined;
/** Isolate opacity/blend per layer, not per vector line. Rasterize at display pixels. */
export function paintVectorLayer(ctx:CanvasRenderingContext2D,layer:Layer){
 if(layer.opacity===1&&(!layer.blend||layer.blend==='normal')){for(const op of layer.operations)if(op.kind==='vector')drawVector(ctx,op);return;}
 const c=vectorSurface??=makeCanvas(ctx.canvas.width,ctx.canvas.height);if(c.width!==ctx.canvas.width)c.width=ctx.canvas.width;if(c.height!==ctx.canvas.height)c.height=ctx.canvas.height;const vc=context(c);vc.resetTransform();vc.clearRect(0,0,c.width,c.height);vc.setTransform(ctx.getTransform());for(const op of layer.operations)if(op.kind==='vector')drawVector(vc,op);ctx.save();ctx.resetTransform();ctx.globalAlpha=layer.opacity;ctx.globalCompositeOperation=blendOperation(layer.blend);ctx.drawImage(c,0,0);ctx.restore();
}
export function polygonPath(ctx:CanvasRenderingContext2D,points:Point[]){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
export function drawStroke(ctx:CanvasRenderingContext2D,s:Stroke,phase:'live'|'final'='final',geometry?:ReturnType<typeof strokeGeometry>){
 if(phase==='final'&&s.nativeMixVersion===3&&s.dryBristleVersion===3)resetDryBristleV3MixModel(s);
 if(s.rasterTransformVersion===1&&s.transform){const c=reflectedSurface??=makeCanvas(ctx.canvas.width,ctx.canvas.height);if(c.width!==ctx.canvas.width)c.width=ctx.canvas.width;if(c.height!==ctx.canvas.height)c.height=ctx.canvas.height;const cc=c.getContext('2d')!;cc.clearRect(0,0,c.width,c.height);drawStroke(cc,{...s,id:s.rasterSourceId??s.id,transform:undefined,rasterTransformVersion:undefined},phase,geometry);ctx.save();ctx.transform(...s.transform);ctx.drawImage(c,0,0);ctx.restore();return;}
 if(s.perspective){
  const g=geometry??finalGeometry(s),raw=g.cubics.length?g.cubics.flatMap((c,i)=>flattenCubic(c,1.0).slice(i?1:0)):g.points;
  const pts=raw.map(pt=>projectPoint(pt,s.perspective!));
  // Straight micro-Beziers preserve a projectively curved line, including endpoint pressure.
  const cubics=pts.slice(1).map((b,i)=>{const a=pts[i];return {a,c1:{...a,x:a.x+(b.x-a.x)/3,y:a.y+(b.y-a.y)/3},c2:{...b,x:a.x+(b.x-a.x)*2/3,y:a.y+(b.y-a.y)*2/3},b};});
  const warped={points:pts,cubics};
  drawStroke(ctx,{...s,id:s.rasterSourceId??s.id,perspective:undefined,transform:undefined,points:pts},phase,warped);return;
 }
 if(s.transform){ctx.save();ctx.transform(...s.transform);drawStroke(ctx,{...s,transform:undefined},phase,geometry);ctx.restore();return;}
 if((s.dryBristleVersion===1||s.dryBristleVersion===2||s.dryBristleVersion===3)){drawModernStroke(ctx,s,phase,geometry);return;}
 if(s.engineVersion===2||s.engineVersion===3||s.engineVersion===4||s.engineVersion===5||s.engineVersion===6||s.engineVersion===7||s.engineVersion===8||s.engineVersion===9||s.engineVersion===10){drawModernStroke(ctx,s,phase,geometry);return;}
 ctx.save();ctx.fillStyle=s.color;ctx.strokeStyle=s.color;ctx.lineCap='round';ctx.lineJoin='round';
 // Opacity is applied once when compositing this scratch surface, avoiding dark knots.
 const points=s.points;
 for(let i=0;i<points.length;i++){const p=points[i],prev=points[i-1]??p;const distance=Math.hypot(p.x-prev.x,p.y-prev.y),steps=Math.max(1,Math.ceil(distance/Math.max(.35,s.size*.12)));
  for(let j=0;j<=steps;j++){const t=j/steps,r=pressureWidth(s.size,prev.p+(p.p-prev.p)*t,s.pressure,s.response)/2;ctx.beginPath();ctx.arc(prev.x+(p.x-prev.x)*t,prev.y+(p.y-prev.y)*t,r,0,Math.PI*2);ctx.fill();}
 }
 ctx.restore();
}
export function applyTransform(canvas:HTMLCanvasElement,polygon:Point[],matrix:Matrix){
 const ctx=context(canvas),selection=makeCanvas(canvas.width,canvas.height),sc=context(selection);sc.save();polygonPath(sc,polygon);sc.clip();sc.drawImage(canvas,0,0);sc.restore();
 ctx.save();ctx.globalCompositeOperation='destination-out';polygonPath(ctx,polygon);ctx.fill();ctx.restore();
 ctx.save();ctx.transform(...matrix);ctx.drawImage(selection,0,0);ctx.restore();
}
export class LayerRenderer {
 displayRevision=0;
 private pendingLayer?:{layer:Layer;project:Project;stroke:Stroke;base:HTMLCanvasElement;preview:HTMLCanvasElement;done:Promise<HTMLCanvasElement|undefined>};
 private finalWorker?:Worker;private finalSerial=0;
 private pendingFinal?:{token:number;stroke:Stroke;layer:string;width:number;height:number;preview:LayerRenderer;request:()=>void;done:Promise<void>;resolve:()=>void;timer:ReturnType<typeof setTimeout>};
 private scratch?:HTMLCanvasElement;private caches=new Map<string,{layer:Layer;canvas:HTMLCanvasElement;frame?:string}>();private bitmaps=new Map<string,HTMLImageElement>();
 private celRasters:{layer:Layer;canvas:HTMLCanvasElement}[]=[];
 private celRasterBytes=0;
 private readonly celRasterBudget=96*1024*1024;
 private releaseCelRaster(index:number){
  const [entry]=this.celRasters.splice(index,1);
  this.celRasterBytes-=entry.canvas.width*entry.canvas.height*4;
  return entry;
 }
 private parkCelRaster(entry:{layer:Layer;canvas:HTMLCanvasElement}){
  const bytes=entry.canvas.width*entry.canvas.height*4;
  if(!entry.layer.operations.length||bytes>this.celRasterBudget)return;
  while(this.celRasterBytes+bytes>this.celRasterBudget){
   const {canvas}=this.releaseCelRaster(0);canvas.width=canvas.height=0;
  }
  this.celRasters.push(entry);this.celRasterBytes+=bytes;
 }
 private strokeRasters=new Map<Stroke,{canvas:HTMLCanvasElement|ImageBitmap;bytes:number;width:number;height:number;x:number;y:number}>();private strokeBytes=0;
 /** Accept the exact final scratch pixels, avoiding an immediate second render
  * of a long paint stroke on release. This shares the existing cache budget. */
 rememberStrokeRaster(stroke:Stroke,source:HTMLCanvasElement){
  const {x,y,width:w,height:h}=strokeRasterBounds(stroke,source.width,source.height),bytes=w*h*4;if(!bytes||bytes>32*1024*1024)return;
  const old=this.strokeRasters.get(stroke);if(old){this.strokeBytes-=old.bytes;releaseRaster(old.canvas);this.strokeRasters.delete(stroke);}
  const canvas=makeCanvas(w,h);canvas.getContext('2d')!.drawImage(source,x,y,w,h,0,0,w,h);this.strokeRasters.set(stroke,{canvas,bytes,width:source.width,height:source.height,x,y});this.strokeBytes+=bytes;
  while(this.strokeBytes>32*1024*1024)this.dropStroke();this.trim();
 }
 private rememberStrokeBitmap(stroke:Stroke,bitmap:ImageBitmap,rect:{x:number;y:number;width:number;height:number},width:number,height:number){
  const bytes=bitmap.width*bitmap.height*4;if(bytes>32*1024*1024){bitmap.close();return;}
  const old=this.strokeRasters.get(stroke);if(old){this.strokeBytes-=old.bytes;releaseRaster(old.canvas);this.strokeRasters.delete(stroke);}
  this.strokeRasters.set(stroke,{canvas:bitmap,bytes,width,height,x:rect.x,y:rect.y});this.strokeBytes+=bytes;while(this.strokeBytes>32*1024*1024)this.dropStroke();this.trim();
 }
 private dropStroke(){const first=this.strokeRasters.keys().next().value!,entry=this.strokeRasters.get(first)!;releaseRaster(entry.canvas);this.strokeBytes-=entry.bytes;this.strokeRasters.delete(first);}
 private checkpoints:{id:string;operations:Layer['operations'];canvas:HTMLCanvasElement;bytes:number}[]=[];private checkpointBytes=0;private readonly checkpointBudget=128*1024*1024;
 private deltaLookup=new Map<Layer['operations'][number],HistoryDelta>();
 private deltas:HistoryDelta[]=[];private deltaBytes=0;
 private undoHits=0;private redoHits=0;private replayed=0;
 cacheStats(){return {checkpoints:this.checkpoints.length,checkpointBytes:this.checkpointBytes,patches:this.deltas.length,patchBytes:this.deltaBytes,strokeBytes:this.strokeBytes,totalBytes:this.checkpointBytes+this.deltaBytes+this.strokeBytes,budget:this.checkpointBudget,layers:this.caches.size,undoHits:this.undoHits,redoHits:this.redoHits,replayedOperations:this.replayed};}
 private trim(){while(this.checkpointBytes+this.deltaBytes+this.strokeBytes>this.checkpointBudget||this.deltas.length>160){if(this.checkpoints.length&&this.checkpointBytes+this.deltaBytes+this.strokeBytes>this.checkpointBudget){const old=this.checkpoints.shift()!;this.checkpointBytes-=old.bytes;old.canvas.width=0;old.canvas.height=0;}else if(this.strokeRasters.size&&this.deltas.length<=160)this.dropStroke();else{const old=this.deltas.shift()!;if(this.deltaLookup.get(old.operation)===old)this.deltaLookup.delete(old.operation);this.deltaBytes-=old.bytes;old.patch.clear();}}}
 constructor(private readonly captureHistory=true){}
 private remember(layer:Layer,canvas:HTMLCanvasElement,count:number,force=false){if(!this.captureHistory)return;const bytes=canvas.width*canvas.height*4;const interval=bytes>=4*1024*1024?24:8;if(!count||!force&&count%interval||bytes>this.checkpointBudget||this.checkpoints.some(c=>c.id===layer.id&&c.operations.length===count&&c.operations.every((o,i)=>o===layer.operations[i])))return;const copy=makeCanvas(canvas.width,canvas.height);context(copy).drawImage(canvas,0,0);this.checkpoints.push({id:layer.id,operations:layer.operations.slice(0,count),canvas:copy,bytes});this.checkpointBytes+=bytes;this.trim();}
 private beforeOperation(layer:Layer,canvas:HTMLCanvasElement,index:number){if(!this.captureHistory)return;const op=layer.operations[index];const previous=this.deltaLookup.get(op);if(previous&&previous.id===layer.id&&previous.width===canvas.width&&previous.height===canvas.height&&previous.prefix.length===index&&previous.prefix.every((o,i)=>o===layer.operations[i]))return;let rect={x:0,y:0,width:canvas.width,height:canvas.height};
  if(op.kind==='stroke'){const geometry=op.engineVersion?finalGeometry(op):{points:op.points,cubics:[]},points=[...geometry.points,...geometry.cubics.flatMap(c=>[c.c1,c.c2])],pad=(op.dryBristleVersion===1||op.dryBristleVersion===2||op.dryBristleVersion===3)?dryRasterPadding(op):op.size+4;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}if(op.transform||op.perspective){const q=[{x:minX,y:minY},{x:minX,y:maxY},{x:maxX,y:minY},{x:maxX,y:maxY}].map(p=>op.perspective?projectPoint(p,op.perspective):mapPoint(p,op.transform!));minX=Math.min(...q.map(p=>p.x));minY=Math.min(...q.map(p=>p.y));maxX=Math.max(...q.map(p=>p.x));maxY=Math.max(...q.map(p=>p.y));}const newPad=op.transform?pad*scaleOf(op.transform):pad;const x=Math.max(0,Math.min(canvas.width,Math.floor(minX-newPad))),y=Math.max(0,Math.min(canvas.height,Math.floor(minY-newPad)));rect={x,y,width:Math.max(0,Math.min(canvas.width,Math.ceil(maxX+newPad))-x),height:Math.max(0,Math.min(canvas.height,Math.ceil(maxY+newPad))-y)};}
  // Large strokes use exact tiles too. Only the total memory budget may
  // decline a patch; there is no per-stroke 4 MiB cutoff.
  const bytes=rect.width*rect.height*8;if(bytes>this.checkpointBudget)return;
  const delta:HistoryDelta={id:layer.id,prefix:layer.operations.slice(0,index),operation:op,patch:new HistoryTiles(canvas,rect),width:canvas.width,height:canvas.height,bytes};
  this.deltas.push(delta);this.deltaLookup.set(op,delta);this.deltaBytes+=bytes;this.trim();
 }
 private afterOperation(layer:Layer,canvas:HTMLCanvasElement,index:number){const d=this.deltaLookup.get(layer.operations[index]);if(d&&d.id===layer.id)d.patch.finish(canvas);}
 private historyPatch(layer:Layer,op:Layer['operations'][number],index:number,width:number,height:number){const d=this.deltaLookup.get(op);return d&&d.id===layer.id&&d.width===width&&d.height===height&&d.prefix.length===index&&d.prefix.every((o,i)=>o===layer.operations[i])?d:undefined;}
 async prepare(project:Project){
  const images=project.layers.flatMap(l=>l.operations).filter(o=>o.kind==='fill'||o.kind==='image');
  await Promise.all(images.map(async o=>{
   let image=this.bitmaps.get(o.png);
   if(!image){image=new Image();image.src=o.png;await image.decode();}
   const bounds=o.kind==='fill'&&o.inShot?shotFrame(project):project;
   if(o.kind==='fill'&&(image.width!==bounds.width||image.height!==bounds.height))throw Error('Fill bitmap dimensions do not match the project.');
   if(image.width*image.height>16777216)throw Error('Image exceeds the decode limit.');
   this.bitmaps.set(o.png,image);
  }));
 }
 clear(){this.pendingLayer=undefined;this.cancelFinal();this.finalWorker?.terminate();this.finalWorker=undefined;for(const c of this.caches.values())c.canvas.width=c.canvas.height=0;this.caches.clear();while(this.celRasters.length){const {canvas}=this.releaseCelRaster(this.celRasters.length-1);canvas.width=canvas.height=0;}if(this.scratch)this.scratch.width=this.scratch.height=0;this.scratch=undefined;this.bitmaps.clear();while(this.strokeRasters.size)this.dropStroke();for(const c of this.checkpoints){c.canvas.width=0;c.canvas.height=0;}for(const d of this.deltas)d.patch.clear();this.checkpoints=[];this.checkpointBytes=0;this.deltas=[];this.deltaLookup.clear();this.deltaBytes=0;}
 private cancelFinal(){const job=this.pendingFinal;if(job){clearTimeout(job.timer);job.preview.clear();this.pendingFinal=undefined;job.resolve();this.displayRevision++;}}
 private failedFinal(){const request=this.pendingFinal?.request;this.cancelFinal();this.finalWorker?.terminate();this.finalWorker=undefined;request?.();}
 /** A temporary renderer serves only on-screen drawing. Canonical get(), PNG
  * export, transforms and saves can never receive provisional pencil pixels. */
 getDisplay(layer:Layer,p:Project){const pending=this.pendingLayer,cached=this.caches.get(layer.id);if(pending&&pending.layer.id===layer.id&&pending.project.id===p.id&&pending.project.width===p.width&&pending.project.height===p.height&&pending.layer.operations.length===layer.operations.length&&pending.layer.operations.every((o,i)=>o===layer.operations[i])&&cached?.layer.operations!==layer.operations)return pending.preview;const job=this.pendingFinal;return job&&job.layer===layer.id&&job.width===p.width&&job.height===p.height&&layer.operations.includes(job.stroke)?job.preview.get(layer,p):this.get(layer,p);}
 /** Provisional display pixels stay separate until the worker returns a
  * complete canonical layer. Exports and synchronous get() never use them. */
 deferLayerResult(layer:Layer,p:Project,stroke:Stroke,base:HTMLCanvasElement,preview:HTMLCanvasElement,done:Promise<HTMLCanvasElement|undefined>,request:()=>void){
  const job={layer,project:p,stroke,base,preview,done};this.pendingLayer=job;
  done.then(result=>{if(this.pendingLayer===job){this.pendingLayer=undefined;if(result){const old=this.adoptLayerResult(layer,p,stroke,base,result);if(old){old.width=old.height=0;}else if(![...this.caches.values()].some(c=>c.canvas===result))result.width=result.height=0;}request();}else if(result&&![...this.caches.values()].some(c=>c.canvas===result))result.width=result.height=0;});
 }
 whenSettled(){return Promise.all([this.pendingLayer?.done,this.pendingFinal?.done]).then(()=>undefined);}
 /** A new stroke must pick up exact previous paint, never a provisional layer.
  * If an unusually slow worker is still pending, retain the synchronous path. */
 prepareForInput(p:Project){
  const pending=this.pendingLayer;this.pendingLayer=undefined;
  if(pending){const layer=p.layers.find(l=>l.id===pending.layer.id);if(layer)this.get(layer,p);}
  const pencil=this.pendingFinal;if(pencil){this.cancelFinal();const layer=p.layers.find(l=>l.id===pencil.layer);if(layer)this.get(layer,p);}
 }
 deferPencil(stroke:Stroke,live:HTMLCanvasElement,layer:Layer,p:Project,request:()=>void){
  if(this.pendingFinal||stroke.points.length<160||stroke.engineVersion!==9||!stroke.brushKind?.startsWith('graphite-')||p.width*p.height*4>32*1024*1024||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return false;
  try{
   const worker=this.finalWorker??=new Worker(new URL('./pencilFinal.worker.ts',import.meta.url),{type:'module'}),preview=new LayerRenderer(false),base=this.getDisplay(layer,p),copy=makeCanvas(p.width,p.height);copy.getContext('2d')!.drawImage(base,0,0);preview.bitmaps=new Map(this.bitmaps);preview.caches.set(layer.id,{layer,canvas:copy});preview.rememberStrokeRaster(stroke,live);
   let resolve!:()=>void;const done=new Promise<void>(r=>{resolve=r;});const token=++this.finalSerial,job={token,stroke,layer:layer.id,width:p.width,height:p.height,preview,request,done,resolve,timer:setTimeout(()=>this.failedFinal(),5000)};this.pendingFinal=job;this.displayRevision++;
   worker.onmessage=({data}:{data:{token:number;bitmap?:ImageBitmap;rect?:{x:number;y:number;width:number;height:number};error?:string}})=>{if(this.pendingFinal!==job||data.token!==token){data.bitmap?.close();return;}if(data.error||!data.bitmap||!data.rect){data.bitmap?.close();this.failedFinal();return;}this.rememberStrokeBitmap(stroke,data.bitmap,data.rect,job.width,job.height);this.cancelFinal();request();};worker.onerror=event=>{event.preventDefault();this.failedFinal();};worker.onmessageerror=()=>this.failedFinal();worker.postMessage({token,stroke,geometry:finalGeometry(stroke),width:p.width,height:p.height});return true;
  }catch{this.failedFinal();return false;}
 }
 /** Adopt a fully composited, canonical live result. The old native layer
  * remains available to the engine as its next preview surface. */
 adoptLayerResult(layer:Layer,p:Project,stroke:Stroke,base:HTMLCanvasElement,result:HTMLCanvasElement){
  const cached=this.caches.get(layer.id),index=layer.operations.length-1;
  if(!cached||cached.canvas!==base||result===base||base.width!==p.width||base.height!==p.height||result.width!==p.width||result.height!==p.height||layer.operations[index]!==stroke||cached.layer.operations.length!==index||!cached.layer.operations.every((o,i)=>o===layer.operations[i]))return undefined;
  this.beforeOperation(layer,base,index);this.caches.set(layer.id,{layer,canvas:result,frame:p.animation?.activeFrameId});this.afterOperation(layer,result,index);this.remember(layer,result,index+1);return base;
 }
 private paintOriginalShot(ctx:CanvasRenderingContext2D,layer:Layer,project:Project){
  const frame=project.shotFrame;
  if(!frame||!layer.operations[0]?.inShot)return 0;
  const next=layer.operations.findIndex(op=>!op.inShot);
  const end=next<0?layer.operations.length:next;
  const renderer=new LayerRenderer(false);
  renderer.bitmaps=this.bitmaps;
  const originalLayer={...layer,operations:originalShotArtwork(layer.operations.slice(0,end),frame)};
  const original={...project,shotFrame:undefined,width:frame.width,height:frame.height};
  const canvas=renderer.get(originalLayer,original);
  ctx.drawImage(canvas,frame.x,frame.y);
  canvas.width=canvas.height=0;
  return end;
 }
 get(layer:Layer,p:Project){
  const frame=p.animation?.activeFrameId;
  let cached=this.caches.get(layer.id);
  if(cached&&cached.canvas.width===p.width&&cached.canvas.height===p.height){
   const previous=cached.layer.operations,next=layer.operations;
   if(previous===next||frame!==cached.frame&&previous.length===next.length&&previous.every((op,i)=>op===next[i])){
    if(frame!==cached.frame||previous!==next)this.caches.set(layer.id,{layer,canvas:cached.canvas,frame});
    return cached.canvas;
   }
   if(this.captureHistory&&frame&&cached.frame&&frame!==cached.frame){
    const index=this.celRasters.findIndex(entry=>entry.layer.id===layer.id&&entry.layer.operations===next&&entry.canvas.width===p.width&&entry.canvas.height===p.height);
    const restored=index<0?undefined:this.releaseCelRaster(index);
    this.caches.delete(layer.id);
    this.parkCelRaster(cached);
    if(restored){this.caches.set(layer.id,{layer,canvas:restored.canvas,frame});return restored.canvas;}
    cached=undefined;
   }
  }
  if(cached&&cached.canvas.width===p.width&&cached.canvas.height===p.height){
   const old=cached.layer.operations,next=layer.operations,undo=next.length<old.length&&next.every((o,i)=>o===old[i]),redo=old.length<next.length&&old.every((o,i)=>o===next[i]);
   if(undo||redo){const operations=undo?old.slice(next.length):next.slice(old.length),source=undo?cached.layer:layer,start=undo?next.length:old.length,patches=operations.map((op,j)=>this.historyPatch(source,op,start+j,p.width,p.height));
    if(patches.every(d=>d&&(!redo||d.patch.complete))){const ctx=context(cached.canvas);for(const d of undo?patches.reverse():patches)d!.patch.restore(ctx,undo?'before':'after');this.caches.set(layer.id,{layer,canvas:cached.canvas,frame});if(undo)this.undoHits++;else this.redoHits++;return cached.canvas;}
   }
  }
  const incremental=cached&&cached.canvas.width===p.width&&cached.canvas.height===p.height&&cached.layer.operations.length<layer.operations.length&&cached.layer.operations.every((o,i)=>o===layer.operations[i]);
  const canvas=cached&&cached.canvas.width===p.width&&cached.canvas.height===p.height?cached.canvas:makeCanvas(p.width,p.height),ctx=context(canvas),capture=incremental||!cached&&layer.operations.length===1;let scratch:HTMLCanvasElement|undefined,start=incremental&&cached?cached.layer.operations.length:0;
  if(!incremental){const checkpoint=this.checkpoints.filter(c=>c.id===layer.id&&c.canvas.width===p.width&&c.canvas.height===p.height&&c.operations.length<=layer.operations.length&&c.operations.every((o,i)=>o===layer.operations[i])).sort((a,b)=>b.operations.length-a.operations.length)[0];ctx.clearRect(0,0,p.width,p.height);if(checkpoint){ctx.drawImage(checkpoint.canvas,0,0);start=checkpoint.operations.length;this.checkpoints.splice(this.checkpoints.indexOf(checkpoint),1);this.checkpoints.push(checkpoint);}}
  if(!incremental&&!start)start=this.paintOriginalShot(ctx,layer,p);
  for(let i=start;i<layer.operations.length;i++){const op=layer.operations[i];if(capture)this.beforeOperation(layer,canvas,i);else this.replayed++;if(op.kind==='stroke'){const ready=this.strokeRasters.get(op);let source:HTMLCanvasElement,sourceX=0,sourceY=0;if(ready&&ready.width===p.width&&ready.height===p.height){source=ready.canvas as HTMLCanvasElement;sourceX=ready.x;sourceY=ready.y;this.strokeRasters.delete(op);this.strokeRasters.set(op,ready);}else{scratch??=this.scratch??=makeCanvas(p.width,p.height);if(scratch.width!==p.width)scratch.width=p.width;if(scratch.height!==p.height)scratch.height=p.height;const sc=context(scratch);sc.clearRect(0,0,p.width,p.height);drawStroke(sc,op);source=scratch;}compositePaintStroke(ctx,source,op,sourceX,sourceY);}else if(op.kind==='fill'){const image=this.bitmaps.get(op.png);if(image){ctx.save();ctx.globalCompositeOperation=op.under?'destination-over':'source-over';const origin=op.inShot?shotFrame(p):undefined;ctx.drawImage(image,origin?.x??0,origin?.y??0);ctx.restore();}}else if(op.kind==='image'){const image=this.bitmaps.get(op.png);if(image)ctx.drawImage(image,op.x,op.y,op.width,op.height);}else if(op.kind==='clear'){ctx.save();ctx.globalCompositeOperation='destination-out';polygonPath(ctx,op.polygon);ctx.fill();ctx.restore();}else if(op.kind==='vector')drawVector(ctx,op);else applyTransform(canvas,op.polygon,op.matrix);if(capture){this.afterOperation(layer,canvas,i);this.remember(layer,canvas,i+1);}}
  if(!cached&&layer.operations.length>=(p.width*p.height*4>=4*1024*1024?24:8))this.remember(layer,canvas,layer.operations.length,true);
  this.caches.set(layer.id,{layer,canvas,frame});return canvas;
 }
 prune(p:Project){for(const id of this.caches.keys())if(!p.layers.some(l=>l.id===id))this.caches.delete(id);this.checkpoints=this.checkpoints.filter(c=>{if(p.layers.some(l=>l.id===c.id))return true;this.checkpointBytes-=c.bytes;c.canvas.width=0;c.canvas.height=0;return false;});this.deltas=this.deltas.filter(d=>{if(p.layers.some(l=>l.id===d.id))return true;this.deltaBytes-=d.bytes;if(this.deltaLookup.get(d.operation)===d)this.deltaLookup.delete(d.operation);d.patch.clear();return false;});}
 /** v174: same as composite(), but each layer is framed by the scene camera
  * (with multiplane depth). Home camera gives the same pixels as composite(). */
 compositeCamera(p:Project,frame:number,options:ExportOptions={}){
  const {x,y,width,height}=shotFrame(p);
  const cam=cameraAt(p.camera,frame,width,height,x,y),plain=cameraMatrix(cam,width,height,0,x,y);
  const flat=!p.camera||p.layers.every(l=>layerDepth(p.camera,l.id)===0);
  if(flat&&plain.join()===[1,0,0,1,-x,-y].join())return this.composite(p,options,p.shotFrame);
  const w=options.width??width,h=options.height??height;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8192||h>8192||w*h>16777216)throw Error('Export dimensions must be 1–8192 px and at most 16 megapixels.');
  const canvas=makeCanvas(w,h),ctx=context(canvas);if(!options.transparent){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  for(const l of [...p.layers].reverse())if((options.layerId?l.id===options.layerId:l.visible)&&(!l.reference||options.includeReferences===true||options.includeReferences===undefined&&l.exportReference)){const m=cameraMatrix(cam,width,height,layerDepth(p.camera,l.id),x,y);ctx.setTransform(w/width,0,0,h/height,0,0);ctx.transform(...m);ctx.globalAlpha=l.opacity;ctx.globalCompositeOperation=blendOperation(l.blend);ctx.drawImage(this.get(l,p),0,0);}
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';return canvas;
 }
 compositeShot(p:Project,options:ExportOptions={}){
  if(options.cameraFrame!==undefined)return this.compositeCamera(p,options.cameraFrame,options);
  return this.composite(p,options,p.shotFrame);
 }
 composite(p:Project,options:ExportOptions={},crop?:ShotFrame){
  const width=crop?.width??p.width,height=crop?.height??p.height,w=options.width??width,h=options.height??height;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8192||h>8192||w*h>16777216)throw Error('Export dimensions must be 1–8192 px and at most 16 megapixels.');
  const canvas=makeCanvas(w,h),ctx=context(canvas);
  if(!options.transparent){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}
  ctx.scale(w/width,h/height);
  for(const l of [...p.layers].reverse())if((options.layerId?l.id===options.layerId:l.visible)&&(!l.reference||options.includeReferences===true||options.includeReferences===undefined&&l.exportReference)){
   ctx.globalAlpha=l.opacity;ctx.globalCompositeOperation=blendOperation(l.blend);
   const artwork=this.get(l,p);
   if(crop)ctx.drawImage(artwork,crop.x,crop.y,width,height,0,0,width,height);
   else ctx.drawImage(artwork,0,0);
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  return canvas;
 }
}
