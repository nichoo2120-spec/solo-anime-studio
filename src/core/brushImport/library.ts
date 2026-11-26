import {importedCategory} from '../bitmapBrush';
import type {BrushLibrary,BrushPreset} from '../brushes';

type SavedLibrary={selected?:string;presets:BrushPreset[]};
type LibraryRow={key:string;preset:BrushPreset;order:number}|{key:'selection';selected?:string};
const hasBitmap=(preset:BrushPreset)=>preset.category===importedCategory||!!(
 preset.settings.nature?.bitmap||preset.defaults.nature?.bitmap||preset.settings.dbBitmap||preset.defaults.dbBitmap
);
let opening:Promise<IDBDatabase>|undefined;
let previous=new Map<string,BrushPreset>(),order=new Map<string,number>(),selected:string|undefined;
let orderedWrite=Promise.resolve();
function database(){
 return opening??=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('solo-anime-studio-brush-library',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('brushes',{keyPath:'key'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>{opening=undefined;reject(request.error);};
 });
}
export async function readBitmapLibrary():Promise<SavedLibrary>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const rows:Extract<LibraryRow,{preset:BrushPreset}>[]=[];
  let selection:string|undefined;
  const request=db.transaction('brushes').objectStore('brushes').openCursor();
  request.onsuccess=()=>{
   const cursor=request.result;
   if(cursor){
    const row=cursor.value as LibraryRow;
    if('preset' in row)rows.push(row);
    else if(row.key==='selection')selection=row.selected;
    cursor.continue();return;
   }
   rows.sort((a,b)=>a.order-b.order);
   const presets=rows.map(r=>r.preset);
   previous=new Map(presets.map(p=>[p.id,p]));order=new Map(rows.map(r=>[r.key,r.order]));selected=selection;
   resolve({presets,selected:selection});
  };
  request.onerror=()=>reject(request.error);
 });
}
export function writeBitmapLibrary(library:BrushLibrary){
 const save=async()=>{
  const presets=new Map(library.presets.filter(hasBitmap).map(preset=>[preset.id,preset]));
  const nextSelected=presets.has(library.brushId)?library.brushId:undefined;
  const nextOrder=new Map([...presets.keys()].map((id,index)=>[id,index]));
  const changes=[...presets.values()].filter(p=>p!==previous.get(p.id)||order.get(p.id)!==nextOrder.get(p.id));
  const removed=[...previous.keys()].filter(id=>!presets.has(id));
  if(!changes.length&&!removed.length&&nextSelected===selected)return;
  const db=await database();
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('brushes','readwrite'),store=tx.objectStore('brushes');
   for(const key of removed)store.delete(key);
   if(nextSelected!==selected)store.put({key:'selection',selected:nextSelected} satisfies LibraryRow);
   // Keep the entire import atomic. Queue another small batch inside the IDB
   // callback so large brush packs do not clone every tip in a single UI task.
   let next=0;
   const queue=()=>{
    const end=Math.min(changes.length,next+8);
    while(next<end){
     const preset=changes[next++],request=store.put({key:preset.id,preset,order:nextOrder.get(preset.id)!} satisfies LibraryRow);
     if(next===end&&end<changes.length)request.onsuccess=queue;
    }
   };
   queue();tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(tx.error??Error('Brush library save was interrupted.'));
  });
  previous=presets;order=nextOrder;selected=nextSelected;
 };
 const result=orderedWrite.then(save);
 orderedWrite=result.catch(()=>{});return result;
}
export function smallBrushPreferences(library:BrushLibrary):BrushLibrary{
 return {...library,presets:library.presets.filter(p=>p.category!==importedCategory).map(p=>{
  if(!hasBitmap(p))return p;
  const trim=(settings:BrushPreset['settings'])=>({...settings,dbBitmap:undefined,nature:settings.nature?{...settings.nature,bitmap:undefined}:undefined});
  return {...p,settings:trim(p.settings),defaults:trim(p.defaults)};
 })};
}
