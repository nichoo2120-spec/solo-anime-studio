/** Phase 2B Tool 3: opt-in linked cel groups and project-local reusable cycles.
 * Link IDs are metadata; the referenced art always lives in the existing layer cels.
 * Cycles are snapshot templates, not hidden background playback or automatic AI.
 */
import {uid,type Operation,type Project} from '../core/model';
import {frameList,currentFrameIndex,isLayerHeld,insertLayerKey,selectDrawingFrame,addDrawingFrame,MAX_DRAWING_FRAMES} from './timeline';

export type CelLinks=Record<string,Record<string,string>>; // layer ID -> keyframe ID -> group ID
export type CycleItem={id:string;name:string;kind:'raster'|'vector';frames:Operation[][]};
export type CycleShelf={version:1;items:CycleItem[]};
export const MAX_CYCLES=16,MAX_CYCLE_CELS=16,MAX_CYCLE_REPEATS=4,MAX_CYCLE_OPERATIONS=1500;
export const cycleItems=(p:Project)=>p.cycleShelf?.items??[];
export function linkedGroup(p:Project,layerId=p.activeLayerId,frameId=p.animation?.activeFrameId){
 if(!frameId)return null;
 const frames=frameList(p),index=frames.findIndex(f=>f.id===frameId);
 if(index<0)return null;
 let key=index;
 while(key>0&&isLayerHeld(p,layerId,frames[key].id))key--;
 return p.animation?.celLinks?.[layerId]?.[frames[key].id]??null;
}
export function linkedCount(p:Project,layerId=p.activeLayerId){
 const group=linkedGroup(p,layerId);
 return group?Object.values(p.animation?.celLinks?.[layerId]??{}).filter(id=>id===group).length:0;
}
/** Pure, bounded cleanup of orphan members after frame deletion/hold changes. */
export function cleanCelLinks(p:Project,frames=frameList(p)):CelLinks|undefined{
 const input=p.animation?.celLinks;if(!input)return undefined;
 const existing=new Set(frames.map(f=>f.id));const validLayer=new Set(p.layers.map(l=>l.id));
 const result:CelLinks={};
 for(const [layer,links] of Object.entries(input)){
  if(!validLayer.has(layer))continue;
  const retained=Object.entries(links).filter(([id])=>existing.has(id)&&!isLayerHeld(p,layer,id));
  const counts=new Map<string,number>();for(const [,group] of retained)counts.set(group,(counts.get(group)??0)+1);
  const pairs=retained.filter(([,group])=>(counts.get(group)??0)>=2);
  if(pairs.length)result[layer]=Object.fromEntries(pairs);
 }
 return Object.keys(result).length?result:undefined;
}
/** Source can be a held cel (links its underlying key). Target is split before linking. */
export function linkCurrentCelToFrame(project:Project,targetFrameId:string):Project{
 const layer=project.layers.find(l=>l.id===project.activeLayerId);
 if(!layer||layer.locked||!layer.visible||layer.reference)throw Error('Choose an unlocked, visible drawing layer.');
 const frames=frameList(project),currentIndex=currentFrameIndex(project);
 const targetIndex=frames.findIndex(f=>f.id===targetFrameId);
 if(targetIndex<0||targetIndex===currentIndex)throw Error('Choose a different destination frame.');
 let sourceIndex=currentIndex;while(sourceIndex>0&&isLayerHeld(project,layer.id,frames[sourceIndex].id))sourceIndex--;
 if(sourceIndex===targetIndex)throw Error('Cannot link a drawing to its own held cel.');
 if(linkedGroup(project,layer.id,targetFrameId))throw Error('The destination is already linked. Unlink it first.');
 const sourceId=frames[sourceIndex].id;
 const p0=isLayerHeld(project,layer.id,targetFrameId)?insertLayerKey(project,layer.id,targetFrameId,false):project;
 const a=p0.animation;if(!a)throw Error('Create animation frames before linking drawings.');
 const existing=a.celLinks??{},map={...(existing[layer.id]??{})};
 const group=map[sourceId]??uid();map[sourceId]=group;map[targetFrameId]=group;
 const art=a.frames.find(f=>f.id===sourceId)!.drawings[layer.id]??[];
 const next=a.frames.map(f=>f.id===targetFrameId?{...f,drawings:{...f.drawings,[layer.id]:art}}:f);
 return {...p0,animation:{...a,frames:next,celLinks:{...existing,[layer.id]:map}}};
}
/** Unlink the current key, not all group members. It becomes independently editable. */
export function unlinkCurrentCel(project:Project):Project{
 const a=project.animation;if(!a||!linkedGroup(project))return project;
 const layerId=project.activeLayerId,frames=a.frames;let index=currentFrameIndex(project);
 while(index>0&&isLayerHeld(project,layerId,frames[index].id))index--;
 const currentId=frames[index].id,map={...(a.celLinks?.[layerId]??{})};delete map[currentId];
 const groupMap={...a.celLinks,[layerId]:map};
 const result={...project,animation:{...a,celLinks:groupMap}};
 const cleaned=cleanCelLinks(result);
 return {...result,animation:{...result.animation!,celLinks:cleaned}};
}
/** Capture explicit inclusive drawing-cel indices; timeline holds never create duplicate art. */
export function saveDrawingCycleRange(project:Project,name:string,startIndex:number,endIndex:number):Project{
 const label=name.trim(),layer=project.layers.find(l=>l.id===project.activeLayerId);
 if(!label||label.length>60)throw Error('Name the cycle (up to 60 characters).');
 const frames=frameList(project),length=endIndex-startIndex+1;
 if(!Number.isInteger(startIndex)||!Number.isInteger(endIndex)||startIndex<0||endIndex>=frames.length||length<2||length>MAX_CYCLE_CELS)
  throw Error('Choose 2–16 consecutive drawing frames in a valid Start–End range.');
 if(!layer||layer.reference)throw Error('Choose a drawing layer.');
 if(cycleItems(project).length>=MAX_CYCLES)throw Error('Cycle shelf is full (16 cycles).');
 const snapshots=frames.slice(startIndex,endIndex+1).map(f=>f.drawings[layer.id]??[]);
 if(snapshots.every(ops=>ops.length===0))throw Error('The selected range contains no drawing strokes.');
 if(snapshots.some(ops=>ops.length>MAX_CYCLE_OPERATIONS))throw Error('Cycle cel is too large (1,500 operations maximum).');
 const item:CycleItem={id:uid(),name:label,kind:layer.kind==='vector'?'vector':'raster',frames:snapshots};
 return {...project,cycleShelf:{version:1,items:[...cycleItems(project),item]}};
}
/** Backward-compatible convenience API for the prior consecutive-from-current workflow. */
export function saveDrawingCycle(project:Project,name:string,length:number):Project{
 const start=currentFrameIndex(project);
 return saveDrawingCycleRange(project,name,start,start+length-1);
}
export function deleteDrawingCycle(project:Project,id:string):Project{
 const items=cycleItems(project);if(!items.some(c=>c.id===id))return project;
 return {...project,cycleShelf:{version:1,items:items.filter(i=>i.id!==id)}};
}
/** Applies independent copies to the active layer from the current frame forward.
 * Extends the timeline if needed. Existing art requires explicit allowReplace.
 * Destination frame timing and other layers are never modified by the cycle.
 */
