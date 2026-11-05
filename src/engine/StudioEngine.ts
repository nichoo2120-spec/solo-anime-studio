import {LiveBlendWorker,workerBlendEligible} from './LiveBlendWorker';
import {DrawingFrameCache} from './DrawingFrameCache';
import type {DryBristleControls} from '../core/dryBrush';
import {NavigationSnapshot} from './NavigationSnapshot';
import {RasterSceneDisplay} from './RasterSceneDisplay';
import {EditingSceneSnapshot} from './EditingSceneSnapshot';
import {mirrorMatrix,mirrorPivot,reflectedStroke} from './symmetry';
import {compositePaintStroke} from './paintCompositing';
import {commitBandRegion,strokeBand,type BandFrame} from './commitBand';
import {watercolorShapePath} from './watercolorShapes';
import {watercolorVelocity} from './watercolorPigment';
import {Pickup} from './mixing';
import {isWatercolorTip} from '../core/paintTips';
import {brushStrokeMetadata,watercolorSeedFor,type PaintTip} from '../core/paintTips';
import {colorNibOutline} from './colorNibs';
import {defaultColorNib,type ColoringControls} from '../core/coloring';
import {paintingOutline} from './paintingTips';
let originalFlatOutline:Path2D|undefined;
import {activeLayer,appendOperation,uid,type Point,type Stroke,type Tool,type Project,type Matrix,type PressureSettings,type WatercolorControls} from '../core/model';
import {DocumentStore} from '../core/history';
import {syncActiveFrame} from '../animation/timeline';
import {followBoundSelectionTransform} from '../animation/motionPlanning';
import {fitView,toProject,toScreen,type View} from '../core/geometry';
import {LayerRenderer,makeCanvas,context,drawStroke,polygonPath,applyTransform,blendOperation,paintVectorLayer} from './renderer';
import {VectorController} from './VectorController';
import {SmoothingController} from './SmoothingController';
import {drawVector} from './vector';
import {PointerPath,appendPath} from './inputPath';
import {controls,selectionMatrix,rectangle,angleDelta,type TransformSettings} from './selectionControls';
import {edgeHandles,freeformHit,rotationRadius} from './freeformControls';
import {EditingController} from './EditingController';
import type {FillSettings} from './advancedFill';
import {ReferenceController} from './ReferenceController';
import {velocityWidth,widthResponse,inputPressure} from './pressureChannels';
import {pressureResponse,strokeGeometry} from './strokeGeometry';
import {StrokeDiagnostics} from './StrokeDiagnostics';
import {finalGeometry,strokeSnapshot} from './geometryCache';
import {DrawingPerformance} from './DrawingPerformance';
import {DrawingBugRecorder} from './DrawingBugRecorder';
import {wheelZoom} from '../core/wheelZoom';
import {InkDisplay,displayCleanInk} from './InkDisplay';
import {CanvasBackdrop} from './CanvasBackdrop';
import {LiveStrokeRaster} from './liveRaster';
import {OnionSkinOverlay} from './OnionSkinOverlay';
import type {OnionSettings} from '../animation/onionSkin';
import {FlipbookOverlay} from './FlipbookOverlay';
import {rejectCanvasContact,endsCanvasCaptureOnControl} from './penContact';
import {hitStroke,idsInMarquee,boundsOf,selectable,transformedStroke,projectiveStroke,mapPoint,nearSelection,polyline,IDENTITY, type Selectable,type PickMode} from './strokeSelection';
import {transformVector,projectiveVector} from './vector';
import {affineH,multiplyH,projectPoint,homography,quadValid,type XY,type H} from './perspectiveWarp';
export type BrushSettings={size:number;opacity:number;color:string;stabilization:number;pressure:boolean;response:number;tolerance:number;smoothness?:number;pressureWidth?:boolean;pressureOpacity?:boolean;pressureCurve?:{x:number;y:number}[];taperStart?:number;taperEnd?:number;brushKind?:string;textureStrength?:number;brushTip?:PaintTip;tipAngle?:number;tipSpacing?:number;flow?:number;hardness?:number;pressureFlow?:boolean;mixColors?:boolean;mixAmount?:number;mixTipA?:PaintTip;mixTipB?:PaintTip;mixBlend?:number;mixPickupLen?:number;mixHoldLen?:number;mixStreak?:number;mixPaintLoad?:number;nativeMixEnabled?:boolean;watercolorStyle?:'paper'|'dry'|'bloom';pigmentPooling?:number}&PressureSettings&WatercolorControls&ColoringControls&DryBristleControls;
export const defaultBrush:BrushSettings={size:6,opacity:1,color:'#263039',stabilization:.25,pressure:true,response:1,tolerance:24};
export type {TransformSettings} from './selectionControls';
export class StudioEngine {
 readonly onion:OnionSkinOverlay;
 readonly flipbook:FlipbookOverlay;
 readonly performance=new DrawingPerformance();readonly diagnostics=new StrokeDiagnostics();private liveGeometry?:ReturnType<typeof strokeGeometry>;private liveTip?:Point;private geometryDirty=false;
 private drawingFrames=new DrawingFrameCache();private editingSnapshot=new EditingSceneSnapshot();private drawingWarmup?:{kind:'idle'|'timer';id:number};
 readonly recorder=new DrawingBugRecorder(this.diagnostics,this.performance);private rasterScene=new RasterSceneDisplay(()=>{this.drawingFrames.invalidate();this.request();});private navigationScene=new RasterSceneDisplay(()=>this.request(),true,(layer,p,renderer)=>this.inkDisplay.navigationBitmap(layer,p,renderer));private viewMoving=false;private viewRefining=false;private viewRefineTimer?:ReturnType<typeof setTimeout>;private liveRaster=new LiveStrokeRaster();private inkDisplay=new InkDisplay(()=>{this.drawingFrames.invalidate();this.request();});private backdrop=new CanvasBackdrop();private viewPending=false;private navigationSnapshot=new NavigationSnapshot();private hasRendered=false;private historyPending?:{action:string;at:number};
 private navigationPaper=document.createElement('div');private navigationSurface=document.createElement('canvas');private navigationHost=document.createElement('div');private canvasStack?:{zIndex:string;position:string};
 readonly vectors:VectorController;readonly smoothing:SmoothingController;readonly editing:EditingController;readonly references:ReferenceController;
 fillSettings:FillSettings={reference:'current',lineLayerId:'',gap:0,expansion:0};
 confirmFill:(message:string)=>Promise<boolean>=async()=>false;
 mirrorDrawing={enabled:false,axis:'vertical' as 'vertical'|'horizontal',showLine:true,showOnionSkin:false,lockCenter:false,onlyCurrentLayer:true,center:0.5,pivot:undefined as {x:number;y:number}|undefined};
 pickMirrorPivot=false;private mirrorPivotDrag=false;private strokeMirror?:{matrix:Matrix;id:string};onMirrorChange:()=>void=()=>{};
 setMirrorPivot(p:{x:number;y:number}){const doc=this.store.getSnapshot();this.mirrorDrawing.pivot={x:Math.max(0,Math.min(1,p.x/doc.width)),y:Math.max(0,Math.min(1,p.y/doc.height))};this.request();}
 centerMirrorPivot(){this.mirrorDrawing.pivot={x:.5,y:.5};this.mirrorDrawing.center=.5;this.pickMirrorPivot=false;this.request();this.onMirrorChange();}
 tool:Tool='brush';brush={...defaultBrush};view:View={x:0,y:0,zoom:1,rotation:0};space=false;busy=false;
 selection:Point[]=[];strokeIds:string[]=[];strokePickMode:PickMode='touch';strokeShape:'rectangle'|'lasso'='lasso';strokeScope:'current'|'visible'='current';strokeMode:'select'|'lasso'|'move'|'scale'|'rotate'|'perspective-move'|'perspective'|'freeform'='select';freeformCornerMode:'scale'|'perspective'='scale';areaTransformMode:'freeform'|'move'|'scale'|'rotate'='freeform';private warpQuad?:XY[];vanishingPoint?:{x:number;y:number};pickVanishingPoint=false;private strokeClipboard?:Selectable[];private strokeExact=new Map<string,{source:Project['layers'][number]['operations'];key:string;operations:Project['layers'][number]['operations']}>();private strokePending?:{x:number;y:number;shift:boolean};transform:TransformSettings={dx:0,dy:0,scale:1,angle:0};
 renderer=new LayerRenderer();private scratch=makeCanvas(1920,1080);private stroke?:Stroke;private pickup?:Pickup;private lasso?:Point[];
 private pan?:{x:number;y:number;vx:number;vy:number};private drag?:{x:number;y:number;settings:TransformSettings;kind:'move'|'scale'|'rotate'|'perspective-move'|'perspective';center:{x:number;y:number};anchor?:{x:number;y:number};corner?:number;edge?:number;startQuad?:XY[]};private cursor?:Point;private navigation?:{x:number;y:number;view:View;alt:boolean;moved:boolean};private rectangleStart?:Point;
 private blendWorker=new LiveBlendWorker(()=>this.request());private blendSource?:HTMLCanvasElement;private finalBlendResult?:{stroke:Stroke;base:HTMLCanvasElement;preview:HTMLCanvasElement;done:Promise<HTMLCanvasElement|undefined>};
 private finalLayerResult?:{stroke:Stroke;base:HTMLCanvasElement;canvas:HTMLCanvasElement};
 private mirrorSurface?:HTMLCanvasElement;private previewStrokeId='';private previewBase?:HTMLCanvasElement;private previewBaseOperations?:Project['layers'][number]['operations'];
 private lastExactFrame?:BandFrame;lastCommitBand?:{x:number;y:number;width:number;height:number}; private cachedLayerIds:string[]=[];private frame=0;private width=1;private height=1;private observer:ResizeObserver;private unsubscribe:()=>void;private lastLayer='';private lastFrame?:string;private geometricDuplicates=0;private device='unknown';preset={id:'custom',name:'Custom brush'};private disposed=false;private worker?:Worker;private pointerId?:number;private strokeDirty=false;private previewSurface=makeCanvas(1,1);private cursorOverlay:HTMLCanvasElement;private previousCursor?:{x:number;y:number;r:number};private loadGeneration=0;private explicitLoad=false;private sampleTime=0;private capture?:PointerPath;private pressureRequested=false;private initialPressurePending=false;private strokeTarget?:{project:string;layer:string};
 onView:(v:View)=>void=()=>{};onSelection:(has:boolean)=>void=()=>{};onBusy:(busy:boolean)=>void=()=>{};
 onColor:(color:string)=>void=()=>{};
 onLoad:(project:Project)=>void=()=>{};restoreView:(project:Project)=>View|null=()=>null;
 private refreshLiveGeometry(){if(!this.stroke||!this.geometryDirty)return;this.liveGeometry=this.performance.measure('liveGeometryMs',()=>strokeGeometry(this.stroke!,'live'));this.liveTip=this.liveGeometry.points.at(-1);this.geometryDirty=false;}
 getInputState(){this.refreshLiveGeometry();return {gestureId:this.capture?.gestureId,pointerId:this.pointerId,raw:this.stroke?.points.map(p=>({...p})),tip:this.liveTip&&{...this.liveTip},preview:this.liveGeometry?.points.map(p=>({...p})),selection:this.lasso?.map(p=>({...p}))};}
 onTransform:(settings:TransformSettings)=>void=()=>{};onStrokeSelection:(count:number)=>void=()=>{};onStrokeMode:(mode:typeof this.strokeMode)=>void=()=>{};
 constructor(private canvas:HTMLCanvasElement,public store:DocumentStore,private notify:(message:string)=>void){
  this.canvasStack={zIndex:canvas.style.zIndex,position:canvas.style.position};if(getComputedStyle(canvas).position==='static')canvas.style.position='relative';canvas.style.zIndex='0';this.navigationHost.setAttribute('aria-hidden','true');Object.assign(this.navigationHost.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'0',display:'none'});Object.assign(this.navigationSurface.style,{position:'absolute',left:'0',top:'0',transformOrigin:'0 0',willChange:'transform'});Object.assign(this.navigationPaper.style,{position:'absolute',left:'0',top:'0',background:'#fff',transformOrigin:'0 0',display:'none'});this.navigationHost.style.background='#20272c';this.navigationHost.append(this.navigationPaper,this.navigationSurface,this.navigationSnapshot.canvas);canvas.parentElement?.insertBefore(this.navigationHost,canvas);
  this.vectors=new VectorController(store,()=>this.brush,()=>this.request(),notify,()=>this.mirrorDrawing);this.smoothing=new SmoothingController(store,()=>this.request(),notify);
  this.editing=new EditingController(store,()=>this.renderer,()=>this.selection,p=>{this.clearSelection();this.selection=p;this.onSelection(p.length>=3);this.request();},notify);
  this.references=new ReferenceController(store,()=>this.renderer,notify,()=>this.drawing);
  this.onion=new OnionSkinOverlay(canvas.parentElement!,store.getSnapshot(),()=>this.drawing);
  this.cursorOverlay=document.createElement('canvas');this.cursorOverlay.className='brush-cursor-overlay';canvas.parentElement?.appendChild(this.cursorOverlay);
  this.flipbook=new FlipbookOverlay(canvas.parentElement!,store.getSnapshot(),()=>this.drawing);
  this.lastLayer=store.getSnapshot().activeLayerId;this.lastFrame=store.getSnapshot().animation?.activeFrameId;
  this.cachedLayerIds=store.getSnapshot().layers.map(layer=>layer.id);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
  this.unsubscribe=store.subscribe(()=>{const p=store.getSnapshot();if(p.activeLayerId!==this.lastLayer){this.recorder.event('layer-change',{id:p.activeLayerId});this.clearSelection();this.lastLayer=p.activeLayerId;}if(p.animation?.activeFrameId!==this.lastFrame){this.lastFrame=p.animation?.activeFrameId;this.clearSelection();}else if(this.strokeIds.length){const allowed=new Set(this.selectableLayers().flatMap(l=>selectable(l).map(o=>o.id)));if(this.strokeIds.some(id=>!allowed.has(id)))this.clearSelection();}this.smoothing.documentChanged();
   // prune() scans raster checkpoints, deltas and layer IDs. Ordinary strokes
   // cannot orphan those caches, so only prune when the layer set changes.
   if(p.layers.length!==this.cachedLayerIds.length||p.layers.some((l,i)=>l.id!==this.cachedLayerIds[i])){
    this.renderer.prune(p);this.cachedLayerIds=p.layers.map(l=>l.id);
   }
   this.onion.update(p);this.flipbook.update(p);this.request();});
  canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerrawupdate',this.rawMove);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancel);canvas.addEventListener('lostpointercapture',this.lostCapture);canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('pointerleave',this.leave);
  window.addEventListener('pointermove',this.windowMove,true);window.addEventListener('blur',this.blur);window.addEventListener('lostpointercapture',this.windowLostCapture,true);this.resize();this.fit();
 }
 dispose(){this.editingSnapshot.clear();this.blendWorker.dispose();this.cancelDrawingWarmup();this.drawingFrames.clear();this.navigationSnapshot.clear();this.navigationHost.remove();if(this.canvasStack){this.canvas.style.zIndex=this.canvasStack.zIndex;this.canvas.style.position=this.canvasStack.position;}this.stopViewMotion();this.navigationScene.dispose();this.rasterScene.dispose();this.cancelGesture();this.recorder.stop();this.renderer.clear();this.inkDisplay.clear();this.backdrop.clear();this.liveRaster.reset();window.removeEventListener('pointermove',this.windowMove,true);window.removeEventListener('blur',this.blur);window.removeEventListener('lostpointercapture',this.windowLostCapture,true);this.disposed=true;this.observer.disconnect();this.unsubscribe();cancelAnimationFrame(this.frame);this.worker?.terminate();this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerrawupdate',this.rawMove);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.cancel);this.canvas.removeEventListener('lostpointercapture',this.lostCapture);this.canvas.removeEventListener('wheel',this.wheel);this.canvas.removeEventListener('pointerleave',this.leave);this.cursorOverlay.remove();this.onion.dispose();this.flipbook.dispose();}
 captureBugCanvas():string|null{try{return this.canvas.toDataURL('image/png');}catch{return null;}}
 get drawing(){return !!(this.mirrorPivotDrag||this.stroke||this.lasso||this.strokePending||this.pan||this.drag||this.navigation||this.vectors.drawing||this.smoothing.previewLayer);}
 // Some tablet/browser integrations emit raw pen updates but no normal pointermoves.
 // Both event channels must use the same complete, ordered capture history.
 // Comparing only the immediately previous event replays overlapping batches
 // backwards and makes fitted curves double back into hooks and slivers.
 private vectorStartPressure=.5;private vectorFirstPressureTime=Infinity;
 private rawMove=(event:Event)=>{const e=event as PointerEvent;if(this.pointerId===e.pointerId&&this.vectors.drawing)this.acceptVectorMovement(e);};
 private windowMove=(e:PointerEvent)=>{if(this.pointerId===e.pointerId&&this.vectors.drawing&&e.target!==this.canvas)this.acceptVectorMovement(e);};
 private acceptVectorMovement(e:PointerEvent){
  if(!this.vectors.drawing||e.pointerId!==this.pointerId)return;
  // A number of Wacom/Windows Ink configurations send movement with buttons=0.
  // The gesture is already owned by this pointer until pointerup/cancel; do not
  // discard those coordinates and silently turn a curve into a missing stroke.
  const capture=this.capture;if(!capture)return;
  const samples=capture.batch(e);if(!samples.length)return;
  const contact=samples.find(p=>p.pointerType==='pen'&&Number.isFinite(p.pressure)&&p.pressure>0&&p.timeStamp<this.vectorFirstPressureTime);
  if(contact){this.vectorFirstPressureTime=contact.timeStamp;this.vectorStartPressure=inputPressure(contact.pressure);this.vectors.resolveInitialPressure(this.vectorStartPressure);}
  let pressure=capture.replaying?this.vectorStartPressure:this.vectors.lastPressure;
  const rect=this.canvas.getBoundingClientRect(),points=samples.map(sample=>{
   const p=this.point(sample,rect);pressure=sample.pointerType==='pen'?inputPressure(sample.pressure,pressure):1;
   return {...p,p:pressure};
  });
  if(capture.replaying)this.vectors.replaceCapturedSamples([{...this.point(capture.first,rect),p:this.vectorStartPressure},...points]);
  else this.vectors.moveSamples(points);
 }
 private outsideMove=(e:PointerEvent)=>{if(e.target!==this.canvas)this.move(e);};private outsideUp=(e:PointerEvent)=>{if(e.target!==this.canvas)this.up(e);};private outsideCancel=(e:PointerEvent)=>{if(e.target!==this.canvas)this.cancel(e);};
 private captureFallback(){window.addEventListener('pointermove',this.outsideMove);window.addEventListener('pointerup',this.outsideUp);window.addEventListener('pointercancel',this.outsideCancel);}
 private releaseCapture(){const id=this.pointerId;this.pointerId=undefined;this.capture=undefined;window.removeEventListener('pointermove',this.outsideMove);window.removeEventListener('pointerup',this.outsideUp);window.removeEventListener('pointercancel',this.outsideCancel);try{if(id!==undefined&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}catch(error){this.recorder.event('capture-release-error',{pointerId:id,error:String(error)});}}
 private blur=()=>{if(this.pointerId!==undefined)this.finishGesture('window-blur');};
 private windowLostCapture=(event:Event)=>{if(event.target!==this.canvas&&this.pointerId!==undefined&&(event as PointerEvent).pointerId===this.pointerId)this.finishGesture('external-lostpointercapture');};
 controlContact(event:PointerEvent){if(this.pointerId!==undefined&&endsCanvasCaptureOnControl(event)&&event.timeStamp>=(this.capture?.started??0))this.finishGesture('studio-control-contact');}
 historyNavigation(action:'undo'|'redo'){this.cancelGesture();this.clearSelection();this.historyPending={action,at:performance.now()};const start=performance.now();this.store[action]();this.recorder.event('history-request',{action,dispatchMs:performance.now()-start,index:this.store.currentIndex});this.request();}
 cancelGesture(){if(this.stroke&&!this.finalBlendResult)this.blendWorker.cancel();if(this.recorder.recording&&this.diagnostics.summary().active)this.recorder.event('gesture-cancel',{id:this.capture?.gestureId,pointerId:this.pointerId});this.diagnostics.finish('discarded',this.stroke,this.lasso,this.audit());this.liveGeometry=undefined;this.liveTip=undefined;this.releaseCapture();this.strokeTarget=undefined;this.stroke=undefined;this.strokeMirror=undefined;this.mirrorPivotDrag=false;this.pickup=undefined;this.lasso=undefined;this.strokePending=undefined;this.rectangleStart=undefined;this.pan=undefined;this.drag=undefined;this.canvas.style.cursor='';this.paintCursor();this.navigation=undefined;this.vectors.cancel();this.smoothing.cancel();this.pointerId=undefined;this.request();}
 private finishSelection(){if(this.lasso&&this.lasso.length>=3){this.selection=this.lasso;this.onSelection(true);}this.lasso=undefined;this.rectangleStart=undefined;}
 private audit(){if(!this.diagnostics.enabled||!this.capture)return undefined;const sourceSamples=this.stroke?.points.length??this.lasso?.length??0,stats=this.capture.stats,accountedSamples=sourceSamples+this.geometricDuplicates;return {audit:{...stats,geometricDuplicates:this.geometricDuplicates,sourceSamples,accountedSamples,samplesLost:this.tool==='rectangle'||!this.stroke&&!this.lasso?null:stats.acceptedSamples!==accountedSamples},captured:this.capture.records()};}
 diagnosticSnapshot(){const summary=this.diagnostics.summary();return {...summary,tool:this.tool,preset:{...this.preset},device:this.pointerId===undefined?summary.trace?.device??this.device:this.device,pointerId:this.pointerId,rawSamples:this.stroke?.points.length??this.lasso?.length??summary.trace?.sourceSamples??0,geometrySamples:this.stroke?this.liveGeometry?.points.length??0:summary.trace?.geometrySamples??0,segments:this.stroke?this.liveGeometry?.cubics.length??0:summary.trace?.segments??0,pressure:this.stroke?.points.at(-1)?.p??this.cursor?.p,brush:{size:this.brush.size,opacity:this.brush.opacity,smoothness:this.brush.smoothness??0,stabilization:this.brush.stabilization},capture:this.capture?.stats??summary.trace?.audit};}
 private finalizeStroke(stroke?:Stroke){
  this.finalLayerResult=undefined;this.finalBlendResult=undefined;if(!stroke)return undefined;
  const start=performance.now(),snapshot=strokeSnapshot(stroke);
  if(!this.strokeMirror&&this.blendSource&&this.blendWorker.matches(snapshot,this.blendSource)){const pending=this.blendWorker.finish(snapshot);if(pending){this.finalBlendResult={stroke:snapshot,base:this.blendSource,...pending};const ms=performance.now()-start;this.performance.record('finalProcessingMs',ms);this.diagnostics.timing('finalProcessingMs',ms);return snapshot;}}
  const geometry=finalGeometry(snapshot),pencil=!!snapshot.brushKind?.startsWith('graphite-');
  if(!this.mirrorDrawing.enabled&&pencil){const doc=this.store.getSnapshot(),layer=doc.layers.find(l=>l.id===this.strokeTarget?.layer);if(layer)this.renderer.deferPencil(snapshot,this.scratch,layer,doc,()=>this.request());}
  if(snapshot.liveRefinementVersion===3&&!this.displayInk(snapshot)){
   if(snapshot.brushKind==='airbrush'&&snapshot.paintTipVersion!==2){const sc=this.scratch.getContext('2d')!;sc.clearRect(0,0,this.scratch.width,this.scratch.height);drawStroke(sc,snapshot,'final',geometry);}else this.liveRaster.paint(this.scratch.getContext('2d')!,snapshot,geometry);
   const doc=this.store.getSnapshot(),layer=doc.layers.find(l=>l.id===this.strokeTarget?.layer);
   if(!pencil&&!this.strokeMirror&&layer){
    const base=this.renderer.get(layer,doc),preview=this.previewSurface;if(preview.width!==doc.width)preview.width=doc.width;if(preview.height!==doc.height)preview.height=doc.height;
    const pc=preview.getContext('2d')!;pc.resetTransform();pc.globalAlpha=1;pc.globalCompositeOperation='source-over';pc.clearRect(0,0,doc.width,doc.height);pc.drawImage(base,0,0);
    // Use the known source identity, preserving the same final pigment math
    // without matching/readback and a second canonical layer simulation.
    compositePaintStroke(pc,this.scratch,snapshot,0,0,undefined,base);this.finalLayerResult={stroke:snapshot,base,canvas:preview};
   }else this.renderer.rememberStrokeRaster(snapshot,this.scratch);
  }
  if(this.strokeMirror&&snapshot.liveRefinementVersion!==3){const sc=this.scratch.getContext('2d')!;sc.clearRect(0,0,this.scratch.width,this.scratch.height);drawStroke(sc,snapshot,'final',geometry);this.renderer.rememberStrokeRaster(snapshot,this.scratch);}
  const ms=performance.now()-start;this.performance.record('finalProcessingMs',ms);this.diagnostics.timing('finalProcessingMs',ms);return snapshot;
 }
 private displayInk(stroke:Stroke){return !stroke.transform&&displayCleanInk(stroke)&&!this.mirrorDrawing.enabled&&!this.selection.length&&!this.strokeIds.length;}
 private commitStroke(stroke:Stroke|undefined,target:typeof this.strokeTarget){const ready=this.finalLayerResult,async=this.finalBlendResult;this.finalLayerResult=undefined;this.finalBlendResult=undefined;if(!stroke||!target)return false;const doc=this.store.getSnapshot(),layer=doc.layers.find(l=>l.id===target.layer);if(doc.id!==target.project||!layer||layer.locked||!layer.visible){this.notify('Stroke canceled because its target layer changed.');return false;}let next=appendOperation({...doc,activeLayerId:target.layer},stroke);if(this.strokeMirror){const other=strokeSnapshot(reflectedStroke(stroke,this.strokeMirror.matrix,this.strokeMirror.id)),c=makeCanvas(doc.width,doc.height),cc=c.getContext('2d')!;cc.transform(...this.strokeMirror.matrix);cc.drawImage(this.scratch,0,0);this.renderer.rememberStrokeRaster(other,c);c.width=c.height=0;next=appendOperation(next,other);}this.strokeMirror=undefined;this.store.commit({...next,activeLayerId:doc.activeLayerId});if(async?.stroke===stroke){const p=this.store.getSnapshot(),layer=p.layers.find(l=>l.id===target.layer);if(layer)this.renderer.deferLayerResult(layer,p,stroke,async.base,async.preview,async.done,()=>this.request());}if(ready?.stroke===stroke){const p=this.store.getSnapshot(),layer=p.layers.find(l=>l.id===target.layer),old=layer&&this.renderer.adoptLayerResult(layer,p,stroke,ready.base,ready.canvas);if(old){this.previewSurface=old;this.previewStrokeId='';this.previewBase=undefined;this.previewBaseOperations=undefined;}else this.renderer.rememberStrokeRaster(stroke,this.scratch);}return true;}
 finishGesture(reason='interrupted'){const stroke=this.finalizeStroke(this.stroke),target=this.strokeTarget;this.recorder.event('gesture-end',{reason,id:this.capture?.gestureId,pointerId:this.pointerId,sourcePoints:stroke?.points.length??this.lasso?.length??0,captured:this.capture?.count});this.diagnostics.finish(reason,stroke,this.lasso,this.audit());if(this.strokePending){this.lasso=undefined;this.strokePending=undefined;}else this.finishSelection();const mirror=this.strokeMirror;this.cancelGesture();this.strokeMirror=mirror;const committed=this.commitStroke(stroke,target);if(stroke)this.diagnostics.committed(stroke.id,committed);}
 private paintCursor(){
  const c=this.cursorOverlay,ctx=c.getContext('2d');if(!ctx)return;
  ctx.setTransform(1,0,0,1,0,0);
  const dpr=window.devicePixelRatio||1;
  if(this.previousCursor){const {x,y,r}=this.previousCursor;ctx.clearRect(Math.floor((x-r-4)*dpr),Math.floor((y-r-4)*dpr),Math.ceil((r+4)*dpr)*2,Math.ceil((r+4)*dpr)*2);this.previousCursor=undefined;}
  if(!this.cursor||this.space)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // Directional pen cursor: only a tiny overlay canvas redraw, not a document redraw.
  // Move shows travel direction; Scale shows edge/corner pull; Rotate shows its turn.
  if(this.drag&&(this.tool==='stroke-select'||this.tool==='transform')){
   const g=this.drag,position=toScreen(this.cursor,this.view),start=toScreen({x:g.x,y:g.y},this.view);
   const dx=position.x-start.x,dy=position.y-start.y;
   const length=Math.hypot(dx,dy),angle=g.kind==='rotate'?angleDelta(Math.atan2(this.cursor.y-g.center.y,this.cursor.x-g.center.x),Math.atan2(g.y-g.center.y,g.x-g.center.x)):0;
   const r=37;this.previousCursor={x:position.x,y:position.y,r};
   ctx.save();ctx.translate(position.x+16,position.y-16);
   ctx.lineWidth=1.7;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#abfffc';ctx.fillStyle='#9cfbfa';ctx.shadowColor='#00cde7';ctx.shadowBlur=3;
   const arrow=(theta:number,span=12)=>{ctx.save();ctx.rotate(theta);ctx.beginPath();ctx.moveTo(-span*.5,0);ctx.lineTo(span*.55,0);ctx.stroke();ctx.beginPath();ctx.moveTo(span*.55,0);ctx.lineTo(span*.17,-4);ctx.lineTo(span*.17,4);ctx.closePath();ctx.fill();ctx.restore();};
   if(g.kind==='rotate'){
    ctx.beginPath();ctx.arc(0,0,11,angle>=0?-Math.PI*.73:Math.PI*.73,angle>=0?Math.PI*.57:-Math.PI*.57,angle<0);ctx.stroke();
    const a=angle>=0?Math.PI*.57:-Math.PI*.57;ctx.save();ctx.translate(11*Math.cos(a),11*Math.sin(a));ctx.rotate(a+(angle>=0?Math.PI/2:-Math.PI/2));ctx.beginPath();ctx.moveTo(3.5,0);ctx.lineTo(-3.8,-3.5);ctx.lineTo(-3.8,3.5);ctx.closePath();ctx.fill();ctx.restore();
   }else if(g.kind==='scale'||g.kind==='perspective'){
    const theta=length>1?Math.atan2(dy,dx):Math.atan2(g.y-g.center.y,g.x-g.center.x);
    arrow(theta,16);
    ctx.save();ctx.rotate(theta);ctx.beginPath();ctx.rect(-10,-9,20,18);ctx.strokeStyle='#71e7e8';ctx.lineWidth=.75;ctx.stroke();ctx.restore();
   }else if(length>2){arrow(Math.atan2(dy,dx),17);}
   else {ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(6,0);ctx.moveTo(0,-6);ctx.lineTo(0,6);ctx.stroke();}
   ctx.restore();return;
  }
  if(!['brush','eraser'].includes(this.tool))return;
  const position=toScreen(this.stroke&&this.liveTip?this.liveTip:this.cursor,this.view),b=this.stroke??this.brush,p=this.stroke?.points.at(-1);
  const response=this.stroke?.pressure&&b.pressureWidth!==false?pressureResponse(Math.pow(p?.p??1,b.response),b.pressureCurve):1;
  const velocity=this.stroke?.velocityTaper?p?.v??1:1;
  const factor=this.stroke&&(this.stroke.pressure&&b.pressureWidth!==false||this.stroke.velocityTaper)?widthResponse(response*velocity,b):1;
  const radius=b.size*this.view.zoom*factor/2;
  // Dry-bristle v2 is an oval filament bundle, never the square chalk nib.
  // Keep chalk metadata for backwards compatibility with saved artwork.
  if(b.dryBristleVersion===2||b.dryBristleVersion===3){
   const points=this.stroke?.points,prev=points&&points.length>1?points[points.length-2]:undefined,last=points?.at(-1);
   const direction=prev&&last?Math.atan2(last.y-prev.y,last.x-prev.x):0;
   this.previousCursor={x:position.x,y:position.y,r:radius*1.4+3};
   ctx.save();ctx.translate(position.x,position.y);ctx.rotate(this.view.rotation+direction);
   ctx.beginPath();ctx.ellipse(0,0,Math.max(1,radius*.52),Math.max(1,radius*.87),0,0,Math.PI*2);
   ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();ctx.strokeStyle='#29343a';ctx.lineWidth=1;ctx.stroke();ctx.restore();return;
  }
  if(b.brushTip&&b.brushTip!=='round'||b.brushKind==='flat'){this.previousCursor={x:position.x,y:position.y,r:radius*1.5+2};const textured=b.brushTip&&b.brushTip!=='round';if(!textured&&!originalFlatOutline){originalFlatOutline=new Path2D();originalFlatOutline.rect(-.5,-.15,1,.3);}const path=b.coloringEngine===1?colorNibOutline(b.colorNib??defaultColorNib(b.brushTip)):b.watercolorShape?watercolorShapePath(b.watercolorShape):textured?paintingOutline(b.brushTip!,b.hardness??.7,b.textureStrength??0,isWatercolorTip(b.brushTip)):originalFlatOutline!,diameter=Math.max(.1,radius*2);ctx.save();ctx.translate(position.x,position.y);ctx.rotate(this.view.rotation+(textured?(b.tipAngle??0)*Math.PI/180:-.55)+(b.coloringEngine===1&&b.colorNibFollow&&this.stroke&&this.stroke.points.length>1?Math.atan2(this.stroke.points.at(-1)!.y-this.stroke.points.at(-2)!.y,this.stroke.points.at(-1)!.x-this.stroke.points.at(-2)!.x)+Math.PI/2:0));ctx.scale(diameter,diameter);ctx.strokeStyle='#fff';ctx.lineWidth=2.5/diameter;ctx.stroke(path);ctx.strokeStyle='#29343a';ctx.lineWidth=1/diameter;ctx.stroke(path);ctx.restore();return;}
  this.previousCursor={x:position.x,y:position.y,r:radius};
  ctx.beginPath();ctx.arc(position.x,position.y,radius,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();ctx.strokeStyle='#29343a';ctx.lineWidth=1;ctx.stroke();
 }
 private resizeCursor(){const c=this.cursorOverlay,dpr=window.devicePixelRatio||1,w=Math.round(this.width*dpr),h=Math.round(this.height*dpr);if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;this.previousCursor=undefined;this.paintCursor();}
 private resize(){const r=this.canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;if(Math.abs(r.width-this.width)<.01&&Math.abs(r.height-this.height)<.01&&this.canvas.width===Math.round(r.width*dpr)&&this.canvas.height===Math.round(r.height*dpr))return;if(this.stroke||this.lasso)this.finishGesture('resize');const dx=r.width-this.width,dy=r.height-this.height;this.width=r.width;this.height=r.height;this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.view={...this.view,x:this.view.x+dx/2,y:this.view.y+dy/2};this.onView(this.view);this.resizeCursor();this.onion.setView(this.view,this.width,this.height,dpr);this.flipbook.setView(this.view,this.width,this.height,dpr);this.request();}
 fit(){const p=this.store.getSnapshot();this.setView(fitView(this.width,this.height,p.width,p.height,this.view.rotation));}
 reset(){const p=this.store.getSnapshot();this.setView({x:(this.width-p.width)/2,y:(this.height-p.height)/2,zoom:1,rotation:0});}
 private stopViewMotion(){if(this.viewRefineTimer)clearTimeout(this.viewRefineTimer);this.viewRefineTimer=undefined;this.viewMoving=false;this.viewRefining=false;}
 private beginViewMotion(){this.stopViewMotion();this.viewMoving=true;this.viewRefineTimer=setTimeout(()=>{this.viewRefineTimer=undefined;this.viewMoving=false;this.viewRefining=true;this.request();},160);}
 private publishView(){this.viewPending=false;this.onView(this.view);this.paintCursor();}
 setView(view:View,deferNotification=false,interactive=false){
  const changed=view.x!==this.view.x||view.y!==this.view.y||view.zoom!==this.view.zoom||view.rotation!==this.view.rotation;
  if(changed&&interactive&&!this.viewMoving&&this.hasRendered&&this.navigationSurface.style.display==='none'&&this.navigationSnapshot.canvas.style.display==='none')this.navigationSnapshot.capture(this.canvas,this.store.getSnapshot(),this.view,this.width,this.height);
  if(changed&&interactive)this.beginViewMotion();if(changed&&!deferNotification&&!interactive)this.stopViewMotion();if(changed&&(this.stroke||this.lasso))this.finishGesture('view-change');this.view=view;
  this.onion.setView(view,this.width,this.height,window.devicePixelRatio||1);this.flipbook.setView(view,this.width,this.height,window.devicePixelRatio||1);
  if(deferNotification)this.viewPending=true;else this.publishView();this.request();
 }
 zoomTo(zoom:number){zoom=Math.max(.25,Math.min(8,zoom));const pivot={x:this.width/2,y:this.height/2},p=toProject(pivot,this.view),v={...this.view,zoom};const s=toScreen(p,v);this.setView({...v,x:v.x+pivot.x-s.x,y:v.y+pivot.y-s.y},false,true);}
 rotate(deg:number){const pivot={x:this.width/2,y:this.height/2},p=toProject(pivot,this.view),v={...this.view,rotation:deg*Math.PI/180};const s=toScreen(p,v);this.setView({...v,x:v.x+pivot.x-s.x,y:v.y+pivot.y-s.y});}
 setInput(t:Tool,brush:BrushSettings,preset?:{id:string;name:string}){const next=preset?{...preset}:{id:brush.brushKind??'custom',name:brush.brushKind??'Custom brush'},changed=t!==this.tool,presetChanged=next.id!==this.preset.id||brush.brushKind!==this.brush.brushKind;if((changed||presetChanged&&!this.drawing)&&this.pointerId!==undefined)this.finishGesture(changed?'tool-change':'preset-change');if(this.recorder.recording)this.recorder.event(changed?'tool-change':presetChanged?'preset-change':'brush-settings',{tool:t,preset:next,settings:structuredClone(brush)});if(changed&&(t==='stroke-select'||this.tool==='stroke-select'))this.clearSelection();this.preset=next;this.tool=t;this.canvas.style.cursor='';this.brush=structuredClone(brush);if(t==='brush'&&(this.brush.nativeMixEnabled||workerBlendEligible({...this.brush,...brushStrokeMetadata(this.brush),tool:'brush'})))this.blendWorker.warm();this.paintCursor();this.request();}
 setTool(t:Tool){this.setInput(t,this.brush);}
 clearSelection(){const changed=!!(this.selection.length||this.strokeIds.length||this.warpQuad||this.transform.dx||this.transform.dy||this.transform.angle||this.transform.scale!==1||(this.transform.scaleX??1)!==1||(this.transform.scaleY??1)!==1);if(this.canvas)this.canvas.style.cursor='';this.selection=[];this.strokeIds=[];this.strokeExact.clear();this.warpQuad=undefined;this.transform={dx:0,dy:0,scale:1,angle:0};if(changed){this.onSelection(false);this.onStrokeSelection(0);}if(this.vectors.selectedId!==null)this.vectors.select(null);this.smoothing.cancel();this.request();}
 setTransform(settings:Partial<TransformSettings>){this.transform={...this.transform,...settings};this.onTransform(this.transform);this.request();}
 private displayedCorners():XY[]{const cs=controls(this.selection,this.transform,this.view.zoom);return this.warpQuad?this.warpQuad.map(pt=>mapPoint(pt,this.matrix())):cs.corners;}
 private projectiveMatrix():H|null{
  if(!this.warpQuad||this.selection.length<4)return null;
  const baseline=this.selection.map(({x,y})=>({x,y})),h=homography(baseline,this.warpQuad);
  return h?multiplyH(affineH(this.matrix()),h):null;
 }
 matrix():Matrix{return selectionMatrix(this.selection,this.transform);}
 applySelection(){if(!this.selection.length)return;if(this.strokeIds.length){this.commitSelectedStrokes();return;}const p=this.store.getSnapshot();if(activeLayer(p).locked||!activeLayer(p).visible){this.notify('Unlock and show the active layer before transforming.');return;}if(activeLayer(p).kind==='vector')this.vectors.applyLasso(this.selection,this.matrix());else this.store.commit(appendOperation(p,{id:uid(),kind:'transform',polygon:[...this.selection],matrix:this.matrix()}));this.clearSelection();}
 setStrokeMode(mode:typeof this.strokeMode){this.strokeMode=mode;if(mode==='lasso')this.strokeShape='lasso';if(this.canvas)this.canvas.style.cursor='';if(this.cursorOverlay)this.paintCursor();this.onStrokeMode(mode);this.request();}
 setFreeformCornerMode(mode:'scale'|'perspective'){this.freeformCornerMode=mode;this.request();}
 setAreaTransformMode(mode:typeof this.areaTransformMode){this.areaTransformMode=mode;if(this.canvas)this.canvas.style.cursor='';this.request();}
 strokeIdsInArea(){return this.selection.length>=3?this.marqueeStrokeIds(this.selection):[];}
 selectStrokesForPerspective(ids:string[]){this.setStrokeIds(ids);this.setStrokeMode('perspective');}
 setStrokeScope(scope:'current'|'visible'){this.strokeScope=scope;this.clearSelection();}
 private selectableLayers(){const p=this.store.getSnapshot();return this.strokeScope==='visible'?p.layers.filter(l=>l.visible&&!l.locked&&!l.reference):[activeLayer(p)].filter(l=>l.visible&&!l.locked&&!l.reference);}
 private findStrokeAt(p:Point){for(const l of this.selectableLayers()){const found=hitStroke(l,p,this.view.zoom);if(found)return found;}return undefined;}
 private marqueeStrokeIds(poly:Point[]){return [...new Set(this.selectableLayers().flatMap(l=>idsInMarquee(l,poly,this.strokePickMode)))];}
 setPickMode(mode:PickMode){this.strokePickMode=mode;}
 selectAllStrokes(){this.setStrokeIds(this.selectableLayers().flatMap(l=>selectable(l).map(o=>o.id)));}
 setStrokeShape(shape:'rectangle'|'lasso'){this.strokeShape=shape;}
 startVanishingPoint(){this.pickVanishingPoint=true;this.notify('Click the drawing to set the perspective vanishing point.');}
 private selectedOperations(){const ids=new Set(this.strokeIds);return this.selectableLayers().flatMap(l=>selectable(l).filter(o=>ids.has(o.id)));}
 private setStrokeIds(ids:string[]){
  const set=new Set(ids),ops=this.selectableLayers().flatMap(l=>selectable(l).filter(o=>set.has(o.id)));
  this.strokeIds=ops.map(o=>o.id);this.strokeExact.clear();this.warpQuad=undefined;
  const b=boundsOf(ops);
  this.selection=b?rectangle({x:b.x,y:b.y,p:1},{x:b.x+b.w,y:b.y+b.h,p:1}):[];
  this.transform={dx:0,dy:0,scale:1,angle:0};this.onTransform(this.transform);
  this.onSelection(this.selection.length>=3);this.onStrokeSelection(this.strokeIds.length);this.request();
 }
 /** Real saved stroke operations, never a pixel crop. */
 private commitSelectedStrokes(){
  const p=this.store.getSnapshot();if(!this.strokeIds.length)return;
  const m=this.matrix(),h=this.projectiveMatrix();if(this.warpQuad&&!h){this.notify('Perspective corners overlap. Adjust the corners to a valid shape.');return;}
  if(m.every((v,i)=>Math.abs(v-IDENTITY[i])<1e-8)&&!this.warpQuad){this.setStrokeMode('select');return;}
  const ids=new Set(this.strokeIds);
  const layers=p.layers.map(layer=>{
   if(layer.locked||!layer.visible||layer.reference||!layer.operations.some(o=>ids.has(o.id)))return layer;
   return {...layer,operations:layer.operations.map(op=>!ids.has(op.id)?op:op.kind==='stroke'?(h?projectiveStroke(op,h):transformedStroke(op,m)):op.kind==='vector'?(h?projectiveVector(op,h):transformVector(op,m)):op)};
  });
  const selected=[...this.strokeIds];
  const transformed=syncActiveFrame({...p,layers});
  // Artist-moved bound parts control the motion path too; unrelated strokes never enter this branch.
  this.store.commit(followBoundSelectionTransform(p,transformed,selected),'Transform selected strokes');
  // Re-select the transformed identities so their real ink remains highlighted.
  this.setStrokeIds(selected);this.setStrokeMode('select');
 }

 /** Delete chosen strokes or clear the current raster layer inside a traditional lasso/rectangle.
  * A single undoable operation. Never deletes an animation frame from canvas focus.
  */
 deleteSelectedArtwork(){
  if(this.strokeIds.length){this.strokeAction('delete');return;}
  if(this.selection.length<3){this.notify('Select strokes or lasso an area first.');return;}
  const p=this.store.getSnapshot(),layer=activeLayer(p);
  if(layer.locked||!layer.visible||layer.reference){this.notify('Choose an unlocked visible drawing layer.');return;}
  if(layer.kind==='vector'){this.notify('Use Stroke Select (S) for deleting vector lines.');return;}
  const polygon=this.selection.map(point=>({...point}));
  this.store.commit({...p,layers:p.layers.map(l=>l.id===layer.id?{...l,operations:[...l.operations,{id:uid(),kind:'clear' as const,polygon}]}:l)},'Clear selected drawing area');
  this.clearSelection();
 }
 strokeAction(action:'delete'|'duplicate'|'copy'|'cut'|'paste'|'flip-h'|'flip-v'|'nudge',dx=0,dy=0){
  const p=this.store.getSnapshot(),layer=activeLayer(p),ids=new Set(this.strokeIds);
  if(action==='paste'){
   if(!this.strokeClipboard?.length)return this.notify('Copy strokes first.');
   if(layer.locked||!layer.visible||layer.reference||this.strokeClipboard.some(o=>(o.kind==='vector')!==(layer.kind==='vector')))return this.notify('Choose a compatible unlocked drawing layer to paste.');
   const offset:Matrix=[1,0,0,1,12,12];
   const pasted=this.strokeClipboard.map(o=>o.kind==='stroke'?transformedStroke({...structuredClone(o),id:uid()},offset):transformVector({...structuredClone(o),id:uid()},offset));
   this.store.commit({...p,layers:p.layers.map(l=>l.id===layer.id?{...l,operations:[...l.operations,...pasted]}:l)},'Paste strokes');this.setStrokeIds(pasted.map(o=>o.id));return;
  }
  if(!ids.size)return;
  const selected=this.selectedOperations();if(!selected.length)return;
  if(action==='nudge'){this.setTransform({dx:this.transform.dx+dx,dy:this.transform.dy+dy});return;}
  if(action==='copy'||action==='cut'){
   const kinds=new Set(selected.map(o=>o.kind));if(kinds.size>1){this.notify('Copy/paste mixed raster and vector selection separately; transforms can still use both.');return;}
   this.strokeClipboard=structuredClone(selected);if(action==='copy'){this.notify(`${selected.length} stroke(s) copied.`);return;}
  }
  if(action==='delete'||action==='cut'){
   const layers=p.layers.map(l=>l.locked||!l.visible||l.reference?l:{...l,operations:l.operations.filter(o=>!ids.has(o.id))});
   this.store.commit({...p,layers},action==='cut'?'Cut strokes':'Delete selected strokes');this.clearSelection();return;
  }
  const b=boundsOf(selected);if(!b)return;
  const flip:Matrix=action==='flip-h'?[-1,0,0,1,2*b.x+b.w,0]:[1,0,0,-1,0,2*b.y+b.h];
  const offset:Matrix=[1,0,0,1,12,12],m=this.matrix(),h=this.projectiveMatrix(),newIds:string[]=[];
  const layers=p.layers.map(l=>{
   if(l.locked||!l.visible||l.reference||!l.operations.some(o=>ids.has(o.id)))return l;
   if(action==='duplicate'){
    const added=l.operations.filter((o):o is Selectable=>ids.has(o.id)&&(o.kind==='stroke'&&o.tool==='brush'||o.kind==='vector')).map(o=>{
     const fresh={...structuredClone(o),id:uid()};newIds.push(fresh.id);
     return fresh.kind==='stroke'?transformedStroke(h?projectiveStroke(fresh,h):transformedStroke(fresh,m),offset):transformVector(h?projectiveVector(fresh,h):transformVector(fresh,m),offset);
    });return {...l,operations:[...l.operations,...added]};
   }
   return {...l,operations:l.operations.map(o=>!ids.has(o.id)?o:o.kind==='stroke'?transformedStroke(o,flip):o.kind==='vector'?transformVector(o,flip):o)};
  });
  this.store.commit({...p,layers},action==='duplicate'?'Duplicate strokes':action==='flip-h'?'Flip strokes horizontally':'Flip strokes vertically');
  this.setStrokeIds(action==='duplicate'?newIds:this.strokeIds);
 }

 private exactStrokePreview(layer:Project['layers'][number],p:Project){
  const ids=new Set(this.strokeIds),matrix=this.matrix(),h=this.projectiveMatrix();
  if(!h&&matrix.every((v,i)=>Math.abs(v-IDENTITY[i])<1e-8))return this.renderer.get(layer,p);
  const key=JSON.stringify([this.strokeIds,matrix,h]);let cached=this.strokeExact.get(layer.id);
  if(!cached||cached.source!==layer.operations||cached.key!==key){
   const operations=layer.operations.map(op=>!ids.has(op.id)||op.kind!=='stroke'?op:h?projectiveStroke(op,h):transformedStroke(op,matrix));
   cached={source:layer.operations,key,operations};this.strokeExact.set(layer.id,cached);
  }
  // Temporary ID prevents the editable document layer renderer cache from being replaced.
  // Replaying operations in their original order keeps later strokes, erasers and fills on top.
  return this.renderer.get({...layer,id:layer.id+':stroke-transform-preview',operations:cached.operations},p);
 }
 private local(e:PointerEvent|WheelEvent){const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 private point(e:PointerEvent,rect=this.canvas.getBoundingClientRect()):Point {return {...toProject({x:e.clientX-rect.left,y:e.clientY-rect.top},this.view),p:e.pointerType==='pen'?inputPressure(e.pressure,this.stroke?.points.at(-1)?.p):1};}
 private down=(e:PointerEvent)=>{
  this.navigationScene.pauseWarmup();
  if(this.flipbook.previewActive){this.recorder.event('ignored-contact',{reason:'flipbook-preview',pointerType:e.pointerType});return;}
  const rejection=rejectCanvasContact(e,this.pointerId,this.busy);if(rejection){this.recorder.event('ignored-contact',{reason:rejection,pointerType:e.pointerType,pointerId:e.pointerId,button:e.button,isPrimary:e.isPrimary,busy:this.busy,activePointerId:this.pointerId});return;}if(this.pointerId!==undefined){if(e.timeStamp<(this.capture?.started??0))return;this.finishGesture('new-primary-contact');}e.preventDefault();this.pointerId=e.pointerId;this.capture=new PointerPath(e.pointerId,e.timeStamp,e,uid());this.diagnostics.begin(this.capture.gestureId,this.tool,this.view,this.canvas.getBoundingClientRect(),this.brush,e,this.preset);this.recorder.event('gesture-start',{id:this.capture.gestureId,pointerId:e.pointerId,pointerType:e.pointerType,button:e.button,preset:this.preset,tool:this.tool});this.device=e.pointerType;this.geometricDuplicates=0;this.capture.onBatch=(event,samples,replay)=>this.diagnostics.record(event,samples,replay);this.canvas.focus({preventScroll:true});try{this.canvas.setPointerCapture(e.pointerId);}catch{this.recorder.event('capture-fallback',{pointerId:e.pointerId});this.captureFallback();}const local=this.local(e),p=this.point(e),doc=this.store.getSnapshot();
  if(this.mirrorDrawing.enabled&&!this.mirrorDrawing.lockCenter&&!this.space&&e.button===0&&(this.pickMirrorPivot||Math.hypot(p.x-mirrorPivot(this.mirrorDrawing,doc).x,p.y-mirrorPivot(this.mirrorDrawing,doc).y)<8/this.view.zoom)){this.setMirrorPivot(p);this.mirrorPivotDrag=true;this.pickMirrorPivot=false;this.onMirrorChange();return;}
  if(this.space||this.tool==='hand'||e.button===1){this.pan={...local,vx:this.view.x,vy:this.view.y};return;}
  if(this.tool==='zoom'||this.tool==='rotate'){this.navigation={...local,view:{...this.view},alt:e.altKey,moved:false};return;}
  if(this.tool==='eyedropper'){if(p.x>=0&&p.y>=0&&p.x<doc.width&&p.y<doc.height){const pixel=context(this.renderer.composite(doc,{includeReferences:false})).getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;this.onColor('#'+Array.from(pixel.slice(0,3)).map(n=>n.toString(16).padStart(2,'0')).join(''));}return;}
  const layer=activeLayer(doc);if(this.tool!=='stroke-select'&&(layer.locked||!layer.visible)){this.diagnostics.note('Active layer is locked or hidden.');this.notify('The active layer is locked or hidden.');return;}
  if(layer.reference&&!['lasso','rectangle','transform','stroke-select'].includes(this.tool)){this.notify('Choose an artwork layer to draw. Reference images have their own placement controls.');return;}
  if(this.tool==='stroke-select'){
   if(this.pickVanishingPoint){this.vanishingPoint={x:p.x,y:p.y};this.pickVanishingPoint=false;this.request();return;}
   const selecting=this.strokeMode==='select'||this.strokeMode==='lasso';
   if(!selecting&&this.strokeIds.length&&this.selection.length){
    const c=controls(this.selection,this.transform,this.view.zoom),corners=this.displayedCorners(),near=(q:XY)=>Math.hypot(q.x-p.x,q.y-p.y)<10/this.view.zoom,idx=corners.findIndex(near);
    if(this.strokeMode==='freeform'){
     const perspective=this.freeformCornerMode==='perspective'||e.ctrlKey||e.metaKey;
     const hit=freeformHit(p,corners,c.rotation,c.center,c.top,this.view.zoom,perspective);
     if(hit.kind==='corner'){
      this.drag={...p,settings:{...this.transform},kind:perspective?'perspective':'scale',center:c.center,anchor:corners[((hit.index??0)+2)%4],corner:hit.index,startQuad:this.warpQuad?this.warpQuad.map(q=>({...q})):this.selection.map(q=>({x:q.x,y:q.y}))};return;
     }
     if(hit.kind==='edge'){
      this.drag={...p,settings:{...this.transform},kind:'scale',center:c.center,anchor:edgeHandles(corners)[((hit.index??0)+2)%4],edge:hit.index};return;
     }
     if(hit.kind==='rotation'){this.drag={...p,settings:{...this.transform},kind:'rotate',center:c.center};return;}
    }else{
     if((this.strokeMode==='scale'||this.strokeMode==='perspective')&&idx>=0){
      this.drag={...p,settings:{...this.transform},kind:this.strokeMode==='perspective'?'perspective':'scale',center:c.center,anchor:corners[(idx+2)%4],corner:idx,startQuad:this.warpQuad?this.warpQuad.map(q=>({...q})):this.selection.map(q=>({x:q.x,y:q.y}))};return;
     }
     if(this.strokeMode==='rotate'&&(near(c.rotation)||Math.abs(Math.hypot(p.x-c.center.x,p.y-c.center.y)-rotationRadius(c.center,c.top,this.view.zoom,corners))<8/this.view.zoom)){this.drag={...p,settings:{...this.transform},kind:'rotate',center:c.center};return;}
    }
    // A selected group may contain clear gaps. Transforming any location within
    // the selection hull should work, but never while in stroke-picking mode.
    if(['move','freeform','perspective-move'].includes(this.strokeMode)&&nearSelection(p,corners.map(q=>({...q,p:1})),3/this.view.zoom)){
     this.drag={...p,settings:{...this.transform},kind:this.strokeMode==='perspective-move'?'perspective-move':'move',center:c.center};return;
    }
   }
   if(this.strokeMode==='lasso'){this.strokePending={x:p.x,y:p.y,shift:e.shiftKey};this.lasso=undefined;return;}
   // A transform-only mode must not unexpectedly reselect strokes on a missed handle.
   if(!selecting&&this.strokeIds.length)return;
   const hit=this.findStrokeAt(p);
   if(hit){
    if(e.shiftKey)this.setStrokeIds(this.strokeIds.includes(hit.id)?this.strokeIds.filter(id=>id!==hit.id):[...this.strokeIds,hit.id]);
    else if(!this.strokeIds.includes(hit.id))this.setStrokeIds([hit.id]);
    // A plain click NEVER begins a transform. Choose a transform icon first.
    return;
   }
   this.strokePending={x:p.x,y:p.y,shift:e.shiftKey};this.lasso=undefined;return;
  }
  if(this.tool==='vector'){this.vectorStartPressure=p.p;this.vectorFirstPressureTime=e.pointerType==='pen'&&Number.isFinite(e.pressure)&&e.pressure>0?e.timeStamp:Infinity;this.vectors.down(p,this.view.zoom,e.pointerType==='pen');return;}
  if(this.tool==='lasso'||this.tool==='rectangle'){this.clearSelection();this.lasso=[p];if(this.tool==='rectangle')this.rectangleStart=p;return;}
  if(this.tool==='transform'){
   if(this.selection.length){
    const c=controls(this.selection,this.transform,this.view.zoom),near=(q:{x:number;y:number})=>Math.hypot(q.x-p.x,q.y-p.y)<10/this.view.zoom;
    const corner=c.corners.findIndex(near),rotation=near(c.rotation);
    const mode=this.areaTransformMode;
    const kind=mode==='freeform'?(rotation?'rotate':corner>=0?'scale':'move'):
     mode==='move'?'move':mode==='scale'&&corner>=0?'scale':mode==='rotate'&&rotation?'rotate':null;
    if(kind&&nearSelection(p,c.corners.map(q=>({...q,p:1})),12/this.view.zoom)||kind&&kind!=='move')
     this.drag={...p,settings:{...this.transform},kind:kind!,center:c.center,anchor:corner>=0?c.corners[(corner+2)%4]:c.center};
   }else this.notify('Draw a selection before moving artwork.');return;
  }
  if(layer.kind==='vector'){this.notify('Choose a raster layer for Pencil, Eraser or Fill. This layer contains editable vector lines.');return;}
  if(this.tool==='fill'){void this.fill(p);return;}
  if(p.x<0||p.y<0||p.x>doc.width||p.y>doc.height){this.diagnostics.note('Press began outside project boundaries.');return;}
  if(this.tool==='brush'&&this.brush.nativeMixEnabled&&layer.operations.length===0){this.notify('Mix needs existing paint on the selected layer. Paint two colours with Paint mode, then switch to Mix on that same layer.');return;}
  if(this.tool==='brush'&&this.brush.brushTip==='color-blender'&&layer.operations.length===0){this.notify('Blender works on paint in the active layer. Select your painted layer first.');return;}
  this.cancelDrawingWarmup();if(this.tool==='brush'&&this.brush.nativeMixEnabled)this.blendWorker.retryForNewGesture();this.renderer.prepareForInput(doc);this.clearSelection();if(this.scratch.width!==doc.width)this.scratch.width=doc.width;if(this.scratch.height!==doc.height)this.scratch.height=doc.height;
  this.strokeMirror=this.mirrorDrawing.enabled?{matrix:mirrorMatrix(this.mirrorDrawing,doc),id:uid()}:undefined;this.strokeTarget={project:doc.id,layer:layer.id};this.pressureRequested=this.brush.pressure;this.initialPressurePending=this.brush.pressure&&e.pointerType==='pen'&&!(Number.isFinite(e.pressure)&&e.pressure>0);this.sampleTime=e.timeStamp;if(this.initialPressurePending)this.diagnostics.note('Initial pressure is unknown; defer the provisional dot until contact or release.');if(this.brush.velocityTaper&&e.pointerType!=='pen')p.v=1;
  this.pickup=undefined;this.stroke={id:this.capture.gestureId,kind:'stroke',tool:this.tool,points:[p],size:this.brush.size,opacity:this.brush.opacity,color:this.brush.color,pressure:this.brush.pressure&&e.pointerType==='pen',response:this.brush.response,...brushStrokeMetadata(this.brush),captureZoom:this.view.zoom,stabilization:this.brush.stabilization,smoothness:this.brush.smoothness??0,pressureWidth:this.brush.pressureWidth??true,pressureOpacity:this.brush.pressureOpacity??false,pressureCurve:this.brush.pressureCurve?.map(p=>({...p})),taperStart:this.brush.taperStart??0,taperEnd:this.brush.taperEnd??0,brushKind:this.brush.brushKind,textureStrength:this.brush.textureStrength,nativeMixVersion:this.tool==='brush'&&this.brush.nativeMixEnabled?3:undefined,nativeMixAmount:this.tool==='brush'&&this.brush.nativeMixEnabled?(this.brush.mixAmount??.58):undefined,nativeMixPaintLoad:this.tool==='brush'&&this.brush.nativeMixEnabled?Math.max(0,Math.min(1,this.brush.mixPaintLoad??0)):undefined,nativeMixRadius:this.tool==='brush'&&this.brush.nativeMixEnabled?Math.max(.02,Math.min(1,(this.brush.mixPickupLen??1)/2)):undefined,minSize:this.brush.minSize,maxSize:this.brush.maxSize,minOpacity:this.brush.minOpacity,maxOpacity:this.brush.maxOpacity,velocityTaper:this.brush.velocityTaper&&e.pointerType!=='pen'};if((this.stroke.dryBristleVersion===1||this.stroke.dryBristleVersion===2||this.stroke.dryBristleVersion===3)){this.stroke.dryBristleSeed=watercolorSeedFor(this.stroke.id);p.v=.65;}if(this.stroke.coloringEngine===1){this.stroke.colorSeed=watercolorSeedFor(this.stroke.id);p.v=.65;}if(this.stroke.watercolorMaterialVersion===2||this.stroke.watercolorEngine===1){this.stroke.watercolorSeed=watercolorSeedFor(this.stroke.id);p.v=.65;}if(this.tool==='brush'&&!this.stroke.nativeMixVersion&&this.stroke.brushTip!=='color-blender'&&(this.stroke.watercolorMode==='wet'||!this.stroke.watercolorMode&&this.brush.mixColors)&&layer.operations.length>0){this.stroke.mixStops=[];this.pickup=new Pickup(this.renderer.get(layer,doc),this.brush.mixAmount??.55);this.pickup.update(this.stroke);}this.geometryDirty=true;this.liveGeometry=undefined;this.liveTip=p;if(this.diagnostics.enabled&&this.diagnostics.perEventGeometry)this.refreshLiveGeometry();this.strokeDirty=true;this.request();
 };
 private updateDrag(p:Point,e:Pick<PointerEvent,'shiftKey'|'altKey'>){const g=this.drag;if(!g)return;const t=g.settings;if(g.kind==='perspective'){const next=(g.startQuad??this.selection).map(q=>({x:q.x,y:q.y}));if(g.corner!==undefined){const m=this.matrix(),det=m[0]*m[3]-m[1]*m[2],dx=p.x-g.x,dy=p.y-g.y;next[g.corner]={x:next[g.corner].x+(Math.abs(det)>1e-9?(m[3]*dx-m[2]*dy)/det:dx),y:next[g.corner].y+(Math.abs(det)>1e-9?(-m[1]*dx+m[0]*dy)/det:dy)};if(quadValid(next)){this.warpQuad=next;this.request();}}}else if(g.kind==='perspective-move'){const vp=this.vanishingPoint??{x:this.store.getSnapshot().width/2,y:this.store.getSnapshot().height*.35},vx=vp.x-g.center.x,vy=vp.y-g.center.y,d=Math.max(10,Math.hypot(vx,vy)),projection=((p.x-g.x)*vx+(p.y-g.y)*vy)/d,ratio=Math.max(.1,Math.min(8,(d-projection)/d));this.setTransform({dx:t.dx+projection*vx/d,dy:t.dy+projection*vy/d,scale:t.scale*ratio});}else if(g.kind==='move')this.setTransform({dx:t.dx+p.x-g.x,dy:t.dy+p.y-g.y});else if(g.kind==='rotate'){let angle=t.angle+angleDelta(Math.atan2(p.y-g.center.y,p.x-g.center.x),Math.atan2(g.y-g.center.y,g.x-g.center.x))*180/Math.PI;if(e.shiftKey)angle=Math.round(angle/15)*15;this.setTransform({angle});}else{const a=t.angle*Math.PI/180,anchor=e.altKey?g.center:(g.anchor??g.center),local=(q:{x:number;y:number})=>({x:(q.x-anchor.x)*Math.cos(a)+(q.y-anchor.y)*Math.sin(a),y:-(q.x-anchor.x)*Math.sin(a)+(q.y-anchor.y)*Math.cos(a)}),start=local(g),end=local(p),ratio=Math.hypot(end.x,end.y)/(Math.hypot(start.x,start.y)||1),edgeRatio=g.edge===undefined?ratio:Math.abs(g.edge%2===0?end.y/(start.y||1):end.x/(start.x||1)),rx=e.shiftKey?edgeRatio:Math.abs(end.x/(start.x||1)),ry=e.shiftKey?edgeRatio:Math.abs(end.y/(start.y||1));const sx=Math.max(.02,Math.min(50,(t.scaleX??1)*(g.edge===undefined||g.edge%2===1||e.shiftKey?rx:1))),sy=Math.max(.02,Math.min(50,(t.scaleY??1)*(g.edge===undefined||g.edge%2===0||e.shiftKey?ry:1))),offset=local(g.center),cx=offset.x*sx/(t.scaleX??1),cy=offset.y*sy/(t.scaleY??1),center={x:anchor.x+cx*Math.cos(a)-cy*Math.sin(a),y:anchor.y+cx*Math.sin(a)+cy*Math.cos(a)};this.setTransform({scaleX:sx,scaleY:sy,dx:t.dx+center.x-g.center.x,dy:t.dy+center.y-g.center.y});}}
 private move=(e:PointerEvent)=>{
  if(this.pointerId!==undefined&&(e.pointerId!==this.pointerId||e.timeStamp<(this.capture?.started??0)))return;this.cursor=this.point(e);const local=this.local(e);
  if(this.pointerId===undefined&&this.tool==='transform'&&this.selection.length&&this.cursor){
   const c=controls(this.selection,this.transform,this.view.zoom),index=c.corners.findIndex(q=>Math.hypot(q.x-this.cursor!.x,q.y-this.cursor!.y)<11/this.view.zoom);
   this.canvas.style.cursor=this.areaTransformMode==='rotate'?'grab':this.areaTransformMode==='scale'?(index<0?'crosshair':index%2===0?'nwse-resize':'nesw-resize'):'move';
  }
  if(this.pointerId===undefined&&this.tool==='stroke-select'&&this.strokeIds.length&&this.cursor){
   if(this.strokeMode==='freeform'){const c=controls(this.selection,this.transform,this.view.zoom),h=freeformHit(this.cursor,this.displayedCorners(),c.rotation,c.center,c.top,this.view.zoom,this.freeformCornerMode==='perspective'||e.ctrlKey||e.metaKey);this.canvas.style.cursor=h.kind==='rotation'?'grab':h.kind==='corner'?(this.freeformCornerMode==='perspective'||e.ctrlKey||e.metaKey?'crosshair':(h.index??0)%2===0?'nwse-resize':'nesw-resize'):h.kind==='edge'?((h.index??0)%2===0?'ns-resize':'ew-resize'):'move';}
   else if(this.strokeMode==='scale'||this.strokeMode==='perspective'){
    const corners=this.displayedCorners(),near=corners.findIndex(q=>Math.hypot(q.x-this.cursor!.x,q.y-this.cursor!.y)<11/this.view.zoom);
    this.canvas.style.cursor=near<0?'crosshair':this.strokeMode==='perspective'?'crosshair':near%2===0?'nwse-resize':'nesw-resize';
   }else this.canvas.style.cursor='';
  }

  if(this.mirrorPivotDrag){this.setMirrorPivot(this.point(e));return;}
  if(this.pan){this.setView({...this.view,x:this.pan.vx+local.x-this.pan.x,y:this.pan.vy+local.y-this.pan.y},true,true);return;}
  if(this.navigation){const n=this.navigation,dx=local.x-n.x,dy=local.y-n.y;if(Math.hypot(dx,dy)>2)n.moved=true;if(n.moved){if(this.tool==='zoom'){const zoom=Math.max(.25,Math.min(8,n.view.zoom*Math.exp(dx*.008))),anchor=toProject(n,n.view),next={...n.view,zoom},screen=toScreen(anchor,next);this.setView({...next,x:next.x+n.x-screen.x,y:next.y+n.y-screen.y},true,true);}else{const nearCenter=Math.hypot(n.x-this.width/2,n.y-this.height/2)<24,cx=nearCenter?n.x-80:this.width/2,cy=nearCenter?n.y:this.height/2,start=Math.atan2(n.y-cy,n.x-cx),angle=Math.atan2(local.y-cy,local.x-cx);let degrees=(n.view.rotation+angleDelta(angle,start))*180/Math.PI;if(e.shiftKey)degrees=Math.round(degrees/15)*15;this.rotate(degrees);}}return;}
  if(this.drag){this.updateDrag(this.point(e),e);this.canvas.style.cursor='none';this.paintCursor();return;}
  if(this.strokePending){const now=this.point(e),start=this.strokePending;if(Math.hypot(now.x-start.x,now.y-start.y)*this.view.zoom>3){if(this.strokeMode==='lasso'||this.strokeShape==='lasso'){if(!this.lasso)this.lasso=[{x:start.x,y:start.y,p:1}];appendPath(this.lasso,now);}else this.lasso=rectangle({x:start.x,y:start.y,p:1},now);this.request();}return;}
  if(this.vectors.drawing){this.acceptVectorMovement(e);return;}
  if(!this.drawing){this.paintCursor();return;}this.consume(e);
  this.request();
 };
 private consume(e:PointerEvent,canceled=false){this.performance.input();const started=this.performance.enabled?performance.now():0;try{this.consumeInput(e,canceled);}finally{if(this.performance.enabled)this.performance.record('inputBatchMs',performance.now()-started);}}
 private consumeInput(e:PointerEvent,canceled=false){const capture=this.capture;if(!capture)return;const batch=capture.batch(e,!canceled);if(capture.replaying){this.geometricDuplicates=0;this.sampleTime=capture.started;if(this.stroke){this.stroke.points=[{...this.stroke.points[0],p:capture.first.pointerType==='pen'?inputPressure(capture.first.pressure):1}];this.initialPressurePending=this.pressureRequested&&capture.first.pointerType==='pen'&&!(Number.isFinite(capture.first.pressure)&&capture.first.pressure>0);this.stroke.pressure=this.pressureRequested&&capture.first.pointerType==='pen';}if(this.lasso)this.lasso=[this.lasso[0]];}const rect=this.canvas.getBoundingClientRect();for(const event of batch){const p=this.point(event,rect);if(this.lasso){if(this.rectangleStart)this.lasso=rectangle(this.rectangleStart,p);else{const n=this.lasso.length;appendPath(this.lasso,p);if(n===this.lasso.length)this.geometricDuplicates++;}}if(this.stroke){if(this.initialPressurePending&&event.pointerType==='pen'&&Number.isFinite(event.pressure)&&event.pressure>0){for(const point of this.stroke.points)point.p=p.p;this.initialPressurePending=false;}const last=this.stroke.points.at(-1)!;if(event.pointerType==='pen'&&!event.pressure)p.p=last.p;if(((this.stroke.dryBristleVersion===1||this.stroke.dryBristleVersion===2||this.stroke.dryBristleVersion===3)||this.stroke.coloringEngine===1||this.stroke.watercolorMaterialVersion===2||this.stroke.watercolorEngine===1)&&!this.stroke.velocityTaper){p.v=watercolorVelocity(Math.hypot(p.x-last.x,p.y-last.y)*this.view.zoom,event.timeStamp-this.sampleTime,last.v??.65);}if(this.stroke.velocityTaper){const d=Math.hypot(p.x-last.x,p.y-last.y);p.v=d?velocityWidth(d,event.timeStamp-this.sampleTime,last.v):last.v??1;}this.sampleTime=Math.max(this.sampleTime,event.timeStamp);const n=this.stroke.points.length;appendPath(this.stroke.points,p);if(n===this.stroke.points.length)this.geometricDuplicates++;this.strokeDirty=true;}}if(this.stroke){this.pickup?.update(this.stroke,capture.replaying);this.geometryDirty=true;if(this.diagnostics.enabled&&this.diagnostics.perEventGeometry){this.refreshLiveGeometry();this.diagnostics.observeLive(this.liveTip);}} }
 private up=(e:PointerEvent)=>{
  if(e.pointerId!==this.pointerId||e.timeStamp<(this.capture?.started??0))return;if(this.mirrorPivotDrag){this.setMirrorPivot(this.point(e));this.mirrorPivotDrag=false;this.diagnostics.finish('mirror-pivot');this.recorder.event('mirror-pivot',{pivot:this.mirrorDrawing.pivot});this.releaseCapture();this.onMirrorChange();this.request();return;}if(e.pointerType==='pen'&&(e.buttons&1)!==0&&e.button!==0){if(this.vectors.drawing)this.acceptVectorMovement(e);else this.consume(e);this.request();this.recorder.event('barrel-release',{pointerId:e.pointerId,buttons:e.buttons,button:e.button});return;}if(this.vectors.drawing)this.acceptVectorMovement(e);else this.consume(e);if(this.drag)this.move(e);
  if(this.vectors.drawing){const end=this.point(e);// Keep the last REAL pen pressure; the provisional draft still contains only the down-point.
   if(e.pointerType==='pen')end.p=inputPressure(e.pressure,this.vectors.lastPressure);
   this.vectors.up(end);}
  if(this.navigation){if(this.tool==='zoom'&&!this.navigation.moved)this.zoomTo(this.view.zoom*(this.navigation.alt?.8:1.25));this.navigation=undefined;}
  const stroke=this.finalizeStroke(this.stroke),target=this.strokeTarget;this.recorder.event('gesture-end',{reason:'release',id:this.capture?.gestureId,pointerId:this.pointerId,sourcePoints:stroke?.points.length??this.lasso?.length??0,captured:this.capture?.count});this.diagnostics.finish('release',stroke,this.lasso,this.audit());this.stroke=undefined;this.strokeTarget=undefined;this.liveGeometry=undefined;this.liveTip=undefined;
  if(this.strokePending){const pending=this.strokePending;if(this.lasso&&this.lasso.length>=3){const found=this.marqueeStrokeIds(this.lasso);this.setStrokeIds(pending.shift?[...new Set([...this.strokeIds,...found])]:found);}else if(!pending.shift)this.clearSelection();this.lasso=undefined;this.strokePending=undefined;}else this.finishSelection();
  this.pan=undefined;this.drag=undefined;this.canvas.style.cursor='';this.paintCursor();this.releaseCapture();const committed=this.commitStroke(stroke,target);if(stroke)this.diagnostics.committed(stroke.id,committed);this.request();
 };
 private cancel=(e:PointerEvent)=>{if(e.pointerId===this.pointerId&&e.timeStamp>=(this.capture?.started??0)){this.consume(e,true);this.finishGesture('pointercancel');}};private lostCapture=(e:PointerEvent)=>{this.diagnostics.record(e,[],false);if(e.pointerId===this.pointerId&&e.timeStamp>=(this.capture?.started??0)&&!this.canvas.hasPointerCapture(e.pointerId)&&this.drawing)this.finishGesture('lostpointercapture');};private leave=()=>{if(!this.drawing){this.cursor=undefined;this.paintCursor();}};
 private wheel=(e:WheelEvent)=>{e.preventDefault();if(this.drawing||this.busy)return;const next=wheelZoom(this.view,this.local(e),e.deltaY,e.deltaMode,this.height);if(next===this.view)return;this.setView(next,true,true);};
 private async fill(p:Point){
  const doc=this.store.getSnapshot();if(p.x<0||p.y<0||p.x>=doc.width||p.y>=doc.height)return;this.busy=true;this.onBusy(true);const revision=this.store.revision;
  try{
   const settings={...this.fillSettings},reference=settings.reference==='line'?doc.layers.find(l=>l.id===settings.lineLayerId)??doc.layers.find(l=>l.name.toLowerCase()==='line'):activeLayer(doc);if(settings.reference==='line'&&!reference)throw Error('Choose a Line reference layer.');const source=settings.reference==='visible'?this.renderer.composite(doc,{transparent:true,includeReferences:false}):this.renderer.get(reference!,doc),data=context(source).getImageData(0,0,doc.width,doc.height).data,under=settings.reference==='current'&&data[(Math.floor(p.y)*doc.width+Math.floor(p.x))*4+3]===0,color=this.brush.color.match(/\w\w/g)!.map(x=>parseInt(x,16));color.push(Math.round(this.brush.opacity*255));
   const result=await new Promise<{output:Uint8ClampedArray;touchesEdge:boolean;count:number}>((resolve,reject)=>{this.worker=new Worker(new URL('./fill.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data);this.worker.onerror=()=>reject(Error('Fill worker failed.'));this.worker.postMessage({data,width:doc.width,height:doc.height,x:p.x,y:p.y,color,tolerance:this.brush.tolerance,gap:settings.gap,expansion:settings.expansion},[data.buffer]);});
   if(this.disposed)return;
   if(revision!==this.store.revision){this.notify('The document changed while filling. Please fill again.');return;}
   if(!result.count)return;
   if(result.touchesEdge&&!await this.confirmFill('This region reaches the canvas edge. The outline may be open. Fill it anyway?'))return;
   const c=makeCanvas(doc.width,doc.height);context(c).putImageData(new ImageData(new Uint8ClampedArray(result.output),doc.width,doc.height),0,0);const png=c.toDataURL();await this.renderer.prepare({...doc,layers:[{...activeLayer(doc),operations:[{id:uid(),kind:'fill',png}]}]});
   if(revision===this.store.revision)this.store.commit(appendOperation(doc,{id:uid(),kind:'fill',png,under}),'Fill region');else this.notify('The document changed. Fill was safely canceled.');
  }catch(e){this.notify('Fill failed: '+String(e));}finally{this.worker?.terminate();this.worker=undefined;this.busy=false;this.onBusy(false);}
 }
 async load(p:Project,expectedRevision?:number){if(expectedRevision!==undefined&&this.explicitLoad)return false;if(expectedRevision===undefined)this.explicitLoad=true;const generation=++this.loadGeneration,revision=expectedRevision??this.store.revision,renderer=new LayerRenderer();await renderer.prepare(p);
  // v0.5.176: build each layer's pixels in its own short task before showing the project,
  // so opening a big project no longer freezes the window in one long block. Same
  // renderer.get() the first frame would call, so the pixels are identical.
  for(const l of p.layers){if(!l.visible||!l.operations.length)continue;await new Promise<void>(r=>setTimeout(r,0));if(this.disposed||generation!==this.loadGeneration||this.store.revision!==revision||this.drawing)return false;renderer.get(l,p);}if(this.disposed||generation!==this.loadGeneration||this.store.revision!==revision||this.drawing)return false;this.cancelGesture();this.clearSelection();this.stopViewMotion();this.navigationHost.style.display='none';this.navigationScene.clear();this.navigationSnapshot.clear();this.hasRendered=false;this.blendWorker.cancel();this.drawingFrames.clear();this.inkDisplay.clear();this.rasterScene.clear();this.renderer.clear();this.renderer=renderer;const view=this.restoreView(p);this.onLoad(p);this.store.replace(p);if(view)this.setView(view);else this.fit();return true;}
 private cancelDrawingWarmup(){const task=this.drawingWarmup;if(!task)return;if(task.kind==='idle')window.cancelIdleCallback(task.id);else window.clearTimeout(task.id);this.drawingWarmup=undefined;}
 private warmDrawingInk(p:Project,W:number,H:number,dpr:number){
  if(this.drawingWarmup)return;
  const view={...this.view},revision=this.renderer.displayRevision,layer=p.layers.find(l=>l.id===p.activeLayerId),cleanInk=displayCleanInk({...this.brush,...brushStrokeMetadata(this.brush),kind:'stroke',id:'warm-only',tool:this.tool,points:[]} as Stroke);
  if(!cleanInk||!layer||layer.kind==='vector')return;
  const co=Math.cos(view.rotation)*view.zoom*dpr,si=Math.sin(view.rotation)*view.zoom*dpr,matrix=[co,si,-si,co,view.x*dpr,view.y*dpr];
  if(this.inkDisplay.baseReady(layer,p,matrix,W,H,this.renderer))return;
  const prepare=()=>{this.drawingWarmup=undefined;if(this.disposed||this.drawing||this.store.getSnapshot()!==p||this.renderer.displayRevision!==revision||Object.keys(view).some(k=>view[k as keyof View]!==this.view[k as keyof View]))return;
   const c=makeCanvas(W,H),out=c.getContext('2d')!;out.setTransform(...matrix as [number,number,number,number,number,number]);this.inkDisplay.primeBase(out,layer,p,this.renderer);c.width=c.height=0;
  };
  this.drawingWarmup=typeof window.requestIdleCallback==='function'?{kind:'idle',id:window.requestIdleCallback(prepare)}:{kind:'timer',id:window.setTimeout(prepare,0)};
 }
 request(){if(!this.frame&&!this.disposed)this.frame=requestAnimationFrame(()=>{this.frame=0;this.performance.measure('renderMs',()=>this.render());this.performance.visible();});}
 private render(){
  if(this.viewPending)this.publishView();this.hasRendered=true;
  this.vectors.prepareRender(); // Live ink is prepared incrementally by renderNewLayer.
  let livePainted=false;
  // Native Mix has a dedicated coalescing worker: never duplicate the expensive
  // pencil/dry/watercolor stroke rendering on the pointer/UI thread.
  if(this.stroke?.nativeMixVersion!==undefined&&!this.blendWorker.available())this.strokeDirty=true;
  if(this.stroke&&this.strokeDirty){this.refreshLiveGeometry();if(this.stroke.nativeMixVersion!==undefined&&this.blendWorker.available()&&!this.strokeMirror){
    this.strokeDirty=false;livePainted=false;
  }else if(this.displayInk(this.stroke)&&!(this.initialPressurePending&&this.stroke.points.length===1)){this.liveRaster.reset();if(this.diagnostics.enabled)this.diagnostics.observeLive(this.liveTip);}else{const sc=this.scratch.getContext('2d')!;if(!(this.initialPressurePending&&this.stroke.points.length===1)){const start=this.diagnostics.enabled?performance.now():0;this.performance.measure('liveRasterMs',()=>{const pixels=this.liveRaster.paint(sc,this.stroke!,this.liveGeometry!);this.performance.record('liveDirtyPixels',pixels);});if(this.diagnostics.enabled){this.diagnostics.timing('liveRenderMs',performance.now()-start);this.diagnostics.observeLive(this.liveTip);}}else{sc.clearRect(0,0,this.scratch.width,this.scratch.height);this.liveRaster.reset();}}this.strokeDirty=false;livePainted=true;}
  const compositeStarted=this.performance.enabled?performance.now():0;const ctx=this.canvas.getContext('2d')!,nativeDpr=window.devicePixelRatio||1,p=this.store.getSnapshot();
  // Only the background/rulers use a smaller buffer during navigation. Artwork
  // is on its own compositor surface; drawing and sharp finishing use native DPR.
  const selectionStable=!this.warpQuad&&(!this.selection.length||this.matrix().every((v,i)=>Math.abs(v-[1,0,0,1,0,0][i])<1e-9));
  const plainView=!this.stroke&&!this.smoothing.previewLayer&&!this.vectors.drawing&&selectionStable;
  const navigationPixels=this.viewMoving&&plainView,dpr=navigationPixels?Math.min(1,nativeDpr):nativeDpr;
  const W=Math.round(this.width*dpr),H=Math.round(this.height*dpr);if(this.canvas.width!==W)this.canvas.width=W;if(this.canvas.height!==H)this.canvas.height=H;ctx.setTransform(dpr,0,0,dpr,0,0);
  const navigationGroup=(this.viewMoving||this.viewRefining)&&plainView?this.navigationScene.present(this.navigationSurface,p,this.renderer,this.view):undefined;
  const snapshotPreview=!navigationGroup&&(this.viewMoving||this.viewRefining&&plainView)&&!this.stroke&&!this.vectors.drawing&&this.navigationSnapshot.present(p,this.view,this.width,this.height);
  const navigationActive=!!navigationGroup||snapshotPreview;
  this.navigationHost.style.display='block';this.navigationSurface.style.display=navigationGroup?'block':'none';if(!snapshotPreview)this.navigationSnapshot.hide();
  const paperCos=Math.cos(this.view.rotation)*this.view.zoom,paperSin=Math.sin(this.view.rotation)*this.view.zoom;
  Object.assign(this.navigationPaper.style,{display:'block',width:p.width+'px',height:p.height+'px',transform:`matrix(${paperCos},${paperSin},${-paperSin},${paperCos},${this.view.x},${this.view.y})`,boxShadow:this.viewMoving?'none':`0 0 ${25/this.view.zoom}px #0008`});
  // Rotated page-edge coverage changes during bitmap copies in Canvas 2D.
  // Retain the original rendering path there rather than changing its pixels.
  const cachedDrawing=!!this.stroke&&!!this.liveGeometry&&!this.initialPressurePending&&!this.mirrorDrawing.enabled&&!this.strokeMirror&&!this.viewMoving&&!this.viewRefining&&Math.abs(this.view.rotation)<1e-9&&!this.selection.length&&!this.strokeIds.length&&!this.smoothing.previewLayer&&!this.vectors.drawing&&!this.drag&&!this.pan&&!this.navigation;
  const workingBlend=!!this.stroke&&!this.strokeMirror&&workerBlendEligible(this.stroke)&&this.blendWorker.available()&&!!this.blendSource&&this.blendWorker.matches(this.stroke,this.blendSource);
  // No bitmap arrived yet: the unchanged preview should not trigger a
  // full-project redraw. First-frame startup still renders normally.
  const blendDirty=workingBlend?this.blendWorker.takeRegion(this.stroke!)??{x:0,y:0,width:0,height:0}:undefined;
  const changedFrame=cachedDrawing?this.drawingFrames.begin({project:p,renderer:this.renderer,revision:this.renderer.displayRevision,target:this.strokeTarget!.layer,width:W,height:H,dpr,view:this.view},this.stroke!,this.liveGeometry!,blendDirty??(livePainted?this.liveRaster.lastRegion:undefined)):undefined;
  // Canvas scan conversion can change by a few RGBA levels when the left
  // clip origin moves, including integer zoom on 4K surfaces. Keep its origin
  // fixed and limit the vertical band instead; preserve exact native pixels.
  // v0.5.175: commit/undo/redo band. When the only change since the last exact
  // frame is stroke operations added/removed on layers, redraw only the band
  // those strokes cover (same fixed-left-origin rule as live drawing).
  const overlayFree=!this.stroke&&!this.lasso&&!this.selection.length&&!this.strokeIds.length&&!this.smoothing.previewLayer&&!this.vectors.drawing&&!this.warpQuad&&!this.mirrorDrawing.enabled&&!this.busy&&!this.drag&&!this.pan&&!this.navigation&&!['vector','transform','stroke-select','lasso','select'].includes(this.tool);
  const frameState={p,W,H,dpr,x:this.view.x,y:this.view.y,zoom:this.view.zoom,rotation:this.view.rotation,revision:this.renderer.displayRevision,exact:false};
  const commitBand=!changedFrame&&overlayFree&&!navigationActive&&!this.viewMoving&&!this.viewRefining?commitBandRegion(this.lastExactFrame,frameState):undefined;
  this.performance.record('commitBandPixels',commitBand?commitBand.width*commitBand.height:-1);this.lastCommitBand=commitBand;
  const dirtyFrame=changedFrame?{...changedFrame,x:0,width:changedFrame.x+changedFrame.width}:commitBand;
  const warmDrawing=!this.stroke&&(this.tool==='brush'||this.tool==='eraser')&&!this.drawing&&!this.viewMoving&&!this.viewRefining&&Math.abs(this.view.rotation)<1e-9&&!this.selection.length&&!this.strokeIds.length&&!this.mirrorDrawing.enabled;
  if(warmDrawing)this.drawingFrames.warm({project:p,renderer:this.renderer,revision:this.renderer.displayRevision,target:p.activeLayerId,width:W,height:H,dpr,view:this.view});else if(!cachedDrawing)this.drawingFrames.invalidate();
  this.performance.record('displayDirtyPixels',dirtyFrame?dirtyFrame.width*dirtyFrame.height:W*H);this.performance.record('displayViewportPixels',W*H);
  ctx.save();if(dirtyFrame){ctx.resetTransform();ctx.beginPath();ctx.rect(dirtyFrame.x,dirtyFrame.y,dirtyFrame.width,dirtyFrame.height);ctx.clip();ctx.setTransform(dpr,0,0,dpr,0,0);}
  // Page decoration belongs to the browser compositor. The drawing canvas still
  // receives an opaque white page, so screen/multiply/add keep their exact math.
  ctx.save();ctx.resetTransform();if(dirtyFrame)ctx.clearRect(dirtyFrame.x,dirtyFrame.y,dirtyFrame.width,dirtyFrame.height);else ctx.clearRect(0,0,W,H);ctx.restore();
  if(!navigationActive){ctx.save();ctx.translate(this.view.x,this.view.y);ctx.rotate(this.view.rotation);ctx.scale(this.view.zoom,this.view.zoom);ctx.fillStyle='#fff';ctx.fillRect(0,0,p.width,p.height);ctx.restore();}
  const cachedBelow=cachedDrawing?this.drawingFrames.restore(ctx,dirtyFrame):undefined;
  // v0.5.162: exact main-thread snapshot of the bottom raster group (see EditingSceneSnapshot).
  const snapshotKey=!cachedBelow&&!navigationActive&&!this.viewMoving&&!this.viewRefining&&!this.selection.length&&!this.strokeIds.length&&!this.smoothing.previewLayer&&!this.vectors.drawing?this.editingSnapshot.group(p,this.renderer,W,H,dpr,this.view,this.stroke?this.strokeTarget?.layer:p.activeLayerId):undefined;
  const snapshotGroup=snapshotKey?this.editingSnapshot.restore(ctx,snapshotKey,dirtyFrame):undefined;
  let snapshotPending=!!snapshotKey&&!snapshotGroup&&!dirtyFrame;
  ctx.imageSmoothingEnabled=this.view.zoom*dpr<=1;ctx.imageSmoothingQuality=this.viewMoving?'low':'high';
  ctx.save();ctx.translate(this.view.x,this.view.y);ctx.rotate(this.view.rotation);ctx.scale(this.view.zoom,this.view.zoom);ctx.beginPath();ctx.rect(0,0,p.width,p.height);ctx.clip();
  // Build the selected-stroke lookup once per render instead of re-scanning every
  // selected ID against all operations on every layer (quadratic on dense projects).
  const selectedStrokeIds=new Set(this.strokeIds);
  if(this.viewRefining&&plainView){let ready=true;for(const layer of p.layers)if(layer.visible&&layer.operations.length&&!this.inkDisplay.primeView(ctx,layer,p,this.renderer))ready=false;if(ready){this.viewRefining=false;this.request();}}
  // The cached preview already has mip levels. Expensive high-quality software
  // resampling on every wheel tick stalls presentation even when JS is fast.
  // Restore full-quality sampling on the settled frame.
  ctx.imageSmoothingQuality=this.viewMoving||this.viewRefining?'low':'high';
  const rasterGroup=cachedBelow??navigationGroup??snapshotGroup??(snapshotPreview?new Set(p.layers.map(l=>l.id)):(!this.selection.length&&!this.strokeIds.length&&!this.smoothing.previewLayer&&!this.vectors.drawing?this.rasterScene.paint(ctx,p,this.renderer,this.stroke?this.strokeTarget?.layer:undefined):undefined));
  const snapshotTop=snapshotPending?snapshotKey!.layers[snapshotKey!.layers.length-1].id:undefined;let snapshotPassed=false;
  for(const l of [...p.layers].reverse()){if(snapshotPending&&snapshotPassed){this.editingSnapshot.capture(ctx,snapshotKey!);snapshotPending=false;}if(l.id===snapshotTop)snapshotPassed=true;if(!l.visible||rasterGroup?.has(l.id))continue;if(cachedDrawing&&l.id===this.strokeTarget!.layer)this.drawingFrames.capture(ctx);ctx.globalCompositeOperation=blendOperation(l.blend);let displayed=this.smoothing.previewLayer?.id===l.id?this.smoothing.previewLayer:this.vectors.layerPreview(l);if(l.kind==='vector'&&l.id===p.activeLayerId&&this.selection.length&&!this.strokeIds.length)displayed=this.vectors.transformedLayer(l,this.selection,this.matrix());// Empty layers contribute no pixels. Avoid repeatedly scaling full-size blank
   // bitmaps while a brush is active, especially below 100% zoom.
   if(!displayed.operations.length&&!(this.stroke&&l.id===this.strokeTarget?.layer)&&!(l.id===p.activeLayerId&&this.selection.length))continue;
   if(l.kind==='vector'){ctx.globalAlpha=l.opacity;if(!selectionStable&&displayed.operations.some(o=>selectedStrokeIds.has(o.id))){const ids=selectedStrokeIds,h=this.projectiveMatrix(),m=this.matrix();paintVectorLayer(ctx,{...displayed,opacity:1,operations:displayed.operations.map(o=>!ids.has(o.id)||o.kind!=='vector'?o:h?projectiveVector(o,h):transformVector(o,m))});}else if(displayed.operations.every(o=>o.kind==='vector')){
    // Draw actual vector paths at device resolution. For opacity/blend layers,
    // paintVectorLayer isolates the group at display resolution as well.
    ctx.globalAlpha=1;paintVectorLayer(ctx,displayed);
   }else{ctx.drawImage(this.renderer.getDisplay(displayed,p),0,0);}continue;}
   if((cachedDrawing||warmDrawing)&&this.drawingFrames.paintInk(ctx,l))continue;
   if(!(this.stroke&&l.id===this.strokeTarget?.layer&&this.initialPressurePending&&this.stroke.points.length===1)&&!this.mirrorDrawing.enabled&&(selectionStable||!displayed.operations.some(o=>selectedStrokeIds.has(o.id)))&&!(l.id===p.activeLayerId&&this.selection.length&&!selectionStable)&&this.inkDisplay.paint(ctx,displayed,p,this.stroke&&l.id===this.strokeTarget?.layer?this.stroke:undefined,this.stroke&&l.id===this.strokeTarget?.layer?this.liveGeometry:undefined,this.renderer)){if(cachedDrawing||warmDrawing)this.drawingFrames.rememberInk(l.id,this.inkDisplay.cachedSurface(l.id));continue;}
   let c=this.renderer.getDisplay(displayed,p);
   if(!selectionStable&&displayed.operations.some(o=>selectedStrokeIds.has(o.id))){ctx.globalAlpha=l.opacity;ctx.drawImage(this.exactStrokePreview(displayed,p),0,0);continue;}
   const workerPreview=this.stroke&&l.id===this.strokeTarget?.layer&&!this.strokeMirror&&workerBlendEligible(this.stroke)?this.blendWorker.preview(this.stroke,c,this.liveGeometry):undefined;
   if(workerPreview){this.blendSource=c;c=workerPreview;}else if(this.stroke?l.id===this.strokeTarget?.layer:l.id===p.activeLayerId&&this.selection.length&&!selectionStable){const preview=this.previewSurface;if(preview.width!==p.width){preview.width=p.width;this.previewStrokeId='';}if(preview.height!==p.height){preview.height=p.height;this.previewStrokeId='';}const pc=preview.getContext('2d')!,samePreview=this.stroke&&this.previewStrokeId===this.stroke.id&&this.previewBase===c&&this.previewBaseOperations===displayed.operations;
    const dirty=samePreview&&livePainted&&!this.strokeMirror?this.liveRaster.lastRegion:undefined;
    if(!samePreview||livePainted){
     pc.globalCompositeOperation='source-over';pc.globalAlpha=1;
     if(dirty){const {x,y,width,height}=dirty;
      if(width>0&&height>0){pc.clearRect(x,y,width,height);pc.drawImage(c,x,y,width,height,x,y,width,height);compositePaintStroke(pc,this.scratch,this.stroke!,0,0,dirty,c);}
     }else{
      pc.clearRect(0,0,p.width,p.height);pc.drawImage(c,0,0);
      if(this.stroke){compositePaintStroke(pc,this.scratch,this.stroke,0,0,undefined,c);if(this.strokeMirror){const reflected=this.mirrorSurface??=makeCanvas(p.width,p.height);if(reflected.width!==p.width)reflected.width=p.width;if(reflected.height!==p.height)reflected.height=p.height;const rc=reflected.getContext('2d')!;rc.clearRect(0,0,p.width,p.height);rc.save();rc.transform(...this.strokeMirror.matrix);rc.drawImage(this.scratch,0,0);rc.restore();compositePaintStroke(pc,reflected,reflectedStroke(this.stroke,this.strokeMirror.matrix,this.strokeMirror.id));}}
      else if(this.selection.length)applyTransform(preview,this.selection,this.matrix());
     }
    }
    if(this.stroke){this.previewStrokeId=this.stroke.id;this.previewBase=c;this.previewBaseOperations=displayed.operations;}
    else{this.previewStrokeId='';this.previewBase=undefined;this.previewBaseOperations=undefined;}
    c=preview;}
   ctx.globalAlpha=l.opacity;ctx.drawImage(c,0,0);
  }if(snapshotPending&&snapshotPassed){this.editingSnapshot.capture(ctx,snapshotKey!);snapshotPending=false;}
  // Animation can change cels again before a navigation preview is useful.
  // Build it when the animator actually pans or zooms instead.
  if(plainView&&!p.animation&&!this.viewMoving&&!this.viewRefining&&!this.busy)this.navigationScene.warm(p,this.renderer);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';this.vectors.renderNewLayer(ctx);if(this.tool==='vector')this.vectors.renderHandles(ctx,this.view.zoom);
  frameState.exact=overlayFree&&!navigationActive&&!this.viewMoving&&!this.viewRefining&&!this.initialPressurePending;this.lastExactFrame=this.stroke?strokeBand(this.lastExactFrame,frameState,dirtyFrame,this.stroke.points.length):frameState.exact?{...frameState,band:!!commitBand}:undefined;
  if(!snapshotPreview&&this.mirrorDrawing.enabled&&this.mirrorDrawing.showLine){
   ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.strokeStyle='#3fe0f0';ctx.lineWidth=1/this.view.zoom;ctx.setLineDash([6/this.view.zoom,5/this.view.zoom]);
   const pivot=mirrorPivot(this.mirrorDrawing,p),split=this.mirrorDrawing.axis==='vertical'?pivot.x:pivot.y;
   ctx.beginPath();if(this.mirrorDrawing.axis==='vertical'){ctx.moveTo(split,0);ctx.lineTo(split,p.height);}else{ctx.moveTo(0,split);ctx.lineTo(p.width,split);}ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(pivot.x,pivot.y,6/this.view.zoom,0,Math.PI*2);ctx.moveTo(pivot.x-10/this.view.zoom,pivot.y);ctx.lineTo(pivot.x+10/this.view.zoom,pivot.y);ctx.moveTo(pivot.x,pivot.y-10/this.view.zoom);ctx.lineTo(pivot.x,pivot.y+10/this.view.zoom);ctx.stroke();ctx.restore();
  }
  if(!snapshotPreview&&p.settings.guides){ctx.strokeStyle='#8cabb845';ctx.lineWidth=1/this.view.zoom;const inset=Math.min(p.width,p.height)*.035;ctx.strokeRect(inset,inset,p.width-inset*2,p.height-inset*2);ctx.setLineDash([8/this.view.zoom,8/this.view.zoom]);ctx.beginPath();ctx.moveTo(p.width/2,0);ctx.lineTo(p.width/2,18/this.view.zoom);ctx.moveTo(0,p.height/2);ctx.lineTo(18/this.view.zoom,p.height/2);ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();ctx.save();ctx.translate(this.view.x,this.view.y);ctx.rotate(this.view.rotation);ctx.scale(this.view.zoom,this.view.zoom);
  if(this.lasso||this.selection.length&&!this.strokeIds.length){ctx.save();if(!this.lasso)ctx.transform(...this.matrix());polygonPath(ctx,this.lasso??this.selection);ctx.lineWidth=1/this.view.zoom;ctx.strokeStyle='#55d9c4';ctx.setLineDash([5/this.view.zoom,4/this.view.zoom]);ctx.stroke();ctx.restore();}
  // Highlight the REAL selected line paths. Picking shows no rectangular box.
  if(!snapshotPreview&&this.tool==='stroke-select'&&this.strokeIds.length){
   const h=this.projectiveMatrix(),m=this.matrix(),ids=new Set(this.strokeIds);
   ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
   for(const l of p.layers){if(!l.visible||l.locked||l.reference)continue;
    for(const op of l.operations){if(!ids.has(op.id)||(op.kind!=='stroke'&&op.kind!=='vector'))continue;
     const points=polyline(op);if(!points.length)continue;
     ctx.beginPath();for(let i=0;i<points.length;i++){
      const pt=h?projectPoint(points[i],h):mapPoint(points[i],m);
      if(!Number.isFinite(pt.x)||!Number.isFinite(pt.y))continue;
      if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);
     }
     // Thin cyan line with a low-opacity glow; no blocky highlight region.
     ctx.strokeStyle='#55d9c477';ctx.lineWidth=3/this.view.zoom;ctx.stroke();
     ctx.strokeStyle='#8af6e8';ctx.lineWidth=1.05/this.view.zoom;ctx.stroke();
    }
   }
   ctx.restore();
  }
  if(this.selection.length&&(this.tool==='transform'||this.tool==='stroke-select'&&['scale','rotate','perspective','freeform'].includes(this.strokeMode))){
   const c=controls(this.selection,this.transform,this.view.zoom),corners=this.strokeIds.length?this.displayedCorners():c.corners,size=4.5/this.view.zoom;
   ctx.save();ctx.strokeStyle='#55d9c4aa';ctx.fillStyle='#e5faf6';ctx.lineWidth=.7/this.view.zoom;
   ctx.beginPath();corners.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.closePath();ctx.stroke();
   if(this.tool==='transform'&&['freeform','rotate'].includes(this.areaTransformMode)||this.tool==='stroke-select'&&['rotate','freeform'].includes(this.strokeMode)){
    ctx.beginPath();ctx.moveTo(c.top.x,c.top.y);ctx.lineTo(c.rotation.x,c.rotation.y);ctx.stroke();
    ctx.beginPath();ctx.arc(c.rotation.x,c.rotation.y,size*.85,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(this.tool==='stroke-select'&&(this.strokeMode==='rotate'||this.strokeMode==='freeform')){
     // An unobtrusive turntable guide and live degree indicator. Kept entirely
     // on the overlay, so no document geometry is written until Apply.
     const radius=rotationRadius(c.center,c.top,this.view.zoom,corners);
     ctx.save();ctx.lineWidth=.9/this.view.zoom;ctx.strokeStyle='#55d9c480';ctx.setLineDash([4/this.view.zoom,5/this.view.zoom]);ctx.beginPath();ctx.arc(c.center.x,c.center.y,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
     ctx.strokeStyle='#a2fff0';ctx.lineWidth=2/this.view.zoom;ctx.beginPath();ctx.arc(c.center.x,c.center.y,radius,-Math.PI/2,-Math.PI/2+this.transform.angle*Math.PI/180,this.transform.angle<0);ctx.stroke();
     // Curved-arrow glyph makes the separate rotation grab point recognizable.
     const r=7/this.view.zoom,rx=c.rotation.x,ry=c.rotation.y;ctx.strokeStyle='#a2fff0';ctx.lineWidth=1.3/this.view.zoom;ctx.beginPath();ctx.arc(rx,ry,r,Math.PI*.7,Math.PI*2.15);ctx.stroke();ctx.beginPath();ctx.moveTo(rx+r*Math.cos(Math.PI*2.15),ry+r*Math.sin(Math.PI*2.15));ctx.lineTo(rx+r*.92,ry-r*.56);ctx.lineTo(rx+r*.13,ry-r*.55);ctx.stroke();
     const label=`${Math.round(this.transform.angle*10)/10}°`;
     ctx.translate(c.rotation.x+12/this.view.zoom,c.rotation.y-3/this.view.zoom);ctx.rotate(-this.view.rotation);
     ctx.font=`${11/this.view.zoom}px monospace`;const textWidth=ctx.measureText(label).width;
     ctx.fillStyle='#142b2bdb';ctx.fillRect(-3/this.view.zoom,-12/this.view.zoom,textWidth+6/this.view.zoom,16/this.view.zoom);
     ctx.fillStyle='#b6fff0';ctx.fillText(label,0,0);ctx.restore();
    }
   }
   if(this.tool==='transform'&&['freeform','scale'].includes(this.areaTransformMode)||this.tool==='stroke-select'&&['scale','perspective','freeform'].includes(this.strokeMode))for(const pt of corners){ctx.fillRect(pt.x-size/2,pt.y-size/2,size,size);ctx.strokeRect(pt.x-size/2,pt.y-size/2,size,size);}
   if(this.tool==='stroke-select'&&this.strokeMode==='freeform'&&this.freeformCornerMode==='scale'){for(const pt of edgeHandles(corners)){ctx.fillRect(pt.x-size/2,pt.y-size/2,size,size);ctx.strokeRect(pt.x-size/2,pt.y-size/2,size,size);}}
   if(this.tool==='stroke-select'&&this.strokeMode==='freeform'){const r=4/this.view.zoom;ctx.strokeStyle='#55d9c4b0';ctx.beginPath();ctx.moveTo(c.center.x-r,c.center.y);ctx.lineTo(c.center.x+r,c.center.y);ctx.moveTo(c.center.x,c.center.y-r);ctx.lineTo(c.center.x,c.center.y+r);ctx.stroke();}
   ctx.restore();
  }
  if(this.tool==='stroke-select'&&this.strokeMode==='perspective-move'&&this.strokeIds.length){
   const c=controls(this.selection,this.transform,this.view.zoom),vp=this.vanishingPoint??{x:p.width/2,y:p.height*.35};
   ctx.save();ctx.strokeStyle='#55d9c488';ctx.lineWidth=.75/this.view.zoom;ctx.setLineDash([5/this.view.zoom,5/this.view.zoom]);ctx.beginPath();ctx.moveTo(c.center.x,c.center.y);ctx.lineTo(vp.x,vp.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
  if(this.tool==='stroke-select'&&this.vanishingPoint){ctx.save();const v=this.vanishingPoint,r=6/this.view.zoom;ctx.strokeStyle='#55d9c4';ctx.globalAlpha=.5;ctx.lineWidth=.8/this.view.zoom;ctx.beginPath();ctx.moveTo(v.x-r,v.y);ctx.lineTo(v.x+r,v.y);ctx.moveTo(v.x,v.y-r);ctx.lineTo(v.x,v.y+r);ctx.stroke();ctx.restore();}
  ctx.restore();
  // Rulers show actual document coordinates; rotated views explicitly identify the rotation.
  ctx.fillStyle='#1b252b';ctx.fillRect(0,0,this.width,18);ctx.fillRect(0,0,18,this.height);ctx.font='8px monospace';ctx.fillStyle='#7b919d';ctx.strokeStyle='#4b606c';ctx.lineWidth=1;
  if(Math.abs(this.view.rotation)<.0001){const step=[10,20,50,100,200,500,1000,2000,5000].find(n=>n*this.view.zoom>=55)??5000;
   const min=toProject({x:18,y:18},this.view),max=toProject({x:this.width,y:this.height},this.view);
   for(let x=Math.ceil(min.x/step)*step;x<max.x;x+=step){const s=toScreen({x,y:0},this.view);if(s.x<20)continue;ctx.fillText(String(x),s.x+3,10);ctx.beginPath();ctx.moveTo(s.x,13);ctx.lineTo(s.x,18);ctx.stroke();}
   for(let y=Math.ceil(min.y/step)*step;y<max.y;y+=step){const s=toScreen({x:0,y},this.view);if(s.y<20)continue;ctx.save();ctx.translate(10,s.y+3);ctx.rotate(-Math.PI/2);ctx.fillText(String(y),0,0);ctx.restore();ctx.beginPath();ctx.moveTo(13,s.y);ctx.lineTo(18,s.y);ctx.stroke();}
  }else ctx.fillText(`ROTATED VIEW · ${Math.round(this.view.rotation*180/Math.PI)}°`,27,11);
  // Brush outline lives on its own pointer-transparent canvas; pen hover no longer
  // redraws all document layers.  The active-stroke tip is updated here per RAF.
  ctx.restore();if(cachedDrawing)this.drawingFrames.finish(this.stroke!,this.liveGeometry!);
  this.paintCursor();if(warmDrawing)this.warmDrawingInk(p,W,H,dpr);
  if(this.performance.enabled)this.performance.record('compositionAndOverlaysMs',performance.now()-compositeStarted);
  if(this.historyPending){const ms=performance.now()-this.historyPending.at;this.performance.record('historyVisibleMs',ms);this.recorder.event('history-visible',{action:this.historyPending.action,ms});this.historyPending=undefined;}
 }

}
