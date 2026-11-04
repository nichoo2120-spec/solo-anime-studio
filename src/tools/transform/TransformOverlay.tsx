import {createPortal} from 'react-dom';
import {useEffect,useRef,useState,type MutableRefObject,type PointerEvent as ReactPointerEvent} from 'react';
import type {StudioEngine} from '../../engine/StudioEngine';
import type {View} from '../../core/geometry';
import {TransformTool,type Options,type Scope} from './TransformTool';
import {TransformOptionsBar,type FlipExtras} from './TransformOptionsBar';
import type {Mode} from './modes/types';
const defaults:Options={x:0,y:0,w:0,h:0,angle:0,skew:0,lock:false,interpolation:'bicubic',meshRows:4,meshCols:4,meshScope:'layer',meshMode:'adaptive',meshFalloff:50,meshPinRadius:60,meshPinBehavior:'neighbor',meshPointSize:100,meshShowGrid:true,meshShowPoints:true,meshSmooth:true,meshLockCorners:false,meshLockBorder:false,perspectiveGrid:true,perspectiveSnap:0,skewAxis:'free',skewSnap:0};
export type TransformKeyHandler=(e:KeyboardEvent)=>boolean;
export function TransformOverlay({engine,view,scope,keyDelegate,onCancel,onMessage}:{engine:StudioEngine;view:View;scope:Scope;keyDelegate:MutableRefObject<TransformKeyHandler|null>;onCancel:()=>void;onMessage:(msg:string)=>void}){
 const canvas=useRef<HTMLCanvasElement|null>(null),backdrop=useRef<HTMLCanvasElement|null>(null),controller=useRef<TransformTool|null>(null),busy=useRef(false);
 const pan=useRef<{id:number;x:number;y:number;vx:number;vy:number}|null>(null);
 const [flipPivot,setFlipPivot]=useState({x:0,y:0});
 const [flipExtras,setFlipExtras]=useState<FlipExtras>({showPivot:true,snapSelection:false,snapGrid:false,previewOutline:true,flipCanvas:false,keepTiming:true,keepPosition:false});
 const [flipTarget,setFlipTarget]=useState<'selection'|'layer'|'selected'|'visible'>('selection');
 const [mode,setMode]=useState<Mode>('free'),[values,setValues]=useState<Options>(defaults),[working,setWorking]=useState(false),[error,setError]=useState('');
 const cancelRef=useRef(onCancel),messageRef=useRef(onMessage);cancelRef.current=onCancel;messageRef.current=onMessage;
 const initialRevisionRef=useRef(engine.store.revision),ignoringRevisionRef=useRef(false),closingRef=useRef(false);
 const commit=async()=>{const t=controller.current;if(!t||busy.current)return;engine.recorder.event('transform-commit-start',{mode:t.session.mode,layerIds:scope.layerIds,frameIds:scope.frameIds});busy.current=true;setWorking(true);ignoringRevisionRef.current=true;
  try{const result=await t.commit();if(result.error){engine.recorder.event('transform-commit-error',{mode:t.session.mode,error:result.error});setError(result.error);messageRef.current(result.error);}else{engine.recorder.event('transform-commit-success',{mode:t.session.mode,changed:result.changed});messageRef.current(`Transformed ${result.changed} cel(s) — Control+Z to undo.`);initialRevisionRef.current=engine.store.revision;initialize();controller.current?.setMode(mode);}}
  catch(e){setError(String(e));messageRef.current('Transform could not be committed: '+String(e));}
  finally{busy.current=false;setWorking(false);queueMicrotask(()=>{ignoringRevisionRef.current=false;});}
 };
 const commitRef=useRef(commit);commitRef.current=commit;
 const initialize=()=>{const c=canvas.current,b=backdrop.current;if(!c||!b)return;try{setError('');controller.current?.destroy();closingRef.current=false;controller.current=new TransformTool(engine,c,b,view,scope);controller.current.onValues=v=>{setValues(v);setPinPlacement(controller.current?.meshPinPlacement??false);};setValues(controller.current.values);setFlipPivot(controller.current.pivot);}catch(e){setError(String(e));}};
 useEffect(()=>{initialize();return()=>{controller.current?.destroy();controller.current=null;keyDelegate.current=null;};},[engine]); // One stable selection snapshot per editing session
 useEffect(()=>{const unsubscribe=engine.store.subscribe(()=>{if(closingRef.current||ignoringRevisionRef.current)return;const revision=engine.store.revision;if(revision!==initialRevisionRef.current){closingRef.current=true;controller.current?.cancelDrag();controller.current?.destroy();controller.current=null;setError('');messageRef.current('Transform canceled. You can undo or redo anytime.');cancelRef.current();}});return unsubscribe;},[engine]);
 useEffect(()=>{controller.current?.setView(view);},[view.x,view.y,view.zoom,view.rotation]);
 keyDelegate.current=(event)=>{const t=controller.current;if(!t||working)return false;
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='z'){return event.shiftKey?t.redoTransform():t.undoTransform();}
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='y')return t.redoTransform();
  if(event.key==='Escape'){cancelRef.current();return true;}
  if(event.key==='Enter'){void commitRef.current();return true;}
  if(!event.repeat&&!event.ctrlKey&&!event.altKey&&event.key.toLowerCase()==='h'&&!(event.target as HTMLElement).closest('input,textarea,select,[contenteditable]')){t.setMode('flip');setMode('flip');t.flip(event.shiftKey?'v':'h');setFlipPivot(t.pivot);return true;}
  const handled=t.handleKey(event);if(handled){setMode(t.session.mode);return true;}return false;
 };
 const mirrorPointer=(e:ReactPointerEvent<HTMLCanvasElement>):PointerEvent=>{if(!(mode==='flip'&&flipExtras.flipCanvas))return e.nativeEvent;const r=e.currentTarget.getBoundingClientRect();return new Proxy(e.nativeEvent,{get(target,prop,receiver){if(prop==='clientX')return r.left+r.width-(target.clientX-r.left);const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;}}) as PointerEvent;};
 const pointerDown=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  if(engine.space||e.button===1){e.preventDefault();const v=engine.view;pan.current={id:e.pointerId,x:e.clientX,y:e.clientY,vx:v.x,vy:v.y};e.currentTarget.setPointerCapture(e.pointerId);return;}
  controller.current?.down(mirrorPointer(e));
 };
 const pointerMove=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  if(pan.current?.id===e.pointerId){const p=pan.current;engine.setView({...engine.view,x:p.vx+e.clientX-p.x,y:p.vy+e.clientY-p.y});return;}
  controller.current?.move(mirrorPointer(e));
 };
 const pointerUp=(e:ReactPointerEvent<HTMLCanvasElement>)=>{if(pan.current?.id===e.pointerId){pan.current=null;return;}controller.current?.up(mirrorPointer(e));};
 const selectMode=(m:Mode)=>{if(m!=='mesh')setPinPlacement(false);controller.current?.setMode(m);setMode(m);if(controller.current)setFlipPivot(controller.current.pivot);};
 const changeTarget=(target:typeof flipTarget)=>{const t=controller.current;if(!t)return;t.setFlipTarget(target);setFlipTarget(target);};
 const flip=(axis:'h'|'v')=>{const t=controller.current;if(!t)return;t.setMode('flip');setMode('flip');t.flip(axis);setFlipPivot(t.pivot);};
 const setPivotPreset=(x:number,y:number)=>{const t=controller.current;if(!t)return;t.setPivotFraction(x,y);setFlipPivot(t.pivot);};
 const setPivotCoordinate=(axis:'x'|'y',v:number)=>{const t=controller.current;if(!t)return;const snapped=flipExtras.snapGrid?Math.round(v/10)*10:v;t.setPivotPoint(axis==='x'?snapped:t.pivot.x,axis==='y'?snapped:t.pivot.y);setFlipPivot(t.pivot);};
 const changeFlipExtra=(key:keyof FlipExtras,value:boolean)=>{setFlipExtras(prev=>({...prev,[key]:value}));if(key==='keepPosition')controller.current?.setFlipKeepPosition(value);if(key==='showPivot'||key==='previewOutline')controller.current?.setFlipDisplay(key,value);if(key==='snapSelection'&&value){controller.current?.resetPivot();if(controller.current)setFlipPivot(controller.current.pivot);}};
 const reverseFrames=()=>{const p=engine.store.getSnapshot(),ids=new Set(scope.frameIds),a=p.animation;if(!a||ids.size<2)return;const positions=a.frames.map((f,i)=>ids.has(f.id)?i:-1).filter(i=>i>=0);if(positions.some(i=>Object.values(a.layerHolds??{}).some(track=>track.held.includes(a.frames[i].id))||Object.values(a.celLinks??{}).some(track=>Boolean(track[a.frames[i].id])))){onMessage('Unlink held cels before reversing their drawings.');return;}const order=[...positions].reverse();const layers=scope.layerIds.length?scope.layerIds:[p.activeLayerId];const copies=positions.map(i=>a.frames[i]);const frames=a.frames.map((frame,index)=>{const slot=positions.indexOf(index);if(slot<0)return frame;const from=a.frames[order[slot]];const drawings={...frame.drawings};for(const lid of layers)drawings[lid]=from.drawings[lid]??[];return {...frame,drawings};});engine.store.commit({...p,animation:{...a,frames}});onMessage('Selected drawings reversed. Undo is available.');cancelRef.current();};

 const [pinPlacement,setPinPlacement]=useState(false);
 const [inspectorHost,setInspectorHost]=useState<HTMLElement|null>(null);
 useEffect(()=>{const sync=()=>{const host=document.getElementById('transform-inspector-slot');setInspectorHost(old=>old===host?old:host);};sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);
 const change=(k:keyof Options,v:number|boolean|Options['interpolation']|Options['skewAxis']|Options['meshPinBehavior']|Options['meshScope']|Options['meshMode'])=>controller.current?.setOption(k,v);
 return <div className="full-transform-host" aria-label="Active Transform Tool">
  <canvas ref={backdrop} className="full-transform-backdrop" style={mode==='flip'&&flipExtras.flipCanvas?{transform:'scaleX(-1)'}:undefined} aria-hidden="true"/>
  <canvas ref={canvas} className="full-transform-overlay" style={mode==='flip'&&flipExtras.flipCanvas?{transform:'scaleX(-1)'}:undefined} aria-label="Transform preview and handles" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{pan.current=null;controller.current?.cancelDrag();}} onWheel={e=>{e.preventDefault();if(!pan.current)engine.zoomTo(engine.view.zoom*Math.exp(-e.deltaY*.0015));}} onDoubleClick={e=>{const t=controller.current;if(t?.session.mode==='pivot')t.resetPivot();}} onContextMenu={e=>e.preventDefault()}/>
  {inspectorHost&&createPortal(<TransformOptionsBar docked mode={mode} values={values} busy={working} onMode={selectMode} onSet={change} onCommit={()=>void commitRef.current()} onCancel={onCancel} onFlip={flip} onPivotPreset={setPivotPreset} onPivotCoordinate={setPivotCoordinate} pivot={flipPivot} onCustomPivot={()=>{controller.current?.setMode('pivot');setMode('pivot');}} flipExtras={flipExtras} onFlipExtra={changeFlipExtra} onReverseFrames={reverseFrames} selectedFrameCount={scope.frameIds.length} flipTarget={flipTarget} onFlipTarget={changeTarget} selectedLayerCount={scope.layerIds.length} onAddMeshDivision={(axis,at)=>{if(!controller.current?.addMeshDivision(axis,at))onMessage("Mesh division limit reached or position already exists.");}} pinPlacement={pinPlacement} onPinPlacement={v=>{controller.current?.setMeshPinPlacement(v);setPinPlacement(v);}} onRemoveMeshPin={()=>{if(!controller.current?.removeLastMeshPin())onMessage('No free pins to remove.');}}/>,inspectorHost)}
  {error&&<div role="status" className="full-transform-error">{error}</div>}
 </div>;
}
