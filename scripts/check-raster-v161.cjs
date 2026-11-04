// Dependency-free focused check. Does not replace pixel-level Chromium parity.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync('src/engine/RasterSceneDisplay.ts','utf8');
const out=ts.transpileModule(source,{fileName:'RasterSceneDisplay.ts',compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal(out.diagnostics?.length??0,0);
const sandboxModule={exports:{}},sandbox={module:sandboxModule,exports:sandboxModule.exports,require(spec){if(spec==='./InkDisplay')return {displayCleanInk:()=>false};throw Error('Unexpected dependency '+spec)},setTimeout,clearTimeout,URL};
vm.runInNewContext(out.outputText.replaceAll('import.meta.url', JSON.stringify('file:///test/')),sandbox,{filename:'RasterSceneDisplay.cjs'});
const {RasterSceneDisplay}=sandboxModule.exports;
let checks=0;
for(const dpr of [1,2])for(let n=0;n<10;n++){
 const s=new RasterSceneDisplay(()=>{throw Error('editing path should not schedule a worker');});
 s.group=()=>{throw Error('editing path must not access the asynchronous raster-group');};
 assert.equal(s.paint({}, {id:'p',width:300,height:200,layers:[]}, {}, 'layer'),undefined);
 assert.equal(s.paint({}, {id:'p',width:300,height:200,layers:[]}, {}),undefined);
 assert.equal(s.status().pending,false);assert.equal(s.status().ready,0);
 s.dispose();checks++;
}
console.log(`${checks}/20 isolated DPR-1/DPR-2 editing compositor guards PASS (mock objects; NOT a browser pixel-parity result).`);
