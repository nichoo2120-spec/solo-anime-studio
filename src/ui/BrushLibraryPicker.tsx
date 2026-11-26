import {useEffect,useMemo,useRef,useState,type MouseEvent} from 'react';
import {Grid2X2,List,Plus,Search} from 'lucide-react';
import {brushList,createCustomBrush,deleteCustomBrush,duplicateCustomBrush,isRetiredBlendPresetId,renameCustomBrush,updatePreset,type BrushLibrary,type BrushPreset,type BrushCategory,type BrushFamily} from '../core/brushes';
import {importedCategory} from '../core/bitmapBrush';
import {natureCategory} from '../core/natureBrush';
import {BrushImportControls} from './BrushImportControls';
import {TipCard} from './PaintBrushPicker';
import {readPreference,writePreference} from './preferences';

const tabs=['Ink','Pencil','Paint','Watercolor','Airbrush','Blend',natureCategory,importedCategory,'My brushes ★'] as const;
type Category=typeof tabs[number]|'Eraser';
const categoryOf=(p:BrushPreset):Category=>p.category==='Paint'?(p.family==='watercolor'?'Watercolor':p.family==='blend'?'Blend':p.id==='color-air'||p.settings.brushTip==='color-air'?'Airbrush':'Paint'):p.category;
const PAGE=24;
type Change=(update:(current:BrushLibrary)=>BrushLibrary)=>void;

