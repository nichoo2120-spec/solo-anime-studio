import {useId,useState,useRef,type KeyboardEvent} from 'react';

export type ExactRangeProps={
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
 * Slider feedback stays local while dragging; commit once on release, keyboard
 * release or blur so the full studio does not re-render for every input event.
 * Number changes are committed on Enter / blur (not per keystroke) to avoid
 * expensive engine recompositions while an artist is still typing.
 */
export function ExactRange({name,value,min=0,max=100,step=1,unit='',set}:ExactRangeProps){
  const id=useId();
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState('');
  const [sliding,setSliding]=useState<number|null>(null);
  const pending=useRef<number|null>(null);
  const shown=sliding??value;
  const finishSlide=()=>{const next=pending.current;pending.current=null;if(next!==null){setSliding(null);if(next!==value)set(next);}};
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
    if(e.key==='Escape'){e.currentTarget.value=format(value);setEditing(false);e.currentTarget.blur();}
  };
  return <div className="range-row exact-range">
    <label htmlFor={id+'-slider'}>{name}</label>
    <input id={id+'-slider'} aria-label={name} type="range" min={min} max={max} step={step} value={shown} onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)} onChange={e=>{pending.current=Number(e.target.value);setSliding(pending.current);}} onLostPointerCapture={finishSlide} onPointerUp={finishSlide} onPointerCancel={finishSlide} onKeyUp={finishSlide} onBlur={finishSlide}/>
    <label className="exact-value" title="Type a number, then press Enter" htmlFor={id+'-number'}>
      <input id={id+'-number'} aria-label={name+' exact value'} inputMode="decimal" type="number" min={min} max={max} step={step}
        value={editing?draft:format(shown)}
        onFocus={e=>{setDraft(e.currentTarget.value);setEditing(true);e.currentTarget.select();}}
        onChange={e=>setDraft(e.currentTarget.value)}
        onBlur={e=>{if(editing)commit(e.currentTarget.value);}}
        onKeyDown={onKeyDown}/>
      {unit&&<span aria-hidden="true">{unit.trim()}</span>}
    </label>
  </div>;
}
