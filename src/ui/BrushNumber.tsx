import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {ExactRangeProps} from './ExactRange';

export function BrushNumber({name,value,min=0,max=100,step=1,unit='',set}:ExactRangeProps){
 const [draft,setDraft]=useState<string|null>(null),[scrub,setScrub]=useState<number|null>(null);
 const gesture=useRef<{x:number;value:number;next:number;moved:boolean}|null>(null),number=useRef<HTMLInputElement>(null);
 const frame=useRef(0),latest=useRef({value,set});latest.current={value,set};
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 useEffect(()=>{if(draft!==null&&number.current){number.current.focus();number.current.select();}},[draft!==null]);
 const clamp=(v:number)=>Math.min(max,Math.max(min,Number((min+Math.round((v-min)/step)*step).toFixed(6))));
 const send=(n:number)=>{if(n!==latest.current.value)latest.current.set(n);};
 const finish=(event:PointerEvent<HTMLButtonElement>,cancel=false)=>{
  const g=gesture.current;if(!g)return;
  gesture.current=null;cancelAnimationFrame(frame.current);frame.current=0;
  if(g.moved&&!cancel)send(g.next);
  if(g.moved&&cancel)send(g.value);
  setScrub(null);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const apply=(text:string)=>{setDraft(null);if(text.trim()&&Number.isFinite(Number(text)))send(clamp(Number(text)));};
 const valueLabel=`${Number((scrub??value).toFixed(2))}${unit}`;
 return <span className="brush-number">
  {draft!==null?<input ref={number} type="number" aria-label={name+' exact value'} min={min} max={max} step={step} value={draft} inputMode="decimal"
    onChange={e=>setDraft(e.target.value)} onBlur={e=>apply(e.currentTarget.value)}
    onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.preventDefault();e.currentTarget.value=String(value);e.currentTarget.blur();}}}/>:
  <button type="button" className="brush-number-value" aria-label={`${name}: ${valueLabel}`} title={`${name} · Drag to adjust or click to type`}
   onPointerDown={event=>{if(event.button!==0)return;gesture.current={x:event.clientX,value,next:value,moved:false};event.currentTarget.setPointerCapture(event.pointerId);}}
   onPointerMove={event=>{const g=gesture.current;if(!g)return;const delta=event.clientX-g.x;if(!g.moved&&Math.abs(delta)<4)return;g.moved=true;
    g.next=clamp(g.value+delta*(event.shiftKey?step:Math.max(step,(max-min)/180)));setScrub(g.next);
    if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;if(gesture.current)send(gesture.current.next);});}}
   onPointerUp={event=>{const moved=gesture.current?.moved;finish(event);if(!moved)setDraft(String(value));}}
   onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
   onClick={event=>{if(event.detail===0)setDraft(String(value));}}
   onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'||event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();send(clamp(value+(['ArrowRight','ArrowUp'].includes(event.key)?step:-step)*(event.shiftKey?10:1)));}}}>{valueLabel}</button>}
 </span>;
}
