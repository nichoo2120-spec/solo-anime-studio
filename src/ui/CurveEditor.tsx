import {useState,useRef,useEffect,type PointerEvent} from 'react';
import type {CurveNode} from '../core/brushCurves';
import {profileValue} from '../core/brushCurves';
import {pressureResponse} from '../engine/strokeGeometry';
import {ExactRange} from './ExactRange';
export function CurveEditor({label,value,onChange,monotone=true,linkedEnds=false,response=1,onReset}:{label:string;value:CurveNode[];onChange:(v:CurveNode[])=>void;monotone?:boolean;linkedEnds?:boolean;response?:number;onReset:()=>void}){
 const [draft,setDraft]=useState<CurveNode[]>(),[selected,setSelected]=useState(0),pending=useRef<CurveNode[]|undefined>(undefined),drag=useRef<number|null>(null),frame=useRef(0),latest=useRef(onChange);latest.current=onChange;
 const nodes=draft??value,index=Math.min(selected,nodes.length-1),low=monotone?0:.05;
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 useEffect(()=>{if(drag.current===null){setDraft(undefined);pending.current=undefined;}},[value]);
 const emit=()=>{frame.current=0;if(pending.current)latest.current(pending.current);};
 const publish=(next:CurveNode[])=>{pending.current=next;setDraft(next);if(!frame.current)frame.current=requestAnimationFrame(emit);};
 const finish=()=>{cancelAnimationFrame(frame.current);frame.current=0;if(pending.current)latest.current(pending.current);pending.current=undefined;drag.current=null;setDraft(undefined);};
 const xy=(e:PointerEvent<SVGSVGElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(1,((e.clientX-r.left)*220/r.width-12)/196)),y=Math.max(low,Math.min(1,low+(82-(e.clientY-r.top)*96/r.height)/72*(1-low)));return {x:monotone?x**response:x,y};};
 const move=(i:number,p:CurveNode)=>{const old=pending.current??value,a=old[Math.max(0,i-1)],b=old[Math.min(old.length-1,i+1)],next=old.map(n=>({...n}));next[i]={x:i===0?0:i===old.length-1?1:Math.max(a.x+.001,Math.min(b.x-.001,p.x)),y:Math.max(monotone&&i?a.y:low,Math.min(monotone&&i<old.length-1?b.y:1,p.y))};if(linkedEnds&&(i===0||i===old.length-1))next[i===0?old.length-1:0].y=next[i].y;publish(next);};
 const remove=()=>{if(index===0||index===nodes.length-1)return;publish(nodes.filter((_,i)=>i!==index));setSelected(index-1);};
 const sx=(n:CurveNode)=>12+196*(monotone?n.x**(1/response):n.x),sy=(y:number)=>82-(y-low)/(1-low)*72;
 return <div className="editable-curve"><svg preserveAspectRatio="none" viewBox="0 0 220 96" aria-label={label} className="editable-curve-graph" onPointerDown={e=>{if(e.button!==0||nodes.length>=32)return;const p=xy(e);if(p.x<.002||p.x>.998||nodes.some(n=>Math.abs(n.x-p.x)<.003))return;let i=1;while(i<nodes.length&&nodes[i].x<p.x)i++;const next=[...nodes.slice(0,i),{x:p.x,y:Math.max(monotone?nodes[i-1].y:low,Math.min(monotone?nodes[i].y:1,p.y))},...nodes.slice(i)];setSelected(i);publish(next);drag.current=i;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current!==null)move(drag.current,xy(e));}} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{if(pending.current)finish();}}>
 <path d="M12 10V82H208" className="curve-axis"/><path data-curve-line="true" d={Array.from({length:101},(_,i)=>`${i?'L':'M'}${12+i/100*196},${sy(monotone?pressureResponse((i/100)**response,nodes):profileValue(nodes,i/100))}`).join(' ')} className="curve-line"/>
 {nodes.map((n,i)=><circle key={i} role="slider" tabIndex={0} aria-label={label+' point '+(i+1)} aria-valuemin={low*100} aria-valuemax={100} aria-valuenow={Math.round(n.y*100)} className={index===i?'curve-dot selected':'curve-dot'} cx={sx(n)} cy={sy(n.y)} r="4" onPointerDown={e=>{e.stopPropagation();setSelected(i);drag.current=i;e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);}} onKeyDown={e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setSelected(i);const d=e.shiftKey?.05:.01;move(i,{x:n.x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),y:n.y+(e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0)});}if(e.key==='Delete'&&i>0&&i<nodes.length-1){e.preventDefault();publish(nodes.filter((_,j)=>j!==i));setSelected(i-1);}}}><title>Drag point · Arrow keys adjust · Delete removes an interior point</title></circle>)}
 </svg><div className="curve-actions"><small>Point {index+1} / {nodes.length}</small><button type="button" disabled={index===0||index===nodes.length-1} onClick={remove}>Delete point</button><button type="button" onClick={()=>{pending.current=undefined;setDraft(undefined);setSelected(0);onReset();}}>Reset graph</button></div>
 <ExactRange live name={monotone?'Pressure output':'Profile output'} min={monotone&&index>0?Math.round(nodes[index-1].y*100):low*100} max={monotone&&index<nodes.length-1?Math.round(nodes[index+1].y*100):100} value={Math.round(nodes[index].y*100)} unit="%" set={y=>move(index,{...nodes[index],y:y/100})}/>
 </div>;
}

