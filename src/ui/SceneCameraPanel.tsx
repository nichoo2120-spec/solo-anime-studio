import {memo,useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {Project} from '../core/model';
import {shotFrame} from '../core/shotFrame';
import type {CameraViewState} from '../core/CameraViewState';
import {toScreen,toProject} from '../core/geometry';
import type {LayerRenderer} from '../engine/renderer';
import {CAMERA_EASES,cameraAt,cameraFrame,clampDepth,clampZoom,deleteCameraKey,homeCamera,layerDepth,newSceneCamera,setCameraKey,sortedKeys,type CameraEase,type CameraState,type SceneCamera} from '../animation/sceneCamera';

/** v0.5.174 Scene Camera: frame overlay on the canvas (drag = truck), safe areas and field guide. */
export const SceneCameraOverlay=memo(function SceneCameraOverlay({project,frame,view,frameOnly,canMove,onMove}:{project:Project;frame:number;view:CameraViewState;frameOnly:boolean;canMove:boolean;onMove:(x:number,y:number)=>void}){
 const v=useSyncExternalStore(view.subscribe,view.getSnapshot);
 const maskId=useId();
 const [drag,setDrag]=useState<{id:number;sx:number;sy:number;ox:number;oy:number;x:number;y:number}|null>(null);
 const c=project.camera?.enabled?project.camera:undefined;
 if(!c&&!project.shotFrame&&!frameOnly)return null;
 const shot=shotFrame(project);
 const base=cameraAt(c,frame,shot.width,shot.height,shot.x,shot.y),state:CameraState=drag?{...base,x:drag.x,y:drag.y}:base;
 const poly=(scale:number)=>cameraFrame(state,shot.width,shot.height,scale).map(p=>toScreen(p,v)).map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 const centre=toScreen({x:state.x,y:state.y},v);
 const local=(e:ReactPointerEvent<SVGElement>)=>{const r=e.currentTarget.ownerSVGElement!.getBoundingClientRect();return toProject({x:e.clientX-r.left,y:e.clientY-r.top},v);};
 const guides:string[]=[];if(c?.fieldGuide)for(const s of [1/6,2/6,3/6,4/6,5/6])guides.push(poly(s));
 return <svg className="scene-camera-overlay" aria-label="Scene camera frame">
  {frameOnly&&<>
   <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
    <rect width="100%" height="100%" fill="white"/><polygon points={poly(1)} fill="black"/>
   </mask></defs>
   <rect className="camera-surround-mask" width="100%" height="100%" mask={`url(#${maskId})`}/>
  </>}
  {c&&canMove&&<polygon className="camera-frame-hit" points={poly(1)} onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);const p=local(e);setDrag({id:e.pointerId,sx:p.x,sy:p.y,ox:base.x,oy:base.y,x:base.x,y:base.y});}}
   onPointerMove={e=>{if(!drag||drag.id!==e.pointerId)return;const p=local(e);setDrag({...drag,x:drag.ox+p.x-drag.sx,y:drag.oy+p.y-drag.sy});}}
   onPointerUp={e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;setDrag(null);if(d.x!==d.ox||d.y!==d.oy)onMove(Math.round(d.x*10)/10,Math.round(d.y*10)/10);}}
   onPointerCancel={()=>setDrag(null)}><title>Drag to move (truck) the camera</title></polygon>}
  <polygon className="camera-frame" points={poly(1)}/>
  {c?.safeArea&&<><polygon className="camera-safe action" points={poly(.9)}/><polygon className="camera-safe title" points={poly(.8)}/></>}
  {guides.map((g,i)=><polygon key={i} className="camera-field" points={g}/>)}
  {c&&<>
   <path className="camera-centre" d={`M ${centre.x-9} ${centre.y} H ${centre.x+9} M ${centre.x} ${centre.y-9} V ${centre.y+9}`}/>
   <text className="camera-label" x={toScreen(cameraFrame(state,shot.width,shot.height)[0],v).x+6} y={toScreen(cameraFrame(state,shot.width,shot.height)[0],v).y+16}>CAMERA · frame {frame}{c.keys.some(k=>k.frame===frame)?' · KEY':''}</text>
  </>}
 </svg>;
});

