// v0.5.241 Tip shape + Dual Brush (stamp engine): real-browser sheet, live raster
// vs reload parity, Blend on a shaped brush (real worker), old strokes unchanged.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.'),out=path.join(root,'validation','brush-shape-v241');fs.mkdirSync(out,{recursive:true});
const port=5842;
const server=await createServer({root,logLevel:'error',cacheDir:'/tmp/solo-shape-v241-vite',server:{host:'127.0.0.1',port,strictPort:true}});
server.middlewares.use('/__shapeqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Shape QA</title>');});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-gpu']});
let failed=false;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/__shapeqa`);
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {compositePaintStroke}=await import('/src/engine/paintCompositing.ts');
  const {drawStroke}=await import('/src/engine/renderer.ts');
  const {LiveStrokeRaster}=await import('/src/engine/liveRaster.ts');
  const {strokeGeometry}=await import('/src/engine/strokeGeometry.ts');
  const {finalGeometry}=await import('/src/engine/geometryCache.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const W=520,H=160,make=(w=W,h=H)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const pts=(L=120)=>Array.from({length:L},(_,i)=>{const t=i/(L-1);return {x:40+t*440,y:80+40*Math.sin(t*Math.PI*2),p:.3+.7*Math.sin(t*Math.PI)};});
  const strokeFor=(id,patch,extra={})=>{const preset=stockPresets.find(p=>p.id===id);const settings={...preset.settings,...patch};const {tsEnabled,dbEnabled,dbBrushId,dbBrushName,bbEnabled,...plain}=settings;return {...plain,...brushStrokeMetadata(settings),id:'shape-'+id+JSON.stringify(patch).length,kind:'stroke',tool:'brush',color:'#c0392b',size:36,opacity:1,pressure:true,response:1,points:pts(),...extra};};
  const reload=(s,base)=>{const res=make();const ctx=res.getContext('2d');if(base)ctx.drawImage(base,0,0);const mask=make();drawStroke(mask.getContext('2d'),s);compositePaintStroke(ctx,mask,s);return res;};
  const data=c=>c.getContext('2d').getImageData(0,0,W,H).data;
  const hash=d=>{let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);}return h>>>0;};
  const cases=[
   ['paint','Round paint, no shape (old path)',{}],
   ['paint','Roundness 25%, angle 45°',{tsEnabled:true,tsRoundness:.25,tsAngle:45}],
   ['paint','Scale X 250%, Scale Y 40%',{tsEnabled:true,tsScaleX:2.5,tsScaleY:.4}],
   ['flat','Flat, angle follows direction',{tsEnabled:true,tsRoundness:.3,tsFollow:true}],
   ['flat','Flat, follows + Flip X/Y',{tsEnabled:true,tsRoundness:.3,tsFollow:true,tsFlipX:true,tsFlipY:true,tsAngle:30}],
   ['hb','HB pencil squeezed 30%',{tsEnabled:true,tsRoundness:.3,tsAngle:-30}],
   ['g-pen','G-Pen, oval tip',{tsEnabled:true,tsRoundness:.35,tsAngle:60}],
   ['paint','Dual multiply + chalk',{dbEnabled:true,dbTip:'chalk',dbHardness:.85,dbTexture:.6,dbMode:'multiply',dbScale:.6,dbSpacing:.25,dbScatter:.4}],
   ['paint','Dual subtract + bristle',{dbEnabled:true,dbTip:'bristle',dbHardness:.7,dbTexture:.3,dbMode:'subtract',dbScale:.5,dbSpacing:.3,dbScatter:.8,dbCount:2}],
   ['paint','Dual darken',{dbEnabled:true,dbTip:'chalk',dbMode:'darken',dbScale:1}],
   ['paint','Dual overlay',{dbEnabled:true,dbTip:'flat-bristle',dbMode:'overlay',dbScale:.8}],
   ['paint','Dual lighten',{dbEnabled:true,dbTip:'chalk',dbMode:'lighten'}],
   ['paint','Dual screen',{dbEnabled:true,dbTip:'chalk',dbMode:'screen'}],
   ['paint','Dual height',{dbEnabled:true,dbTip:'chalk',dbMode:'height'}],
   ['paint','Shape + dual together',{tsEnabled:true,tsRoundness:.4,tsFollow:true,dbEnabled:true,dbTip:'chalk',dbMode:'multiply'}],
  ];
  const sheet=make(1100,60+cases.length*180),sc=sheet.getContext('2d');sc.fillStyle='#1b252b';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#e6eef2';sc.font='bold 20px sans-serif';sc.fillText('Tip shape + Dual brush v0.5.241 — reload (left) / live raster (right)',20,34);
  const rows=[],hashes=new Set();let row=0;
  for(const [id,label,patch] of cases){
   const s=strokeFor(id,patch),fin=reload(s);
   // live: grow the stroke through LiveStrokeRaster like the app, then compare.
  // incDiff/incMax: the live preview redraws only changed dabs; anti-aliasing can
  // differ by a few levels from a full redraw (the old engines do too, row 0). The
  // committed stroke is always the canonical render (liveDiff must be 0).
   const live=make(),lc=live.getContext('2d'),raster=new LiveStrokeRaster();
   let incDiff=0,incMax=0;for(const n of [2,10,30,31,60,90,120]){const part={...s,points:s.points.slice(0,n)};raster.paint(lc,part,strokeGeometry(part,'live'));const full=make();new LiveStrokeRaster().paint(full.getContext('2d'),part,strokeGeometry(part,'live'));const p1=data(live),p2=data(full);for(let i=0;i<p1.length;i++){const e=Math.abs(p1[i]-p2[i]);if(e)incDiff++;if(e>incMax)incMax=e;}}
   const finalScratch=make();drawStroke(finalScratch.getContext('2d'),s,'final',finalGeometry(s));
   const liveFinal=make();liveFinal.getContext('2d').clearRect(0,0,W,H);raster.paint(liveFinal.getContext('2d'),s,finalGeometry(s));
   let diff=0;const a=data(finalScratch),b=data(liveFinal);for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;raster.paint(lc,s,finalGeometry(s));{const c=data(live);for(let i=0;i<a.length;i++){const e=Math.abs(a[i]-c[i]);if(e)incDiff++;if(e>incMax)incMax=e;}}
   let ink=0;const f=data(fin);for(let i=3;i<f.length;i+=4)if(f[i]>8)ink++;
   const y=50+row*180;sc.fillStyle='#e6eef2';sc.font='15px sans-serif';sc.fillText(label,20,y+10);sc.fillStyle='#fff';sc.fillRect(10,y+16,W,H);sc.drawImage(fin,10,y+16);sc.fillRect(560,y+16,W,H);sc.drawImage(live,560,y+16);row++;
   rows.push({label,stamp:s.stampVersion??0,ink,liveDiff:diff,incDiff,incMax});hashes.add(hash(f));
  }
  // Blend mode on a shaped brush: real worker live/final parity.
  const scene=()=>{const c=make(),x=c.getContext('2d');x.fillStyle='#e8243a';x.fillRect(0,20,W/2,120);x.fillStyle='#1f5bd8';x.fillRect(W/2,20,W/2,120);return c;};
  let waiting;const worker=new LiveBlendWorker(()=>{waiting?.();waiting=undefined;});let blend;
  try{const s=strokeFor('paint',{tsEnabled:true,tsRoundness:.3,tsFollow:true,bbEnabled:true,dbEnabled:true,dbTip:'chalk',dbMode:'multiply'}),base=scene();
   for(const n of [1,10,40,41,90,120,120])await Promise.race([new Promise(r=>{waiting=r;worker.preview({...s,points:s.points.slice(0,n)},base,{n});}),new Promise((_,rej)=>setTimeout(()=>rej(Error('no preview')),8000))]);
   const pending=worker.finish(s);const live=await pending.done;const a=data(reload(s,base)),b=live.getContext('2d').getImageData(0,0,W,H).data;let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;
   let changed=0;const bd=data(base);for(let i=0;i<a.length;i+=4)if(a[i]!==bd[i]||a[i+2]!==bd[i+2])changed++;blend={stamp:s.stampVersion,blend:s.brushBlendVersion,diff,changed};
  }catch(e){blend={error:String(e)};}finally{worker.cancel();worker.dispose();}
  return {rows,distinct:hashes.size,blend,sheet:sheet.toDataURL()};
 });
 fs.writeFileSync(path.join(out,'shape-sheet.png'),Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
 result.errors=errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,1));
 assert.equal(result.rows[0].stamp,0,'no shape keeps the old engine');
 for(const r of result.rows.slice(1)){assert.equal(r.stamp,1,r.label);assert(r.ink>1500,r.label+' draws');assert.equal(r.liveDiff,0,r.label+' live == reload');assert(r.incMax<=result.rows[0].incMax,r.label+' incremental live preview stays as close as the old engine');}
 assert.equal(result.distinct,result.rows.length,'every setting gives a different result');
 assert(!result.blend.error,result.blend.error);assert.equal(result.blend.diff,0,'blend on shaped brush: worker live == reload');assert(result.blend.changed>300);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS brush-shape-v241-browser');
}catch(e){failed=true;console.error(e);}finally{await browser.close();await server.close();}
process.exitCode=failed?1:0;
