const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const filename=require('node:path').join(__dirname,'../../src/tools/transform/math/meshGeometry.ts');
const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(js,filename);
const {createRegularMesh,validateMesh,moveVertex,sourceAt,isIdentityMesh,copyMesh}=m.exports;
const mesh=createRegularMesh({x:20,y:40,w:200,h:100},2,3);
assert.equal(mesh.vertices.length,12);assert.equal(mesh.faces.length,12);
assert.equal(validateMesh(mesh).length,0);
assert.equal(isIdentityMesh(mesh),true);
for(const p of [{x:25,y:45},{x:80,y:70},{x:215,y:135}]){
 const mapped=sourceAt(mesh,p);assert.ok(mapped);assert.ok(Math.hypot(mapped.x-p.x,mapped.y-p.y)<1e-7);
}
const clone=copyMesh(mesh),source=clone.vertices[5].source;
assert.equal(moveVertex(clone,5,{x:source.x+5,y:source.y+2}),true);
assert.deepEqual(clone.vertices[5].source,source);assert.equal(isIdentityMesh(clone),false);
assert.equal(isIdentityMesh(mesh),true);
clone.vertices[5].locked=true;assert.equal(moveVertex(clone,5,{x:0,y:0}),false);
const bad=createRegularMesh({x:0,y:0,w:100,h:100},1,1);
assert.equal(moveVertex(bad,1,{x:-100,y:0}),true);
assert.ok(validateMesh(bad).some(i=>i.reason==='folded-destination'));
assert.equal(sourceAt(mesh,{x:-20,y:-20}),null);
console.log('PASS mesh geometry foundation: identity, UV inverse map, immutable source, lock, fold guard');
