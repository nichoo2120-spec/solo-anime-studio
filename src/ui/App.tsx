import {StrokeWidthEditor} from './StrokeWidthEditor';
import {createPortal} from 'react-dom';
import {MirrorControls} from './MirrorControls';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore,Fragment,type ReactNode} from 'react';
import {Plus,ChevronDown,ChevronRight,Folder,Layers,Copy,Trash2,Eye,EyeOff,Lock,Unlock,ArrowUp,ArrowDown,Undo2,Redo2,Maximize,RotateCcw,Settings,Download,Check,Keyboard,X,PanelLeftClose,PanelRightClose,GripVertical,Film,Play,Pause,Square,SkipBack,SkipForward,ChevronsLeft,ChevronsRight,SlidersHorizontal,Palette,Image as ImageIcon,Save,FilePlus,FolderOpen,Clock,MousePointer2,Maximize2,Minimize2,PanelLeftOpen,PanelRightOpen,Link2,MapPinned,Target} from 'lucide-react';
import {AutosaveWriter} from '../core/AutosaveWriter';
import {ViewPreferences,documentDirty} from '../core/viewPreferences';
import {openInfiniteWorkspace,shotFrame} from '../core/shotFrame';
import {CameraViewState} from '../core/CameraViewState';
import {DocumentStore,type DocumentHistory} from '../core/history';
import {ProjectTabs,CloseProjectDialog} from './ProjectTabs';
import {addDrawingFrame,duplicateDrawingFrame,deleteDrawingFrame,selectDrawingFrame,adjacentFrame,frameList,currentFrameIndex,MAX_DRAWING_FRAMES,frameHold,frameExposureStart,totalExposureFrames,currentExposureRange,setDrawingFrameHold,setDrawingFrameHoldById,holdFromDrag,MAX_FRAME_HOLD,hasIndependentLayers,isLayerHeld,layerKeyStart,layerKeyEnd,setLayerHoldEnd,insertLayerKey,enableIndependentLayers} from '../animation/timeline';
import {sanitizeOnionSettings,type OnionSettings} from '../animation/onionSkin';
import type {FlipDirection} from '../animation/flipbook';
import {PlaybackOverlay,type PlaybackUpdate} from '../engine/PlaybackOverlay';
import {playbackFps,PLAYBACK_FPS_MIN,PLAYBACK_FPS_MAX} from '../animation/playback';
import {activeLayer,duplicateLayer,editLayer,newLayer,newProject,removeLayer,reorderLayer,uid,validateProject,type Tool,type Project} from '../core/model';
import {downloadBlob,downloadProject,importProject,repository,type SavedRecord,type Snapshot} from '../core/persistence';
import {StudioEngine,defaultBrush,type BrushSettings,type TransformSettings} from '../engine/StudioEngine';
import type {View} from '../core/geometry';
import {ReferenceStudio} from './ReferenceStudio';
import {PngExport} from './PngExport';
import {SequenceExport} from './SequenceExport';
import {XsheetView} from './XsheetView';
import {SubstitutionShelf} from './SubstitutionShelf';
import {ReuseShelf} from './ReuseShelf';
import {AudioTrack} from './AudioTrack';
import {MotionPlanningPanel} from './MotionPlanningPanel';
import {MultiCelTransformPanel} from './MultiCelTransformPanel';
import {BatchCanvasTransform,type BatchCanvasMode} from './BatchCanvasTransform';
import {ProgressiveScaleCanvas,type DepthPreviewFrame} from './ProgressiveScaleCanvas';
import {FloatingTransformPanel} from './FloatingTransformPanel';
import {TransformOverlay,type TransformKeyHandler} from '../tools/transform/TransformOverlay';
import {progressiveScaleFrameFactors} from '../animation/progressiveScale';
import {polyline} from '../engine/strokeSelection';
import {toProject,toScreen} from '../core/geometry';
import {batchTransformCels,type BatchTransformValues} from '../animation/batchTransform';
import {MotionArcOverlay} from './MotionArcOverlay';
import {pickItems,type ItemSelection} from './multiSelection';
import {selectable,boundsOf} from '../engine/strokeSelection';
import {setCurrentTimingNote,createMotionArc,removeMotionArc,removeMotionArcPoint,activeLayerArtworkCenter,pruneMotionPlanning,bindArcStrokes,bindArcLayerRange,unbindArcFrame,alignBoundDrawingsToArc,editMotionPath,setMotionPathMode,createQuickMotionPath,addMotionControlDot,moveMotionControlDot,removeMotionControlDot} from '../animation/motionPlanning';
import {importSceneAudio,secondsAtExposure,exposureAtSeconds} from '../animation/audio';
import {exposurePlan,positionAtExposure} from '../animation/playback';
import {linkCurrentCelToFrame,unlinkCurrentCel,saveDrawingCycleRange,insertDrawingCycle,deleteDrawingCycle,cycleItems,linkedCount} from '../animation/reuse';
import {saveSubstitution,applySubstitution,renameSubstitution,deleteSubstitution,substitutionItems,type SubstitutionCategory} from '../animation/substitutions';
import {SceneCameraOverlay,SceneCameraPanel} from './SceneCameraPanel';
import {cameraAt,setCameraKey} from '../animation/sceneCamera';
import {renderSequenceZip,sequencePlan,type SequenceExportOptions,type SequenceProgress} from '../animation/sequenceExport';
import {sanitizeLightTablePins,toggleLightTablePin,MAX_LIGHT_TABLE_PINS,type LightTablePin} from '../animation/lightTable';
import type {ExportOptions} from '../engine/renderer';
import {ColorStudio} from './ColorStudio';
import {FillInspector} from './FillInspector';
import type {FillSettings} from '../engine/advancedFill';
import {RadialToolbar} from './RadialToolbar';
import {ShortcutEditor} from './ShortcutEditor';
import {DrawingDiagnostics} from './DrawingDiagnostics';
import {normalizeVectorMode} from '../engine/vectorMode';
import {DrawingBugRecorderPanel,BugRecordingIndicator} from './DrawingBugRecorder';
import {buildInfo} from '../core/buildInfo';
import {replayTrace} from '../engine/diagnosticReplay';
import {BrushStudio} from './BrushStudio';
import {ExactRange} from './ExactRange';
import {VectorStudio,type VectorDefaults} from './VectorStudio';
import {activePreset,activeInputPreset,brushSupportsMix,restoreBrushLibrary,updatePreset,type BrushLibrary} from '../core/brushes';
import {vectorSvg,type VectorLine} from '../engine/vector';
import {toolRegistry,allTools} from './icons';
import {StudioStrokeSelectIcon,StudioLassoIcon,StudioFreeformIcon,StudioMoveIcon,StudioScaleIcon,StudioRotateObjectIcon,StudioPerspectiveIcon,StudioPerspectiveMoveIcon} from './StudioToolIcons';
import {initialShortcuts,normalizeShortcuts,keyChord,type ShortcutCommand} from '../core/shortcuts';
import {quickAction,timelineDeleteKey,steppedBrushSize,quickShortcutGuide} from '../core/keyboardActions';
import {readPreference,writePreference} from './preferences';
import {ProjectHome} from './ProjectHome';
import {combineScenes} from '../core/combineScenes';

