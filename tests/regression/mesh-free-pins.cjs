const fs=require('fs'),assert=require('assert'),ts=require('typescript'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'../../src/tools/transform');const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const source=fs.readFileSync(file,'utf8');const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const req=(id)=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id);new Function('module','exports','require',code)(module,module.exports,req);return module.exports;}
const {makeGrid,cloneGrid,gridPoint,insertMeshDivision}=load(path.join(root,'math/meshWarp.ts'));
const {meshWarp}=load(path.join(root,'modes/MeshWarp.ts'));
const quad=[{x:0,y:0},{x:600,y:0},{x:600,y:400},{x:0,y:400}];
const grid=makeGrid(quad,4,4);grid.pins=[{u:.37,v:.46,dx:30,dy:-20,radius:.25}];
let pinPos=gridPoint(grid,.37,.46),unpinPos=gridPoint(grid,.37,.46,false);
assert(Math.abs(pinPos.x-unpinPos.x-30)<1e-6&&Math.abs(pinPos.y-unpinPos.y+20)<1e-6,'pin moves local artwork');
assert.deepStrictEqual(grid.nodes,makeGrid(quad,4,4).nodes,'pin does not add grid intersections');
assert.deepStrictEqual(gridPoint(grid,0,.46),gridPoint(grid,0,.46,false),'outer border stable');
assert.deepStrictEqual(gridPoint(grid,.99,.99),gridPoint(grid,.99,.99,false),'unaffected distant area');
const copy=cloneGrid(grid);copy.pins[0].dx=80;assert.equal(grid.pins[0].dx,30,'pin cloning is deep');
const split=insertMeshDivision(grid,'row',.36);assert(split&&split.pins.length===1&&split.pins[0].dx===30,'pins survive subdivision');
const session={grid:cloneGrid(grid),quad:structuredClone(quad),meshFalloff:50,meshSmooth:true};const start={handle:{type:'node',index:12},grid:cloneGrid(grid),point:{x:0,y:0}};
meshWarp(session,start,{x:25,y:12});assert.equal(session.grid.pins.length,1,'pins survive ordinary mesh node moves');
console.log('PASS free pin moves rendered artwork locally');console.log('PASS unchanged mesh topology and anchored borders');console.log('PASS pins survive cloning, subdivisions and mesh drags');
