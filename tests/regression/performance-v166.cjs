const ledger=require('../revision-ledger-v174.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const current=require('../fixtures/performance-v166-revisions.json');
const previous=require('../fixtures/performance-v165-revisions.json');
const original=require('../fixtures/performance-v157-frozen.json');
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
for(const [file,{before,after}] of Object.entries(current)){
 if(previous[file])assert.equal(before,previous[file].after,file+' history chain');
 assert.equal(hash(file),ledger(file,after),file+' current source revision');
}
for(const [file,sha] of Object.entries(original))assert.equal(hash(file),sha,file+' historical pixel fixture');
const source=fs.readFileSync('src/engine/paintCompositing.ts','utf8');
assert(source.includes("if(s.smudgeVersion===3"),'v3 blending route');
assert(source.includes("if(s.smudgeVersion===2"),'historical v2 smudge route');
assert(source.includes('applyBristleSmudge'),'historical unversioned Blender route');
const worker=fs.readFileSync('src/engine/liveBlend.worker.ts','utf8');
assert(worker.includes('applyGentleBlend'),'new Blender must use worker');
assert(worker.includes('createImageBitmap(target,r.x,r.y,r.width,r.height)'),'send only dirty rectangle');
assert(worker.includes('r=applyGentleBlend('),'incremental worker region');
console.log('v166 protected golden, version chain and incremental blending source checks PASS');