type DesktopCloseBridge={
 onSaveBeforeClose?:(callback:()=>void)=>()=>void;
 closeAfterSave?:()=>void;
};
type Layout={left:number;right:number;bottom:number;leftClosed:boolean;rightClosed:boolean;bottomClosed:boolean};
type ProjectSession={history:DocumentHistory;saved?:Project;savedAt:string};
function IconButton({label,tooltip=label,onClick,disabled=false,children,active}:{label:string;tooltip?:string;onClick:()=>void;disabled?:boolean;children:ReactNode;active?:boolean}){return <button className={'icon-button '+(active?'selected':'')} title={tooltip} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;}
function Range({label,onChange,...rest}:{label:string;value:number;min?:number;max?:number;step?:number;unit?:string;onChange:(n:number)=>void}){return <ExactRange name={label} set={onChange} {...rest}/>;}
function Section({title,icon,children,open=true}:{title:string;icon?:ReactNode;children:ReactNode;open?:boolean}){return <details className="inspector-section" open={open}><summary>{icon}<span>{title}</span><ChevronDown size={13}/></summary><div className="section-content">{children}</div></details>;}
type CameraControlProps={camera:CameraViewState;engine:StudioEngine|null};
function CameraZoom({camera,engine,outside=false}:CameraControlProps&{outside?:boolean}){
 const view=useSyncExternalStore(camera.subscribe,camera.getSnapshot),percent=Math.round(view.zoom*100);
 const sizes=[...(outside?[3,5,10]:[]),25,50,75,100,150,200,400,800];
 return <select aria-label="Canvas zoom" value={String(percent)} onChange={e=>engine?.zoomTo(+e.target.value/100)}>{!sizes.includes(percent)&&<option value={percent}>{percent}%</option>}{sizes.map(n=><option value={n} key={n}>{n}%</option>)}</select>;
}
function CameraAngle({camera,engine}:CameraControlProps){const view=useSyncExternalStore(camera.subscribe,camera.getSnapshot);return <label className="rotation-control"><input aria-label="Canvas rotation" type="number" min="-180" max="180" value={Math.round(view.rotation*180/Math.PI)} onChange={e=>engine?.rotate(Math.max(-180,Math.min(180,+e.target.value)))}/>°</label>;}
function CameraPercent({camera}:{camera:CameraViewState}){const view=useSyncExternalStore(camera.subscribe,camera.getSnapshot);return <>{Math.round(view.zoom*100)}%</>;}
export function App(){
 const [views]=useState(()=>new ViewPreferences());
 const [engineReady,setEngineReady]=useState<StudioEngine|null>(null);
 const [workspaceMode,setWorkspaceMode]=useState<'DRAW'|'ANIMATE'>('DRAW');
 const [focusMode,setFocusMode]=useState(false);
 const [frameOnly,setFrameOnly]=useState(()=>readPreference<boolean>('frame-only',false)===true);
 useEffect(()=>writePreference('frame-only',frameOnly),[frameOnly]);
 const [timelineView,setTimelineView]=useState<'timeline'|'xsheet'>(()=>readPreference<'timeline'|'xsheet'>('timeline-view','timeline')==='xsheet'?'xsheet':'timeline');
 const [xsheetSide,setXsheetSide]=useState<'left'|'right'>(()=>readPreference<'left'|'right'>('xsheet-side','right')==='left'?'left':'right');
 const [xsheetWidth,setXsheetWidth]=useState(()=>Math.max(220,Math.min(490,readPreference<number>('xsheet-width',310))));
 const xsheetDock=useRef<HTMLDivElement|null>(null);
 const workbench=useRef<HTMLDivElement|null>(null);
 const [onionSettings,setOnionSettings]=useState<OnionSettings>(()=>sanitizeOnionSettings(readPreference('onion-settings',null)));
 const [onionSettingsOpen,setOnionSettingsOpen]=useState(false);
 const [lightTableOpen,setLightTableOpen]=useState(false);
 const [lightTablePins,setLightTablePins]=useState<LightTablePin[]>([]);
 const [sequenceBusy,setSequenceBusy]=useState(false),[sequenceProgress,setSequenceProgress]=useState<SequenceProgress|null>(null);
 const sequenceAbort=useRef<AbortController|null>(null);
 const [motionToolsOpen,setMotionToolsOpen]=useState(false),[motionArcEditing,setMotionArcEditing]=useState(false),[activeMotionArcId,setActiveMotionArcId]=useState('');
 const [addingMotionDot,setAddingMotionDot]=useState(false),[selectedMotionDotId,setSelectedMotionDotId]=useState('');
 const motionPointEditDelegate=useRef<(arcId:string,frameId:string,x:number,y:number)=>void>(()=>{});
 const motionPointEditCallback=useRef((arcId:string,frameId:string,x:number,y:number)=>motionPointEditDelegate.current(arcId,frameId,x,y));
 const motionDotAddDelegate=useRef<(arcId:string,x:number,y:number)=>void>(()=>{});
 const motionDotMoveDelegate=useRef<(arcId:string,dotId:string,dx:number,dy:number,frameId:string)=>void>(()=>{});
 const motionDotAddCallback=useRef((arcId:string,x:number,y:number)=>motionDotAddDelegate.current(arcId,x,y));
 const motionDotMoveCallback=useRef((arcId:string,dotId:string,dx:number,dy:number,frameId:string)=>motionDotMoveDelegate.current(arcId,dotId,dx,dy,frameId));
 const [showPathDuringPlayback,setShowPathDuringPlayback]=useState(()=>readPreference<boolean>('motion-path-playback-show',false)===true);
 const [editPathWhilePlaying,setEditPathWhilePlaying]=useState(()=>readPreference<boolean>('motion-path-live-edit',false)===true);
 const [selectedFrames,setSelectedFrames]=useState<ItemSelection>({ids:[],anchor:null});
 const [batchCanvasMode,setBatchCanvasMode]=useState<BatchCanvasMode|'depth'|null>(null);
 const [selectedLayers,setSelectedLayers]=useState<ItemSelection>({ids:[],anchor:null});
 const [audioTrackOpen,setAudioTrackOpen]=useState(false),[audioMuted,setAudioMuted]=useState(()=>readPreference('audio-muted',false)),[audioBusy,setAudioBusy]=useState(false);
 const [timelinePins,setTimelinePins]=useState(()=>readPreference<string[]>('timeline-toolbar-pins',[]));
 const timelineMenu=useRef<HTMLDetailsElement>(null);
 function pinTimelineTool(id:string,pinned:boolean){
  setTimelinePins(current=>pinned?[...current,id]:current.filter(item=>item!==id));
 }
 useEffect(()=>writePreference('timeline-toolbar-pins',timelinePins),[timelinePins]);
 const audioElement=useRef<HTMLAudioElement|null>(null);
 // Stable callbacks stop the 512-bar audio waveform controls from re-rendering
 // on every pen commit. Delegates are refreshed each App render so actions
 // still read the newest project/selection when actually clicked.
 const audioActionDelegates=useRef<{
  toggle:()=>void;importClip:(file:File)=>void;remove:()=>void;mute:(value:boolean)=>void;seek:(seconds:number)=>void;
 }>({toggle:()=>{},importClip:()=>{},remove:()=>{},mute:()=>{},seek:()=>{}});
 const audioActionCallbacks=useRef({
  toggle:()=>audioActionDelegates.current.toggle(),
  importClip:(file:File)=>audioActionDelegates.current.importClip(file),
  remove:()=>audioActionDelegates.current.remove(),
  mute:(value:boolean)=>audioActionDelegates.current.mute(value),
  seek:(seconds:number)=>audioActionDelegates.current.seek(seconds)
 });
 const wheelDelegates=useRef({action:(_action:'previous-cel'|'next-cel'|'onion-skin')=>{},mix:()=>{}});
 const wheelCallbacks=useRef({
  action:(action:'previous-cel'|'next-cel'|'onion-skin')=>wheelDelegates.current.action(action),
  mix:()=>wheelDelegates.current.mix()
 });
 // Stable props let large drawing inspector and Tool Wheel skip unrelated
 // document commits. The delegates are refreshed before each render so button
 // actions always use the latest application state.
 const panelDelegates=useRef<{
  brushChange:(next:BrushLibrary|((old:BrushLibrary)=>BrushLibrary))=>void;
  choose:(value:Tool)=>void;notice:(value:string)=>void;
 }>({brushChange:()=>{},choose:()=>{},notice:()=>{}});
 const stablePanelHandlers=useRef({
  brushChange:(next:BrushLibrary|((old:BrushLibrary)=>BrushLibrary))=>panelDelegates.current.brushChange(next),
  choose:(value:Tool)=>panelDelegates.current.choose(value),
  notice:(value:string)=>panelDelegates.current.notice(value)
 });
 const [flipPreview,setFlipPreview]=useState<FlipDirection|null>(null);
 const [holdPreview,setHoldPreview]=useState<{id:string;hold:number}|null>(null);
 const holdDrag=useRef<{id:string;pointerId:number;startX:number;startY:number;startHold:number;nextHold:number;edgeGrab:boolean;dragging:boolean;el:HTMLElement}|null>(null);
 const suppressCelSelect=useRef<string|null>(null);
 const [layerHoldPreview,setLayerHoldPreview]=useState<{layerId:string;start:number;end:number}|null>(null);
 const layerHoldDrag=useRef<{layerId:string;pointerId:number;startIndex:number;startX:number;currentEnd:number;startEnd:number;dragging:boolean;el:HTMLElement;cellRightEdges:number[]}|null>(null);
 const suppressLayerClick=useRef(false);
 const [playbackUpdate,setPlaybackUpdate]=useState<PlaybackUpdate>({state:'stopped',exposure:1,celIndex:0});
 const [fps,setFps]=useState(()=>playbackFps(readPreference<number>('playback-fps',24)));
 const [loop,setLoop]=useState(()=>readPreference<boolean>('playback-loop',true)!==false);
 const playback=useRef<PlaybackOverlay|null>(null);
 const timelineTrack=useRef<HTMLDivElement|null>(null);
 const [autosaveWriter]=useState(()=>new AutosaveWriter()),[store]=useState(()=>new DocumentStore(newProject())),doc=useSyncExternalStore(store.subscribe,store.getSnapshot);
 const sessions=useRef(new Map<string,ProjectSession>());
 const [tabIds,setTabIds]=useState<string[]>(()=>{
  if((window as Window&{soloDesktop?:DesktopCloseBridge}).soloDesktop)return [];
  const p=store.getSnapshot();sessions.current.set(p.id,{history:store.captureHistory(),saved:p,savedAt:''});return [p.id];
 });
 const activeTabId=useRef<string|null>(tabIds[0]??null);
 const [closeRequest,setCloseRequest]=useState<string|null>(null),[closingTab,setClosingTab]=useState(false);
 const [closeError,setCloseError]=useState('');
 const closeRequestRef=useRef<string|null>(null);
 closeRequestRef.current=closeRequest;
 const tabTransition=useRef(false);
 const noteFrameIds=useMemo(()=>new Set(doc.motionPlanning?.notes.map(n=>n.frameId)??[]),[doc.motionPlanning?.notes]);
 const canvas=useRef<HTMLCanvasElement>(null),workspace=useRef<HTMLDivElement>(null),engine=useRef<StudioEngine|null>(null),fileInput=useRef<HTMLInputElement>(null);
 const imageInput=useRef<HTMLInputElement>(null);
 function importSceneImage(file:File){if(!busy&&!operationLock.current&&modal!=='recover')void engine.current?.references.import(file,false);}
 const [,setMirrorRevision]=useState(0);
 const [tool,setTool]=useState<Tool>('brush'),[brushLibrary,publishBrushLibrary]=useState<BrushLibrary>(()=>restoreBrushLibrary(readPreference('brush-library',null))),[,setView]=useState<View>({x:0,y:0,zoom:1,rotation:0});
 const [camera]=useState(()=>new CameraViewState()),view=camera.getSnapshot(),cameraOverlayNeeded=useRef(false);
 const brush=activePreset(brushLibrary,tool==='eraser').settings,drawingColor=activePreset(brushLibrary).settings.color;
 const toolIntent=useRef(tool),libraryIntent=useRef(brushLibrary);
 function syncInput(t:Tool,library:BrushLibrary){const p=activeInputPreset(library,t==='eraser');engine.current?.setInput(t,p.settings,{id:p.id,name:p.name});}
 const setBrushLibrary=(next:BrushLibrary|((old:BrushLibrary)=>BrushLibrary))=>{const value=typeof next==='function'?next(libraryIntent.current):next;libraryIntent.current=value;syncInput(toolIntent.current,value);publishBrushLibrary(value);};
 const setBrush=(next:Partial<BrushSettings>)=>setBrushLibrary(old=>{const p=activePreset(old,toolIntent.current==='eraser');return updatePreset(old,p.id,{...p.settings,...next});});
 const setDrawingColor=(color:string)=>setBrushLibrary(old=>{const p=activePreset(old);return updatePreset(old,p.id,{...p.settings,color});});
 const [vectorId,setVectorId]=useState<string|null>(null),[smoothingActive,setSmoothingActive]=useState(false),[postAmount,setPostAmount]=useState(50);
 const [vectorDefaults,setVectorDefaults]=useState<VectorDefaults>(()=>{const fallback:VectorDefaults={width:5,opacity:1,pressure:true,mode:'freehand',smoothness:65,stabilization:12,minWidthPercent:20,maxWidthPercent:100,taperStart:0,taperEnd:0},saved=readPreference('vector-settings-solid-ink',fallback);const clamp=(v:unknown,d:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(100,v)):d;return {...fallback,...saved,width:typeof saved.width==='number'&&Number.isFinite(saved.width)?Math.max(.5,Math.min(150,saved.width)):fallback.width,minWidthPercent:typeof saved.minWidthPercent==='number'?Math.max(1,Math.min(100,saved.minWidthPercent)):fallback.minWidthPercent,maxWidthPercent:typeof saved.maxWidthPercent==='number'?Math.max(10,Math.min(200,saved.maxWidthPercent)):fallback.maxWidthPercent,taperStart:typeof saved.taperStart==='number'?Math.max(0,Math.min(1,saved.taperStart)):fallback.taperStart,taperEnd:typeof saved.taperEnd==='number'?Math.max(0,Math.min(1,saved.taperEnd)):fallback.taperEnd,smoothness:clamp(saved.smoothness,fallback.smoothness),stabilization:clamp(saved.stabilization,fallback.stabilization),mode:normalizeVectorMode(saved.mode)};});
 const transformHotkeyRef=useRef<TransformKeyHandler|null>(null);
 const [advancedStrokeTransform,setAdvancedStrokeTransform]=useState(false);
 const [areaTransformMode,setAreaTransformMode]=useState<'freeform'|'move'|'scale'|'rotate'>('freeform');
 const [strokeCount,setStrokeCount]=useState(0),[strokeMode,setStrokeMode]=useState<'select'|'lasso'|'move'|'scale'|'rotate'|'perspective-move'|'perspective'|'freeform'>('select'),[freeformCornerMode,setFreeformCornerMode]=useState<'scale'|'perspective'>('scale'),[strokePickMode,setStrokePickMode]=useState<'touch'|'enclose'>('touch'),[strokeShape,setStrokeShape]=useState<'rectangle'|'lasso'>('lasso'),[strokeScope,setStrokeScope]=useState<'current'|'visible'>('current');
 const [hasSelection,setHasSelection]=useState(false),[busy,setBusy]=useState(false),[transform,setTransform]=useState<TransformSettings>({dx:0,dy:0,scale:1,angle:0});
 const [layout,setLayout]=useState<Layout>(()=>{const p=readPreference<Layout>('layout',{left:232,right:280,bottom:160,leftClosed:false,rightClosed:false,bottomClosed:false});const migrated=readPreference<boolean>('workspace-compact-initialized',false);return {...p,left:Math.max(180,Math.min(300,Number(p.left)||232)),right:Math.max(240,Math.min(340,Number(p.right)||280)),bottom:migrated?Math.max(110,Math.min(500,Number(p.bottom)||160)):160};});
 const [shortcuts,setShortcuts]=useState(()=>normalizeShortcuts(readPreference('shortcuts',initialShortcuts)));
 const [fillSettings,setFillSettings]=useState<FillSettings>(()=>{const s=readPreference<FillSettings>('fill-settings',{reference:'current',lineLayerId:'',gap:0,expansion:0});return {reference:['current','visible','line'].includes(s.reference)?s.reference:'current',lineLayerId:typeof s.lineLayerId==='string'?s.lineLayerId:'',gap:Math.max(0,Math.min(10,s.gap||0)),expansion:Math.max(0,Math.min(5,s.expansion||0))};});
 const [fillQuestion,setFillQuestion]=useState<{message:string;resolve:(answer:boolean)=>void}|null>(null);
 const [message,setMessage]=useState(''),[menu,setMenu]=useState(''),[modal,setModal]=useState(''),[name,setName]=useState(''),[resolution,setResolution]=useState('1920x1080');
 const [menuAnchor,setMenuAnchor]=useState({left:8,top:40});
 const menuButton=useRef<HTMLButtonElement|null>(null),menuPopup=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{if(!menu)return;menuPopup.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();const close=()=>setMenu('');window.addEventListener('resize',close);return()=>window.removeEventListener('resize',close);},[menu]);
 const [records,setRecords]=useState<SavedRecord[]>([]),[snapshots,setSnapshots]=useState<Snapshot[]>([]),[status,setStatus]=useState('New project'),[lastSaved,setLastSaved]=useState('');
 const [deleteSelection,setDeleteSelection]=useState<string[]>([]),[deletingProjects,setDeletingProjects]=useState(false);
 const [linkTargetFrameId,setLinkTargetFrameId]=useState(''),[rightTab,setRightTab]=useState('inspector'),[renameId,setRenameId]=useState(''),[renameValue,setRenameValue]=useState('');
 const saved=useRef<Project|undefined>(doc),saveChain=useRef<Promise<unknown>>(Promise.resolve()),pendingSaves=useRef(0),mounted=useRef(true),initialCheck=useRef(false),operationLock=useRef(false);
 useEffect(()=>()=>autosaveWriter.dispose(),[autosaveWriter]);
 const autosaveRetry=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(autosaveRetry.current)clearTimeout(autosaveRetry.current);autosaveRetry.current=null;},[]);
 const notify=(text:string)=>setMessage(text);
 const toggleMixMode=(explicit?:'paint'|'mix')=>{if(operationLock.current||engine.current?.drawing)return;setBrushLibrary(old=>{const preset=activePreset(old,false);if(!brushSupportsMix(preset)){notify('Mix mode is only available for drawing brushes.');return old;}const mode=explicit??(old.mode==='mix'?'paint':'mix');return {...old,mode};});};
 const chooseTool=(t:Tool)=>{if(operationLock.current)return;if(t==='transform'){setRightTab('inspector');setLayout(old=>({...old,rightClosed:false}));}setAdvancedStrokeTransform(false);setAddingMotionDot(false);toolIntent.current=t;syncInput(t,libraryIntent.current);setTool(t);if(t==='stroke-select')engine.current?.setStrokeMode('select');};
 useEffect(()=>{mounted.current=true;const e=new StudioEngine(canvas.current!,store,notify);engine.current=e;setEngineReady(e);syncInput(toolIntent.current,libraryIntent.current);e.confirmFill=message=>new Promise(resolve=>setFillQuestion({message,resolve}));e.onMirrorChange=()=>{writePreference('mirror-drawing',e.mirrorDrawing);setMirrorRevision(v=>v+1);};const mirrorSaved=readPreference<any>('mirror-drawing',null);if(mirrorSaved&&typeof mirrorSaved==='object'){if(['vertical','horizontal'].includes(mirrorSaved.axis))e.mirrorDrawing.axis=mirrorSaved.axis;for(const key of ['enabled','showLine','lockCenter'] as const)if(typeof mirrorSaved[key]==='boolean')e.mirrorDrawing[key]=mirrorSaved[key];if(Number.isFinite(mirrorSaved.pivot?.x)&&Number.isFinite(mirrorSaved.pivot?.y))e.mirrorDrawing.pivot={x:Math.max(0,Math.min(1,mirrorSaved.pivot.x)),y:Math.max(0,Math.min(1,mirrorSaved.pivot.y))};}e.onLoad=p=>{saved.current=p;};e.restoreView=p=>views.read(p);e.onView=v=>{camera.publish(v);if(cameraOverlayNeeded.current)setView(v);playback.current?.setView(v);views.remember(store.getSnapshot(),v);};e.onTransform=setTransform;e.onStrokeSelection=setStrokeCount;e.onStrokeMode=setStrokeMode;e.onColor=setDrawingColor;e.vectors.onSelect=setVectorId;e.smoothing.onChange=setSmoothingActive;e.onSelection=has=>{setHasSelection(has);if(!has)setTransform({dx:0,dy:0,scale:1,angle:0});};e.onBusy=b=>{operationLock.current=b;setBusy(b);};e.fit();const diagnostics={recorder:{start:()=>e.recorder.start(),pause:()=>e.recorder.pause(),resume:()=>e.recorder.resume(),stop:()=>e.recorder.stop(),status:()=>e.recorder.getSnapshot(),export:()=>e.recorder.export()},build:buildInfo,status:()=>e.diagnosticSnapshot(),replay:replayTrace,performance:{start:()=>e.performance.start(),stop:()=>e.performance.stop(),export:()=>e.performance.export()},start:()=>e.diagnostics.start(),stop:()=>e.diagnostics.stop(),clear:()=>e.diagnostics.clear(),export:()=>e.diagnostics.export(),download:()=>downloadBlob(new Blob([JSON.stringify(e.diagnostics.export(),null,2)],{type:'application/json'}),'solo-stroke-traces.json')};(window as unknown as {soloStrokeDiagnostics?:typeof diagnostics}).soloStrokeDiagnostics=diagnostics;return()=>{mounted.current=false;e.dispose();engine.current=null;delete (window as unknown as {soloStrokeDiagnostics?:unknown}).soloStrokeDiagnostics;};},[store]);

 useEffect(()=>{const flush=()=>views.flush();window.addEventListener('pagehide',flush);window.addEventListener('beforeunload',flush);return()=>{flush();window.removeEventListener('pagehide',flush);window.removeEventListener('beforeunload',flush);};},[views]);
 useEffect(()=>{const outside=(event:PointerEvent)=>{const target=event.target as Element;if(!target.closest?.('.studio,.main-menu-layer')||target.getAttribute('aria-label')==='Drawing canvas')return;engine.current?.controlContact(event);engine.current?.recorder.event('studio-control-contact',{pointerId:event.pointerId,pointerType:event.pointerType,button:event.button,control:target.closest('button')?.getAttribute('aria-label')??target.getAttribute('aria-label')??target.tagName});};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[]);
 useEffect(()=>{setFlipPreview(null);},[doc.id,doc.animation?.activeFrameId]);
 useEffect(()=>{setLightTablePins(sanitizeLightTablePins(store.getSnapshot(),readPreference('light-table:'+doc.id,[])));},[doc.id,store]);
 // The active frame's stroke operations change on pen commits, but the list of
 // frame IDs does not. Only prune obsolete pins when the timeline itself changes.
 const lightTableFrameIds=doc.animation?.frames.map(frame=>frame.id).join('|')??'legacy-first-frame';
 const motionFrameIds=useMemo(()=>frameList(doc).map(f=>f.id),[lightTableFrameIds]);
 // v0.5.174 scene camera playhead: any exposure, including the middle of a hold.
 const cameraPlan=useMemo(()=>sequencePlan(doc),[doc.animation]);
 const activeCameraFrameId=doc.animation?.activeFrameId??'';
 const [cameraExposureState,setCameraExposure]=useState(1);
 const cameraRange=cameraPlan.filter(i=>i.frameId===activeCameraFrameId);
 const cameraExposure=!doc.animation?1:cameraRange.some(i=>i.number===cameraExposureState)?cameraExposureState:(cameraRange[0]?.number??1);
 const frameSelectionSet=useMemo(()=>new Set(selectedFrames.ids.filter(id=>motionFrameIds.includes(id))),[selectedFrames.ids,motionFrameIds]);
 const layerIdsKey=doc.layers.map(item=>item.id).join('|');
 const layerIds=useMemo(()=>layerIdsKey.split('|'),[layerIdsKey]);
 const layerSelectionSet=useMemo(()=>new Set(selectedLayers.ids.filter(id=>layerIds.includes(id))),[selectedLayers.ids,layerIds]);
 // Never inspect all drawing cels during normal pen work. Only calculate a
 // transform box after a multi-frame selection activates a canvas tool.
 const multiCelAvailable=workspaceMode==='ANIMATE'&&frameSelectionSet.size>=2;
 const batchCanvasBounds=useMemo(()=>{
  if(!batchCanvasMode||batchCanvasMode==='depth'||!multiCelAvailable)return null;
  const frameIds=selectedFrames.ids.filter(id=>motionFrameIds.includes(id));
  const chosenLayerIds=selectedLayers.ids.length?selectedLayers.ids:[doc.activeLayerId];
  for(const frameId of [doc.animation?.activeFrameId,...frameIds]){
   const frame=doc.animation?.frames.find(f=>f.id===frameId);if(!frame)continue;
   const ops=chosenLayerIds.flatMap(id=>frame.drawings[id]??[]);
   const extent=boundsOf(ops.filter(op=>op.kind==='stroke'||op.kind==='vector'));
   if(extent)return {x:extent.x,y:extent.y,w:Math.max(extent.w,2),h:Math.max(extent.h,2)};
  }
  return null;
 },[batchCanvasMode,multiCelAvailable,doc.animation,doc.activeLayerId,selectedFrames.ids,selectedLayers.ids,motionFrameIds]);
 // Only sample preview geometry while Depth Scale is OPEN. Never during normal pen work.
 const depthPreviewFrames=useMemo<DepthPreviewFrame[]>(()=>{
  if(batchCanvasMode!=='depth'||!multiCelAvailable||!doc.animation)return [];
  const selected=new Set(selectedFrames.ids),chosenLayers=selectedLayers.ids.length?selectedLayers.ids:[doc.activeLayerId];
  const sampled:DepthPreviewFrame[]=[];let previewOps=0,previewPoints=0;
  for(const [index,frame] of doc.animation.frames.entries()){
   if(!selected.has(frame.id))continue;
   const ops=chosenLayers.flatMap(id=>frame.drawings[id]??[]).filter(op=>op.kind==='stroke'||op.kind==='vector');
   const b=boundsOf(ops);if(!b)continue;
   const paths:{d:string;width:number}[]=[];
   for(const op of ops){
    if(previewOps>=420||previewPoints>=14000)break;
    const points=polyline(op),step=Math.max(1,Math.ceil(points.length/120));
    const sampledPoints=points.filter((_,i)=>i%step===0||i===points.length-1).map(p=>toScreen(p,view));
    if(!sampledPoints.length)continue;
    paths.push({d:sampledPoints.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),width:op.kind==='stroke'?op.size:op.width});
    previewOps++;previewPoints+=sampledPoints.length;
   }
   sampled.push({id:frame.id,order:index,number:index+1,bounds:{x:b.x,y:b.y,w:Math.max(b.w,2),h:Math.max(b.h,2)},paths});
  }
  return sampled;
 },[batchCanvasMode,multiCelAvailable,doc.animation,doc.activeLayerId,selectedFrames.ids,selectedLayers.ids,view.x,view.y,view.zoom,view.rotation]);

 const playbackIsRunning=['preparing','playing','buffering'].includes(playbackUpdate.state);
 const pathVisible=!playbackIsRunning||showPathDuringPlayback;
 const pathEditable=motionArcEditing&&(!playbackIsRunning||editPathWhilePlaying);
 cameraOverlayNeeded.current=tool==='transform'||tool==='stroke-select'&&advancedStrokeTransform||multiCelAvailable&&!!batchCanvasMode||motionToolsOpen&&rightTab==='motion'&&workspaceMode==='ANIMATE'&&pathVisible;
 function selectFrameWithModifier(id:string,shift=false,alt=false){if(!shift&&!alt)setBatchCanvasMode(null);setSelectedFrames(previous=>pickItems(motionFrameIds,previous,id,shift,alt));}
 function selectLayerWithModifier(id:string,shift=false,alt=false){setSelectedLayers(previous=>pickItems(layerIds,previous,id,shift,alt));}
 useEffect(()=>{writePreference('motion-path-playback-show',showPathDuringPlayback);},[showPathDuringPlayback]);
 useEffect(()=>{writePreference('motion-path-live-edit',editPathWhilePlaying);},[editPathWhilePlaying]);
 useEffect(()=>{setLightTablePins(previous=>{
  const cleaned=sanitizeLightTablePins(store.getSnapshot(),previous);
  const unchanged=previous.length===cleaned.length&&cleaned.every((pin,i)=>pin.frameId===previous[i].frameId);
  return unchanged?previous:cleaned;
 });},[lightTableFrameIds,store]);
 useEffect(()=>{const cleaned=sanitizeLightTablePins(doc,lightTablePins);engine.current?.onion.setPins(cleaned);writePreference('light-table:'+doc.id,cleaned);},[doc.id,lightTablePins]);
 // Playback is a read-only overlay. Never change project frames to show previews.
 useEffect(()=>{
  if(!workspace.current)return;
  const instance=new PlaybackOverlay(workspace.current,store.getSnapshot(),setPlaybackUpdate,notify);
  playback.current=instance;instance.setView(engine.current?.view??{x:0,y:0,zoom:1,rotation:0});
  return()=>{instance.dispose();if(playback.current===instance)playback.current=null;};
 },[store]);
 useEffect(()=>{playback.current?.update(doc);},[doc]);
 // Audio element is stable for the app lifetime. Swapping frames or drawing strokes
 // never decodes audio, recreates an element, or recalculates the waveform.
 useEffect(()=>{
  const element=new Audio();element.preload='auto';audioElement.current=element;
  playback.current?.attachAudio(element);
  return()=>{element.pause();element.removeAttribute('src');element.load();playback.current?.attachAudio(null);if(audioElement.current===element)audioElement.current=null;};
 },[]);
 useEffect(()=>{const element=audioElement.current;if(!element)return;element.pause();if(doc.audio){element.src=doc.audio.data;element.load();}else{element.removeAttribute('src');element.load();}},[doc.audio?.data]);
 useEffect(()=>{if(audioElement.current)audioElement.current.muted=audioMuted;writePreference('audio-muted',audioMuted);},[audioMuted]);
 useEffect(()=>{const media=audioElement.current;if(!media||!doc.audio||playback.current?.running)return;const sec=secondsAtExposure(currentExposureRange(doc).start,fps);if(Number.isFinite(sec))try{media.currentTime=Math.min(sec,doc.audio.duration);}catch{/* audio still loading */}},[doc.id,doc.animation?.activeFrameId,doc.audio?.data,fps]);

 useEffect(()=>{writePreference('playback-fps',fps);writePreference('playback-loop',loop);playback.current?.configure(fps,loop);},[fps,loop]);
 useEffect(()=>{const visibility=()=>{if(document.hidden)playback.current?.pause();};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 useEffect(()=>{writePreference('layout',layout);writePreference('workspace-compact-initialized',true);},[layout]);
 useEffect(()=>{writePreference('timeline-view',timelineView);},[timelineView]);
 useEffect(()=>{writePreference('xsheet-side',xsheetSide);writePreference('xsheet-width',xsheetWidth);},[xsheetSide,xsheetWidth]);
 useEffect(()=>{writePreference('fill-settings',fillSettings);if(engine.current)engine.current.fillSettings=fillSettings;},[fillSettings]);
 useEffect(()=>{writePreference('shortcuts',shortcuts);},[shortcuts]);
 useEffect(()=>{writePreference('brush-library',brushLibrary);},[brushLibrary]);
 useEffect(()=>{writePreference('onion-settings',onionSettings);engine.current?.onion.setSettings(onionSettings);},[onionSettings]);
 useEffect(()=>{writePreference('vector-settings-solid-ink',vectorDefaults);if(engine.current)Object.assign(engine.current.vectors,vectorDefaults);},[vectorDefaults]);
 useEffect(()=>{
  if(initialCheck.current)return;
  initialCheck.current=true;
  if(!(window as Window&{soloDesktop?:DesktopCloseBridge}).soloDesktop){
const lastId=readPreference<string|null>('last-project',null);(lastId?repository.get(lastId).catch(()=>undefined):Promise.resolve(undefined)).then(async direct=>{const list=direct?[direct]:await repository.list();if(!direct)setRecords(list);if(!list.length)return;const record=list.find(r=>r.id===lastId)??list[0],e=engine.current;if(e&&store.revision===0&&!e.drawing){validateProject(record.project);if(await loadStudioProject(record.project,0)){activeTabId.current=record.id;sessions.current.clear();sessions.current.set(record.id,{history:store.captureHistory(),saved:store.getSnapshot(),savedAt:record.savedAt});setTabIds([record.id]);setStatus('Opened local project');setLastSaved(record.savedAt);writePreference('last-project',record.id);}}}).catch(e=>notify('Saved work remains in local storage; could not automatically reopen it: '+String(e)));
   return;
  }
  setModal('recover');
  repository.list().then(setRecords).catch(e=>notify('Could not read saved projects: '+String(e)));
 },[]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),7000);return()=>clearTimeout(timer);},[message]);
 async function save(kind:'manual'|'autosave'='manual',projectOverride?:Project):Promise<boolean>{
  const intendedId=projectOverride?.id??store.getSnapshot().id;
  if(kind==='autosave'&&(closeRequestRef.current||!activeTabId.current))return false;
  if(kind==='autosave')await new Promise<void>(resolve=>{if('requestIdleCallback' in window)window.requestIdleCallback(()=>resolve(),{timeout:1000});else setTimeout(resolve,16);});
  if(!mounted.current||kind==='autosave'&&(store.getSnapshot().id!==intendedId||closeRequestRef.current))return false;
  if(operationLock.current||engine.current?.drawing||kind==='autosave'&&pendingSaves.current>0){if(kind==='manual')notify('Finish the current canvas operation before saving.');else{if(autosaveRetry.current)clearTimeout(autosaveRetry.current);autosaveRetry.current=setTimeout(()=>{autosaveRetry.current=null;if(mounted.current&&documentDirty(store.getSnapshot(),saved.current))void save('autosave');},1000);}return false;}
  if(autosaveRetry.current){clearTimeout(autosaveRetry.current);autosaveRetry.current=null;}
  const captured=projectOverride??store.getSnapshot();pendingSaves.current++;if(store.getSnapshot().id===captured.id)setStatus('Saving…');
  const task=saveChain.current.catch(()=>{}).then(()=>kind==='autosave'?autosaveWriter.save(captured):repository.save(captured,kind));saveChain.current=task;
  try{const record=await task;const session=sessions.current.get(captured.id);if(session){session.saved=captured;session.savedAt=record.savedAt;setTabIds(ids=>[...ids]);}if(store.getSnapshot().id===captured.id){saved.current=captured;writePreference('last-project',captured.id);if(mounted.current){setLastSaved(record.savedAt);setStatus(!documentDirty(store.getSnapshot(),captured)?(kind==='autosave'?'Autosaved locally':'Saved locally'):'Unsaved changes');if(kind==='manual')notify('Project saved on this device. Download a backup for safekeeping.');}}return true;}
  catch(e){if(mounted.current){if(store.getSnapshot().id===captured.id)setStatus('Save failed');notify('Save failed for “'+captured.name+'”. Previous successful saves remain intact. '+String(e));}return false;}
  finally{pendingSaves.current--;}
 }
 const closeAfterSave=useRef(false);
 const savingToClose=useRef(false);
 useEffect(()=>{
  const desktop=(window as Window&{soloDesktop?:DesktopCloseBridge}).soloDesktop;
  return desktop?.onSaveBeforeClose?.(()=>{
   if(savingToClose.current)return;
   savingToClose.current=true;
   void (async()=>{
    try{
     if(engine.current?.drawing)engine.current.finishGesture('window-close');
     captureCurrentTab();
     for(const [id,session] of sessions.current){
      const project=id===activeTabId.current?store.getSnapshot():session.history.project;
      if(documentDirty(project,id===activeTabId.current?saved.current:session.saved)&&!await save('manual',project))return;
     }
     if(!pendingSaves.current&&!hasUnsavedTabs()){
      closeAfterSave.current=true;
      desktop.closeAfterSave?.();
     }
    }finally{savingToClose.current=false;}
   })();
  });
 },[store]);
 useEffect(()=>{if(closeRequest||!activeTabId.current||!documentDirty(doc,saved.current))return;const timer=setTimeout(()=>{if(documentDirty(store.getSnapshot(),saved.current))void save('autosave');},2500);return()=>clearTimeout(timer);},[doc,closeRequest]);
 useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(closeAfterSave.current)return;if(hasUnsavedTabs()||engine.current?.drawing||pendingSaves.current||engine.current?.recorder.warnOnClose){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[store]);
 function discard(){return !engine.current?.drawing&&!documentDirty(doc,saved.current)||window.confirm('There are unsaved changes or an active stroke. Continue and discard those changes?');}
 function captureCurrentTab(){
  const id=activeTabId.current;if(!id||store.getSnapshot().id!==id)return;
  sessions.current.set(id,{history:store.captureHistory(),saved:saved.current,savedAt:sessions.current.get(id)?.savedAt??lastSaved});
  if(engine.current)views.remember(store.getSnapshot(),engine.current.view);
 }
 function hasUnsavedTabs(){
  for(const [id,session] of sessions.current){
   if(documentDirty(id===activeTabId.current?store.getSnapshot():session.history.project,id===activeTabId.current?saved.current:session.saved))return true;
  }
  return false;
 }
 function resetProjectControls(){
  setSelectedFrames({ids:[],anchor:null});setSelectedLayers({ids:[],anchor:null});setBatchCanvasMode(null);setAddingMotionDot(false);setMotionArcEditing(false);setActiveMotionArcId('');setLinkTargetFrameId('');setRenameId('');setOnionSettingsOpen(false);
 }
 async function openProject(p:Project,replaceExisting=false){
  if(operationLock.current||tabTransition.current||sequenceBusy)return false;
  if(engine.current?.recorder.warnOnClose){notify('Stop or export the bug recording before switching projects.');return false;}
  if(replaceExisting&&!discard())return false;
  if(activeTabId.current===p.id&&!replaceExisting){setModal('');return true;}
  try{
   validateProject(p);stopPlayback();clearFlipPreview();engine.current!.finishGesture('project-switch');captureCurrentTab();
   const existing=replaceExisting?undefined:sessions.current.get(p.id);
   tabTransition.current=true;operationLock.current=true;setBusy(true);
   if(!await loadStudioProject(existing?.history.project??p,undefined,existing?.history)){notify('Project opening was canceled because the document changed.');return false;}
   const opened=store.getSnapshot(),record=records.find(record=>record.id===p.id&&record.project===p);
   saved.current=existing?.saved??(record&&!replaceExisting?opened:undefined);
   const session=existing??{history:store.captureHistory(),saved:saved.current,savedAt:record?.savedAt??''};
   // An unsaved tab must stay unsaved when activated, even if a disk record exists.
   if(existing)saved.current=existing.saved;
   sessions.current.set(opened.id,session);activeTabId.current=opened.id;
   setTabIds(ids=>ids.includes(opened.id)?[...ids]:[...ids,opened.id]);
   writePreference('last-project',opened.id);setLastSaved(session.savedAt);setStatus(documentDirty(opened,saved.current)?'Unsaved changes':'Opened local project');resetProjectControls();setModal('');return true;
  }catch(e){notify('Could not open project: '+String(e));return false;}
  finally{tabTransition.current=false;operationLock.current=false;setBusy(false);}
 }
 async function selectProjectTab(id:string){const session=sessions.current.get(id);return session?openProject(session.history.project):false;}
 async function closeProjectTab(id:string){
  if(tabTransition.current||operationLock.current||sequenceBusy)return false;
  await saveChain.current.catch(()=>{});
  if(tabTransition.current||operationLock.current||closeRequestRef.current&&closeRequestRef.current!==id)return false;
  captureCurrentTab();
  const target=sessions.current.get(id);if(!target)return false;
  // A queued save can yield to more drawing. Recheck before a clean close so
  // edits made while waiting cannot be silently discarded.
  if(!closeRequestRef.current&&documentDirty(target.history.project,target.saved)){setCloseRequest(id);return false;}
  if(id===activeTabId.current){
   const ids=[...sessions.current.keys()],index=ids.indexOf(id),next=ids[index+1]??ids[index-1];
   if(next){if(!await selectProjectTab(next))return false;}
   else{
    tabTransition.current=true;operationLock.current=true;setBusy(true);
    try{
     const empty=newProject();if(!await engine.current!.load(empty))return false;
     activeTabId.current=null;saved.current=empty;setLastSaved('');setStatus('New project');resetProjectControls();setModal('recover');
     repository.list().then(setRecords).catch(error=>notify('Could not refresh saved projects: '+String(error)));
    }catch(error){notify('Could not close this project: '+String(error));return false;}
    finally{tabTransition.current=false;operationLock.current=false;setBusy(false);}
   }
  }
  sessions.current.delete(id);setTabIds(ids=>ids.filter(tab=>tab!==id));setCloseRequest(null);return true;
 }
 function requestCloseProject(id:string){
  if(operationLock.current||tabTransition.current||closeRequestRef.current||sequenceBusy)return;
  if(engine.current?.recorder.warnOnClose){notify('Stop or export the bug recording before closing a project.');return;}
  stopPlayback();clearFlipPreview();engine.current?.finishGesture('project-close');captureCurrentTab();
  setCloseError('');
  const session=sessions.current.get(id);if(!session)return;
  if(documentDirty(session.history.project,session.saved)){setCloseRequest(id);return;}
  void closeProjectTab(id);
 }
 async function confirmCloseProject(keep:boolean){
  if(!closeRequest||closingTab)return;
  setClosingTab(true);
  setCloseError('');
  try{
   const id=closeRequest,session=sessions.current.get(id);if(!session)return;
   if(keep&&!await save('manual',id===activeTabId.current?store.getSnapshot():session.history.project)){setCloseError('Could not save. Your project is still open. Try again or choose Cancel.');return;}
   if(!await closeProjectTab(id))setCloseError('Could not close this project. Your work is still open.');
  }finally{setClosingTab(false);}
 }
 async function combineHomeScenes(destination:Project,source:Project){
  try{
   const combined=combineScenes(destination,source);
   if(!window.confirm(`Create a combined scene with “${source.name}” above “${destination.name}”? Both original scenes will be kept.`))return;
   if(!await openProject(combined))return;
   await save();
   return combined.id;
  }catch(e){notify('Could not combine scenes: '+String(e));}
 }
 async function placeHomePhoto(project:Project,file:File){
  if(!await openProject(project))return;
  await engine.current?.references.import(file,false);
 }
 const homeRequiresScene=modal==='recover'&&!tabIds.length;
 function closeModal(){if(homeRequiresScene)return;if(!tabIds.length){setModal('recover');return;}if(sequenceBusy){sequenceAbort.current?.abort();return;}setModal('');}
 async function showOnboarding(){try{setDeleteSelection([]);setRecords(await repository.list());setModal('recover');}catch(e){notify('Could not read saved projects: '+String(e));}}
 async function createHomeScene(title:string,width:number,height:number,photo?:File){
  if(operationLock.current)return;
  const scene=newProject(title,width,height);
  await openProjectWithoutConfirm(scene);
  if(store.getSnapshot().id!==scene.id)return;
  if(photo)await engine.current?.references.import(photo,false);
  await save();
  return scene.id;
 }
 async function listProjects(){try{setDeleteSelection([]);setRecords(await repository.list());setModal('open');}catch(e){notify('Could not read projects: '+String(e));}}
 async function showSnapshots(){try{setSnapshots(await repository.snapshots(doc.id));setModal('snapshots');}catch(e){notify('Could not read snapshots: '+String(e));}}
 function toggleProjectForDeletion(id:string,checked:boolean){
  if(sessions.current.has(id))return;
  setDeleteSelection(previous=>checked?[...new Set([...previous,id])]:previous.filter(item=>item!==id));
 }
 async function deleteSelectedProjects(selection=deleteSelection){
  if(deletingProjects||operationLock.current||engine.current?.drawing)return;
  const activeId=store.getSnapshot().id;
  const ids=selection.filter(id=>!sessions.current.has(id)&&id!==activeId&&records.some(record=>record.id===id));
  if(!ids.length){notify('Select one or more inactive projects. Switch to another project to delete the one currently open.');return;}
  const labels=records.filter(record=>ids.includes(record.id)).map(record=>record.project.name);
  const preview=labels.slice(0,5).join(', ')+(labels.length>5?` and ${labels.length-5} more`:'');
  if(!window.confirm(`Permanently delete ${ids.length} local project${ids.length===1?'':'s'} and their recovery snapshots?\n\n${preview}\n\nThis cannot be undone. Download any backups you need first.`))return;
  setDeletingProjects(true);
  try{
   // Finish any already queued autosaves before deleting old records, so a stale write cannot restore them.
   await saveChain.current.catch(()=>{});
   if(ids.some(id=>sessions.current.has(id))||ids.includes(store.getSnapshot().id)){notify('The current project cannot be deleted while it is open.');return;}
   const removed=await repository.deleteProjects(ids);
   if(ids.includes(readPreference<string>('last-project','')))writePreference('last-project',store.getSnapshot().id);
   for(const id of ids){try{localStorage.removeItem('solo:view:'+id);}catch{/* Optional view preference. */}}
   setRecords(await repository.list());setDeleteSelection([]);
   notify(`Deleted ${removed} local project${removed===1?'':'s'} and their recovery snapshots.`);
   return true;
  }catch(e){notify('Could not delete projects. Existing saved work is protected: '+String(e));try{setRecords(await repository.list());}catch{/* Keep current list. */}}
  finally{setDeletingProjects(false);}
 }

 function startNew(){setName('Untitled scene');setResolution('1920x1080');setModal('new');}
 async function submitProject(){
  if(!name.trim())return;
  if(modal==='new'){const [w,h]=resolution.split('x').map(Number);const p=newProject(name.trim(),w,h);await openProjectWithoutConfirm(p);}
  else if(modal==='saveas'){const p={...doc,id:uid(),name:name.trim(),createdAt:new Date().toISOString()};if(await openProject(p))await save();}
  else if(modal==='rename'){store.commit({...doc,name:name.trim()});setModal('');}
 }
 async function openProjectWithoutConfirm(p:Project){return openProject(p);}
 function commit(p:Project){if(operationLock.current)return;engine.current?.cancelGesture();engine.current?.clearSelection();store.commit(p);}
 function animationAction(action:'add'|'duplicate'|'delete'){
  playback.current?.stop();
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before changing animation frames.');return;}
  const current=store.getSnapshot(),base=action==='add'&&!hasIndependentLayers(current)?enableIndependentLayers(current):current,next=action==='add'?addDrawingFrame(base):action==='duplicate'?duplicateDrawingFrame(base):deleteDrawingFrame(base);
  if(next===current){notify(action==='delete'?'At least one drawing frame is required.':'Maximum 240 drawing frames per scene.');return;}
  clearFlipPreview();engine.current?.cancelGesture();const committed=action==='delete'?pruneMotionPlanning(next):next;store.commit(committed,action==='add'?'Add drawing frame':action==='duplicate'?'Duplicate drawing frame':'Delete drawing frame');
  engine.current?.clearSelection();void engine.current?.renderer.prepare(committed).then(()=>engine.current?.request()).catch(err=>notify('Could not load frame artwork: '+String(err)));
 }
 function changeHold(hold:number){
  playback.current?.stop();
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before editing frame timing.');return;}
  const before=store.getSnapshot(),after=setDrawingFrameHold(before,hold);
  if(after===before)return;
  store.commit(after,'Change frame hold');
 }
 /** A drag is only a local visual preview until pointer-up: one history entry, no pen rerender. */
 function changeHoldForCel(id:string,hold:number){
  if(operationLock.current||engine.current?.drawing)return;
  const before=store.getSnapshot(),after=setDrawingFrameHoldById(before,id,hold);
  if(after===before)return;
  playback.current?.stop();
  store.commit(after,'Resize frame exposure');
 }
 function cancelHoldDrag(){
  const drag=holdDrag.current;
  if(!drag)return;
  holdDrag.current=null;
  drag.el.style.cursor='pointer';
  if(drag.el.hasPointerCapture(drag.pointerId))drag.el.releasePointerCapture(drag.pointerId);
  setHoldPreview(null);
 }
 /** Click selects. Click-and-drag directly on a cel changes its exposure; no separate grip. */
 function beginHoldDrag(e:React.PointerEvent<HTMLButtonElement>,id:string,hold:number){
  if(e.button!==0||e.shiftKey||e.altKey||operationLock.current||engine.current?.drawing||busy)return;
  cancelHoldDrag();
  suppressCelSelect.current=null;
  const el=e.currentTarget,rect=el.getBoundingClientRect();
  el.setPointerCapture(e.pointerId);
  holdDrag.current={id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,startHold:hold,nextHold:hold,edgeGrab:e.clientX>=rect.right-12,dragging:false,el};
 }
 function moveHoldDrag(e:React.PointerEvent<HTMLButtonElement>){
  const drag=holdDrag.current;
  if(!drag||drag.pointerId!==e.pointerId){
   const rect=e.currentTarget.getBoundingClientRect();
   e.currentTarget.style.cursor=e.clientX>=rect.right-12?'ew-resize':'pointer';
   return;
  }
  const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
  if(!drag.dragging){
   const threshold=drag.edgeGrab?3:7;
   if(Math.abs(dx)<threshold||Math.abs(dx)<Math.abs(dy)*1.25)return;
   drag.dragging=true;
   playback.current?.stop();clearFlipPreview();
   e.currentTarget.style.cursor='ew-resize';
  }
  const next=holdFromDrag(drag.startHold,dx);
  if(next!==drag.nextHold){drag.nextHold=next;setHoldPreview({id:drag.id,hold:next});}
 }
 function finishHoldDrag(e:React.PointerEvent<HTMLButtonElement>,apply:boolean){
  const drag=holdDrag.current;
  if(!drag||drag.pointerId!==e.pointerId)return;
  const {id,startHold,dragging}=drag;
  const final=apply&&dragging?holdFromDrag(startHold,e.clientX-drag.startX):startHold;
  if(dragging)suppressCelSelect.current=id;
  cancelHoldDrag();
  if(apply&&dragging&&final!==startHold)changeHoldForCel(id,final);
 }
 function clickCel(e:React.MouseEvent<HTMLButtonElement>,id:string){
  if(suppressCelSelect.current===id){e.preventDefault();suppressCelSelect.current=null;return;}
  selectFrameWithModifier(id,e.shiftKey,e.altKey);
  goToDrawingFrame(id);
 }
 /** Layer exposure edits never touch the paint engine, but the active composed
  * frame may change. Refresh only after the one final Undo-able metadata change. */
 function commitLayerExposure(next:Project,label:string){
  if(operationLock.current||engine.current?.drawing||busy){notify('Finish drawing before editing a layer hold.');return;}
  const before=store.getSnapshot();if(next===before)return;
  stopPlayback();clearFlipPreview();engine.current?.clearSelection();store.commit(next,label);
  void engine.current?.renderer.prepare(next).then(()=>engine.current?.request()).catch(error=>notify('Could not update layer preview: '+String(error)));
 }
 function changeLayerHold(layerId:string,startId:string,endIndex:number){
  commitLayerExposure(setLayerHoldEnd(store.getSnapshot(),layerId,startId,endIndex),'Adjust '+(store.getSnapshot().layers.find(l=>l.id===layerId)?.name??'layer')+' exposure');
 }
 function newLayerKey(duplicate=true){
  const p=store.getSnapshot(),frame=frameList(p)[currentFrameIndex(p)];
  if(!isLayerHeld(p,p.activeLayerId,frame.id)){notify('This layer already has a key drawing at the current frame.');return;}
  commitLayerExposure(insertLayerKey(p,p.activeLayerId,frame.id,duplicate),duplicate?'Duplicate held cel as key':'Create blank layer key');
 }
 function stepLayer(delta:number){
  const p=store.getSnapshot(),index=p.layers.findIndex(l=>l.id===p.activeLayerId),next=p.layers[index+delta];
  if(next){stopPlayback();engine.current?.clearSelection();store.select(next.id);}
 }
 function stepLayerHold(delta:number){
  const p=store.getSnapshot(),i=currentFrameIndex(p),id=p.activeLayerId,frames=frameList(p);
  const start=layerKeyStart(p,id,i),end=layerKeyEnd(p,id,start);
  const target=Math.max(start,Math.min(frames.length-1,end+delta));
  if(target!==end)changeLayerHold(id,frames[start].id,target);
 }
 function layerPointerDown(e:React.PointerEvent<HTMLButtonElement>,layerId:string,index:number){
  if(e.button!==0||e.shiftKey||e.altKey||busy||operationLock.current||engine.current?.drawing)return;
  const p=store.getSnapshot(),frames=frameList(p);
  if(isLayerHeld(p,layerId,frames[index].id))return; // A held cel is selected or split, not resized.
  const el=e.currentTarget,row=el.parentElement!;
  // Resolve hit positions ONCE, never run DOM layout reads on pen-move.
  let cursor=row.getBoundingClientRect().left+8;
  const cellRightEdges=frames.map(frame=>{cursor+=47+10*(frameHold(frame)-1);const right=cursor;cursor+=2;return right;});
  el.setPointerCapture(e.pointerId);
  const end=layerKeyEnd(p,layerId,index);
  layerHoldDrag.current={layerId,pointerId:e.pointerId,startIndex:index,startX:e.clientX,startEnd:end,currentEnd:end,dragging:false,el,cellRightEdges};
  suppressLayerClick.current=false;
 }
 function layerPointerMove(e:React.PointerEvent<HTMLButtonElement>){
  const drag=layerHoldDrag.current;if(!drag||drag.pointerId!==e.pointerId)return;
  const dx=e.clientX-drag.startX;
  if(!drag.dragging){if(Math.abs(dx)<7)return;drag.dragging=true;suppressLayerClick.current=true;}
  const targetIndex=drag.cellRightEdges.findIndex(right=>e.clientX<right);
  let target=targetIndex<0?drag.cellRightEdges.length-1:targetIndex;
  target=Math.max(drag.startIndex,Math.min(frameList(store.getSnapshot()).length-1,target));
  // Pulling left from a previously extended key shortens it, too.
  if(dx<0)target=Math.max(drag.startIndex,Math.min(drag.startEnd,target));
  if(drag.currentEnd!==target){drag.currentEnd=target;setLayerHoldPreview({layerId:drag.layerId,start:drag.startIndex,end:target});}
 }
 function finishLayerDrag(e:React.PointerEvent<HTMLButtonElement>,apply:boolean){
  const drag=layerHoldDrag.current;if(!drag||drag.pointerId!==e.pointerId)return;
  layerHoldDrag.current=null;
  if(drag.el.hasPointerCapture(drag.pointerId))drag.el.releasePointerCapture(drag.pointerId);
  setLayerHoldPreview(null);
  if(apply&&drag.dragging&&drag.currentEnd!==drag.startEnd){
   const frames=frameList(store.getSnapshot());changeLayerHold(drag.layerId,frames[drag.startIndex].id,drag.currentEnd);
  }
  // Prevent the synthetic click after a pen drag from changing the active frame.
  if(drag.dragging)window.setTimeout(()=>{suppressLayerClick.current=false;},0);
 }
 function clickLayerFrame(e:React.MouseEvent<HTMLButtonElement>,layerId:string,frameId:string){
  if(suppressLayerClick.current){e.preventDefault();suppressLayerClick.current=false;return;}
  selectFrameWithModifier(frameId,e.shiftKey,e.altKey);
  selectLayerWithModifier(layerId,e.shiftKey,e.altKey);
  goToDrawingFrame(frameId);
  store.select(layerId);
 }
 function clearFlipPreview(){engine.current?.flipbook.preview(null);setFlipPreview(null);}
 function togglePlayback(){
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before animation playback.');return;}
  clearFlipPreview();
  if(playback.current?.running)playback.current.pause();else {
   // Unlock Chrome audio on the genuine Play click before asynchronous frame preparation.
   const media=audioElement.current;if(doc.audio&&media){void media.play().then(()=>{if(playback.current?.snapshot.state==='preparing')media.pause();}).catch(()=>{});}
   void playback.current?.play();
  }
 }
 function stopPlayback(){playback.current?.stop();}
 async function addSceneAudio(file:File){
  if(audioBusy||operationLock.current||engine.current?.drawing)return notify('Finish the current drawing before importing audio.');
  setAudioBusy(true);
  try{const asset=await importSceneAudio(file);
   if(!mounted.current)return;
   const current=store.getSnapshot();if(current.id!==doc.id){notify('Project changed during audio import. Import it again in the new project.');return;}
   stopPlayback();store.commit({...current,audio:asset},'Import scene audio');setAudioTrackOpen(true);setLayout(old=>({...old,bottom:Math.max(old.bottom,240),bottomClosed:false}));
   notify(`Added ${asset.name} (${asset.duration.toFixed(1)}s) to this animation.`);
  }catch(error){notify('Audio import failed: '+String(error));}finally{if(mounted.current)setAudioBusy(false);}
 }
 function removeSceneAudio(){if(!store.getSnapshot().audio||!window.confirm('Remove audio from this scene? Undo can restore it.'))return;stopPlayback();const current=store.getSnapshot();store.commit({...current,audio:undefined},'Remove scene audio');}
 function seekSceneAudio(seconds:number){
  if(operationLock.current||engine.current?.drawing||playback.current?.running)return;
  stopPlayback();
  const current=store.getSnapshot(),position=positionAtExposure(exposurePlan(current),exposureAtSeconds(seconds,fps,totalExposureFrames(current)));
  const frame=frameList(current)[position.celIndex];if(frame)goToDrawingFrame(frame.id);
  // Frame holds are intentionally quantized to the current project FPS.
  const media=audioElement.current;if(media&&Number.isFinite(media.duration))media.currentTime=Math.min(media.duration,secondsAtExposure(position.exposure,fps));
 }

 function toggleFlipPreview(direction:FlipDirection){
  stopPlayback();
  if(flipPreview===direction){clearFlipPreview();return;}
  if(engine.current?.flipbook.preview(direction))setFlipPreview(direction);
 }
 // v0.5.174 scene camera helpers. Exposure number = 1-based, holds included.
 function commitCamera(next:Project,label:string){if(operationLock.current||engine.current?.drawing)return;store.commit(next,label);}
 function moveSceneCamera(x:number,y:number){
  const p=store.getSnapshot();if(!p.camera)return;
  const shot=shotFrame(p),st=cameraAt(p.camera,cameraExposure,shot.width,shot.height,shot.x,shot.y);
  const k=p.camera.keys.find(k=>k.frame===cameraExposure);
  commitCamera({...p,camera:setCameraKey(p.camera,{frame:cameraExposure,...st,x,y,ease:k?.ease??'ease-in-out'})},'Move camera');
 }
 function loadStudioProject(project:Project,expectedRevision?:number,history?:DocumentHistory){
  const opened=!history&&project.shotFrame&&!frameOnly?openInfiniteWorkspace(project):project;
  return engine.current!.load(opened,expectedRevision,history);
 }
 useEffect(()=>{engine.current?.setOutsideFrame(!frameOnly);},[frameOnly]);
 function toggleOutsideFrame(){
  const current=store.getSnapshot(),studio=engine.current;
  if(!studio||busy||sequenceBusy||operationLock.current||studio.drawing)return;
  if(current.version===6){setFrameOnly(value=>!value);return;}
  stopPlayback();clearFlipPreview();
  try{
   const expanded=validateProject(openInfiniteWorkspace(current));
   studio.clearSelection();
   studio.setOutsideFrame(true);
   store.commit(expanded,'Open infinite workspace');
   setFrameOnly(false);
   studio.fit();
  }catch(error){notify(error instanceof Error?error.message:'Could not extend the drawing area.');}
 }
 const frameSize=shotFrame(doc);
 const showingOutside=doc.version===6&&!frameOnly;
 const maskOutside=!!doc.shotFrame&&!showingOutside;
 const outsideFrameLabel=showingOutside?'Frame Only':'Show Outside Frame';
 function goToCameraExposure(n:number){const item=cameraPlan.find(i=>i.number===n)??cameraPlan.at(-1);if(!item)return;setCameraExposure(item.number);if(doc.animation&&item.frameId!==doc.animation.activeFrameId)goToDrawingFrame(item.frameId);}
 function goToDrawingFrame(id:string){
  stopPlayback();
  if(operationLock.current||engine.current?.drawing)return;
  const next=selectDrawingFrame(store.getSnapshot(),id);if(next===store.getSnapshot())return;
  clearFlipPreview();engine.current?.cancelGesture();store.selectFrame(next);engine.current?.clearSelection();
  void engine.current?.renderer.prepare(next).then(()=>engine.current?.request()).catch(err=>notify('Could not load frame artwork: '+String(err)));
 }
 function stepDrawingFrame(delta:number){const next=adjacentFrame(store.getSnapshot(),delta);if(next!==store.getSnapshot()&&next.animation)goToDrawingFrame(next.animation.activeFrameId);}

 function undo(){stopPlayback();if(operationLock.current)return;engine.current?.historyNavigation('undo');}
 function redo(){stopPlayback();if(operationLock.current)return;engine.current?.historyNavigation('redo');}
 async function editing(command:'all'|'deselect'|'cut'|'copy'|'paste'|'merge'|'clear'){const e=engine.current;if(!e||busy)return;if(e.drawing){notify('Finish the current canvas operation first.');return;}if(['copy','cut','paste'].includes(command)&&e.selection.length&&(e.transform.dx||e.transform.dy||e.transform.angle||e.transform.scale!==1||(e.transform.scaleX??1)!==1||(e.transform.scaleY??1)!==1)){notify('Apply or cancel the transform preview before copying, cutting or pasting.');return;}if(e.strokeIds.length&&['copy','cut'].includes(command)){e.strokeAction(command as 'copy'|'cut');return;}if(command==='paste'&&toolIntent.current==='stroke-select'){e.strokeAction('paste');return;}if(command==='merge'&&frameList(store.getSnapshot()).length>1){notify('Merging across animation frames is not supported yet. Your artwork was not changed.');return;}if(command==='all'&&toolIntent.current==='stroke-select'){e.selectAllStrokes();}else if(command==='all'){e.editing.selectAll();chooseTool('transform');}else if(command==='deselect')e.clearSelection();else if(command==='cut'||command==='copy')e.editing.copy(command==='cut');else if(command==='paste'){await e.editing.paste();if(e.selection.length)chooseTool('transform');}else if(command==='merge')await e.editing.mergeDown();else e.editing.clear();}
 function beginSaveAs(){setName(doc.name+' copy');setModal('saveas');}
 function showExport(){if(!busy&&!sequenceBusy)setModal('export');}
 function toggleReferencePin(){const p=store.getSnapshot(),frame=frameList(p)[currentFrameIndex(p)],pins=sanitizeLightTablePins(p,lightTablePins);if(!pins.some(pin=>pin.frameId===frame.id)&&pins.length>=MAX_LIGHT_TABLE_PINS){notify('The light table supports up to five pinned drawings.');return;}setLightTablePins(toggleLightTablePin(p,pins,frame.id));}
 function toggleLightTablePanel(){
  setWorkspaceMode('ANIMATE');setFocusMode(false);setOnionSettingsOpen(false);
  if(!lightTableOpen&&timelineMenu.current)timelineMenu.current.open=true;
  setLayout(old=>({...old,bottomClosed:false}));setLightTableOpen(old=>!old);
 }
 function resizeXsheetDock(e:React.PointerEvent<HTMLDivElement>){
  if(e.button!==0||!workbench.current||!xsheetDock.current)return;
  e.preventDefault();const target=e.currentTarget,startX=e.clientX,startWidth=xsheetWidth,pointerId=e.pointerId;
  const panel=xsheetDock.current;target.setPointerCapture(pointerId);let pending=startWidth;
  const move=(event:PointerEvent)=>{if(event.pointerId!==pointerId)return;
   const sign=xsheetSide==='right'?-1:1;
   pending=Math.max(220,Math.min(490,startWidth+sign*(event.clientX-startX)));
   panel.style.width=pending+'px';
  };
  const end=(event:PointerEvent)=>{if(event.pointerId!==pointerId)return;
   target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);
   if(target.hasPointerCapture(pointerId))target.releasePointerCapture(pointerId);
   panel.style.width='';if(event.type==='pointerup')setXsheetWidth(pending);
  };
  target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);
 }
 function openSubstitutionShelf(){
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before opening the shelf.');return;}
  stopPlayback();setWorkspaceMode('ANIMATE');setFocusMode(false);
  setRightTab('substitutions');setLayout(old=>({...old,rightClosed:false}));
 }
 function captureSubstitution(name:string,category:SubstitutionCategory,selection:boolean):boolean{
  if(operationLock.current||engine.current?.drawing){notify('Finish the current stroke before saving a substitution.');return false;}
  const p=store.getSnapshot();
  try{
   const ids=selection?[...(engine.current?.strokeIds??[])]:undefined;
   if(selection&&!ids?.length){notify('First select the strokes with S, then save selection.');return false;}
   const next=saveSubstitution(p,name,category,ids);
   store.commit(next,'Save drawing substitution');
   notify('“'+name.trim()+'” saved in this project shelf.');return true;
  }catch(error){notify(String(error));return false;}
 }
 function insertSubstitution(id:string,mode:'append'|'replace'){
  if(operationLock.current||engine.current?.drawing){notify('Finish the current stroke before inserting a drawing.');return;}
  const p=store.getSnapshot(),target=activeLayer(p);
  if(linkedCount(p)>1&&!window.confirm('This cel is LINKED. Inserting artwork will update every linked drawing. Continue?'))return;
  if(mode==='replace'&&target.operations.length&&!window.confirm('Replace the ENTIRE current “'+target.name+'” layer drawing on this cel? You can Undo. Other layers will not change.'))return;
  try{
   const next=applySubstitution(p,id,mode);
   stopPlayback();engine.current?.cancelGesture();engine.current?.clearSelection();
   store.commit(next,'Insert drawing substitution');
   notify('Drawing copied to “'+target.name+'” on the current frame. Undo with Ctrl+Z.');
  }catch(error){notify(String(error));}
 }
 function changeSubstitutionName(id:string,name:string){try{store.commit(renameSubstitution(store.getSnapshot(),id,name),'Rename drawing substitution');}catch(error){notify(String(error));}}
 function removeSubstitutionFromShelf(id:string){store.commit(deleteSubstitution(store.getSnapshot(),id),'Remove drawing substitution');}
 function openReuseShelf(){
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before opening the cycle shelf.');return;}
  stopPlayback();setWorkspaceMode('ANIMATE');setFocusMode(false);
  setRightTab('reuse');setLayout(old=>({...old,rightClosed:false}));
 }
 function linkDrawingToFrame(frameId:string){
  if(operationLock.current||engine.current?.drawing)return;
  const p=store.getSnapshot(),target=frameList(p).find(f=>f.id===frameId),layer=activeLayer(p);
  if(!target)return;
  const art=target.drawings[layer.id]??[];
  if(art.length&&!window.confirm('Replace the drawing on '+layer.name+' at the destination frame and LINK both drawings? Edits to either linked key will update the other. Undo is available.'))return;
  try{const next=linkCurrentCelToFrame(p,frameId);stopPlayback();engine.current?.clearSelection();store.commit(next,'Link animation drawings');notify('Drawing linked. Editing either key now updates all linked copies.');}
  catch(error){notify(String(error));}
 }
 function linkDrawingShortcut(){
  if(operationLock.current||engine.current?.drawing){notify('Finish the current stroke before linking drawings.');return;}
  const project=store.getSnapshot(),frames=frameList(project),current=frames[currentFrameIndex(project)]?.id;
  const destination=frames.some(frame=>frame.id===linkTargetFrameId&&frame.id!==current)
   ?linkTargetFrameId:frames.find(frame=>frame.id!==current)?.id;
  if(!destination){notify('Add another drawing frame before linking.');return;}
  linkDrawingToFrame(destination);
 }
 function unlinkDrawing(){
  if(operationLock.current||engine.current?.drawing){notify('Finish the current stroke before unlinking.');return;}
  const before=store.getSnapshot(),next=unlinkCurrentCel(before);if(next===before){notify('This drawing is already independent.');return;}
  store.commit(next,'Unlink animation drawing');notify('This drawing is now independent.');
 }
 function captureCycle(name:string,startIndex:number,endIndex:number):boolean{
  if(operationLock.current||engine.current?.drawing)return false;
  try{store.commit(saveDrawingCycleRange(store.getSnapshot(),name,startIndex,endIndex),'Save animation cycle');notify('Cycle “'+name.trim()+'” saved in this project.');return true;}
  catch(error){notify(String(error));return false;}
 }
 function insertCycle(id:string,repeats:number){
  if(operationLock.current||engine.current?.drawing)return;
  const p=store.getSnapshot(),item=cycleItems(p).find(i=>i.id===id);if(!item)return;
  const range=frameList(p).slice(currentFrameIndex(p),currentFrameIndex(p)+item.frames.length*repeats);
  const hasArt=range.some(f=>(f.drawings[p.activeLayerId]??[]).length>0);
  if(hasArt&&!window.confirm('Replace the active layer drawings on '+range.length+' destination cels with the repeated cycle? Other layers will not change. Linked keys in the range will become independent. You can Undo.'))return;
  try{const next=insertDrawingCycle(p,id,repeats,hasArt);stopPlayback();engine.current?.cancelGesture();engine.current?.clearSelection();store.commit(next,'Insert reusable animation cycle');
   void engine.current?.renderer.prepare(store.getSnapshot()).then(()=>engine.current?.request()).catch(error=>notify(String(error)));
   notify('Cycle inserted '+repeats+'× with independent drawings.');}
  catch(error){notify(String(error));}
 }
 function removeCycle(id:string){store.commit(deleteDrawingCycle(store.getSnapshot(),id),'Remove reusable cycle');}
 function toggleXsheetView(){
  if(operationLock.current||engine.current?.drawing)return;
  stopPlayback();setWorkspaceMode('ANIMATE');setFocusMode(false);
  setTimelineView(old=>old==='timeline'?'xsheet':'timeline');
 }
 function selectXsheetCell(frameId:string,layerId?:string,shift=false,alt=false){
  if(operationLock.current||engine.current?.drawing)return;
  selectFrameWithModifier(frameId,shift,alt);
  if(layerId)selectLayerWithModifier(layerId,shift,alt);
  goToDrawingFrame(frameId);
  if(layerId)store.select(layerId);
 }
 function makeXsheetKey(frameId:string,layerId:string){
  const p=store.getSnapshot();
  if(!isLayerHeld(p,layerId,frameId))return;
  commitLayerExposure(insertLayerKey(p,layerId,frameId,true),'Create layer key from Xsheet');
 }
 function pinLightTableFromShortcut(){
  if(busy||engine.current?.drawing)return;
  stopPlayback();setWorkspaceMode('ANIMATE');setFocusMode(false);setOnionSettingsOpen(false);
  setLayout(old=>({...old,bottomClosed:false}));setLightTableOpen(true);toggleReferencePin();
 }
 function updateReferencePin(frameId:string,change:Partial<LightTablePin>){const p=store.getSnapshot();setLightTablePins(old=>sanitizeLightTablePins(p,old.map(pin=>pin.frameId===frameId?{...pin,...change}:pin)));}
 async function exportSequence(settings:SequenceExportOptions){if(sequenceBusy||busy||engine.current?.drawing)return;stopPlayback();clearFlipPreview();const controller=new AbortController();sequenceAbort.current=controller;setSequenceBusy(true);setSequenceProgress({finished:0,total:0,phase:'Preparing'});try{
  const snapshot=store.getSnapshot();const zip=await renderSequenceZip(snapshot,settings,setSequenceProgress,controller.signal);if(controller.signal.aborted)return;downloadBlob(zip,(snapshot.name.replace(/[\\/:*?"<>|]/g,'_')||'animation')+'-png-sequence.zip');setModal('');notify('PNG animation sequence exported.');
 }catch(error){if(!controller.signal.aborted)notify('Sequence export failed: '+String(error));}finally{if(sequenceAbort.current===controller)sequenceAbort.current=null;setSequenceBusy(false);setSequenceProgress(null);}}
 async function exportPng(options:ExportOptions={}){if(busy)return;try{engine.current!.renderer.compositeShot(doc,options).toBlob(blob=>{if(blob){downloadBlob(blob,doc.name+'.png');setModal('');}else notify('PNG export failed.');});}catch(e){notify('PNG export failed: '+String(e));}}
 function resizePanel(e:React.PointerEvent,side:'left'|'right'|'bottom'){
  if(e.button!==0||focusMode||engine.current?.drawing)return;
  e.preventDefault();const el=e.currentTarget as HTMLElement,bench=workbench.current;
  if(!bench)return;
  el.setPointerCapture(e.pointerId);
  const start={x:e.clientX,y:e.clientY,...layout};
  const pointerId=e.pointerId;
  let next=start[side],pending=start[side],raf=0;
  const max=()=>side==='bottom'?Math.max(110,Math.min(520,bench.clientHeight-235)):Math.max(side==='left'?180:240,Math.min(side==='left'?300:340,(bench.clientWidth-340)/2));
  const move=(event:PointerEvent)=>{
   if(event.pointerId!==pointerId)return;
   const raw=side==='bottom'?start.bottom+start.y-event.clientY:start[side]+(side==='left'?event.clientX-start.x:start.x-event.clientX);
   pending=Math.round(Math.max(side==='bottom'?110:side==='left'?180:240,Math.min(max(),raw)));
   if(!raf)raf=requestAnimationFrame(()=>{raf=0;bench.style.setProperty(side==='bottom'?'--timeline-height':side==='left'?'--left-width':'--right-width',pending+'px');});
  };
  const end=(event:PointerEvent)=>{
   if(event.pointerId!==pointerId)return;
   el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);
   if(raf)cancelAnimationFrame(raf);
   const apply=event.type==='pointerup';next=apply?pending:start[side];
   // Preserve the last CSS variable until React commits the single final layout update.
   bench.style.setProperty(side==='bottom'?'--timeline-height':side==='left'?'--left-width':'--right-width',next+'px');
   if(el.hasPointerCapture(pointerId))el.releasePointerCapture(pointerId);
   if(apply&&next!==start[side])setLayout(old=>({...old,[side]:next}));
  };
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }
 useEffect(()=>{const keydown=(e:KeyboardEvent)=>{
  if(closeRequestRef.current||tabTransition.current||closingTab)return;
  if(modal==='recover'){if(e.key==='Escape'){e.preventDefault();closeModal();}return;}
  if(transformHotkeyRef.current?.(e)){e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.key==='Escape'&&addingMotionDot){e.preventDefault();setAddingMotionDot(false);return;}
  if(e.key==='Escape'&&batchCanvasMode){e.preventDefault();setBatchCanvasMode(null);setSelectedFrames({ids:[],anchor:null});return;}
  if(e.key==='Escape'&&holdDrag.current){e.preventDefault();cancelHoldDrag();return;}
  if(e.key==='Escape'){stopPlayback();clearFlipPreview();e.preventDefault();engine.current?.cancelGesture();engine.current?.clearSelection();setMenu('');setRenameId('');if(fillQuestion){fillQuestion.resolve(false);setFillQuestion(null);}closeModal();return;}
  const target=e.target as HTMLElement;
  // Permit explicit link/unlink hotkeys while the REUSE destination dropdown has
  // focus; keep every other input and select safe from global shortcuts.
  const reuseSelectHotkey=!!target.closest('.reuse-shelf select')&&
   (keyChord(e)===shortcuts.linkCel||keyChord(e)===shortcuts.unlinkCel);
  if(target.closest('textarea,select,[contenteditable=true],input:not([type=range]):not([type=color]):not([type=checkbox])')&&!reuseSelectHotkey)return;
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.shiftKey&&e.code==='KeyW'&&!modal){e.preventDefault();if(!e.repeat)window.dispatchEvent(new Event('solo:wheel-popout-toggle'));return;}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.code==='F9'&&!modal){e.preventDefault();if(!e.repeat){setFocusMode(v=>!v);setOnionSettingsOpen(false);}return;}
  if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='d'){e.preventDefault();setRightTab(old=>old==='diagnostics'?'inspector':'diagnostics');setLayout(old=>({...old,rightClosed:false}));return;}if(modal)return;
  const cmd=e.ctrlKey||e.metaKey;
  if(cmd&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='w'){e.preventDefault();if(!e.repeat&&activeTabId.current)requestCloseProject(activeTabId.current);return;}
  // Context-sensitive animator transform: W/S/R control the whole selected
  // frame range, without overriding S=Stroke Select / R=Rotate Canvas normally.
  if(!cmd&&!e.altKey&&!e.shiftKey&&multiCelAvailable&&
      (e.code==='KeyW'||e.code==='KeyS'||e.code==='KeyR'||e.code==='KeyD')){
   e.preventDefault();if(!e.repeat){stopPlayback();setAddingMotionDot(false);setBatchCanvasMode(e.code==='KeyW'?'move':e.code==='KeyS'?'scale':e.code==='KeyD'?'depth':'rotate');}
   return;
  }
  if(cmd&&!e.altKey&&['a','d','x','c','v'].includes(e.key.toLowerCase())){e.preventDefault();void editing(({a:'all',d:'deselect',x:'cut',c:'copy',v:'paste'} as const)[e.key.toLowerCase() as 'a'|'d'|'x'|'c'|'v']);return;}
  if(cmd&&!e.shiftKey&&e.key.toLowerCase()==='j'&&engine.current?.strokeIds.length){e.preventDefault();engine.current.strokeAction('duplicate');return;}
  if(cmd&&e.key.toLowerCase()==='s'){e.preventDefault();void save();return;}
  if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(cmd&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
  if(!cmd&&!e.altKey&&e.shiftKey&&e.code==='Space'){e.preventDefault();if(!e.repeat)togglePlayback();return;}
  if(!cmd&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='o'&&!target.closest('input,button')){e.preventDefault();setOnionSettings(old=>({...old,enabled:!old.enabled}));return;}
  if(!cmd&&!e.altKey&&!e.shiftKey&&!e.repeat&&(e.key===','||e.key==='.')&&!target.closest('input,textarea,select,[contenteditable=true]')){
   const direction:FlipDirection=e.key===','?-1:1;
   stopPlayback();if(!busy&&!engine.current?.drawing&&engine.current?.flipbook.preview(direction)){e.preventDefault();setFlipPreview(direction);}
   return;
  }
  if(!cmd&&e.altKey&&tool==='stroke-select'){
   const mode=e.code==='KeyP'?(e.shiftKey?'perspective-move':'perspective'):!e.shiftKey?({KeyS:'select',KeyL:'lasso',KeyV:'move',KeyG:'scale',KeyR:'rotate',KeyT:'freeform'} as const)[e.code as 'KeyS'|'KeyL'|'KeyV'|'KeyG'|'KeyR'|'KeyT']:undefined;
   if(mode){e.preventDefault();engine.current?.setStrokeMode(mode);setStrokeMode(mode);if(mode==='lasso'){engine.current?.setStrokeShape('lasso');setStrokeShape('lasso');}return;}
  }
  if(!cmd&&e.altKey&&!e.repeat){
   if(e.code==='BracketLeft'||e.code==='BracketRight'){
    e.preventDefault();stepLayerHold(e.code==='BracketRight'?1:-1);return;
   }
   if(e.code==='ArrowUp'||e.code==='ArrowDown'){
    e.preventDefault();stepLayer(e.code==='ArrowUp'?-1:1);return;
   }
   if(e.key.toLowerCase()==='k'){e.preventDefault();newLayerKey(!e.shiftKey);return;}
  }
  // US keyboard sends '{' / '}' while Shift is pressed: use physical bracket keys.
  if(!cmd&&!e.altKey&&e.shiftKey&&(e.code==='BracketLeft'||e.code==='BracketRight')&&!e.repeat){
   e.preventDefault();
   const active=frameList(store.getSnapshot())[currentFrameIndex(store.getSnapshot())];
   changeHold(frameHold(active)+(e.code==='BracketRight'?1:-1));return;
  }
  const quick=quickAction(e);
  if(quick){
   e.preventDefault();
   if(quick==='sizeDown'||quick==='sizeUp'){
    // Do not change tool presets or an in-progress stroke while the Wacom is down.
    if(engine.current?.drawing||operationLock.current)return;
    const direction=quick==='sizeUp'?1:-1;
    if(toolIntent.current==='vector')setVectorDefaults(old=>({...old,width:steppedBrushSize(old.width,direction,true)}));
    else if(toolIntent.current==='brush'||toolIntent.current==='eraser')setBrushLibrary(old=>{
     const preset=activePreset(old,toolIntent.current==='eraser');
     return updatePreset(old,preset.id,{...preset.settings,size:steppedBrushSize(preset.settings.size,direction)});
    });
    return;
   }
   if(quick==='previousFrame'||quick==='nextFrame'){if(!e.repeat)stepDrawingFrame(quick==='previousFrame'?-1:1);return;}
   if(quick==='blankFrame'||quick==='duplicateFrame'||quick==='deleteFrame'){
    if(!e.repeat)animationAction(quick==='blankFrame'?'add':quick==='duplicateFrame'?'duplicate':'delete');return;
   }
   if(quick==='zoomOut'||quick==='zoomIn'){
    if(engine.current&&!engine.current.drawing&&!operationLock.current)engine.current.zoomTo(engine.current.view.zoom*(quick==='zoomIn'?1.15:1/1.15));return;
   }
  }
  if(e.code==='Space'){e.preventDefault();if(engine.current)engine.current.space=true;return;}
  if(e.key==='Enter'&&hasSelection){e.preventDefault();engine.current?.applySelection();return;}
  if(strokeCount>0&&!cmd&&!e.altKey&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const n=e.shiftKey?10:1;engine.current?.strokeAction('nudge',e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0,e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0);return;}
  // Delete/Backspace after clicking an actual timeline/Xsheet frame removes THAT
  // selected drawing frame. On canvas, Delete still removes selected strokes.
  // Scope to frame-cell buttons only; controls and text inputs remain untouched.
  const frameFocused=!!target.closest('.cel-select,.layer-exposure-cell,.xsheet-exposure-number,.xsheet-layer-slot > button:not(.xsheet-split)');
  if(timelineDeleteKey(e,frameFocused)){e.preventDefault();if(!e.repeat)animationAction('delete');return;}
  // A focused layer row has priority over canvas strokes. One Delete = one history entry.
  if(!cmd&&!e.altKey&&(e.key==='Delete'||e.key==='Backspace')&&!!target.closest('.layer-select,.layer-track-name')&&!e.repeat){e.preventDefault();if(doc.layers.length>1)commit(removeLayer(doc,doc.activeLayerId));else notify('At least one layer must remain.');return;}

  if((strokeCount>0||hasSelection)&&(e.key==='Delete'||e.key==='Backspace')&&!cmd&&!e.altKey){e.preventDefault();if(!e.repeat)engine.current?.deleteSelectedArtwork();return;}
  if((e.key==='Delete'||e.key==='Backspace')&&tool==='vector'&&vectorId){e.preventDefault();engine.current?.vectors.delete();return;}
  if(!cmd&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='b'&&!target.closest('input,textarea,select,[contenteditable=true]')){
   e.preventDefault();
   if(!e.repeat){
    if(toolIntent.current==='brush')toggleMixMode();
    else chooseTool('brush');
   }
   return;
  }
  if((!cmd&&!e.altKey)||(e.ctrlKey&&e.altKey&&!e.metaKey&&!e.shiftKey)){const entry=Object.entries(shortcuts).find(([,v])=>v===keyChord(e));if(entry){e.preventDefault();const command=entry[0] as ShortcutCommand;if(command==='openProjects'){if(!e.repeat)void listProjects();}else if(command==='linkCel'){if(!e.repeat)linkDrawingShortcut();}else if(command==='unlinkCel'){if(!e.repeat)unlinkDrawing();}else if(command==='substitutionShelf'){if(!e.repeat)openSubstitutionShelf();}else if(command==='reuseShelf'){if(!e.repeat)openReuseShelf();}else if(command==='xsheet'){if(!e.repeat)toggleXsheetView();}else if(command==='motionPlanning'){if(!e.repeat)openMotionPlanning();}else if(command==='batchTransform'){if(!e.repeat)openBatchTransform();}else if(command==='audioTrack'){if(!e.repeat){setAudioTrackOpen(o=>!o);setWorkspaceMode('ANIMATE');setLayout(old=>({...old,bottomClosed:false}));}}else if(command==='lightTable'){if(!e.repeat)toggleLightTablePanel();}else if(command==='pinLightTable'){if(!e.repeat)pinLightTableFromShortcut();}else if(command==='fit')engine.current?.fit();else if(command==='resetRotation')engine.current?.rotate(0);else if(command==='pencil'){chooseTool('brush');setBrushLibrary(old=>({...old,brushId:'hb'}));}else chooseTool(command);}}
 };const keyup=(e:KeyboardEvent)=>{
   if((e.key===','||e.key==='.')&&flipPreview===(e.key===','?-1:1)){engine.current?.flipbook.preview(null);setFlipPreview(null);}
   if(e.code==='Space'&&engine.current)engine.current.space=false;
  };const blur=()=>{cancelHoldDrag();playback.current?.pause();engine.current?.flipbook.preview(null);setFlipPreview(null);if(engine.current){engine.current.space=false;engine.current.finishGesture();}};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);};
 },[doc,shortcuts,linkTargetFrameId,modal,hasSelection,tool,vectorId,fillQuestion,renameId,busy,flipPreview,strokeCount,multiCelAvailable,batchCanvasMode,closingTab]);
 wheelDelegates.current={
  action:action=>{if(action==='onion-skin')setOnionSettings(settings=>({...settings,enabled:!settings.enabled}));else stepDrawingFrame(action==='previous-cel'?-1:1);},
  mix:()=>toggleMixMode()
 };
 const layer=activeLayer(doc),activeTool=allTools.find(t=>t.id===tool)!;
 const selectedVector=layer.operations.find(o=>o.kind==='vector'&&o.id===vectorId) as VectorLine|undefined;
 const displayStatus=documentDirty(doc,saved.current)&&!['Saving…','Save failed'].includes(status)?'Unsaved changes':status;
 audioActionDelegates.current={
  toggle:()=>{
   if(!audioTrackOpen)setLayout(old=>({...old,bottomClosed:false}));
   setAudioTrackOpen(o=>!o);
  },importClip:file=>{void addSceneAudio(file);},
  remove:removeSceneAudio,mute:setAudioMuted,seek:seekSceneAudio
 };
 panelDelegates.current={brushChange:setBrushLibrary,choose:chooseTool,notice:notify};
 motionPointEditDelegate.current=(arcId,frameId,x,y)=>updateMotionPoint(arcId,frameId,x,y,'Drag motion point');
 motionDotAddDelegate.current=(arcId,x,y)=>{
  const p=store.getSnapshot();if(operationLock.current||engine.current?.drawing){notify('Finish drawing before adding a path dot.');return;}
  const result=addMotionControlDot(p,arcId,x,y);
  if(result.project===p){notify('Could not add a dot here. Tap between existing dots (maximum 16).');return;}
  store.commit(result.project,'Add motion path dot');
  // Stay in Add Dot mode: one click enables placing many dots until Esc or mode toggle.
  setSelectedMotionDotId(result.dotId??'');
 };
 motionDotMoveDelegate.current=(arcId,dotId,dx,dy,frameId)=>{
  const p=store.getSnapshot();if(operationLock.current||engine.current?.drawing){notify('Finish drawing before editing a path dot.');return;}
  const result=moveMotionControlDot(p,arcId,dotId,dx,dy,frameId);
  if(result.project===p){notify('Path dot unchanged, or a bound frame is held, linked or locked.');return;}
  if(playback.current?.running&&editPathWhilePlaying)playback.current.refreshMotionEdit(result.project);
  engine.current?.clearSelection();store.commit(result.project,'Move motion path dot');
 };
 const setTransformValues=(patch:Partial<typeof transform>)=>{const next={...transform,...patch};setTransform(next);engine.current?.setTransform(next);};
 function openBatchTransform(){setAddingMotionDot(false);stopPlayback();setWorkspaceMode('ANIMATE');setRightTab('batch-transform');setLayout(old=>({...old,rightClosed:false,bottomClosed:false}));}
 function applyBatchTransform(values:BatchTransformValues){
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before transforming cels.');return;}
  const previous=store.getSnapshot();const ids=selectedFrames.ids.filter(id=>frameList(previous).some(f=>f.id===id));
  const layers=selectedLayers.ids.length?selectedLayers.ids:[previous.activeLayerId];
  const result=batchTransformCels(previous,ids,layers,values);
  if(result.project===previous){notify(result.reason??'Nothing changed.');return;}
  engine.current?.cancelGesture();engine.current?.clearSelection();store.commit(result.project,'Multi-Cel Transform');
  notify(`Transformed ${result.changed} drawing cels. Control+Z restores them together.`);
 }
 function applyProgressiveScale(factors:Record<string,number>):string|null{
  if(operationLock.current||engine.current?.drawing){const reason='Finish drawing before applying Depth Scale.';notify(reason);return reason;}
  const previous=store.getSnapshot(),ids=selectedFrames.ids.filter(id=>frameList(previous).some(f=>f.id===id));
  const layers=selectedLayers.ids.length?selectedLayers.ids:[previous.activeLayerId];
  const result=progressiveScaleFrameFactors(previous,ids,layers,factors);
  if(result.project===previous){const reason=result.reason??'Nothing changed.';notify(reason);return reason;}
  engine.current?.cancelGesture();engine.current?.clearSelection();store.commit(result.project,'Progressive Depth Scale');
  setBatchCanvasMode(null);
  notify(`Resized ${result.changed} cels with uniform proportions. Control+Z restores them.`);
  return null;
 }
 function openMotionPlanning(){setMotionToolsOpen(true);setWorkspaceMode('ANIMATE');setRightTab(old=>old==='motion'?'inspector':'motion');setLayout(old=>({...old,rightClosed:false}));}
 function updateMotionData(next:Project,label:string){
  const before=store.getSnapshot();if(next===before)return;
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before editing motion guides.');return;}
  store.commit(next,label);
 }
 function quickCreateMotionPath(start:number,end:number){
  const p=store.getSnapshot();
  if(operationLock.current||engine.current?.drawing){notify('Finish the stroke first.');return;}
  const selected=engine.current?.strokeIds??[];
  const result=createQuickMotionPath(p,start,end,selected);
  if(result.project===p){notify(result.reason??'Could not create the path. Select the ball with S on its drawing layer.');return;}
  engine.current?.clearSelection();
  store.commit(result.project,'Create Motion Path');
  setActiveMotionArcId(result.project.motionPlanning!.arcs.at(-1)!.id);
  setMotionArcEditing(true);setAddingMotionDot(false);setSelectedMotionDotId('');
  notify(result.skipped?`Created a path for ${result.bound} frames. ${result.skipped} frame(s) were skipped to protect other artwork. See Advanced or put the moving part on its own layer.`:`Motion path ready for ${result.bound} frames! Drag its teal curve or point to adjust. Control+Z to undo.`);
 }
 function bindSelectedMotionStrokes(id:string){
  const p=store.getSnapshot(),selected=engine.current?.strokeIds??[];
  if(!selected.length){notify('Press S and select your ball strokes first.');return;}
  const frameId=frameList(p)[currentFrameIndex(p)].id,next=bindArcStrokes(p,id,frameId,selected);
  if(next===p){notify('Could not bind: select strokes on the arc layer in an unlocked, independent drawing cel.');return;}
  updateMotionData(next,'Bind selected strokes to arc');notify('Selected strokes bound to this motion arc for the current frame.');
 }
 function bindMotionLayerRange(id:string,start:number,end:number){
  const p=store.getSnapshot(),next=bindArcLayerRange(p,id,start,end);
  if(next===p){notify('No independent drawable cels found. Check the layer, hold/links, and frame range.');return;}
  updateMotionData(next,'Bind layer cels to arc');notify('Drawing cels bound. Only the arc layer’s brush/vector strokes will move.');
 }
 function applyMotionArc(id:string){
  const p=store.getSnapshot();if(operationLock.current||engine.current?.drawing){notify('Finish drawing before applying the arc.');return;}
  const result=alignBoundDrawingsToArc(p,id);
  if(!result.moved){notify('No drawings moved. Check that two path points cover your bound, editable frames; held/linked cels are protected.');return;}
  engine.current?.clearSelection();store.commit(result.project,'Move bound drawings onto motion arc');notify(`Moved drawings on ${result.moved} frames. Control+Z undoes the whole move.`);
 }
 function updateMotionPoint(id:string,frameId:string,x:number,y:number,label='Adjust motion path'){
  const p=store.getSnapshot();
  if(operationLock.current||engine.current?.drawing){notify('Finish drawing before editing the motion path.');return;}
  const result=editMotionPath(p,id,frameId,x,y);
  if(result.project===p){notify('Motion point unchanged or a bound drawing is held/linked/locked.');return;}
  // Only an explicitly permitted motion edit can refresh playback in place.
  // No raster work is done for intermediate pen movements.
  if(playback.current?.running&&editPathWhilePlaying)playback.current.refreshMotionEdit(result.project);
  engine.current?.clearSelection();store.commit(result.project,label);
 }
 function removeSelectedMotionDot(arcId:string,dotId:string){
  const p=store.getSnapshot();if(operationLock.current||engine.current?.drawing){notify('Finish drawing before removing a path dot.');return;}
  const result=removeMotionControlDot(p,arcId,dotId,frameList(p)[currentFrameIndex(p)].id);
  if(result.project===p){notify('Could not remove the selected dot.');return;}
  if(playback.current?.running&&editPathWhilePlaying)playback.current.refreshMotionEdit(result.project);
  engine.current?.clearSelection();store.commit(result.project,'Remove motion path dot');setSelectedMotionDotId('');
 }
 function captureMotionPoint(id:string){
  const current=store.getSnapshot(),arc=current.motionPlanning?.arcs.find(a=>a.id===id);
  const layer=current.layers.find(l=>l.id===arc?.layerId);
  const selectedIds=new Set(engine.current?.strokeIds??[]);
  const selected=layer?selectable(layer).filter(op=>selectedIds.has(op.id)):[];
  const frameId=frameList(current)[currentFrameIndex(current)].id;
  const boundIds=new Set(arc?.bindings?.find(b=>b.frameId===frameId)?.operationIds??[]);
  // When a hand is already bound, Capture must use only that hand—not the entire character.
  const bound=layer?selectable(layer).filter(op=>boundIds.has(op.id)):[];
  // Once bound, prefer that hand's strokes, not another selected character.
  const chosen=bound.length?(selected.some(op=>boundIds.has(op.id))?selected.filter(op=>boundIds.has(op.id)):bound):selected;
  const bounds=boundsOf(chosen);
  const position=bounds?{x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2}:arc?.layerId===current.activeLayerId?activeLayerArtworkCenter(current):null;
  if(!position){notify('Select the ball with S on the arc layer or choose the arc’s layer and draw first.');return;}
  updateMotionPoint(id,frameId,position.x,position.y,'Capture motion point');
 }
 const menus:Record<string,{label:string;action:()=>void;disabled?:boolean}[]>={
  File:[{label:'Close Project · Ctrl+W',disabled:!tabIds.length,action:()=>{if(activeTabId.current)requestCloseProject(activeTabId.current);}},{label:'Project Home…',action:()=>void showOnboarding()},{label:'New Project…',action:startNew},{label:'Open / Manage Projects · Ctrl+Alt+O',action:()=>void listProjects()},{label:'Place Image…',action:()=>imageInput.current?.click()},{label:'Import backup…',action:()=>fileInput.current?.click()},{label:'Save · Ctrl/⌘ S',action:()=>void save()},{label:'Save As…',action:beginSaveAs},{label:'Download editable backup',action:()=>downloadProject(doc)},{label:'Recover snapshot…',action:()=>void showSnapshots()},{label:'Rename project…',action:()=>{setName(doc.name);setModal('rename');}},{label:'Export PNG',action:showExport},{label:'Export animation PNG sequence…',action:()=>setModal('sequence')}],
  Select:[{label:'Stroke Select · S',action:()=>chooseTool('stroke-select')},{label:'Lasso · L',action:()=>chooseTool('lasso')},{label:'Rectangle · M',action:()=>chooseTool('rectangle')},{label:'Select All · Ctrl/⌘ A',action:()=>void editing('all')},{label:'Deselect · Ctrl/⌘ D',action:()=>void editing('deselect')}],
  Tools:[{label:'Brush · B',action:()=>chooseTool('brush')},{label:'Vector Pen · N',action:()=>chooseTool('vector')},{label:'Eraser · E',action:()=>chooseTool('eraser')},{label:'Fill · G',action:()=>chooseTool('fill')},{label:'Eyedropper · I',action:()=>chooseTool('eyedropper')}],
  Transform:[{label:'Free Transform · T',action:()=>chooseTool('transform')},{label:'Move · V',action:()=>chooseTool('transform')},{label:'Multi-Cel Transform · Shift+T',action:openBatchTransform}],
  Edit:[{label:'Undo · Ctrl/⌘ Z',action:undo,disabled:!store.canUndo},{label:'Redo · Ctrl/⌘ Shift Z / Y',action:redo,disabled:!store.canRedo},...([['Select All · Ctrl/⌘ A','all'],['Deselect · Ctrl/⌘ D','deselect'],['Cut · Ctrl/⌘ X','cut'],['Copy · Ctrl/⌘ C','copy'],['Paste · Ctrl/⌘ V','paste']] as const).map(([label,command])=>({label,action:()=>void editing(command)})),...allTools.map(t=>({label:t.name+' · '+shortcuts[t.id].toUpperCase(),action:()=>chooseTool(t.id)})),{label:'Keyboard shortcuts…',action:()=>setModal('settings')}],
  View:[{label:outsideFrameLabel,action:toggleOutsideFrame,disabled:busy||sequenceBusy},{label:(focusMode?'Exit Canvas Focus Mode':'Canvas Focus Mode')+' · F9',action:()=>{setFocusMode(v=>!v);setOnionSettingsOpen(false);}},{label:'Compact timeline',action:()=>{setFocusMode(false);setLayout(old=>({...old,bottomClosed:false,bottom:160}));}},{label:'Fit canvas · F',action:()=>engine.current?.fit()},{label:'Reset rotation · Shift+R',action:()=>engine.current?.rotate(0)},{label:'Reset view · 100%',action:()=>engine.current?.reset()},{label:(doc.settings.guides?'Hide':'Show')+' frame guides',action:()=>commit({...doc,settings:{...doc.settings,guides:!doc.settings.guides}})},{label:'Toggle left panel',action:()=>setLayout({...layout,leftClosed:!layout.leftClosed})},{label:'Toggle inspector',action:()=>setLayout({...layout,rightClosed:!layout.rightClosed})},{label:'Toggle timeline region',action:()=>setLayout({...layout,bottomClosed:!layout.bottomClosed})}],
  Layer:[{label:'Add layer',action:()=>{if(doc.layers.length>=100){notify('Projects support up to 100 layers.');return;}const l=newLayer('Layer '+(doc.layers.length+1));commit({...doc,layers:[l,...doc.layers],activeLayerId:l.id});}},{label:'Rename layer',action:()=>{setRenameId(layer.id);setRenameValue(layer.name);}},{label:'Duplicate layer',action:()=>commit(duplicateLayer(doc,layer.id))},{label:'Delete layer…',action:()=>{if(window.confirm('Delete “'+layer.name+'”? You can undo this.'))commit(removeLayer(doc,layer.id));},disabled:doc.layers.length===1},{label:'Merge Down',action:()=>void editing('merge'),disabled:doc.layers.at(-1)?.id===layer.id||layer.locked||frameList(doc).length>1},{label:'Clear Layer',action:()=>void editing('clear'),disabled:layer.locked}],
  Animation:[{label:(timelineView==='xsheet'?'Hide side Xsheet':'Show side Xsheet')+' · '+shortcuts.xsheet.toUpperCase(),action:toggleXsheetView},{label:'New blank frame · F6',action:()=>animationAction('add')},{label:'Duplicate current frame · F7',action:()=>animationAction('duplicate')},{label:'Delete selected frame · Delete/⌫ (when frame focused) or Shift+F7',action:()=>animationAction('delete'),disabled:frameList(doc).length<=1},{label:'Previous frame · Page Up',action:()=>stepDrawingFrame(-1)},{label:'Next frame · Page Down',action:()=>stepDrawingFrame(1)},{label:'Flip previous · ,',action:()=>toggleFlipPreview(-1)},{label:'Flip next · .',action:()=>toggleFlipPreview(1)},{label:'Drawing Substitution Shelf · '+shortcuts.substitutionShelf.toUpperCase(),action:openSubstitutionShelf},{label:'Linked Drawings & Cycles · '+shortcuts.reuseShelf.toUpperCase(),action:openReuseShelf},{label:'Link current drawing · '+shortcuts.linkCel.toUpperCase(),action:linkDrawingShortcut},{label:'Unlink current drawing · '+shortcuts.unlinkCel.toUpperCase(),action:unlinkDrawing},{label:'Timing Notes & Motion Path Assist · '+shortcuts.motionPlanning.toUpperCase(),action:openMotionPlanning},{label:'Multi-Cel Transform · '+shortcuts.batchTransform.toUpperCase(),action:openBatchTransform},{label:'Toggle onion skin · O',action:()=>{/* onion toggle */}},{label:'Audio waveform · '+shortcuts.audioTrack.toUpperCase(),action:()=>{setAudioTrackOpen(o=>!o);setWorkspaceMode('ANIMATE');setLayout(old=>({...old,bottomClosed:false}));}},{label:'Advanced Light Table · '+shortcuts.lightTable.toUpperCase(),action:toggleLightTablePanel},{label:'Pin / unpin current drawing · '+shortcuts.pinLightTable.toUpperCase(),action:pinLightTableFromShortcut},],
  Window:[{label:'Keyboard & workspace settings…',action:()=>setModal('settings')},{label:'History panel',action:()=>{setRightTab('history');setLayout({...layout,rightClosed:false});}},{label:'Pop out / return Tool Wheel · Shift+W',action:()=>window.dispatchEvent(new Event('solo:wheel-popout-toggle'))},{label:'Reset panel layout',action:()=>{setFocusMode(false);setLayout({left:232,right:280,bottom:160,leftClosed:false,rightClosed:false,bottomClosed:false});}}],
  Help:[{label:'Drawing Bug Recorder',action:()=>{setRightTab('recorder');setLayout(old=>({...old,rightClosed:false}));}},{label:'Drawing Diagnostics (developer)…',action:()=>{setRightTab('diagnostics');setLayout(old=>({...old,rightClosed:false}));}},{label:'Drawing studio guide',action:()=>setModal('help')},{label:'Welcome / recovery…',action:()=>void showOnboarding()},{label:'Milestone roadmap',action:()=>setModal('roadmap')},{label:'About Solo Anime Studio',action:()=>setModal('about')}]
 };
 const timelineTools=[
  {id:"Navigation",control:<div className="timeline-actions"><IconButton label="Previous drawing frame (Page Up)" disabled={busy||currentFrameIndex(doc)===0} onClick={()=>stepDrawingFrame(-1)}><SkipBack size={15}/></IconButton><IconButton label="Next drawing frame (Page Down)" disabled={busy||currentFrameIndex(doc)===frameList(doc).length-1} onClick={()=>stepDrawingFrame(1)}><SkipForward size={15}/></IconButton><IconButton label="Duplicate current drawing frame (F7)" disabled={busy||frameList(doc).length>=MAX_DRAWING_FRAMES} onClick={()=>animationAction('duplicate')}><Copy size={14}/></IconButton><IconButton label="Delete current drawing frame (Delete/⌫ after clicking the frame, or Shift+F7)" disabled={busy||frameList(doc).length<=1} onClick={()=>animationAction('delete')}><Trash2 size={14}/></IconButton><IconButton label="Stop playback and return to active drawing" disabled={playbackUpdate.state==='stopped'} onClick={stopPlayback}><Square size={13}/></IconButton></div>},
  {id:"FPS & Loop",control:<div className="playback-controls">
   <label className="playback-fps-label">FPS
    <input key={fps} type="number" min={PLAYBACK_FPS_MIN} max={PLAYBACK_FPS_MAX} step="1" defaultValue={fps} aria-label="Playback frames per second"
     onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}else if(e.key==='Escape'){e.stopPropagation();e.currentTarget.value=String(fps);e.currentTarget.blur();}}}
     onBlur={e=>{const value=Number(e.currentTarget.value);if(Number.isInteger(value)&&value>=PLAYBACK_FPS_MIN&&value<=PLAYBACK_FPS_MAX)setFps(value);else e.currentTarget.value=String(fps);}}/>
   </label>
   <label className="playback-loop-label"><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/> Loop</label>
  </div>},
  {id:"Hold length",control:<div className="exposure-controls" aria-label="Frame hold duration controls">
      <span className="exposure-label">HOLD</span>
      <IconButton label="Reduce hold by one frame (Shift+[)" disabled={busy||frameHold(frameList(doc)[currentFrameIndex(doc)])<=1} onClick={()=>changeHold(frameHold(frameList(doc)[currentFrameIndex(doc)])-1)}>−</IconButton>
      <input key={frameList(doc)[currentFrameIndex(doc)].id+':'+frameHold(frameList(doc)[currentFrameIndex(doc)])}
       type="number" min="1" max={MAX_FRAME_HOLD} step="1"
       aria-label="Hold current drawing for N frames" title="How many frames to show this drawing (1–24)"
       defaultValue={frameHold(frameList(doc)[currentFrameIndex(doc)])}
       disabled={busy}
       onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}else if(e.key==='Escape'){e.stopPropagation();e.currentTarget.value=String(frameHold(frameList(doc)[currentFrameIndex(doc)]));e.currentTarget.blur();}}}
       onBlur={e=>{const value=Number(e.currentTarget.value);if(Number.isInteger(value)&&value>=1&&value<=MAX_FRAME_HOLD)changeHold(value);else e.currentTarget.value=String(frameHold(frameList(doc)[currentFrameIndex(doc)]));}}/>
      <IconButton label="Increase hold by one frame (Shift+])" disabled={busy||frameHold(frameList(doc)[currentFrameIndex(doc)])>=MAX_FRAME_HOLD} onClick={()=>changeHold(frameHold(frameList(doc)[currentFrameIndex(doc)])+1)}>+</IconButton>
      <span className="exposure-unit">frames</span>
     </div>},
  {id:"Flip preview",control:<div className="flipbook-controls" aria-label="Flipbook quick previews">
      <span className="flipbook-label">FLIP</span>
      <IconButton label="Flipbook: click to toggle previous drawing; hold comma (,) to preview" active={flipPreview===-1} disabled={busy||currentFrameIndex(doc)===0} onClick={()=>toggleFlipPreview(-1)}><ChevronsLeft size={15}/></IconButton>
      <IconButton label="Flipbook: click to toggle next drawing; hold period (.) to preview" active={flipPreview===1} disabled={busy||currentFrameIndex(doc)===frameList(doc).length-1} onClick={()=>toggleFlipPreview(1)}><ChevronsRight size={15}/></IconButton>
      {flipPreview!==null&&<span className="flipbook-status">PREVIEW</span>}
     </div>},
  {id:"Onion Skin",control:<div className="onion-controls" aria-label="Onion skin controls">
      <IconButton label={onionSettings.enabled?'Hide onion skin (O)':'Show onion skin (O)'} active={onionSettings.enabled} onClick={()=>setOnionSettings(s=>({...s,enabled:!s.enabled}))}>{onionSettings.enabled?<Eye size={15}/>:<EyeOff size={15}/>}</IconButton>
      <IconButton label="Onion skin settings" active={onionSettingsOpen} onClick={()=>{if(!onionSettingsOpen&&timelineMenu.current)timelineMenu.current.open=true;setOnionSettingsOpen(o=>!o);}}><SlidersHorizontal size={14}/></IconButton>
      {onionSettingsOpen&&<div className="onion-settings" role="group" aria-label="Onion skin settings">
       <strong>ONION SKIN</strong><p>Ghosts are only guides. They are never saved into your drawings.</p>
       <label className="onion-check"><input type="checkbox" checked={onionSettings.previous} onChange={e=>setOnionSettings(s=>({...s,previous:e.target.checked}))}/><span className="onion-swatch previous"/> Previous drawing</label>
       <label className="onion-count-row">Previous frames <select aria-label="Number of previous onion skin frames" value={onionSettings.previousCount} onChange={e=>setOnionSettings(s=>({...s,previousCount:+e.target.value}))}>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
       <Range label="Previous opacity" value={onionSettings.previousOpacity} unit="%" onChange={previousOpacity=>setOnionSettings(s=>({...s,previousOpacity}))}/>
       <label className="onion-check"><input type="checkbox" checked={onionSettings.next} onChange={e=>setOnionSettings(s=>({...s,next:e.target.checked}))}/><span className="onion-swatch next"/> Next drawing</label>
       <label className="onion-count-row">Next frames <select aria-label="Number of next onion skin frames" value={onionSettings.nextCount} onChange={e=>setOnionSettings(s=>({...s,nextCount:+e.target.value}))}>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
       <Range label="Next opacity" value={onionSettings.nextOpacity} unit="%" onChange={nextOpacity=>setOnionSettings(s=>({...s,nextOpacity}))}/>
       <label className="onion-check"><input type="checkbox" checked={onionSettings.currentLayerOnly} onChange={e=>setOnionSettings(s=>({...s,currentLayerOnly:e.target.checked}))}/> Current drawing layer only</label>
       <small>Press O to toggle. Color ghosts follow the canvas when you zoom or pan.</small>
      </div>}
     </div>},
  {id:"Light Table",control:<div className="light-table-controls" aria-label="Light table controls">
      <IconButton label={'Pin or unpin current drawing as a read-only light-table reference ('+shortcuts.pinLightTable.toUpperCase()+')'} active={lightTablePins.some(pin=>pin.frameId===frameList(doc)[currentFrameIndex(doc)].id)} onClick={pinLightTableFromShortcut}><Plus size={13}/></IconButton>
      <button className={'light-table-toggle'+(lightTablePins.length?' light-table-pinned':'')} type="button" title={'Toggle Advanced Light Table ('+shortcuts.lightTable.toUpperCase()+')'} onClick={toggleLightTablePanel} aria-expanded={lightTableOpen}>LIGHT TABLE ({lightTablePins.length})</button>
      {lightTableOpen&&<div className="light-table-panel" role="group" aria-label="Pinned light table drawings">
       <strong>PINNED DRAWINGS</strong><p>Pin up to five drawings, including non-adjacent poses. Overlays are never exported or painted onto the cel.</p>
       <button className="light-table-add" disabled={lightTablePins.length>=MAX_LIGHT_TABLE_PINS&&!lightTablePins.some(pin=>pin.frameId===frameList(doc)[currentFrameIndex(doc)].id)} onClick={pinLightTableFromShortcut}>{lightTablePins.some(pin=>pin.frameId===frameList(doc)[currentFrameIndex(doc)].id)?'Unpin current drawing':'Pin current drawing'}</button>
       {sanitizeLightTablePins(doc,lightTablePins).map(pin=>{const index=frameList(doc).findIndex(f=>f.id===pin.frameId);return <div className="light-table-entry" key={pin.frameId}>
        <div><strong>Drawing {index+1}</strong><button title="Jump to pinned drawing" onClick={()=>goToDrawingFrame(pin.frameId)}>Go to</button><button title="Remove pinned drawing" onClick={()=>setLightTablePins(old=>old.filter(v=>v.frameId!==pin.frameId))}><X size={13}/></button></div>
        <label>Opacity {pin.opacity}%<input type="range" min="0" max="100" step="1" value={pin.opacity} onChange={e=>updateReferencePin(pin.frameId,{opacity:+e.target.value})}/></label>
        <label>Tint<select value={pin.tint} onChange={e=>updateReferencePin(pin.frameId,{tint:e.target.value as LightTablePin['tint']})}><option value="original">Original colors</option><option value="teal">Teal</option><option value="red">Red</option></select></label>
        <label>Scale {Math.round(pin.scale*100)}%<input type="range" min="25" max="250" step="5" value={Math.round(pin.scale*100)} onChange={e=>updateReferencePin(pin.frameId,{scale:+e.target.value/100})}/></label>
        <label>Rotation {pin.angle}°<input type="range" min="-180" max="180" step="5" value={pin.angle} onChange={e=>updateReferencePin(pin.frameId,{angle:+e.target.value})}/></label>
        <div className="light-table-nudge"><span>Shift guide</span><button onClick={()=>updateReferencePin(pin.frameId,{dx:pin.dx-5})}>←</button><button onClick={()=>updateReferencePin(pin.frameId,{dx:pin.dx+5})}>→</button><button onClick={()=>updateReferencePin(pin.frameId,{dy:pin.dy-5})}>↑</button><button onClick={()=>updateReferencePin(pin.frameId,{dy:pin.dy+5})}>↓</button><button onClick={()=>updateReferencePin(pin.frameId,{dx:0,dy:0,scale:1,angle:0})}>Reset</button></div>
       </div>;})}
       {!lightTablePins.length&&<small>No pinned drawings yet. Select a drawing in the timeline and pin it here.</small>}
      </div>}
     </div>},
  {id:"Xsheet",control:<button className="xsheet-switch" aria-pressed={timelineView==='xsheet'} title={'Show / hide side Xsheet ('+shortcuts.xsheet.toUpperCase()+')'} onClick={toggleXsheetView}>{timelineView==='xsheet'?'HIDE XSHEET':'SHOW XSHEET'}</button>},
  {id:"Layer keys",control:<div className="layer-cel-commandbar">
     <span><Layers size={12}/> Independent layer cels</span>
     <button disabled={busy} title="Create a new key drawing from the held picture at this frame (Alt+K)" onClick={()=>newLayerKey(true)}>New layer key</button>
     <button disabled={busy} title="Create a blank drawing only on the current layer (Alt+Shift+K)" onClick={()=>newLayerKey(false)}>Blank layer key</button>
     <button disabled={busy} title="Extend selected layer drawing by one frame (Alt+])" onClick={()=>stepLayerHold(1)}>Hold +</button>
     <button disabled={busy} title="Shorten selected layer drawing by one frame (Alt+[)" onClick={()=>stepLayerHold(-1)}>Hold −</button>
    </div>},
 ];
 return <div className="studio">
  <header className="app-header"><div className="brand"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M5 17 19 3M5 26 27 4M15 28 28 15" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><circle cx="27" cy="27" r="2" fill="currentColor"/></svg><strong>Solo Anime Studio</strong><span className="version-badge" title={"Solo Anime Studio "+buildInfo.version}>v{buildInfo.version}</span></div><nav className="main-menu" aria-label="Main menu">{Object.keys(menus).map(m=><div className="menu-wrap" key={m}><button className={menu===m?'menu-active':''} aria-expanded={menu===m} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();menuButton.current=e.currentTarget;setMenuAnchor({left:Math.max(8,Math.min(r.left,window.innerWidth-288)),top:r.bottom+6});setMenu(menu===m?'':m);}}>{m}</button>{menu===m&&createPortal(<div className="main-menu-layer"><button className="menu-dismiss" aria-label="Close menu" onClick={()=>{setMenu('');menuButton.current?.focus();}}/><div ref={menuPopup} className="dropdown main-menu-popup" aria-label={m+' menu'} style={{left:menuAnchor.left,top:menuAnchor.top,maxHeight:'calc(100dvh - '+(menuAnchor.top+8)+'px)'}} onKeyDown={e=>{const items=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const i=items.indexOf(document.activeElement as HTMLButtonElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setMenu('');menuButton.current?.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const index=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[index]?.focus();}}}>{menus[m].map(item=><button key={item.label} disabled={item.disabled||busy} title={item.label} aria-label={item.label} onClick={()=>{setMenu('');item.action();}}>{item.label.split(' · ')[0]}</button>)}</div></div>,document.body)}</div>)}</nav><div className="header-actions"><span className={'save-status '+(displayStatus==='Save failed'?'error':'')}><i/>{displayStatus}</span><IconButton label="Settings and shortcuts" onClick={()=>setModal('settings')}><Settings size={17}/></IconButton><button className="export-button" onClick={showExport} disabled={busy}><Download size={15}/>Export PNG</button></div></header>
  <div className="workspace-bar"><div className="workspace-tabs"><button className={workspaceMode==='DRAW'?'active':''} aria-pressed={workspaceMode==='DRAW'} title="Draw workspace: artwork tools and a larger canvas; your selected animation cel is not changed" onClick={()=>{stopPlayback();clearFlipPreview();setOnionSettingsOpen(false);setFocusMode(false);setWorkspaceMode('DRAW');}}>DRAW<span/></button><button className={workspaceMode==='ANIMATE'?'active':''} aria-pressed={workspaceMode==='ANIMATE'} title="Animate workspace: drawing tools plus layer cels, holds, onion skin, flipbook and playback" onClick={()=>{setWorkspaceMode('ANIMATE');setFocusMode(false);setLayout(old=>({...old,bottomClosed:false}));}}>ANIMATE<span/></button><button type="button" className={'workspace-focus-button'+(focusMode?' selected':'')} title={focusMode?'Show Timeline and panels again · F9':'Hide Timeline and panels for more drawing space · F9'} aria-label={focusMode?'Exit Canvas Focus Mode (F9)':'Focus Canvas (F9)'} aria-pressed={focusMode} onClick={()=>{setFocusMode(v=>!v);setOnionSettingsOpen(false);}}>{focusMode?<Minimize2 size={14}/>:<Maximize2 size={14}/>}<span>{focusMode?'EXIT FOCUS':'FOCUS CANVAS'}</span></button>{['CHARACTERS','CLEANUP','COMPOSE'].map(t=><button disabled key={t} title="Planned in a later milestone">{t}<span className="planned-dot"/></button>)}</div><div className="scene-info"><Folder size={13}/><span>{doc.name}</span><ChevronDown size={12}/><span className="vertical-divider"/><button title="New project resolution" onClick={startNew}>{frameSize.width} × {frameSize.height}<ChevronDown size={12}/></button></div><span className="milestone-label">MILESTONE 02 <span>Layer Cels</span></span></div>
  <div ref={workbench} onDragOver={event=>{if([...event.dataTransfer.items].some(item=>item.kind==='file'&&item.type.startsWith('image/'))){event.preventDefault();event.dataTransfer.dropEffect='copy';}}} onDrop={event=>{const file=[...event.dataTransfer.files].find(item=>item.type.startsWith('image/'));if(file){event.preventDefault();importSceneImage(file);}}} className={'workbench '+(workspaceMode==='DRAW'?'draw-workspace-mode ':'animate-workspace-mode ')+(focusMode?'canvas-focus-mode':'')} style={{'--left-width':layout.leftClosed?'42px':layout.left+'px','--right-width':layout.rightClosed?'42px':layout.right+'px','--timeline-height':layout.bottomClosed?'35px':layout.bottom+'px'} as React.CSSProperties}>
   <aside className={'left-panel '+(layout.leftClosed?'panel-closed':'')}>
    {layout.leftClosed?<div className="collapsed-tool-rail" role="toolbar" aria-label="Collapsed project and drawing tools">
      <IconButton label="Expand project and layers panel" onClick={()=>setLayout(old=>({...old,leftClosed:false}))}><PanelLeftOpen size={17}/></IconButton>
      <span className="rail-divider"/>
      {toolRegistry.filter(t=>t.group==='draw'||t.id==='stroke-select').map(t=><IconButton key={t.id} label={t.name+' ('+t.key+')'} tooltip={t.name+' · '+(shortcuts[t.id as ShortcutCommand]?.toUpperCase()??t.key)} active={tool===t.id} onClick={()=>chooseTool(t.id)}><t.icon size={17}/></IconButton>)}
      <span className="rail-divider"/>
      <IconButton label="Open layers panel" onClick={()=>setLayout(old=>({...old,leftClosed:false}))}><Layers size={17}/></IconButton>
     </div>:<>
     <div className="panel-heading"><span>PROJECT</span><div><IconButton label="New Project" onClick={startNew}><Plus size={16}/></IconButton><IconButton label="Collapse project panel" onClick={()=>setLayout({...layout,leftClosed:true})}><PanelLeftClose size={15}/></IconButton></div></div>
     <div className="project-content"><div className="project-title"><Folder size={15}/><span>{doc.name}</span></div><button className="scene-row" onClick={()=>{setName(doc.name);setModal('rename');}}><ChevronRight size={13}/><span className="scene-icon"><Film size={15}/></span><span>Scene 01 <small>Drawing scene</small></span><span className="scene-dot"/></button><button className="subtle-button" onClick={()=>void listProjects()}><FolderOpen size={13}/>Open local project</button></div>
     <div id="tool-wheel-home" className="tool-wheel-home"/>
     <div className="panel-heading layer-heading"><span>LAYERS <small>{doc.layers.length}</small></span><div><IconButton label="Add layer" onClick={menus.Layer[0].action} disabled={busy}><Plus size={17}/></IconButton><IconButton label="Duplicate layer" onClick={()=>commit(duplicateLayer(doc,layer.id))} disabled={busy}><Copy size={14}/></IconButton><IconButton label="Delete active layer" onClick={menus.Layer[3].action} disabled={doc.layers.length===1||busy}><Trash2 size={14}/></IconButton></div></div>
     <div className="layer-options"><select aria-label="Layer blend mode" value={layer.blend??'normal'} onChange={e=>commit(editLayer(doc,layer.id,{blend:e.target.value as NonNullable<typeof layer.blend>}))}>{['normal','multiply','screen','overlay','add'].map(mode=><option key={mode} value={mode}>{mode[0].toUpperCase()+mode.slice(1)}</option>)}</select><label>Opacity<input aria-label="Layer opacity" type="number" min="0" max="100" value={Math.round(layer.opacity*100)} onChange={e=>{const n=Math.max(0,Math.min(100,+e.target.value));commit(editLayer(doc,layer.id,{opacity:n/100}));}}/>%</label></div>
     <div className="layers-list">{doc.layers.map(l=><div className={'layer-row '+(doc.activeLayerId===l.id?'active':'')+(layerSelectionSet.has(l.id)?' multi-selected':'')+(!l.visible?' hidden-layer':'')} key={l.id}>
      <IconButton label={(l.visible?'Hide ':'Show ')+l.name} onClick={()=>commit(editLayer(doc,l.id,{visible:!l.visible}))}>{l.visible?<Eye size={15}/>:<EyeOff size={15}/>}</IconButton>
      <button className="layer-select" aria-label={'Select '+l.name} aria-pressed={layerSelectionSet.has(l.id)||doc.activeLayerId===l.id} onClick={e=>{if(busy)return;selectLayerWithModifier(l.id,e.shiftKey,e.altKey);engine.current?.cancelGesture();store.select(l.id);}} onDoubleClick={()=>{setRenameId(l.id);setRenameValue(l.name);}}><span className={'layer-thumbnail '+(l.operations.length?'has-art':'')}><Layers size={15}/></span><span>{l.name}<small>{l.operations.length?l.operations.length+' operations':'Empty layer'}</small></span></button>
      <IconButton label={(l.locked?'Unlock ':'Lock ')+l.name} onClick={()=>commit(editLayer(doc,l.id,{locked:!l.locked}))}>{l.locked?<Lock size={13}/>:<Unlock size={13}/>}</IconButton>
     </div>)}</div>
     <div className="layer-bottom"><div><IconButton label="Move layer up" onClick={()=>commit(reorderLayer(doc,layer.id,-1))} disabled={doc.layers[0].id===layer.id}><ArrowUp size={15}/></IconButton><IconButton label="Move layer down" onClick={()=>commit(reorderLayer(doc,layer.id,1))} disabled={doc.layers.at(-1)!.id===layer.id}><ArrowDown size={15}/></IconButton></div><button onClick={()=>{setRenameId(layer.id);setRenameValue(layer.name);}}>Rename layer</button></div>
     <div className="local-notice"><span className="local-icon"><Save size={15}/></span><div>Made here. Saved here.<small>Local autosave · every 2.5 seconds after edits</small></div></div>
    </>}
   </aside><div className="panel-resizer left-resizer" role="separator" aria-label="Resize project panel" onPointerDown={e=>resizePanel(e,'left')}/>
   <main className="center-panel"><ProjectTabs tabs={tabIds.map(id=>{const session=sessions.current.get(id)!,project=id===activeTabId.current?doc:session.history.project;return {id,name:project.name,dirty:documentDirty(project,id===activeTabId.current?saved.current:session.saved)};})} activeId={activeTabId.current} disabled={busy||sequenceBusy||closingTab} onSelect={id=>void selectProjectTab(id)} onClose={requestCloseProject} onNew={startNew} onOpen={()=>void listProjects()} onHome={()=>void showOnboarding()}/><div className="canvas-tabbar"><span className="canvas-workspace-label">{workspaceMode==='DRAW'?'ILLUSTRATION':'ANIMATION'}</span><div className="canvas-controls"><MirrorControls engine={engineReady}/><IconButton label="Undo" onClick={undo} disabled={!store.canUndo||busy}><Undo2 size={15}/></IconButton><IconButton label="Redo" onClick={redo} disabled={!store.canRedo||busy}><Redo2 size={15}/></IconButton><span className="vertical-divider"/><CameraZoom camera={camera} engine={engineReady} outside={showingOutside}/><button title="Reset rotation" aria-label="Reset rotation" onClick={()=>engine.current?.rotate(0)}>0°</button><IconButton label="Fit canvas" onClick={()=>engine.current?.fit()}><Maximize size={15}/></IconButton><IconButton label="Reset view" onClick={()=>engine.current?.reset()}><RotateCcw size={15}/></IconButton><button type="button" className={"canvas-focus-tab-action "+(focusMode?"selected":"")} title={focusMode?"Exit Canvas Focus Mode · F9":"Focus Canvas · F9"} aria-label={focusMode?"Exit Canvas Focus Mode (F9)":"Focus Canvas (F9)"} aria-pressed={focusMode} onClick={()=>{setFocusMode(v=>!v);setOnionSettingsOpen(false);}}>{focusMode?<Minimize2 size={14}/>:<Maximize2 size={14}/>}<span>{focusMode?"Exit Focus":"Focus"}</span></button><button type="button" className={"outside-frame-button "+(showingOutside?"selected":"")} title={outsideFrameLabel} onClick={toggleOutsideFrame} disabled={busy||sequenceBusy}>{outsideFrameLabel}</button><CameraAngle camera={camera} engine={engineReady}/></div></div>
    <div className={'canvas-xsheet-row'+(timelineView==='xsheet'?' has-side-xsheet':'')+(xsheetSide==='left'?' xsheet-left':' xsheet-right')}>
    <div className="drawing-workspace" ref={workspace}
     onPointerDownCapture={e=>{
      if(e.target!==canvas.current)return;
      if(playback.current?.active){e.preventDefault();e.stopPropagation();stopPlayback();return;}
      const studio=engine.current;
      if(!studio||!maskOutside||e.button!==0||studio.space||tool==='hand'||tool==='zoom'||tool==='rotate')return;
      const rect=e.currentTarget.getBoundingClientRect(),shot=shotFrame(doc);
      const frame=cameraAt(doc.camera?.enabled?doc.camera:undefined,cameraExposure,shot.width,shot.height,shot.x,shot.y);
      const point=toProject({x:e.clientX-rect.left,y:e.clientY-rect.top},studio.view);
      const angle=frame.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),dx=point.x-frame.x,dy=point.y-frame.y;
      if(Math.abs(dx*cos+dy*sin)*frame.zoom>shot.width/2||Math.abs(dy*cos-dx*sin)*frame.zoom>shot.height/2){
       e.preventDefault();e.stopPropagation();
      }
     }}>
     <canvas ref={canvas} className={'drawing-canvas tool-'+tool+(tool==='stroke-select'?' stroke-mode-'+strokeMode:tool==='transform'?' area-transform-mode-'+areaTransformMode:'')} aria-label="Drawing canvas" tabIndex={0} onContextMenu={event=>{ /* Prevent Chrome Save image / Inspect / extension menus during Wacom drawing. */ event.preventDefault(); }}/>
     {(tool==='transform'||tool==='stroke-select'&&advancedStrokeTransform)&&engineReady&&!busy&&<TransformOverlay engine={engineReady} view={view} scope={{frameIds:multiCelAvailable?selectedFrames.ids:[],layerIds:multiCelAvailable?selectedLayers.ids:[]}} keyDelegate={transformHotkeyRef} onCancel={()=>{if(tool==='stroke-select'){setAdvancedStrokeTransform(false);}else{engine.current?.clearSelection();chooseTool('brush');}}} onMessage={notify}/>}
     {multiCelAvailable&&batchCanvasMode&&batchCanvasMode!=='depth'&&batchCanvasBounds&&!busy&&<BatchCanvasTransform key={batchCanvasMode} view={view} bounds={batchCanvasBounds} mode={batchCanvasMode} onCommit={applyBatchTransform}/>}
     {multiCelAvailable&&batchCanvasMode==='depth'&&depthPreviewFrames.length&&!busy&&<ProgressiveScaleCanvas key={selectedFrames.ids.join('|')+'|'+selectedLayers.ids.join('|')} view={view} frames={depthPreviewFrames} initialFocus={doc.animation?.activeFrameId??''} onFocusFrame={goToDrawingFrame} onApply={applyProgressiveScale} onCancel={()=>setBatchCanvasMode(null)}/>}
     <SceneCameraOverlay project={doc} frame={cameraExposure} view={camera} frameOnly={maskOutside} canMove={!doc.shotFrame||rightTab==='camera'} onMove={moveSceneCamera}/>
     {motionToolsOpen&&rightTab==='motion'&&workspaceMode==='ANIMATE'&&pathVisible&&<MotionArcOverlay planning={doc.motionPlanning} view={view} activeFrameId={frameList(doc)[currentFrameIndex(doc)].id} frameIds={motionFrameIds} activeArcId={doc.motionPlanning?.arcs.some(a=>a.id===activeMotionArcId)?activeMotionArcId:doc.motionPlanning?.arcs.at(-1)?.id} editing={pathEditable} addingDot={addingMotionDot} selectedDotId={selectedMotionDotId} onMovePoint={motionPointEditCallback.current} onAddDot={motionDotAddCallback.current} onMoveDot={motionDotMoveCallback.current} onSelectDot={setSelectedMotionDotId}/>}
     {multiCelAvailable&&tool!=='transform'&&<FloatingTransformPanel id="multi" className="batch-canvas-toolbar" label="Multi-frame canvas transform">
      <strong>{frameSelectionSet.size} FRAMES</strong>
      <button type="button" className={batchCanvasMode==='move'?'active':''} title="W — drag selected drawings together" onClick={()=>{stopPlayback();setBatchCanvasMode('move');}}>W Move</button>
      <button type="button" className={batchCanvasMode==='scale'?'active':''} title="S — drag selected drawing to scale" onClick={()=>{stopPlayback();setBatchCanvasMode('scale');}}>S Scale</button>
      <button type="button" className={batchCanvasMode==='rotate'?'active':''} title="R — drag selected drawing to rotate" onClick={()=>{stopPlayback();setBatchCanvasMode('rotate');}}>R Rotate</button>
      <button type="button" className={batchCanvasMode==='depth'?'active':''} title="D — progressively resize first-to-last drawings without flattening" onClick={()=>{stopPlayback();setBatchCanvasMode('depth');}}>D Depth</button>
      <button type="button" title="Esc — finish batch transform" onClick={()=>{setBatchCanvasMode(null);setSelectedFrames({ids:[],anchor:null});}}>✕</button>
      <small>{batchCanvasMode?batchCanvasMode==='move'?'Drag inside the teal box to move · Control+Z undoes':batchCanvasMode==='scale'?'Drag a teal corner to scale · Control+Z undoes':batchCanvasMode==='depth'?'Choose any selected frame, drag a corner · Auto or Independent · Apply':'Drag the round rotation handle · Control+Z undoes':'Choose W, S, R or D — no panel needed'}</small>
     </FloatingTransformPanel>}
     <div className="canvas-corner-label"><span className="canvas-live-dot"/>{frameSize.width} × {frameSize.height} <span>·</span> {layer.name}</div>
     
     <BugRecordingIndicator engine={engineReady} open={()=>{setRightTab('recorder');setLayout(old=>({...old,rightClosed:false}));}}/>
     {false&&tool==='transform'&&hasSelection&&strokeCount===0&&<FloatingTransformPanel id="area" className="stroke-select-floating area-transform-floating" label="Selection transform tools">
      <span className="stroke-select-title">TRANSFORM</span>
      {([
       {id:'freeform',label:'Free Transform',icon:StudioFreeformIcon,hint:'Combined Move, Scale and Rotate on this selected area'},
       {id:'move',label:'Move',icon:StudioMoveIcon,hint:'Only move the selected drawing'},
       {id:'scale',label:'Scale',icon:StudioScaleIcon,hint:'Only scale using the corner handles'},
       {id:'rotate',label:'Rotate',icon:StudioRotateObjectIcon,hint:'Only rotate using the circular handle'}
      ] as const).map(({id,label,icon:Icon,hint})=><button key={id} type="button" title={hint} aria-label={label} aria-pressed={areaTransformMode===id} className={'stroke-mode-button '+(areaTransformMode===id?'active':'')} onClick={()=>{setAreaTransformMode(id);engine.current?.setAreaTransformMode(id);}}><Icon size={21}/><span>{label}</span></button>)}
      <button type="button" title="Perspective warp applies to editable individual strokes. Convert this selection to selected strokes when available." aria-label="Perspective" className="stroke-mode-button" onClick={()=>{const e=engine.current;if(!e)return;const ids=e.strokeIdsInArea();if(!ids.length){notify('Perspective needs editable brush or vector strokes. Select them with Stroke Select (S).');return;}chooseTool('stroke-select');e.selectStrokesForPerspective(ids);setStrokeMode('perspective');}}><StudioPerspectiveIcon size={21}/><span>Perspective</span></button>
      <button className="stroke-apply" title="Apply transformation" onClick={()=>engine.current?.applySelection()}><Check size={15}/> Apply</button>
      <button title="Cancel selection" onClick={()=>engine.current?.clearSelection()}><X size={15}/></button>
     </FloatingTransformPanel>}
     {busy&&<div className="fill-progress" role="status"><span className="spinner"/>Filling region…</div>}
     {tool!=='transform'&&hasSelection&&strokeCount===0&&<div className="selection-actions"><span>Selection ready</span><button onClick={()=>chooseTool('transform')}>Transform</button><button className="accent-button" onClick={()=>engine.current?.applySelection()}><Check size={14}/>Apply</button><button onClick={()=>engine.current?.deleteSelectedArtwork()} title="Clear inside the lasso / rectangle on the active raster layer (Delete / ⌫)"><Trash2 size={13}/> Delete Selected </button><button onClick={()=>engine.current?.clearSelection()}>Cancel</button></div>}
    </div>
     {timelineView==='xsheet'&&<aside ref={xsheetDock} className="xsheet-side-dock" style={{width:xsheetWidth}} aria-label={'Xsheet docked '+xsheetSide}>
       <div className="xsheet-dock-resizer" role="separator" aria-label="Resize Xsheet side panel" title="Drag to resize Xsheet" onPointerDown={resizeXsheetDock}/>
       <div className="xsheet-dock-controls"><strong>XSHEET</strong><div>
        <button title="Dock Xsheet on the left" aria-pressed={xsheetSide==='left'} className={xsheetSide==='left'?'selected':''} onClick={()=>setXsheetSide('left')}><PanelLeftOpen size={14}/> Left</button>
        <button title="Dock Xsheet on the right" aria-pressed={xsheetSide==='right'} className={xsheetSide==='right'?'selected':''} onClick={()=>setXsheetSide('right')}><PanelRightOpen size={14}/> Right</button>
        <button title="Close Xsheet (Shift+X)" aria-label="Close side Xsheet" onClick={toggleXsheetView}><X size={14}/></button>
       </div></div>
       <XsheetView project={doc} selectedFrameIds={selectedFrames.ids} selectedLayerIds={selectedLayers.ids} busy={busy} playbackExposure={playbackUpdate.state==='stopped'?null:playbackUpdate.exposure} onSelect={selectXsheetCell} onHoldChange={changeHoldForCel} onMakeKey={makeXsheetKey}/>
      </aside>}
    </div>
    <div className="canvas-status"><span><MousePointer2 size={12}/>{workspaceMode==='DRAW'?'DRAW':'ANIMATE'} · {activeTool.name}{layer.locked?' · Layer locked':''}</span>{linkedCount(doc)>1&&<span title="This artwork is shared with other linked cels. Shift+C to unlink."><Link2 size={12}/> LINKED ×{linkedCount(doc)}</span>}<span>Space + drag to pan <span className="status-sep">/</span> Scroll to zoom</span><button onClick={()=>setModal('settings')}><Keyboard size={13}/>Shortcuts</button></div>
   </main>
   <div className="panel-resizer right-resizer" role="separator" aria-label="Resize inspector" onPointerDown={e=>resizePanel(e,'right')}/>
   <aside className={'right-panel '+(layout.rightClosed?'panel-closed':'')}>
    {layout.rightClosed?<div className="collapsed-tool-rail" role="toolbar" aria-label="Collapsed inspector tools">
      <IconButton label="Expand inspector" onClick={()=>setLayout(old=>({...old,rightClosed:false}))}><PanelRightOpen size={17}/></IconButton>
      <span className="rail-divider"/>
      {([{tab:'inspector',label:'Brush and tool settings',icon:SlidersHorizontal},{tab:'color',label:'Color panel',icon:Palette},{tab:'reference',label:'Reference images',icon:ImageIcon},{tab:'history',label:'History',icon:Clock},{tab:'substitutions',label:'Drawing substitutions',icon:Copy},{tab:'reuse',label:'Linked drawings and cycles',icon:Film},{tab:'motion',label:'Timing notes and motion arcs',icon:MapPinned},{tab:'camera',label:'Scene camera',icon:Target}] as const).map(item=><IconButton key={item.tab} label={'Open '+item.label} active={rightTab===item.tab} onClick={()=>{setRightTab(item.tab);setLayout(old=>({...old,rightClosed:false}));}}><item.icon size={17}/></IconButton>)}
     </div>:<>
     <div className="inspector-tabs">{['inspector','color','reference','history','substitutions','reuse',...(rightTab==='motion'?['motion']:[]),'camera'].map(t=><button key={t} aria-label={t==='camera'?'Open Scene camera':undefined} className={rightTab===t?'active':''} onClick={()=>setRightTab(t)}>{t.toUpperCase()}</button>)}<IconButton label="Collapse inspector" onClick={()=>setLayout({...layout,rightClosed:true})}><PanelRightClose size={13}/></IconButton></div>
     <div className="inspector-scroll">

     <div className="navigation-tools" aria-label="Tools">
  {['draw','select','transform','view','color'].map(group => {
    const items = toolRegistry.filter(t => t.group === group);
    return <Fragment key={group}>
      {group !== 'draw' && <span className="tool-group-divider"/>}
      {items.map(t => <IconButton key={t.id} label={t.name+' ('+t.key+')'} tooltip={t.name+' · '+(shortcuts[t.id as ShortcutCommand]?.toUpperCase()??t.key)} active={tool===t.id} onClick={()=>chooseTool(t.id)}><t.icon size={16}/></IconButton>)}
    </Fragment>;
  })}
</div>
     {(tool==='transform'||advancedStrokeTransform)&&rightTab==='inspector'&&<section className="transform-inspector-shell" aria-label="Transform tool settings"><div className="transform-inspector-heading"><span className="transform-inspector-emblem">◇</span><strong>TRANSFORM</strong><small>TOOL INSPECTOR</small></div><div id="transform-inspector-slot" className="transform-inspector-slot"/></section>}
     {rightTab==='recorder'&&engineReady&&<DrawingBugRecorderPanel engine={engineReady} notify={notify} close={()=>setRightTab('inspector')} advanced={()=>setRightTab('diagnostics')}/>}
     {rightTab==='diagnostics'&&<DrawingDiagnostics engine={engine} notify={notify} close={()=>setRightTab('inspector')}/>}
     {rightTab==='substitutions'&&<SubstitutionShelf items={substitutionItems(doc)} layerName={layer.name} selectedCount={strokeCount} disabled={busy} onSave={captureSubstitution} onApply={insertSubstitution} onRename={changeSubstitutionName} onDelete={removeSubstitutionFromShelf}/>}
     {rightTab==='reuse'&&<ReuseShelf frames={frameList(doc).map((f,index)=>({id:f.id,index}))} currentId={frameList(doc)[currentFrameIndex(doc)].id} layerName={layer.name} linkCount={linkedCount(doc)} cycles={cycleItems(doc)} disabled={busy} linkTarget={linkTargetFrameId} onLinkTargetChange={setLinkTargetFrameId} linkShortcut={shortcuts.linkCel} unlinkShortcut={shortcuts.unlinkCel} onLink={linkDrawingToFrame} onUnlink={unlinkDrawing} onCapture={captureCycle} onInsert={insertCycle} onDelete={removeCycle}/>}
     {rightTab==='motion'&&motionToolsOpen&&<MotionPlanningPanel planning={doc.motionPlanning} frameId={frameList(doc)[currentFrameIndex(doc)].id} frameName={'Frame '+(currentFrameIndex(doc)+1)} layerName={layer.name} disabled={busy} selectedStrokeCount={strokeCount} frames={frameList(doc).map((f,index)=>({id:f.id,index}))} editingPoints={motionArcEditing} onEditingPoints={enabled=>{setMotionArcEditing(enabled);if(!enabled)setAddingMotionDot(false);}} addingDot={addingMotionDot} onAddingDot={value=>{setAddingMotionDot(value);if(value&&playbackIsRunning){setShowPathDuringPlayback(true);setEditPathWhilePlaying(true);}}} selectedDotId={selectedMotionDotId} onRemoveDot={removeSelectedMotionDot}
       showDuringPlayback={showPathDuringPlayback} onShowDuringPlayback={value=>{setShowPathDuringPlayback(value);if(!value)setEditPathWhilePlaying(false);}}
       editWhilePlaying={editPathWhilePlaying} onEditWhilePlaying={value=>{setEditPathWhilePlaying(value);if(value){setShowPathDuringPlayback(true);setMotionArcEditing(true);}}}
       selectedFrameIndices={selectedFrames.ids.map(id=>motionFrameIds.indexOf(id)).filter(n=>n>=0)}
       activeArcId={activeMotionArcId} onArcSelected={id=>{setActiveMotionArcId(id);setSelectedMotionDotId('');setAddingMotionDot(false);}} onQuickCreate={quickCreateMotionPath} onModeChange={(id,mode)=>updateMotionData(setMotionPathMode(store.getSnapshot(),id,mode),'Motion path editing mode')} onBindSelection={bindSelectedMotionStrokes} onBindLayerRange={bindMotionLayerRange} onUnbind={id=>{const p=store.getSnapshot();updateMotionData(unbindArcFrame(p,id,frameList(p)[currentFrameIndex(p)].id),'Unbind frame from arc');}} onApplyArc={applyMotionArc} onSaveNote={text=>updateMotionData(setCurrentTimingNote(store.getSnapshot(),text),'Timing note')} onNewArc={name=>{const before=store.getSnapshot();const next=createMotionArc(before,name);if(next!==before){updateMotionData(next,'Create motion arc');setActiveMotionArcId(next.motionPlanning?.arcs.at(-1)?.id??'');}}} onDeleteArc={id=>updateMotionData(removeMotionArc(store.getSnapshot(),id),'Remove motion arc')} onCapturePoint={captureMotionPoint} onSetPoint={(id,x,y)=>{const p=store.getSnapshot();updateMotionPoint(id,frameList(p)[currentFrameIndex(p)].id,x,y,'Set motion point');}} onDeletePoint={id=>{const p=store.getSnapshot();updateMotionData(removeMotionArcPoint(p,id,frameList(p)[currentFrameIndex(p)].id),'Remove motion point');}}/>}
     {rightTab==='batch-transform'&&<MultiCelTransformPanel frameCount={selectedFrames.ids.filter(id=>motionFrameIds.includes(id)).length} layerCount={selectedLayers.ids.filter(id=>layerIds.includes(id)).length} activeLayerName={layer.name} disabled={busy} onApply={applyBatchTransform}/>}
     {rightTab==='camera'&&<SceneCameraPanel project={doc} frame={cameraExposure} frameCount={cameraPlan.length} renderer={engineReady?.renderer} activeLayerId={doc.activeLayerId} onCommit={commitCamera} onGoToFrame={goToCameraExposure}/>}
     {rightTab==='history'&&<Section title="HISTORY" icon={<Clock size={14}/>}><p className="hint">Click an action to restore that document state. New edits replace the redo branch.</p><div className="history-list">{store.getHistory().map(entry=><button key={entry.id} className={(entry.current?'active ':'')+(entry.future?'future':'')} aria-current={entry.current?'step':undefined} disabled={busy} onClick={()=>{engine.current?.cancelGesture();engine.current?.clearSelection();store.goTo(entry.index);}}><span>{entry.index.toString().padStart(2,'0')}</span>{entry.label}</button>)}</div></Section>}
     {rightTab==='inspector'&&<>
      {(tool==='brush'||tool==='eraser')&&!layer.reference&&<BrushStudio library={brushLibrary} eraser={tool==='eraser'} onChange={stablePanelHandlers.current.brushChange} notify={stablePanelHandlers.current.notice} onToggleMode={toggleMixMode}/>}
      {tool==='vector'&&<VectorStudio line={selectedVector} defaults={vectorDefaults} setDefaults={setVectorDefaults} style={p=>engine.current?.vectors.style(p)} transform={(x,y,scale,angle)=>engine.current?.vectors.transform(x,y,scale,angle)} smooth={amount=>engine.current?.vectors.smooth(amount)} remove={()=>engine.current?.vectors.delete()} exportLine={()=>{if(selectedVector)downloadBlob(new Blob([vectorSvg(selectedVector,doc.width,doc.height)],{type:'image/svg+xml'}),'vector-line.svg');}}/>}
      {layer.kind!=='vector'&&!layer.reference&&['brush','eraser','lasso','rectangle'].includes(tool)&&<Section title="POST-STROKE SMOOTHING"><Range label="Post smoothness" value={postAmount} onChange={setPostAmount}/><p className="hint">Refine whole strokes without changing their captured points. Preview, then apply as one undo step.</p><button className="full-width" onClick={()=>engine.current?.smoothing.preview(postAmount,'last')}>Preview last stroke</button><button className="full-width" disabled={!hasSelection} onClick={()=>engine.current?.smoothing.preview(postAmount,'selection',engine.current.selection)}>Preview selected strokes</button>{smoothingActive&&<div className="studio-preset-actions"><button className="accent-button" onClick={()=>engine.current?.smoothing.apply()}>Apply smoothing</button><button onClick={()=>engine.current?.smoothing.cancel()}>Cancel smoothing</button></div>}</Section>}
      {(tool==='stroke-select'||tool==='transform')&&<StrokeWidthEditor engine={engine.current} project={doc} selectedCount={strokeCount}/>}
      {tool==='stroke-select'&&<Section title="STROKE SELECT · S"><p className="hint">Click a stroke or lasso several strokes. Shift-click to change the selection. Choose the Transform tool to move, scale, or rotate your selection.</p><label className="studio-select">Lasso behavior<select aria-label="Stroke lasso behavior" value={strokePickMode} onChange={e=>{const v=e.target.value as 'touch'|'enclose';setStrokePickMode(v);engine.current?.setPickMode(v);}}><option value="touch">Touched or enclosed strokes</option><option value="enclose">Fully enclosed strokes only</option></select></label><label className="studio-select">Selection area<select aria-label="Stroke marquee shape" value={strokeShape} onChange={e=>{const shape=e.target.value as 'rectangle'|'lasso';setStrokeShape(shape);engine.current?.setStrokeShape(shape);if(shape==='lasso'){engine.current?.setStrokeMode('lasso');setStrokeMode('lasso');}else{engine.current?.setStrokeMode('select');setStrokeMode('select');}}}><option value="lasso">Freehand Lasso</option><option value="rectangle">Rectangle marquee</option></select></label><p className="hint">For a character drawn on several layers choose <b>All visible</b> on the toolbar; hidden and locked layers are protected. Choose <b>Freeform</b> for Move, Scale, Rotate and Perspective in one tool. Drag inside to move, corners or side handles to scale, circular arrow/ring to rotate; switch to Perspective corners (or Ctrl+drag a corner) to warp. The original separate tools remain available.</p><p className="hint">Mac keyboard on Windows: Option = Alt. Option+S Select, +L Lasso, +T Freeform, +V Move, +G Scale, +R Rotate, +P Perspective Scale, Option+Shift+P Perspective Move. Enter applies · Esc cancels.</p><p className="hint">Imported bitmap fills and erased marks are not independently selectable by stroke ID.</p></Section>}
      {tool==='fill'&&<FillInspector settings={fillSettings} onChange={setFillSettings} project={doc} tolerance={brush.tolerance} setTolerance={tolerance=>setBrush({tolerance})}/>}
      {(tool==='lasso'||tool==='rectangle')&&<Section title="SELECTION OPTIONS"><label className="studio-select">Shape<select aria-label="Selection shape" value={tool} onChange={e=>chooseTool(e.target.value as Tool)}><option value="lasso">Freehand Lasso</option><option value="rectangle">Rectangle</option></select></label><p className="hint">Release to finish. Canceled input retains its captured boundary. Choose Transform to move, scale or rotate.</p></Section>}
      {layer.reference&&<p className="reference-hint">This is a reference layer. Use the Reference tab to place it, or select an artwork layer to draw.</p>}{(tool==='hand'||tool==='zoom'||tool==='rotate')&&<Section title="CANVAS NAVIGATION"><p className="hint">Hand: drag to pan. Zoom: click or drag horizontally; Alt-click zooms out. Rotate: drag around the workspace center; hold Shift for 15° steps.</p><button className="full-width" onClick={()=>engine.current?.fit()}>Fit rotated canvas</button><button className="full-width" onClick={()=>engine.current?.rotate(0)}>Reset canvas rotation</button></Section>}{tool==='eyedropper'&&<Section title="EYEDROPPER"><p className="hint">Click to sample visible artwork in project coordinates, including layer opacity and blending. Reference images are excluded.</p></Section>}
     </>}
     {rightTab==='color'&&<ColorStudio color={drawingColor} onChange={setDrawingColor}/>}
     {rightTab==='reference'&&<ReferenceStudio project={doc} importImage={file=>void engine.current?.references.import(file)} update={(id,p)=>engine.current?.references.update(id,p)} edit={(id,p)=>commit(editLayer(doc,id,p))} select={id=>{if(!busy){engine.current?.cancelGesture();store.select(id);}}}/>}
     {rightTab==='inspector'&&<><Section title="DISPLAY" icon={<Maximize size={14}/>}><label className="check-row"><span>Frame guides</span><input aria-label="Frame guides" type="checkbox" checked={doc.settings.guides} onChange={e=>commit({...doc,settings:{...doc.settings,guides:e.target.checked}})}/></label><button className="full-width" onClick={()=>engine.current?.fit()}><Maximize size={13}/>Fit canvas to workspace</button></Section><div className="future-section"><div><span className="future-star">✧</span><strong>SMART IN-BETWEEN</strong><span className="planned-badge">PLANNED</span></div><p>Great motion starts with a great drawing.<br/>Let’s build the foundation first.</p><button onClick={()=>setModal('roadmap')}>Explore the roadmap <ChevronRight size={12}/></button></div></>}
     </div>
    </>}
   </aside>
   <section className="timeline" aria-label="Animation timeline">
    <div className="timeline-resizer" role="separator" aria-label="Resize timeline: drag to make more or less drawing space" title="Drag to resize timeline · double-click to compact" onDoubleClick={()=>setLayout(old=>({...old,bottom:160,bottomClosed:false}))} onPointerDown={e=>resizePanel(e,'bottom')}/>
    <div className="timeline-header canvas-first-toolbar">
     <strong>TIMELINE</strong>
     <IconButton label={playbackUpdate.state==='playing'||playbackUpdate.state==='preparing'||playbackUpdate.state==='buffering'?'Pause animation (Shift+Space)':'Play animation (Shift+Space)'} active={playbackUpdate.state!=='stopped'} disabled={busy} onClick={togglePlayback}>
       {playbackUpdate.state==='playing'||playbackUpdate.state==='preparing'||playbackUpdate.state==='buffering'?<Pause size={14}/>:<Play size={14}/>}</IconButton>
     <button className="timeline-add-cel" title="Add blank drawing frame (F6)" disabled={busy||frameList(doc).length>=MAX_DRAWING_FRAMES} onClick={()=>animationAction('add')}>＋ Cel</button>
     <span className="timeline-current-frame" aria-label="Current frame">F {String(playbackUpdate.state==='stopped'?currentExposureRange(doc).start:playbackUpdate.exposure).padStart(3,'0')}</span>
     <div className="timeline-pinned">{timelineTools.filter(tool=>timelinePins.includes(tool.id)).map(tool=><div key={tool.id}>{tool.control}</div>)}</div>
     <button aria-pressed={audioTrackOpen} onClick={audioActionCallbacks.current.toggle}>♫ Audio</button>
     <details className="timeline-more" ref={timelineMenu}>
      <summary aria-label="Customize timeline toolbar">•••</summary>
      <div className="timeline-tools-popup">
       <strong>Customize Toolbar</strong>
       <p>Pin the controls you use most.</p>
       {timelineTools.map(tool=><div className="timeline-tool-row" key={tool.id}>
        <label><input type="checkbox" checked={timelinePins.includes(tool.id)} onChange={e=>pinTimelineTool(tool.id,e.target.checked)}/>{tool.id}</label>
        {tool.control}
       </div>)}
      </div>
     </details>
     <button className="timeline-collapse" title="Collapse or expand timeline region" onClick={()=>{stopPlayback();setLayout({...layout,bottomClosed:!layout.bottomClosed});}}><ChevronDown size={14} style={{transform:layout.bottomClosed?'rotate(180deg)':''}}/></button>
    </div>
    {!layout.bottomClosed&&audioTrackOpen&&<AudioTrack audio={doc.audio} expanded={audioTrackOpen} shortcut={shortcuts.audioTrack} muted={audioMuted} busy={busy||audioBusy} exposure={playbackUpdate.state==='stopped'?currentExposureRange(doc).start:playbackUpdate.exposure} fps={fps} total={totalExposureFrames(doc)} onToggle={audioActionCallbacks.current.toggle} onImport={audioActionCallbacks.current.importClip} onRemove={audioActionCallbacks.current.remove} onMute={audioActionCallbacks.current.mute} onSeek={audioActionCallbacks.current.seek}/>}
    {!layout.bottomClosed&&<div className="timeline-body">
      <div ref={timelineTrack} className="timeline-track"><span className="layer-track-heading"><Layers size={13}/>DRAWING FRAMES<br/> & LAYER CELS</span>{doc.layers.map(l=><button key={l.id} className={'layer-track-name '+(l.id===layer.id?'active':'')+(layerSelectionSet.has(l.id)?' multi-selected':'')} title={'Select '+l.name+' · Shift-click range · Option-click separate layers'} onClick={e=>{selectLayerWithModifier(l.id,e.shiftKey,e.altKey);stopPlayback();store.select(l.id);}}><span className={'track-dot '+(l.id===layer.id?'active':'')}/><span className="layer-name-text">{l.name}</span>{l.locked&&<Lock size={10}/>}</button>)}</div>
      <div className="timeline-grid" role="group" aria-label="Drawing frames" onScroll={e=>{if(timelineTrack.current)timelineTrack.current.scrollTop=e.currentTarget.scrollTop;}}>
       <div className="timeline-frames">
        {frameList(doc).map((frame,i)=>{
         const displayHold=holdPreview?.id===frame.id?holdPreview.hold:frameHold(frame);
         const start=frameExposureStart(doc,i);
         return <div key={frame.id} className={'timeline-cel '+(frameSelectionSet.has(frame.id)?' multi-selected ':'')+(noteFrameIds.has(frame.id)?'has-timing-note ':'')+(holdPreview?.id===frame.id?'resizing ':'')+(playbackUpdate.state!=='stopped'&&i===playbackUpdate.celIndex?'playback-current ':'')+(i===currentFrameIndex(doc)?'selected':onionSettings.enabled&&onionSettings.previous&&i===currentFrameIndex(doc)-1?'onion-previous':onionSettings.enabled&&onionSettings.next&&i===currentFrameIndex(doc)+1?'onion-next':'')} title={'Drawing '+(i+1)+' · visible frames '+start+(frameHold(frame)>1?'–'+(start+frameHold(frame)-1):'')+' · hold '+frameHold(frame)} style={{flexBasis:47+10*(displayHold-1)}}>
          <button className="cel-select" aria-label={'Select drawing '+(i+1)+', held for '+frameHold(frame)+' frames'} aria-pressed={frameSelectionSet.has(frame.id)||i===currentFrameIndex(doc)}
           title={'Click to select, then Delete/⌫ to delete the drawing · drag to change hold (1–24). Hold '+displayHold}
           onClick={e=>clickCel(e,frame.id)}
           onPointerDown={e=>beginHoldDrag(e,frame.id,frameHold(frame))}
           onPointerMove={moveHoldDrag} onPointerUp={e=>finishHoldDrag(e,true)} onPointerCancel={e=>finishHoldDrag(e,false)}
           onLostPointerCapture={()=>{if(holdDrag.current?.id===frame.id)cancelHoldDrag();}}>
           <span className="cel-number">{String(start).padStart(2,'0')}</span>{noteFrameIds.has(frame.id)&&<span className="timing-note-marker" aria-label="Timing note saved" title="Timing note saved for this drawing">●</span>}
           <span className={'cel-art '+(Object.values(frame.drawings).some(ops=>ops.length>0)?'has-art':'')}>{Object.values(frame.drawings).some(ops=>ops.length>0)?'●':'+'}</span>
           <span className="cel-hold">{displayHold>1?'×'+displayHold:'1f'}</span>
          </button>
         </div>;
        })}
       </div>
       {doc.layers.map(l=><div key={'track-'+l.id} className={'layer-cel-row '+(l.id===layer.id?'active':'')+(layerSelectionSet.has(l.id)?' multi-selected':'')} aria-label={l.name+' animation track'}>
        {frameList(doc).map((frame,i)=>{
         const held=isLayerHeld(doc,l.id,frame.id);
         const preview=layerHoldPreview?.layerId===l.id;
         const previewHeld=preview&&i>layerHoldPreview.start&&i<=layerHoldPreview.end;
         const covered=preview&&i>layerHoldPreview.end&&i<=layerKeyEnd(doc,l.id,layerHoldPreview.start);
         const shownHeld=previewHeld||(held&&!covered);
         return <button key={frame.id} data-layer-frame-index={i} className={'layer-exposure-cell '+(shownHeld?'held':'key')+' '+(frameSelectionSet.has(frame.id)&&layerSelectionSet.has(l.id)?'multi-selected ':'')+(l.id===layer.id&&i===currentFrameIndex(doc)?'active':'')}
          style={{flexBasis:47+10*(frameHold(frame)-1)}}
          disabled={busy} aria-label={l.name+' frame '+(i+1)+(shownHeld?' held drawing':' new drawing')}
          title={shownHeld?l.name+': holds previous key · Alt+K to make independent':l.name+': drawing key · drag to extend or shorten hold'}
          onClick={e=>clickLayerFrame(e,l.id,frame.id)}
          onPointerDown={e=>layerPointerDown(e,l.id,i)} onPointerMove={layerPointerMove}
          onPointerUp={e=>finishLayerDrag(e,true)} onPointerCancel={e=>finishLayerDrag(e,false)}>
          <span>{shownHeld?'↪':frame.drawings[l.id]?.length?'●':'◇'}</span>
          {shownHeld&&<small>HOLD</small>}
         </button>;
        })}
       </div>)}
       <div className="layer-track-help">Layer tracks: drag a key cel to hold it across later frames · click a held cel, then Alt+K to copy it into a new editable key · Alt+Shift+K for blank · Alt+[ / Alt+] adjust active layer hold · Alt+↑ / Alt+↓ choose layer</div>
       <div className="timeline-help">Click to select · Shift-click range · Option-click separate frames/layers · drag directly on the cel (or its right edge) to change HOLD · Shift+[ / Shift+] adjust ±1 · Shift+Space Play/Pause · Page Up / Page Down Step · F6 New / F7 Duplicate · [ / ] Brush size · , / . Flip · O Onion</div>
      </div>
     </div>}
   </section>
   <div className="wheel-overlay"><RadialToolbar shortcuts={shortcuts} onAction={wheelCallbacks.current.action} active={tool} onTool={stablePanelHandlers.current.choose} workspace={workbench} homeOpen={!layout.leftClosed&&!focusMode} onNotice={stablePanelHandlers.current.notice} mixMode={brushLibrary.mode==='mix'} onToggleMix={wheelCallbacks.current.mix}/></div>
  </div>
  <footer className="app-footer"><span><i/> LOCAL WORKSPACE<span className="footer-divider"/>All artwork stays on this device</span><span>{busy?'Processing fill':hasSelection?'Selection active':'Ready to draw'}<span className="footer-divider"/>{frameSize.width} × {frameSize.height} px<span className="footer-divider"/><CameraPercent camera={camera}/></span></footer>
  <input ref={fileInput} type="file" accept=".json,.solo.json" multiple hidden onChange={async e=>{const files=[...(e.target.files??[])];e.target.value='';for(const file of files)try{await openProject(await importProject(file));}catch(err){notify('Import failed: '+String(err));}}}/>
  <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];if(file)importSceneImage(file);event.target.value='';}}/>
  {message&&<div className="toast" role="status">{message}<button aria-label="Dismiss notification" onClick={()=>setMessage('')}><X size={15}/></button></div>}
  {closeRequest&&<CloseProjectDialog name={sessions.current.get(closeRequest)?.history.project.name??'Project'} busy={closingTab} error={closeError} onSave={()=>void confirmCloseProject(true)} onDiscard={()=>void confirmCloseProject(false)} onCancel={()=>setCloseRequest(null)}/>}
  {fillQuestion&&<div className="modal-backdrop"><div className="modal small" role="dialog" aria-modal="true" aria-labelledby="fill-warning-title"><h2 id="fill-warning-title">Open fill boundary</h2><p>{fillQuestion.message}</p><div className="modal-actions"><button onClick={()=>{fillQuestion.resolve(false);setFillQuestion(null);}}>Cancel fill</button><button className="accent-button" onClick={()=>{fillQuestion.resolve(true);setFillQuestion(null);}}>Fill anyway</button></div></div></div>}
  {renameId&&<div className="modal-backdrop"><form className="modal small" role="dialog" aria-modal="true" aria-labelledby="rename-heading" onSubmit={e=>{e.preventDefault();if(renameValue.trim())commit(editLayer(doc,renameId,{name:renameValue.trim()}));setRenameId('');}}><h2 id="rename-heading">Rename layer</h2><input aria-label="Layer name" autoFocus maxLength={100} value={renameValue} onChange={e=>setRenameValue(e.target.value)}/><div className="modal-actions"><button type="button" onClick={()=>setRenameId('')}>Cancel</button><button className="accent-button">Rename</button></div></form></div>}
  {modal&&<div className={modal==='recover'?'modal-backdrop startup-backdrop':'modal-backdrop'}><div className={modal==='recover'?'modal startup-modal':'modal '+(['new','saveas','rename'].includes(modal)?'small':'')} role="dialog" aria-modal="true" aria-labelledby="dialog-title">{!homeRequiresScene&&<button className="modal-close" aria-label="Close dialog" onClick={closeModal}><X size={18}/></button>}
   {['new','saveas','rename'].includes(modal)?<form onSubmit={e=>{e.preventDefault();void submitProject();}}><span className="eyebrow">SOLO ANIME STUDIO</span><h2 id="dialog-title">{modal==='new'?'A fresh canvas.':modal==='saveas'?'Save a new copy.':'Name your scene.'}</h2><label className="form-label">Project name<input aria-label="Project name" autoFocus maxLength={100} value={name} onChange={e=>setName(e.target.value)} required/></label>{modal==='new'&&<label className="form-label">Resolution<select aria-label="Project resolution" value={resolution} onChange={e=>setResolution(e.target.value)}><option value="1920x1080">1920 × 1080 · Full HD</option><option value="1280x720">1280 × 720 · HD</option><option value="1080x1080">1080 × 1080 · Square</option><option value="2048x2048">2048 × 2048 · Square</option><option value="720x1920">720 × 1920 · Tall portrait</option><option value="1080x1920">1080 × 1920 · Full HD portrait</option><option value="720x1280">720 × 1280 · HD portrait</option></select></label>}<div className="modal-actions"><button type="button" onClick={closeModal}>Cancel</button><button className="accent-button" type="submit">{modal==='new'?'Create project':modal==='saveas'?'Save copy':'Rename'}</button></div></form>:null}
   {modal==='recover'&&<ProjectHome records={records} open={project=>void openProject(project)} create={createHomeScene} importBackup={()=>fileInput.current?.click()} activeId={activeTabId.current??''} protectedIds={tabIds} deleteScenes={deleteSelectedProjects} combine={combineHomeScenes} placePhoto={placeHomePhoto}/>}
   {modal==='open'&&<><span className="eyebrow">ON THIS DEVICE</span><h2 id="dialog-title">Manage saved scenes</h2><p className="modal-intro">Choose a saved scene or import an editable backup.</p><div className="project-list">{records.length?records.map(r=><div className="project-row" key={r.id}><button className="project-open" disabled={deletingProjects} onClick={()=>void openProject(r.project)}><span className="project-list-icon"><Folder size={19}/></span><span><strong>{r.project.name}</strong><small>{r.project.width} × {r.project.height} · {r.project.layers.length} layers · {r.kind==='autosave'?'Autosaved':'Saved'} {new Date(r.savedAt).toLocaleString()}</small></span><ChevronRight size={15}/></button>{sessions.current.has(r.id)?<span className="project-current" title="Close this project tab before deleting it">OPEN</span>:<label className="project-delete-choice" title={`Select ${r.project.name} for deletion`}><input type="checkbox" aria-label={`Select ${r.project.name} for deletion`} checked={deleteSelection.includes(r.id)} disabled={deletingProjects} onChange={event=>toggleProjectForDeletion(r.id,event.target.checked)}/></label>}</div>):<p className="hint">No saved projects yet. Save your scene to find it here.</p>}</div>{records.length>0&&<div className="project-delete-actions"><span>Select old projects to remove. Your open project is protected.</span><button type="button" className="project-delete-button" disabled={!deleteSelection.length||deletingProjects} onClick={()=>void deleteSelectedProjects()}><Trash2 size={14}/>{deletingProjects?'Deleting…':`Delete selected (${deleteSelection.length})`}</button></div>}<div className="modal-actions"><button onClick={()=>fileInput.current?.click()}>Import backup…</button><button className="accent-button" onClick={closeModal}>Close</button></div></>}
   {modal==='snapshots'&&<><span className="eyebrow">RECOVERY</span><h2 id="dialog-title">Saved snapshots.</h2><p className="modal-intro">The last 10 successful saves for this project. Restoring can be undone only by reopening a newer snapshot.</p><div className="project-list">{snapshots.map(s=><button key={s.key} onClick={()=>void openProject(s.project,true)}><Clock size={18}/><span><strong>{new Date(s.savedAt).toLocaleString()}</strong><small>{s.kind} · {s.project.layers.reduce((n,l)=>n+l.operations.length,0)} drawing operations</small></span><ChevronRight size={14}/></button>)}{!snapshots.length&&<p>No snapshots yet. Save this project first.</p>}</div></>}
   {modal==='export'&&<PngExport project={doc} cameraFrame={cameraExposure} onExport={options=>void exportPng(options)}/>}
   {modal==='sequence'&&<><SequenceExport project={doc} fps={fps} busy={sequenceBusy} onExport={options=>void exportSequence(options)}/>{sequenceBusy&&<div className="sequence-progress" role="status">{sequenceProgress?.phase??'Preparing'} · {sequenceProgress?.finished??0}/{sequenceProgress?.total??0}<button onClick={()=>sequenceAbort.current?.abort()}>Cancel export</button></div>}</>}
   {modal==='settings'&&<><span className="eyebrow">MAKE IT YOURS</span><h2 id="dialog-title">Keyboard & workspace.</h2><p className="modal-intro">Click a tool key to change it. Shortcuts pause while you type.</p><ShortcutEditor bindings={shortcuts} onChange={setShortcuts} notify={notify}/><div className="fixed-shortcuts"><span>Temporary pan <kbd>Space + drag</kbd></span><span>Undo <kbd>Ctrl/⌘ Z</kbd></span><span>Redo <kbd>Ctrl/⌘ Shift Z / Y</kbd></span><span>Save <kbd>Ctrl/⌘ S</kbd></span><span>Apply transform <kbd>Enter</kbd></span><span>Stroke Select <kbd>S</kbd></span><span>Freeform Transform <kbd>Option/Alt + T</kbd></span><span>Perspective scale <kbd>Option/Alt + P</kbd></span><span>Perspective move <kbd>Option/Alt + Shift + P</kbd></span><span>Duplicate strokes <kbd>Ctrl/⌘ J</kbd></span><span>Cancel selection <kbd>Esc</kbd></span></div><div className="fixed-shortcut-heading">CANVAS & ANIMATION SHORTCUTS</div><div className="fixed-shortcuts"><span>Canvas Focus Mode <kbd>F9</kbd></span><span>Compact timeline <kbd>Double-click top edge</kbd></span><span>Show / hide side Xsheet <kbd>{shortcuts.xsheet.toUpperCase()}</kbd></span><span>Drawing Substitution Shelf <kbd>{shortcuts.substitutionShelf.toUpperCase()}</kbd></span><span>Linked Drawings &amp; Cycles <kbd>{shortcuts.reuseShelf.toUpperCase()}</kbd></span><span>Timing Notes &amp; Motion Arcs <kbd>{shortcuts.motionPlanning.toUpperCase()}</kbd></span><span>Manage local projects <kbd>{shortcuts.openProjects.toUpperCase()}</kbd></span><span>Link to selected frame <kbd>{shortcuts.linkCel.toUpperCase()}</kbd></span><span>Unlink current drawing <kbd>{shortcuts.unlinkCel.toUpperCase()}</kbd></span><span>Pop out / return Tool Wheel <kbd>SHIFT+W</kbd></span><span>Multi-Cel Transform <kbd>{shortcuts.batchTransform.toUpperCase()}</kbd></span></div><div className="fixed-shortcuts quick-shortcut-list">{quickShortcutGuide.map(([action,chord])=><span key={action}>{action}<kbd>{chord}</kbd></span>)}</div><p className="hint">These fixed actions use different keys from the customizable drawing-tool letters. The O key is reserved for Onion Skin.</p><p className="hint">Focus Mode (F9) hides panels while keeping your current canvas zoom and center. Collapse either side into a quick-access icon rail; drag the timeline top edge to resize it. Panel widths, Xsheet side, timeline height and tool wheel placement are remembered. The wheel starts minimized outside the canvas; drag its grip anywhere in the app, or use Shift+W / the wheel options to pop it into a separate browser window. Browser security prevents dragging a wheel beyond the browser itself without a pop-out window.</p><div className="modal-actions"><button onClick={()=>setShortcuts(initialShortcuts)}>Reset shortcuts</button><button className="accent-button" onClick={closeModal}>Done</button></div></>}
   {modal==='help'&&<><span className="eyebrow">DRAWING STUDIO GUIDE</span><h2 id="dialog-title">A place to make your scene.</h2><div className="help-content"><p><strong>Draw.</strong> Choose Brush or Eraser with B / E. Use [ and ] to reduce/increase the current brush, eraser, or vector size in 1 px steps. Brush settings include stabilization and a pressure response curve.</p><p><strong>Workspace.</strong> F9 gives you a large canvas without changing zoom, and F9 again restores every panel. Collapse the left and right panels to narrow icon rails. Drag the timeline top edge to resize; double-click it to compact.</p><p><strong>Navigate.</strong> Scroll or press - / = to zoom. Hold Space and drag to pan. Rotation, fit and reset are above the canvas.</p><p><strong>Animate.</strong> Layer tracks can hold Body while Hair has new keys. Drag a layer key across later columns, Alt+K makes a held cel independent, Alt+Shift+K makes it blank, Alt+[ / Alt+] changes only the selected layer's hold, and Alt+Up/Down switches layers. Page Up / Page Down steps between drawing cels. F6 adds a blank cel, F7 duplicates one, and Delete/⌫ deletes a clicked Timeline or Xsheet frame; Shift+F7 still deletes the active frame globally. Delete on canvas still removes selected strokes. Shift+M opens Motion Path Assist; Shift+T opens Multi-Cel Transform after Shift-clicking several frame cells; captured points make non-exported overlay guides. Shift+X opens/closes the left/right Xsheet dock while preserving the bottom Timeline. Shift+U opens Drawing Substitutions; Shift+C opens Linked Drawings &amp; Cycles in the right panel; save selected strokes and insert independent copies into an unlocked drawing layer. Shift+[ / Shift+] changes a cel hold. O toggles onion skin, , / . previews adjacent frames, and Shift+Space plays or pauses.</p><p><strong>Select / Delete.</strong> Press S to select strokes (Shift-click or lasso the character), then press Delete/⌫ to delete those exact strokes. With the ordinary Lasso (L) or Rectangle (M), Delete/⌫ clears the selected area of the active raster layer. Press Control+Z to undo. Click a timeline cell first if you mean to delete a frame.</p><p><strong>Audio.</strong> In ANIMATE, use the Audio waveform strip beneath playback controls; Shift+A toggles its display. Import MP3/WAV or another Chrome-compatible audio clip up to 50 MB / 20 minutes. Click or drag the waveform to seek frames; Shift+Space plays/pause synced audio and animation. Audio is included in .solo.json backups, but autosave stores each audio asset once per project.</p><p><strong>Fill.</strong> G fills a connected region on the active layer. A region touching the output boundary asks for confirmation. For best results, close outlines on the same layer.</p><p><strong>Save.</strong> Ctrl/⌘ S saves locally. Autosave runs 2.5 seconds after edits. File → Download editable backup keeps a portable copy. Browser storage can be cleared or evicted; download backups regularly. Open local projects with Control+Option+O on a Mac keyboard running Windows (Ctrl+Alt+O); select old projects and choose Delete selected. The currently open project cannot be deleted. Deletion also removes recovery snapshots.</p><p><strong>Pen input.</strong> Pointer Events use reported pen pressure. Real tablet compatibility has not been verified. Mouse input uses a consistent width.</p></div></>}
   {modal==='roadmap'&&<><span className="eyebrow">ONE MILESTONE AT A TIME</span><h2 id="dialog-title">From first line to final scene.</h2><div className="roadmap-list">{[['01','Drawing Studio','Current scope · drawing, layers, selections & local projects'],['02','Animation Studio','Planned · exposures, onion skin, timing, playback & audio'],['03','Character Library','Planned · model sheets, poses, palettes & reusable cycles'],['04','Smart In-Between','Planned · editable guides and assisted rough drafts'],['05','Anime Production','Planned · cleanup, cameras, compositing & video export']].map(([n,t,d])=><div key={n}><span>{n}</span><div><strong>{t}</strong><p>{d}</p></div></div>)}</div><p className="hint">Automated in-between generation is future work and cannot guarantee accurate interpolation between arbitrary drawings.</p></>}
   {modal==='about'&&<><span className="eyebrow">VERSION {buildInfo.version}</span><h2 id="dialog-title">Solo Anime Studio</h2><p className="hint" style={{overflowWrap:"anywhere"}}>Build {buildInfo.mode} · source {buildInfo.sourceDigest}</p><p className="modal-intro">A focused drawing foundation for independent anime artists.</p><p className="hint">React · TypeScript · Canvas 2D · IndexedDB<br/>Editable version 3 format; version 1 and 2 imports are preserved. All drawing and saving happens in your browser.</p><p className="hint">{lastSaved?'Last save: '+new Date(lastSaved).toLocaleString():'No save has been confirmed for this project in this session.'}</p></>}
  </div></div>}
 </div>;
}



