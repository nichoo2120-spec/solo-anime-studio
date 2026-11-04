/** Uniform size progression over independent selected drawing cels.
 * Deliberately NOT a perspective corner warp or automatic anatomy generation:
 * scale stays identical on X and Y, anchored at the drawing's footline.
 * Runs only on explicit Apply, never during pointer movement or live inking.
 */
import type {Project, Matrix, Operation} from '../core/model';
import {frameList,isLayerHeld} from './timeline';
import {boundsOf,transformedStroke,mapPoint} from '../engine/strokeSelection';
import {transformVector} from '../engine/vector';
import {MAX_BATCH_CELS} from './batchTransform';

export type ProgressiveScaleResult={project:Project;changed:number;reason?:string};
const clamp=(v:number)=>Math.max(.25,Math.min(3,v));
export const progressiveFactor=(first:number,last:number,t:number)=>first+(last-first)*Math.max(0,Math.min(1,t));
/** Keep the original first/last API for saved scripts and older tests. */
export function progressiveScaleCels(project:Project,frameIds:readonly string[],layerIds:readonly string[],firstScale:number,lastScale:number):ProgressiveScaleResult {
 if(!Number.isFinite(firstScale)||!Number.isFinite(lastScale)||firstScale<.25||firstScale>3||lastScale<.25||lastScale>3)
  return {project,changed:0,reason:'Set each endpoint size between 25% and 300%.'};
 const frames=frameList(project),indices=new Map(frames.map((f,i)=>[f.id,i]));
 const selected=[...new Set(frameIds)].filter(id=>indices.has(id)).sort((a,b)=>indices.get(a)!-indices.get(b)!);
 if(selected.length<2)return {project,changed:0,reason:'Select at least two drawing frames.'};
 const a=indices.get(selected[0])!,b=indices.get(selected[selected.length-1])!;
 return progressiveScaleFrameFactors(project,frameIds,layerIds,Object.fromEntries(selected.map(id=>[id,progressiveFactor(firstScale,lastScale,(indices.get(id)!-a)/(b-a))])));
}

export type DepthFrame={id:string;order:number};
export type DepthEditMode='auto'|'independent';
/** Build frame factors around ANY chosen frame, with editable anchors.
 * Auto: interpolate to neighboring anchors and hold endpoints unless explicitly edited.
 * Independent: affect only the chosen frame.
 */
export function depthScaleFactors(frames:readonly DepthFrame[],focusId:string,anchors:Readonly<Record<string,number>>,mode:DepthEditMode):Record<string,number>{
 const sorted=[...frames].sort((a,b)=>a.order-b.order),out:Record<string,number>={};
 if(!sorted.length)return out;
 if(mode==='independent')return Object.fromEntries(sorted.map(frame=>[frame.id,frame.id===focusId?(anchors[focusId]??1):1]));
 const keys=sorted.filter(f=>Number.isFinite(anchors[f.id]));
 if(!keys.some(f=>f.id===sorted[0].id))keys.unshift(sorted[0]);
 if(!keys.some(f=>f.id===sorted[sorted.length-1].id))keys.push(sorted[sorted.length-1]);
 keys.sort((a,b)=>a.order-b.order);
 for(const frame of sorted){let i=0;while(i<keys.length-2&&frame.order>keys[i+1].order)i++;
  const from=keys[i],to=keys[Math.min(i+1,keys.length-1)];
  const t=to.order===from.order?0:(frame.order-from.order)/(to.order-from.order);
  out[frame.id]=progressiveFactor(anchors[from.id]??1,anchors[to.id]??1,t);
 }
 return out;
}

