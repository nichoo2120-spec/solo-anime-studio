const ledger=require('../revision-ledger-v174.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const changes=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v161-revisions.json')));
const current=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v162-revisions.json')));const latest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v163-revisions.json')));const v164=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v164-revisions.json')));const v165=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v165-revisions.json')));const v166=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v166-revisions.json')));
const old=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v158-revisions.json')));
for(const [file,entry] of Object.entries(changes)){
 if(old[file])assert.equal(entry.before,old[file].after,'version chain broken: '+file);
 if(current[file])assert.equal(current[file].before,entry.after,'v161 -> v162 version chain: '+file);
 if(latest[file])assert.equal(latest[file].before,current[file]?.after??entry.after,'v163 revision: '+file);if(v164[file])assert.equal(v164[file].before,latest[file]?.after??current[file]?.after??entry.after,'v164 revision: '+file);if(v165[file])assert.equal(v165[file].before,v164[file]?.after??latest[file]?.after??current[file]?.after??entry.after);if(v166[file])assert.equal(v166[file].before,v165[file]?.after??v164[file]?.after??latest[file]?.after??current[file]?.after??entry.after);assert.equal(hash(file),ledger(file,v166[file]?.after??v165[file]?.after??v164[file]?.after??latest[file]?.after??current[file]?.after??entry.after),'source revision not recorded: '+file);
}
const protectedFiles=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v157-frozen.json')));
for(const [file,expected]of Object.entries(protectedFiles))assert.equal(hash(file),expected,'frozen golden modified: '+file);
console.log('v161 source revisions recorded; protected golden fixtures and historical chain unchanged.');
