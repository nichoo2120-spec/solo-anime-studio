import {useState,useRef,useEffect,type PointerEvent} from 'react';
import type {CurveNode} from '../core/brushCurves';
import {profileValue} from '../core/brushCurves';
import {pressureResponse} from '../engine/strokeGeometry';
import {ExactRange} from './ExactRange';
import {useSurfaceSize} from './useSurfaceSize';
export function CurveEditor({label,value,onChange,monotone=true,linkedEnds=false,response=1,onReset}:{label:string;value:CurveNode[];onChange:(v:CurveNode[])=>void;monotone?:boolean;linkedEnds?:boolean;response?:number;onReset:()=>void}){
 const {ref,width,height}=useSurfaceSize<SVGSVGElement>(280,104);
 const [draft,setDraft]=useState<CurveNode[]>(),[selected,setSelected]=useState(0),pending=useRef<CurveNode[]|undefined>(undefined),drag=useRef<number|null>(null),frame=useRef(0),latest=useRef(onChange);latest.current=onChange;
 const nodes=draft??value,index=Math.min(selected,nodes.length-1),low=monotone?0:.05,left=24,right=width-13,top=12,bottom=height-22;
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 useEffect(()=>{if(drag.current===null){setDraft(undefined);pending.current=undefined;}},[value]);
 const emit=()=>{frame.current=0;if(pending.current)latest.current(pending.current);};
 const publish=(next:CurveNode[])=>{pending.current=next;setDraft(next);if(!frame.current)frame.current=requestAnimationFrame(emit);};
 const finish=()=>{cancelAnimationFrame(frame.current);frame.current=0;if(pending.current)latest.current(pending.current);pending.current=undefined;drag.current=null;setDraft(undefined);};
 const xy=(e:PointerEvent<SVGSVGElement>)=>{const el=e.currentTarget,r=el.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left-el.clientLeft-left)/(right-left))),y=Math.max(low,Math.min(1,low+(bottom-(e.clientY-r.top-el.clientTop))/(bottom-top)*(1-low)));return {x:monotone?x**response:x,y};};
 const move=(i:number,p:CurveNode)=>{const old=pending.current??value,a=old[Math.max(0,i-1)],b=old[Math.min(old.length-1,i+1)],next=old.map(n=>({...n}));next[i]={x:i===0?0:i===old.length-1?1:Math.max(a.x+.001,Math.min(b.x-.001,p.x)),y:Math.max(monotone&&i?a.y:low,Math.min(monotone&&i<old.length-1?b.y:1,p.y))};if(linkedEnds&&(i===0||i===old.length-1))next[i===0?old.length-1:0].y=next[i].y;publish(next);};
 const remove=()=>{if(index===0||index===nodes.length-1)return;publish(nodes.filter((_,i)=>i!==index));setSelected(index-1);};
 const sx=(n:CurveNode)=>left+(right-left)*(monotone?n.x**(1/response):n.x),sy=(y:number)=>bottom-(y-low)/(1-low)*(bottom-top);
 return <div className="editable-curve"><svg ref={ref} viewBox={`0 0 ${width} ${height}`} aria-label={label} className="editable-curve-graph" onPointerDown={e=>{if(e.button!==0||nodes.length>=32)return;const p=xy(e);if(p.x<.002||p.x>.998||nodes.some(n=>Math.abs(n.x-p.x)<.003))return;let i=1;while(i<nodes.length&&nodes[i].x<p.x)i++;const next=[...nodes.slice(0,i),{x:p.x,y:Math.max(monotone?nodes[i-1].y:low,Math.min(monotone?nodes[i].y:1,p.y))},...nodes.slice(i)];setSelected(i);publish(next);drag.current=i;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current!==null)move(drag.current,xy(e));}} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{if(pending.current)finish();}}>
 <title>Click to add a point. Drag points to shape the brush response.</title>
 {[.25,.5,.75,1].map(t=><path key={t} d={`M${left+(right-left)*t} ${top}V${bottom}M${left} ${top+(bottom-top)*t}H${right}`} className="curve-grid"/>)}
 <path d={`M${left} ${top}V${bottom}H${right}`} className="curve-axis"/>
 <text x={left-6} y={top+3} textAnchor="end" className="curve-caption">100</text><text x={left-6} y={bottom+3} textAnchor="end" className="curve-caption">{monotone?'0':'5'}</text><text x={left} y={height-7} className="curve-caption">0</text><text x={right} y={height-7} textAnchor="end" className="curve-caption">100%</text>
 <path data-curve-line="true" d={Array.from({length:Math.ceil(right-left)+1},(_,i)=>{const t=i/Math.ceil(right-left);return `${i?'L':'M'}${(left+t*(right-left)).toFixed(2)},${sy(monotone?pressureResponse(t**response,nodes):profileValue(nodes,t)).toFixed(2)}`;}).join(' ')} className="curve-line"/>
 {nodes.map((n,i)=><g key={i} role="slider" tabIndex={0} aria-label={label+' point '+(i+1)} aria-valuemin={low*100} aria-valuemax={100} aria-valuenow={Math.round(n.y*100)} className={index===i?'curve-handle selected':'curve-handle'} transform={`translate(${sx(n)},${sy(n.y)})`} onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();setSelected(i);drag.current=i;e.currentTarget.focus();e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);}} onKeyDown={e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setSelected(i);const d=e.shiftKey?.05:.01;move(i,{x:n.x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),y:n.y+(e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0)});}if(e.key==='Delete'&&i>0&&i<nodes.length-1){e.preventDefault();publish(nodes.filter((_,j)=>j!==i));setSelected(i-1);}}}><title>Drag point · Arrow keys adjust · Delete removes an interior point</title><circle className="curve-hit" r="9"/><circle className="curve-dot" r="3.5"/></g>)}
 </svg><div className="curve-actions"><small>Point {index+1} / {nodes.length}</small><button type="button" disabled={index===0||index===nodes.length-1} onClick={remove}>Delete point</button><button type="button" onClick={()=>{cancelAnimationFrame(frame.current);frame.current=0;pending.current=undefined;setDraft(undefined);setSelected(0);onReset();}}>Reset graph</button></div>
 <ExactRange live name={monotone?'Pressure output':'Profile output'} min={monotone&&index>0?Math.round(nodes[index-1].y*100):low*100} max={monotone&&index<nodes.length-1?Math.round(nodes[index+1].y*100):100} value={Math.round(nodes[index].y*100)} unit="%" set={y=>move(index,{...nodes[index],y:y/100})}/>
 </div>;
}