/** One atomic edit. Factors are precomputed for selected frames; no pen-move model writes. */
export function progressiveScaleFrameFactors(project:Project,frameIds:readonly string[],layerIds:readonly string[],factors:Readonly<Record<string,number>>):ProgressiveScaleResult {
 if(frameIds.some(id=>!Number.isFinite(factors[id]??1)||(factors[id]??1)<.25||(factors[id]??1)>3))
  return {project,changed:0,reason:'Keep all frame sizes between 25% and 300%.'};
 if(frameIds.every(id=>Math.abs((factors[id]??1)-1)<.00001))return {project,changed:0,reason:'Change the selected frame size before applying.'};
 if(!project.animation)return {project,changed:0,reason:'Open the animation timeline first.'};
 const frames=frameList(project),indices=new Map(frames.map((f,i)=>[f.id,i]));
 const selected=[...new Set(frameIds)].filter(id=>indices.has(id)).sort((a,b)=>indices.get(a)!-indices.get(b)!);
 const layers=[...new Set(layerIds)];
 if(selected.length!==new Set(frameIds).size||selected.length<2||!layers.length)return {project,changed:0,reason:'Select at least two valid independent drawing frames.'};
 if(selected.length*layers.length>MAX_BATCH_CELS)return {project,changed:0,reason:'Select at most 120 frame/layer cels to keep drawing responsive.'};
 if(layers.some(id=>{const l=project.layers.find(item=>item.id===id);return !l||l.locked||!l.visible||l.reference;}))
  return {project,changed:0,reason:'Choose visible, unlocked drawing layers.'};
 const patches=new Map<string,Map<string,Operation[]>>();let changed=0,opsCount=0;
 const matrices=new Map<string,Matrix>();
 // Keep an existing Motion Path aligned when the artist deliberately selects
 // every cel (and key) belonging to that path. Partial range edits would leave
 // that path inaccurate, so reject those instead of modifying only some cels.
 const selectedSet=new Set(selected);
 const attachedArcs=project.motionPlanning?.arcs.filter(arc=>layers.includes(arc.layerId)&&arc.bindings?.some(binding=>selectedSet.has(binding.frameId)))??[];
 for(const arc of attachedArcs){
  if((arc.bindings??[]).some(binding=>!selectedSet.has(binding.frameId))||arc.points.some(point=>!selectedSet.has(point.frameId)))
   return {project,changed:0,reason:'This Motion Path continues outside the selected frames. Select its complete frame range before Depth Scale.'};
 }
 // Validate everything before changing anything: never silently partially modify a timeline.
 for(const frameId of selected){const frame=frames[indices.get(frameId)!];const scale=clamp(factors[frameId]??1);
  // A character can span Ink/Color/Detail layers: share one foot pivot across
  // every selected layer so the parts stay aligned after scaling.
  const allOps=layers.flatMap(id=>frame.drawings[id]??[]).filter(op=>op.kind==='stroke'||op.kind==='vector');
  const groupBounds=boundsOf(allOps);const cx=groupBounds?groupBounds.x+groupBounds.w/2:0,foot=groupBounds?groupBounds.y+groupBounds.h:0;
  for(const layerId of layers){if(isLayerHeld(project,layerId,frameId)||project.animation.celLinks?.[layerId]?.[frameId])
   return {project,changed:0,reason:'A selected cel is held or linked. Use Option+K to make it independent first.'};
   const ops=frame.drawings[layerId]??[];if(!ops.length)continue;
   if(ops.some(op=>!(op.kind==='stroke'&&op.tool==='brush')&&op.kind!=='vector'))
    return {project,changed:0,reason:'Depth Scale currently supports brush/vector drawings only; raster fills and erased/image cels stay protected.'};
   opsCount+=ops.length;if(opsCount>8000)return {project,changed:0,reason:'Too many strokes selected; use fewer frames to prevent lag.'};
   if(!groupBounds||Math.abs(scale-1)<.00001)continue;
   // Bottom-centre anchor prevents feet and ground contact from drifting vertically.
   const matrix:Matrix=[scale,0,0,scale,cx*(1-scale),foot*(1-scale)];
   matrices.set(frameId,matrix);
   const transformed=ops.map(op=>op.kind==='stroke'?transformedStroke(op,matrix):op.kind==='vector'?transformVector(op,matrix):op);
   if(!patches.has(frameId))patches.set(frameId,new Map());patches.get(frameId)!.set(layerId,transformed);changed++;
  }
 }
 if(!changed)return {project,changed:0,reason:'No editable artwork changed. Check your selected layers.'};
 const updated=project.animation.frames.map(f=>{const patch=patches.get(f.id);return patch?{...f,drawings:{...f.drawings,...Object.fromEntries(patch)}}:f;});
 const activePatch=patches.get(project.animation.activeFrameId);
 const activeLayers=activePatch?project.layers.map(l=>activePatch.has(l.id)?{...l,operations:activePatch.get(l.id)!}:l):project.layers;
 // Transform path anchor positions with their drawings in the same Undo step.
 // We retain the artist's extra curve-shaping dots as local offsets from that path.
 const motionPlanning=project.motionPlanning&&attachedArcs.length?{
  ...project.motionPlanning,
  arcs:project.motionPlanning.arcs.map(arc=>attachedArcs.some(a=>a.id===arc.id)?{
   ...arc,points:arc.points.map(point=>{
    const m=matrices.get(point.frameId);return m?{...point,...mapPoint(point,m)}:point;
   })
  }:arc)
 }:project.motionPlanning;
 return {project:{...project,animation:{...project.animation,frames:updated},layers:activeLayers,...(motionPlanning?{motionPlanning}:{})},changed};
}
