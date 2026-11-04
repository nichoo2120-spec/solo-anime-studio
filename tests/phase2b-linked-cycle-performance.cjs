const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,uid}=require('../src/core/model.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {addDrawingFrame,frameList,selectDrawingFrame}=require('../src/animation/timeline.ts');
const {linkCurrentCelToFrame,saveDrawingCycle,cycleItems,linkedCount}=require('../src/animation/reuse.ts');
const stroke=(i)=>({id:uid(),kind:'stroke',tool:'brush',color:'#123456',size:3,opacity:1,pressure:false,response:1,points:[{x:i,y:i,p:1}]});
let p=newProject('Performance regression',640,360),layer=p.activeLayerId;
p={...p,layers:p.layers.map(l=>l.id===layer?{...l,operations:[stroke(0)]}:l)};
p=addDrawingFrame(p);p=selectDrawingFrame(p,frameList(p)[0].id);p=linkCurrentCelToFrame(p,frameList(p)[1].id);
p=saveDrawingCycle(p,'Blink',2);
const library=cycleItems(p),initialMap=p.animation.celLinks;
const store=new DocumentStore(p);let t=performance.now();
for(let i=0;i<100;i++){
 const before=store.getSnapshot(),layers=before.layers.map(l=>l.id===layer?{...l,operations:[...l.operations,stroke(i+1)]}:l);
 store.commit({...before,layers},'Simulated stroke');
 assert.strictEqual(cycleItems(store.getSnapshot()),library);
 assert.strictEqual(store.getSnapshot().animation.celLinks,initialMap);
 assert.equal(linkedCount(store.getSnapshot()),2);
 assert.strictEqual(frameList(store.getSnapshot())[0].drawings[layer],frameList(store.getSnapshot())[1].drawings[layer]);
}
console.log('PASS reuse performance: 100 synthetic pen commits with linked keys caused no cycle snapshot re-generation or link map mutation; '+(performance.now()-t).toFixed(1)+'ms model-only (not hardware pen latency)');