export function insertDrawingCycle(project:Project,id:string,repeats=1,allowReplace=false):Project{
 const cycle=cycleItems(project).find(item=>item.id===id);
 if(!cycle)throw Error('Cycle is no longer saved.');
 if(!Number.isInteger(repeats)||repeats<1||repeats>MAX_CYCLE_REPEATS)throw Error('Use 1–4 repeats.');
 const layer=project.layers.find(l=>l.id===project.activeLayerId);
 if(!layer||layer.locked||!layer.visible||layer.reference)throw Error('Choose an unlocked visible drawing layer.');
 if((layer.kind==='vector'?'vector':'raster')!==cycle.kind)throw Error('Cycle and destination layer must have matching raster/vector types.');
 const initialFrames=frameList(project),start=currentFrameIndex(project),needed=cycle.frames.length*repeats;
 if(start+needed>MAX_DRAWING_FRAMES)throw Error('This cycle exceeds the 240-drawing-frame limit.');
 if(!allowReplace&&initialFrames.slice(start,start+needed).some(f=>(f.drawings[layer.id]??[]).length>0))throw Error('Destination contains artwork. Confirm replacement to continue.');
 const activeId=initialFrames[start].id;
 let next=project;
 // Extend at the END only. addDrawingFrame preserves all other layers' independent holds.
 while(frameList(next).length<start+needed){const tail=frameList(next).at(-1)!;next=selectDrawingFrame(next,tail.id);next=addDrawingFrame(next);}
 next=selectDrawingFrame(next,activeId);
 for(let k=0;k<needed;k++){
  const target=frameList(next)[start+k];
  if(isLayerHeld(next,layer.id,target.id))next=insertLayerKey(next,layer.id,target.id,false);
  const animation=next.animation!;
  const strokes=cycle.frames[k%cycle.frames.length].map(op=>({...op,id:uid()}));
  const frames=animation.frames.map(f=>f.id===target.id?{...f,drawings:{...f.drawings,[layer.id]:strokes}}:f);
  // Cycle paste makes independent keys: do not propagate to previously linked copies.
  const linkMap=animation.celLinks?.[layer.id];
  const links=linkMap?.[target.id]?{...animation.celLinks,[layer.id]:Object.fromEntries(Object.entries(linkMap).filter(([fid])=>fid!==target.id))}:animation.celLinks;
  next={...next,animation:{...animation,frames,celLinks:links}};
 }
 if(next.animation){const cleaned=cleanCelLinks(next);next={...next,animation:{...next.animation,celLinks:cleaned}};}
 // Re-select without a sync that would restore an obsolete active-layer snapshot.
 const active=next.animation!.frames.find(f=>f.id===activeId)!;
 return {...next,animation:{...next.animation!,activeFrameId:activeId},layers:next.layers.map(l=>({...l,operations:active.drawings[l.id]??[]}))};
}
