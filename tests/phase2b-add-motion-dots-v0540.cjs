const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///dot-test'").replaceAll('import.meta.env.DEV','false'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,appendOperation,validateProject}=require('../src/core/model.ts');
const {addDrawingFrame,enableIndependentLayers,syncActiveFrame,frameList,selectDrawingFrame,setLayerHoldEnd}=require('../src/animation/timeline.ts');
const {createQuickMotionPath,addMotionControlDot,moveMotionControlDot,removeMotionControlDot,motionTargetAtTime,motionTargetAtFrame,motionControlDotPosition,setMotionPathMode,MAX_MOTION_DOTS,motionBezierSegments}=require('../src/animation/motionPlanning.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {boundsOf}=require('../src/engine/strokeSelection.ts');
const op=(id,x,y)=>({id,kind:'stroke',tool:'brush',points:[{x:x-5,y,p:1},{x:x+5,y,p:1}],size:2,opacity:1,color:'#222222',pressure:false,response:1});
const center=(p,i,lid,id)=>{const b=boundsOf(frameList(p)[i].drawings[lid].filter(o=>o.id===id));return {x:b.x+b.w/2,y:b.y+b.h/2};};
const approx=(a,b)=>assert(Math.abs(a-b)<0.00001,`${a} !== ${b}`);
let project=enableIndependentLayers(newProject('Extra motion dots',320,240)),lid=project.activeLayerId;
for(let i=0;i<5;i++){
 if(i)project=addDrawingFrame(project);
 project=appendOperation(project,op('ball'+i,20+i*30,90+(i%2?12:0)));
 project=syncActiveFrame(project);
}
const ids=frameList(project).map(f=>f.id);project=selectDrawingFrame(project,ids[0]);
const result=createQuickMotionPath(project,0,4,['ball0']);assert.equal(result.bound,5);
const original=result.project,arc=original.motionPlanning.arcs[0],arcId=arc.id;
const middle=motionTargetAtTime(arc,ids,1.4);
const creation=addMotionControlDot(original,arcId,middle.x,middle.y);
assert(creation.dotId&&creation.project!==original);
const withDot=creation.project,dot=withDot.motionPlanning.arcs[0].controlDots[0];
assert(dot.fraction>0&&dot.fraction<1);approx(dot.dx,0);approx(dot.dy,0);
for(let i=0;i<5;i++){
 assert.strictEqual(frameList(withDot)[i],frameList(original)[i],'Add dot must not move or copy drawings');
 approx(motionTargetAtFrame(original,arc,ids[i]).x,motionTargetAtFrame(withDot,withDot.motionPlanning.arcs[0],ids[i]).x);
 approx(motionTargetAtFrame(original,arc,ids[i]).y,motionTargetAtFrame(withDot,withDot.motionPlanning.arcs[0],ids[i]).y);
}
validateProject(withDot);
const saved=JSON.parse(JSON.stringify(withDot));validateProject(saved);
assert.equal(saved.motionPlanning.arcs[0].controlDots[0].id,dot.id,'Dot survives save/reopen round trip');
const oldMiddle=center(withDot,1,lid,'ball1');
const moved=moveMotionControlDot(withDot,arcId,dot.id,0,-40,ids[1]);
assert(moved.project!==withDot&&moved.moved>=1);
const shifted=center(moved.project,1,lid,'ball1');
assert(shifted.y<oldMiddle.y-2,'Drag dot adjusts bound ball near dot');
assert.strictEqual(frameList(moved.project)[4],frameList(withDot)[4],'Remote frame stays unmoved for local deformation');
const updatedArc=moved.project.motionPlanning.arcs[0];
const geometry=motionBezierSegments(updatedArc,ids);assert(geometry.length>10,'Extra dots use smooth sampled curve');
const marker=motionControlDotPosition(updatedArc,ids,updatedArc.controlDots[0]);
assert(marker.y<middle.y-5,'Control dot follows edited curve');
const store=new DocumentStore(withDot);store.commit(moved.project,'Drag extra dot');store.undo();assert.strictEqual(store.getSnapshot(),withDot,'Undo restores dot and drawings together');store.redo();assert.strictEqual(store.getSnapshot(),moved.project);
const removed=removeMotionControlDot(moved.project,arcId,dot.id,ids[1]);assert.equal(removed.project.motionPlanning.arcs[0].controlDots.length,0);
for(let i=0;i<5;i++){approx(center(removed.project,i,lid,'ball'+i).x,center(original,i,lid,'ball'+i).x);approx(center(removed.project,i,lid,'ball'+i).y,center(original,i,lid,'ball'+i).y);}
validateProject(removed.project);
const independent=setMotionPathMode(withDot,arcId,'independent');
const otherFrame=frameList(independent)[2];
const independentDrag=moveMotionControlDot(independent,arcId,dot.id,0,-25,ids[1]);
assert.strictEqual(frameList(independentDrag.project)[2],otherFrame,'Independent only changes current frame');
const held=setLayerHoldEnd(withDot,lid,ids[0],1);
assert.strictEqual(moveMotionControlDot(held,arcId,dot.id,0,-25,ids[1]).project,held,'Protected hold frames block auto edits');
// Serialization compatibility and invalid/dangerous value rejection.
const invalid={...withDot,motionPlanning:{...withDot.motionPlanning,arcs:withDot.motionPlanning.arcs.map(a=>({...a,controlDots:[{id:dot.id,fraction:1.8,dx:0,dy:0}]}))}};
assert.equal(require('../src/animation/motionPlanning.ts').validateMotionPlanning(invalid),false);
assert.equal(addMotionControlDot(withDot,arcId,middle.x,middle.y).project,withDot,'Duplicate dot positions are rejected');
assert.equal(MAX_MOTION_DOTS,16);
// Confirm additions do not enter normal stroke commits, keep same lightweight guide interaction and controls.
const engine=fs.readFileSync(path.join(__dirname,'../src/engine/StudioEngine.ts'),'utf8');
const routine=engine.slice(engine.indexOf('private commitStroke('),engine.indexOf('finishGesture('));
assert(!routine.includes('addMotionControlDot')&&!routine.includes('moveMotionControlDot'));
const panel=fs.readFileSync(path.join(__dirname,'../src/ui/MotionPlanningPanel.tsx'),'utf8');
assert.match(panel,/Add motion dot/);assert.match(panel,/Remove selected dot/);
const overlay=fs.readFileSync(path.join(__dirname,'../src/ui/MotionArcOverlay.tsx'),'utf8');
assert.match(overlay,/onAddDot\(arc.id,p.x,p.y\)/);assert.match(overlay,/onMoveDot\(drag.arcId,drag.id/);assert.match(overlay,/onPointerUp=\{finish\}/);
const app=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8');assert.match(app,/playback.current.refreshMotionEdit\(result.project\)/);
for(const f of ['src/animation/motionPlanning.ts','src/ui/MotionArcOverlay.tsx','src/ui/MotionPlanningPanel.tsx','src/ui/App.tsx']){
 const result=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert(!result.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'Invalid syntax '+f);
}
console.log('PASS v0.5.40 motion dots: add without moving, drag & remove, Auto/Independent, undo, hold safety, curve and marker match, validation, UI wiring, cold-stroke path');
