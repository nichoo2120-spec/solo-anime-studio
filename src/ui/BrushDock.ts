import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import {readPreference,writePreference} from './preferences';

export function useBrushBarDock(){
 const [side,setSide]=useState<'top'|'left'>(()=>readPreference<string>('brush-bar-dock','top')==='left'?'left':'top');
 const host=useRef<HTMLDivElement>(null),start=useRef<{x:number;y:number}|null>(null);
 const change=(next:'top'|'left')=>{setSide(next);writePreference('brush-bar-dock',next);};
 return {side,host,handle:{
  'aria-label':'Dock brush toolbar '+(side==='top'?'left':'top'),
  title:'Drag to dock top or left. Click to switch.',
  onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{if(event.button!==0)return;start.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);},
  onPointerCancel:()=>{start.current=null;},
  onPointerUp:(event:PointerEvent<HTMLButtonElement>)=>{
   const from=start.current;start.current=null;
   const area=host.current?.parentElement?.getBoundingClientRect();
   if(!from||!area)return;
   if(Math.hypot(event.clientX-from.x,event.clientY-from.y)>8)change(event.clientX-area.left<Math.max(96,(event.clientY-area.top)*.42)?'left':'top');
   else change(side==='top'?'left':'top');
  },
  onClick:(event:React.MouseEvent)=>{if(event.detail===0)change(side==='top'?'left':'top');},
 }};
}

type DrawerPosition={side:'left'|'right'}|{x:number;y:number};
export function useBrushSettingsDock(ref:React.RefObject<HTMLElement|null>,visible:boolean,collapsed:boolean){
 const [position,setPosition]=useState<DrawerPosition>(()=>readPreference<DrawerPosition>('brush-settings-position',{side:'right'}));
 const [size,setSize]=useState<{w:number;h:number}|null>(()=>readPreference('brush-settings-size',null));
 const move=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 const change=(p:DrawerPosition)=>{setPosition(p);writePreference('brush-settings-position',p);};
 useEffect(()=>{
  const node=ref.current;if(!node||!visible||collapsed)return;
  let timer=0;
  const observer=new ResizeObserver(()=>{
   clearTimeout(timer);timer=window.setTimeout(()=>{
    const {width,height}=node.getBoundingClientRect();
    if(width>0&&height>0)writePreference('brush-settings-size',{w:Math.round(width),h:Math.round(height)});
   },180);
  });
  observer.observe(node);return()=>{observer.disconnect();clearTimeout(timer);};
 },[ref,visible,collapsed]);
 useEffect(()=>{
  if(!visible)return;
  setSize(readPreference('brush-settings-size',null));
 },[visible]);
 const style:CSSProperties={
  ...('side' in position?position.side==='left'?{left:8,right:'auto'}:{left:'auto',right:8}:{left:`clamp(0px, ${position.x}px, calc(100vw - 80px))`,top:`clamp(0px, ${position.y}px, calc(100dvh - 48px))`,right:'auto'}),
  ...(!collapsed&&size?{width:size.w,height:size.h}:{}),
 };
 return {style,dock:()=>change({side:'side'in position&&position.side==='left'?'right':'left'}),handle:{
  onPointerDown:(event:PointerEvent<HTMLElement>)=>{
   if(event.button!==0||(event.target as HTMLElement).closest('button,input,select'))return;
   const r=ref.current?.getBoundingClientRect();if(!r)return;
   move.current={x:event.clientX,y:event.clientY,left:r.left,top:r.top};event.currentTarget.setPointerCapture(event.pointerId);
  },
  onPointerMove:(event:PointerEvent<HTMLElement>)=>{
   const g=move.current;if(!g||Math.hypot(event.clientX-g.x,event.clientY-g.y)<4)return;
   setPosition({x:Math.max(0,g.left+event.clientX-g.x),y:Math.max(0,g.top+event.clientY-g.y)});
  },
  onPointerUp:(event:PointerEvent<HTMLElement>)=>{
   const g=move.current;move.current=null;if(!g||Math.hypot(event.clientX-g.x,event.clientY-g.y)<4)return;
   if(event.clientX<60||event.clientX>innerWidth-60)change({side:event.clientX<60?'left':'right'});
   else change({x:Math.max(0,g.left+event.clientX-g.x),y:Math.max(0,g.top+event.clientY-g.y)});
  },
  onPointerCancel:()=>{move.current=null;},
 }};
}
