import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {buildXsheetIndex,xsheetLayerCell,xsheetRowAt,xsheetRows,xsheetVisibleRange,sameXsheetPresentation} from '../animation/xsheet';
import {currentFrameIndex,frameHold,MAX_FRAME_HOLD} from '../animation/timeline';
import type {Project} from '../core/model';

const ROW_HEIGHT=28;
const MIN_WINDOW_HEIGHT=80;
interface Props {
 project:Project;
 selectedFrameIds:readonly string[];
 selectedLayerIds:readonly string[];
 busy:boolean;
 playbackExposure:number|null;
 onSelect:(frameId:string,layerId?:string,shift?:boolean,alt?:boolean)=>void;
 onHoldChange:(frameId:string,hold:number)=>void;
 onMakeKey:(frameId:string,layerId:string)=>void;
}
/** Vertical alternative view; preserves existing Timeline as the canonical editor.
 * Each rendered row is one EXPOSURE, not one copy of artwork.
 */
export const XsheetView=memo(function XsheetView({project,selectedFrameIds,selectedLayerIds,busy,playbackExposure,onSelect,onHoldChange,onMakeKey}:Props){
 const scroller=useRef<HTMLDivElement>(null);
 const raf=useRef<number|null>(null);
 const [viewport,setViewport]=useState({top:0,height:220});
 const frames=project.animation?.frames;
 const holds=frames?.map(frame=>frameHold(frame)).join(',')??'1';
 const ids=frames?.map(frame=>frame.id).join('|')??'legacy-first-frame';
 // Expensive art geometry is deliberately excluded from this index.
 const index=useMemo(()=>buildXsheetIndex(project),[ids,holds]);
 const selectedFrameSet=useMemo(()=>new Set(selectedFrameIds),[selectedFrameIds]);
 const selectedLayerSet=useMemo(()=>new Set(selectedLayerIds),[selectedLayerIds]);
 const selectedIndex=currentFrameIndex(project);
 const selectedExposure=index.spans[selectedIndex]?.start??1;
 const view=xsheetVisibleRange(index.total,viewport.top,viewport.height,ROW_HEIGHT);
 const rows=xsheetRows(index,view.first,view.last);
 useEffect(()=>{
  const element=scroller.current;if(!element)return;
  const resize=()=>setViewport(old=>old.height===element.clientHeight?old:{...old,height:Math.max(MIN_WINDOW_HEIGHT,element.clientHeight)});
  resize();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);
  observer?.observe(element);return()=>observer?.disconnect();
 },[]);
 // On switching to a cel via the horizontal shortcuts, keep the selected exposure visible.
 useEffect(()=>{
  const element=scroller.current;if(!element)return;
  const y=(selectedExposure-1)*ROW_HEIGHT;
  if(y<element.scrollTop||y+ROW_HEIGHT>element.scrollTop+element.clientHeight){
   element.scrollTop=Math.max(0,y-2*ROW_HEIGHT);
   setViewport(old=>({...old,top:element.scrollTop}));
  }
 },[selectedExposure]);
 useEffect(()=>()=>{if(raf.current!==null)cancelAnimationFrame(raf.current);},[]);
 const onScroll=()=>{
  if(raf.current!==null)return;
  raf.current=requestAnimationFrame(()=>{
   raf.current=null;
   const element=scroller.current;if(!element)return;
   setViewport(old=>Math.abs(old.top-element.scrollTop)<ROW_HEIGHT?old:{...old,top:element.scrollTop});
  });
 };
 return <div className="xsheet-shell" aria-label="Exposure sheet vertical view">
  <div className="xsheet-heading"><strong>EXPOSURE SHEET</strong><span>{index.total} frames · {index.spans.length} drawings</span><small>Click a layer cell to select its drawing. Shift-click selects a range; Option-click toggles individual items. Use + / − to edit holds. Click frame, then Delete / ⌫ to remove it. </small></div>
  <div className="xsheet-scroll" ref={scroller} onScroll={onScroll} role="group" aria-label="Xsheet rows">
   <div className="xsheet-cols" style={{gridTemplateColumns:`minmax(92px, 100px) repeat(${project.layers.length}, minmax(90px, 1fr))`}}>
    <span>FRAME / HOLD</span>
    {project.layers.map(layer=><span key={layer.id} title={layer.name}>{layer.name}{layer.locked?' 🔒':''}</span>)}
   </div>
   <div style={{height:index.total*ROW_HEIGHT,position:'relative',minWidth:`${100+project.layers.length*90}px`}}>
    {rows.map(row=>{
     const isActive=row.celIndex===selectedIndex;
     const playbackActive=playbackExposure===row.exposure;
     return <div key={row.exposure} className={'xsheet-row'+(selectedFrameSet.has(row.frameId)?' multi-selected':'')+(isActive?' active':'')+(playbackActive?' playing':'')+(row.start?' beginning':' held-exposure')} style={{position:'absolute',top:(row.exposure-1)*ROW_HEIGHT,height:ROW_HEIGHT,gridTemplateColumns:`minmax(92px, 100px) repeat(${project.layers.length}, minmax(90px, 1fr))`}}>
      <div className="xsheet-frame-cell">
       <button disabled={busy} className="xsheet-exposure-number" aria-label={'Go to exposure frame '+row.exposure} onClick={e=>onSelect(row.frameId,undefined,e.shiftKey,e.altKey)} title={'Frame '+row.exposure+', drawing '+(row.celIndex+1)}>{String(row.exposure).padStart(3,'0')}{row.offset>0?<span className="xsheet-inbetween">HOLD</span>:<span className="xsheet-inbetween">KEY</span>}</button>
       {row.start&&<div className="xsheet-hold-edit" aria-label={'Hold '+row.hold+' frames'}><button disabled={busy||row.hold<=1} title="Decrease hold by one frame" aria-label={'Shorten drawing '+(row.celIndex+1)} onClick={()=>onHoldChange(row.frameId,row.hold-1)}>−</button><span>{row.hold}</span><button disabled={busy||row.hold>=MAX_FRAME_HOLD} title="Increase hold by one frame" aria-label={'Extend drawing '+(row.celIndex+1)} onClick={()=>onHoldChange(row.frameId,row.hold+1)}>+</button></div>}
      </div>
      {project.layers.map(layer=>{
       const cell=xsheetLayerCell(project,row,layer.id);
       const chosen=isActive&&project.activeLayerId===layer.id;
       return <div key={layer.id} className={'xsheet-layer-slot'+(cell.held?' is-held':'')+(selectedFrameSet.has(row.frameId)&&selectedLayerSet.has(layer.id)?' multi-selected':'')+(chosen?' chosen':'')}>
        <button disabled={busy} title={`${layer.name} · Frame ${row.exposure} · ${row.offset>0?'global hold':cell.held?'linked held cel':'key cel'}`} onClick={e=>onSelect(row.frameId,layer.id,e.shiftKey,e.altKey)} aria-label={`${layer.name}, exposure ${row.exposure}${cell.held?' held':' key'}`}>{cell.label}{row.start&&<small>{cell.held?'HOLD':cell.hasArt?'ART':'BLANK'}</small>}</button>
        {row.start&&cell.held&&<button className="xsheet-split" disabled={busy||layer.locked} aria-label={`Create editable key on ${layer.name} at frame ${row.exposure}`} title="Convert held layer cel to editable key (same as Alt+K)" onClick={()=>onMakeKey(row.frameId,layer.id)}>+KEY</button>}
       </div>;
      })}
     </div>;
    })}
   </div>
  </div>
  <div className="xsheet-tip">The Xsheet and Timeline edit the same cels. Holds never duplicate your drawings. Click a frame, then Delete / ⌫ to remove it. Shift+X shows/hides the side panel.</div>
 </div>;
},(a,b)=>a.busy===b.busy&&a.playbackExposure===b.playbackExposure&&a.selectedFrameIds===b.selectedFrameIds&&a.selectedLayerIds===b.selectedLayerIds&&sameXsheetPresentation(a.project,b.project));
