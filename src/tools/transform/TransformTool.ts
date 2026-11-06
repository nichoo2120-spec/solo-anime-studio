import type {Project,Layer,Point,Operation} from '../../core/model';
import {uid} from '../../core/model';
import type {StudioEngine} from '../../engine/StudioEngine';
import {blendOperation,makeCanvas,context,LayerRenderer} from '../../engine/renderer';
import {boundsOf,selectable,projectiveStroke,polyline} from '../../engine/strokeSelection';
import {finalGeometry} from '../../engine/geometryCache';
import {projectiveVector} from '../../engine/vector';
import {isLayerHeld} from '../../animation/timeline';
import {projectiveMapping,warpPoint,quadValid} from './math/homography';
import {boundsOfQuad,cloneQuad,centroid,rectQuad,affineTriangle,bilerp,insideQuad,type Pt,type Box,type Quad} from './math/matrix';
import {makeGrid,cloneGrid,gridPoint,insertMeshDivision,paintTriangles,dragFreePin,contourGrid,pointToGridUV,type Grid} from './math/meshWarp';
import {modeFns} from './modes';
import {flip} from './modes/Flip';
import type {Session,Mode,Gesture,Handle,PointerModifiers} from './modes/types';
import type {View} from '../../core/geometry';
import {smallTargetCursor,scaleDirectionCursor,compassFromDelta,handleCompass,rotationCursors,meshPointCursor,flipHorizontalCursor,flipVerticalCursor,flipPivotCursor} from './DirectionalCursors';
import {perspectiveArrowDirection} from './PerspectiveDirection';
import {deformDirection} from './SkewDistortDirection';

