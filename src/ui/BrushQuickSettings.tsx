import {createContext,useContext,useLayoutEffect,useRef,type ComponentProps,type ReactNode} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import type {ExactRangeProps} from './ExactRange';

export type QuickControl=
 | {kind:'number';props:ExactRangeProps}
 | {kind:'choice';name:string;value:string;options:{value:string;label:string;disabled?:boolean}[];set:(s:string)=>void;disabled?:boolean}
 | {kind:'toggle';name:string;value:boolean;set:(s:boolean)=>void;disabled?:boolean}
 | {kind:'action';name:string;run:()=>void}
 | {kind:'color';name:string;value:string;set:(s:string)=>void;disabled?:boolean};
export type QuickRegistry=Map<string,()=>QuickControl>;
export const BrushPins=createContext<{register:(key:string,read:()=>QuickControl)=>()=>void;has:(key:string)=>boolean;toggle:(key:string)=>void;preview:boolean}|null>(null);
const Section=createContext('');
export function BrushSettingGroup({id,children}:{id:string;children:ReactNode}){return <Section.Provider value={id}>{children}</Section.Provider>;}
export function useBrushSettingPin(name:string,control:QuickControl|null,settingId=name){
 const section=useContext(Section),pins=useContext(BrushPins),latest=useRef(control);latest.current=control;
 const key=section&&settingId?section+'/'+settingId:'';
 const register=pins?.register,enabled=!!control;
 useLayoutEffect(()=>{if(key&&register&&enabled)return register(key,()=>latest.current!);},[key,register,enabled]);
 if(!key||!pins||!control)return null;
 const shown=pins.has(key);
 return <button type="button" className="brush-pin-setting" aria-label={`${shown?'Hide':'Show'} ${name} ${shown?'from':'in'} quick menu`} aria-pressed={shown}
  title={shown?'Hide from quick menu':'Show in quick menu'} onClick={event=>{event.preventDefault();event.stopPropagation();pins.toggle(key);}}>
  {shown?<Eye size={13}/>:<EyeOff size={13}/>}
 </button>;
}

export function BrushSettingSelect(props:ComponentProps<'select'>){
 const ref=useRef<HTMLSelectElement>(null),name=props['aria-label']??'';
 const latest=useRef(props);latest.current=props;
 const pin=useBrushSettingPin(name,props.onChange?{
  kind:'choice',name,value:String(props.value??''),
  get options(){return Array.from(ref.current?.options??[]).map(o=>({value:o.value,label:o.text,disabled:o.disabled}));},
  set:value=>{
   const input=ref.current;
   if(!input||input.matches(':disabled'))return;
   input.value=value;
   input.dispatchEvent(new Event('change',{bubbles:true}));
  },
  get disabled(){return !!latest.current.disabled||!!ref.current?.matches(':disabled');},
 }:null);
 return <><select {...props} ref={ref}/>{pin}</>;
}

export function BrushSettingInput(props:ComponentProps<'input'>){
 const ref=useRef<HTMLInputElement>(null),name=props['aria-label']??'';
 const disabled=()=>!!ref.current?.matches(':disabled');
 const change=(value:string)=>{
  const input=ref.current;
  if(!input||disabled())return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
 };
 const pin=useBrushSettingPin(name,props.type==='checkbox'?{
  kind:'toggle',name,value:!!props.checked,get disabled(){return disabled();},set:value=>{const input=ref.current;if(input&&input.checked!==value&&!disabled())input.click();}
 }:props.type==='color'?{
  kind:'color',name,value:String(props.value??'#000000'),get disabled(){return disabled();},set:change
 }:props.type==='number'&&name==='Seed'?{
  kind:'number',props:{name,value:Number(props.value),min:Number(props.min??0),max:Number(props.max??100),step:Number(props.step??1),set:v=>change(String(v))}
 }:null);
 return <><input {...props} ref={ref}/>{pin}</>;
}

export function BrushSettingAction({name,run}:{name:string;run:()=>void}){
 const pin=useBrushSettingPin(name,{kind:'action',name,run});
 return <><button type="button" onClick={run}>{name}</button>{pin}</>;
}
