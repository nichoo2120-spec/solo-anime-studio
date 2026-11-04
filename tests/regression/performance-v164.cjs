const ledger=require('../revision-ledger-v174.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const before=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v163-revisions.json')));
const fixed=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v164-revisions.json')));const v165=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v165-revisions.json')));const v166=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v166-revisions.json')));
for(const [file,revision] of Object.entries(fixed)){
 assert.equal(revision.before,before[file].after,`${file}: historical v163 source hash must remain recorded`);
 if(v165[file])assert.equal(v165[file].before,revision.after);if(v166[file])assert.equal(v166[file].before,v165[file]?.after??revision.after);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),ledger(file,v166[file]?.after??v165[file]?.after??revision.after),`${file}: current versioned source hash`);
}
const code=fs.readFileSync(path.join(root,'src/engine/StudioEngine.ts'),'utf8');
const cache=fs.readFileSync(path.join(root,'src/engine/DrawingFrameCache.ts'),'utf8');
assert(!code.includes('cachedDrawing||warmDrawing?this.drawingFrames.restore(ctx,dirtyFrame)'), 'no full prefix restore on idle frames');
assert(!code.includes('warmDrawing&&l.id===p.activeLayerId))this.drawingFrames.capture(ctx)'), 'no full-frame prefix capture while idle');
assert(code.includes('const cachedBelow=cachedDrawing?this.drawingFrames.restore(ctx,dirtyFrame):undefined'), 'restore only when a drawing is active');
assert(cache.includes('old.project===key.project'), 'reject cross-snapshot cached prefix');
const frozen=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/performance-v157-frozen.json')));
for(const [file,expected] of Object.entries(frozen))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),expected,`protected fixture changed: ${file}`);
console.log('PASS: v164 emergency rollback and protected brush-golden hash guards');
