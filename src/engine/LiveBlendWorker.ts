import {isBrushBlendVersion} from '../core/brushBlend';
import type {BlendSampleSource} from './brushBlend';
import type {Point,Stroke} from '../core/model';
import type {RasterRegion} from './liveRaster';
const canvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
const samePoint=(a:Point|undefined,b:Point|undefined)=>!!a&&!!b&&a.x===b.x&&a.y===b.y&&a.p===b.p&&a.v===b.v;
export const workerBlendEligible=(s:Pick<Stroke,'tool'|'coloringEngine'|'coloringAppearanceVersion'|'smudgeVersion'|'brushTip'|'nativeMixVersion'|'paintTipVersion'|'dryBristleVersion'|'silkBlendVersion'|'brushBlendVersion'>)=>s.tool!=='eraser'&&(isBrushBlendVersion(s.brushBlendVersion)||s.silkBlendVersion===1||s.silkBlendVersion===2||(s.paintTipVersion===2||s.dryBristleVersion===3)&&s.brushTip!=='color-blender'||!!s.nativeMixVersion||(s.coloringEngine===1&&s.brushTip==='color-blender'&&(s.coloringAppearanceVersion===3||s.smudgeVersion===2)));
export type NativeMixSeed={mask:HTMLCanvasElement;paint:HTMLCanvasElement;box:{x:number;y:number;w:number;h:number};tiles:Map<string,{x:number;y:number;w:number;h:number}>};
export type BlendBaseline={pixels:Uint8ClampedArray;region:RasterRegion;seed?:NativeMixSeed};
export type BlendDelta={mask:HTMLCanvasElement;patch:HTMLCanvasElement;tiles:Map<string,{x:number;y:number;w:number;h:number}>;revision:number;final?:boolean;group?:BlendBaseline;support?:RasterRegion;dirty?:RasterRegion;box?:{x:number;y:number;w:number;h:number}};
type Reply={maskData?:Uint8ClampedArray;paintData?:Uint8ClampedArray;token:number;serial:number;deltaMask?:ImageBitmap;deltaPaint?:ImageBitmap;tiles?:{x:number;y:number;w:number;h:number}[];support?:RasterRegion;bitmap?:ImageBitmap;region?:RasterRegion;final?:boolean;error?:string};
type Job={token:number;id:string;ownershipBase?:BlendBaseline;source:HTMLCanvasElement;signature:string;ready:boolean;inFlight:boolean;queued?:{stroke:Stroke;final:boolean};geometry?:unknown;pointsRef?:Point[];pointCount:number;lastPoint?:Point;resolve?:(surface:HTMLCanvasElement|undefined)=>void;timer?:ReturnType<typeof setTimeout>};

/** Keep the existing browser Canvas pigment calculations off the input thread.
 * One update is in flight; newer input coalesces instead of building a backlog.
 * Canonical export/reload stays synchronous and never receives provisional data. */
