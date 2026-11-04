const fs=require('fs'),assert=require('assert'),ts=require('typescript');
const path=require('path'),vm=require('vm');const cache={};
function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{console,Math,Array,Set,Map})(s=>load(path.resolve(path.dirname(file),s+'.ts')),m,m.exports);return m.exports;}
const {makeGrid,dragFreePin,gridPoint}=load(path.join(__dirname,'../../src/tools/transform/math/meshWarp.ts'));
const q=[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}],g=makeGrid(q,4,4);g.pins=[{u:.45,v:.48,dx:0,dy:0,radius:.38},{u:.55,v:.55,dx:0,dy:0,radius:.38}];
const moved=dragFreePin(g,0,100,50,'neighbor',false,true);const nearbyNode=2*5+2;
assert(moved.nodes[nearbyNode].x>g.nodes[nearbyNode].x+1,'neighbor grid control point should move');
assert(moved.pins[1].dx>0,'older nearby free pin should move');
assert.deepEqual(JSON.parse(JSON.stringify(moved.nodes[0])),JSON.parse(JSON.stringify(g.nodes[0])),'locked border should stay anchored');
const before=gridPoint(g,.45,.48),after=gridPoint(moved,.45,.48);
assert(Math.abs((after.x-before.x)-100)<1e-5,'dragged pin center must follow pointer exactly');
assert(Math.abs((after.y-before.y)-50)<1e-5,'dragged pin center y must follow pointer exactly');
const local=dragFreePin(g,0,100,50,'local',false,true);
assert.deepEqual(JSON.parse(JSON.stringify(local.nodes)),JSON.parse(JSON.stringify(g.nodes)),'local should not move mesh nodes');assert.equal(local.pins[1].dx,0,'local should not move other pins');
const zero=dragFreePin(g,0,0,0,'neighbor',false,true);assert.deepEqual(JSON.parse(JSON.stringify(zero.nodes)),JSON.parse(JSON.stringify(g.nodes)),'zero movement must not change grid nodes');
console.log('PASS: grid followers, pin followers, locked border, exact pointer drag, local-only isolation, zero-delta');
