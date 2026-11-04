import {memo,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {motionBezierSegments,motionControlDotPosition,motionTargetAtTime,type MotionPlanning,type MotionArc} from '../animation/motionPlanning';
import type {View} from '../core/geometry';
import {toScreen,toProject} from '../core/geometry';

/** Path controls are purely interactive SVG. Raster drawings update only on pen-up.
 * In Add Dot mode, tapping the curve adds a shaping dot without moving artwork. */
type Drag={arcId:string;id:string;kind:'frame'|'curve'|'dot';x:number;y:number;pointerId:number;downX:number;downY:number;originX:number;originY:number};
export const MotionArcOverlay=memo(function MotionArcOverlay({planning,view,activeFrameId,frameIds,activeArcId,editing,addingDot,selectedDotId,onMovePoint,onAddDot,onMoveDot,onSelectDot}:{
 planning?:MotionPlanning;view:View;activeFrameId:string;frameIds:string[];activeArcId?:string;editing:boolean;
 addingDot:boolean;selectedDotId?:string;onMovePoint:(arcId:string,frameId:string,x:number,y:number)=>void;
 onAddDot:(arcId:string,x:number,y:number)=>void;onMoveDot:(arcId:string,dotId:string,dx:number,dy:number,frameId:string)=>void;
 onSelectDot:(dotId:string)=>void;
}){
 const [drag,setDrag]=useState<Drag|null>(null);
 if(!planning?.arcs.length)return null;
 const localPoint=(e:ReactPointerEvent<SVGElement>)=>{
  const rect=e.currentTarget.ownerSVGElement!.getBoundingClientRect();
  return toProject({x:e.clientX-rect.left,y:e.clientY-rect.top},view);
 };
 const begin=(e:ReactPointerEvent<SVGElement>,arc:MotionArc,id:string,kind:Drag['kind'],origin:{x:number;y:number})=>{
  if(!editing||arc.id!==activeArcId)return;
  e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
  const pointer=localPoint(e);
  if(kind==='dot')onSelectDot(id);
  else onSelectDot('');
  setDrag({x:origin.x,y:origin.y,arcId:arc.id,id,kind,pointerId:e.pointerId,downX:pointer.x,downY:pointer.y,originX:origin.x,originY:origin.y});
 };
 const position=(e:ReactPointerEvent<SVGElement>,d:Drag)=>{
  const pt=localPoint(e);
  return {x:d.originX+pt.x-d.downX,y:d.originY+pt.y-d.downY};
 };
 const move=(e:ReactPointerEvent<SVGElement>)=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();setDrag({...drag,...position(e,drag)});
 };
 const finish=(e:ReactPointerEvent<SVGElement>)=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();const point=position(e,drag);setDrag(null);
  if(e.type!=='pointerup'||Math.hypot(point.x-drag.originX,point.y-drag.originY)<=0.5)return;
  if(drag.kind==='dot')onMoveDot(drag.arcId,drag.id,point.x-drag.originX,point.y-drag.originY,activeFrameId);
  else onMovePoint(drag.arcId,drag.id,point.x,point.y);
 };
 const makePath=(arc:MotionArc)=>{
  const adjusted=drag?.arcId===arc.id?drag.kind==='dot'?{...arc,controlDots:arc.controlDots?.map(d=>d.id===drag.id?{...d,dx:d.dx+drag.x-drag.originX,dy:d.dy+drag.y-drag.originY}:d)}:{...arc,points:arc.points.map(p=>p.frameId===drag.id?{...p,x:drag.x,y:drag.y}:p)}:arc;
  const segments=motionBezierSegments(adjusted,frameIds);
  if(!segments.length)return '';
  const screen=(p:{x:number;y:number})=>{const s=toScreen(p,view);return `${s.x} ${s.y}`;};
  return `M${screen(segments[0].a)} `+segments.map(s=>`C${screen(s.c1)} ${screen(s.c2)} ${screen(s.b)}`).join(' ');
 };
 return <svg className="motion-arc-overlay" role="img" aria-label="Motion path guide overlay">
  {planning.arcs.map((arc:MotionArc)=>{
   const preview=drag?.arcId===arc.id?drag.kind==='dot'?{...arc,controlDots:arc.controlDots?.map(d=>d.id===drag.id?{...d,dx:d.dx+drag.x-drag.originX,dy:d.dy+drag.y-drag.originY}:d)}:{...arc,points:arc.points.map(p=>p.frameId===drag.id?{...p,x:drag.x,y:drag.y}:p)}:arc;
   const positions=preview.points.map(pt=>{const i=frameIds.indexOf(pt.frameId);return {...toScreen(i>=0?motionTargetAtTime(preview,frameIds,i)??pt:pt,view),frameId:pt.frameId};});
   const dots=(preview.controlDots??[]).map(dot=>({dot,point:motionControlDotPosition(preview,frameIds,dot)})).filter((item):item is {dot:typeof item.dot;point:{x:number;y:number}}=>item.point!==null);
   if(!positions.length)return null;
   const path=makePath(arc);
   const middle=arc.points[Math.floor(arc.points.length/2)];
   return <g key={arc.id}>
    {positions.length>=2&&<path d={path} stroke="#51ddbf" strokeWidth="2" fill="none" strokeDasharray="7 4" strokeLinecap="round" strokeLinejoin="round"/>}
    {editing&&arc.id===activeArcId&&path&&middle&&<path d={path} stroke="transparent" strokeWidth="20" fill="none" pointerEvents="stroke" style={{cursor:addingDot?'crosshair':'grab',touchAction:'none'}} aria-label={addingDot?'Tap here to add a dot':'Drag to reshape path'} onPointerDown={e=>{
      if(addingDot){e.preventDefault();e.stopPropagation();const p=localPoint(e);onAddDot(arc.id,p.x,p.y);}
      else {const origin=arc.points.find(p=>p.frameId===middle.frameId)!;begin(e,arc,middle.frameId,'curve',origin);}
    }} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/>}
    {positions.map((point,index)=><g key={point.frameId} transform={`translate(${point.x} ${point.y})`}>
     <circle r={point.frameId===activeFrameId?7:5} fill={point.frameId===activeFrameId?'#e8cf70':'#113e3b'} stroke="#7bf2d8" strokeWidth="2"/>
     <text y="-12" fill="#b4f8e8" stroke="#11232b" strokeWidth="2.5" paintOrder="stroke" fontSize="10" textAnchor="middle">{index+1}</text>
     {editing&&arc.id===activeArcId&&!addingDot&&<circle r="13" fill="transparent" stroke="#7bf2d8" strokeOpacity=".25" pointerEvents="all" style={{cursor:'move',touchAction:'none'}} onPointerDown={e=>begin(e,arc,point.frameId,'frame',arc.points[index])} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/>}
    </g>)}
    {dots.map(({dot,point},index)=>{const s=toScreen(point,view),selected=dot.id===selectedDotId;
      return <g key={dot.id} transform={`translate(${s.x} ${s.y})`}>
       <circle r={selected?8:6} fill={selected?'#ffe0a0':'#27bdac'} stroke="#f9f7e5" strokeWidth="2"/>
       <text y="-15" fontSize="10" fill="#e8fff6" textAnchor="middle" stroke="#11232b" strokeWidth="2.5" paintOrder="stroke">+{index+1}</text>
       {editing&&arc.id===activeArcId&&!addingDot&&<circle r="15" fill="transparent" pointerEvents="all" style={{cursor:'move',touchAction:'none'}} onPointerDown={e=>begin(e,arc,dot.id,'dot',point)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/>}
      </g>;
    })}
   </g>;
  })}
 </svg>;
});
