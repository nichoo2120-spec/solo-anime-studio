const ledger=require('../revision-ledger-v174.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),protectedFiles=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/phase3-protected-v153.json'),'utf8'));
const revisions=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v156-revisions.json'),'utf8'));
const next=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v158-revisions.json')));
for(const [file,expected]of Object.entries(protectedFiles)){
 if(revisions[file])assert.equal(revisions[file].before,expected);
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 let final=revisions[file]?.after??expected;if(next[file]){assert.equal(next[file].before,final);final=next[file].after;}assert.equal(actual,ledger(file,final),`${file}: classic renderer/UI/frozen baseline changed`);
}
const newEngine=fs.readFileSync(path.join(root,'src/engine/wetSmudge.ts'),'utf8');
assert(!/Math\.random|Date\.now|performance\.now/.test(newEngine),'smudge must not depend on clock or uncontrolled randomness');
console.log(Object.keys(protectedFiles).length+' classic-renderer/UI/frozen-fixture integrity guards passed, including the recorded rollback-only v156 exception.');
