import {validateProject,type Project} from './model';
import type {SceneAudio} from '../animation/audio';
export type SavedRecord={id:string;project:Project;savedAt:string;kind:'manual'|'autosave'};
export type Snapshot=SavedRecord&{key:string};

/** Backups still contain embedded audio; browser snapshots keep a small pointer to a
 * separately stored audio asset, so a 50 MB soundtrack isn't copied into every autosave.
 */
function audioAssetKey(project:Project):string|undefined {
 const a=project.audio;if(!a)return undefined;
 // Older projects may have no assetId. Use a stable project-scoped fingerprint.
 const prefix=project.id+':audio:';
 if(a.assetId?.startsWith(prefix))return a.assetId;
 const id=a.assetId?a.assetId.split(':audio:').at(-1)!:`legacy-${a.data.length}-${a.data.slice(22,86)}-${a.data.slice(-64)}`;
 return prefix+id;
}
export function compactProjectAudio(project:Project):Project {
 if(!project.audio)return project;
 return {...project,audio:{...project.audio,data:'',assetId:audioAssetKey(project)}};
}
const isCompact=(project:Project)=>!!project.audio&&project.audio.data===''&&typeof project.audio.assetId==='string';
function validateCompactAudio(project:Project){
 const a=project.audio;
 if(!a||!isCompact(project)||a.assetId!.length>400||!/^audio\/[\w+-]+$/.test(a.mime)||
  typeof a.name!=='string'||a.name.length<1||a.name.length>180||
  !Number.isFinite(a.duration)||a.duration<=0||a.duration>20*60||
  !Array.isArray(a.peaks)||a.peaks.length!==512||!a.peaks.every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('Invalid saved audio reference.');
}

export class ProjectRepository {
 private opening?:Promise<IDBDatabase>;
 private knownAssets=new Set<string>();
 constructor(private database='solo-anime-studio-v1'){}
 private db(){return this.opening??=new Promise<IDBDatabase>((resolve,reject)=>{
  const req=indexedDB.open(this.database,3);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});
   const snapshots=db.objectStoreNames.contains('snapshots')?req.transaction!.objectStore('snapshots'):db.createObjectStore('snapshots',{keyPath:'key'});
   // Index only metadata. IndexedDB key cursors do not clone complete artwork
   // for each snapshot when pruning history after an autosave.
   if(!snapshots.indexNames.contains('by-project-saved-at'))snapshots.createIndex('by-project-saved-at',['id','savedAt']);
   if(!db.objectStoreNames.contains('audio-assets'))db.createObjectStore('audio-assets',{keyPath:'key'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>{this.opening=undefined;reject(req.error);};
  req.onblocked=()=>reject(Error('Storage upgrade blocked by an older Studio tab. Close other Studio tabs and reload.'));
 });}
 private async assetExists(key:string){const db=await this.db();return new Promise<boolean>((resolve,reject)=>{const tx=db.transaction('audio-assets','readonly');const r=tx.objectStore('audio-assets').getKey(key);r.onsuccess=()=>resolve(r.result!==undefined);r.onerror=()=>reject(r.error);});}
 /** Store imported audio only once per project; normal strokes never copy the data into autosaves. */
 async ensureAudioAsset(project:Project):Promise<void>{
  const a=project.audio;
  if(!a)return;
  const key=audioAssetKey(project)!;
  if(this.knownAssets.has(key))return;
  if(!a.data){if(!await this.assetExists(key))throw Error('The audio asset is missing from local storage. Re-import the original file.');this.knownAssets.add(key);return;}
  const db=await this.db();
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('audio-assets','readwrite'),store=tx.objectStore('audio-assets');
   const req=store.getKey(key);
   req.onsuccess=()=>{if(req.result===undefined)store.put({key,data:a.data});};
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error('Audio save failed.'));
   tx.onabort=()=>reject(tx.error??Error('Not enough browser storage for this audio file.'));
  });
  this.knownAssets.add(key);
 }
 async save(project:Project,kind:'manual'|'autosave'='manual'){
  if(isCompact(project)){
   validateProject({...project,audio:undefined});validateCompactAudio(project);
  }else validateProject(project);
  await this.ensureAudioAsset(project);
  const db=await this.db(),storedProject=compactProjectAudio(project);
  const record:SavedRecord={id:project.id,project:storedProject,savedAt:new Date().toISOString(),kind};
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['projects','snapshots'],'readwrite');tx.objectStore('projects').put(record);tx.objectStore('snapshots').put({...record,key:project.id+':'+crypto.randomUUID()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error('Save failed.'));tx.onabort=()=>reject(tx.error??Error('Save was interrupted.'));});
  try{await this.pruneSnapshotKeys(project.id);}catch{/* Snapshot retention is best effort. */}
  return {...record,project};
 }
 private async all<T>(store:string):Promise<T[]>{const db=await this.db();return new Promise((resolve,reject)=>{const req=db.transaction(store).objectStore(store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 private async pruneSnapshotKeys(id:string){
  const db=await this.db();
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('snapshots','readwrite');
   const store=tx.objectStore('snapshots');
   const range=IDBKeyRange.bound([id,''],[id,'\uffff']);
   const request=store.index('by-project-saved-at').openKeyCursor(range,'prev');
   let kept=0;
   request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;
    if(++kept>10)store.delete(cursor.primaryKey);
    cursor.continue();
   };
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??Error('Snapshot pruning failed.'));
   tx.onabort=()=>reject(tx.error??Error('Snapshot pruning interrupted.'));
  });
 }
 private async rawSnapshots(id:string){
  const db=await this.db();
  return new Promise<Snapshot[]>((resolve,reject)=>{
   const range=IDBKeyRange.bound([id,''],[id,'\uffff']);
   const request=db.transaction('snapshots','readonly').objectStore('snapshots').index('by-project-saved-at').getAll(range);
   request.onsuccess=()=>resolve((request.result as Snapshot[]).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));
   request.onerror=()=>reject(request.error??Error('Could not load project snapshots.'));
  });
 }
 private async hydrateRecords<T extends SavedRecord>(records:T[]):Promise<T[]>{
  const audioCache=new Map<string,Promise<string>>();const db=await this.db();
  return Promise.all(records.map(async record=>{
   const a=record.project.audio;
   if(!a||a.data!=='')return record; // v1 legacy records still embed their audio.
   const key=a.assetId;
   if(!key)throw Error('Audio asset reference is missing.');
   let pending=audioCache.get(key);
   if(!pending){pending=new Promise<string>((resolve,reject)=>{
    const req=db.transaction('audio-assets','readonly').objectStore('audio-assets').get(key);
    req.onsuccess=()=>typeof req.result?.data==='string'?resolve(req.result.data):reject(Error('Audio asset missing from browser storage.'));
    req.onerror=()=>reject(req.error);
   });audioCache.set(key,pending);}
   const data=await pending;
   const project={...record.project,audio:{...a,data}};
   return {...record,project};
  }));
 }
 /** v0.5.176: read one saved project by id (used to reopen the last project at start
  * without reading every saved project from browser storage first). */
 async get(id:string):Promise<SavedRecord|undefined>{const db=await this.db();const record=await new Promise<SavedRecord|undefined>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(id);req.onsuccess=()=>resolve(req.result as SavedRecord|undefined);req.onerror=()=>reject(req.error);});return record?(await this.hydrateRecords([record]))[0]:undefined;}
 async list(){const records=(await this.all<SavedRecord>('projects')).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));return this.hydrateRecords(records);}
 async snapshots(id:string){return this.hydrateRecords(await this.rawSnapshots(id));}
 /** Delete selected projects, their history and the separate audio assets atomically. */
 async deleteProjects(ids:string[]){
  const unique=[...new Set(ids.filter(id=>typeof id==='string'&&id.trim()))];
  if(!unique.length)return 0;
  const db=await this.db();
  const removed=await new Promise<number>((resolve,reject)=>{
   const tx=db.transaction(['projects','snapshots','audio-assets'],'readwrite');
   const projects=tx.objectStore('projects'),snapshots=tx.objectStore('snapshots'),audio=tx.objectStore('audio-assets');
   const targets=new Set(unique);let removed=0;
   for(const id of unique){const request=projects.get(id);request.onsuccess=()=>{if(request.result){projects.delete(id);removed++;}};}
   const cursor=snapshots.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(targets.has((c.value as Snapshot).id))c.delete();c.continue();};
   const assetCursor=audio.openCursor();assetCursor.onsuccess=()=>{const c=assetCursor.result;if(!c)return;if(unique.some(id=>(c.key as string).startsWith(id+':audio:')))c.delete();c.continue();};
   tx.oncomplete=()=>resolve(removed);tx.onerror=()=>reject(tx.error??Error('Project deletion failed.'));tx.onabort=()=>reject(tx.error??Error('Project deletion interrupted.'));
  });
  for(const id of unique)for(const key of this.knownAssets)if(key.startsWith(id+':audio:'))this.knownAssets.delete(key);
  return removed;
 }
 async load(id:string){const p=(await this.list()).find(p=>p.id===id);if(!p)throw Error('Project was not found.');validateProject(p.project);return p;}
}
export const repository=new ProjectRepository();
export function downloadProject(project:Project){validateProject(project);const blob=new Blob([JSON.stringify(project)],{type:'application/json'});downloadBlob(blob,project.name.replace(/[^a-z\d -]/gi,'_')+'.solo.json');}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function importProject(file:File){if(file.size>200*1024*1024)throw Error('Project backups are limited to 200 MB.');return validateProject(JSON.parse(await file.text()));}