const num=(s:string,f:number)=>{const n=parseFloat(s);return Number.isFinite(n)?n:f;};
export function SceneCameraPanel({project,frame,frameCount,renderer,activeLayerId,onCommit,onGoToFrame}:{project:Project;frame:number;frameCount:number;renderer?:LayerRenderer;activeLayerId:string;onCommit:(p:Project,label:string)=>void;onGoToFrame:(frame:number)=>void}){
 const shot=shotFrame(project);
 const c=project.camera,state=cameraAt(c,frame,shot.width,shot.height,shot.x,shot.y),key=c?.keys.find(k=>k.frame===frame);
 const preview=useRef<HTMLCanvasElement>(null);
 const update=(cam:SceneCamera,label:string)=>onCommit({...project,camera:cam},label);
 /** Editing any value at a frame without a key makes a key there (auto-key, like pro tools). */
 const edit=(patch:Partial<CameraState>&{ease?:CameraEase})=>{const cam=c??newSceneCamera();update(setCameraKey(cam,{frame,...state,ease:key?.ease??'ease-in-out',...patch}),'Camera key');};
 useEffect(()=>{const el=preview.current;if(!el||!renderer||!c?.enabled)return;let stop=false;const id=requestAnimationFrame(()=>{if(stop)return;try{const w=el.width,h=el.height,out=renderer.compositeCamera(project,frame,{width:w,height:h});const x=el.getContext('2d')!;x.clearRect(0,0,w,h);x.drawImage(out,0,0);}catch{/* preview only */}});return ()=>{stop=true;cancelAnimationFrame(id);};},[project,frame,renderer,c?.enabled]);
 if(!c)return <div className="scene-camera-panel"><div className="section-caption">SCENE CAMERA</div><p className="camera-help">A camera you can move over the drawing: truck, push in/out, roll, multiplane depth, keys with easing. Export can go through the camera.</p><button className="primary-button" onClick={()=>update(newSceneCamera(),'Add scene camera')}>Add scene camera</button></div>;
 const keys=sortedKeys(c),prev=[...keys].reverse().find(k=>k.frame<frame),next=keys.find(k=>k.frame>frame),depth=layerDepth(c,activeLayerId);
 const field=(label:string,value:number,step:number,apply:(n:number)=>void,unit='')=><label className="camera-field-row">{label}<input aria-label={'Camera '+label} type="number" step={step} value={Math.round(value*100)/100} onChange={e=>apply(num(e.target.value,value))}/>{unit}</label>;
 return <div className="scene-camera-panel">
  <div className="section-caption">SCENE CAMERA · FRAME {frame}/{frameCount}{key?' · KEY':''}</div>
  <label className="camera-check"><input type="checkbox" checked={c.enabled} onChange={e=>update({...c,enabled:e.target.checked},e.target.checked?'Show camera':'Hide camera')}/>Camera on (frame + preview + export option)</label>
  {c.enabled&&<canvas ref={preview} className="camera-preview" width={320} height={Math.max(1,Math.round(320*shot.height/shot.width))} aria-label="Camera preview"/>}
  <div className="camera-grid">
   {field('X (truck)',state.x,10,x=>edit({x}),'px')}
   {field('Y (pedestal)',state.y,10,y=>edit({y}),'px')}
   {field('Zoom',state.zoom*100,5,z=>edit({zoom:clampZoom(z/100)}),'%')}
   {field('Roll',state.rotation,1,rotation=>edit({rotation}),'°')}
  </div>
  <div className="camera-buttons">
   <button onClick={()=>edit({})} title="Save the camera at this frame">{key?'Update key':'Set key'}</button>
   <button disabled={!key} onClick={()=>update(deleteCameraKey(c,frame),'Delete camera key')}>Delete key</button>
   <button onClick={()=>edit({...homeCamera(shot.width,shot.height,shot.x,shot.y)})} title="Original shot, no zoom, no roll">Reset view</button>
  </div>
  <label className="camera-field-row camera-scrub">Frame<input aria-label="Camera frame" type="range" min={1} max={Math.max(1,frameCount)} value={frame} onChange={e=>onGoToFrame(+e.target.value)}/><span>{frame}</span></label>
  <div className="camera-buttons">
   <button disabled={!prev} onClick={()=>prev&&onGoToFrame(prev.frame)}>◀ Prev key</button>
   <button disabled={!next} onClick={()=>next&&onGoToFrame(next.frame)}>Next key ▶</button>
  </div>
  <label className="camera-field-row">Ease to next key<select aria-label="Camera ease" disabled={!key} value={key?.ease??'ease-in-out'} onChange={e=>edit({ease:e.target.value as CameraEase})}>{CAMERA_EASES.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
  <div className="section-caption">MULTIPLANE (ACTIVE LAYER)</div>
  <label className="camera-field-row">Depth (Z)<input aria-label="Layer camera depth" type="number" step={.1} min={-.9} max={50} value={depth} onChange={e=>update({...c,depth:{...c.depth,[activeLayerId]:clampDepth(num(e.target.value,depth))}},'Layer depth')}/></label>
  <p className="camera-help">0 = moves with the camera. Bigger = farther away (moves less, like a background). Negative = nearer (moves more).</p>
  <label className="camera-check"><input type="checkbox" checked={c.safeArea} onChange={e=>update({...c,safeArea:e.target.checked},'Camera safe area')}/>Safe areas (action 90%, title 80%)</label>
  <label className="camera-check"><input type="checkbox" checked={c.fieldGuide} onChange={e=>update({...c,fieldGuide:e.target.checked},'Camera field guide')}/>Field guide</label>
  <div className="section-caption">KEYS ({keys.length})</div>
  <div className="camera-keys">{keys.map(k=><button key={k.frame} className={k.frame===frame?'active':''} onClick={()=>onGoToFrame(k.frame)}>F{k.frame} · {Math.round(k.zoom*100)}% · {k.ease}</button>)}{!keys.length&&<span className="camera-help">No keys yet. Change a value or press Set key.</span>}</div>
 </div>;
}
