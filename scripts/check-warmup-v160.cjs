// A dependency-light smoke test for v161 canonical-composite warm-cache reuse.
// After npm install: node scripts/check-warmup-v160.cjs
// Run with project TypeScript (or NODE_PATH pointing to a global installation).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/engine/DrawingFrameCache.ts'),'utf8');
const result=ts.transpileModule(source,{fileName:'DrawingFrameCache.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal(result.diagnostics?.length,0,'TypeScript transpilation');
const mod={exports:{}};
new Function('require','module','exports',result.outputText)(id=>{
 if(id==='./renderer')return {blendOperation:()=> 'source-over'};
 if(id==='../core/dryBrush')return {dryRasterPadding:()=>10};
 throw new Error('Unrecognised test import '+id);
},mod,mod.exports);
const {DrawingFrameCache}=mod.exports;
function fakeCanvas(w=128,h=96){const canvas={width:w,height:h};const ctx={canvas,globalAlpha:1,globalCompositeOperation:'source-over',save(){},restore(){},resetTransform(){},clearRect(){},drawImage(){},setTransform(){}};canvas.getContext=()=>ctx;return canvas;}
global.document={createElement:()=>fakeCanvas(0,0)};
let cases=0;
for(const dpr of [1,2])for(let run=0;run<10;run++){
 const upper={id:'upper',opacity:1,blend:'normal'},target={id:'paint',opacity:1,blend:'normal'},p={id:'project',width:128,height:96,layers:[upper,target]};
 const renderer={},key={project:p,renderer,revision:0,target:'paint',width:128*dpr,height:96*dpr,dpr,view:{x:0,y:0,zoom:1,rotation:0}};
 const cache=new DrawingFrameCache(),surface=fakeCanvas(key.width,key.height),ctx=surface.getContext('2d'),stroke={id:'stroke'+run,size:8,engineVersion:10},g={points:[{x:30,y:30,p:1}],cubics:[]};
 cache.warm(key);cache.capture(ctx);cache.rememberInk('upper',surface);
 assert(cache.status().ready,'warm cache setup');assert(cache.paintInk(ctx,upper),'warm upper ink setup');
 assert.equal(cache.begin(key,stroke,g),undefined,'first gesture is full redraw');
 assert.equal(cache.status().ready,true,'immutable warm prefix stays available');
 assert(cache.restore(ctx) instanceof Set,'stable warm prefix can restore');
 assert.equal(cache.paintInk(ctx,upper),true,'stable warm upper ink can paint');
 cache.capture(ctx);cache.rememberInk('upper',surface);cache.finish(stroke,g);
 assert.equal(cache.status().ready,true,'prefix remains ready');
 assert.equal(cache.paintInk(ctx,upper),true,'upper ink remains ready');
 assert.deepEqual(cache.begin(key,stroke,{points:[{x:35,y:35,p:1}],cubics:[]},{x:30,y:30,width:5,height:5}),{x:Math.floor(30*dpr)-3,y:Math.floor(30*dpr)-3,width:5*dpr+6,height:5*dpr+6},'later frames are dirty region only');
 assert(cache.restore(ctx,{x:0,y:0,width:20,height:20}) instanceof Set,'later cache restore succeeds');
 const replacement={...p,layers:[upper,{...target}]};cache.warm({...key,project:replacement});
 assert.equal(cache.status().ready,false,'project change invalidates prefix');cache.clear();cases++;
}
console.log(`PASS: ${cases} focused cache-warmup cases (10 consecutive at DPR 1, 10 at DPR 2). Not full app pixel parity.`);
