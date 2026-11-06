import {memo,useEffect,useRef,useState,useCallback} from 'react';
import {createPortal} from 'react-dom';
import {GripHorizontal,SlidersHorizontal,Pin,ChevronDown,Droplets,SkipBack,SkipForward,Eye} from 'lucide-react';
import type {ShortcutCommand} from '../core/shortcuts';
import type {Tool} from '../core/model';
import {toolRegistry,allTools} from './icons';
import {readPreference,writePreference} from './preferences';
type WheelAction='previous-cel'|'next-cel'|'onion-skin';
const wheelActions=[{id:'previous-cel',name:'Previous Cel',icon:SkipBack,key:'Page Up'},{id:'next-cel',name:'Next Cel',icon:SkipForward,key:'Page Down'},{id:'onion-skin',name:'Onion Skin',icon:Eye,key:'O'}] as const;
const wheelChoices=[...toolRegistry,...wheelActions];
const defaultSlots=['brush','stroke-select','transform','hand','eraser','eyedropper'];
type Placement={x:number;y:number;size:number;collapsed:boolean;pinned:boolean;dock:string};
export const RadialToolbar=memo(function RadialToolbar({active,onTool,workspace,homeOpen,onNotice,mixMode=false,onToggleMix,shortcuts,onAction}:{shortcuts:Record<ShortcutCommand,string>;onAction:(action:WheelAction)=>void;active:Tool;onTool:(t:Tool)=>void;workspace:React.RefObject<HTMLDivElement|null>;homeOpen:boolean;onNotice?:(message:string)=>void;mixMode?:boolean;onToggleMix?:()=>void}){
 const [placement,setPlacement]=useState<Placement>(()=>{const p=readPreference<Placement>('radial',{x:10,y:132,size:168,collapsed:true,pinned:false,dock:'panel'});if(p?.dock==='none'&&p.collapsed&&p.size===168&&p.x<=12&&p.y===132)p.dock='panel';return {x:Number.isFinite(p?.x)?p.x:-1,y:Number.isFinite(p?.y)?p.y:-1,size:[168,204,244].includes(p?.size)?p.size:204,collapsed:!!p?.collapsed,pinned:p?.pinned!==false,dock:['panel','none','left','right','top','bottom'].includes(p?.dock)?p.dock:'none'};});
 const [slots,setSlots]=useState(()=>{const saved=readPreference<string[]>('wheel-tools',defaultSlots);return Array.isArray(saved)&&saved.length===6&&new Set(saved).size===6&&saved.every(id=>wheelChoices.some(tool=>tool.id===id))?saved:defaultSlots;});
 const wheelTools=slots.map(id=>wheelChoices.find(tool=>tool.id===id)!);
 function changeSlot(index:number,id:string){const next=[...slots];const other=next.indexOf(id);if(other>=0)next[other]=next[index];next[index]=id;setSlots(next);writePreference('wheel-tools',next);}
 const [home,setHome]=useState<HTMLElement|null>(null);
 useEffect(()=>{setHome(homeOpen?document.getElementById('tool-wheel-home'):null);},[homeOpen]);
 const [options,setOptions]=useState(false),ref=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);
 const [popout,setPopout]=useState<Window|null>(null);
 const popoutRef=useRef<Window|null>(null);
 const returnToApp=useCallback(()=>{const w=popoutRef.current;popoutRef.current=null;setPopout(null);setPlacement(p=>p.dock==='panel'?{...p,collapsed:true}:p);if(w&&!w.closed)w.close();},[]);
 const togglePopout=useCallback(()=>{
  if(popoutRef.current&&!popoutRef.current.closed){returnToApp();return;}
  let w:Window|null=null;
  try{w=window.open('','solo-anime-tool-wheel',`popup=yes,width=${Math.max(270,placement.size+60)},height=${Math.max(340,placement.size+140)},left=120,top=120`);}catch{/* Popup may be blocked. */}
  if(!w){onNotice?.('Tool Wheel pop-out was blocked. Allow pop-ups for this local studio, or drag the wheel onto a side panel.');return;}
  // Keep the wheel in the SAME React application, avoiding a second rendering engine.
  w.document.title='Solo Anime Studio - Tool Wheel';
  w.document.head.innerHTML='<meta name="viewport" content="width=device-width,initial-scale=1">';
  for(const style of document.querySelectorAll('style,link[rel="stylesheet"]'))w.document.head.append(style.cloneNode(true));
  const extra=w.document.createElement('style');
  extra.textContent='html,body{margin:0;background:#111e25;color:#d9e1e5;min-width:0;min-height:100%;font-family:Segoe UI,sans-serif}body{display:flex;justify-content:center;padding:12px}.popout-wheel{position:relative!important;left:auto!important;top:auto!important;filter:none!important;height:max-content}.popout-wheel .radial-options{position:relative;bottom:auto;right:auto;margin-top:4px}.popout-wheel .radial-grip{cursor:default}.popout-wheel .radial-footer{margin-top:3px}';
  w.document.head.append(extra);
  const closed=()=>{popoutRef.current=null;setPopout(null);setPlacement(p=>p.dock==='panel'?{...p,collapsed:true}:p);};
  w.addEventListener('pagehide',closed);popoutRef.current=w;
  setOptions(false);setPlacement(p=>({...p,collapsed:false}));setPopout(w);w.focus();
 },[returnToApp,onNotice,placement.size]);
 useEffect(()=>{window.addEventListener('solo:wheel-popout-toggle',togglePopout);return()=>window.removeEventListener('solo:wheel-popout-toggle',togglePopout);},[togglePopout]);
 useEffect(()=>()=>{const w=popoutRef.current;if(w&&!w.closed)w.close();},[]);

 const clamp=(p:Placement)=>{const r=workspace.current?.getBoundingClientRect();if(!r||!r.width||!r.height)return p;const collapsed=p.collapsed||p.size+66>r.height||p.size+24>r.width,size=collapsed?56:p.size,w=Math.max(12,r.width-size-12),h=Math.max(12,r.height-size-66);return {...p,collapsed,x:p.dock==='left'?12:p.dock==='right'?w:Math.max(12,Math.min(w,p.x<0?12:p.x)),y:p.dock==='top'?12:p.dock==='bottom'?h:Math.max(12,Math.min(h,p.y<0?Math.min(80,h):p.y))};};
 const update=(next:Placement)=>setPlacement(clamp(next.dock==='panel'?{...next,collapsed:true}:next));
 useEffect(()=>{writePreference('radial',placement);},[placement]);
 useEffect(()=>{const observer=new ResizeObserver(()=>setPlacement(p=>clamp(p)));if(workspace.current)observer.observe(workspace.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{setPlacement(p=>clamp(p));},[placement.size,placement.collapsed]);
 useEffect(()=>{const move=(e:PointerEvent)=>{const d=drag.current;if(d)setPlacement(p=>clamp({...p,dock:'none',x:d.px+e.clientX-d.x,y:d.py+e.clientY-d.y}));};const end=()=>{drag.current=null;};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};},[]);
 // v0.5.174 (from v162): open the wheel beside the left panel, so it never covers the LAYERS title or rows.
 const besidePanel=()=>{const w=workspace.current?.getBoundingClientRect(),panel=home?.closest('.left-panel')?.getBoundingClientRect(),own=home?.getBoundingClientRect();if(!w||!panel||!own)return {};return {x:Math.round(panel.right-w.left+12),y:Math.round(own.top-w.top)};};
 function select(t:Tool|WheelAction){if(t==='previous-cel'||t==='next-cel'||t==='onion-skin')onAction(t);else onTool(t);if(!placement.pinned)update({...placement,collapsed:true});}
 const contents=<div ref={ref} className={'radial-wrap '+(placement.collapsed?'collapsed':'')+(popout?' popout-wheel':placement.dock==='panel'&&home?' panel-docked':'')} style={{left:popout?undefined:placement.x,top:popout?undefined:placement.y,width:placement.collapsed?56:placement.size}}>
  <button className="radial-grip" aria-label="Drag circular toolbar" title={popout?"Drag the browser popup by its title bar":"Drag wheel anywhere in the studio"} onPointerDown={e=>{if(popout)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.parentElement!.getBoundingClientRect(),w=workspace.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,px:r.left-w.left,py:r.top-w.top};}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}}><GripHorizontal size={18}/></button>
  {placement.collapsed?<button className="radial-expand" title="Expand tool wheel" aria-label="Expand circular toolbar" onClick={()=>update(placement.dock==='panel'?{...placement,...besidePanel(),collapsed:false,dock:'none'}:{...placement,collapsed:false})}>{(()=>{const Icon=allTools.find(t=>t.id===active)!.icon;return <Icon size={23}/>;})()}</button>:<div className="radial" style={{width:placement.size,height:placement.size}}>
   <svg viewBox="0 0 200 200" className="radial-sectors" aria-hidden="true">{wheelTools.map((t,i)=>{const a=(-120+i*60)*Math.PI/180,b=a+Math.PI/3,xy=(r:number,v:number)=>`${100+r*Math.cos(v)},${100+r*Math.sin(v)}`;return <path key={t.id} className={active===t.id?'active':''} d={`M ${xy(91,a+.025)} A 91 91 0 0 1 ${xy(91,b-.025)} L ${xy(38,b-.025)} A 38 38 0 0 0 ${xy(38,a+.025)} Z`}/>;})}</svg>
   {wheelTools.map((t,i)=>{const a=(-90+i*60)*Math.PI/180,Icon=t.icon;return <button key={t.id} className={'radial-tool '+(active===t.id?'active':'')} style={{left:`${50+32*Math.cos(a)}%`,top:`${50+32*Math.sin(a)}%`}} aria-label={t.name} aria-pressed={active===t.id} title={t.name+' · '+(shortcuts[t.id as ShortcutCommand]?.toUpperCase()??t.key)} onClick={()=>select(t.id)}><Icon size={placement.size<200?21:25}/></button>;})}
   <button className="radial-center" title="Collapse tool wheel" aria-label="Collapse circular toolbar" onClick={()=>update({...placement,collapsed:true})}><ChevronDown size={20}/></button>
  </div>}
  <div className="radial-footer"><span>{!placement.collapsed&&'TOOL WHEEL'}</span>{onToggleMix&&<button aria-label={mixMode?'Switch brush to paint mode':'Switch brush to mix mode'} title={mixMode?'Mix mode active · click for Paint':'Paint mode active · click for Mix'} onClick={onToggleMix}><Droplets size={13}/>{mixMode?'MIX':'PAINT'}</button>}<button aria-label="Circular toolbar options" title="Toolbar options" onClick={()=>setOptions(!options)}><SlidersHorizontal size={13}/></button></div>
  {options&&<div className="radial-options"><div className="section-caption">TOOL WHEEL</div>{slots.map((id,index)=><label key={index}>Slot {index+1}<select aria-label={'Wheel slot '+(index+1)} value={id} onChange={event=>changeSlot(index,event.target.value)}>{wheelChoices.map(tool=><option key={tool.id} value={tool.id}>{tool.name}</option>)}</select></label>)}<label>Size<select aria-label="Toolbar size" value={placement.size} onChange={e=>update({...placement,size:+e.target.value})}><option value={168}>Compact</option><option value={204}>Medium</option><option value={244}>Large</option></select></label><label>Dock<select aria-label="Toolbar dock" value={placement.dock} onChange={e=>update({...placement,dock:e.target.value})}>{['panel','none','left','right','top','bottom'].map(x=><option key={x} value={x}>{x==='panel'?'Left panel':x==='none'?'Floating':x}</option>)}</select></label>{onToggleMix&&<button onClick={onToggleMix}><Droplets size={14}/>{mixMode?'Switch to Paint mode':'Switch to Mix mode'}</button>}<button onClick={()=>update({...placement,pinned:!placement.pinned})}><Pin size={14}/>{placement.pinned?'Pinned open':'Auto-collapse'}</button><button onClick={popout?returnToApp:togglePopout}>{popout?'Return wheel to studio':'Pop out to separate window'}</button><button onClick={()=>setOptions(false)}>Done</button></div>}
 </div>;
 return popout&&!popout.closed?createPortal(contents,popout.document.body):placement.dock==='panel'&&home?createPortal(contents,home):contents;
});
