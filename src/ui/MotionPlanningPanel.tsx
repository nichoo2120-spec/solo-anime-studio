import {memo,useEffect,useState} from 'react';
import {Plus,Trash2,MapPinned} from 'lucide-react';
import {motionPathMode,type MotionPathMode,type MotionPlanning,type MotionArc} from '../animation/motionPlanning';

/** The common path workflow is three steps; setup-heavy per-cel tools remain
 * available in a collapsed Advanced section for character parts sharing a layer.
 * No path calculation happens while drawing, only on explicit user interaction. */
export const MotionPlanningPanel=memo(function MotionPlanningPanel({planning,frameId,frameName,layerName,disabled,selectedStrokeCount,frames,editingPoints,onEditingPoints,addingDot,onAddingDot,selectedDotId,onRemoveDot,showDuringPlayback,onShowDuringPlayback,editWhilePlaying,onEditWhilePlaying,selectedFrameIndices,activeArcId,onArcSelected,onModeChange,onQuickCreate,onBindSelection,onBindLayerRange,onUnbind,onApplyArc,onSaveNote,onNewArc,onDeleteArc,onCapturePoint,onSetPoint,onDeletePoint}:{
 planning?:MotionPlanning;frameId:string;frameName:string;layerName:string;disabled:boolean;selectedStrokeCount:number;
 frames:{id:string;index:number}[];selectedFrameIndices:number[];editingPoints:boolean;activeArcId?:string;onEditingPoints:(enabled:boolean)=>void;
 addingDot:boolean;onAddingDot:(enabled:boolean)=>void;selectedDotId?:string;onRemoveDot:(arcId:string,dotId:string)=>void;
 showDuringPlayback:boolean;onShowDuringPlayback:(enabled:boolean)=>void;editWhilePlaying:boolean;onEditWhilePlaying:(enabled:boolean)=>void;onArcSelected:(arcId:string)=>void;
 onModeChange:(arcId:string,mode:MotionPathMode)=>void;onQuickCreate:(start:number,end:number)=>void;
 onBindSelection:(arcId:string)=>void;onBindLayerRange:(arcId:string,start:number,end:number)=>void;onUnbind:(arcId:string)=>void;onApplyArc:(arcId:string)=>void;
 onSaveNote:(text:string)=>void;onNewArc:(name:string)=>void;onDeleteArc:(id:string)=>void;
 onCapturePoint:(id:string)=>void;onSetPoint:(id:string,x:number,y:number)=>void;onDeletePoint:(id:string)=>void;
}){
 const current=planning?.notes.find(n=>n.frameId===frameId)?.text??'';
 const [draft,setDraft]=useState(current),[newName,setNewName]=useState('Motion path');
 const [x,setX]=useState('0'),[y,setY]=useState('0');
 const [rangeStart,setRangeStart]=useState(0),[rangeEnd,setRangeEnd]=useState(Math.max(0,frames.length-1));
 const arcs=planning?.arcs??[];
 const active=arcs.find(a=>a.id===activeArcId)??arcs.at(-1);
 useEffect(()=>{setRangeEnd(frames.length-1);setRangeStart(0);},[frames.length]);
 const selectedFrameKey=selectedFrameIndices.slice().sort((a,b)=>a-b).join(',');
 useEffect(()=>{
  const picked=selectedFrameKey.split(',').map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<frames.length);
  if(picked.length>1){setRangeStart(Math.min(...picked));setRangeEnd(Math.max(...picked));}
 },[selectedFrameKey,frames.length]);
 const currentPoint=active?.points.find(point=>point.frameId===frameId);
 useEffect(()=>setDraft(current),[current,frameId]);
 useEffect(()=>{setX(String(Math.round(currentPoint?.x??0)));setY(String(Math.round(currentPoint?.y??0)));},[currentPoint?.x,currentPoint?.y,frameId,active?.id]);
 const pointActions=(arc:MotionArc)=><div className="motion-point-actions">
  <button disabled={disabled} onClick={()=>onCapturePoint(arc.id)} title="Capture a selected stroke center or active layer center"><MapPinned size={13}/> Capture pose center</button>
  <div className="motion-coordinate-row"><label>X <input type="number" aria-label="Motion point X" value={x} onChange={e=>setX(e.target.value)}/></label><label>Y <input type="number" aria-label="Motion point Y" value={y} onChange={e=>setY(e.target.value)}/></label></div>
  <div className="motion-actions"><button disabled={disabled||!Number.isFinite(Number(x))||!Number.isFinite(Number(y))} onClick={()=>onSetPoint(arc.id,Number(x),Number(y))}>Set X / Y</button><button disabled={disabled||!currentPoint} onClick={()=>onDeletePoint(arc.id)}>Remove point</button></div>
 </div>;
 return <div className="motion-planning" role="region" aria-label="Timing Notes and Motion Path Assist">
  <strong className="motion-title">MOTION PATH ASSIST</strong>
  <p className="hint">Fix the path of a bouncing ball, moving hand or other selected drawing. The curve is a guide, not part of your export.</p>
  <div className="motion-easy-steps">
   <div><b>1. Select</b><span>Press <kbd>S</kbd> and select the ball or hand on the current frame (layer: <b>{layerName}</b>).</span></div>
   <div><b>2. Choose frames</b><div className="motion-coordinate-row">
    <label>From<select aria-label="Motion path start frame" value={rangeStart} onChange={e=>{const n=Number(e.target.value);setRangeStart(n);if(n>rangeEnd)setRangeEnd(n);}}>{frames.map(f=><option key={f.id} value={f.index}>Frame {f.index+1}</option>)}</select></label>
    <label>To<select aria-label="Motion path end frame" value={rangeEnd} onChange={e=>{const n=Number(e.target.value);setRangeEnd(n);if(n<rangeStart)setRangeStart(n);}}>{frames.map(f=><option key={f.id} value={f.index}>Frame {f.index+1}</option>)}</select></label>
   </div></div>
   <div><b>3. Create &amp; drag</b><button className="full-width accent-button" disabled={disabled||selectedStrokeCount===0||rangeEnd<=rangeStart||arcs.length>=12} onClick={()=>onQuickCreate(rangeStart,rangeEnd)}><Plus size={15}/> Create Motion Path</button></div>
  </div>
  <small className="motion-caption">{selectedStrokeCount?`${selectedStrokeCount} selected stroke${selectedStrokeCount===1?'':'s'} · `:'Select artwork with S first · '}Draw the moving part on its own layer to link all frames automatically. Other artwork stays untouched.</small>
  {active&&<>
   <div className="motion-divider"/>
   <label className="motion-label">Current path<select aria-label="Select motion arc" value={active.id} onChange={e=>onArcSelected(e.target.value)}>{arcs.map(a=><option key={a.id} value={a.id}>{a.name} · {a.bindings?.length??0} frames</option>)}</select></label>
   <p className="hint">Drag the <b>teal curve</b> or its round handles on the canvas. Release the pen to update the drawings.</p>
   <label className="check-row"><span>Edit path on canvas</span><input type="checkbox" checked={editingPoints} onChange={e=>onEditingPoints(e.target.checked)}/></label>
   <div className="motion-actions">
    <button className={addingDot?'mode-selected':''} aria-pressed={addingDot} disabled={disabled} onClick={()=>{onEditingPoints(true);onAddingDot(!addingDot);}}><Plus size={14}/> {addingDot?'Adding dots · click to finish':'Add motion dot'}</button>
    <button disabled={disabled||!selectedDotId} title="Tap a new motion dot to select it" onClick={()=>{if(selectedDotId)onRemoveDot(active.id,selectedDotId);}}><Trash2 size={13}/> Remove selected dot</button>
   </div>
   <small className="motion-caption">Click <b>Add motion dot</b> once to tap several dots along the teal curve. Click it again or press <kbd>Esc</kbd> to finish placing dots, then drag any dot to bend the path. Adding dots alone never moves your drawings. Maximum 16 extra dots.</small>
   <label className="check-row"><span>Show path during playback</span><input aria-label="Show motion path during playback" type="checkbox" checked={showDuringPlayback} onChange={e=>onShowDuringPlayback(e.target.checked)}/></label>
   <label className="check-row"><span>Edit path while playing</span><input aria-label="Edit motion path while playing" type="checkbox" checked={editWhilePlaying} onChange={e=>onEditWhilePlaying(e.target.checked)}/></label>
   <small className="motion-caption">Default: path hides while playing. Turn on Show and Edit to adjust the curve during animation; drawings update when you release the pen.</small>
   <strong className="motion-title">When I move the path...</strong>
   <div className="motion-mode-picker" role="group" aria-label="Motion path editing mode">
    <button type="button" className={motionPathMode(active)==='auto'?'mode-selected':''} aria-pressed={motionPathMode(active)==='auto'} disabled={disabled} onClick={()=>onModeChange(active.id,'auto')}>Auto · All frames</button>
    <button type="button" className={motionPathMode(active)==='independent'?'mode-selected':''} aria-pressed={motionPathMode(active)==='independent'} disabled={disabled} onClick={()=>onModeChange(active.id,'independent')}>This frame only</button>
   </div>
   <small className="motion-caption">{motionPathMode(active)==='auto'?'Other bound drawings follow the path.':'Other frames stay where they are.'} One Control+Z restores each completed edit.</small>
   <button className="motion-delete" disabled={disabled} onClick={()=>{if(window.confirm('Remove motion path “'+active.name+'”? Your drawings will be untouched.'))onDeleteArc(active.id);}}><Trash2 size={13}/> Delete path</button>
  </>}
  <details className="motion-advanced"><summary>Advanced — select a hand on a shared layer / existing paths</summary>
   <p className="hint">If the hand shares a layer with the body and changes shape between drawings, the Studio can't safely recognize it automatically. Select and bind only that hand on each frame, or put it on its own layer.</p>
   <div className="motion-create"><input value={newName} onChange={e=>setNewName(e.target.value)} maxLength={60} aria-label="New motion arc name"/><button disabled={disabled||arcs.length>=12} onClick={()=>onNewArc(newName)}><Plus size={14}/> New</button></div>
   {active&&<>
    <small className="motion-caption">Current {frameName}; {active.bindings?.length??0} frames bound.</small>
    <button className="full-width" disabled={disabled||selectedStrokeCount<1} onClick={()=>onBindSelection(active.id)}>Bind selected strokes on {frameName} ({selectedStrokeCount})</button>
    <button className="full-width" disabled={disabled} onClick={()=>onBindLayerRange(active.id,rangeStart,rangeEnd)}>Bind this layer's drawings in range</button>
    <button disabled={disabled||!active.bindings?.some(b=>b.frameId===frameId)} onClick={()=>onUnbind(active.id)}>Unbind current frame</button>
    {pointActions(active)}
    <button className="full-width" disabled={disabled||active.points.length<2||!active.bindings?.length} onClick={()=>onApplyArc(active.id)}>Fit ALL bound frames to path now</button>
   </>}
  </details>
  <details className="motion-advanced"><summary>Timing notes</summary>
   <label className="motion-label">Timing note · {frameName}<textarea aria-label="Current frame timing note" maxLength={240} rows={3} placeholder="e.g. anticipation, accent, mouth open..." value={draft} onChange={e=>setDraft(e.target.value)}/></label>
   <button className="full-width" disabled={disabled||draft===current} onClick={()=>onSaveNote(draft)}>Save timing note</button>
  </details>
 </div>;
},(a,b)=>a.planning===b.planning&&a.frameId===b.frameId&&a.frameName===b.frameName&&a.layerName===b.layerName&&a.disabled===b.disabled&&a.selectedStrokeCount===b.selectedStrokeCount&&a.editingPoints===b.editingPoints&&a.addingDot===b.addingDot&&a.selectedDotId===b.selectedDotId&&a.showDuringPlayback===b.showDuringPlayback&&a.editWhilePlaying===b.editWhilePlaying&&a.activeArcId===b.activeArcId&&a.frames.length===b.frames.length&&a.selectedFrameIndices.join(',')===b.selectedFrameIndices.join(','));
