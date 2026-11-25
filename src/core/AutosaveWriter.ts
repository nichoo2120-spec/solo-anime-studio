import type {Project} from './model';
import {autosaveDelta} from './autosaveDelta';
import {repository,compactProjectAudio,type SavedRecord} from './persistence';
/** Immutable snapshots cross once; validation, IDB cloning and retention stay off the UI thread. */
export class AutosaveWriter{
 private base?:{requestId:number;project:Project};
 private worker?:Worker;private serial=0;private pending=new Map<number,{project:Project;resolve:(r:SavedRecord)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private fail(error:Error){this.base=undefined;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();this.worker?.terminate();this.worker=undefined;}
 save(project:Project):Promise<SavedRecord>;
 save(project:Project,ready:()=>Promise<boolean>):Promise<SavedRecord|undefined>;
 async save(project:Project,ready?:()=>Promise<boolean>):Promise<SavedRecord|undefined>{
  // On import/save once, put the large asset in IDB; send ONLY metadata to autosave worker.
  await repository.ensureAudioAsset(project);
  if(ready&&!await ready())return;
  const compact=compactProjectAudio(project);
  return new Promise((resolve,reject)=>{try{if(!this.worker){this.worker=new Worker(new URL('./autosave.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=e=>{const pending=this.pending.get(e.data.requestId);if(!pending)return;this.pending.delete(e.data.requestId);clearTimeout(pending.timer);if(e.data.error){this.base=undefined;pending.reject(Error(e.data.error));}else pending.resolve({id:pending.project.id,project:pending.project,kind:'autosave',savedAt:e.data.savedAt});};this.worker.onerror=()=>this.fail(Error('Autosave worker failed. The previous saved project remains available.'));}const requestId=++this.serial;
   // A stalled IndexedDB upgrade/worker previously left the UI on 'Saving…'
   // indefinitely, and prevented subsequent autosave attempts. Fail visibly.
   const timer=setTimeout(()=>{if(this.pending.has(requestId))this.fail(Error('Autosave timed out. Close other Studio tabs, then retry saving.'));},30000);
   this.pending.set(requestId,{project,resolve,reject,timer});
   const base=this.base;
   this.worker.postMessage(base?.project.id===project.id?{requestId,baseId:base.requestId,delta:autosaveDelta(base.project,compact)}:{requestId,project:compact});
   this.base={requestId,project:compact};}catch(e){this.fail(Error('Autosave could not start: '+String(e)));reject(e);}});}
 dispose(){this.fail(Error('Studio closed before autosave completed.'));}
}
