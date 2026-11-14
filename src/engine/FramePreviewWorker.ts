import type {Project} from '../core/model';
type Pending={id:number;resolve:(bitmap:ImageBitmap)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
/** Background-only canonical drawing previews. One job per overlay, no input-thread replay. */
export class FramePreviewWorker{
 private worker?:Worker;private pending?:Pending;private serial=0;
 get available(){return typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap!=='undefined';}
 warm(){if(!this.available)return undefined;try{if(!this.worker){const worker=this.worker=new Worker(new URL('./framePreview.worker.ts',import.meta.url),{type:'module'});worker.onerror=event=>{event.preventDefault();if(this.worker!==worker)return;if(this.pending)this.cancel(Error('Preview worker failed'));else{worker.terminate();this.worker=undefined;}};}return this.worker;}catch{return undefined;}}
 render(project:Project,maxWidth?:number,color?:string|null):Promise<ImageBitmap>{
  this.cancel();
  return new Promise((resolve,reject)=>{
   try{
    const worker=this.warm();if(!worker)throw Error('Preview worker unavailable');const id=++this.serial;
    worker.onmessage=({data}:{data:{id:number;bitmap?:ImageBitmap;error?:string}})=>{const pending=this.pending;if(!pending||pending.id!==data.id){data.bitmap?.close();return;}clearTimeout(pending.timer);this.pending=undefined;if(data.bitmap)pending.resolve(data.bitmap);else pending.reject(Error(data.error??'Preview failed'));};
    worker.onerror=event=>{event.preventDefault();if(this.worker!==worker)return;this.cancel(Error('Preview worker failed'));};worker.onmessageerror=()=>{if(this.worker===worker)this.cancel(Error('Preview reply failed'));};
    this.pending={id,resolve,reject,timer:setTimeout(()=>this.cancel(Error('Preview timed out')),30000)};
    worker.postMessage({id,project,maxWidth,color});
   }catch(error){this.cancel(error instanceof Error?error:Error(String(error)));reject(error);}
  });
 }
 cancel(error=Error('Preview cancelled')){const pending=this.pending;if(!pending)return;this.pending=undefined;clearTimeout(pending.timer);pending.reject(error);this.worker?.terminate();this.worker=undefined;}
 dispose(){this.cancel();this.worker?.terminate();this.worker=undefined;}
}
