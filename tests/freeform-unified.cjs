/* Freeform regression: real controller state updates + hit target priorities. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///transform-test'").replaceAll('import.meta.env.DEV','false'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {StudioEngine}=require('../src/engine/StudioEngine.ts');
const {controls}=require('../src/engine/selectionControls.ts');
const {freeformHit,edgeHandles,rotationRadius}=require('../src/engine/freeformControls.ts');
const {projectPoint}=require('../src/engine/perspectiveWarp.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {newProject,validateProject}=require('../src/core/model.ts');
const {polyline}=require('../src/engine/strokeSelection.ts');
const pt=(x,y)=>({x,y,p:1});
const stroke=(id,a,b)=>({id,kind:'stroke',tool:'brush',points:[pt(...a),pt(...b)],size:6,color:'#123456',opacity:1,pressure:false,response:1,stabilization:0,smoothness:0});
const p=newProject('Freeform test',400,300),layer=p.layers.find(l=>l.id===p.activeLayerId);
layer.operations=[stroke('top',[100,100],[200,100]),stroke('right',[200,100],[200,180]),stroke('bottom',[200,180],[100,180]),stroke('left',[100,180],[100,100])];
const store=new DocumentStore(p),engine=Object.create(StudioEngine.prototype),canvas={style:{},getBoundingClientRect:()=>({left:0,top:0})};
Object.assign(engine,{canvas,store,tool:'stroke-select',strokeScope:'current',strokeIds:[],selection:[],transform:{dx:0,dy:0,scale:1,angle:0},strokeMode:'select',freeformCornerMode:'scale',strokeExact:new Map(),strokePickMode:'touch',strokeShape:'lasso',view:{x:0,y:0,zoom:1,rotation:0},onSelection:()=>{},onStrokeSelection:()=>{},onTransform:()=>{},onStrokeMode:()=>{},request:()=>{},notify:msg=>{throw Error(msg)}});
engine.point=e=>pt(e.x,e.y);engine.local=e=>({x:e.x,y:e.y});
engine.setStrokeIds(['top','right','bottom','left']);engine.setStrokeMode('freeform');
const c=controls(engine.selection,engine.transform,1);const corners=engine.displayedCorners();
const hit=(xy,perspective=false)=>freeformHit(xy,corners,c.rotation,c.center,c.top,1,perspective);
assert.deepEqual(hit(corners[0]),{kind:'corner',index:0});
assert.deepEqual(hit(edgeHandles(corners)[1]),{kind:'edge',index:1});
assert.deepEqual(hit(c.rotation),{kind:'rotation'});
assert.equal(hit(edgeHandles(corners)[1],true).kind,'none');
assert.equal(hit({x:c.center.x+rotationRadius(c.center,c.top,1,corners),y:c.center.y}).kind,'rotation');
assert.equal(hit(c.center).kind,'none');
const move=(x,y,mod={})=>engine.updateDrag(pt(x,y),{shiftKey:false,altKey:false,...mod});
const begin=(x,y,kind,props={})=>{engine.pointerId=12;engine.drag={x,y,kind,settings:{...engine.transform},center:controls(engine.selection,engine.transform,1).center,...props};};
// Scale one edge along X, anchoring the opposite left side.
const edges=edgeHandles(corners);begin(edges[1].x,edges[1].y,'scale',{edge:1,anchor:edges[3]});move(edges[1].x+50,edges[1].y);
assert(Math.abs(engine.transform.scaleX-(1+50/(corners[1].x-corners[0].x)))<.001);assert(Math.abs(engine.transform.scaleY-1)<.001);assert(Math.abs(engine.displayedCorners()[0].x-corners[0].x)<.001);assert(Math.abs(engine.displayedCorners()[1].x-corners[1].x-50)<.001);
engine.drag=undefined;engine.setStrokeIds(['top','right','bottom','left']);
// Rotating from the top handle to the right must rotate the selected group 90°.
const r=controls(engine.selection,engine.transform,1);begin(r.rotation.x,r.rotation.y,'rotate');move(r.center.x+60,r.center.y);
assert(Math.abs(engine.transform.angle-90)<.01,`wrong rotation angle ${engine.transform.angle}`);
engine.drag=undefined;engine.setStrokeIds(['top','right','bottom','left']);
// Perspective corner and subsequent move share one active Freeform edit.
const base=engine.selection.map(q=>({...q})),start=base[1];engine.setFreeformCornerMode('perspective');begin(start.x,start.y,'perspective',{corner:1,startQuad:base});move(start.x+35,start.y-15);
assert(engine.warpQuad,'perspective corner must move');assert(Math.abs(engine.warpQuad[1].x-start.x-35)<.01);
engine.drag=undefined;begin(150,140,'move');move(172,152);
assert(Math.abs(engine.transform.dx-22)<.01);assert(Math.abs(engine.transform.dy-12)<.01);
const projected=projectPoint(base[1],engine.projectiveMatrix());assert(Math.hypot(projected.x-(start.x+57),projected.y-(start.y-3))<.01,'move preserves and translates perspective warp');
engine.drag=undefined;engine.pointerId=undefined;engine.applySelection();
assert.deepEqual(engine.strokeIds,['top','right','bottom','left']);validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));
const transformed=polyline(store.getSnapshot().layers.find(l=>l.id===layer.id).operations[0]);assert(transformed[0].x>115,'real strokes are transformed on commit');
store.undo();assert.deepEqual(polyline(store.getSnapshot().layers.find(l=>l.id===layer.id).operations[0])[0],pt(100,100),'Undo recovers original stroke');
store.redo();validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));
console.log('PASS Freeform: scale edge anchored, 90° rotate, perspective corner, move after warp, commit and undo/redo.');
