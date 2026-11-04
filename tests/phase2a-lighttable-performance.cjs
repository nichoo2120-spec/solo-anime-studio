/** Fast source + behavioral regression: pinned previews should not repaint on pen commits. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///lighttable-perf-test'").replaceAll('import.meta.env.DEV','false'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject}=require('../src/core/model.ts');
const {addDrawingFrame,selectDrawingFrame,frameList,syncActiveFrame}=require('../src/animation/timeline.ts');
const {OnionSkinOverlay}=require('../src/engine/OnionSkinOverlay.ts');
const {toggleLightTablePin}=require('../src/animation/lightTable.ts');
const ui=fs.readFileSync(require('node:path').join(__dirname,'../src/ui/App.tsx'),'utf8');
assert.match(ui,/onion\.setPins\(cleaned\);writePreference\('light-table:'\+doc\.id,cleaned\);\},\[doc\.id,lightTablePins\]\)/,'Light table pin effect must depend on pin state, not all pen document changes');
assert.match(ui,/lightTableFrameIds=doc\.animation\?\.frames\.map/,'Deleted frames must prune pins without subscribing the overlay to every stroke');
let p=newProject('Pinned performance',480,270);p=addDrawingFrame(p);p=addDrawingFrame(p);
const frames=frameList(p);const active=frames[1].id,referenced=frames[0].id;p=selectDrawingFrame(p,active);
let paints=0,schedules=0,cancels=0;
const overlay=Object.create(OnionSkinOverlay.prototype);
Object.assign(overlay,{project:p,settings:{enabled:false,previous:false,next:false,previousOpacity:0,nextOpacity:0,currentLayerOnly:true},pins:[],neighbors:[],ghosts:new Map(),generation:0,signature:'',paint(){paints++},schedule(){schedules++},cancelTask(){cancels++},disposed:false});
const pin=toggleLightTablePin(p,[],referenced);
overlay.setPins(pin);
assert.equal(overlay.neighbors.length,1);assert.equal(paints,1,'New pin paints once, not twice');
assert.equal(schedules,1,'New pin schedules one render');
const beforeGeneration=overlay.generation;
for(let i=0;i<100;i++){
  // Simulate 100 active-frame brush commits preserving unmodified reference identity.
  const layer=p.layers[0],nextOps=[...layer.operations,{kind:'stroke',id:`stroke-${i}`,points:[],size:2,color:'#000',opacity:1}];
  p=syncActiveFrame({...p,layers:p.layers.map(l=>l.id===layer.id?{...l,operations:nextOps}:l)});
  overlay.update(p);
  overlay.setPins(pin);
}
assert.equal(overlay.generation,beforeGeneration,'Active-frame drawing should not invalidate pinned reference cache');
assert.equal(paints,1,'No full-overlay paints for 100 unrelated stroke commits');
assert.equal(schedules,1,'No ghost render jobs for 100 unrelated stroke commits');
// Slider adjustment must still update immediately.
overlay.setPins([{...pin[0],opacity:75}]);
assert.equal(paints,2);assert.equal(overlay.neighbors[0].opacity,.75);
// Switching onto the pinned reference hides the guide; switching away reveals it.
p=selectDrawingFrame(p,referenced);overlay.update(p);assert.equal(overlay.neighbors.length,0);
p=selectDrawingFrame(p,active);overlay.update(p);assert.equal(overlay.neighbors.length,1);
console.log('PASS light-table performance: 100 active-frame stroke commits trigger 0 extra overlay repaints/ghost renders; pin settings and frame switches still update.');
