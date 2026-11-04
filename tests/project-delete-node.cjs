const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {ProjectRepository}=require('../src/core/persistence.ts');

function databaseWith(records,points){
 const tables={projects:new Map(records.map(r=>[r.id,r])),snapshots:new Map(points.map(p=>[p.key,p])),'audio-assets':new Map([['oldA:audio:x',{key:'oldA:audio:x',data:'test'}],['keep:audio:1',{key:'keep:audio:1',data:'test'}]])};
 const db={
  transaction(names,mode){
   assert.equal(mode,'readwrite');assert.deepEqual(names,['projects','snapshots','audio-assets']);
   let pending=0;
   const tx={oncomplete:null,onerror:null,onabort:null,objectStore(name){
    assert(name in tables);
    const store=tables[name];
    return {
     get(id){
      const request={result:undefined,onsuccess:null,onerror:null};pending++;
      queueMicrotask(()=>{request.result=store.get(id);request.onsuccess?.();pending--;finish();});
      return request;
     },
     delete(id){
      const request={onsuccess:null};pending++;
      queueMicrotask(()=>{store.delete(id);request.onsuccess?.();pending--;finish();});
      return request;
     },
     openCursor(){
      const request={result:undefined,onsuccess:null};pending++;
      const entries=[...store.entries()];let index=0;
      function advance(){
       if(index>=entries.length){request.result=null;request.onsuccess?.();pending--;finish();return;}
       const [key,value]=entries[index++];
       request.result={key,value,delete(){store.delete(key);return {};},continue(){queueMicrotask(advance);}};
       request.onsuccess?.();
      }
      queueMicrotask(advance);return request;
     }
    };
   }};
   function finish(){if(pending===0)queueMicrotask(()=>{if(pending===0)tx.oncomplete?.();});}
   return tx;
  }
 };
 return {tables,db};
}
async function main(){
 const db=databaseWith([{id:'oldA'},{id:'oldB'},{id:'keep'}],[{id:'oldA',key:'oldA:1'},{id:'oldA',key:'oldA:2'},{id:'oldB',key:'oldB:1'},{id:'keep',key:'keep:1'}]);
 const repo=new ProjectRepository('local-project-delete-unit');repo.opening=Promise.resolve(db.db);
 const removed=await repo.deleteProjects(['oldA','oldB','oldA']);assert.equal(removed,2);
 assert.deepEqual([...db.tables.projects.keys()],['keep']);assert.deepEqual([...db.tables.snapshots.keys()],['keep:1']);assert.deepEqual([...db.tables['audio-assets'].keys()],['keep:audio:1']);
 assert.equal(await repo.deleteProjects(['missing']),0);assert.equal(await repo.deleteProjects([]),0);
 const app=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8');const shortcuts=fs.readFileSync(path.join(__dirname,'../src/core/shortcuts.ts'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
 for(const token of ['deleteSelectedProjects()','await saveChain.current.catch','r.id===doc.id','window.confirm(','Delete selected (','await repository.deleteProjects(ids)','setRecords(await repository.list())'])assert(app.includes(token),`Missing safety/UI wiring: ${token}`);
 for(const token of ["openProjects:'ctrl+alt+o'","command==='openProjects'",'project-delete-choice'])assert(shortcuts.includes(token)||app.includes(token)||css.includes(token),`Missing shortcut/UI ${token}`);
 for(const file of ['src/core/persistence.ts','src/ui/App.tsx','src/core/shortcuts.ts']){const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');const result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});assert(!result.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),`TypeScript syntax errors in ${file}`);}
 console.log('PASS local cleanup: selected project/snapshot deletion, untouched project protection, duplicates, missing IDs, confirmation + shortcut/UI wiring, TS syntax');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
