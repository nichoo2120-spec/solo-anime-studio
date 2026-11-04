const ts=require('typescript');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
const matrix=fs.readFileSync('src/tools/transform/math/matrix.ts','utf8');
const mesh=fs.readFileSync('src/tools/transform/math/meshWarp.ts','utf8');
function compile(source,req={}){const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{})(x=>req[x],module,module.exports);return module.exports;}
const m=compile(matrix),w=compile(mesh,{'./matrix':m});const q=[{x:0,y:0},{x:300,y:0},{x:300,y:200},{x:0,y:200}];const grid=w.makeGrid(q,4,4);assert.equal(w.meshHasFold(grid),false,'regular mesh remains valid');const bad=w.cloneGrid(grid);bad.nodes[2*5+2]={x:-160,y:130};assert.equal(w.meshHasFold(bad),true,'inverted mesh is rejected');console.log('PASS mesh fold guard accepts normal grid and rejects folded grid');
