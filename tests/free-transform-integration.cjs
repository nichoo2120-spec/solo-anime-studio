/* No React install required: integration tests for the real transform controller.
   Pixel-order test uses optional node-canvas-compatible Skia when available. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
let ts;for(const name of ['typescript','typescript'])try{ts=require(name);break;}catch{}
if(!ts)throw Error('Install dependencies first: npm install');
require.extensions['.ts']=(mod,file)=>{const code=fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///transform-test'").replaceAll('import.meta.env.DEV','false');mod._compile(ts.transpileModule(code,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);};
const {StudioEngine}=require('../src/engine/StudioEngine.ts');
const {LayerRenderer}=require('../src/engine/renderer.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {newProject,validateProject}=require('../src/core/model.ts');
const {polyline,hitStroke}=require('../src/engine/strokeSelection.ts');
const {projectPoint}=require('../src/engine/perspectiveWarp.ts');
const pt=(x,y)=>({x,y,p:1});
const stroke=(id,a,b,color)=>({id,kind:'stroke',tool:'brush',points:[pt(...a),pt(...b)],size:12,color,opacity:1,pressure:false,response:1,stabilization:0,smoothness:0});
const p=newProject('Free Transform integration',320,200),line=p.layers.find(l=>l.id===p.activeLayerId);
line.operations=[stroke('red',[10,50],[90,50],'#ff0000'),stroke('blue',[80,50],[150,50],'#0000ff'),{...stroke('erase',[110,50],[125,50],'#ffffff'),tool:'eraser'}];
const store=new DocumentStore(p);
const engine=Object.create(StudioEngine.prototype);
Object.assign(engine,{store,strokeScope:'current',strokeIds:[],selection:[],transform:{dx:0,dy:0,scale:1,angle:0},strokeMode:'select',strokeExact:new Map(),strokePickMode:'touch',strokeShape:'lasso',view:{x:0,y:0,zoom:1,rotation:0},onSelection:()=>{},onStrokeSelection:()=>{},onTransform:()=>{},onStrokeMode:()=>{},request:()=>{},notify:msg=>{throw Error(msg)}});
engine.setStrokeIds(['red']);assert.deepEqual(engine.strokeIds,['red']);
assert.equal(engine.findStrokeAt(pt(15,50)).id,'red');
engine.setTransform({dx:40,dy:0});
let skia;try{skia=require('skia-canvas');}catch{try{skia=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/skia-canvas');}catch{}}
if(skia){global.document={createElement:tag=>{assert.equal(tag,'canvas');return new skia.Canvas(320,200)}};engine.renderer=new LayerRenderer();const preview=engine.exactStrokePreview(line,p);const data=preview.getContext('2d').getImageData(0,0,320,200).data;
 const pixel=(x,y)=>Array.from(data.slice((y*320+x)*4,(y*320+x)*4+4));
 assert.deepEqual(pixel(60,50),[255,0,0,255],'selected red stroke translates in place');
 assert.deepEqual(pixel(94,50),[0,0,255,255],'unselected blue stroke remains above moved red stroke');
 assert.equal(pixel(117,50)[3],0,'later eraser still erases the moved selection');
 assert.equal(engine.exactStrokePreview(line,p),preview,'unchanged preview reuses renderer cache');
 console.log('PASS compositing: selected stroke below subsequent ink, overpaint and eraser preserve operation order');
}else console.log('SKIP pixel compositor (optional Skia Canvas module unavailable)');
engine.applySelection();
assert.equal(engine.strokeIds[0],'red','selected identity retained after applying');
assert.equal(polyline(store.getSnapshot().layers.find(l=>l.id===line.id).operations[0])[0].x,50,'move committed');
validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));
store.undo();assert.equal(polyline(store.getSnapshot().layers.find(l=>l.id===line.id).operations[0])[0].x,10,'undo moves stroke back');
store.redo();assert.equal(polyline(store.getSnapshot().layers.find(l=>l.id===line.id).operations[0])[0].x,50,'redo restores move');
engine.setStrokeIds(['red']);engine.setTransform({angle:90});engine.applySelection();
let path=polyline(store.getSnapshot().layers.find(l=>l.id===line.id).operations[0]);
assert(Math.abs(path[0].x-path.at(-1).x)<1e-5,'90 degree rotation changes horizontal line to vertical');
engine.setStrokeIds(['red']);engine.setTransform({scaleX:1.5,scaleY:.6});engine.applySelection();
validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));
engine.setStrokeIds(['red']);const baseline=engine.selection;engine.warpQuad=baseline.map(o=>({x:o.x,y:o.y}));engine.warpQuad[1]={...engine.warpQuad[1],x:engine.warpQuad[1].x+30};
const matrix=engine.projectiveMatrix();assert(matrix,'valid four-corner homography');const mapped=projectPoint(baseline[1],matrix);assert(Math.abs(mapped.x-engine.warpQuad[1].x)<1e-5,'upper-right perspective corner reaches drag destination');
engine.applySelection();validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));
console.log('PASS controller: click hit, selected stroke identity, move, scale, rotate, 4-corner warp, apply, save, undo/redo');
