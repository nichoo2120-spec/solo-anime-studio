const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///test'"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,appendOperation}=require('../src/core/model.ts');
const {enableIndependentLayers,addDrawingFrame,syncActiveFrame,selectDrawingFrame,frameList}=require('../src/animation/timeline.ts');
const {polyline,boundsOf}=require('../src/engine/strokeSelection.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {DEFAULT_ONION_SETTINGS,sanitizeOnionSettings,onionNeighbors}=require('../src/animation/onionSkin.ts');
const {progressiveScaleCels,progressiveFactor}=require('../src/animation/progressiveScale.ts');
const stroke=(id,x,y)=>({id,kind:'stroke',tool:'brush',points:[{x,y,p:1},{x:x+10,y,p:1},{x:x+10,y:y+20,p:1}],size:2,opacity:1,color:'#000',pressure:false,response:1});
let p=enableIndependentLayers(newProject('Depth test',320,240));const layer=p.activeLayerId;
for(let i=0;i<11;i++){if(i)p=addDrawingFrame(p);p=appendOperation(p,stroke('ball-'+i,20+i*10,60));p=syncActiveFrame(p);}
const frames=frameList(p),ids=frames.map(f=>f.id);
const settings=sanitizeOnionSettings({...DEFAULT_ONION_SETTINGS,previousCount:5,nextCount:5});
let neighbors=onionNeighbors(selectDrawingFrame(p,ids[5]),settings);
assert.equal(neighbors.length,10);
assert.deepEqual(neighbors.filter(n=>n.kind==='previous').map(n=>n.index),[0,1,2,3,4]);
assert.deepEqual(neighbors.filter(n=>n.kind==='next').map(n=>n.index),[10,9,8,7,6]);
assert(neighbors[0].opacity<neighbors[4].opacity,'Far ghosts fade');
assert.deepEqual(onionNeighbors(selectDrawingFrame(p,ids[0]),settings).map(n=>n.kind),['next','next','next','next','next']);
assert.equal(onionNeighbors(p,{...settings,enabled:false}).length,0);
assert.deepEqual(sanitizeOnionSettings({previousCount:99,nextCount:-3}),{...DEFAULT_ONION_SETTINGS,previousCount:5,nextCount:0});
assert.deepEqual(sanitizeOnionSettings(null),DEFAULT_ONION_SETTINGS);
const initial=p;
const out=progressiveScaleCels(p,ids.slice(1,6),[layer],.5,1.5);assert.equal(out.changed,4);
const expected=[.5,.75,1,1.25,1.5];
for(let i=1;i<=5;i++){
 const before=boundsOf(frames[i].drawings[layer]),after=boundsOf(frameList(out.project)[i].drawings[layer]);
 assert(Math.abs(after.w/before.w-expected[i-1])<.001,`Frame ${i} expected scale ${expected[i-1]}`);
 assert(Math.abs((after.y+after.h)-(before.y+before.h))<.001,`Footline stays anchored for frame ${i}`);
}
assert.equal(frameList(out.project)[0],frames[0]);assert.equal(frameList(out.project)[6],frames[6]);
assert.equal(initial.layers.find(l=>l.id===layer).operations,frames[10].drawings[layer]);
const st=new DocumentStore(initial);st.commit(out.project,'Progressive scale');st.undo();assert.equal(st.getSnapshot(),initial);st.redo();assert.equal(st.getSnapshot(),out.project);
assert.equal(progressiveScaleCels(initial,ids.slice(1,6),[layer],1,1).project,initial);
assert.equal(progressiveFactor(.5,1.5,.5),1);
// Nonadjacent frames use actual timeline distance, not compact list positions.
const spaced=progressiveScaleCels(initial,[ids[1],ids[3],ids[5]],[layer],.5,1.5);
assert.equal(frameList(spaced.project)[2],frames[2]);assert.equal(frameList(spaced.project)[4],frames[4]);
assert.equal(frameList(spaced.project)[3],frames[3],'Center frame factor 100% unchanged');
// Two selected drawing layers use ONE shared foot pivot. Characters remain
// assembled instead of their ink and clothing drifting apart during scale.
const other=initial.layers.find(l=>l.id!==layer).id;
const multi={...initial,animation:{...initial.animation,layerHolds:{...initial.animation.layerHolds,[other]:{held:[],stash:{}}},frames:frames.map((f,i)=>({...f,drawings:{...f.drawings,[other]:[stroke('shirt-'+i,90+i*10,100)]}}))}};
const together=progressiveScaleCels(multi,ids.slice(1,6),[layer,other],.5,1.5);

assert.equal(together.changed,8);
const originalLine=polyline(frameList(multi)[1].drawings[layer][0])[0],originalShirt=polyline(frameList(multi)[1].drawings[other][0])[0];
const scaledLine=polyline(frameList(together.project)[1].drawings[layer][0])[0],scaledShirt=polyline(frameList(together.project)[1].drawings[other][0])[0];
assert(Math.abs((scaledShirt.x-scaledLine.x)-.5*(originalShirt.x-originalLine.x))<.00001,'All selected layers share a single uniform transform');

assert.equal(progressiveScaleCels(initial,ids.slice(1,6),[layer],.1,1).changed,0);
// Held/linked protection, no partial editing.
const linked={...initial,animation:{...initial.animation,celLinks:{[layer]:{[ids[3]]:ids[2]}}}};
assert.equal(progressiveScaleCels(linked,ids.slice(1,6),[layer],1.1,1.5).project,linked);
const app=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8');
const overlay=fs.readFileSync(path.join(__dirname,'../src/ui/ProgressiveScaleCanvas.tsx'),'utf8');
for(const needle of ['previousCount','nextCount','progressiveScaleFrameFactors','applyProgressiveScale','KeyD','D Depth','depthPreviewFrames','ProgressiveScaleCanvas'])assert(app.includes(needle),needle);
for(const needle of ['onPointerDown','onPointerMove','onPointerUp','setPointerCapture','onApply(factors)','toProject','toScreen'])assert(overlay.includes(needle),needle);
const ghosts=fs.readFileSync(path.join(__dirname,'../src/engine/OnionSkinOverlay.ts'),'utf8');
assert(ghosts.includes('1024/original.width'),'Onion previews capped for memory');
assert(ghosts.includes('this.isDrawing()'),'Onion render waits for idle');
for(const file of ['src/ui/App.tsx','src/ui/ProgressiveScaleCanvas.tsx','src/animation/progressiveScale.ts','src/animation/onionSkin.ts','src/engine/OnionSkinOverlay.ts']){
 const diagnostics=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).diagnostics||[];
 assert(!diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),`Syntax ${file}`);
}
console.log('PASS v0.5.43: 5+5 onion ghosts/fade, clamping, memory bound, 5-frame uniform progression with foot anchor, Undo/Redo, held protection, on-canvas controls');
