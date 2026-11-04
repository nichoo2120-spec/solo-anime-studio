const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,uid,validateProject}=require('../src/core/model.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {frameList,selectDrawingFrame,addDrawingFrame,deleteDrawingFrame,enableIndependentLayers,setLayerHoldEnd,isLayerHeld}=require('../src/animation/timeline.ts');
const {linkCurrentCelToFrame,unlinkCurrentCel,linkedGroup,linkedCount,saveDrawingCycle,insertDrawingCycle,deleteDrawingCycle,cycleItems}=require('../src/animation/reuse.ts');
const stroke=(x=0)=>({id:uid(),kind:'stroke',tool:'brush',color:'#304060',points:[{x,y:0,p:1},{x:x+1,y:2,p:1}],size:3,opacity:1,pressure:false,response:1});
let p=newProject('link',640,360),layerId=p.activeLayerId;
p={...p,layers:p.layers.map(l=>l.id===layerId?{...l,operations:[stroke(1)]}:l)};
p=addDrawingFrame(p);p=addDrawingFrame(p);const ids=frameList(p).map(f=>f.id);
p=selectDrawingFrame(p,ids[0]);
p=linkCurrentCelToFrame(p,ids[2]);assert.equal(linkedCount(p),2);assert.equal(p.animation.frames[2].drawings[layerId],p.animation.frames[0].drawings[layerId]);
validateProject(JSON.parse(JSON.stringify(p)));
let store=new DocumentStore(p); // edits to SECOND linked key update FIRST
p=selectDrawingFrame(store.getSnapshot(),ids[2]);store.selectFrame(p);store.commit({...p,layers:p.layers.map(l=>l.id===layerId?{...l,operations:[...l.operations,stroke(2)]}:l)},'Draw stroke');
p=store.getSnapshot();assert.equal(frameList(p)[0].drawings[layerId].length,2);assert.equal(frameList(p)[2].drawings[layerId].length,2);
validateProject(JSON.parse(JSON.stringify(p)));
store.undo();assert.equal(frameList(store.getSnapshot())[0].drawings[layerId].length,1);
store.redo();assert.equal(frameList(store.getSnapshot())[0].drawings[layerId].length,2);
p=unlinkCurrentCel(store.getSnapshot());assert.equal(linkedGroup(p),null);store.commit(p,'Unlink');assert.equal(linkedCount(store.getSnapshot()),0);
let before=frameList(store.getSnapshot())[0].drawings[layerId];
store.commit({...p,layers:p.layers.map(l=>l.id===layerId?{...l,operations:[...l.operations,stroke(3)]}:l)});
assert.equal(frameList(store.getSnapshot())[0].drawings[layerId],before,'Unlink keeps original key independent');
// Deleting linked member safely removes orphan metadata.
p=selectDrawingFrame(store.getSnapshot(),ids[0]);store.selectFrame(p);p=linkCurrentCelToFrame(p,ids[1]);store.commit(p);
p=selectDrawingFrame(store.getSnapshot(),ids[1]);store.selectFrame(p);store.commit(deleteDrawingFrame(p));
assert.equal(Object.keys(store.getSnapshot().animation.celLinks??{}).length,0);validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));
// Cycle capture/apply; starts from two authored keys.
let c=newProject('cycles',640,360),layer=c.activeLayerId;
c={...c,layers:c.layers.map(l=>l.id===layer?{...l,operations:[stroke(11)]}:l)};
c=addDrawingFrame(c);let cf=frameList(c);c={...c,layers:c.layers.map(l=>l.id===layer?{...l,operations:[stroke(22)]}:l)};c=require('../src/animation/timeline.ts').syncActiveFrame(c);
c=selectDrawingFrame(c,cf[0].id);c=saveDrawingCycle(c,'Walk',2);
assert.equal(cycleItems(c)[0].frames.length,2);validateProject(JSON.parse(JSON.stringify(c)));
const cycleId=cycleItems(c)[0].id;
// Appends enough empty frames, then paste from last empty frame.
c=addDrawingFrame(selectDrawingFrame(c,cf[1].id));const startId=c.animation.activeFrameId;
c=insertDrawingCycle(c,cycleId,3);
assert.equal(frameList(c).length,8);assert.equal(c.animation.activeFrameId,startId);
assert.deepEqual(frameList(c).slice(2).map(f=>f.drawings[layer][0].points[0].x),[11,22,11,22,11,22]);
assert.equal(new Set(frameList(c).slice(2).map(f=>f.drawings[layer][0].id)).size,6,'Inserted strokes must be independent');
validateProject(JSON.parse(JSON.stringify(c)));
const cs=new DocumentStore(c);cs.commit(deleteDrawingCycle(c,cycleId),'Remove cycle');assert.equal(cycleItems(cs.getSnapshot()).length,0);assert.equal(frameList(cs.getSnapshot()).length,8);cs.undo();assert.equal(cycleItems(cs.getSnapshot()).length,1);
// Holds on independent layer must be split when inserting a cycle and other layers unchanged.
let h=newProject('held',640,360),l=h.activeLayerId;
h={...h,layers:h.layers.map(x=>x.id===l?{...x,operations:[stroke(50)]}:x)};
h=addDrawingFrame(h);h=addDrawingFrame(h);h=enableIndependentLayers(h);const hf=frameList(h);h=selectDrawingFrame(h,hf[0].id);h=setLayerHoldEnd(h,l,hf[0].id,2);assert(isLayerHeld(h,l,hf[1].id));
h=saveDrawingCycle(h,'Hold',2);h=selectDrawingFrame(h,hf[1].id);
let otherId=h.layers.find(x=>x.id!==l).id;const oldOthers=frameList(h).map(f=>f.drawings[otherId]);
h=insertDrawingCycle(h,cycleItems(h)[0].id,1,true);
assert(!isLayerHeld(h,l,hf[1].id));assert.deepEqual(frameList(h).map(f=>f.drawings[otherId]),oldOthers);
validateProject(JSON.parse(JSON.stringify(h)));
console.log('PASS linked/cycles: propagation both directions, undo/redo, unlink, delete cleanup, project roundtrip, cycle capture/repeat/unique IDs, hold split, other layer preservation');
