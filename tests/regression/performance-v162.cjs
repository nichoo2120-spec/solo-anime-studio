const ledger=require('../revision-ledger-v174.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const previous=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v161-revisions.json')));
const current=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v162-revisions.json')));const latest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v163-revisions.json')));const v164=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v164-revisions.json')));const v165=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v165-revisions.json')));const v166=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v166-revisions.json')));
for(const [file,change] of Object.entries(current)){
 assert.equal(change.before,previous[file]?.after,'broken revision chain: '+file);
 if(latest[file])assert.equal(latest[file].before,change.after,'v162 -> v163 revision chain: '+file);if(v164[file])assert.equal(v164[file].before,latest[file]?.after??change.after,'v164 revision: '+file);if(v165[file])assert.equal(v165[file].before,v164[file]?.after??latest[file]?.after??change.after);if(v166[file])assert.equal(v166[file].before,v165[file]?.after??v164[file]?.after??latest[file]?.after??change.after);assert.equal(sha(file),ledger(file,v166[file]?.after??v165[file]?.after??v164[file]?.after??latest[file]?.after??change.after),'untracked version change: '+file);
}
const script=fs.readFileSync(path.join(root,'scripts/check-raster-v161.cjs'),'utf8');
assert.ok(script.includes("require('typescript')"),'raster checker must resolve local devDependency');
assert.ok(!script.includes('/opt/nvm/'),'raster checker must not hardcode a machine-specific path');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
assert.ok(Number(pkg.version.split('.')[2])>=166,'version must not go backwards');assert.ok(pkg.devDependencies.typescript,'typescript must be in declared devDependencies');
console.log('v162 portable checker and versioned historical revisions PASS.');
