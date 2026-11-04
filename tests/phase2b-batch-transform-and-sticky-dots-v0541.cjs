const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///test'"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,appendOperation,validateProject}=require('../src/core/model.ts');
const {enableIndependentLayers,addDrawingFrame,syncActiveFrame,frameList,selectDrawingFrame,setLayerHoldEnd}=require('../src/animation/timeline.ts');
const {batchTransformCels}=require('../src/animation/batchTransform.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {boundsOf}=require('../src/engine/strokeSelection.ts');
const {linkCurrentCelToFrame}=require('../src/animation/reuse.ts');
const op=(id,x,y)=>({id,kind:'stroke',tool:'brush',points:[{x,y,p:1},{x:x+10,y,p:1}],size:2,opacity:1,color:'#222222',pressure:false,response:1});
const center=(p,idx,lid)=>{const b=boundsOf(frameList(p)[idx].drawings[lid]);return [b.x+b.w/2,b.y+b.h/2];};
let project=enableIndependentLayers(newProject('Batch',320,240));const lid=project.activeLayerId;
for(let i=0;i<5;i++){
 if(i)project=addDrawingFrame(project);
 project=appendOperation(project,op('ball'+i,20+i*30,100));project=syncActiveFrame(project);
}
const ids=frameList(project).map(f=>f.id);project=selectDrawingFrame(project,ids[2]);
const baseline=ids.map((_,i)=>center(project,i,lid));
const result=batchTransformCels(project,ids.slice(1,4),[lid],{dx:10,dy:-25,scale:1.5});
assert.equal(result.changed,3);validateProject(result.project);
for(let i=0;i<5;i++){
 const current=center(result.project,i,lid);assert(Math.abs(current[0]-baseline[i][0]-(i>=1&&i<=3?10:0))<1e-5);assert(Math.abs(current[1]-baseline[i][1]+(i>=1&&i<=3?25:0))<1e-5);
 assert.equal(frameList(result.project)[i]===frameList(project)[i],i<1||i>3,'Untouched frame references must stay stable');
}
assert.equal(result.project.layers.find(l=>l.id===lid).operations,frameList(result.project)[2].drawings[lid],'Current layer mirrors new active cel');
const history=new DocumentStore(project);history.commit(result.project,'Multi-Cel Transform');history.undo();assert.strictEqual(history.getSnapshot(),project);history.redo();assert.strictEqual(history.getSnapshot(),result.project);
assert.equal(batchTransformCels(project,ids.slice(1,4),[lid],{dx:0,dy:0,scale:1}).project,project);
assert.equal(batchTransformCels(project,ids.slice(1,4),[lid],{dx:0,dy:0,scale:0}).project,project);
assert.equal(batchTransformCels(project,[ids[0]],[lid],{dx:1,dy:0,scale:1}).project,project);
let locked={...project,layers:project.layers.map(l=>l.id===lid?{...l,locked:true}:l)};
assert.equal(batchTransformCels(locked,ids.slice(1,4),[lid],{dx:1,dy:0,scale:1}).project,locked);
const held=setLayerHoldEnd(project,lid,ids[1],3);
assert.equal(batchTransformCels(held,ids.slice(1,4),[lid],{dx:1,dy:0,scale:1}).project,held);
// Noncontiguous frames and separate-layer safety.
const scattered=batchTransformCels(project,[ids[0],ids[3]],[lid],{dx:-12,dy:4,scale:1});
assert.equal(scattered.changed,2);assert.strictEqual(frameList(scattered.project)[1],frameList(project)[1]);
assert.strictEqual(frameList(scattered.project)[2],frameList(project)[2]);
assert.strictEqual(frameList(scattered.project)[4],frameList(project)[4]);
const boundProject={...project,motionPlanning:{version:1,notes:[],arcs:[{id:'path',name:'path',layerId:lid,points:[],bindings:[{frameId:ids[2],operationIds:['ball2']}]}]}};
assert.strictEqual(batchTransformCels(boundProject,ids.slice(1,4),[lid],{dx:1,dy:0,scale:1}).project,boundProject,'Path-bound artwork cannot be moved behind its guide');
const withRaster=structuredClone(project);withRaster.animation.frames[2].drawings[lid].push({kind:'clear',id:'a',polygon:[]});
assert.equal(batchTransformCels(withRaster,ids.slice(1,4),[lid],{dx:1,dy:0,scale:1}).project,withRaster);
const app=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8');
assert.match(app,/setSelectedMotionDotId\(result.dotId\?\?''\);\s*\n\s*\};/,'Dot insertion should not exit add mode');
assert.match(app,/if\(e.key==='Escape'&&addingMotionDot\)/,'Esc leaves dot mode');
assert.match(app,/onEditingPoints=\{enabled=>\{setMotionArcEditing\(enabled\);if\(!enabled\)setAddingMotionDot\(false\)/);
assert.match(app,/batchTransformCels\(previous,ids,layers,values\)/);
assert.match(app,/rightTab==='batch-transform'/);
const panel=fs.readFileSync(path.join(__dirname,'../src/ui/MultiCelTransformPanel.tsx'),'utf8');
assert.match(panel,/Apply to selected cels/);assert.match(panel,/Scale each drawing/);
const shortcut=fs.readFileSync(path.join(__dirname,'../src/core/shortcuts.ts'),'utf8');assert.match(shortcut,/batchTransform:'shift\+t'/);
for(const f of ['src/animation/batchTransform.ts','src/ui/MultiCelTransformPanel.tsx','src/ui/App.tsx','src/ui/MotionPlanningPanel.tsx']){
 const d=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert(!d.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error),`Syntax ${f}`);
}
console.log('PASS sticky multi-dots + Multi-Cel Transform: 3/5 transforms, unchanged other cels, current layer sync, Undo/Redo, held/locked/raster protections, UI/shortcut wiring');
