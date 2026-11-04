// Historical v163 idle-capture experiment; intentionally rolled back in v164.
const release=JSON.parse(require('node:fs').readFileSync('package.json','utf8')).version;
if(release==='0.5.164'){
 console.log('v163 idle-capture optimization is disabled in v164 to restore responsiveness.');
 require('./check-freeze-recovery-v164.cjs');
}else{
// Focused runtime and source wiring guards. Does not replace Chromium pixel parity.
const fs=require('node:fs'),assert=require('node:assert/strict');
const ts=require('typescript');
const code=fs.readFileSync('src/engine/DrawingFrameCache.ts','utf8');
const studio=fs.readFileSync('src/engine/StudioEngine.ts','utf8');
const parsed=ts.createSourceFile('StudioEngine.ts',studio,ts.ScriptTarget.Latest,true);
assert.equal(parsed.parseDiagnostics.length,0);
assert(studio.includes('warmDrawing&&l.id===p.activeLayerId))this.drawingFrames.capture(ctx)'), 'idle frame must capture exactly below the active layer');
assert(studio.includes('cachedDrawing||warmDrawing?this.drawingFrames.restore(ctx,dirtyFrame)'), 'idle and active frames must reuse only the canonical prefix');
const result=ts.transpileModule(code,{fileName:'DrawingFrameCache.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal(result.diagnostics?.length,0);
const mod={exports:{}};new Function('require','module','exports',result.outputText)(n=>n==='./renderer'?{blendOperation:()=> 'source-over'}:n==='../core/dryBrush'?{dryRasterPadding:()=>10}:assert.fail('unexpected module '+n),mod,mod.exports);
const {DrawingFrameCache}=mod.exports;
function canvas(w=0,h=0){const c={width:w,height:h};let calls=0;const ctx={canvas:c,save(){},restore(){},resetTransform(){},clearRect(){},setTransform(){},drawImage(){calls++;}};c.getContext=()=>ctx;c.calls=()=>calls;return c;}
global.document={createElement:()=>canvas()};
let passed=0;
for(const dpr of [1,2])for(let i=0;i<10;i++){
 const lower={id:'background',visible:true,operations:[{id:'old'}]},target={id:'paint',operations:[{id:'old'}]},upper={id:'ink',operations:[]};
 const settings={},p={id:'p',width:256,height:200,layers:[upper,target,lower],activeLayerId:target.id,settings};
 const key={project:p,renderer:{},revision:0,target:target.id,width:256*dpr,height:200*dpr,dpr,view:{x:0,y:0,zoom:1,rotation:0}};
 const cache=new DrawingFrameCache(),surface=canvas(key.width,key.height),ctx=surface.getContext();cache.warm(key);cache.capture(ctx);
 assert.equal(cache.status().ready,true);
 const count=surface.calls();cache.capture(ctx);assert.equal(surface.calls(),count,'idle frames may not copy a ready prefix again');
 const edited={...p,layers:[upper,{...target,operations:[...target.operations,{id:'new'}]},lower]};
 cache.warm({...key,project:edited});
 assert.equal(cache.status().ready,true,'changed target alone leaves background pixels identical');
 assert(cache.restore(ctx) instanceof Set,'canonical warm composite can restore');
 const lowerEdited={...edited,layers:[upper,edited.layers[1],{...lower,operations:[...lower.operations,{id:'below'}]}]};
 cache.warm({...key,project:lowerEdited});assert.equal(cache.status().ready,false,'changed background must invalidate');
 cache.clear();passed++;
}
console.log(`${passed}/20 display-resolution canonical prefix guards PASS (mock surfaces, not browser pixel parity).`);

}
