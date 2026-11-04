const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {ProjectRepository,compactProjectAudio}=require('../src/core/persistence.ts');
const {newProject,validateProject}=require('../src/core/model.ts');
const {MAX_AUDIO_BYTES,MAX_AUDIO_SECONDS}=require('../src/animation/audio.ts');
global.IDBKeyRange={bound:(lower,upper)=>({lower,upper})};
function memoryDB(){
 const tables={projects:new Map(),snapshots:new Map(),'audio-assets':new Map()};
 return {tables,transaction(_names,_mode){
  let pending=0;const tx={oncomplete:null,onerror:null,onabort:null,objectStore(name){
   const store=tables[name];assert(store);
   const query=(job)=>{pending++;const req={result:undefined,onsuccess:null,onerror:null};queueMicrotask(()=>{try{req.result=job();req.onsuccess?.();}catch(e){req.onerror?.(e);}finally{pending--;finished();}});return req;};
   return {
    get:(key)=>query(()=>store.get(key)),
    getKey:(key)=>query(()=>store.has(key)?key:undefined),
    getAll:()=>query(()=>[...store.values()]),
    put:(value)=>query(()=>{const key=value.key??value.id;store.set(key,structuredClone(value));return key;}),
    delete:(key)=>query(()=>{store.delete(key);}),
    index(name){assert.equal(name,'by-project-saved-at');return {
     openKeyCursor(range,direction){
      pending++;const records=[...store.values()].filter(v=>v.id===range.lower[0]).sort((a,b)=>a.savedAt.localeCompare(b.savedAt));
      if(direction==='prev')records.reverse();let i=0;
      const req={result:undefined,onsuccess:null};function advance(){const value=records[i++];if(!value){req.result=null;req.onsuccess?.();pending--;finished();return;}
       req.result={primaryKey:value.key,continue(){queueMicrotask(advance);}};req.onsuccess?.();}queueMicrotask(advance);return req;
     },
     getAll(range){return query(()=>[...store.values()].filter(v=>v.id===range.lower[0]));}
    };},
    openCursor(){pending++;let keys=[...store.keys()],i=0;const req={result:undefined,onsuccess:null};function advance(){const key=keys[i++];if(key===undefined){req.result=null;req.onsuccess?.();pending--;finished();return;}req.result={key,value:store.get(key),delete(){store.delete(key);return {};},continue(){queueMicrotask(advance);}};req.onsuccess?.();}queueMicrotask(advance);return req;}
   };
  }};
  function finished(){if(pending===0)queueMicrotask(()=>{if(pending===0)tx.oncomplete?.();});}
  return tx;
 }};
}
async function main(){
 assert.equal(MAX_AUDIO_BYTES,50*1024*1024);assert.equal(MAX_AUDIO_SECONDS,20*60);
 const db=memoryDB(),repo=new ProjectRepository('audio-dedup-unit');repo.opening=Promise.resolve(db);
 let project=newProject('Big audio smoke',640,360);
 const audio={version:1,name:'big.mp3',mime:'audio/mpeg',data:'data:audio/mpeg;base64,'+'A'.repeat(9*1024*1024),duration:500,peaks:Array(512).fill(.2),assetId:'asset-abc'};
 project={...project,audio};validateProject(project);
 const start=performance.now();
 await repo.save(project,'manual');
 const compact=compactProjectAudio(project);assert.equal(compact.audio.data,'');
 await repo.save(compact,'autosave');await repo.save(compact,'autosave');
 assert.equal(db.tables['audio-assets'].size,1,'one stored asset across three saves');
 assert([...db.tables.snapshots.values()].every(s=>s.project.audio.data===''),'snapshots contain only metadata');
 assert.equal(db.tables.projects.get(project.id).project.audio.data,'','project stored compact');
 const list=await repo.list();assert.equal(list.length,1);assert.equal(list[0].project.audio.data,audio.data);
 const snaps=await repo.snapshots(project.id);assert.equal(snaps.length,3);assert(snaps.every(s=>s.project.audio.data===audio.data));
 const legacy=newProject('Old project',640,360);db.tables.projects.set(legacy.id,{id:legacy.id,project:{...legacy,audio:{...audio,assetId:undefined}},kind:'manual',savedAt:new Date().toISOString()});
 const recovered=await repo.list();assert.equal(recovered.find(r=>r.id===legacy.id).project.audio.data,audio.data,'legacy embedded audio opens');
 await repo.save(recovered.find(r=>r.id===legacy.id).project);assert.equal(db.tables['audio-assets'].size,2,'legacy audio migrated to one shared asset');
 assert.equal(await repo.deleteProjects([project.id]),1);assert.equal(db.tables['audio-assets'].size,1,'deleting project prunes its audio assets');
 assert.equal((await repo.list()).length,1,'other project retained');
 const copy={...project,id:'copy-of-project',audio:{...project.audio,assetId:compact.audio.assetId}};await repo.save(copy,'manual');
 assert(db.tables['audio-assets'].has('copy-of-project:audio:asset-abc'),'Save As uses new project-scoped asset rather than nested keys');
 for(let i=0;i<13;i++)await repo.save({...copy,name:'Saving revision '+i},'autosave');
 assert.equal((await repo.snapshots(copy.id)).length,10,'retention must keep only 10 recovery snapshots per project');
 assert.equal((await repo.load(copy.id)).project.name,'Saving revision 12','latest saved content must remain available');
 console.log('PASS 50 MB/20 min acceptance, 9MB clip, 3 saves store one asset, compact autosaves, hydration, legacy import, deletion; simulated IndexedDB '+(performance.now()-start).toFixed(1)+'ms');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
