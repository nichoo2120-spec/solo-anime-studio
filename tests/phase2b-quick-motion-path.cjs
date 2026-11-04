const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8').replaceAll('import.meta.url',"'file:///quick-path'").replaceAll('import.meta.env.DEV','false'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {newProject,appendOperation,validateProject}=require('../src/core/model.ts');
const {addDrawingFrame,enableIndependentLayers,syncActiveFrame,frameList,setLayerHoldEnd,selectDrawingFrame}=require('../src/animation/timeline.ts');
const {createQuickMotionPath,editMotionPath,motionPathMode}=require('../src/animation/motionPlanning.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {boundsOf}=require('../src/engine/strokeSelection.ts');
const op=(id,x,y)=>({id,kind:'stroke',tool:'brush',points:[{x:x-5,y,p:1},{x:x+5,y,p:1}],size:2,opacity:1,color:'#111111',pressure:false,response:1});
const center=(p,i,lid,id)=>{const b=boundsOf(frameList(p)[i].drawings[lid].filter(o=>o.id===id));return {x:b.x+b.w/2,y:b.y+b.h/2};};
const approx=(x,y)=>assert(Math.abs(x-y)<.0001,`${x} != ${y}`);
let doc=enableIndependentLayers(newProject('Quick ball',320,240)),lid=doc.activeLayerId;
for(let i=0;i<5;i++){if(i)doc=addDrawingFrame(doc);doc=appendOperation(doc,op('ball'+i,20+i*35,70+(i%2?60:0)));doc=syncActiveFrame(doc);}
const ids=frameList(doc).map(f=>f.id);
doc=selectDrawingFrame(doc,ids[0]);
let result=createQuickMotionPath(doc,0,4,['ball0']);
assert.equal(result.bound,5);assert.equal(result.skipped,0);assert.equal(result.project.motionPlanning.arcs.length,1);
const arc=result.project.motionPlanning.arcs[0];assert.equal(arc.points.length,3);assert.equal(arc.bindings.length,5);assert.equal(motionPathMode(arc),'auto');
const store=new DocumentStore(doc);store.commit(result.project,'Create Motion Path');store.undo();assert.strictEqual(store.getSnapshot(),doc,'one Undo returns to before path and adjustments');store.redo();
const dragged=editMotionPath(result.project,arc.id,ids[2],90,8);
assert(dragged.moved>=2,'Drag middle point adjusts neighbor drawings');assert.notEqual(center(dragged.project,1,lid,'ball1').y,center(result.project,1,lid,'ball1').y);
validateProject(dragged.project);
// Shared layer: never bind body strokes based on a selection of only hand.
let shared=enableIndependentLayers(newProject('Hand in character',320,240));lid=shared.activeLayerId;
for(let i=0;i<5;i++){if(i)shared=addDrawingFrame(shared);shared=appendOperation(shared,op('hand'+i,40+i*25,100));shared=appendOperation(shared,op('body'+i,100,130));shared=syncActiveFrame(shared);}
shared=selectDrawingFrame(shared,frameList(shared)[0].id);
const dangerous=createQuickMotionPath(shared,0,4,['hand0']);
assert.strictEqual(dangerous.project,shared,'Different hand IDs on body-shared layers cannot be guessed or moved');
assert.match(dangerous.reason,/own layer|Advanced/);
// Existing duplicated strokes with stable IDs on shared layers can be safely matched.
let copied=enableIndependentLayers(newProject('Stable hand',320,240));lid=copied.activeLayerId;
for(let i=0;i<5;i++){if(i)copied=addDrawingFrame(copied);copied=appendOperation(copied,op('hand',30+i*20,85));copied=appendOperation(copied,op('body'+i,200,125));copied=syncActiveFrame(copied);}
copied=selectDrawingFrame(copied,frameList(copied)[0].id);
const safe=createQuickMotionPath(copied,0,4,['hand']);
assert.equal(safe.bound,5);assert.equal(safe.project.motionPlanning.arcs[0].bindings.every(b=>b.operationIds.length===1&&b.operationIds[0]==='hand'),true);
for(let i=0;i<5;i++)assert.strictEqual(frameList(safe.project)[i].drawings[lid].find(o=>o.id==='body'+i),frameList(copied)[i].drawings[lid].find(o=>o.id==='body'+i));
// Hold cels are skipped, no hidden movement or redraw.
const held=setLayerHoldEnd(doc,doc.activeLayerId,ids[1],2);
const heldResult=createQuickMotionPath(held,0,4,['ball0']);
assert(heldResult.skipped>=1);assert.equal(heldResult.project.motionPlanning.arcs[0].bindings.some(b=>b.frameId===ids[2]),false);
// Keep path computations out of the pen stroke lifecycle.
const engine=fs.readFileSync(path.join(__dirname,'../src/engine/StudioEngine.ts'),'utf8');
assert(!engine.slice(engine.indexOf('private commitStroke('),engine.indexOf('finishGesture(')).includes('createQuickMotionPath'));
for(const f of ['src/ui/MotionPlanningPanel.tsx','src/ui/MotionArcOverlay.tsx','src/ui/App.tsx']){
 const result=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert(!result.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),f+' must parse');
}
console.log('PASS quick motion path: select/range/one-click, auto key generation, ball alignment, Undo, hand isolation, hold guard, drag updates and cold drawing path');
