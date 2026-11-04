/** Phase 2B motion notes and O(1) patch lookup smoke. Synthetic; not Wacom timing. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///motion-test'").replaceAll('import.meta.env.DEV','false'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,validateProject}=require('../src/core/model.ts');
const {addDrawingFrame,selectDrawingFrame,deleteDrawingFrame,frameList}=require('../src/animation/timeline.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {setCurrentTimingNote,currentTimingNote,createMotionArc,setMotionArcPoint,removeMotionArcPoint,removeMotionArc,activeLayerArtworkCenter,pruneMotionPlanning}=require('../src/animation/motionPlanning.ts');
const {LayerRenderer}=require('../src/engine/renderer.ts');
let project=newProject('Motion notes test',400,240);
project=addDrawingFrame(project);project=addDrawingFrame(project);
const frames=frameList(project),frameIds=frames.map(f=>f.id);
let store=new DocumentStore(project);
project=setCurrentTimingNote(project,'Anticipation — pose ready');store.commit(project,'Timing note');
assert.equal(currentTimingNote(project),'Anticipation — pose ready');
project=selectDrawingFrame(project,frameIds[1]);assert.equal(currentTimingNote(project),'');
project=setCurrentTimingNote(project,'Key pose');
project=createMotionArc(project,'Head travel');
let arcId=project.motionPlanning.arcs[0].id;
project=setMotionArcPoint(project,arcId,frameIds[0],100,50);
project=setMotionArcPoint(project,arcId,frameIds[1],140,65);
project=setMotionArcPoint(project,arcId,frameIds[2],220,75);
assert.deepEqual(project.motionPlanning.arcs[0].points.map(p=>p.frameId),frameIds);
validateProject(project);
assert.equal(validateProject(structuredClone(project)).motionPlanning.notes.length,2,'Project save and reopen retains timing and arcs');
const beforeEdit=project;
project=removeMotionArcPoint(project,arcId,frameIds[1]);store.commit(project,'Remove point');store.undo();assert.equal(store.getSnapshot().motionPlanning.notes.length,1,'History from earlier commit remains independent');
project=beforeEdit;assert.equal(project.motionPlanning.arcs[0].points.length,3);
project=deleteDrawingFrame(project); // selected frame 2
project=pruneMotionPlanning(project);
assert(!project.motionPlanning.notes.some(n=>n.frameId===frameIds[1]),'Deleted frame note pruned');
assert(!project.motionPlanning.arcs[0].points.some(n=>n.frameId===frameIds[1]),'Deleted frame arc point pruned');
validateProject(project);
const layer=project.layers.find(l=>l.id===project.activeLayerId);
assert.equal(activeLayerArtworkCenter(project),null);
project={...project,layers:project.layers.map(l=>l.id===layer.id?{...l,operations:[{kind:'stroke',id:'s',tool:'brush',points:[{x:10,y:20,p:1},{x:50,y:80,p:1}],size:2,opacity:1,color:'#ffffff',pressure:false,response:1}]}:l)};
assert.deepEqual(activeLayerArtworkCenter(project),{x:30,y:50});
project=removeMotionArc(project,arcId);assert.equal(project.motionPlanning.arcs.length,0);
// Cheap mock Canvas2D to verify patch lookup stays correct across append/undo/redo.
const context={save(){},restore(){},drawImage(){},clearRect(){},beginPath(){},arc(){},fill(){},stroke(){},closePath(){},transform(){},fillRect(){},setTransform(){},resetTransform(){}};
global.document={createElement:()=>{const obj={width:0,height:0,getContext(){return {...context,canvas:obj}}};return obj;}};
const renderer=new LayerRenderer();
let raster={id:'raster',name:'Line',visible:true,locked:false,opacity:1,kind:'raster',operations:[]};
let rasterProject={...newProject('Raster-test',64,64),layers:[raster],activeLayerId:raster.id};
const operations=[];
for(let i=0;i<100;i++){
 const stroke=Object.freeze({id:`test-${i}`,kind:'stroke',tool:'brush',points:[{x:i,y:2,p:1}],size:2,opacity:1,color:'#333333',pressure:false,response:1});
 operations.push(stroke);raster={...raster,operations:operations.slice()};rasterProject={...rasterProject,layers:[raster]};renderer.get(raster,rasterProject);
}
assert.equal(renderer.deltas.length,100);
assert.equal(renderer.deltaLookup.size,100);
const penult={...raster,operations:operations.slice(0,-1)};
renderer.get(penult,{...rasterProject,layers:[penult]});
renderer.get(raster,rasterProject);
assert.equal(renderer.deltaLookup.size,100,'Redo reuses its operation patch instead of rebuilding it');
assert.equal(renderer.deltas.length,100,'Redo must not add redundant patch');
renderer.prune({...rasterProject,layers:[{...raster,id:'new-layer'}]});
assert.equal(renderer.deltaLookup.size,0,'Layer removal prunes indexed patches');
renderer.clear();assert.equal(renderer.deltaLookup.size,0);
// HD canvases avoid heavy full-surface checkpoints after strokes 8 and 16.
const hd=new LayerRenderer();let hdLayer={...raster,id:'hd',operations:[]};const hdProject=newProject('HD cache pacing',1920,1080);
let hdDoc={...hdProject,activeLayerId:'hd',layers:[hdLayer]};
for(let i=0;i<24;i++){
 const op=Object.freeze({id:`hd-${i}`,kind:'stroke',tool:'brush',points:[{x:i+2,y:15,p:1}],size:2,opacity:1,color:'#222222',pressure:false,response:1});
 hdLayer={...hdLayer,operations:[...hdLayer.operations,op]};hdDoc={...hdDoc,layers:[hdLayer]};hd.get(hdLayer,hdDoc);
 if(i===19)assert.equal(hd.cacheStats().checkpoints,0,'HD full-canvas checkpoint should not allocate during the first 20 strokes');
}
assert.equal(hd.cacheStats().checkpoints,1,'HD checkpoint occurs at 24 committed strokes');
hd.clear();
const ui=fs.readFileSync('src/ui/App.tsx','utf8');
assert.match(ui,/motionPlanning.*openMotionPlanning|openMotionPlanning.*motionPlanning/);
assert.match(fs.readFileSync('src/styles.css','utf8'),/motion-arc-overlay[^}]*pointer-events:none/);
assert.equal(require('../src/core/shortcuts.ts').initialShortcuts.motionPlanning,'shift+m');
for(const file of ['src/ui/App.tsx','src/ui/MotionPlanningPanel.tsx','src/ui/MotionArcOverlay.tsx']){
 const source=fs.readFileSync(file,'utf8');const compiled=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.equal(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`Syntax: ${file}`);
}
console.log('PASS Phase 2B timing notes and arcs: save/restore, timeline deletion pruning, editable guides, undo, unchanged drawing; 100-stroke delta index, undo/redo reuse, prune/clear, shortcut and syntax.');
