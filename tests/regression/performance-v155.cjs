const ledger=require('../revision-ledger-v174.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),files=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v155-protected.json'),'utf8'));
const revisions=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v156-revisions.json'),'utf8'));
const latest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v157-revisions.json'),'utf8'));
const next=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v158-revisions.json')));
for(const [file,sha]of Object.entries(files)){let expected=sha;if(revisions[file]){assert.equal(revisions[file].before,expected);expected=revisions[file].after;}if(latest[file]){assert.equal(latest[file].before,expected);expected=latest[file].after;}if(next[file]){assert.equal(next[file].before,expected);expected=next[file].after;}assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),ledger(file,expected),file+' changed outside the recorded performance optimization');}
console.log(Object.keys(files).length+' inherited brush/input/UI source guards passed, with explicitly chained v156/v157 performance revisions.');
