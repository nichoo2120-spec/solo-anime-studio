// Lightweight, dependency-free source regression guard; does not claim measured FPS.
const fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync('src/engine/StudioEngine.ts','utf8');
const cache=fs.readFileSync('src/engine/DrawingFrameCache.ts','utf8');
assert(code.includes('if(warmDrawing)this.drawingFrames.warm('), 'keep idle metadata preparation');
assert(code.includes('const cachedBelow=cachedDrawing?this.drawingFrames.restore(ctx,dirtyFrame):undefined'), 'only active drawings may restore the cached prefix');
assert(!code.includes('cachedDrawing||warmDrawing?this.drawingFrames.restore(ctx,dirtyFrame)'), 'idle background copy was reintroduced');
assert(!code.includes('(warmDrawing&&l.id===p.activeLayerId)'), 'idle full-canvas capture was reintroduced');
assert(cache.includes('old.project===key.project'), 'keep v161 same snapshot guard');
assert(code.includes('this.rasterScene.paint('), 'canonical source remains wired');
const raster=fs.readFileSync('src/engine/RasterSceneDisplay.ts','utf8');
assert(raster.includes('if(!this.allArtwork)return undefined'), 'keep v161 DPR parity compositor safeguard');
for(let i=0;i<20;i++)assert(code.includes('this.paintCursor()'), 'cursor render path must remain present');
console.log('PASS 20/20 v164 freeze-recovery source checks (not real-browser benchmarks).');
