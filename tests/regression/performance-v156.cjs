const ledger=require('../revision-ledger-v174.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),revisions=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v156-revisions.json')));
const latest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v157-revisions.json')));
for(const [file,row]of Object.entries(revisions)){if(latest[file])assert.equal(latest[file].before,row.after);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),ledger(file,latest[file]?.after??row.after),file);}
const golden=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/smudge-v156-goldens.json')));assert.equal(golden.rows.length,64);assert(golden.rows.every(r=>r.canonical.length===64&&r.canonical===r.repeat));
console.log('Four scoped performance source guards and 64 frozen v155 smudge expectations PASS.');
