const ledger=require('../revision-ledger-v174.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const latest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v163-revisions.json')));const v164=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v164-revisions.json')));const v165=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v165-revisions.json')));const v166=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v166-revisions.json')));
const older=[JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v158-revisions.json'))),JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v161-revisions.json'))),JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v162-revisions.json')))];
for(const [file,entry] of Object.entries(latest)){
 const previous=older.reduce((v,rows)=>rows[file]?.after??v,undefined);
 if(previous)assert.equal(entry.before,previous,'historical revision broken: '+file);
 if(v164[file])assert.equal(v164[file].before,entry.after,'v163 -> v164 revision: '+file);if(v165[file])assert.equal(v165[file].before,v164[file]?.after??entry.after);if(v166[file])assert.equal(v166[file].before,v165[file]?.after??v164[file]?.after??entry.after);assert.equal(sha(file),ledger(file,v166[file]?.after??v165[file]?.after??v164[file]?.after??entry.after),'untracked source edit: '+file);
}
const studio=fs.readFileSync(path.join(root,'src/engine/StudioEngine.ts'),'utf8');
assert(!studio.includes('warmDrawing&&l.id===p.activeLayerId))this.drawingFrames.capture(ctx)'), 'reverted idle capture must not return');
assert(!studio.includes('cachedDrawing||warmDrawing?this.drawingFrames.restore(ctx,dirtyFrame)'), 'reverted idle warm restore must not return');
const frozen=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v157-frozen.json')));
for(const [file,hash] of Object.entries(frozen))assert.equal(sha(file),hash,'protected golden changed: '+file);
console.log('v163 canonical warm-prefix source revisions and protected fixtures PASS.');
