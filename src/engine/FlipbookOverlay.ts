import type {Project} from '../core/model';
import type {View} from '../core/geometry';
import {flipCandidate,flipVisibleLayers,type FlipDirection} from '../animation/flipbook';
import type {DrawingFrame} from '../animation/timeline';
import {LayerRenderer,makeCanvas,context} from './renderer';

type Cached={frame:DrawingFrame;picture:HTMLCanvasElement};
/** Two-neighbor, full-color flipbook. It cannot write to the user's project.
 * Previews render at idle and are never regenerated on pen move or zoom.
 */
export class FlipbookOverlay {
 private surface:HTMLCanvasElement;private paintFrame=0;private hasContent=false;
 private project:Project;
 private view:View={x:0,y:0,zoom:1,rotation:0};
 private width=1;private height=1;private dpr=1;
 private direction:FlipDirection|null=null;
 private cache=new Map<string,Cached>();
 private signature='';private generation=0;private disposed=false;
 private task?:number;private rendering=false;private failed=new Map<string,DrawingFrame>();
 constructor(parent:HTMLElement,project:Project,private isDrawing:()=>boolean){
  this.project=project;this.surface=document.createElement('canvas');
  this.surface.className='flipbook-overlay';this.surface.setAttribute('aria-hidden','true');
  parent.appendChild(this.surface);this.update(project);
 }
 get previewActive(){return this.direction!==null;}
 /** Press/release (keyboard), or click same direction again to clear (toolbar). */
 preview(direction:FlipDirection|null){
  if(this.disposed)return false;
  if(direction!==null&&(this.isDrawing()||!flipCandidate(this.project,direction)))return false;
  this.direction=direction;this.paint();
  if(direction!==null){
   const requested=flipCandidate(this.project,direction);
   if(requested&&!this.cache.has(requested.id)&&this.failed.get(requested.id)!==requested&&!this.rendering){
    this.cancelTask();void this.prepareOne(requested,this.generation);
   }else this.schedule();
  }
  return true;
 }
 update(project:Project){
  const old=this.project;this.project=project;
  const signature=[project.id,project.width,project.height,
    ...project.layers.filter(l=>l.visible&&!l.reference).map(l=>`${l.id}:${l.opacity}:${l.blend??'normal'}:${l.kind}`)].join('|');
  if(signature!==this.signature){this.signature=signature;this.cache.clear();this.failed.clear();}
  const dirs:[FlipDirection,FlipDirection]=[-1,1];
  const next=dirs.map(d=>flipCandidate(project,d)).filter((f):f is DrawingFrame=>f!==null);
  for(const [id,item] of this.cache)if(!project.animation?.frames.some(f=>f===item.frame))this.cache.delete(id);
  for(const [id,failedFrame] of this.failed)if(!next.some(f=>f===failedFrame))this.failed.delete(id);
  if(old.animation?.activeFrameId!==project.animation?.activeFrameId||old.id!==project.id)this.direction=null;
  this.generation++;this.cancelTask();this.paint();this.schedule();
 }
 setView(view:View,width:number,height:number,dpr:number){
  this.view=view;
  if(width!==this.width||height!==this.height||dpr!==this.dpr){
   this.width=width;this.height=height;this.dpr=dpr;this.hasContent=false;
   this.surface.width=Math.max(1,Math.round(width*dpr));
   this.surface.height=Math.max(1,Math.round(height*dpr));
  }
  this.requestPaint();
 }
 private cancelTask(){if(this.task===undefined)return;
  if('cancelIdleCallback' in window)window.cancelIdleCallback(this.task);
  else clearTimeout(this.task);this.task=undefined;
 }
 private schedule(){
  if(this.disposed||this.rendering||this.task!==undefined||this.isDrawing())return;
  const missing=([-1,1] as FlipDirection[]).map(d=>flipCandidate(this.project,d))
   .find(f=>f&&!this.cache.has(f.id)&&this.failed.get(f.id)!==f
    &&(this.direction!==null&&f===flipCandidate(this.project,this.direction)
       ||Object.values(f.drawings).reduce((count,ops)=>count+ops.length,0)<=120));
  if(!missing)return;
  const generation=this.generation;
  const run=()=>{this.task=undefined;if(!this.disposed&&generation===this.generation&&!this.isDrawing())void this.prepareOne(missing,generation);};
  // Keep expensive offscreen rendering away from active drawing frames.
  if('requestIdleCallback' in window)this.task=window.requestIdleCallback(run,{timeout:600});
  else this.task=setTimeout(run,90) as unknown as number;
 }
 private async prepareOne(frame:DrawingFrame,generation:number){
  if(this.disposed||this.rendering||this.isDrawing())return;
  this.rendering=true;
  const renderer=new LayerRenderer(),snapshot=flipVisibleLayers(this.project,frame);
  try{
   await renderer.prepare(snapshot);
   if(this.disposed||generation!==this.generation||this.isDrawing())return;
   const picture=renderer.composite(snapshot,{transparent:true,includeReferences:false});
   if(!this.disposed&&generation===this.generation){
    this.cache.set(frame.id,{frame,picture});
    while(this.cache.size>3||this.cache.size>1&&this.cache.size*picture.width*picture.height*4>32*1024*1024){
     const oldest=this.cache.keys().next().value!;
     this.cache.delete(oldest);
    }
    this.paint();
   }
  }catch(error){if(generation===this.generation)this.failed.set(frame.id,frame);console.warn('Flipbook preview not available:',error);}
  finally{renderer.clear();this.rendering=false;
   if(!this.disposed)this.schedule();}
 }
 private requestPaint(){if(this.disposed||this.paintFrame||!(this.direction!==null)&&!this.hasContent)return;this.paintFrame=requestAnimationFrame(()=>{this.paintFrame=0;this.paint();});}
 private paint(){
  if(this.paintFrame){cancelAnimationFrame(this.paintFrame);this.paintFrame=0;}if(!(this.direction!==null)&&!this.hasContent)return;
  const ctx=this.surface.getContext('2d');if(!ctx||this.disposed)return;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.surface.width,this.surface.height);this.hasContent=false;
  if(this.direction===null)return;
  const frame=flipCandidate(this.project,this.direction);
  if(!frame)return;
  const cached=this.cache.get(frame.id);
  if(!cached||cached.frame!==frame)return; // show active frame until preview ready
  ctx.save();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  ctx.translate(this.view.x,this.view.y);ctx.rotate(this.view.rotation);ctx.scale(this.view.zoom,this.view.zoom);
  this.hasContent=true;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,this.project.width,this.project.height);
  ctx.beginPath();ctx.rect(0,0,this.project.width,this.project.height);ctx.clip();
  ctx.drawImage(cached.picture,0,0);ctx.restore();
 }
 dispose(){if(this.paintFrame)cancelAnimationFrame(this.paintFrame);this.paintFrame=0;this.disposed=true;this.generation++;this.cancelTask();this.cache.clear();this.surface.remove();}
}
