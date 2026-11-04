/** v0.5.34 regression: UI/overlay work must not compete with Wacom input.
 * This is a source + prototype simulation, NOT a physical tablet benchmark.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///perf-test'").replaceAll('import.meta.env.DEV','false'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject}=require('../src/core/model.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {addDrawingFrame,frameList,setDrawingFrameHoldById}=require('../src/animation/timeline.ts');
const {exposurePlan}=require('../src/animation/playback.ts');
const {PlaybackOverlay}=require('../src/engine/PlaybackOverlay.ts');
const {OnionSkinOverlay}=require('../src/engine/OnionSkinOverlay.ts');
global.cancelAnimationFrame=()=>{};

let p=newProject('performance regression',640,360);
for(let i=0;i<15;i++)p=addDrawingFrame(p);
const store=new DocumentStore(p);
const controller=Object.create(PlaybackOverlay.prototype);
Object.assign(controller,{project:p,plan:exposurePlan(p),planDirty:false,state:'stopped',maxCached:3,cache:new Map(),generation:0,frameRequest:0,disposed:false,loop:true,fps:24,
 emit(){},clear(){},ensure:async()=>false,paint(){},prefetch(){},pauseAudio(){}});
let invalidations=0;
controller.maxSizeChanged=()=>{invalidations++;};
const originalPlan=controller.plan;
for(let i=0;i<100;i++){
 const current=store.getSnapshot();
 const first=current.layers[0];
 const layers=current.layers.map(l=>l.id!==first.id?l:{...l,operations:[...l.operations,{id:`draw-${i}`,kind:'stroke',tool:'brush',points:[],size:5,opacity:1,color:'#111'}]});
 store.commit({...current,layers},'Draw stroke');
 controller.update(store.getSnapshot());
}
assert.equal(controller.project,store.getSnapshot(),'Playback should retain the newest project.');
assert.equal(controller.plan,originalPlan,'Stopped playback must defer exposure-plan rebuilding.');
assert.equal(controller.planDirty,true);
assert.equal(invalidations,0,'No playback cache invalidation per pen commit.');
// A genuine hold edit must appear in the lazy plan before playback starts.
const frame=frameList(store.getSnapshot())[3];
const altered=setDrawingFrameHoldById(store.getSnapshot(),frame.id,4);
store.commit(altered,'Change hold');controller.update(altered);
(async()=>{
 await controller.play();
 assert.equal(controller.plan.total,exposurePlan(altered).total,'Playback must observe changed holds after deferred update.');
 assert.equal(controller.planDirty,false);
 assert.equal(controller.state,'stopped','Failed prewarm should recover cleanly.');
 // When playback is active, edits must still stop it immediately.
 controller.state='paused';
 const changed={...altered,name:'New shot name'};
 controller.update(changed);
 assert.equal(controller.state,'stopped');
 assert.equal(controller.project,changed);
 assert.equal(controller.plan.total,exposurePlan(changed).total);
 assert.ok(invalidations>0,'Active/paused edits still clear stale caches.');

 // Simulate requestIdleCallback and timeout independently: no idle-spin during pen strokes.
 const timers=new Map(),idle=new Map(),cleared=[];let sequence=0;
 global.window={
  setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;},
  requestIdleCallback:fn=>{const id=++sequence;idle.set(id,fn);return id;},
  cancelIdleCallback:id=>{cleared.push(['idle',id]);idle.delete(id);}
 };
 global.clearTimeout=id=>{cleared.push(['timeout',id]);timers.delete(id);};
 let drawing=true,prepared=0;
 const overlay=Object.create(OnionSkinOverlay.prototype);
 Object.assign(overlay,{isDrawing:()=>drawing,disposed:false,neighbors:[{frame:{id:'ghost'},kind:'pin',color:null}],ghosts:new Map(),generation:1,prepareOne:async()=>{prepared++;}});
 overlay.schedule();
 assert.equal(idle.size,0,'Active strokes must never queue an idle preview job.');
 assert.equal(timers.size,1);
 let pending=[...timers][0];
 assert.equal(pending[1].delay,100);
 timers.delete(pending[0]);pending[1].fn();
 assert.equal(timers.size,1,'While the pen remains down, one delayed retry is enough.');
 assert.equal(prepared,0);
 drawing=false;
 pending=[...timers][0];timers.delete(pending[0]);pending[1].fn();
 assert.equal(prepared,1,'After drawing ends, preview preparation resumes.');
 overlay.schedule();drawing=true; // schedule via idle, then cancel and switch mode
 const id=[...idle.keys()][0];assert.ok(id);
 overlay.cancelTask();assert.ok(cleared.some(c=>c[0]==='idle'&&c[1]===id));
 drawing=true;overlay.schedule();
 const timeoutId=[...timers.keys()][0];overlay.cancelTask();
 assert.ok(cleared.some(c=>c[0]==='timeout'&&c[1]===timeoutId),'Timeout cancellation must not call cancelIdleCallback.');

 const ui=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8');
 assert.match(ui,/audioActionDelegates\.current=\{/,'Audio callbacks must read latest actions');
 assert.match(ui,/onImport=\{audioActionCallbacks\.current\.importClip\}/,'Audio track must receive a stable import callback');
 assert.match(ui,/onChange=\{stablePanelHandlers\.current\.brushChange\}/,'Brush Studio callback identity must remain stable');
 assert.match(ui,/onTool=\{stablePanelHandlers\.current\.choose\}/,'Tool Wheel callback identity must remain stable');
 assert.match(fs.readFileSync(path.join(__dirname,'../src/ui/BrushStudio.tsx'),'utf8'),/export const BrushStudio=memo\(/);
 assert.match(fs.readFileSync(path.join(__dirname,'../src/ui/RadialToolbar.tsx'),'utf8'),/export const RadialToolbar=memo\(/);
 const engine=fs.readFileSync(path.join(__dirname,'../src/engine/StudioEngine.ts'),'utf8');
 assert.match(engine,/cachedLayerIds=store\.getSnapshot\(\)\.layers\.map/);
 assert.match(engine,/if\(p\.layers\.length!==this\.cachedLayerIds\.length\|\|p\.layers\.some/);
 assert.doesNotMatch(engine,/this\.smoothing\.documentChanged\(\);this\.renderer\.prune\(p\)/);
 console.log('PASS drawing performance: 100 stopped-playback commits avoid timeline rebuild/cache invalidations; hold edits still update playback; deferred Light Table pending work + safe cancellation; layer pruning gated; audio/brush/wheel callbacks stable.');
})().catch(e=>{console.error(e);process.exitCode=1;});
