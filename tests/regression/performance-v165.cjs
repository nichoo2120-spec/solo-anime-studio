const ledger=require('../revision-ledger-v174.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const read=name=>fs.readFileSync(name,'utf8');
const store=read('src/core/persistence.ts'),writer=read('src/core/AutosaveWriter.ts'),engine=read('src/engine/StudioEngine.ts');
assert(store.includes("indexedDB.open(this.database,3)"),'new database version must create the metadata index');
assert(store.includes("snapshots.createIndex('by-project-saved-at',['id','savedAt'])"),'migration index is missing');
assert(store.includes(".openKeyCursor(range,'prev')"),'history retention must enumerate keys only');
assert(!store.includes("(await this.rawSnapshots(project.id)).slice(10)"),'save must not read every large artwork snapshot');
assert(store.includes(".index('by-project-saved-at').getAll(range)"),'snapshot UI should load only this project');
assert(writer.includes("this.fail(Error('Autosave timed out."),'worker must not hold Saving forever');
assert(writer.includes('clearTimeout(pending.timer)'),'completed worker requests must clear the timeout');
assert(engine.includes('const cachedBelow=cachedDrawing?this.drawingFrames.restore(ctx,dirtyFrame):undefined'),'preserve rendering fix');
for(const file of ['src/core/persistence.ts','src/core/AutosaveWriter.ts']){
 const result=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.equal(result.diagnostics?.length??0,0,file+': TypeScript syntax');
}
const crypto=require('node:crypto'),revisions=require('../fixtures/performance-v165-revisions.json'),v166=require('../fixtures/performance-v166-revisions.json');for(const [name,hashes] of Object.entries(revisions))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex'),ledger(name,v166[name]?.after??hashes.after),name+' revision hash');
console.log('PASS v165 autosave retention, worker timeout and untouched drawing-source guards (source checks)');
