import {memo,useMemo,useState,type PointerEvent as ReactPointerEvent} from 'react';
import type {View} from '../core/geometry';
import {toProject,toScreen} from '../core/geometry';
import {depthScaleFactors,type DepthEditMode,type DepthFrame} from '../animation/progressiveScale';
import {FloatingTransformPanel} from './FloatingTransformPanel';

type Bounds={x:number;y:number;w:number;h:number};
export type DepthPreviewFrame=DepthFrame&{number:number;bounds:Bounds;paths:{d:string;width:number}[]};
type Drag={pointer:number;startDistance:number;startScale:number;focusId:string};
const clamp=(v:number)=>Math.max(.25,Math.min(3,v));
/** Draw lightweight SVG stroke ghosts for ALL selected frames during drag.
 * No drawing engine commits and no high-resolution bitmap repaints until Apply.
 */
export const ProgressiveScaleCanvas=memo(function ProgressiveScaleCanvas({view,frames,initialFocus,onFocusFrame,onApply,onCancel}: {
 view:View;frames:DepthPreviewFrame[];initialFocus:string;onFocusFrame:(id:string)=>void;
 onApply:(factors:Record<string,number>)=>string|null;onCancel:()=>void;
}){
 const [focus,setFocus]=useState(()=>frames.some(f=>f.id===initialFocus)?initialFocus:frames.at(-1)?.id??'');
 const [anchors,setAnchors]=useState<Record<string,number>>({});
 const [mode,setMode]=useState<DepthEditMode>('auto');
 const [drag,setDrag]=useState<Drag|null>(null);
 const [error,setError]=useState('');
 const factors=useMemo(()=>depthScaleFactors(frames,focus,anchors,mode),[frames,focus,anchors,mode]);
 const current=frames.find(f=>f.id===focus)??frames[0];
 if(!current)return null;
 const box=current.bounds,scale=anchors[focus]??1;
 const pivot={x:box.x+box.w/2,y:box.y+box.h};
 const transform=(p:{x:number;y:number})=>toScreen({x:pivot.x+(p.x-pivot.x)*scale,y:pivot.y+(p.y-pivot.y)*scale},view);
 const corners=[{x:box.x,y:box.y},{x:box.x+box.w,y:box.y},{x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h}].map(transform);
 const local=(e:ReactPointerEvent<SVGSVGElement>)=>{const rect=e.currentTarget.getBoundingClientRect();return toProject({x:e.clientX-rect.left,y:e.clientY-rect.top},view);};
 const pointerDistance=(p:{x:number;y:number})=>Math.max(2,Math.hypot(p.x-pivot.x,p.y-pivot.y));
 const setSize=(id:string,value:number)=>{setAnchors(old=>({...old,[id]:clamp(value)}));setError('');};
 const down=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(e.button!==0||drag||(e.target as Element).getAttribute('data-depth-handle')!=='scale')return;
  e.preventDefault();e.stopPropagation();setDrag({pointer:e.pointerId,startDistance:pointerDistance(local(e)),startScale:scale,focusId:focus});e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();
  setSize(drag.focusId,drag.startScale*pointerDistance(local(e))/drag.startDistance);
 };
 const end=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();
  if(e.type==='pointerup')setSize(drag.focusId,drag.startScale*pointerDistance(local(e))/drag.startDistance);
  setDrag(null);
 };
 return <>
  <svg className="batch-canvas-overlay" aria-label="Progressive Depth Scale preview on all frames"
   onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
   {/* Preview every selected frame; hard-limited at source extraction to avoid pen lag. */}
   {frames.map((frame,i)=>{
    const size=factors[frame.id]??1,b=frame.bounds,at=toScreen({x:b.x+b.w/2,y:b.y+b.h},view);
    return <g key={frame.id} style={{pointerEvents:'none',opacity:frame.id===focus?.94:.55}} transform={`translate(${at.x} ${at.y}) scale(${size}) translate(${-at.x} ${-at.y})`}>
     {frame.paths.map((path,j)=><path key={j} d={path.d} stroke={frame.id===focus?'#94ffe0':i%2?'#f5b78b':'#94c9ff'} strokeWidth={Math.max(1,path.width*view.zoom)} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}
     <text x={at.x} y={at.y+16} textAnchor="middle" className="batch-canvas-value">F{frame.number} {Math.round(size*100)}%</text>
    </g>;
   })}
   <polygon points={corners.map(p=>`${p.x},${p.y}`).join(' ')} className="batch-canvas-outline" style={{pointerEvents:'none'}}/>
   {corners.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={13} data-depth-handle="scale" className="batch-canvas-handle" style={{pointerEvents:'all',cursor:'nwse-resize'}}/>)}
   <text x={corners[1].x+15} y={corners[1].y-10} className="batch-canvas-value" style={{pointerEvents:'none'}}>FRAME {current.number} {Math.round(scale*100)}%</text>
  </svg>
  <FloatingTransformPanel id="depth" className="depth-scale-controls" label="Depth Scale for any selected frame">
   <strong>DEPTH</strong>
   <label className="depth-size-input">Edit frame <select aria-label="Depth target frame" value={focus} onChange={e=>{setFocus(e.target.value);setError('');onFocusFrame(e.target.value);}}>{frames.map(f=><option key={f.id} value={f.id}>Frame {f.number}</option>)}</select></label>
   <button type="button" className={mode==='auto'?'active':''} onClick={()=>{setMode('auto');setError('');}}>Auto · All</button>
   <button type="button" className={mode==='independent'?'active':''} onClick={()=>{setMode('independent');setError('');}}>Only this frame</button>
   <label className="depth-size-input">Size % <input aria-label="Current frame size percent" type="number" min="25" max="300" step="5" value={Math.round(scale*100)} onChange={e=>setSize(focus,Number(e.target.value)/100)}/></label>
   <button type="button" className="depth-apply" onClick={()=>{const issue=onApply(factors);setError(issue??'');}} disabled={Object.values(factors).every(n=>Math.abs(n-1)<.0001)}>Apply</button>
   <button type="button" onClick={onCancel}>Cancel</button>
   {error&&<small className="depth-error" role="alert">{error}</small>}
   <small>Drag a teal corner. Other selected drawings preview instantly. Auto blends sizes; Only this frame leaves others unchanged. Apply saves one Undo step.</small>
  </FloatingTransformPanel>
 </>;
});
