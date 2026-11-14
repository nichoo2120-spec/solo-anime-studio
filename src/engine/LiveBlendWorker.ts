import type {Stroke} from '../core/model';
import type {RasterRegion} from './liveRaster';
const canvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
export const workerBlendEligible=(s:Pick<Stroke,'tool'|'coloringEngine'|'coloringAppearanceVersion'|'smudgeVersion'|'brushTip'|'nativeMixVersion'>)=>s.tool!=='eraser'&&(!!s.nativeMixVersion||(s.coloringEngine===1&&s.brushTip==='color-blender'&&(s.coloringAppearanceVersion===3||s.smudgeVersion===2)));
export type BlendDelta={mask:HTMLCanvasElement;patch:HTMLCanvasElement;tiles:Map<string,{x:number;y:number;w:number;h:number}>;revision:number};
type Reply={token:number;serial:number;deltaMask?:ImageBitmap;deltaPaint?:ImageBitmap;tiles?:{x:number;y:number;w:number;h:number}[];bitmap?:ImageBitmap;region?:RasterRegion;final?:boolean;error?:string};
type Job={token:number;id:string;source:HTMLCanvasElement;signature:string;ready:boolean;inFlight:boolean;queued?:{stroke:Stroke;final:boolean};geometry?:unknown;resolve?:(surface:HTMLCanvasElement|undefined)=>void;timer?:ReturnType<typeof setTimeout>};

/** Keep the existing browser Canvas pigment calculations off the input thread.
 * One update is in flight; newer input coalesces instead of building a backlog.
 * Canonical export/reload stays synchronous and never receives provisional data. */
export class LiveBlendWorker{
 private worker?:Worker;private job?:Job;private token=0;private serial=0;private failed=false;private failures=0;
 private surface=canvas(1,1);private surfaceReadback=false;
 private dirty?:RasterRegion;private delta?:BlendDelta;
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
 cancel(){if(this.delta){this.delta.mask.width=this.delta.mask.height=this.delta.patch.width=this.delta.patch.height=0;this.delta=undefined;}const j=this.job;if(j){if(j.timer)clearTimeout(j.timer);j.resolve?.(undefined);}this.job=undefined;this.dirty=undefined;this.token++;this.worker?.postMessage({kind:'cancel',token:this.token});this.surface.width=this.surface.height=0;}
 dispose(){this.cancel();this.worker?.terminate();this.worker=undefined;}
 matches(s:Stroke,source:HTMLCanvasElement){return !!this.job&&this.job.id===s.id&&this.job.source===source&&!this.failed;}
 takeRegion(s:Stroke){if(this.job?.id!==s.id)return undefined;const r=this.dirty??{x:0,y:0,width:0,height:0};this.dirty=undefined;return r;}
 preview(s:Stroke,source:HTMLCanvasElement,geometry:unknown,nativeDelta=false){
  this.warm();if(!this.worker||this.failed||!workerBlendEligible(s))return undefined;
  const signature=JSON.stringify({...s,points:undefined,mixStops:undefined});
  if(!this.job||this.job.id!==s.id||this.job.source!==source||this.job.signature!==signature){
   this.cancel();const token=++this.token,j:Job={token,id:s.id,source,signature,ready:false,inFlight:false};this.job=j;
   if(this.surfaceReadback!==nativeDelta){this.surface=canvas(1,1);this.surfaceReadback=nativeDelta;}
   const basePixels=nativeDelta?source.getContext('2d')!.getImageData(0,0,source.width,source.height).data:undefined;
   if(nativeDelta)this.delta={mask:canvas(source.width,source.height),patch:canvas(source.width,source.height),tiles:new Map(),revision:0};
   this.surface.width=source.width;this.surface.height=source.height;this.surface.getContext('2d',{willReadFrequently:nativeDelta})!.drawImage(source,0,0);
   // Native pigment Mix only draws canvases; keep hardware acceleration available.
   // Legacy pixel-sampling smudges retain their readback-optimized context.
   createImageBitmap(source).then(bitmap=>{if(this.job!==j){bitmap.close();return;}this.worker!.postMessage({kind:'begin',token,width:source.width,height:source.height,base:bitmap,readFrequently:!s.nativeMixVersion,nativeDelta,basePixels},[bitmap,...(basePixels?[basePixels.buffer as ArrayBuffer]:[])]);j.ready=true;this.flush(j);}).catch(()=>this.fail());
  }
  const j=this.job!;if(j.geometry!==geometry){j.geometry=geometry;j.queued={stroke:s,final:false};this.flush(j);}return this.surface;
 }
 finish(s:Stroke){
  const j=this.job;if(!j||j.id!==s.id||this.failed)return undefined;
  const preview=this.surface,done=new Promise<HTMLCanvasElement|undefined>(resolve=>{j.resolve=resolve;});j.queued={stroke:s,final:true};this.flush(j);return{preview,done};
 }
 private flush(j:Job){if(this.job!==j||!j.ready||j.inFlight||!j.queued)return;const q=j.queued;j.queued=undefined;j.inFlight=true;const serial=++this.serial;this.worker!.postMessage({kind:'update',token:j.token,serial,stroke:q.stroke,final:q.final});j.timer=setTimeout(()=>this.fail(),5000);}
 private receive(reply:Reply){
  const j=this.job;if(!j||reply.token!==j.token){reply.bitmap?.close();reply.deltaMask?.close();reply.deltaPaint?.close();return;}
  if(j.timer)clearTimeout(j.timer);j.timer=undefined;j.inFlight=false;
  if(reply.error||!reply.bitmap||!reply.region){reply.bitmap?.close();reply.deltaMask?.close();reply.deltaPaint?.close();this.fail();return;}
  const r=reply.region;
  if(this.delta){if(!reply.deltaMask||!reply.deltaPaint||!reply.tiles){reply.bitmap.close();reply.deltaMask?.close();reply.deltaPaint?.close();this.fail();return;}
   for(const [surface,bitmap]of [[this.delta.mask,reply.deltaMask],[this.delta.patch,reply.deltaPaint]] as const){const c=surface.getContext('2d')!;c.clearRect(r.x,r.y,r.width,r.height);c.drawImage(bitmap,r.x,r.y);bitmap.close();}
   for(const tile of reply.tiles){const key=Math.floor(tile.x/64)*64+','+Math.floor(tile.y/64)*64;if(tile.w&&tile.h)this.delta.tiles.set(key,tile);else this.delta.tiles.delete(key);}this.delta.revision++;
  }else{reply.deltaMask?.close();reply.deltaPaint?.close();}
  const c=this.surface.getContext('2d')!;c.clearRect(r.x,r.y,r.width,r.height);c.drawImage(reply.bitmap,r.x,r.y);reply.bitmap.close();
  const old=this.dirty;if(old){const x=Math.min(old.x,r.x),y=Math.min(old.y,r.y);this.dirty={x,y,width:Math.max(old.x+old.width,r.x+r.width)-x,height:Math.max(old.y+old.height,r.y+r.height)-y};}else this.dirty=r;
  if(reply.final){const result=this.surface;this.surface=canvas(1,1);this.job=undefined;j.resolve?.(result);}else this.flush(j);
  this.request();
 }
}
