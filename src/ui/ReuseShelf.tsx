import {memo,useState} from 'react';
import {Link2,Unlink,Repeat,BookmarkPlus,Trash2} from 'lucide-react';
import {MAX_CYCLE_CELS,type CycleItem} from '../animation/reuse';

export const ReuseShelf=memo(function ReuseShelf({frames,currentId,layerName,linkCount,cycles,disabled,linkTarget,onLinkTargetChange,linkShortcut,unlinkShortcut,onLink,onUnlink,onCapture,onInsert,onDelete}:{
 frames:{id:string;index:number}[];currentId:string;layerName:string;linkCount:number;cycles:CycleItem[];disabled:boolean;
 linkTarget:string;onLinkTargetChange:(id:string)=>void;linkShortcut:string;unlinkShortcut:string;onLink:(frameId:string)=>void;onUnlink:()=>void;onCapture:(name:string,startIndex:number,endIndex:number)=>boolean;
 onInsert:(id:string,repeats:number)=>void;onDelete:(id:string)=>void;
}){
 const [cycleName,setCycleName]=useState(''),[startFrame,setStartFrame]=useState(0),[endFrame,setEndFrame]=useState(Math.min(3,frames.length-1)),[repeats,setRepeats]=useState(2);
 const start=Math.min(startFrame,Math.max(0,frames.length-1));
 const end=Math.min(Math.max(endFrame,start),Math.min(frames.length-1,start+MAX_CYCLE_CELS-1));
 const selectedLength=end-start+1;
 const validRange=selectedLength>=2&&selectedLength<=MAX_CYCLE_CELS;
 const available=frames.filter(frame=>frame.id!==currentId);
 const destination=available.some(f=>f.id===linkTarget)?linkTarget:available[0]?.id??'';
 return <div className="substitution-shelf reuse-shelf" role="region" aria-label="Linked Drawings and Cycles">
  <div className="substitution-intro"><strong>LINKS & CYCLES</strong></div>
  <p className="hint">Active layer: <b>{layerName}</b>. Links share live edits across key cels; cycles insert independent copies from your saved drawings.</p>
  <div className="substitution-divider"/>
  <strong className="reuse-heading">LINKED DRAWINGS</strong><p className="hint">Shortcuts: <kbd>{linkShortcut.toUpperCase()}</kbd> Link to selected frame · <kbd>{unlinkShortcut.toUpperCase()}</kbd> Unlink current</p>
  <p className="hint">Current drawing: {linkCount>0?`linked to ${linkCount-1} other key${linkCount>2?'s':''}`:'independent'}. Linking replaces the destination's artwork. All future edits to either linked key update the others.</p>
  <label className="substitution-label">Link current drawing to
   <select value={destination} aria-label="Destination frame to link" onChange={event=>onLinkTargetChange(event.target.value)}>{available.map(f=><option key={f.id} value={f.id}>Drawing {f.index+1}</option>)}</select>
  </label>
  <div className="substitution-save-buttons">
   <button disabled={disabled||!destination} title="Link current layer's drawing to the selected frame (confirm if target has art)" onClick={()=>onLink(destination)}><Link2 size={14}/> Link to frame</button>
   <button disabled={disabled||!linkCount} title="Unlink this key to keep an independent drawing" onClick={onUnlink}><Unlink size={14}/> Unlink current</button>
  </div>
  <div className="substitution-divider"/>
  <strong className="reuse-heading">REUSABLE ANIMATION CYCLES</strong>
  <p className="hint">Choose the exact drawing-frame range to save. The start and end are inclusive, regardless of timeline hold lengths. Cycle pastes preserve destination timing and never silently overwrite artwork.</p>
  <label className="substitution-label">Cycle name<input aria-label="New cycle name" maxLength={60} placeholder="e.g. Blink 4 or Walk cycle" value={cycleName} onChange={e=>setCycleName(e.target.value)}/></label>
  <label className="substitution-label">Start drawing frame
   <select aria-label="Cycle start frame" value={start} onChange={e=>{const value=Number(e.target.value);setStartFrame(value);setEndFrame(old=>Math.min(frames.length-1,Math.max(value+1,Math.min(old,value+MAX_CYCLE_CELS-1))));}}>{frames.map(f=><option key={f.id} value={f.index}>Drawing {f.index+1}</option>)}</select>
  </label>
  <label className="substitution-label">End drawing frame
   <select aria-label="Cycle end frame" value={end} disabled={start===frames.length-1} onChange={e=>setEndFrame(Number(e.target.value))}>{frames.filter(f=>f.index>=start&&f.index<=start+MAX_CYCLE_CELS-1).map(f=><option key={f.id} value={f.index}>Drawing {f.index+1}</option>)}</select>
  </label>
  <p className="hint" role="status">{validRange?`Drawing ${start+1} through ${end+1} · ${selectedLength} cels selected`:'Choose at least two drawing frames. Maximum 16 per cycle.'}</p>
  <button className="full-width" disabled={disabled||!cycleName.trim()||!validRange||cycles.length>=16} onClick={()=>{if(onCapture(cycleName,start,end))setCycleName('');}}><BookmarkPlus size={14}/> Save selected frame range</button>
  <label className="substitution-label">Repeat selected cycle
   <select aria-label="Cycle repeat count" value={repeats} onChange={e=>setRepeats(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}×</option>)}</select>
  </label>
  <div className="substitution-cards">
   {cycles.map(item=><div className="substitution-card" key={item.id}>
    <div className="substitution-card-heading"><strong title={item.name}>{item.name}</strong><small>{item.frames.length} drawings · {item.kind} · project-local</small></div>
    <div className="substitution-card-actions"><button className="substitution-insert" disabled={disabled} title={`Insert ${repeats} repetitions into the active layer`} onClick={()=>onInsert(item.id,repeats)}><Repeat size={13}/> Insert {repeats}×</button><button disabled={disabled} title="Remove cycle from project library; previously pasted artwork remains" aria-label={'Delete cycle '+item.name} onClick={()=>{if(window.confirm('Remove “'+item.name+'” from this project? Previously inserted drawings remain.'))onDelete(item.id);}}><Trash2 size={13}/></button></div>
   </div>)}
   {!cycles.length&&<p className="hint">No cycles saved yet. Draw two or more cels, choose Start and End drawing frames, and save the range.</p>}
  </div>
  <p className="hint">Cycles repeat the drawn poses, not the frames' global hold timing. New frames are created as needed (240 maximum). Linked keys remain linked only until you choose Unlink or paste over them.</p>
 </div>;
} ,(a,b)=>a.currentId===b.currentId&&a.layerName===b.layerName&&a.linkCount===b.linkCount&&a.linkTarget===b.linkTarget&&a.linkShortcut===b.linkShortcut&&a.unlinkShortcut===b.unlinkShortcut&&a.cycles===b.cycles&&a.disabled===b.disabled&&a.frames.length===b.frames.length&&a.frames.every((f,i)=>f.id===b.frames[i].id));
