const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,uid,validateProject}=require('../src/core/model.ts');
const {addDrawingFrame,selectDrawingFrame,frameList,syncActiveFrame,deleteDrawingFrame}=require('../src/animation/timeline.ts');
const {saveDrawingCycleRange,cycleItems}=require('../src/animation/reuse.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {timelineDeleteKey}=require('../src/core/keyboardActions.ts');
const stroke=(x)=>({id:uid(),kind:'stroke',tool:'brush',color:'#203040',points:[{x,y:0,p:1},{x:x+1,y:1,p:1}],size:3,opacity:1,pressure:false,response:1});
let doc=newProject('range',1280,720),layer=doc.activeLayerId;
// Create six real drawing keys with distinct art, rather than merely 6 exposure holds.
for(let i=0;i<6;i++){
 if(i>0)doc=addDrawingFrame(doc);
 doc={...doc,layers:doc.layers.map(l=>l.id===layer?{...l,operations:[stroke(i*10)]}:l)};
 doc=syncActiveFrame(doc);
}
const beforeIds=frameList(doc).map(f=>f.id);
doc=selectDrawingFrame(doc,beforeIds[5]); // active at Frame 6, but capture Frames 2-4.
let saved=saveDrawingCycleRange(doc,'Frames 2–4',1,3);
assert.equal(cycleItems(saved)[0].frames.length,3);
assert.deepEqual(cycleItems(saved)[0].frames.map(ops=>ops[0].points[0].x),[10,20,30]);
assert.equal(saved.animation.activeFrameId,beforeIds[5],'capture does not navigate or change active frame');
assert.deepEqual(frameList(saved).map(f=>f.id),beforeIds,'capture must not alter timeline');
validateProject(JSON.parse(JSON.stringify(saved)));
for(const [start,end] of [[-1,3],[1,-1],[5,4],[2,6],[0,0],[2,1]])assert.throws(()=>saveDrawingCycleRange(doc,'Nope',start,end));
let large=doc;
while(frameList(large).length<18)large=addDrawingFrame(large);
assert.throws(()=>saveDrawingCycleRange(large,'Too long',0,16),/2–16/);
const store=new DocumentStore(saved);
store.selectFrame(selectDrawingFrame(store.getSnapshot(),beforeIds[2]));
store.commit(deleteDrawingFrame(store.getSnapshot()),'Delete drawing frame');
assert.equal(frameList(store.getSnapshot()).length,5);
assert(!frameList(store.getSnapshot()).some(f=>f.id===beforeIds[2]));
assert.deepEqual(frameList(store.getSnapshot()).map(f=>f.id),beforeIds.filter(id=>id!==beforeIds[2]));
validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));
store.undo();assert.deepEqual(frameList(store.getSnapshot()).map(f=>f.id),beforeIds);
store.redo();assert.equal(frameList(store.getSnapshot()).length,5);
const e=(key,mods={})=>({key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...mods});
for(const key of ['Delete','Backspace']){
 assert(timelineDeleteKey(e(key),true),key+' on focused frame deletes frame');
 assert(!timelineDeleteKey(e(key),false),key+' on canvas does not delete frame');
 assert(!timelineDeleteKey(e(key,{ctrlKey:true}),true),key+' with ctrl is not frame-delete');
 assert(!timelineDeleteKey(e(key,{altKey:true}),true),key+' with alt is not frame-delete');
 assert(!timelineDeleteKey(e(key,{shiftKey:true}),true),key+' with shift is not frame-delete');
}
assert(!timelineDeleteKey(e('x'),true));
const app=fs.readFileSync('src/ui/App.tsx','utf8');
assert(app.indexOf('timelineDeleteKey(e,frameFocused)')<app.indexOf('engine.current?.deleteSelectedArtwork()'),'focused frame delete must precede stroke delete');
assert(app.includes('.cel-select,.layer-exposure-cell,.xsheet-exposure-number,.xsheet-layer-slot > button:not(.xsheet-split)'));
const ui=fs.readFileSync('src/ui/ReuseShelf.tsx','utf8');
for(const label of ['Cycle start frame','Cycle end frame','Save selected frame range'])assert(ui.includes(label));
assert(!ui.includes('Number of consecutive drawing cels'),'ambiguous old form has been replaced');
console.log('PASS cycle range & Delete: explicit inclusive frame capture unrelated to active frame, data integrity, validation, source unchanged, Undo/Redo, Mac Backspace and Windows Delete focus scoping');