export function BrushLibraryPicker({library,preset,eraser,onChange,choose,notify,close,drop}:{library:BrushLibrary;preset:BrushPreset;eraser:boolean;onChange:Change;choose:(id:string)=>void;notify:(message:string)=>void;close:()=>void;drop?:File[]}){
 const [category,setCategory]=useState<Category>(()=>categoryOf(preset));
 const [query,setQuery]=useState(''),[page,setPage]=useState(1),[importOpen,setImportOpen]=useState(!!drop);
 const [family,setFamily]=useState<BrushFamily|'all'>('all');
 const categoryOptions:BrushCategory[]=eraser?['Eraser']:['Pencil','Ink','Paint',natureCategory,...(library.presets.some(p=>p.category===importedCategory)?[importedCategory]:[])];
 const nativePresets=brushList(library,preset.category,preset.category==='Paint'?(family==='all'?undefined:family):undefined);
 const nativeGroups=new Map<string,BrushPreset[]>();
 for(const item of nativePresets){const pack=item.pack??'';if(!nativeGroups.has(pack))nativeGroups.set(pack,[]);nativeGroups.get(pack)?.push(item);}
 const chooseCategory=(next:BrushCategory)=>{
  const target=brushList(library,next)[0];if(!target)return;
  setFamily(target.family??'all');setCategory(categoryOf(target));choose(target.id);
 };
 const [layout,setLayout]=useState<'list'|'grid'>(()=>readPreference<string>('brush-picker-layout','list')==='grid'?'grid':'list');
 const [actions,setActions]=useState<{preset:BrushPreset;x:number;y:number}|null>(null);
 const [editing,setEditing]=useState<{brush:BrushPreset;mode:'rename'|'save'|'delete';name:string}|null>(null);
 const search=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!drop)search.current?.focus();},[]);
 useEffect(()=>{setCategory(categoryOf(preset));setPage(1);},[preset.id]);
 const filtered=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return library.presets.filter(p=>!isRetiredBlendPresetId(p.id)&&(eraser?p.category==='Eraser':category==='My brushes ★'?p.category!=='Eraser'&&!!p.custom:categoryOf(p)===category)
   &&(!needle||`${p.name} ${p.pack??''}`.toLowerCase().includes(needle)));
 },[library,category,query,eraser]);
 const groups=new Map<string,BrushPreset[]>();
 for(const p of filtered.slice(0,page*PAGE)){
  const group=p.pack??'';if(!groups.has(group))groups.set(group,[]);groups.get(group)!.push(p);
 }
 const select=(id:string)=>{choose(id);close();};
 const action=(e:MouseEvent,p:BrushPreset)=>{
  e.preventDefault();e.stopPropagation();
  const r=e.currentTarget.getBoundingClientRect();
  setActions({preset:p,x:Math.max(4,Math.min(e.clientX||r.left,innerWidth-190)),y:Math.max(4,Math.min(e.clientY||r.bottom,innerHeight-220))});
 };
 const execute=(kind:'rename'|'save'|'delete'|'duplicate'|'reset')=>{
  const p=actions?.preset;if(!p)return;
  setActions(null);
  if(kind==='reset'){onChange(old=>{const target=old.presets.find(x=>x.id===p.id);return target?updatePreset(old,p.id,{...target.defaults}):old;});return;}
  if(kind==='duplicate'){onChange(old=>duplicateCustomBrush(old,p.id));return;}
  setEditing({mode:kind,brush:p,name:p.name});
 };
 const commit=()=>{
  if(!editing)return;
  const {mode,brush,name}=editing;
  onChange(old=>{
   const p=old.presets.find(b=>b.id===brush.id);if(!p)return old;
   if(mode==='delete')return deleteCustomBrush(old,p.id);
   if(!name.trim())return old;
   return mode==='rename'?renameCustomBrush(old,p.id,name):createCustomBrush(old,name,p,p.settings,eraser);
  });
  setEditing(null);
 };
 return <BrushImportControls enabled={!eraser} showActions={importOpen} droppedFiles={drop} change={onChange} notify={notify}>
  <div className="brush-picker-header">
   <label className="brush-picker-search"><Search size={14}/><input ref={search} type="search" aria-label="Search brushes" placeholder="Search brushes" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
   <button type="button" aria-label={layout==='list'?'Grid view':'List view'} title={layout==='list'?'Grid view':'List view'} onClick={()=>{const next=layout==='list'?'grid':'list';setLayout(next);writePreference('brush-picker-layout',next);}}>{layout==='list'?<Grid2X2 size={15}/>:<List size={15}/>}</button>
   {!eraser&&<button type="button" className="brush-picker-add" aria-label="Add brushes" aria-expanded={importOpen} title="Add brushes" onClick={()=>setImportOpen(!importOpen)}><Plus size={17}/></button>}
  </div>
  <div className="brush-picker-tabs" aria-label="Brush categories" role="group">{(eraser?['Eraser'] as const:tabs).map(tab=><button type="button" key={tab} aria-pressed={category===tab} className={category===tab?'selected':''} onClick={()=>{setCategory(tab);setPage(1);}}>{tab}</button>)}</div>
  <details className="brush-picker-keyboard">
   <summary>Keyboard selection</summary>
   <label className="studio-select">Category<select aria-label="Brush category" value={preset.category} onChange={e=>chooseCategory(e.target.value as BrushCategory)}>{categoryOptions.map(c=><option key={c}>{c}</option>)}</select></label>
   {preset.category==='Paint'&&<label className="studio-select">Family<select aria-label="Brush family" value={family} onChange={e=>{
    const nextFamily=e.target.value as BrushFamily|'all';setFamily(nextFamily);setPage(1);
    const first=nextFamily==='all'?undefined:brushList(library,'Paint',nextFamily)[0];
    if(first){setCategory(categoryOf(first));choose(first.id);}
   }}>{[['all','All Paint'],['coloring','Coloring'],['paint','Paint'],['media','Media'],['watercolor','Watercolor'],['blend','Blend']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>}
   <label className="studio-select">Preset<select aria-label={eraser?'Eraser preset':'Brush preset'} value={preset.id} onChange={e=>choose(e.target.value)}>
    {[...nativeGroups].map(([pack,items])=>pack?<optgroup key={pack} label={pack}>{items.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>:items.map(p=><option key={p.id} value={p.id}>{p.name}</option>))}
   </select></label>
  </details>
  {editing&&<form className="brush-picker-edit" onSubmit={e=>{e.preventDefault();commit();}}>{editing.mode==='delete'?<span>Delete {editing.brush.name}?</span>:<input autoFocus aria-label="Preset name" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/>}<button type="submit">{editing.mode==='delete'?'Delete':'Save'}</button><button type="button" onClick={()=>setEditing(null)}>Cancel</button></form>}
  <div className="brush-picker-scroll">
   {filtered.length===0&&<p className="brush-picker-empty">No brushes found.</p>}
   {[...groups].map(([pack,brushes])=><div key={pack}>{pack&&<h4>{pack}</h4>}<div className={`brush-picker-results ${layout}`} role="group" aria-label={pack||category+' brushes'}>{brushes.map(p=><TipCard key={p.id} preset={p} active={p.id===preset.id} onChoose={select} onActions={action}/>)}</div></div>)}
   {filtered.length>page*PAGE&&<button type="button" onClick={()=>setPage(page+1)}>Show more brushes</button>}
  </div>
  {actions&&<><button type="button" className="brush-picker-dismiss" tabIndex={-1} aria-label="Close brush actions" onClick={()=>setActions(null)}/>
   <div className="brush-picker-actions" role="menu" aria-label={'Actions for '+actions.preset.name} style={{left:actions.x,top:actions.y}}>
    <button type="button" role="menuitem" onClick={()=>execute('duplicate')}>Duplicate</button>
    <button type="button" role="menuitem" onClick={()=>execute('save')}>Save to My brushes</button>
    {actions.preset.custom&&<><button type="button" role="menuitem" onClick={()=>execute('rename')}>Rename</button><button type="button" role="menuitem" onClick={()=>execute('delete')}>Delete</button></>}
    <button type="button" role="menuitem" onClick={()=>execute('reset')}>Reset</button>
   </div></>}
 </BrushImportControls>;
}
