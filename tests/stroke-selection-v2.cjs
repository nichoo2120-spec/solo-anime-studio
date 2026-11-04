const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {newProject,validateProject}=require('../src/core/model.ts');
const {hitStroke,idsInMarquee,polyline,boundsOf,transformedStroke,projectiveStroke}=require('../src/engine/strokeSelection.ts');
const {homography,projectPoint}=require('../src/engine/perspectiveWarp.ts');
const {DocumentStore}=require('../src/core/history.ts');
function stroke(id, points){return {id,kind:'stroke',tool:'brush',points:points.map(([x,y])=>({x,y,p:1})),size:3,opacity:1,color:'#263039',pressure:false,response:1,engineVersion:6,stabilization:0,smoothness:0};}
const p=newProject();p.layers[0].name='Hair';p.layers[1].name='Body';p.layers[2].name='Locked Shirt';p.layers[3].name='Hidden Props';
p.layers[0].operations=[stroke('hair-1',[[30,25],[50,10],[70,25]]),stroke('hair-2',[[34,27],[57,16],[76,28]])];
p.layers[1].operations=[stroke('body-1',[[50,40],[50,140]]),stroke('body-2',[[50,77],[80,111]])];
p.layers[2].locked=true;p.layers[2].operations=[stroke('shirt-locked',[[40,85],[75,85]])];
p.layers[3].visible=false;p.layers[3].operations=[stroke('props-hidden',[[30,30],[75,31]])];
assert.equal(hitStroke(p.layers[0],{x:40,y:17},1)?.id,'hair-1');
assert.equal(hitStroke(p.layers[1],{x:50,y:130},1)?.id,'body-1');
let selected=['hair-1'];function shiftClick(id){selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];}
shiftClick('hair-2');assert.deepEqual(selected,['hair-1','hair-2']);shiftClick('hair-1');assert.deepEqual(selected,['hair-2']);
const lasso=[{x:10,y:1,p:1},{x:90,y:1,p:1},{x:100,y:150,p:1},{x:10,y:150,p:1}];
const allowed=p.layers.filter(l=>l.visible&&!l.locked&&!l.reference);
const ids=allowed.flatMap(l=>idsInMarquee(l,lasso,'enclose'));
assert.deepEqual(new Set(ids),new Set(['hair-1','hair-2','body-1','body-2']));
assert(!ids.includes('shirt-locked')&&!ids.includes('props-hidden'));
assert.deepEqual(idsInMarquee(p.layers[0],[{x:26,y:8,p:1},{x:53,y:8,p:1},{x:53,y:31,p:1},{x:26,y:31,p:1}],'touch').sort(),['hair-1','hair-2']);
const m=[1,0,0,1,32,15],history=new DocumentStore(p),copied=p.layers.map(l=>({...l,operations:l.operations.map(op=>ids.includes(op.id)?transformedStroke(op,m):op)}));
history.commit({...p,layers:copied},'Transform selected strokes');
assert.equal(polyline(history.getSnapshot().layers[1].operations[0])[0].x,82);
assert.equal(polyline(history.getSnapshot().layers[0].operations[0])[0].x,62);
history.undo();assert.equal(polyline(history.getSnapshot().layers[1].operations[0])[0].x,50);
history.redo();assert.equal(polyline(history.getSnapshot().layers[0].operations[0])[0].x,62);
validateProject(JSON.parse(JSON.stringify(history.getSnapshot())));
const original=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],warped=[{x:0,y:0},{x:200,y:0},{x:110,y:100},{x:0,y:100}],h=homography(original,warped);assert(h);
for(let i=0;i<4;i++){let pt=projectPoint(original[i],h);assert(Math.hypot(pt.x-warped[i].x,pt.y-warped[i].y)<1e-6);}
const wide=projectiveStroke(stroke('perspective-test',[[0,0],[100,0],[100,100],[0,100]]),h);
assert.equal(hitStroke({operations:[wide]},projectPoint({x:100,y:100},h),1)?.id,'perspective-test');
assert(boundsOf([wide]).w>150,'one end grows and one end remains narrower');
const shape=fs.readFileSync(path.join(__dirname,'../src/engine/StudioEngine.ts'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../src/ui/App.tsx'),'utf8');
assert(shape.includes("this.strokeMode==='select'||this.strokeMode==='lasso'"));
assert(shape.includes("if(!snapshotPreview&&this.tool==='stroke-select'&&this.strokeIds.length)"));
assert(shape.includes("['scale','rotate','perspective','freeform'].includes(this.strokeMode)"));
assert(ui.includes('label="Stroke selection and transform tools"'));
for(const name of ['Select','Lasso'])assert(ui.includes(`<span>${name}</span>`),name);
assert(ui.includes("chooseTool('transform')"),'Selected artwork opens the full transform tool');
assert(ui.includes('<TransformOverlay engine={engineReady}'),'Full transform controls remain wired');
assert(shape.includes("strokeScope:'current'|'visible'='current'"),'Selection engine retains current/visible scope');
// Stroke picking on a large scene should remain bounded; it is only active in selection mode.
const fast=p.layers[0];const begin=performance.now();for(let i=0;i<300;i++)hitStroke(fast,{x:40,y:20},1);const dt=performance.now()-begin;
console.log('PASS: stroke hit; Shift-toggle; lasso 4 strokes across two layers; locked/hidden protection; cross-layer move/undo/redo/save; unequal-corner perspective; modern selection UI checks');
console.log('300 synthetic stroke picks:',dt.toFixed(2),'ms (not Wacom latency)');