export type Interpolation='nearest'|'bilinear'|'bicubic';
export type Options={x:number;y:number;w:number;h:number;angle:number;skew:number;lock:boolean;interpolation:Interpolation;meshRows:number;meshCols:number;meshScope:'artwork'|'layer';meshMode:'uniform'|'adaptive'|'triangle';meshFalloff:number;meshPinRadius:number;meshPinBehavior:'local'|'neighbor';meshPointSize:number;meshShowGrid:boolean;meshShowPoints:boolean;meshSmooth:boolean;meshLockCorners:boolean;meshLockBorder:boolean;perspectiveGrid:boolean;perspectiveSnap:number;skewAxis:'free'|'horizontal'|'vertical';skewSnap:number};
export type Scope={frameIds:string[];layerIds:string[]};
function rotationHandle(quad:Quad,offset:number){
 const top=bilerp(quad,.5,0),center=centroid(quad);
 const dx=quad[1].x-quad[0].x,dy=quad[1].y-quad[0].y;
 const length=Math.hypot(dx,dy);
 if(!length)return {top,point:{x:top.x,y:top.y-offset}};
 const direction=dy*(top.x-center.x)-dx*(top.y-center.y)>=0?1:-1;
 return {top,point:{x:top.x+direction*dy/length*offset,y:top.y-direction*dx/length*offset}};
}
const EPS=0.00001;
const num=(n:number)=>Number.isFinite(n)?Math.round(n*100)/100:0;
function validPolygon(points:Pt[]):boolean{return points.length>=3&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));}
function clipPolygon(c:CanvasRenderingContext2D,points:Pt[]){if(!validPolygon(points))return;c.beginPath();points.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.clip();}
function bounds(points:Pt[]):Box{const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,w:Math.max(1,Math.max(...points.map(p=>p.x))-x),h:Math.max(1,Math.max(...points.map(p=>p.y))-y)};}
function inside(p:Pt,b:Box){return p.x>=b.x&&p.y>=b.y&&p.x<=b.x+b.w&&p.y<=b.y+b.h;}
const activeCanvas=(w:number,h:number)=>makeCanvas(Math.max(1,Math.ceil(w)),Math.max(1,Math.ceil(h)));
const cacheSurface=(w:number,h:number):OffscreenCanvas|HTMLCanvasElement=>typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.max(1,Math.ceil(w)),Math.max(1,Math.ceil(h))):activeCanvas(w,h);
const cacheContext=(c:OffscreenCanvas|HTMLCanvasElement):CanvasRenderingContext2D=>c.getContext('2d') as CanvasRenderingContext2D;
/** One transform session. No React updates, history writes or project renders happen in a pointer-move. */
export class TransformTool{
 readonly original:Project;readonly box:Box;readonly source:OffscreenCanvas|HTMLCanvasElement;readonly meshArtworkSource:OffscreenCanvas|HTMLCanvasElement;readonly meshArtworkBox:Box;readonly base:OffscreenCanvas|HTMLCanvasElement;readonly polygon:Pt[];readonly editableIds:Set<string>;
 readonly session:Session;
 interpolation:Interpolation='bicubic';private gesture:Gesture|null=null;private isDirty=false;private frame=0;private disposed=false;private layerId:string;
 private flipShowPivot=true;private flipPreviewOutline=true;private flipKeepPosition=false;private flipAxis:'h'|'v'|null=null;private flipTarget:'selection'|'layer'|'selected'|'visible'='selection';
 private backdrop:HTMLCanvasElement;private backdropCtx:CanvasRenderingContext2D;private backgroundDirty=true;private cursorKind='';private lastPointerForCursor:{x:number;y:number}|null=null;private perspectiveArrow:{pointer:Pt;direction:Pt}|null=null;private deformArrow:{pointer:Pt;direction:Pt;mode:'skew'|'distort'}|null=null;private previousDeformPoint:Pt|null=null;private previousPerspectivePoint:Pt|null=null;private overlay:HTMLCanvasElement;private ctx:CanvasRenderingContext2D;private view:View;private meshEdited=false;private placingMeshPin=false;private selectedFreePin=-1;private transformUndo:{grid:Grid;quad:Quad;pivot:Pt;dirty:boolean;meshEdited:boolean;selectedPin:number}[]=[];private transformRedo:typeof this.transformUndo=[];private direction:Pt|null=null;private layerOpacity=1;private layerBlend:Layer['blend'];private previewSubdivisions:number;
 onValues:((o:Options)=>void)|null=null;
 onNotice:((message:string)=>void)|null=null;
 constructor(public engine:StudioEngine,overlay:HTMLCanvasElement,backdrop:HTMLCanvasElement,view:View,public scope:Scope){
  this.original=engine.store.getSnapshot();this.layerId=this.original.activeLayerId;this.overlay=overlay;this.ctx=overlay.getContext('2d')!;this.backdrop=backdrop;this.backdropCtx=backdrop.getContext('2d')!;this.view=view;
  const active=this.original.layers.find(l=>l.id===this.layerId)!;this.layerOpacity=active.opacity;this.layerBlend=active.blend;
  if(active.locked||!active.visible||active.reference)throw new Error('Choose an unlocked, visible artwork layer.');
  this.editableIds=new Set(engine.strokeIds.filter(id=>active.operations.some(op=>op.id===id)));
  if(!this.editableIds.size&&active.kind==='vector'&&engine.selection.length>=3){
   for(const op of selectable(active)){const pts=polyline(op);if(pts.some(pt=>{let inside=false;const q=engine.selection;for(let i=0,j=q.length-1;i<q.length;j=i++){if((q[i].y>pt.y)!==(q[j].y>pt.y)&&pt.x<(q[j].x-q[i].x)*(pt.y-q[i].y)/(q[j].y-q[i].y)+q[i].x)inside=!inside;}return inside;}))this.editableIds.add(op.id);}
  }
  if(!this.editableIds.size&&engine.selection.length<3){
   for(const op of selectable(active))this.editableIds.add(op.id);
  }
  const selected=this.editableIds.size?selectable(active).filter(op=>this.editableIds.has(op.id)):[];
  const selection=engine.selection.length>=3?engine.selection:[];
  const fullCel=!selected.length&&!selection.length&&active.operations.some(op=>op.kind!=='vector'&&!(op.kind==='stroke'&&op.tool==='brush'));
  const sourceLayer=this.engine.renderer.get(active,this.original);
  const image=active.operations.length===1&&active.operations[0].kind==='image'?active.operations[0]:undefined;
  const singleTarget=scope.layerIds.every(id=>id===active.id)&&scope.frameIds.every(id=>id===this.original.animation?.activeFrameId);
  const bitmapBounds=fullCel&&singleTarget?(image?{x:image.x,y:image.y,w:image.width,h:image.height}:this.alphaBounds(sourceLayer,this.original.width,this.original.height)):null;
  const box=fullCel?bitmapBounds:selected.length?boundsOf(selected):selection.length?bounds(selection):boundsOf(selectable(active));
  this.box=box?{x:Math.max(0,Math.floor(box.x-2)),y:Math.max(0,Math.floor(box.y-2)),w:1,h:1}:{x:0,y:0,w:this.original.width,h:this.original.height};
  this.box.w=Math.max(1,Math.min(this.original.width-this.box.x,Math.ceil((box?.x??0)+(box?.w??this.original.width)+2)-this.box.x));
  this.box.h=Math.max(1,Math.min(this.original.height-this.box.y,Math.ceil((box?.y??0)+(box?.h??this.original.height)+2)-this.box.y));
  this.polygon=selected.length?rectQuad(this.box):selection.length?selection:rectQuad(this.box);
  this.source=cacheSurface(this.box.w,this.box.h);
  const allEditable=active.operations.every(op=>op.kind==='vector'||op.kind==='stroke'&&op.tool==='brush');
  const selectedRenderer=this.editableIds.size&&allEditable&&selected.length<active.operations.length?new LayerRenderer():null;
  const selectedLayer=selectedRenderer?{...active,operations:selected}:active;
  const sc=cacheContext(this.source);sc.drawImage(selectedRenderer?selectedRenderer.get(selectedLayer,this.original):sourceLayer,this.box.x,this.box.y,this.box.w,this.box.h,0,0,this.box.w,this.box.h);
  if(selection.length&&!selected.length){sc.save();sc.globalCompositeOperation='destination-in';sc.translate(-this.box.x,-this.box.y);clipPolygon(sc,selection);sc.fillStyle='white';sc.fill();sc.restore();}
  const artworkAlpha=this.alphaBounds(this.source,this.box.w,this.box.h)??{x:0,y:0,w:this.box.w,h:this.box.h};
  const ax=Math.max(0,Math.min(this.box.w-1,artworkAlpha.x));
  const ay=Math.max(0,Math.min(this.box.h-1,artworkAlpha.y));
  const aw=Math.max(1,Math.min(this.box.w-ax,artworkAlpha.w));
  const ah=Math.max(1,Math.min(this.box.h-ay,artworkAlpha.h));
  this.meshArtworkBox={x:this.box.x+ax,y:this.box.y+ay,w:aw,h:ah};
  this.meshArtworkSource=cacheSurface(aw,ah);
  cacheContext(this.meshArtworkSource).drawImage(this.source,ax,ay,aw,ah,0,0,aw,ah);
  // Capture source once; compose the unmodified surroundings once. Drag just redraws these 2 bitmaps.
  const resting=cacheSurface(this.original.width,this.original.height);
  if(allEditable&&selected.length===active.operations.length){/* All art moves: the resting layer is empty. */}
  else if(selectedRenderer&&allEditable)cacheContext(resting).drawImage(selectedRenderer.get({...active,operations:active.operations.filter(op=>!this.editableIds.has(op.id))},this.original),0,0);
  else{
   cacheContext(resting).drawImage(sourceLayer,0,0);
   const rc=cacheContext(resting);rc.save();rc.globalCompositeOperation='destination-out';clipPolygon(rc,this.polygon);rc.fillStyle='black';rc.fill();rc.restore();
  }
  selectedRenderer?.clear();
  this.base=cacheSurface(this.original.width,this.original.height);const bc=cacheContext(this.base);bc.fillStyle='#fff';bc.fillRect(0,0,this.base.width,this.base.height);
  for(const layer of [...this.original.layers].reverse()){
   if(!layer.visible)continue;bc.save();bc.globalAlpha=layer.opacity;bc.globalCompositeOperation=blendOperation(layer.blend);
   bc.drawImage(layer.id===this.layerId?resting:this.engine.renderer.get(layer,this.original),0,0);bc.restore();
  }
  const q=rectQuad(this.box),pivot=centroid(q),meshQuad=rectQuad(this.box),grid=makeGrid(meshQuad,4,4);
  this.session={quad:q,initial:cloneQuad(q),pivot,grid,initialGrid:makeGrid(meshQuad,4,4),mode:'free',angle:0,skew:0,lock:false,perspectiveGrid:true,perspectiveSnap:0,skewAxis:'free',skewSnap:0,meshFalloff:50,meshPinRadius:60,meshPinBehavior:'neighbor',meshShowGrid:true,meshShowPoints:true,meshSmooth:true,meshPointSize:100,meshLockCorners:false,meshLockBorder:false,meshMode:'adaptive',meshScope:'layer'};
  // The rectangular lattice is enough until Mesh is actually selected.
  this.previewSubdivisions=Math.max(4,Math.min(12,Math.round(Math.max(this.box.w,this.box.h)/130)));
  this.paint();
 }
 destroy(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.frame=0;this.source.width=0;this.source.height=0;this.meshArtworkSource.width=0;this.meshArtworkSource.height=0;this.base.width=0;this.base.height=0;this.overlay.style.cursor='';}
 setView(v:View){this.view=v;this.backgroundDirty=true;this.schedule();}
 setMode(m:Mode){if(m!=='mesh')this.placingMeshPin=false;this.perspectiveArrow=null;this.previousPerspectivePoint=null;this.deformArrow=null;this.previousDeformPoint=null;if(m==='mesh'&&this.session.mode!=='mesh'&&!this.meshEdited){const meshQuad=rectQuad(this.meshDocumentBounds(this.session.meshScope??'layer'));this.session.grid=this.buildScopedMesh(this.session.meshScope??'layer',this.session.grid.rows,this.session.grid.cols);this.session.initialGrid=cloneGrid(this.session.grid);}this.session.mode=m;this.engine.recorder.event('transform-mode',{mode:m,layerId:this.layerId,selectionIds:[...this.editableIds],bounds:this.box});this.lastPointerForCursor=null;this.setCursor(m==='move'?smallTargetCursor:'default');this.schedule();this.emit();}
 addMeshDivision(axis:'row'|'column',at:number=.5){
  const next=insertMeshDivision(this.session.grid,axis,at);
  if(!next)return false;
  this.checkpoint();this.session.grid=next;this.meshEdited=true;this.isDirty=true;this.schedule();this.emit();return true;
 }
 private checkpoint(){if(this.gesture)return;this.transformUndo.push({grid:cloneGrid(this.session.grid),quad:cloneQuad(this.session.quad),pivot:{...this.session.pivot},dirty:this.isDirty,meshEdited:this.meshEdited,selectedPin:this.selectedFreePin});if(this.transformUndo.length>160)this.transformUndo.shift();this.transformRedo=[];}
 private restoreTransform(snapshot:(typeof this.transformUndo)[number]){this.session.grid=cloneGrid(snapshot.grid);this.session.quad=cloneQuad(snapshot.quad);this.session.pivot={...snapshot.pivot};this.isDirty=snapshot.dirty;this.meshEdited=snapshot.meshEdited;this.selectedFreePin=Math.min(snapshot.selectedPin,(this.session.grid.pins?.length??0)-1);this.schedule();this.emit();}
 undoTransform(){if(this.gesture)this.cancelDrag();const before=this.transformUndo.pop();if(!before)return false;this.transformRedo.push({grid:cloneGrid(this.session.grid),quad:cloneQuad(this.session.quad),pivot:{...this.session.pivot},dirty:this.isDirty,meshEdited:this.meshEdited,selectedPin:this.selectedFreePin});this.restoreTransform(before);return true;}
 redoTransform(){const after=this.transformRedo.pop();if(!after)return false;this.transformUndo.push({grid:cloneGrid(this.session.grid),quad:cloneQuad(this.session.quad),pivot:{...this.session.pivot},dirty:this.isDirty,meshEdited:this.meshEdited,selectedPin:this.selectedFreePin});this.restoreTransform(after);return true;}
 deleteSelectedPin(){if(this.session.mode!=='mesh'||this.selectedFreePin<0||!this.session.grid.pins?.[this.selectedFreePin])return false;this.checkpoint();this.session.grid.pins.splice(this.selectedFreePin,1);this.selectedFreePin=-1;this.meshEdited=true;this.isDirty=true;this.schedule();this.emit();return true;}
 setMeshPinPlacement(active:boolean){this.placingMeshPin=active;this.engine.recorder.event('mesh-pin-placement',{enabled:active,count:this.session.grid.pins?.length??0});this.emit();}
 get meshPinPlacement(){return this.placingMeshPin;}
 removeLastMeshPin(){const pins=this.session.grid.pins;if(!pins?.length)return false;this.checkpoint();this.session.grid.pins=pins.slice(0,-1);this.meshEdited=true;this.schedule();this.emit();return true;}
 setMeshDimensions(rows:number,cols:number){if(this.meshEdited)return;const r=Math.max(2,Math.min(12,Math.round(rows))),c=Math.max(2,Math.min(12,Math.round(cols)));const meshQuad=rectQuad(this.meshDocumentBounds(this.session.meshScope??'layer'));this.session.grid=this.buildScopedMesh(this.session.meshScope??'layer',r,c);this.session.initialGrid=cloneGrid(this.session.grid);this.schedule();this.emit();}
 setInterpolation(i:Interpolation){this.interpolation=i;this.schedule();this.emit();}
 get values():Options{const b=boundsOfQuad(this.session.quad);return {x:num(b.x),y:num(b.y),w:num(b.w),h:num(b.h),angle:num(this.session.angle),skew:num(this.session.skew),lock:this.session.lock,interpolation:this.interpolation,meshRows:this.session.grid.rows,meshCols:this.session.grid.cols,meshScope:this.session.meshScope??'layer',meshMode:this.session.meshMode??'adaptive',meshFalloff:this.session.meshFalloff??50,meshPinRadius:this.session.meshPinRadius??60,meshPinBehavior:this.session.meshPinBehavior??'neighbor',meshPointSize:this.session.meshPointSize??100,meshShowGrid:this.session.meshShowGrid!==false,meshShowPoints:this.session.meshShowPoints!==false,meshSmooth:this.session.meshSmooth!==false,meshLockCorners:this.session.meshLockCorners===true,meshLockBorder:this.session.meshLockBorder===true,perspectiveGrid:this.session.perspectiveGrid!==false,perspectiveSnap:this.session.perspectiveSnap||0,skewAxis:this.session.skewAxis||'free',skewSnap:this.session.skewSnap||0};}
 private emit(){this.onValues?.(this.values);}
 setOption(key:keyof Options,value:number|boolean|Interpolation|'free'|'horizontal'|'vertical'|'local'|'neighbor'|'artwork'|'layer'|'uniform'|'adaptive'|'triangle'){const s=this.session,b=boundsOfQuad(s.quad);if(key==='lock'){s.lock=!!value;this.emit();return;}if(key==='interpolation'){this.setInterpolation(value as Interpolation);return;}if(key==='meshRows'){this.setMeshDimensions(Number(value),s.grid.cols);return;}if(key==='meshCols'){this.setMeshDimensions(s.grid.rows,Number(value));return;}if(key==='meshMode'){const mode=value==='uniform'||value==='triangle'?value:'adaptive';if((s.meshMode??'adaptive')!==mode){s.meshMode=mode; // Never discard an edited mesh when switching presentation/density presets.
 if(!this.meshEdited){const count=mode==='uniform'?3:mode==='triangle'?8:5;s.grid=this.buildScopedMesh('layer',count,count);s.initialGrid=cloneGrid(s.grid);this.selectedFreePin=-1;}
 this.schedule();this.emit();}return;}if(key==='meshScope'){const scope:'layer'='layer';if((s.meshScope??'layer')!==scope){s.meshScope=scope;s.grid=this.buildScopedMesh(scope,s.grid.rows,s.grid.cols);s.initialGrid=cloneGrid(s.grid);this.selectedFreePin=-1;this.meshEdited=false;this.schedule();this.emit();}return;}if(key==='meshFalloff'){s.meshFalloff=Math.max(0,Math.min(100,Number(value)));this.emit();this.schedule();return;}if(key==='meshPinRadius'){s.meshPinRadius=Math.max(5,Math.min(100,Number(value)));const pin=s.grid.pins?.[this.selectedFreePin>=0?this.selectedFreePin:(s.grid.pins.length-1)];if(pin)pin.radius=.035+s.meshPinRadius/100*.615;this.emit();this.schedule();return;}if(key==='meshPinBehavior'){s.meshPinBehavior=value==='neighbor'?'neighbor':'local';this.emit();this.schedule();return;}if(key==='meshPointSize'){s.meshPointSize=Math.max(50,Math.min(180,Number(value)));this.emit();this.schedule();return;}if(key==='meshShowGrid'){s.meshShowGrid=Boolean(value);this.schedule();this.emit();return;}if(key==='meshShowPoints'){s.meshShowPoints=Boolean(value);this.schedule();this.emit();return;}if(key==='meshSmooth'){s.meshSmooth=Boolean(value);this.schedule();this.emit();return;}if(key==='meshLockCorners'){s.meshLockCorners=Boolean(value);this.schedule();this.emit();return;}if(key==='meshLockBorder'){s.meshLockBorder=Boolean(value);this.schedule();this.emit();return;}if(key==='perspectiveGrid'){s.perspectiveGrid=Boolean(value);this.schedule();this.emit();return;}if(key==='perspectiveSnap'){s.perspectiveSnap=[0,15,30,45].includes(Number(value))?Number(value):0;this.emit();return;}if(key==='skewAxis'){s.skewAxis=['free','horizontal','vertical'].includes(String(value))?value as typeof s.skewAxis:'free';this.emit();this.schedule();return;}if(key==='skewSnap'){s.skewSnap=[0,5,15].includes(Number(value))?Number(value):0;this.emit();return;}
  if(typeof value!=='number'||!Number.isFinite(value))return;
  const center=centroid(s.quad);let next:Quad=cloneQuad(s.quad);
  if(key==='x'||key==='y'){const diff=value-(key==='x'?b.x:b.y);next=next.map(p=>({...p,[key]:p[key]+diff})) as Quad;s.pivot={...s.pivot,[key]:s.pivot[key]+diff};}
  if(key==='w'||key==='h'){const original=key==='w'?b.w:b.h,ratio=Math.max(.02,value)/Math.max(EPS,original);next=next.map(p=>({x:key==='w'?b.x+(p.x-b.x)*ratio:p.x,y:key==='h'?b.y+(p.y-b.y)*ratio:p.y})) as Quad;}
  if(key==='angle'){const delta=(value-s.angle)*Math.PI/180;next=next.map(p=>{const x=p.x-s.pivot.x,y=p.y-s.pivot.y;return {x:s.pivot.x+x*Math.cos(delta)-y*Math.sin(delta),y:s.pivot.y+x*Math.sin(delta)+y*Math.cos(delta)};}) as Quad;s.angle=value;}
  if(key==='skew'){const dx=(value-s.skew)*Math.PI/180;next=next.map(p=>({x:p.x+Math.tan(dx)*(p.y-center.y),y:p.y})) as Quad;s.skew=value;}
  const h=projectiveMapping(s.quad,next);if(h){s.grid.nodes=s.grid.nodes.map(p=>warpPoint(p,h));s.quad=next;}this.schedule();this.emit();}
 private toDoc(e:PointerEvent):Pt{const r=this.overlay.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,v=this.view,c=Math.cos(-v.rotation),s=Math.sin(-v.rotation),dx=x-v.x,dy=y-v.y;return {x:(dx*c-dy*s)/v.zoom,y:(dx*s+dy*c)/v.zoom};}
 private scalePx(){return 1/Math.max(.1,this.view.zoom);}
 hit(pt:Pt):Handle|null{const s=this.session,r=11*this.scalePx();if(s.mode==='mesh'){
   const meshRadius=r*Math.max(.75,(s.meshPointSize??100)/100);
   const pins=s.grid.pins??[];for(let i=pins.length-1;i>=0;i--){const pin=pins[i],location=gridPoint(s.grid,pin.u,pin.v);if(Math.hypot(pt.x-location.x,pt.y-location.y)<meshRadius)return {type:'pin',index:i};}
   let best=-1,min=meshRadius;for(let i=0;i<s.grid.nodes.length;i++){const u=s.grid.uStops?.[i%(s.grid.cols+1)]??(i%(s.grid.cols+1))/s.grid.cols,v=s.grid.vStops?.[Math.floor(i/(s.grid.cols+1))]??Math.floor(i/(s.grid.cols+1))/s.grid.rows;const p=gridPoint(s.grid,u,v),d=Math.hypot(pt.x-p.x,pt.y-p.y);if(d<min){min=d;best=i;}}return best<0?null:{type:'node',index:best};}
  if(Math.hypot(pt.x-s.pivot.x,pt.y-s.pivot.y)<r&&['pivot','skew','distort','flip'].includes(s.mode))return {type:'pivot',index:0};
  if(s.mode==='flip')return null;
  const q=s.quad;
  if(s.mode==='rotate'||s.mode==='free'){const {point}=rotationHandle(q,32*this.scalePx());if(Math.hypot(point.x-pt.x,point.y-pt.y)<r*1.8)return {type:'rotate',index:0};}
  if(!['move','rotate','pivot'].includes(s.mode)){for(let i=0;i<4;i++)if(Math.hypot(q[i].x-pt.x,q[i].y-pt.y)<r)return {type:'corner',index:i};if(['free','scale','skew','perspective','distort'].includes(s.mode))for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(Math.hypot(m.x-pt.x,m.y-pt.y)<r)return {type:'edge',index:i};}}
  if(s.mode==='perspective'&&Math.hypot(pt.x-centroid(q).x,pt.y-centroid(q).y)<r*1.45)return {type:'inside',index:0};
  if(s.mode==='free'){for(let i=0;i<4;i++){const d=Math.hypot(q[i].x-pt.x,q[i].y-pt.y);if(d>r&&d<r*2.3&&!inside(pt,boundsOfQuad(q)))return {type:'rotate',index:i};}}
  if(s.mode==='rotate'&&inside(pt,boundsOfQuad(q)))return {type:'rotate',index:0};
  if((s.mode==='perspective'?insideQuad(pt,q):inside(pt,boundsOfQuad(q))))return {type:'inside',index:0};
  return null;
 }
 /** Set cursor only when its direction changes; no canvas or React work. */
 private setCursor(css:string){if(this.cursorKind===css)return;this.cursorKind=css;this.overlay.style.cursor=css;}
 /** Free Transform reuses the same cursor artwork as each dedicated transform mode. */
 private activeGestureType(): 'move'|'scale'|'rotate'|null{
  const type=this.gesture?.handle.type, mode=this.session.mode;
  if(mode==='move')return 'move';
  if(mode==='scale')return 'scale';
  if(mode==='rotate')return 'rotate';
  if(mode!=='free')return null;
  return type==='rotate'?'rotate':type==='edge'||type==='corner'?'scale':type==='inside'?'move':null;
 }
 private hoverCursor(handle:Handle|null){const mode=this.session.mode;
  if(mode==='move'||(mode==='free'||mode==='perspective')&&handle?.type==='inside'){this.setCursor(handle?smallTargetCursor:'default');return;}
  if(mode==='scale'||mode==='free'&&(handle?.type==='corner'||handle?.type==='edge')){
   const direction=handle&&(handle.type==='edge'||handle.type==='corner')?handleCompass(handle.type,handle.index):null;
   this.setCursor(direction?scaleDirectionCursor(direction):'default');return;
  }
  if(mode==='perspective'){this.setCursor(handle?.type==='corner'||handle?.type==='edge'?'crosshair':handle?.type==='inside'?smallTargetCursor:'default');return;}
  if(mode==='mesh'){this.setCursor(handle?.type==='node'||handle?.type==='pin'?meshPointCursor:'default');return;}
  if(mode==='flip'){this.setCursor(handle?.type==='pivot'?flipPivotCursor:'default');return;}
  if(mode==='skew'||mode==='distort'){this.setCursor(handle?.type==='inside'?smallTargetCursor:handle?'crosshair':'default');return;}
  if(mode==='rotate'||mode==='free'&&handle?.type==='rotate'){
   this.setCursor(handle?rotationCursors.clockwise:'default');return;
  }
  this.setCursor(handle?.type==='corner'||handle?.type==='edge'?'nwse-resize':handle?.type==='pivot'||handle?.type==='node'?'crosshair':handle?'move':'default');
 }

 down(e:PointerEvent){if(e.button!==0)return;const pt=this.toDoc(e);
  if(this.session.mode==='mesh'&&this.placingMeshPin){
   const grid=this.session.grid;let bestU=.5,bestV=.5,best=Infinity;
   for(let iy=1;iy<40;iy++)for(let ix=1;ix<40;ix++){
    const u=ix/40,v=iy/40,p=gridPoint(grid,u,v),dist=(p.x-pt.x)**2+(p.y-pt.y)**2;
    if(dist<best){best=dist;bestU=u;bestV=v;}
   }
   for(let step=.0125;step>.0001;step/=2)for(const [du,dv] of [[step,0],[-step,0],[0,step],[0,-step]]){
    const u=Math.max(.025,Math.min(.975,bestU+du)),v=Math.max(.025,Math.min(.975,bestV+dv)),p=gridPoint(grid,u,v),dist=(p.x-pt.x)**2+(p.y-pt.y)**2;
    if(dist<best){best=dist;bestU=u;bestV=v;}
   }
   if(best<Math.max(100,625*this.scalePx()**2)&& (grid.pins?.length??0)<32){
    this.checkpoint();
    grid.pins=[...(grid.pins??[]),{u:bestU,v:bestV,dx:0,dy:0,radius:.035+(this.session.meshPinRadius??60)/100*.615}];
    this.selectedFreePin=grid.pins.length-1;this.meshEdited=true;this.engine.recorder.event('mesh-pin-add',{u:bestU,v:bestV,pins:grid.pins.length});this.schedule();this.emit();
   }
   e.preventDefault();e.stopPropagation();return;
  }
  if(this.session.mode==='mesh'&&e.altKey){
   // Place a custom control intersection where the user clicks, by finding its
   // UV on the current warped surface. Existing cells are not reset.
   const grid=this.session.grid;
   let bestU=.5,bestV=.5,best=Infinity;
   for(let iy=0;iy<=24;iy++)for(let ix=0;ix<=24;ix++){
    const u=ix/24,v=iy/24,p=gridPoint(grid,u,v),dist=(p.x-pt.x)**2+(p.y-pt.y)**2;
    if(dist<best){best=dist;bestU=u;bestV=v;}
   }
   let step=1/24;
   for(let k=0;k<6;k++){step/=2;for(const [du,dv] of [[step,0],[-step,0],[0,step],[0,-step],[step,step],[-step,-step],[step,-step],[-step,step]]){
    const u=Math.max(.001,Math.min(.999,bestU+du)),v=Math.max(.001,Math.min(.999,bestV+dv)),p=gridPoint(grid,u,v),dist=(p.x-pt.x)**2+(p.y-pt.y)**2;
    if(dist<best){best=dist;bestU=u;bestV=v;}
   }}
   const a=insertMeshDivision(grid,'row',bestV);
   const b=insertMeshDivision(a??grid,'column',bestU);
   if(b||a){this.checkpoint();this.session.grid=b??a!;this.meshEdited=true;this.schedule();this.emit();}
   e.preventDefault();e.stopPropagation();return;
  }
  const hit=this.hit(pt);if(!hit)return;if(this.session.mode==='mesh'&&hit.type==='pin'){this.selectedFreePin=hit.index;const radius=this.session.grid.pins?.[hit.index]?.radius;if(radius!==undefined)this.session.meshPinRadius=Math.round((radius-.035)/.615*100);this.emit();}this.checkpoint();this.gesture={point:pt,quad:cloneQuad(this.session.quad),grid:cloneGrid(this.session.grid),pivot:{...this.session.pivot},angle:this.session.angle,skew:this.session.skew,index:hit.index,handle:hit};this.overlay.setPointerCapture(e.pointerId);
  this.engine.recorder.event('transform-drag-start',{mode:this.session.mode,handle:hit.type,index:hit.index,start:pt,quad:this.session.quad});this.lastPointerForCursor={x:e.clientX,y:e.clientY};
  this.previousPerspectivePoint=pt;this.perspectiveArrow=null;this.previousDeformPoint=pt;this.deformArrow=null;
  const kind=this.activeGestureType();
  if(kind==='move')this.setCursor(smallTargetCursor);
  else if(kind==='scale'&&(hit.type==='edge'||hit.type==='corner'))this.setCursor(scaleDirectionCursor(handleCompass(hit.type,hit.index)));
  else if(kind==='rotate')this.setCursor(rotationCursors.clockwise);
  else if(this.session.mode==='mesh'&&(hit.type==='node'||hit.type==='pin'))this.setCursor(meshPointCursor);
  e.preventDefault();e.stopPropagation();}
 move(e:PointerEvent){const g=this.gesture;if(!g){this.hoverCursor(this.hit(this.toDoc(e)));return;}if(!this.overlay.hasPointerCapture(e.pointerId))return;e.preventDefault();
  const kind=this.activeGestureType();
  if(kind==='scale'){
   const previous=this.lastPointerForCursor,dx=e.clientX-(previous?.x??e.clientX),dy=e.clientY-(previous?.y??e.clientY);
   if(Math.hypot(dx,dy)>=2){this.setCursor(scaleDirectionCursor(compassFromDelta(dx,dy)));this.lastPointerForCursor={x:e.clientX,y:e.clientY};}
  }else if(kind==='move')this.setCursor(smallTargetCursor);
  else if(kind==='rotate'){
   // Direction comes from angular travel around the pivot, not the straight pointer delta.
   const prev=this.lastPointerForCursor;
   const rect=this.overlay.getBoundingClientRect(),v=this.view,pivot=this.session.pivot;
   const px=rect.left+v.x+Math.cos(v.rotation)*pivot.x*v.zoom-Math.sin(v.rotation)*pivot.y*v.zoom;
   const py=rect.top+v.y+Math.sin(v.rotation)*pivot.x*v.zoom+Math.cos(v.rotation)*pivot.y*v.zoom;
   if(prev){const a0=Math.atan2(prev.y-py,prev.x-px),a1=Math.atan2(e.clientY-py,e.clientX-px);
    const turn=Math.atan2(Math.sin(a1-a0),Math.cos(a1-a0));
    if(Math.abs(turn)>.004){this.setCursor(turn<0?rotationCursors.counterClockwise:rotationCursors.clockwise);this.lastPointerForCursor={x:e.clientX,y:e.clientY};}
   }
  }
const s=this.session,pt=this.toDoc(e);const keys:PointerModifiers={shift:e.shiftKey,alt:e.altKey,ctrl:e.ctrlKey||e.metaKey};let mode:Mode=s.mode;if(mode==='free'&&g.handle.type==='corner'&&keys.ctrl)mode=keys.shift?'perspective':'distort';else if(mode==='free'&&g.handle.type==='edge'&&keys.ctrl)mode='skew';
  // Perspective direction follows the plane's SLANTED local axes (or corner
  // diagonals), never the flat compass. One tiny arrow at the pen tip; there
  // are no React updates, cursor SVG allocations or additional canvas passes.
  if(mode==='perspective'&&(g.handle.type==='corner'||g.handle.type==='edge'||g.handle.type==='inside')){
   const last=this.previousPerspectivePoint??g.point;
   const step={x:pt.x-last.x,y:pt.y-last.y};
   if(Math.hypot(step.x,step.y)*Math.max(.1,this.view.zoom)>=1.3){
    const projected=perspectiveArrowDirection(s.quad,g.handle,step);
    if(projected)this.perspectiveArrow={pointer:pt,direction:projected};
    this.previousPerspectivePoint=pt;
   }else if(this.perspectiveArrow)this.perspectiveArrow.pointer=pt;
   this.setCursor('crosshair');
  }else{this.perspectiveArrow=null;this.previousPerspectivePoint=null;}
  if((mode==='skew'||mode==='distort')&&['corner','edge'].includes(g.handle.type)){
   const last=this.previousDeformPoint??g.point;
   const step={x:pt.x-last.x,y:pt.y-last.y};
   if(Math.hypot(step.x,step.y)*Math.max(.1,this.view.zoom)>=1.2){
    const direction=deformDirection(s.quad,g.handle,step,mode);
    if(direction)this.deformArrow={pointer:pt,direction,mode};
    this.previousDeformPoint=pt;
   }else if(this.deformArrow)this.deformArrow.pointer=pt;
   this.setCursor('crosshair');
  }else{this.deformArrow=null;this.previousDeformPoint=null;}
  if(g.handle.type==='pivot'&&['skew','distort','flip'].includes(mode))modeFns.pivot(s,g,pt,keys);
  else if(mode==='mesh'&&g.handle.type==='pin'){}
  else if(mode==='move'||mode==='rotate'||mode==='scale'||mode==='perspective'||mode==='skew'||mode==='distort'||mode==='mesh'||mode==='pivot'||mode==='free')modeFns[mode](s,g,pt,keys);
  if(mode==='mesh'&&g.handle.type==='pin'){
   const pin=g.grid.pins?.[g.handle.index];if(pin){
    const displacement={x:pt.x-g.point.x,y:pt.y-g.point.y};
    s.grid=dragFreePin(g.grid,g.handle.index,displacement.x,displacement.y,s.meshPinBehavior??'neighbor',s.meshLockCorners,s.meshLockBorder);
    const stride=s.grid.cols+1,n=s.grid.nodes;
    s.quad=[n[0],n[s.grid.cols],n[n.length-1],n[s.grid.rows*stride]];
   }
  }
  if(mode==='mesh'&&Math.hypot(pt.x-g.point.x,pt.y-g.point.y)>1e-7)this.meshEdited=true;
  if((mode==='perspective'||mode==='skew'||mode==='distort')&&this.meshEdited){const h=projectiveMapping(g.quad,s.quad);if(h)s.grid={rows:g.grid.rows,cols:g.grid.cols,mode:g.grid.mode,nodes:g.grid.nodes.map(v=>warpPoint(v,h)),sourceNodes:g.grid.sourceNodes?.map(v=>({...v})),uStops:g.grid.uStops?.slice(),vStops:g.grid.vStops?.slice(),pins:g.grid.pins?.map(pin=>({...pin}))};}
  if(!s.quad.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||(['perspective','skew','distort'].includes(mode)&&!quadValid(s.quad)))s.quad=cloneQuad(g.quad);
  this.direction={x:pt.x-g.point.x,y:pt.y-g.point.y};if(mode!=='pivot'&&g.handle.type!=='pivot')this.isDirty=true;this.schedule();
 }
 up(e:PointerEvent){if(!this.gesture)return;const handle=this.gesture.handle;this.move(e);this.engine.recorder.event('transform-drag-end',{mode:this.session.mode,handle:handle.type,index:handle.index,quad:this.session.quad,meshNodes:this.session.mode==='mesh'?this.session.grid.nodes:undefined,freePins:this.session.mode==='mesh'?this.session.grid.pins:undefined,pinBehavior:this.session.mode==='mesh'?this.session.meshPinBehavior:undefined});this.gesture=null;this.direction=null;this.perspectiveArrow=null;this.previousPerspectivePoint=null;this.deformArrow=null;this.previousDeformPoint=null;this.lastPointerForCursor=null;this.hoverCursor(this.hit(this.toDoc(e)));this.emit();this.schedule();}
 cancelDrag(){if(!this.gesture)return;const g=this.gesture;this.session.quad=cloneQuad(g.quad);this.session.grid=cloneGrid(g.grid);this.session.pivot={...g.pivot};this.session.angle=g.angle;this.session.skew=g.skew;this.gesture=null;this.direction=null;this.perspectiveArrow=null;this.previousPerspectivePoint=null;this.deformArrow=null;this.previousDeformPoint=null;this.lastPointerForCursor=null;this.setCursor(this.session.mode==='move'?smallTargetCursor:'default');this.schedule();this.emit();}
 setFlipTarget(target:'selection'|'layer'|'selected'|'visible'){this.flipTarget=target;this.emit();this.schedule();}
 setFlipKeepPosition(value:boolean){this.flipKeepPosition=value;this.emit();this.schedule();}
 setFlipDisplay(key:'showPivot'|'previewOutline',value:boolean){if(key==='showPivot')this.flipShowPivot=value;else this.flipPreviewOutline=value;this.schedule();}
 resetPivot(){this.session.pivot=centroid(this.session.quad);this.emit();this.schedule();}
 setPivotFraction(x:number,y:number){const q=this.session.quad;this.session.pivot=bilerp(q,Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y)));this.emit();this.schedule();}
 setPivotPoint(x:number,y:number){if(!Number.isFinite(x)||!Number.isFinite(y))return;this.session.pivot={x,y};this.emit();this.schedule();}
 get pivot(){return {...this.session.pivot};}

 nudge(dx:number,dy:number){const s=this.session;s.quad=s.quad.map(p=>({x:p.x+dx,y:p.y+dy})) as Quad;s.pivot={x:s.pivot.x+dx,y:s.pivot.y+dy};s.grid.nodes=s.grid.nodes.map(p=>({x:p.x+dx,y:p.y+dy}));this.isDirty=true;this.emit();this.schedule();}
 flip(axis:'h'|'v'){this.flipAxis=this.flipAxis===axis?null:axis;if(this.flipKeepPosition){const pivot=this.session.pivot;this.session.pivot=centroid(this.session.quad);flip(this.session,axis);this.session.pivot=pivot;}else flip(this.session,axis);this.isDirty=true;this.setCursor(axis==='h'?flipHorizontalCursor:flipVerticalCursor);this.emit();this.schedule();}
 handleKey(e:KeyboardEvent):boolean{if(e.target instanceof HTMLElement&&!!e.target.closest('input,textarea,select,[contenteditable=true]'))return false;if(e.key==='Delete'||e.key==='Backspace')return this.deleteSelectedPin();if(e.repeat)return false;const k=e.key.toLowerCase();let mode:Mode|undefined;
  if(e.ctrlKey&&e.shiftKey&&k==='p')mode='perspective';else if(!e.ctrlKey&&!e.altKey){if(k==='t'&&e.shiftKey)mode='scale';else if(k==='d'&&e.shiftKey)mode='distort';else if(!e.shiftKey){mode=({t:'free',v:'move',r:'rotate',m:'mesh',k:'skew'} as Record<string,Mode>)[k];}}
  if(mode){this.setMode(mode);return true;}if(k==='escape'){this.cancelDrag();return true;}if(k==='enter')return false;
  if(!e.ctrlKey&&!e.altKey&&k==='h'){this.flip(e.shiftKey?'v':'h');return true;}
  if(['arrowleft','arrowright','arrowup','arrowdown'].includes(k)&&!e.ctrlKey&&!e.altKey){const v=e.shiftKey?10:1;this.nudge(k==='arrowleft'?-v:k==='arrowright'?v:0,k==='arrowup'?-v:k==='arrowdown'?v:0);return true;}
  return false;
 }
 private schedule(){if(this.disposed||this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.paint();});}
 private resize(){const dpr=Math.min(2,window.devicePixelRatio||1),rect=this.overlay.getBoundingClientRect(),w=Math.max(1,Math.ceil(rect.width*dpr)),h=Math.max(1,Math.ceil(rect.height*dpr));if(this.overlay.width!==w){this.overlay.width=w;this.backgroundDirty=true;}if(this.overlay.height!==h){this.overlay.height=h;this.backgroundDirty=true;}if(this.backdrop.width!==w){this.backdrop.width=w;this.backgroundDirty=true;}if(this.backdrop.height!==h){this.backdrop.height=h;this.backgroundDirty=true;}return dpr;}
 private drawingSurface(ctx:CanvasRenderingContext2D,dpr:number,background=false){const v=this.view;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.overlay.width/dpr,this.overlay.height/dpr);if(background){ctx.fillStyle='#20272c';ctx.fillRect(0,0,this.overlay.width/dpr,this.overlay.height/dpr);}ctx.save();ctx.translate(v.x,v.y);ctx.rotate(v.rotation);ctx.scale(v.zoom,v.zoom);}

 private alphaBounds(source:CanvasImageSource,w:number,h:number):Box|null{const sample=activeCanvas(w,h),sc=context(sample);sc.clearRect(0,0,w,h);sc.drawImage(source,0,0,w,h);const data=sc.getImageData(0,0,w,h).data;let minX=w,minY=h,maxX=-1,maxY=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>0){if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}return maxX>=minX&&maxY>=minY?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:null;}
 private meshDocumentBounds(_scope:'artwork'|'layer'=(this.session.meshScope??'layer')):Box{return this.meshArtworkBox;}
 private buildScopedMesh(scope:'artwork'|'layer',rows:number,cols:number):Grid{
  const quad=rectQuad(this.meshDocumentBounds(scope));
  const mode=this.session.meshMode??'adaptive';
  const freeze=(grid:Grid)=>{grid.sourceNodes=grid.sourceNodes??grid.nodes.map(p=>({...p}));return grid;};
  if(scope==='layer')return freeze(makeGrid(quad,rows,cols,mode==='triangle'?'triangle':'uniform'));
  if(mode==='uniform')return freeze(makeGrid(quad,rows,cols,'uniform'));
  const image=cacheContext(this.meshArtworkSource).getImageData(0,0,this.meshArtworkSource.width,this.meshArtworkSource.height);
  const grid=contourGrid(quad,image.data,image.width,image.height,rows,cols);
  grid.mode=mode;
  return freeze(grid);
 }

 private meshRenderInput(source:CanvasImageSource,srcBox:Box,scope:'artwork'|'layer'=(this.session.meshScope??'layer')):{source:CanvasImageSource;box:Box}{
  // Both single-layer mesh presets crop the isolated active cel, not the document.
 // The removed Artwork Only UI must not silently reappear as a separate scope. 
  if(source===this.source&&srcBox.x===this.box.x&&srcBox.y===this.box.y&&srcBox.w===this.box.w&&srcBox.h===this.box.h)return {source:this.meshArtworkSource,box:this.meshArtworkBox};
  const alpha=this.alphaBounds(source,Math.max(1,Math.round(srcBox.w)),Math.max(1,Math.round(srcBox.h)));
  if(!alpha)return {source,box:srcBox};
  const x=Math.max(0,Math.min(Math.max(0,Math.round(srcBox.w)-1),alpha.x)),y=Math.max(0,Math.min(Math.max(0,Math.round(srcBox.h)-1),alpha.y));
  const w=Math.max(1,Math.min(Math.round(srcBox.w)-x,alpha.w)),h=Math.max(1,Math.min(Math.round(srcBox.h)-y,alpha.h));
  const cropped=cacheSurface(w,h);cacheContext(cropped).drawImage(source,x,y,w,h,0,0,w,h);
  return {source:cropped,box:{x:srcBox.x+x,y:srcBox.y+y,w,h}};
 }
 private currentOperations(layer:Layer,frameId:string){return this.original.animation?.frames.find(f=>f.id===frameId)?.drawings[layer.id]??layer.operations;}
 private isolatedLayerBitmap(layer:Layer,operations:Operation[]){return this.engine.renderer.get({...layer,operations},this.original);} 
 private flipLayerIds(){const p=this.original;return new Set(this.flipTarget==='visible'?p.layers.filter(l=>l.visible&&!l.locked&&!l.reference).map(l=>l.id):this.flipTarget==='selected'?(this.scope.layerIds.length?this.scope.layerIds:[this.layerId]):[this.layerId]);}
 private paintFlippedBitmap(c:CanvasRenderingContext2D,source:CanvasImageSource,area:Box,axis:'h'|'v',keepPosition:boolean){
  // Paint source at its own document coordinates. A cropped source is never
  // confused with a zero-origin transform box.
  const center=keepPosition?{x:area.x+area.w/2,y:area.y+area.h/2}:this.session.pivot;
  c.save();c.translate(center.x,center.y);c.scale(axis==='h'?-1:1,axis==='v'?-1:1);c.translate(-center.x,-center.y);c.drawImage(source,area.x,area.y,area.w,area.h);c.restore();
 }
 private flipPreviewScene(c:CanvasRenderingContext2D){
  if(this.session.mode!=='flip'||!this.flipAxis)return false;
  const selected=this.flipLayerIds(),frameId=this.original.animation?.activeFrameId??'';
  c.save();c.fillStyle='#fff';c.fillRect(0,0,this.original.width,this.original.height);
  for(const layer of [...this.original.layers].reverse()){
   if(!layer.visible)continue;
   const target=selected.has(layer.id),operations=this.currentOperations(layer,frameId);
   const bitmap=target?this.isolatedLayerBitmap(layer,operations):this.engine.renderer.get(layer,this.original);
   c.save();c.globalAlpha=layer.opacity;c.globalCompositeOperation=blendOperation(layer.blend);
   if(target){const area=this.flipKeepPosition?(this.alphaBounds(bitmap,this.original.width,this.original.height)??{x:0,y:0,w:this.original.width,h:this.original.height}):{x:0,y:0,w:this.original.width,h:this.original.height};
    const cropped=activeCanvas(area.w,area.h);context(cropped).drawImage(bitmap,area.x,area.y,area.w,area.h,0,0,area.w,area.h);
    this.paintFlippedBitmap(c,cropped,area,this.flipAxis,this.flipKeepPosition);
   }else c.drawImage(bitmap,0,0);
   c.restore();
  }c.restore();return true;
 }
 /** The complete scene is static for a transform session. Never repaint all 4K layers on pen movement. */
 private paintBackground(dpr:number){const c=this.backdropCtx;this.drawingSurface(c,dpr,true);c.fillStyle='#fff';c.fillRect(0,0,this.original.width,this.original.height);c.drawImage(this.base,0,0);c.restore();this.backgroundDirty=false;}
 /** Only the selected artwork and lightweight handles move on this transparent overlay. */
 paint(){if(this.disposed)return;const dpr=this.resize();if(this.backgroundDirty)this.paintBackground(dpr);const c=this.ctx;this.drawingSurface(c,dpr);c.save();c.beginPath();c.rect(0,0,this.original.width,this.original.height);c.clip();if(this.session.mode==='flip'&&this.flipAxis&&this.flipTarget!=='selection'){this.flipPreviewScene(c);}else{c.globalAlpha=this.layerOpacity;c.globalCompositeOperation=blendOperation(this.layerBlend);// An untouched mesh is only an overlay. Render the exact original selection,
   // not an alpha-cropped/resampled mesh texture, until a vertex actually moves.
   const previewSource={source:this.source,box:this.box};
   this.paintArtwork(c,previewSource.source,previewSource.box);}c.restore();
  if(this.original.settings.guides){c.save();c.strokeStyle='#8cabb845';c.lineWidth=1/Math.max(.1,this.view.zoom);const inset=Math.min(this.original.width,this.original.height)*.035;c.strokeRect(inset,inset,this.original.width-2*inset,this.original.height-2*inset);c.restore();}
  this.paintHandles(c);c.restore();}
 private meshBounds():Box{
  // Hermite surfaces can extend beyond their control vertices. Include the
  // curved boundary/interior so baking a stretched mesh does not crop the ink.
  const points:Pt[]=[];for(let y=0;y<=48;y++)for(let x=0;x<=48;x++)points.push(gridPoint(this.session.grid,x/48,y/48));
  return bounds(points.concat(this.session.grid.nodes));
 }
 private meshIsUndeformed():boolean{
  const g=this.session.grid,initial=this.session.initialGrid;
  if(g.rows!==initial.rows||g.cols!==initial.cols||g.nodes.length!==initial.nodes.length)return false;
  if((g.pins??[]).some(pin=>Math.abs(pin.dx)>1e-7||Math.abs(pin.dy)>1e-7))return false;
  return g.nodes.every((node,i)=>Math.hypot(node.x-initial.nodes[i].x,node.y-initial.nodes[i].y)<1e-7);
 }
 private paintArtwork(c:CanvasRenderingContext2D,source:CanvasImageSource,srcBox:Box){const s=this.session;c.save();c.imageSmoothingEnabled=this.interpolation!=='nearest';c.imageSmoothingQuality=this.interpolation==='bicubic'?'high':'low';
  const origin=s.initial,dest=s.quad;
  // A freshly constructed contour lattice is a control overlay, NOT an image warp.
  // Painting identity as hundreds of affine triangles resamples the ink and may
  // alter line thickness, split strokes, or erase content beyond the envelope.
  // Preserve the exact source pixels until a real deformation is made.
  if((s.mode==='mesh'||this.meshEdited)&&this.meshIsUndeformed()){
   c.drawImage(source,srcBox.x,srcBox.y);c.restore();return;
  }
  if(s.mode!=='mesh'&&!this.meshEdited&&s.grid.nodes.every((p,i)=>{const col=i%(s.grid.cols+1),row=Math.floor(i/(s.grid.cols+1));const expected=bilerp(dest,col/Math.max(1,s.grid.cols),row/Math.max(1,s.grid.rows));return Math.hypot(p.x-expected.x,p.y-expected.y)<1e-4;})){
   const affine=affineTriangle(origin[0],origin[1],origin[3],dest[0],dest[1],dest[3]);
   const affineExpected=affine&&{x:affine[0]*origin[2].x+affine[2]*origin[2].y+affine[4],y:affine[1]*origin[2].x+affine[3]*origin[2].y+affine[5]};
   if(affine&&affineExpected&&Math.hypot(affineExpected.x-dest[2].x,affineExpected.y-dest[2].y)<.01){c.transform(...affine);c.drawImage(source,srcBox.x,srcBox.y);c.restore();return;}
  }
  const n=this.previewSubdivisions;
  let grid:Grid;
  if(s.mode==='mesh'||this.meshEdited)grid=s.grid;
  else{const h=projectiveMapping(origin,dest);grid=makeGrid(origin,n,n);grid.nodes=grid.nodes.map(p=>h?warpPoint(p,h):bilerp(dest,(p.x-srcBox.x)/Math.max(1,srcBox.w),(p.y-srcBox.y)/Math.max(1,srcBox.h)));}
  paintTriangles(c,source,srcBox,grid);c.restore();
 }
 private paintHandles(c:CanvasRenderingContext2D){const s=this.session,q=s.quad,v=this.view,z=Math.max(.1,v.zoom);c.save();c.lineWidth=1/z;c.strokeStyle='#3fe0f0';c.fillStyle='#0e1a22';c.setLineDash([5/z,4/z]);c.beginPath();q.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(s.mode!=='flip'||this.flipPreviewOutline)c.stroke();c.setLineDash([]);
  const node=(p:Pt,r=4)=>{c.fillRect(p.x-r/z,p.y-r/z,2*r/z,2*r/z);c.strokeRect(p.x-r/z,p.y-r/z,2*r/z,2*r/z);};
  if(['perspective','skew','distort'].includes(s.mode))this.paintPerspectiveGrid(c,z);
  if(s.mode==='mesh'){const stride=s.grid.cols+1,pointScale=(s.meshPointSize??100)/100,pointRadius=3.1*pointScale;
   if(s.meshShowGrid!==false){c.strokeStyle='#3fe0f06b';c.lineWidth=.95/z;
    for(let y=0;y<=s.grid.rows;y++){const pts=[] as Pt[];
     const v=s.grid.vStops?.[y]??y/s.grid.rows;
     if(s.grid.pins?.length){for(let x=0;x<=s.grid.cols*16;x++)pts.push(gridPoint(s.grid,x/(s.grid.cols*16),v));}
     else for(let x=0;x<=s.grid.cols;x++)pts.push(s.grid.nodes[y*stride+x]);
     this.paintMeshLine(c,pts,!!s.meshSmooth&&!s.grid.pins?.length);}
    for(let x=0;x<=s.grid.cols;x++){const pts=[] as Pt[];
     const u=s.grid.uStops?.[x]??x/s.grid.cols;
     if(s.grid.pins?.length){for(let y=0;y<=s.grid.rows*16;y++)pts.push(gridPoint(s.grid,u,y/(s.grid.rows*16)));}
     else for(let y=0;y<=s.grid.rows;y++)pts.push(s.grid.nodes[y*stride+x]);
     this.paintMeshLine(c,pts,!!s.meshSmooth&&!s.grid.pins?.length);}
    if(s.meshMode==='triangle'){for(let y=0;y<s.grid.rows;y++)for(let x=0;x<s.grid.cols;x++){const k=y*stride+x,a=s.grid.nodes[k],b=s.grid.nodes[k+1],c2=s.grid.nodes[k+stride+1],d=s.grid.nodes[k+stride];c.beginPath();c.moveTo(a.x,a.y);c.lineTo(c2.x,c2.y);c.stroke();if((x+y)%2===0){c.beginPath();c.moveTo(b.x,b.y);c.lineTo(d.x,d.y);c.stroke();}}}
   }
   const activeIndex=this.gesture?.handle.type==='node'?this.gesture.handle.index:-1;
   if(activeIndex>=0&&(s.meshFalloff??0)>0){const u=s.grid.uStops?.[activeIndex%(s.grid.cols+1)]??(activeIndex%(s.grid.cols+1))/s.grid.cols,v=s.grid.vStops?.[Math.floor(activeIndex/(s.grid.cols+1))]??Math.floor(activeIndex/(s.grid.cols+1))/s.grid.rows;const center=gridPoint(s.grid,u,v);const rx=this.meshInfluenceRadiusX(),ry=this.meshInfluenceRadiusY();c.save();c.strokeStyle='#3fe0f04a';c.fillStyle='#3fe0f012';c.lineWidth=1/z;c.beginPath();c.ellipse(center.x,center.y,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();c.restore();}
   if(s.grid.pins?.length){for(let i=0;i<s.grid.pins.length;i++){
    const pin=s.grid.pins[i],p=gridPoint(s.grid,pin.u,pin.v),size=6/z;
    c.save();c.strokeStyle=i===this.selectedFreePin?'#e4ffff':'#8afaff';c.lineWidth=1.4/z;c.fillStyle=i===this.selectedFreePin?'#1a6170':'#0b2330';c.beginPath();c.arc(p.x,p.y,size,0,Math.PI*2);c.fill();c.stroke();
    c.beginPath();c.moveTo(p.x-size*1.6,p.y);c.lineTo(p.x-size*.55,p.y);c.moveTo(p.x+size*.55,p.y);c.lineTo(p.x+size*1.6,p.y);
    c.moveTo(p.x,p.y-size*1.6);c.lineTo(p.x,p.y-size*.55);c.moveTo(p.x,p.y+size*.55);c.lineTo(p.x,p.y+size*1.6);c.stroke();c.restore();
   }}
   if(s.meshShowPoints!==false){for(let i=0;i<s.grid.nodes.length;i++){const u=s.grid.uStops?.[i%(s.grid.cols+1)]??(i%(s.grid.cols+1))/s.grid.cols,v=s.grid.vStops?.[Math.floor(i/(s.grid.cols+1))]??Math.floor(i/(s.grid.cols+1))/s.grid.rows;const p=gridPoint(s.grid,u,v);if(i===activeIndex){c.fillStyle='#95fbff';c.strokeStyle='#d8ffff';node(p,pointRadius+1);}else{c.fillStyle='#0e1a22';c.strokeStyle='#3fe0f0';node(p,pointRadius);}}c.fillStyle='#0e1a22';c.strokeStyle='#3fe0f0';}}else if(s.mode!=='move'&&s.mode!=='perspective'){
   q.forEach(p=>node(p));if(s.mode==='free'||s.mode==='scale'||s.mode==='distort')for(let i=0;i<4;i++)node({x:(q[i].x+q[(i+1)%4].x)/2,y:(q[i].y+q[(i+1)%4].y)/2},3);
  }
  if(s.mode==='skew'){
   // Diamond shear grips distinguish skew from ordinary scale handles.
   c.fillStyle='#96f8fa';c.strokeStyle='#1bc5d9';c.lineWidth=1/z;
   for(let i=0;i<4;i++){
    const a=q[i],b=q[(i+1)%4],p={x:(a.x+b.x)/2,y:(a.y+b.y)/2},sz=4.5/z;
    c.beginPath();c.moveTo(p.x,p.y-sz);c.lineTo(p.x+sz,p.y);c.lineTo(p.x,p.y+sz);c.lineTo(p.x-sz,p.y);c.closePath();c.fill();c.stroke();
   }
  }
  if(s.mode==='skew'||s.mode==='distort'||(s.mode==='flip'&&this.flipShowPivot)){
   // A real movable pivot target, with a tiny hit footprint for artwork space.
   c.fillStyle='#0e1a22';c.strokeStyle='#74ecf7';c.lineWidth=1.2/z;
   c.beginPath();c.arc(s.pivot.x,s.pivot.y,6/z,0,Math.PI*2);c.fill();c.stroke();
   c.beginPath();c.moveTo(s.pivot.x-4/z,s.pivot.y);c.lineTo(s.pivot.x+4/z,s.pivot.y);
   c.moveTo(s.pivot.x,s.pivot.y-4/z);c.lineTo(s.pivot.x,s.pivot.y+4/z);c.stroke();
  }
  if(s.mode==='perspective'){
   // Cyan corner squares, diamond edge handles, and draggable centre disc.
   c.fillStyle='#a9ffff';c.strokeStyle='#1aadc9';c.lineWidth=1/z;
   for(let i=0;i<4;i++)node(q[i],4.2);
   for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],m={x:(a.x+b.x)/2,y:(a.y+b.y)/2},sz=5/z;
    c.beginPath();c.moveTo(m.x,m.y-sz);c.lineTo(m.x+sz,m.y);c.lineTo(m.x,m.y+sz);c.lineTo(m.x-sz,m.y);c.closePath();c.fill();c.stroke();}
   const mid=centroid(q);c.beginPath();c.arc(mid.x,mid.y,8/z,0,Math.PI*2);c.stroke();c.beginPath();c.arc(mid.x,mid.y,3/z,0,Math.PI*2);c.fill();
  }
  if(s.mode==='free'||s.mode==='rotate'||s.mode==='pivot'){const {top,point}=rotationHandle(q,32/z);c.beginPath();c.moveTo(top.x,top.y);c.lineTo(point.x,point.y);c.stroke();c.beginPath();c.arc(point.x,point.y,5/z,0,Math.PI*2);c.fill();c.stroke();}
  if(this.gesture&&this.direction&&!['move','scale','rotate','perspective','skew','distort'].includes(s.mode)&&!this.perspectiveArrow&&this.activeGestureType()!=='rotate'&&Math.hypot(this.direction.x,this.direction.y)>.1){
   const vector=this.direction,len=Math.hypot(vector.x,vector.y),nx=vector.x/len,ny=vector.y/len;
   const p=this.gesture.point,amount=Math.min(len,44/z),end={x:p.x+nx*amount,y:p.y+ny*amount};
   c.strokeStyle='#3fe0f0';c.lineWidth=1.25/z;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(end.x,end.y);
   c.moveTo(end.x,end.y);c.lineTo(end.x-(nx*.9-ny*.5)*8/z,end.y-(ny*.9+nx*.5)*8/z);
   c.moveTo(end.x,end.y);c.lineTo(end.x-(nx*.9+ny*.5)*8/z,end.y-(ny*.9-nx*.5)*8/z);c.stroke();
  }
  // Exactly one slender cyan directional arrow. Anchored beside the active
  // mouse/pen handle, aligned to the current perspective grid or slanted edge.
  if(this.perspectiveArrow)this.paintPerspectiveArrow(c,z);
  if(this.deformArrow)this.paintDeformArrow(c,z);
  if(s.mode==='rotate'||this.activeGestureType()==='rotate')this.paintRotationGuide(c,z);
  const mark=s.mode==='perspective'?centroid(q):s.pivot;c.strokeStyle='#00b4e8';c.beginPath();c.moveTo(mark.x-8/z,mark.y);c.lineTo(mark.x+8/z,mark.y);c.moveTo(mark.x,mark.y-8/z);c.lineTo(mark.x,mark.y+8/z);c.stroke();c.restore();}
 private paintMeshLine(c:CanvasRenderingContext2D,points:Pt[],smooth:boolean){
  if(points.length<2)return;c.beginPath();c.moveTo(points[0].x,points[0].y);
  if(!smooth||points.length<3){for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.stroke();return;}
  for(let i=0;i<points.length-1;i++){
   const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
   const cp1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6};
   const cp2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};
   c.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,p2.x,p2.y);
  }
  c.stroke();
 }
 private meshCellMetrics(){const g=this.session.grid,stride=g.cols+1;const x=g.cols?Math.hypot(g.nodes[1].x-g.nodes[0].x,g.nodes[1].y-g.nodes[0].y):18;const y=g.rows?Math.hypot(g.nodes[stride].x-g.nodes[0].x,g.nodes[stride].y-g.nodes[0].y):18;return {x:Math.max(1,x),y:Math.max(1,y)};}
 private meshInfluenceRadiusX(){const m=this.meshCellMetrics();return m.x*Math.max(.1,(this.session.meshFalloff??50)/100*3.2);}
 private meshInfluenceRadiusY(){const m=this.meshCellMetrics();return m.y*Math.max(.1,(this.session.meshFalloff??50)/100*3.2);}
 /** Thin screen-size perspective direction arrow, drawn in the existing RAF
  * overlay. No giant compass, handle squares or arrows saved into the cel. */
 private paintPerspectiveArrow(c:CanvasRenderingContext2D,z:number){
  const mark=this.perspectiveArrow;if(!mark)return;
  const {pointer,direction:d}=mark,unit=1/z;
  // Begin away from the pen hotspot so the arrow never obscures the handle.
  const sx=pointer.x+d.x*9*unit,sy=pointer.y+d.y*9*unit;
  const ex=pointer.x+d.x*29*unit,ey=pointer.y+d.y*29*unit;
  const wing=5*unit,back=6*unit;
  c.save();c.strokeStyle='#65ebf4';c.lineWidth=1.4*unit;c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
  c.beginPath();c.moveTo(sx,sy);c.lineTo(ex,ey);
  c.moveTo(ex-d.x*back-d.y*wing,ey-d.y*back+d.x*wing);c.lineTo(ex,ey);
  c.lineTo(ex-d.x*back+d.y*wing,ey-d.y*back-d.x*wing);c.stroke();c.restore();
 }
 /** Small, screen-size direction indicator for the active skew/distort handle.
  * Skew displays the shear axis; Distort follows free corner/edge movement. */
 private paintDeformArrow(c:CanvasRenderingContext2D,z:number){
  const a=this.deformArrow;if(!a)return;
  const {pointer:p,direction:d}=a,unit=1/z,head=5*unit;
  const tip={x:p.x+d.x*26*unit,y:p.y+d.y*26*unit};
  const tail={x:p.x+d.x*8*unit,y:p.y+d.y*8*unit};
  c.save();c.strokeStyle='#7cf2fa';c.lineWidth=1.3*unit;c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
  c.beginPath();c.moveTo(tail.x,tail.y);c.lineTo(tip.x,tip.y);
  c.moveTo(tip.x-d.x*6*unit-d.y*head,tip.y-d.y*6*unit+d.x*head);c.lineTo(tip.x,tip.y);
  c.lineTo(tip.x-d.x*6*unit+d.y*head,tip.y-d.y*6*unit-d.x*head);
  // Skew is a shear along one axis: show the reverse direction too, but keep
  // its two arrowheads within a tiny 36px footprint.
  if(a.mode==='skew'){
   const back={x:p.x-d.x*17*unit,y:p.y-d.y*17*unit};
   c.moveTo(p.x-d.x*8*unit,p.y-d.y*8*unit);c.lineTo(back.x,back.y);
   c.moveTo(back.x+d.x*5*unit-d.y*head,back.y+d.y*5*unit+d.x*head);c.lineTo(back.x,back.y);
   c.lineTo(back.x+d.x*5*unit+d.y*head,back.y+d.y*5*unit-d.x*head);
  }
  c.stroke();c.restore();
 }
 /** Guide lines are projected from the ORIGINAL planar grid through the same
  * homography as the artwork, so they track the image accurately while dragged.
  * Guides live only on the transparent overlay, never in the saved cel. */
 private paintPerspectiveGrid(c:CanvasRenderingContext2D,z:number){
  if(this.session.perspectiveGrid===false)return;
  const h=projectiveMapping(this.session.initial,this.session.quad);
  if(!h)return;
  const o=this.session.initial,n=6;
  c.save();c.strokeStyle='#3fe0f078';c.lineWidth=.8/z;c.setLineDash([]);
  for(let axis=0;axis<2;axis++)for(let i=1;i<n;i++){
   c.beginPath();for(let j=0;j<=n;j++){
    const t=j/n,u=axis===0?i/n:t,v=axis===0?t:i/n;
    const point=warpPoint(bilerp(o,u,v),h);if(j===0)c.moveTo(point.x,point.y);else c.lineTo(point.x,point.y);
   }c.stroke();
  }
  c.restore();
 }
 /** A fine-lined rotation dial inspired by the approved large reference.
  * Drawn on the existing overlay, not in the artwork, and never re-computed into React state.
  * Idle Rotate shows a subtle ring; dragging shows angle + orbital direction.
  */
 private paintRotationGuide(c:CanvasRenderingContext2D,z:number){
  const s=this.session,p=s.pivot,g=this.gesture,dragging=!!g&&this.activeGestureType()==='rotate';
  const bounds=boundsOfQuad(s.quad);
  const r=Math.max(54,Math.min(150,Math.max(bounds.w,bounds.h)*z*.63))/z;
  const unit=1/z;
  c.save();c.lineWidth=1.05*unit;c.strokeStyle=dragging?'#48dff0b8':'#43cfe376';
  c.setLineDash(dragging?[]:[4*unit,5*unit]);c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();c.setLineDash([]);
  // Quiet radial guides and small major ticks. No heavy glow or filled graphics.
  c.strokeStyle='#45d7e65e';c.lineWidth=.85*unit;
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12,inner=r-(i%3===0?8:4)*unit;
   c.beginPath();c.moveTo(p.x+Math.cos(a)*inner,p.y+Math.sin(a)*inner);
   c.lineTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);c.stroke();
  }
  c.beginPath();c.moveTo(p.x-r*.26,p.y);c.lineTo(p.x+r*.26,p.y);
  c.moveTo(p.x,p.y-r*.26);c.lineTo(p.x,p.y+r*.26);c.stroke();
  c.strokeStyle='#b0ffff';c.lineWidth=1.4*unit;
  c.beginPath();c.arc(p.x,p.y,5.2*unit,0,Math.PI*2);c.stroke();
  if(dragging){
   const angle=(s.angle-g!.angle)*Math.PI/180;
   // Starting ray comes from the pointer's initial radius; delta follows the actual mode.
   const start=Math.atan2(g!.point.y-g!.pivot.y,g!.point.x-g!.pivot.x);
   const end=start+angle;
   if(Math.abs(angle)>.001){
    c.lineWidth=2.1*unit;c.strokeStyle='#3fe0f0';c.beginPath();c.arc(p.x,p.y,r,start,end,angle<0);c.stroke();
    const tip={x:p.x+Math.cos(end)*r,y:p.y+Math.sin(end)*r};
    const tangent={x:-Math.sin(end)*(angle>=0?1:-1),y:Math.cos(end)*(angle>=0?1:-1)};
    c.fillStyle='#a7ffff';c.beginPath();c.moveTo(tip.x+tangent.x*7*unit,tip.y+tangent.y*7*unit);
    c.lineTo(tip.x-tangent.x*5*unit-Math.cos(end)*4*unit,tip.y-tangent.y*5*unit-Math.sin(end)*4*unit);
    c.lineTo(tip.x-tangent.x*5*unit+Math.cos(end)*4*unit,tip.y-tangent.y*5*unit+Math.sin(end)*4*unit);c.closePath();c.fill();
   }
   const a=Math.abs(angle)>.1?end:start-Math.PI/4;
   const bx=p.x+Math.cos(a)*(r+23*unit),by=p.y+Math.sin(a)*(r+23*unit);
   const badge=(Math.round((s.angle-g!.angle)*10)/10).toString()+'°';
   c.font=`${12*unit}px sans-serif`;c.textAlign='center';c.textBaseline='middle';
   c.fillStyle='#0e1a22ed';c.fillRect(bx-28*unit,by-13*unit,56*unit,25*unit);
   c.strokeStyle='#3fe0f0';c.lineWidth=.8*unit;c.strokeRect(bx-28*unit,by-13*unit,56*unit,25*unit);
   c.fillStyle='#b6ffff';c.fillText(badge,bx,by);
  }
  c.restore();
 }
 async commit():Promise<{changed:number;error?:string}>{// Enter accepts the last displayed drag even if pointer-up was missed.
  // cancelDrag() restores the down snapshot and used to undo that deformation.
  if(this.gesture){this.engine.recorder.event('transform-drag-accepted-on-commit',{mode:this.session.mode});this.gesture=null;this.direction=null;this.deformArrow=null;this.perspectiveArrow=null;}const meshWarp=this.session.mode==='mesh'||this.meshEdited;const mapping=projectiveMapping(this.session.initial,this.session.quad);const projectiveWarp=!!mapping&&(Math.abs(mapping[6])>1e-10||Math.abs(mapping[7])>1e-10);const p=this.engine.store.getSnapshot();if(p!==this.original)return {changed:0,error:'Document changed during the transform. Cancel and try again.'};if(!this.isDirty&&this.session.quad.every((v,i)=>Math.hypot(v.x-this.session.initial[i].x,v.y-this.session.initial[i].y)<EPS))return {changed:0,error:'Nothing was changed.'};
  if(meshWarp&&this.meshIsUndeformed())return {changed:0,error:'No mesh deformation was made. The original drawing is unchanged.'};
  // Folded meshes are intentional artwork; commit uses the same forward paint as preview.
  if(!meshWarp&&!projectiveMapping(this.session.initial,this.session.quad))return {changed:0,error:'Invalid or folded transform. Adjust the corners.'};
  const targetIds=this.scope.frameIds.length>1?this.scope.frameIds:[];
  const targetLayers=this.session.mode==='flip'?(this.flipTarget==='visible'?p.layers.filter(l=>l.visible&&!l.locked&&!l.reference).map(l=>l.id):this.flipTarget==='selected'?(this.scope.layerIds.length?this.scope.layerIds:[this.layerId]):[this.layerId]):(this.scope.layerIds.length?this.scope.layerIds:[this.layerId]);
  if(targetIds.length&&p.animation){if(targetIds.length*targetLayers.length>120)return {changed:0,error:'Maximum 120 selected cels per transform.'};for(const fid of targetIds)for(const lid of targetLayers){if(isLayerHeld(p,lid,fid)||p.animation.celLinks?.[lid]?.[fid])return {changed:0,error:'Linked or held cels must be made independent before transforming.'};}}
  if(meshWarp&&this.meshIsUndeformed())return {changed:0,error:'Mesh unchanged — the drawing was left untouched.'};
  const requestedFrames=targetIds.length&&p.animation?targetIds:[p.animation?.activeFrameId??''];const lids=targetLayers;
  const updated=new Map<string,Map<string,Operation[]>>();const newBitmaps:Operation[]=[];
  // A vector layer cannot legally contain image operations. Bake nonlinear
  // transforms onto a separate raster layer while leaving other vector paths
  // in their original editable layer. One raster target per source layer.
  const warpLayers=new Map<string,Layer>();const warpDrawings=new Map<string,Map<string,Operation[]>>();let changed=0;
  for(const frameId of requestedFrames)for(const layerId of lids){const layer=p.layers.find(l=>l.id===layerId);if(!layer||layer.locked||!layer.visible||layer.reference)continue;
   const old=targetIds.length&&p.animation?p.animation.frames.find(f=>f.id===frameId)?.drawings[layerId]??[]:layer.operations;if(!old.length)continue;
   const useSelection=this.session.mode!=='flip'||this.flipTarget==='selection';
   const currentIds=!useSelection||layerId!==this.layerId?new Set(old.filter(op=>op.kind==='stroke'&&op.tool==='brush'||op.kind==='vector').map(op=>op.id)):this.editableIds;
   const selectedOps=currentIds.size?old.filter(op=>currentIds.has(op.id)):[];
   const allEditable=old.every(op=>op.kind==='vector'||op.kind==='stroke'&&op.tool==='brush');
   let next:Operation[];
   if(selectedOps.length&&(meshWarp||projectiveWarp||this.session.mode==='perspective'||this.session.mode==='distort')){
    // The live preview deforms a rendered image. Reconstructing individual paths
    // at commit uses a DIFFERENT rendering algorithm and can radically reshape
    // brush lines, pressure widths and Bezier curves. Bake the exact preview
    // sampling instead; retain all non-target artwork as editable operations.
    // A nonlinear/true projective warp is deliberately rasterized here.
    const activeFrame=p.animation?.activeFrameId??'';
    const exactPreview=layerId===this.layerId&&frameId===activeFrame&&
      selectedOps.length===this.editableIds.size&&selectedOps.every(op=>this.editableIds.has(op.id));
    // Use the same padded texture as the live preview. Alpha-cropping only
    // at commit changes filtering at the ink boundary.
    let src:CanvasImageSource=this.source;
    let srcBox:Box=this.box;
    if(!exactPreview){
     const r=new LayerRenderer();
     const isolated={...layer,operations:selectedOps};
     const temp={...p,layers:[isolated],activeLayerId:layerId,animation:undefined};
     await r.prepare(temp);
     const b=r.get(isolated,temp);
     src=activeCanvas(this.box.w,this.box.h);
     cacheContext(src as OffscreenCanvas|HTMLCanvasElement).drawImage(b,this.box.x,this.box.y,this.box.w,this.box.h,0,0,this.box.w,this.box.h);
     r.clear();
    }
    const mappedBounds=meshWarp
     ?this.meshBounds()
     :boundsOfQuad(this.session.quad);
    const x=Math.max(0,Math.floor(mappedBounds.x)-3),y=Math.max(0,Math.floor(mappedBounds.y)-3);
    const right=Math.min(p.width,Math.ceil(mappedBounds.x+mappedBounds.w)+3);
    const bottom=Math.min(p.height,Math.ceil(mappedBounds.y+mappedBounds.h)+3);
    if(right<=x||bottom<=y)continue;
    const result=activeCanvas(right-x,bottom-y),oc=context(result);
    oc.translate(-x,-y);
    this.paintArtwork(oc,src,srcBox);
    const image:Operation={id:uid(),kind:'image',png:result.toDataURL('image/png'),x,y,width:right-x,height:bottom-y};
    newBitmaps.push(image);
    if(layer.kind==='vector'){
     if(!warpLayers.has(layerId)){
      if(p.layers.length+warpLayers.size>=100)return {changed:0,error:'Maximum 100 layers reached. Add space before rasterizing this vector warp.'};
      const warpLayer:Layer={id:uid(),name:`${layer.name} · Warp`,kind:'raster',visible:true,locked:false,opacity:layer.opacity,blend:layer.blend,operations:[]};
      warpLayers.set(layerId,warpLayer);
     }
     const raster=warpLayers.get(layerId)!;
     const rasterByFrame=warpDrawings.get(frameId)??new Map<string,Operation[]>();
     rasterByFrame.set(raster.id,[image]);warpDrawings.set(frameId,rasterByFrame);
     // No image operation is inserted into the vector layer itself.
     next=old.filter(op=>!currentIds.has(op.id));
    }else next=[...old.filter(op=>!currentIds.has(op.id)),image];
    // This preserves other operations and never clears entire bounding-box
    // regions (which could erase unrelated ink under a selected stroke).
   }else if(selectedOps.length){
    // Each target cel reflects around its OWN art bounds when Keep Position is on.
    // This prevents distant layers from jumping toward the active layer's location.
    let sourceBounds=this.session.mode==='flip'&&this.flipKeepPosition?boundsOf(selectedOps.filter((op):op is import('../../engine/strokeSelection').Selectable=>op.kind==='stroke'||op.kind==='vector')):null;
    if(this.session.mode==='flip'&&this.flipKeepPosition&&!sourceBounds&&layer.kind==='raster'){const isolated=this.isolatedLayerBitmap(layer,old);sourceBounds=this.alphaBounds(isolated,p.width,p.height);}
    const initial=sourceBounds?rectQuad(sourceBounds):this.session.initial;
    const flipped=sourceBounds&&this.flipAxis?(this.flipAxis==='h'?[initial[1],initial[0],initial[3],initial[2]]:[initial[3],initial[2],initial[1],initial[0]]) as Quad:this.session.quad;
    const h=projectiveMapping(initial,flipped);
    if(!h&&!meshWarp)return {changed:0,error:'Perspective mapping is invalid.'};
    next=old.map(op=>{if(!currentIds.has(op.id))return op;
     if(meshWarp){
      // Commit the same document-space deformation used by the preview.
      // Preserve each original pen sample's pressure. Flattening via polyline()
      // and assigning p=1 made ink swell/change shape after pressing Enter.
      if(op.kind==='stroke'){
       const sample=op.engineVersion?finalGeometry(op).points:op.points;
       const mapped=sample.map(pt=>{
        const position=op.perspective?warpPoint(pt,op.perspective):op.transform?{x:op.transform[0]*pt.x+op.transform[2]*pt.y+op.transform[4],y:op.transform[1]*pt.x+op.transform[3]*pt.y+op.transform[5]}:pt;
        const uv=pointToGridUV(this.session.grid,position);
        return {...pt,...gridPoint(this.session.grid,uv.u,uv.v)};
       });
       return {...op,transform:undefined,perspective:undefined,engineVersion:undefined,points:mapped};
      }
      // Vector node positions and tangents must remain editable.
      if(op.kind==='vector')return {...op,nodes:op.nodes.map(node=>{const uv=pointToGridUV(this.session.grid,node),uvIn=pointToGridUV(this.session.grid,{x:node.x+node.in.x,y:node.y+node.in.y}),uvOut=pointToGridUV(this.session.grid,{x:node.x+node.out.x,y:node.y+node.out.y});const a=gridPoint(this.session.grid,uv.u,uv.v),aIn=gridPoint(this.session.grid,uvIn.u,uvIn.v),aOut=gridPoint(this.session.grid,uvOut.u,uvOut.v);return {...node,...a,in:{x:aIn.x-a.x,y:aIn.y-a.y},out:{x:aOut.x-a.x,y:aOut.y-a.y}};})};
     }
     return op.kind==='vector'?projectiveVector(op,h!):op.kind==='stroke'?projectiveStroke(op,h!):op;
    });
   }else{
    if(layer.kind==='vector')return {changed:0,error:'No editable artwork was selected on this vector layer.'};
    // Bitmap path: take the cached source for the active cel. For other frames,
    // build an isolated layer image only on Commit, never during pen movement.
    let src:CanvasImageSource=this.source,srcBox=this.box,paintQuad=this.session.quad;
    if(this.session.mode==='flip'&&(!useSelection||layerId!==this.layerId)){
     const isolated=this.isolatedLayerBitmap(layer,old);
     const alpha=this.alphaBounds(isolated,p.width,p.height)??{x:0,y:0,w:p.width,h:p.height};
     srcBox=this.flipKeepPosition?alpha:{x:0,y:0,w:p.width,h:p.height};
     src=activeCanvas(srcBox.w,srcBox.h);context(src).drawImage(isolated,srcBox.x,srcBox.y,srcBox.w,srcBox.h,0,0,srcBox.w,srcBox.h);
     if(this.flipKeepPosition&&this.flipAxis){const initial=rectQuad(srcBox);paintQuad=(this.flipAxis==='h'?[initial[1],initial[0],initial[3],initial[2]]:[initial[3],initial[2],initial[1],initial[0]]) as Quad;}
    }else if(frameId!==(p.animation?.activeFrameId??'')||layerId!==this.layerId||!useSelection){const r=new LayerRenderer();const tmp={...p,layers:[{...layer,operations:old}],activeLayerId:layerId,animation:undefined};await r.prepare(tmp);const bitmap=r.get(tmp.layers[0],tmp);src=activeCanvas(srcBox.w,srcBox.h);context(src).drawImage(bitmap,srcBox.x,srcBox.y,srcBox.w,srcBox.h,0,0,srcBox.w,srcBox.h);r.clear();}
    const out=meshWarp?this.meshBounds():this.session.mode==='flip'&&this.flipAxis?{x:0,y:0,w:p.width,h:p.height}:boundsOfQuad(paintQuad);const x=Math.max(0,Math.floor(out.x)-2),y=Math.max(0,Math.floor(out.y)-2),right=Math.min(p.width,Math.ceil(out.x+out.w)+2),bottom=Math.min(p.height,Math.ceil(out.y+out.h)+2);
    if(right<=x||bottom<=y)continue;const result=activeCanvas(right-x,bottom-y),oc=context(result);oc.translate(-x,-y);
    if(this.session.mode==='flip'&&this.flipAxis){this.paintFlippedBitmap(oc,src,srcBox,this.flipAxis,this.flipKeepPosition);}else{const savedQuad=this.session.quad;this.session.quad=paintQuad;this.paintArtwork(oc,src,srcBox);this.session.quad=savedQuad;}
    const clear:Operation={id:uid(),kind:'clear',polygon:(this.session.mode==='flip'&&!useSelection?[{x:0,y:0},{x:p.width,y:0},{x:p.width,y:p.height},{x:0,y:p.height}]:this.polygon).map(pt=>({...pt,p:1})) as Point[]};
    const image:Operation={id:uid(),kind:'image',png:result.toDataURL('image/png'),x,y,width:right-x,height:bottom-y};
    newBitmaps.push(image);next=[...old,clear,image];
   }
   if(!updated.has(frameId))updated.set(frameId,new Map());updated.get(frameId)!.set(layerId,next);changed++;
  }
  if(!changed)return {changed:0,error:'No editable artwork in the selected cels.'};
  const animation=p.animation?{...p.animation,frames:p.animation.frames.map(f=>{
   const source=updated.get(f.id),raster=warpDrawings.get(f.id);
   return !source&&!raster?f:{...f,drawings:{...f.drawings,...(source?Object.fromEntries(source):{}),...(raster?Object.fromEntries(raster):{})}};
  })}:undefined;
  const activeId=p.animation?.activeFrameId??'';const patches=updated.get(activeId);
  const layers:Layer[]=p.layers.flatMap(l=>{
   const edited=patches?.has(l.id)?{...l,operations:patches.get(l.id)!}:l;
   const warp=warpLayers.get(l.id);
   if(!warp)return [edited];
   const baked=warpDrawings.get(activeId)?.get(warp.id)??[];
   return [{...warp,operations:baked},edited];
  });
  if(this.engine.store.getSnapshot()!==p)return {changed:0,error:'The document changed during rendering. No changes were committed.'};
  const nextProject={...p,activeLayerId:warpLayers.get(this.layerId)?.id??p.activeLayerId,layers,...(animation?{animation}:{})};
  // Raster transforms append image operations. Renderer.get() ignores images that
  // have not been decoded into its bitmap cache. Decode before swapping history,
  // otherwise Enter clears the source and makes the transformed art disappear.
  if(newBitmaps.length){
   try{
    // prepare() decodes project.layers images, not inactive animation frame
    // drawings. Include a temporary decode-only layer to preload ALL new cels.
    const decodeOnly={...p.layers.find(l=>l.id===this.layerId)!,id:uid(),kind:'raster' as const,operations:newBitmaps};
    await this.engine.renderer.prepare({...nextProject,layers:[...nextProject.layers,decodeOnly]});
   }catch(error){return {changed:0,error:'Could not prepare the transformed image. Your original drawing is untouched: '+String(error)};}
  }
  if(this.engine.store.getSnapshot()!==p)return {changed:0,error:'The document changed while preparing the transformed artwork. No changes were committed.'};
  this.engine.store.commit(nextProject,`Transform ${this.session.mode} · ${changed} cel(s)`);
  this.engine.clearSelection();this.destroy();return {changed};
 }
}
