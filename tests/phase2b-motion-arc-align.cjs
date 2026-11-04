/** Phase 2B selected-cel path alignment: smoke + safety. No browser/Wacom claim. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///motion-align-test'").replaceAll('import.meta.env.DEV','false'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,appendOperation,validateProject}=require('../src/core/model.ts');
const {enableIndependentLayers,addDrawingFrame,syncActiveFrame,frameList,isLayerHeld,setLayerHoldEnd,selectDrawingFrame}=require('../src/animation/timeline.ts');
const {createMotionArc,setMotionArcPoint,bindArcStrokes,bindArcLayerRange,alignBoundDrawingsToArc,motionTargetAtFrame,motionBezierSegments,unbindArcFrame,pruneMotionPlanning}=require('../src/animation/motionPlanning.ts');
const {boundsOf}=require('../src/engine/strokeSelection.ts');
const {DocumentStore}=require('../src/core/history.ts');
function stroke(id,x,y){return {id,kind:'stroke',tool:'brush',points:[{x:x-5,y,p:1},{x:x+5,y,p:1}],size:2,opacity:1,color:'#222222',pressure:false,response:1};}
let p=enableIndependentLayers(newProject('Ball example',320,240));
let lid=p.activeLayerId,other=p.layers.find(l=>l.id!==lid).id;
const centers=[[30,170],[50,175],[70,180],[90,170],[110,175]];
for(let i=0;i<5;i++){
 if(i)p=addDrawingFrame(p);
 const [x,y]=centers[i];p=appendOperation(p,stroke('ball-'+i,x,y));
 // A second, unrelated character on another layer must stay untouched.
 p={...p,layers:p.layers.map(l=>l.id===other?{...l,operations:[stroke('char-'+i,200,100)]}:l)};
 p=syncActiveFrame(p);
}
const ids=frameList(p).map(f=>f.id);
p=createMotionArc(p,'Ball motion',lid);const arcId=p.motionPlanning.arcs[0].id;
p=setMotionArcPoint(p,arcId,ids[0],30,170);
p=setMotionArcPoint(p,arcId,ids[2],70,20);
p=setMotionArcPoint(p,arcId,ids[4],110,170);
assert.equal(p.motionPlanning.arcs[0].points.length,3);
const curves=motionBezierSegments(p.motionPlanning.arcs[0],ids);
assert.equal(curves.length,2);
// Cubic geometry on screen must match the exact interpolation used to move cels.
const bezier=(a,b,c,d,t)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;
const half={x:bezier(curves[0].a.x,curves[0].c1.x,curves[0].c2.x,curves[0].b.x,.5),y:bezier(curves[0].a.y,curves[0].c1.y,curves[0].c2.y,curves[0].b.y,.5)};
const target=motionTargetAtFrame(p,p.motionPlanning.arcs[0],ids[1]);
assert(Math.hypot(half.x-target.x,half.y-target.y)<1e-7,'Visible curve and applied path match');
p=bindArcLayerRange(p,arcId,0,4);
assert.equal(p.motionPlanning.arcs[0].bindings.length,5,'All five ball cels bound');
assert.equal(p.motionPlanning.arcs[0].bindings.some(b=>b.operationIds.includes('char-2')),false);
let result=alignBoundDrawingsToArc(p,arcId);
assert.equal(result.moved,4,'Four off-path cels should move');
const store=new DocumentStore(p);store.commit(result.project,'Align to arc');
validateProject(store.getSnapshot());validateProject(structuredClone(store.getSnapshot()));
const aligned=store.getSnapshot();
for(let i=0;i<5;i++){
 const ops=frameList(aligned)[i].drawings[lid],target=motionTargetAtFrame(aligned,aligned.motionPlanning.arcs[0],ids[i]);
 assert.equal(ops.length,1);
 const box=boundsOf(ops),center={x:box.x+box.w/2,y:box.y+box.h/2};
 assert(Math.hypot(center.x-target.x,center.y-target.y)<1e-7,'Ball aligns to curve at frame '+i);
 assert.deepEqual(frameList(aligned)[i].drawings[other],frameList(p)[i].drawings[other],'Other character unaffected');
 assert.equal(ops[0].points[0].x,centers[i][0]-5,'Original stroke pressure/pose points unaltered');
}
assert.equal(alignBoundDrawingsToArc(aligned,arcId).moved,0,'Applying twice does not drift cels');
store.undo();assert.equal(store.getSnapshot(),p,'Single undo restores all five frames');store.redo();assert.equal(store.getSnapshot(),aligned);
// Manual selection should move ONLY chosen strokes even if another actor shares the same layer.
let shared=enableIndependentLayers(newProject('Two characters same layer',320,240)),sl=shared.activeLayerId;
shared=appendOperation(shared,stroke('ball-a',20,20));shared=appendOperation(shared,stroke('person-a',180,80));shared=addDrawingFrame(shared);
shared=appendOperation(shared,stroke('ball-b',60,25));shared=appendOperation(shared,stroke('person-b',190,80));shared=syncActiveFrame(shared);
const sharedIds=frameList(shared).map(f=>f.id);
shared=createMotionArc(shared,'Only ball',sl);const sid=shared.motionPlanning.arcs[0].id;
shared=setMotionArcPoint(shared,sid,sharedIds[0],80,100);shared=setMotionArcPoint(shared,sid,sharedIds[1],120,100);
shared=bindArcStrokes(shared,sid,sharedIds[0],['ball-a']);shared=bindArcStrokes(shared,sid,sharedIds[1],['ball-b']);
assert.deepEqual(shared.motionPlanning.arcs[0].bindings.map(b=>b.operationIds),[['ball-a'],['ball-b']]);
const scoped=alignBoundDrawingsToArc(shared,sid).project;
for(let i=0;i<2;i++)assert.strictEqual(frameList(shared)[i].drawings[sl][1],frameList(scoped)[i].drawings[sl][1], 'Other character on SAME layer unchanged');
assert.equal(alignBoundDrawingsToArc(scoped,sid).moved,0,'Selection apply idempotent');
shared=unbindArcFrame(shared,sid,sharedIds[0]);assert.equal(shared.motionPlanning.arcs[0].bindings.length,1);
// A frame changed to a hold AFTER binding must be protected from editing.
let protectedDoc=setLayerHoldEnd(p,lid,ids[0],1);
assert.equal(isLayerHeld(protectedDoc,lid,ids[1]),true);
assert.equal(alignBoundDrawingsToArc(protectedDoc,arcId).moved,0,'No partial updates when one bound frame is held');
// Linked cel group guard. Old file with metadata is still valid.
let links={...p.animation,celLinks:{[lid]:{[ids[0]]:'linkgroup',[ids[2]]:'linkgroup'}}};
assert.equal(alignBoundDrawingsToArc({...p,animation:links},arcId).moved,0,'Linked cels protected');
let deleted={...p,animation:{...p.animation,frames:p.animation.frames.filter(f=>f.id!==ids[1])}};
deleted=pruneMotionPlanning(deleted);assert.equal(deleted.motionPlanning.arcs[0].bindings.length,4,'Bindings on deleted frame removed');
// All UI handlers compile with TSX and the point overlay must stay pass-through in normal mode.
for(const file of ['src/ui/App.tsx','src/ui/MotionPlanningPanel.tsx','src/ui/MotionArcOverlay.tsx']){
 const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.equal(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`Syntax ${file}`);
}
console.log('PASS motion arc alignment: 5 frames, smooth interpolation, idempotence, same-layer selection isolation, held/linked locks, undo/redo, validation, pruning and UI syntax');
