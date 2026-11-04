const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///test'"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,appendOperation}=require('../src/core/model.ts');
const {enableIndependentLayers,addDrawingFrame,syncActiveFrame,frameList}=require('../src/animation/timeline.ts');
const {batchTransformCels}=require('../src/animation/batchTransform.ts');
const {polyline,boundsOf}=require('../src/engine/strokeSelection.ts');
const {DocumentStore}=require('../src/core/history.ts');
const op=(id,x,y)=>({id,kind:'stroke',tool:'brush',points:[{x,y,p:1},{x:x+10,y,p:1}],size:1,opacity:1,color:'#000000',pressure:false,response:1});
let project=enableIndependentLayers(newProject('Direct',320,240));const layer=project.activeLayerId;
for(let i=0;i<5;i++){
 if(i)project=addDrawingFrame(project);
 project=appendOperation(project,op('dot'+i,10+i*20,80));project=syncActiveFrame(project);
}
const ids=frameList(project).map(f=>f.id);
const sourcePoints=frameList(project).map(f=>polyline(f.drawings[layer][0]).map(p=>[p.x,p.y]));
let result=batchTransformCels(project,[ids[0],ids[2],ids[4]],[layer],{dx:15,dy:-5,scale:1,angle:0});
assert.equal(result.changed,3);
for(let i=0;i<5;i++){
 const pt=polyline(frameList(result.project)[i].drawings[layer][0])[0];
 assert.equal(Math.round(pt.x),sourcePoints[i][0][0]+(i%2===0?15:0));
 assert.equal(Math.round(pt.y),sourcePoints[i][0][1]-(i%2===0?5:0));
}
const rotated=batchTransformCels(project,[ids[1],ids[2]],[layer],{dx:0,dy:0,scale:1,angle:90});
assert.equal(rotated.changed,2);
const first=frameList(rotated.project)[1].drawings[layer][0];
const coords=polyline(first);assert(Math.abs(coords[0].x-coords[1].x)<0.0001,'Rotation should turn horizontal stroke vertical');
assert(Math.abs(Math.abs(coords[0].y-coords[1].y)-10)<.0001);
const originalCenter=boundsOf(frameList(project)[1].drawings[layer]),newCenter=boundsOf(frameList(rotated.project)[1].drawings[layer]);
assert(Math.abs(originalCenter.x+originalCenter.w/2-newCenter.x-newCenter.w/2)<0.00001);
assert(Math.abs(originalCenter.y+originalCenter.h/2-newCenter.y-newCenter.h/2)<0.00001);
assert.equal(frameList(rotated.project)[0],frameList(project)[0],'Unselected frames untouched');
const scaled=batchTransformCels(project,[ids[1],ids[3]],[layer],{dx:0,dy:0,scale:1.5,angle:0});assert.equal(scaled.changed,2);
const history=new DocumentStore(project);history.commit(rotated.project,'Multi-Cel Transform');history.undo();assert.equal(history.getSnapshot(),project);
assert.equal(batchTransformCels(project,[ids[1],ids[3]],[layer],{dx:0,dy:0,scale:1,angle:250}).project,project);
const app=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8');
const overlay=fs.readFileSync(path.join(__dirname,'../src/ui/BatchCanvasTransform.tsx'),'utf8');
for(const text of ['KeyW','KeyS','KeyR','multiCelAvailable','BatchCanvasTransform','setBatchCanvasMode(null)','onCommit={applyBatchTransform}'])assert(app.includes(text),text);
for(const text of ['onPointerMove','onPointerDown','onPointerUp','onPointerCancel','setPointerCapture','onCommit(values)'])assert(overlay.includes(text),text);
assert(overlay.includes('toProject')&&overlay.includes('toScreen'));
assert.match(app,/if\(!batchCanvasMode\|\|batchCanvasMode==='depth'\|\|!multiCelAvailable\)return null/,'Standard transform bounds are scanned only in W/S/R modes');
for(const file of ['src/ui/App.tsx','src/ui/MultiCelTransformPanel.tsx','src/ui/BatchCanvasTransform.tsx','src/animation/batchTransform.ts']){
 const diagnostics=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).diagnostics;
 assert(!diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),`Syntax ${file}`);
}
console.log('PASS direct canvas W/S/R, nonconsecutive transform, rotation 90°, scale, Undo, bounds gating, pointer handlers');
