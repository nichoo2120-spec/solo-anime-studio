const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///test'"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,appendOperation}=require('../src/core/model.ts');
const {enableIndependentLayers,addDrawingFrame,syncActiveFrame,frameList}=require('../src/animation/timeline.ts');
const {progressiveScaleFrameFactors,depthScaleFactors,progressiveScaleCels}=require('../src/animation/progressiveScale.ts');
const {boundsOf}=require('../src/engine/strokeSelection.ts');
const {DocumentStore}=require('../src/core/history.ts');
const ball=(id,x)=>({id,kind:'stroke',tool:'brush',points:[{x,y:40,p:1},{x:x+20,y:40,p:1},{x:x+20,y:60,p:1},{x,y:60,p:1}],size:3,opacity:1,color:'#111111',pressure:false,response:1});
let p=enableIndependentLayers(newProject('Five balls',640,400));const layer=p.activeLayerId;
for(let i=0;i<5;i++){if(i)p=addDrawingFrame(p);p=appendOperation(p,ball('b'+i,30+i*50));p=syncActiveFrame(p);}
const frames=frameList(p),selection=frames.map((f,i)=>({id:f.id,order:i})),ids=selection.map(f=>f.id),initial=frames.map(f=>boundsOf(f.drawings[layer]));
const near=(x,y)=>assert(Math.abs(x-y)<.001,`${x} vs ${y}`);
// Middle frame selected: others visibly change in Auto mode, but endpoints remain unchanged.
let factors=depthScaleFactors(selection,ids[2],{[ids[2]]:1.8},'auto');
for(let i=0;i<5;i++)near(factors[ids[i]],[1,1.4,1.8,1.4,1][i]);
let out=progressiveScaleFrameFactors(p,ids,[layer],factors);assert.equal(out.changed,3);
for(let i=0;i<5;i++)near(boundsOf(frameList(out.project)[i].drawings[layer]).w/initial[i].w,[1,1.4,1.8,1.4,1][i]);
let st=new DocumentStore(p);st.commit(out.project,'Edit F3 auto depth');st.undo();assert.equal(st.getSnapshot(),p);st.redo();assert.equal(st.getSnapshot(),out.project);
// Changing first frame can apply a ramp across the full range.
factors=depthScaleFactors(selection,ids[0],{[ids[0]]:.5},'auto');
for(let i=0;i<5;i++)near(factors[ids[i]],[.5,.625,.75,.875,1][i]);
// Multiple user-placed anchors: middle 1.8 and last 1.25 without flattening.
factors=depthScaleFactors(selection,ids[2],{[ids[2]]:1.8,[ids[4]]:1.25},'auto');
for(let i=0;i<5;i++)near(factors[ids[i]],[1,1.4,1.8,1.525,1.25][i]);
// Independent mode changes only the chosen drawing without touching any other cel.
factors=depthScaleFactors(selection,ids[2],{[ids[2]]:2},'independent');
out=progressiveScaleFrameFactors(p,ids,[layer],factors);assert.equal(out.changed,1);
for(let i=0;i<5;i++){if(i===2)near(boundsOf(frameList(out.project)[i].drawings[layer]).w/initial[i].w,2);else assert.equal(frameList(out.project)[i],frames[i]);}
// Out-of-order sparse frame selection still uses real timeline spacing.
factors=depthScaleFactors([selection[4],selection[0],selection[2]],ids[2],{[ids[2]]:2},'auto');
near(factors[ids[0]],1);near(factors[ids[2]],2);near(factors[ids[4]],1);
// No model writes when preview is recomputed many times.
for(let n=0;n<150;n++){const values=depthScaleFactors(selection,ids[2],{[ids[2]]:1.2+n/1000},'auto');assert(values[ids[1]]>1);}
assert.equal(frameList(p)[2],frames[2]);
assert.equal(progressiveScaleFrameFactors(p,ids,[layer],{[ids[2]]:4}).changed,0,'Reject size out of range');
assert.equal(progressiveScaleFrameFactors(p,ids,[layer],Object.fromEntries(ids.map(id=>[id,1]))).changed,0,'No-op is rejected');
assert.equal(progressiveScaleCels(p,ids,[layer],.5,1.5).changed,4,'Old first/last API stays usable');
const app=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../src/ui/ProgressiveScaleCanvas.tsx'),'utf8'),float=fs.readFileSync(path.join(__dirname,'../src/ui/FloatingTransformPanel.tsx'),'utf8');
for(const word of ['progressiveScaleFrameFactors','depthPreviewFrames','onFocusFrame={goToDrawingFrame}','id="multi"','id="stroke"','sampledPoints','14000','420'])assert(app.includes(word),'app '+word);
for(const word of ['Depth target frame','Auto · All','Only this frame','frames.map','onApply(factors)','pointerdown','strokeWidth','role="alert"','FloatingTransformPanel'])assert(ui.toLowerCase().includes(word.toLowerCase()),'depth '+word);
for(const word of ['setPointerCapture','writePreference','onPointerDown','onPointerMove','onPointerUp','Drag transform toolbar'])assert(float.includes(word),'float '+word);
for(const file of ['src/ui/App.tsx','src/ui/ProgressiveScaleCanvas.tsx','src/ui/FloatingTransformPanel.tsx','src/animation/progressiveScale.ts']){
 const diagnostics=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).diagnostics||[];
 assert(!diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'Syntax: '+file);
}
console.log('PASS v0.5.45: auto middle edits, first-frame ramp, multi anchors, independent, sparse selection, atomic undo, legacy depth API, bounded live SVG previews, draggable toolbars');
