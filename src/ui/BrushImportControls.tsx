import {useRef,useState,type DragEvent, type ReactNode} from 'react';
import {addImportedBrushes,type BrushLibrary} from '../core/brushes';
import {importInWorker} from '../core/brushImport/client';
import {brushAccept,packName,type AlphaSource,type BrushImportAsset} from '../core/brushImport/types';

export function BrushImportControls({children,change,notify,enabled}:{
 children:ReactNode;enabled:boolean;
 change:(update:(library:BrushLibrary)=>BrushLibrary)=>void;notify:(message:string)=>void;
}){
 const input=useRef<HTMLInputElement>(null),busy=useRef(false),[state,setState]=useState<{name:string;current:number;total:number}>();
 const [mode,setMode]=useState<AlphaSource>('auto'),[error,setError]=useState('');
 async function load(files:File[]){
  if(!files.length||busy.current)return;
  busy.current=true;setError('');
  const packs:{name:string;brushes:BrushImportAsset[]}[]=[],errors:string[]=[];
  try{
   for(const file of files){
    setState({name:file.name,current:0,total:0});
    try{
     let refreshed=0;
     const brushes=await importInWorker(file,mode,(current,total)=>{
      const now=performance.now();if(now-refreshed<100&&current>0&&current<total)return;
      refreshed=now;setState({name:file.name,current,total:current===0?0:total});
     });
     packs.push({name:packName(file.name),brushes});
    }catch(reason){errors.push(file.name+' — '+(reason instanceof Error?reason.message:'Could not read this brush file.'));}
   }
   if(packs.length){
    change(old=>packs.reduce((library,pack)=>addImportedBrushes(library,pack.name,pack.brushes),old));
    const count=packs.reduce((sum,pack)=>sum+pack.brushes.length,0);
    notify('Imported '+count+(count===1?' brush.':' brushes.'));
   }
   if(errors.length)setError(errors.join('\n'));
  }finally{setState(undefined);busy.current=false;}
 }
 const hasFiles=(e:DragEvent)=>e.dataTransfer.types.includes('Files');
 return <div className="brush-import-surface"
  onDragOver={enabled?e=>{if(hasFiles(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';}}:undefined}
  onDrop={enabled?e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();void load(Array.from(e.dataTransfer.files));}}:undefined}>
  {enabled&&<>
   <div className="brush-import-actions">
    <button type="button" disabled={!!state} onClick={()=>input.current?.click()}>Import brushes</button>
    <select aria-label="Imported image mask" value={mode} disabled={!!state} onChange={e=>setMode(e.target.value as AlphaSource)}><option value="auto">Auto image mask</option><option value="luminance">Dark paint</option><option value="alpha">Use alpha</option></select>
    <input ref={input} type="file" aria-label="Choose brush files" accept={brushAccept} multiple hidden onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void load(files);}}/>
   </div>
   {state&&<div className="brush-import-progress" role="status"><span>Importing {state.name}</span><progress aria-label="Brush import progress" max={state.total||undefined} value={state.total?state.current:undefined}/></div>}
   {error&&<p className="brush-import-error" role="alert">{error}</p>}
  </>}
  {children}
 </div>;
}
