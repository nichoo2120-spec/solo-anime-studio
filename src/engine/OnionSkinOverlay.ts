import type {Project} from '../core/model';
import type {View} from '../core/geometry';
import {onionNeighbors,DEFAULT_ONION_SETTINGS,type OnionSettings,type OnionNeighbor} from '../animation/onionSkin';
import {sanitizeLightTablePins,type LightTablePin} from '../animation/lightTable';
import {FramePreviewWorker} from './FramePreviewWorker';
import {frameList,currentFrameIndex} from '../animation/timeline';
import {LayerRenderer,makeCanvas,context} from './renderer';

type Guide={frame:OnionNeighbor['frame'];kind:'previous'|'next'|'pin';opacity:number;color:string|null;dx:number;dy:number;scale:number;angle:number};
type PreparedGhost={frame:Guide['frame'];signature:string;canvas:HTMLCanvasElement};
/** A separate, pointer-transparent canvas. No onion skin raster work happens in the
 * document's pen-move or stroke-render path; neighboring frames use cached pixels or background rendering.
 */
export class OnionSkinOverlay {
 private surface:HTMLCanvasElement;private paintFrame=0;private hasContent=false;
 private project:Project;
 private settings:OnionSettings={...DEFAULT_ONION_SETTINGS};
 private view:View={x:0,y:0,zoom:1,rotation:0};
 private width=1;private height=1;private dpr=1;
 private ghosts=new Map<string,PreparedGhost>();
 private neighbors:Guide[]=[];private pins:LightTablePin[]=[];
 private task?:number;private taskKind?:'idle'|'timeout';private generation=0;private disposed=false;
 private signature='';private previewWorker=new FramePreviewWorker();private busyGeneration=-1;private staleFrames=new Set<string>();
 constructor(parent:HTMLElement,project:Project,private isDrawing:()=>boolean){
  this.project=project;this.surface=document.createElement('canvas');this.surface.className='onion-skin-overlay';
  this.surface.setAttribute('aria-hidden','true');parent.appendChild(this.surface);this.update(project);
 }
 /** Seed a frame being left from native pixels already prepared for drawing. */
 refresh(frameId:string){this.staleFrames.add(frameId);this.schedule();}
 warm(){this.previewWorker.warm();}
 capture(project:Project,renderer:LayerRenderer,overrides?:ReadonlyMap<string,HTMLCanvasElement>){
  if(this.settings.currentLayerOnly&&project.activeLayerId!==this.project.activeLayerId)return;
  if(project.id!==this.project.id||project.width!==this.project.width||project.height!==this.project.height)return;
  const frame=frameList(project)[currentFrameIndex(project)],current=frameList(this.project).find(f=>f.id===frame.id);
  if(!current||current!==frame||project.layers.length!==this.project.layers.length||project.layers.some((l,i)=>{const other=this.project.layers[i];return !other||l.id!==other.id||l.visible!==other.visible||l.opacity!==other.opacity||l.blend!==other.blend||l.kind!==other.kind||l.reference!==other.reference;}))return;
  const layers=project.layers.filter(l=>l.visible&&!l.reference&&(!this.settings.currentLayerOnly||l.id===project.activeLayerId));
  if(!layers.some(l=>l.operations.length))return;
  const original=renderer.cachedComposite({...project,layers},overrides);if(!original)return;
  const ratio=Math.min(1,1024/original.width),w=Math.max(1,Math.round(original.width*ratio)),h=Math.max(1,Math.round(original.height*ratio));
  for(const [kind,color]of [['previous','#e87986'],['next','#53bdde']] as const){const canvas=makeCanvas(w,h),ctx=context(canvas);ctx.drawImage(original,0,0,w,h);ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,w,h);this.keepGhost(frame.id+':'+kind+':'+color,{frame,signature:this.signature,canvas});}
  this.staleFrames.delete(frame.id);original.width=original.height=0;this.paint();
 }
 /** Avoid rerasterizing or repainting large pinned guides after ordinary pen commits.
  * The engine's document subscriber already calls update(project) for frame edits.
  */
 setPins(pins:LightTablePin[]){
  const next=sanitizeLightTablePins(this.project,pins);
  if(next.length===this.pins.length&&next.every((pin,i)=>{
   const old=this.pins[i];return pin.frameId===old.frameId&&pin.opacity===old.opacity&&pin.dx===old.dx&&pin.dy===old.dy&&pin.scale===old.scale&&pin.angle===old.angle&&pin.tint===old.tint;
  }))return;
  this.pins=next;this.update(this.project);
 }
 setSettings(settings:OnionSettings){
  const rebuild=this.settings.currentLayerOnly!==settings.currentLayerOnly;
  this.settings=settings;if(rebuild){this.clearGhosts();this.signature='';}
  this.update(this.project);this.paint();
 }
 setView(view:View,width:number,height:number,dpr:number){
  this.view=view;
  if(width!==this.width||height!==this.height||dpr!==this.dpr){
   this.width=width;this.height=height;this.dpr=dpr;this.hasContent=false;
   this.surface.width=Math.max(1,Math.round(width*dpr));this.surface.height=Math.max(1,Math.round(height*dpr));
  }
  this.requestPaint();
 }
 update(project:Project){
  const lastNeighbors=this.neighbors;this.project=project;
  this.pins=sanitizeLightTablePins(project,this.pins);
  const frames=frameList(project);
  this.neighbors=[...onionNeighbors(project,this.settings).map(n=>({...n,color:n.color,dx:0,dy:0,scale:1,angle:0})),
   ...this.pins.filter(pin=>pin.frameId!==project.animation?.activeFrameId).map(pin=>({frame:frames.find(f=>f.id===pin.frameId)!,kind:'pin' as const,opacity:pin.opacity/100,color:pin.tint==='original'?null:pin.tint==='teal'?'#53bdde':'#e87986',dx:pin.dx,dy:pin.dy,scale:pin.scale,angle:pin.angle}))];
  // A changed frame id, layer visibility, or neighboring operation array requires
  // an updated ghost. Current-frame pen strokes do not affect this signature.
  const scoped=project.layers.filter(l=>l.visible&&!l.reference);
  const signature=[project.id,project.width,project.height,project.activeLayerId,this.settings.currentLayerOnly,
   ...scoped.map(l=>`${l.id}:${l.opacity}:${l.blend??'normal'}`)].join('|');
  if(signature===this.signature&&lastNeighbors.length===this.neighbors.length&&
    this.neighbors.every((n,i)=>n.frame===lastNeighbors[i].frame&&n.kind===lastNeighbors[i].kind&&n.opacity===lastNeighbors[i].opacity&&n.color===lastNeighbors[i].color&&n.dx===lastNeighbors[i].dx&&n.dy===lastNeighbors[i].dy&&n.scale===lastNeighbors[i].scale&&n.angle===lastNeighbors[i].angle))return;
  const sameSignature=signature===this.signature;
  if(!sameSignature){this.signature=signature;this.clearGhosts();}
  if(sameSignature&&lastNeighbors.length===this.neighbors.length&&this.neighbors.every((n,i)=>n.frame===lastNeighbors[i].frame&&n.kind===lastNeighbors[i].kind&&n.color===lastNeighbors[i].color)){this.paint();this.schedule();return;}
  this.generation++;
  this.previewWorker.cancel();this.cancelTask();
  // Retain a few recently used ghosts for back-and-forth frame inspection.
  // The frame object and layer presentation must still match.
  const ids=new Set(this.neighbors.map(n=>this.key(n)));
  const validFrames=new Set(frames);for(const id of this.staleFrames)if(!frames.some(f=>f.id===id))this.staleFrames.delete(id);
  const inactive:string[]=[];
  for(const [id,ghost] of this.ghosts){
   if(!validFrames.has(ghost.frame))this.dropGhost(id);
   else if(!ids.has(id))inactive.push(id);
  }
  for(const id of inactive.slice(0,Math.max(0,inactive.length-4)))this.dropGhost(id);
  this.paint();this.schedule();
 }
 private dropGhost(key:string){
  const ghost=this.ghosts.get(key);
  if(ghost){ghost.canvas.width=ghost.canvas.height=0;this.ghosts.delete(key);}
 }
 private clearGhosts(){for(const key of this.ghosts.keys())this.dropGhost(key);}
 private keepGhost(key:string,ghost:{frame:Guide['frame'];signature:string;canvas:HTMLCanvasElement}){
  this.dropGhost(key);this.ghosts.set(key,ghost);
 }
 private key(n:Guide){return `${n.frame.id}:${n.kind}:${n.color??'original'}`;}
 private cancelTask(){if(this.task!==undefined){if(this.taskKind==='idle'&&'cancelIdleCallback' in window)window.cancelIdleCallback(this.task);else clearTimeout(this.task);this.task=undefined;this.taskKind=undefined;}}
 private schedule(){if(this.disposed||this.task!==undefined||this.busyGeneration===this.generation||!this.neighbors.some(n=>(this.ghosts.get(this.key(n))?.frame!==n.frame||this.staleFrames.has(n.frame.id))))return;
  const generation=this.generation;
  const render=()=>{this.task=undefined;this.taskKind=undefined;if(this.disposed||generation!==this.generation)return;
   if(this.isDrawing()){
    // Never queue another idle callback immediately during an active pen stroke.
    // A pending Light Table ghost waits quietly until a short pause in drawing.
    this.taskKind='timeout';this.task=window.setTimeout(render,100);return;
   }
   void this.prepareOne(generation);
  };
  if(this.isDrawing()){this.taskKind='timeout';this.task=window.setTimeout(render,100);}
  else if(this.previewWorker.available){this.taskKind='timeout';this.task=window.setTimeout(render,0);}
  else if('requestIdleCallback' in window){this.taskKind='idle';this.task=window.requestIdleCallback(render,{timeout:300});}
  else{this.taskKind='timeout';this.task=setTimeout(render,32) as unknown as number;}
 }
 private async prepareOne(generation:number){
  if(this.busyGeneration===generation)return;this.busyGeneration=generation;
  const frames=frameList(this.project),active=currentFrameIndex(this.project);
  const neighbor=[...this.neighbors].sort((a,b)=>Math.abs(frames.indexOf(a.frame)-active)-Math.abs(frames.indexOf(b.frame)-active)).find(n=>this.ghosts.get(this.key(n))?.frame!==n.frame||this.staleFrames.has(n.frame.id));if(!neighbor){this.busyGeneration=-1;return;}
  const project=this.project,scoped=project.layers.filter(l=>l.visible&&!l.reference&&(neighbor.kind==='pin'||!this.settings.currentLayerOnly||l.id===project.activeLayerId));
  // No recomposition on frame hover, pen motion, or slider movement. This temporary
  // renderer cannot evict the active drawing engine's layer caches.
  const snapshot={...project,animation:undefined,layers:scoped.map(l=>({...l,operations:neighbor.frame.drawings[l.id]??[]}))};
  if(!snapshot.layers.some(l=>l.operations.length)){
   if(!this.disposed&&generation===this.generation){this.staleFrames.delete(neighbor.frame.id);this.keepGhost(this.key(neighbor),{frame:neighbor.frame,signature:this.signature,canvas:makeCanvas(1,1)});}
  }else if(this.previewWorker.available){
   try{const bitmap=await this.previewWorker.render(snapshot,neighbor.kind==='pin'?undefined:1024,neighbor.color);if(this.disposed||generation!==this.generation){bitmap.close();return;}const canvas=makeCanvas(bitmap.width,bitmap.height);context(canvas).drawImage(bitmap,0,0);bitmap.close();this.staleFrames.delete(neighbor.frame.id);this.keepGhost(this.key(neighbor),{frame:neighbor.frame,signature:this.signature,canvas});}
   catch(error){if(!this.disposed&&generation===this.generation){console.warn('Onion skin preview unavailable:',error);this.staleFrames.delete(neighbor.frame.id);this.keepGhost(this.key(neighbor),{frame:neighbor.frame,signature:this.signature,canvas:makeCanvas(1,1)});}}
   finally{if(this.busyGeneration===generation)this.busyGeneration=-1;}
  }else{
   const renderer=new LayerRenderer();
   try{
    await renderer.prepare(snapshot);
    if(this.disposed||generation!==this.generation)return;
    if(this.isDrawing()){this.busyGeneration=-1;this.schedule();return;}
    const original=renderer.composite(snapshot,{transparent:true,includeReferences:false});
    // Ten full-HD ghosts would consume ~80 MB even when the pen is idle.
    // Keep reference pins at full resolution, but bound each onion ghost to
    // 1024 px wide (a fast, lower-memory display-only texture).
    const ratio=neighbor.kind==='pin'?1:Math.min(1,1024/original.width);
    const w=Math.max(1,Math.round(original.width*ratio)),h=Math.max(1,Math.round(original.height*ratio));
    const needsCopy=neighbor.color!==null||ratio<1;
    const tinted=needsCopy?makeCanvas(w,h):original;
    if(needsCopy){const ctx=context(tinted);ctx.drawImage(original,0,0,w,h);
     if(neighbor.color){ctx.globalCompositeOperation='source-in';ctx.fillStyle=neighbor.color;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';}original.width=original.height=0;}
    if(!this.disposed&&generation===this.generation){this.staleFrames.delete(neighbor.frame.id);this.keepGhost(this.key(neighbor),{frame:neighbor.frame,signature:this.signature,canvas:tinted});}
   }catch(error){console.warn('Onion skin preview unavailable:',error);
    if(!this.disposed&&generation===this.generation){this.staleFrames.delete(neighbor.frame.id);this.keepGhost(this.key(neighbor),{frame:neighbor.frame,signature:this.signature,canvas:makeCanvas(1,1)});}
   }finally{renderer.clear();if(this.busyGeneration===generation)this.busyGeneration=-1;}
  }
  if(this.busyGeneration===generation)this.busyGeneration=-1;
  if(!this.disposed&&generation===this.generation){this.paint();this.schedule();}
 }
 private drawable(){return this.neighbors.some(n=>{const ghost=this.ghosts.get(this.key(n));return ghost?.frame===n.frame&&ghost.canvas.width>1;});}
 private requestPaint(){if(this.disposed||this.paintFrame||!this.hasContent&&!this.drawable())return;this.paintFrame=requestAnimationFrame(()=>{this.paintFrame=0;this.paint();});}
 private paint(){if(this.disposed)return;if(this.paintFrame){cancelAnimationFrame(this.paintFrame);this.paintFrame=0;}if(!this.hasContent&&!this.drawable())return;
  const ctx=this.surface.getContext('2d');if(!ctx)return;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.surface.width,this.surface.height);this.hasContent=false;
  if(!this.settings.enabled&&!this.pins.length)return;
  ctx.save();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  ctx.translate(this.view.x,this.view.y);ctx.rotate(this.view.rotation);ctx.scale(this.view.zoom,this.view.zoom);
  ctx.beginPath();ctx.rect(0,0,this.project.width,this.project.height);ctx.clip();
  for(const n of this.neighbors){const ghost=this.ghosts.get(this.key(n));
   if(!ghost||ghost.frame!==n.frame||ghost.canvas.width<=1)continue;
   this.hasContent=true;ctx.globalAlpha=n.opacity;ctx.save();ctx.translate(n.dx+this.project.width/2,n.dy+this.project.height/2);ctx.rotate(n.angle*Math.PI/180);ctx.scale(n.scale,n.scale);ctx.translate(-this.project.width/2,-this.project.height/2);ctx.drawImage(ghost.canvas,0,0,this.project.width,this.project.height);ctx.restore();
  }
  ctx.globalAlpha=1;ctx.restore();
 }
 dispose(){if(this.paintFrame)cancelAnimationFrame(this.paintFrame);this.paintFrame=0;this.disposed=true;this.generation++;this.cancelTask();this.previewWorker.dispose();this.staleFrames.clear();this.clearGhosts();this.surface.remove();}
}
