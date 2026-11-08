import {useId,useState,useRef,useEffect,type KeyboardEvent} from 'react';

export type ExactRangeProps={
  live?:boolean;
  name:string;
  value:number;
  min?:number;
  max?:number;
  step?:number;
  unit?:string;
  set:(value:number)=>void;
};

/**
 * One slider and one editable numeric value.
 * Default controls commit on release or blur. Brush Settings opts into live
 * updates, coalesced to one per animation frame so its sample follows the drag.
 * Live numeric fields publish valid values while typing; Escape restores focus value.
 */
export function ExactRange({live=false,name,value,min=0,max=100,step=1,unit='',set}:ExactRangeProps){
  const id=useId();
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState('');
  const [sliding,setSliding]=useState<number|null>(null);
  const pending=useRef<number|null>(null);
  const frame=useRef(0),latest=useRef({value,set}),initial=useRef(value);latest.current={value,set};
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  const emit=()=>{frame.current=0;const n=pending.current;if(n!==null&&n!==latest.current.value)latest.current.set(n);};
  const shown=sliding??value;
  const finishSlide=()=>{cancelAnimationFrame(frame.current);frame.current=0;const next=pending.current;pending.current=null;if(next!==null){setSliding(null);if(next!==latest.current.value)latest.current.set(next);}};
  const decimals=String(step).includes('.')?String(step).split('.')[1].length:0;
  const format=(n:number)=>Number(n.toFixed(Math.max(0,decimals))).toString();
  const commit=(text:string)=>{
    setEditing(false);
    const requested=Number(text);
    if(!text.trim()||!Number.isFinite(requested))return;
    const clamped=Math.max(min,Math.min(max,requested));
    // Round to the slider's own precision, keeping numeric and slider values in sync.
    const rounded=Number((min+Math.round((clamped-min)/step)*step).toFixed(Math.max(decimals,6)));
    const next=Math.max(min,Math.min(max,rounded));
    if(next!==value)set(next);
  };
  const onKeyDown=(e:KeyboardEvent<HTMLInputElement>)=>{
    e.stopPropagation(); // Prevent canvas keyboard shortcuts while editing a number.
    if(e.key==='Enter')e.currentTarget.blur();
    if(e.key==='Escape'){e.currentTarget.value=format(initial.current);if(live&&initial.current!==latest.current.value)latest.current.set(initial.current);setEditing(false);e.currentTarget.blur();}
  };
  return <div className="range-row exact-range">
    <label htmlFor={id+'-slider'}>{name}</label>
    <input id={id+'-slider'} aria-label={name} type="range" min={min} max={max} step={step} value={shown} onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)} onChange={e=>{pending.current=Number(e.target.value);setSliding(pending.current);if(live&&!frame.current)frame.current=requestAnimationFrame(emit);}} onLostPointerCapture={finishSlide} onPointerUp={finishSlide} onPointerCancel={finishSlide} onKeyUp={finishSlide} onBlur={finishSlide}/>
    <label className="exact-value" title="Type a number, then press Enter" htmlFor={id+'-number'}>
      <input id={id+'-number'} aria-label={name+' exact value'} inputMode="decimal" type="number" min={min} max={max} step={step}
        value={editing?draft:format(shown)}
        onFocus={e=>{initial.current=value;setDraft(e.currentTarget.value);setEditing(true);e.currentTarget.select();}}
        onChange={e=>{const text=e.currentTarget.value;setDraft(text);if(live&&text.trim()){const n=Number(text);if(Number.isFinite(n)&&n>=min&&n<=max){const rounded=Number((min+Math.round((n-min)/step)*step).toFixed(Math.max(decimals,6)));if(rounded!==latest.current.value)latest.current.set(rounded);}}}}
        onBlur={e=>{if(editing)commit(e.currentTarget.value);}}
        onKeyDown={onKeyDown}/>
      {unit&&<span aria-hidden="true">{unit.trim()}</span>}
    </label>
  </div>;
}

