const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,uid}=require('../src/core/model.ts');
const {saveSubstitution,substitutionItems}=require('../src/animation/substitutions.ts');
const {DocumentStore}=require('../src/core/history.ts');
let p=newProject('Wacom pen shell',640,360),layerId=p.activeLayerId;
const stroke=n=>({id:uid(),kind:'stroke',tool:'brush',points:[{x:n,y:n,p:1}],size:3,opacity:1,color:'#000000',response:1,pressure:false});
p={...p,layers:p.layers.map(l=>l.id===layerId?{...l,operations:[stroke(0)]}:l)};
p=saveSubstitution(p,'Blink','eyes');
const shelfRef=substitutionItems(p),entryRef=shelfRef[0],entryOperations=entryRef.operations;
const store=new DocumentStore(p);
const t=performance.now();
for(let i=1;i<=100;i++){
 const before=store.getSnapshot();const layers=before.layers.map(l=>l.id===layerId?{...l,operations:[...l.operations,stroke(i)]}:l);
 store.commit({...before,layers},'Simulated pen commit');
 assert.strictEqual(substitutionItems(store.getSnapshot()),shelfRef,'Saving a stroke must not regenerate shelf items');
 assert.strictEqual(substitutionItems(store.getSnapshot())[0].operations,entryOperations,'Shelf preview source must remain stable');
}
const duration=performance.now()-t;
assert.strictEqual(store.getSnapshot().layers.find(l=>l.id===layerId).operations.length,101);
assert.strictEqual(substitutionItems(store.getSnapshot())[0],entryRef);
console.log('PASS shelf performance: 100 simulated pen commits preserve immutable shelf entry references and require 0 substitution regeneration ('+duration.toFixed(1)+'ms store-only; not a Wacom latency measurement)');