export class LiveBlendWorker{
 private worker?:Worker;private job?:Job;private token=0;private serial=0;private failed=false;private failures=0;
 private surface=canvas(1,1);private surfaceReadback=false;
 private dirty?:RasterRegion;private delta?:BlendDelta;
 /** v0.5.240 Blend mode "All layers": page snapshot taken at pen-down. */
 blendSample?:BlendSampleSource;
 constructor(private readonly request:()=>void){}
 warm(){
  if(this.worker||this.failed||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return;
  try{const w=this.worker=new Worker(new URL('./liveBlend.worker.ts',import.meta.url),{type:'module'});w.onmessage=e=>this.receive(e.data);w.onerror=e=>{e.preventDefault();this.fail();};w.onmessageerror=()=>this.fail();}catch{this.fail();}
 }
 available(){return !!this.worker&&!this.failed;}
 private fail(){this.failures++;this.failed=true;this.worker?.terminate();this.worker=undefined;this.cancel();this.request();}
 /** A hung worker must not disable Mix for the remainder of the application.
  * Retry on a NEW pen gesture, with a two-failure circuit breaker to avoid
  * repeatedly spawning a broken worker during the same editing session. */
 retryForNewGesture(){if(!this.failed||this.failures>=2)return;this.failed=false;this.warm();}
 deltaFor(s:Stroke){return this.job?.id===s.id?this.delta:undefined;}
 cancel(reuseSurfaces=false){if(this.delta){this.delta.mask.width=this.delta.mask.height=this.delta.patch.width=this.delta.patch.height=0;this.delta=undefined;}const j=this.job;if(j){if(j.timer)clearTimeout(j.timer);j.resolve?.(undefined);}this.job=undefined;this.dirty=undefined;this.token++;this.worker?.postMessage({kind:'cancel',token:this.token,reuseSurfaces});this.surface.width=this.surface.height=0;}
 dispose(){this.cancel();this.worker?.terminate();this.worker=undefined;}
 matches(s:Stroke,source:HTMLCanvasElement){return !!this.job&&this.job.id===s.id&&this.job.source===source&&!this.failed;}
 takeRegion(s:Stroke){if(this.job?.id!==s.id)return undefined;const r=this.dirty??{x:0,y:0,width:0,height:0};this.dirty=undefined;return r;}
 preview(s:Stroke,source:HTMLCanvasElement,geometry:unknown,nativeDelta=false,ownershipBase?:BlendBaseline){
  this.warm();if(!this.worker||this.failed||!workerBlendEligible(s))return undefined;
  const signature=JSON.stringify({...s,points:undefined,mixStops:undefined});
  if(!this.job||this.job.id!==s.id||this.job.source!==source||this.job.signature!==signature||this.job.ownershipBase!==ownershipBase){
   this.cancel(true);const token=++this.token,j:Job={token,id:s.id,ownershipBase,source,signature,ready:false,inFlight:false,pointCount:0};this.job=j;
   if(this.surfaceReadback!==nativeDelta){this.surface=canvas(1,1);this.surfaceReadback=nativeDelta;}
   const deltaPixels=ownershipBase?.pixels.slice();
   if(nativeDelta){const seed=ownershipBase?.seed;this.delta={mask:canvas(source.width,source.height),patch:canvas(source.width,source.height),tiles:new Map(seed?.tiles),revision:0,group:ownershipBase,box:seed?.box};if(seed){this.delta.mask.getContext('2d')!.drawImage(seed.mask,seed.box.x,seed.box.y);this.delta.patch.getContext('2d')!.drawImage(seed.paint,seed.box.x,seed.box.y);}}
   this.surface.width=source.width;this.surface.height=source.height;this.surface.getContext('2d',{willReadFrequently:nativeDelta})!.drawImage(source,0,0);
   // Native ownership already has exact pixels; pass them directly. Other
   // blend modes retain their existing bitmap setup and readback behavior.
   const begin=(bitmap?:ImageBitmap)=>{if(this.job!==j){bitmap?.close();return;}this.worker!.postMessage({kind:'begin',token,width:source.width,height:source.height,base:bitmap,readFrequently:!s.nativeMixVersion,nativeDelta,deltaPixels,deltaRegion:ownershipBase?.region,seeded:!!ownershipBase?.seed,compactReplies:nativeDelta,blendSample:isBrushBlendVersion(s.brushBlendVersion)&&s.bbSample==='all'?this.blendSample:undefined},[...(bitmap?[bitmap]:[]),...(deltaPixels?[deltaPixels.buffer as ArrayBuffer]:[])]);j.ready=true;this.flush(j);};createImageBitmap(source).then(begin).catch(()=>this.fail());
  }
  const j=this.job!;if(j.geometry!==geometry){j.geometry=geometry;j.queued={stroke:s,final:false};this.flush(j);}return this.surface;
 }
 finish(s:Stroke){
  const j=this.job;if(!j||j.id!==s.id||this.failed)return undefined;
  const preview=this.surface,done=new Promise<HTMLCanvasElement|undefined>(resolve=>{j.resolve=resolve;});j.queued={stroke:s,final:true};this.flush(j);return{preview,done};
 }
 private flush(j:Job){
  if(this.job!==j||!j.ready||j.inFlight||!j.queued)return;
  const q=j.queued;j.queued=undefined;j.inFlight=true;const serial=++this.serial;
  const points=q.stroke.points??[];
  const canAppend=j.pointsRef===points&&points.length>=j.pointCount&&(!j.pointCount||samePoint(points[j.pointCount-1],j.lastPoint));
  const resetPoints=!canAppend;
  const pointDelta=points.slice(resetPoints?0:j.pointCount);
  const {points:_points,...metadata}=q.stroke;
  // Keep the growing point history on the worker. Only the newly captured
  // samples cross the UI-thread boundary for ordinary pointer updates.
  this.worker!.postMessage({kind:'update',token:j.token,serial,stroke:{...metadata,points:[]},pointDelta,resetPoints,final:q.final});
  j.pointsRef=points;j.pointCount=points.length;j.lastPoint=points.length?{...points[points.length-1]}:undefined;
  j.timer=setTimeout(()=>this.fail(),5000);
}
 private receive(reply:Reply){
  const j=this.job;if(!j||reply.token!==j.token){reply.bitmap?.close();reply.deltaMask?.close();reply.deltaPaint?.close();return;}
  if(j.timer)clearTimeout(j.timer);j.timer=undefined;j.inFlight=false;
  if(reply.error||!reply.bitmap||!reply.region){reply.bitmap?.close();reply.deltaMask?.close();reply.deltaPaint?.close();this.fail();return;}
  const r=reply.region;let displayRegion=r;
  if(this.delta){const oldBox=this.delta.box;if((!reply.deltaMask||!reply.deltaPaint)&&(!reply.maskData||!reply.paintData)||!reply.tiles){reply.bitmap?.close();reply.deltaMask?.close();reply.deltaPaint?.close();this.fail();return;}
   for(const [surface,bitmap,data]of [[this.delta.mask,reply.deltaMask,reply.maskData],[this.delta.patch,reply.deltaPaint,reply.paintData]] as const){const c=surface.getContext('2d')!;if(data){const pixels=c.createImageData(r.width,r.height);pixels.data.set(data);c.putImageData(pixels,r.x,r.y);}else if(bitmap){c.clearRect(r.x,r.y,r.width,r.height);c.drawImage(bitmap,r.x,r.y);bitmap.close();}} 
   for(const tile of reply.tiles){const key=Math.floor(tile.x/64)*64+','+Math.floor(tile.y/64)*64;if(tile.w&&tile.h)this.delta.tiles.set(key,tile);else this.delta.tiles.delete(key);}this.delta.revision++;this.delta.final=!!reply.final;this.delta.support=reply.support;
   const dirty=this.delta.dirty;if(dirty){const x=Math.min(dirty.x,r.x),y=Math.min(dirty.y,r.y);this.delta.dirty={x,y,width:Math.max(dirty.x+dirty.width,r.x+r.width)-x,height:Math.max(dirty.y+dirty.height,r.y+r.height)-y};}else this.delta.dirty=r;
   let box:NativeMixSeed['box']|undefined;for(const value of this.delta.tiles.values()){if(!box)box={...value};else{const right=Math.max(box.x+box.w,value.x+value.w),bottom=Math.max(box.y+box.h,value.y+value.h);box.x=Math.min(box.x,value.x);box.y=Math.min(box.y,value.y);box.w=right-box.x;box.h=bottom-box.y;}}
   this.delta.box=box;
   if(oldBox?.x!==box?.x||oldBox?.y!==box?.y||oldBox?.w!==box?.w||oldBox?.h!==box?.h){for(const b of [oldBox,box])if(b){const x=Math.min(displayRegion.x,b.x),y=Math.min(displayRegion.y,b.y);displayRegion={x,y,width:Math.max(displayRegion.x+displayRegion.width,b.x+b.w)-x,height:Math.max(displayRegion.y+displayRegion.height,b.y+b.h)-y};}}
  }else{reply.deltaMask?.close();reply.deltaPaint?.close();}
  const c=this.surface.getContext('2d')!;c.clearRect(r.x,r.y,r.width,r.height);c.drawImage(reply.bitmap,r.x,r.y);reply.bitmap.close();
  const old=this.dirty;if(old){const x=Math.min(old.x,displayRegion.x),y=Math.min(old.y,displayRegion.y);this.dirty={x,y,width:Math.max(old.x+old.width,displayRegion.x+displayRegion.width)-x,height:Math.max(old.y+old.height,displayRegion.y+displayRegion.height)-y};}else this.dirty=displayRegion;
  if(reply.final){const result=this.surface;this.surface=canvas(1,1);this.job=undefined;j.resolve?.(result);}else this.flush(j);
  this.request();
 }
}
