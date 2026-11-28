import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {calibratePressure,penPresets,penSettings,setPenSettings,type PenSettings} from '../core/penPressure';
import {pointerBatch} from '../engine/inputPath';
import {CurveEditor} from './CurveEditor';

export function PenPressureSettings(){
 const [config,setConfig]=useState(penSettings);
 const [calibrating,setCalibrating]=useState(false);
 const [message,setMessage]=useState('');
 const [raw,setRaw]=useState<number>();
 const range=useRef({min:Infinity,max:-Infinity});
 const contact=useRef<number|undefined>(undefined);
 function save(next:PenSettings){setPenSettings(next);setConfig(next);}
 useEffect(()=>{
  if(!import.meta.env.DEV)return;
  const update=(e:Event)=>setRaw((e as CustomEvent<number>).detail);
  window.addEventListener('solo-pen-pressure',update);
  return ()=>window.removeEventListener('solo-pen-pressure',update);
 },[]);
 function sample(event:ReactPointerEvent<HTMLDivElement>){
  if(event.pointerType!=='pen'||event.pointerId!==contact.current)return;
  for(const {pressure} of pointerBatch(event.nativeEvent)){
   if(!Number.isFinite(pressure)||pressure<=0)continue;
   range.current.min=Math.min(range.current.min,pressure);
   range.current.max=Math.max(range.current.max,pressure);
   if(import.meta.env.DEV)setRaw(pressure);
  }
 }
 return <details open className="brush-pressure">
  <summary>Global tablet pressure</summary>
  <div role="group" aria-label="Global pressure presets">
   {(Object.keys(penPresets) as (keyof typeof penPresets)[]).map(name=>
    <button key={name} type="button" onClick={()=>save({...config,curve:penPresets[name]})}>{name}</button>
   )}
  </div>
  <CurveEditor label="Global pressure curve" value={config.curve}
   onChange={curve=>save({...config,curve})}
   onReset={()=>save({curve:penPresets.Normal,min:0,max:1})}/>
  <button type="button" onClick={()=>{
   if(!calibrating){range.current={min:Infinity,max:-Infinity};setMessage('');setCalibrating(true);return;}
   const limits=calibratePressure(range.current.min,range.current.max);
   if(!limits){setMessage('Pressure did not vary enough. Try a light stroke and then a firm stroke.');return;}
   save({...config,...limits});setCalibrating(false);setMessage('Calibration saved.');
  }}>{calibrating?'Save calibration':'Calibrate'}</button>
  {calibrating&&<div style={{touchAction:'none',minHeight:84,border:'1px solid currentColor',padding:8}}
   onPointerDown={e=>{if(e.pointerType!=='pen')return;contact.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);sample(e);}}
   onPointerMove={sample} onLostPointerCapture={()=>{contact.current=undefined;}}>
   Draw a few light and firm pen strokes here.
  </div>}
  {calibrating&&<button type="button" onClick={()=>{setCalibrating(false);setMessage('');}}>Cancel calibration</button>}
  {message&&<p role="status">{message}</p>}
  {import.meta.env.DEV&&<output aria-label="Raw pen pressure">Raw pen pressure {raw?.toFixed(3)??'—'}</output>}
 </details>;
}
