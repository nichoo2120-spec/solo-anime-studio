const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,validateProject}=require('../src/core/model.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {addDrawingFrame,frameList,setDrawingFrameHoldById,enableIndependentLayers,setLayerHoldEnd,insertLayerKey,selectDrawingFrame,isLayerHeld}=require('../src/animation/timeline.ts');
const {buildXsheetIndex,xsheetRowAt,xsheetLayerCell,xsheetRows,xsheetVisibleRange}=require('../src/animation/xsheet.ts');
let p=newProject('Exposure sheet',640,360);
p=addDrawingFrame(p);p=addDrawingFrame(p);
const keys=frameList(p).map(f=>f.id),lid=p.layers[0].id;
p=setDrawingFrameHoldById(p,keys[0],2);p=setDrawingFrameHoldById(p,keys[1],3);
let index=buildXsheetIndex(p);assert.equal(index.total,6);assert.deepEqual(index.spans.map(s=>[s.start,s.end]),[[1,2],[3,5],[6,6]]);
assert.equal(xsheetRowAt(index,1).start,true);assert.equal(xsheetRowAt(index,2).frameId,keys[0]);assert.equal(xsheetRowAt(index,3).frameId,keys[1]);assert.equal(xsheetRowAt(index,4).offset,1);assert.equal(xsheetRowAt(index,6).frameId,keys[2]);
for(const x of [0,-2,7,1.3,Number.NaN])assert.equal(xsheetRowAt(index,x),null);
p=enableIndependentLayers(p);p=setLayerHoldEnd(p,lid,keys[0],1);assert(isLayerHeld(p,lid,keys[1]));
let held=xsheetLayerCell(p,xsheetRowAt(index,3),lid);assert.equal(held.held,true);assert.equal(held.label,'↪');
assert.equal(xsheetLayerCell(p,xsheetRowAt(index,2),lid).withinHold,true);
const store=new DocumentStore(p);store.commit(insertLayerKey(p,lid,keys[1],true),'Xsheet create key');assert.equal(isLayerHeld(store.getSnapshot(),lid,keys[1]),false);
store.undo();assert.equal(isLayerHeld(store.getSnapshot(),lid,keys[1]),true,'Undo restores layer hold');
store.redo();assert.equal(isLayerHeld(store.getSnapshot(),lid,keys[1]),false,'Redo restores key');
const original=frameList(store.getSnapshot())[1].drawings[lid];store.commit(setDrawingFrameHoldById(store.getSnapshot(),keys[1],4),'Xsheet adjust exposure');assert.equal(buildXsheetIndex(store.getSnapshot()).total,7);assert.equal(frameList(store.getSnapshot())[1].drawings[lid],original,'Changing hold never copies paint arrays');store.undo();assert.equal(buildXsheetIndex(store.getSnapshot()).total,6);
p=selectDrawingFrame(store.getSnapshot(),keys[2]);assert.equal(p.animation.activeFrameId,keys[2]);validateProject(JSON.parse(JSON.stringify(p)));
console.log('PASS Xsheet: 2s/3s exposures, independent layer holds, split-to-key, frame select, non-copy timing, Undo/Redo, save compatibility');
// Stress worst-case exposure count without ever allocating/rendering all 5,760 rows.
let stress=newProject('Stress',1920,1080),start=process.hrtime.bigint();
for(let i=1;i<240;i++)stress=addDrawingFrame(stress);
for(const f of frameList(stress))stress=setDrawingFrameHoldById(stress,f.id,24);
const model=buildXsheetIndex(stress);assert.equal(model.total,5760);
for(const offset of [0,125,2000,5000,model.total*28-400]){
 const visible=xsheetVisibleRange(model.total,offset,320);
 const rows=xsheetRows(model,visible.first,visible.last);
 assert(rows.length<=28,`Too many virtual rows ${rows.length}`);
 assert(rows.every(row=>row.exposure>=visible.first&&row.exposure<=visible.last));
}
const end=process.hrtime.bigint();console.log(`PASS Xsheet virtual rows: ${model.total} exposures, at most 28 mounted rows in a 320px viewport (${(Number(end-start)/1e6).toFixed(0)} ms full stress setup).`);
