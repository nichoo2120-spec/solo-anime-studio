import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Brush,ChevronDown,Ellipsis,GripVertical} from 'lucide-react';
import type {BrushLibrary,BrushPreset} from '../core/brushes';
import type {BrushSettings} from '../engine/StudioEngine';
import {BrushBlendToggle} from './BrushBlendPanel';
import {BrushLibraryPicker} from './BrushLibraryPicker';
import {BrushNumber} from './BrushNumber';
import {useBrushBarDock} from './BrushDock';
import type {QuickControl} from './BrushQuickSettings';

export type BrushMenu='picker'|'quick'|null;
type Props={preset:BrushPreset;library:BrushLibrary;eraser:boolean;menu:BrushMenu;setMenu:(menu:BrushMenu)=>void;openSettings:()=>void;
 onChange:(update:(old:BrushLibrary)=>BrushLibrary)=>void;choose:(id:string)=>void;notify:(s:string)=>void;
 patch:(settings:Partial<BrushSettings>)=>void;quick:{key:string;label?:string;control:QuickControl}[];shortcut?:string;cursorVisible:boolean;children:ReactNode};
export function BrushContextBar({preset,library,eraser,menu,setMenu,openSettings,onChange,choose,notify,patch,quick,shortcut,cursorVisible,children}:Props){
 const dock=useBrushBarDock(),trigger=useRef<HTMLButtonElement>(null);
 const [drop,setDrop]=useState<File[]|undefined>();
 const s=preset.settings;
 useEffect(()=>{
  if(!menu)return;
  const outside=(e:PointerEvent)=>{if(!dock.host.current?.contains(e.target as Node))setMenu(null);};
  document.addEventListener('pointerdown',outside,true);
  return()=>document.removeEventListener('pointerdown',outside,true);
 },[menu,setMenu]);
 const close=()=>{setMenu(null);setDrop(undefined);trigger.current?.focus();};
 return <div ref={dock.host} data-brush-cursor={cursorVisible?'visible':'hidden'} className={'brush-context dock-'+dock.side}
  onKeyDown={e=>{if(menu&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}
  onDragOver={e=>{if(!eraser&&e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}}}
  onDrop={e=>{if(!eraser&&e.dataTransfer.files.length){e.preventDefault();e.stopPropagation();setDrop(Array.from(e.dataTransfer.files));setMenu('picker');}}}>
  <div className="brush-context-bar" role="toolbar" aria-label="Brush toolbar">
   <button type="button" className="brush-bar-grip" {...dock.handle}><GripVertical size={13}/></button>
   <button type="button" ref={trigger} className="brush-bar-preset" data-current-brush-id={preset.id} data-current-brush-name={preset.name} data-current-brush-category={preset.category} aria-label="Choose brush" aria-haspopup="dialog" aria-expanded={menu==='picker'} title={preset.name} onClick={()=>{setDrop(undefined);setMenu(menu==='picker'?null:'picker');}}>
    <Brush size={13}/><span>{preset.name}</span><ChevronDown size={12}/>
   </button>
   <BrushNumber name="Size" value={s.size} min={1} max={s.nature?500:150} step={.1} unit=" px" set={size=>patch({size})}/>
   <BrushNumber name="Opacity" value={Math.round(s.opacity*100)} unit="%" set={opacity=>patch({opacity:opacity/100})}/>
   {!eraser&&<BrushBlendToggle settings={s} patch={patch} shortcut={shortcut}/>}
   <button type="button" className="brush-bar-more" aria-label="Brush quick settings" aria-expanded={menu==='quick'} title="Brush quick settings · F4 for full settings" onClick={()=>setMenu(menu==='quick'?null:'quick')}><Ellipsis size={17}/></button>
  </div>
  {menu==='picker'&&<div className="brush-popover brush-picker-popover" role="dialog" aria-label="Brush picker">
   <BrushLibraryPicker library={library} preset={preset} eraser={eraser} onChange={onChange} choose={choose} notify={notify} close={close} drop={drop}/>
  </div>}
  {menu==='quick'&&<div className="brush-popover brush-quick-popover" role="region" aria-label="Brush quick settings">
   {quick.map(({key,label,control})=>{
    const name=label??(control.kind==='number'?control.props.name:control.name);
    return <div className="brush-quick-row" key={key}><span>{name}</span>
     {control.kind==='number'?<BrushNumber {...control.props} name={name}/>:
      control.kind==='action'?<button type="button" onClick={control.run}>{name}</button>:
      control.kind==='choice'?<select aria-label={name} value={control.value} disabled={control.disabled} onChange={e=>control.set(e.target.value)}>{control.options.map(o=><option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}</select>:
      control.kind==='toggle'?<input type="checkbox" aria-label={name} checked={control.value} disabled={control.disabled} onChange={e=>control.set(e.target.checked)}/>:
      <input type="color" aria-label={name} value={control.value} disabled={control.disabled} onChange={e=>control.set(e.target.value)}/>}
    </div>;
   })}
   <button type="button" className="brush-full-settings" onClick={()=>{setMenu(null);openSettings();}}>Full Brush Settings <kbd>F4</kbd></button>
  </div>}
  {children}
 </div>;
}
