import {buildInfo} from '../core/buildInfo';
import type {Project,Layer} from '../core/model';
import type {LayerRenderer} from './renderer';

type RecordEntry={id:string;key:string;used:number;bytes:number;layers:{id:string;blob:Blob}[]};
const database=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('solo-anime-studio-render-cache-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('renders',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const request=<T,>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const visible=(p:Project)=>p.layers.filter(l=>l.visible&&l.operations.length);
async function key(p:Project){const bytes=new TextEncoder().encode(JSON.stringify([buildInfo.renderer,p.version,p.width,p.height,p.previousStage,p.shotFrame,p.animation?.activeFrameId,visible(p).map(l=>[l.id,l.operations])]));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
const png=(c:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Raster cache encoding failed')),'image/png'));

/** Disposable acceleration only. Editable project data remains the source of truth.
 * Validate the entire visible operation history before adopting any cached pixels. */
export async function restoreProjectRasters(p:Project,renderer:LayerRenderer){
 let db:IDBDatabase|undefined;const decoded:ImageBitmap[]=[];
 try{db=await database();const entry=await request(db.transaction('renders').objectStore('renders').get(p.id)) as RecordEntry|undefined;
  if(!entry||entry.key!==await key(p))return false;
  const layers=visible(p);if(layers.length!==entry.layers.length)return false;
  for(const l of layers){const saved=entry.layers.find(s=>s.id===l.id);if(!saved)return false;const image=await createImageBitmap(saved.blob);decoded.push(image);if(image.width!==p.width||image.height!==p.height)return false;}
  layers.forEach((l,i)=>renderer.seedCachedLayer(l,p,decoded[i]));return true;
 }catch{return false;}finally{decoded.forEach(b=>b.close());db?.close();}
}

export async function cacheProjectRasters(p:Project,renderer:LayerRenderer){
 let db:IDBDatabase|undefined;const copies:{layer:Layer;canvas:HTMLCanvasElement}[]=[];
 try{
  if(p.width*p.height*4*visible(p).length>64*1024*1024)return;
  // Let the project become interactive before copying full-resolution layers.
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  for(const layer of visible(p)){
   const source=renderer.cachedLayer(layer,p);if(!source)return;
   const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;canvas.getContext('2d')!.drawImage(source,0,0);copies.push({layer,canvas});
   // Yield between layers and abandon a stale snapshot if drawing changed the cache.
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  if(!copies.length)return;
  const fingerprint=await key(p),layers=await Promise.all(copies.map(async c=>({id:c.layer.id,blob:await png(c.canvas)}))),bytes=layers.reduce((n,l)=>n+l.blob.size,0);if(bytes>64*1024*1024)return;
  db=await database();const entries=await request(db.transaction('renders').objectStore('renders').getAll()) as RecordEntry[];
  const tx=db.transaction('renders','readwrite'),store=tx.objectStore('renders');let total=bytes,count=1;
  for(const entry of entries.filter(e=>e.id!==p.id).sort((a,b)=>b.used-a.used)){total+=entry.bytes;count++;if(total>128*1024*1024||count>8)store.delete(entry.id);}
  store.put({id:p.id,key:fingerprint,used:Date.now(),bytes,layers} satisfies RecordEntry);
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
 }catch{/* A cache failure must never prevent saving or opening a project. */}finally{copies.forEach(c=>c.canvas.width=c.canvas.height=0);db?.close();}
}

