import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.'),out='validation/mix-v179';fs.mkdirSync(out,{recursive:true});
const makeServer=async(root,port)=>{const s=await createServer({root,cacheDir:'/tmp/solo-deep-'+port,server:{host:'127.0.0.1',port,strictPort:true}});s.middlewares.use('/__mixqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Mix parity</title>');});await s.listen();return s;};
const baseline=await makeServer(path.resolve(process.env.MIX_BASELINE??'../github-auto-update'),5793),candidate=await makeServer(root,5794);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/workspace/scratch/e841b2ae644b/qa-tools/runtime/chromium'),args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();
 async function legacy(port){await page.goto('http://127.0.0.1:'+port+'/__mixqa');return page.evaluate(async()=>{
  const {stockPresets,isRetiredBlendPresetId}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{drawStroke}=await import('/src/engine/renderer.ts'),{compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts');
  const make=()=>{const c=document.createElement('canvas');c.width=560;c.height=180;return c;},rows=[];
  for(const p of stockPresets.filter(p=>p.category!=='Eraser'&&!isRetiredBlendPresetId(p.id)))for(const version of [0,1,2])for(const alpha of [1,.43]){
   const id='legacy-'+p.id,s={...p.settings,...brushStrokeMetadata(p.settings),id,kind:'stroke',tool:'brush',size:55,opacity:.63,color:'#379567',nativeMixVersion:version||undefined,nativeMixAmount:.72,nativeMixRadius:.5,dryBristleSeed:watercolorSeedFor(id),watercolorSeed:watercolorSeedFor(id),colorSeed:watercolorSeedFor(id),points:Array.from({length:42},(_,i)=>({x:30+i*11.3,y:90+24*Math.sin(i/41*Math.PI*2),p:.15+.85*Math.sin(i/41*Math.PI)**2,v:.65}))};
   const c=make(),ctx=c.getContext('2d'),mask=make();ctx.fillStyle=`rgba(231,31,49,${alpha})`;ctx.fillRect(0,20,220,140);ctx.fillStyle=`rgba(22,66,202,${alpha})`;ctx.fillRect(220,20,240,140);drawStroke(mask.getContext('2d'),s);compositePaintStroke(ctx,mask,s,0,0,strokeRasterBounds(s,560,180));const bytes=ctx.getImageData(0,0,560,180).data,hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');rows.push({preset:p.id,version,alpha,hash});c.width=c.height=mask.width=mask.height=0;
  }return rows;
 });}
 const old=process.env.DEEP_FOCUS?[]:await legacy(5793);if(process.env.DEEP_FOCUS)await page.goto('http://127.0.0.1:5794/__mixqa');const fresh=process.env.DEEP_FOCUS?[]:await legacy(5794);assert.deepEqual(fresh,old,'Paint or old saved Mix pixels changed');
 const checks=await page.evaluate(async focus=>{
  const {stockPresets,isRetiredBlendPresetId}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{drawStroke}=await import('/src/engine/renderer.ts'),{compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts'),{LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const make=()=>{const c=document.createElement('canvas');c.width=900;c.height=560;return c;},rows=[],errors=[],timing=[];
  const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.error)errors.push(e.data.error);});}};
  const base=make(),bc=base.getContext('2d');bc.fillStyle='rgba(230,22,41,.45)';bc.fillRect(0,20,330,520);bc.fillStyle='rgba(18,70,205,.72)';bc.fillRect(330,20,340,520);
  const presets=stockPresets.filter(p=>p.category!=='Eraser'&&!isRetiredBlendPresetId(p.id));
  let waiter;const client=new LiveBlendWorker(()=>{waiter?.();waiter=undefined;});
  for(const preset of presets.filter(p=>!focus||focus.includes(p.id)))for(const config of [{size:7,opacity:.25,shape:'line'},{size:90,opacity:1,shape:'curve'},{size:150,opacity:.65,shape:'reverse'}]){
   const id=preset.id+'-'+config.size,settings={...preset.settings,size:config.size},s={...settings,...brushStrokeMetadata(settings),id,kind:'stroke',tool:'brush',color:'#00ff00',pressure:true,nativeMixVersion:3,nativeMixAmount:.73,nativeMixRadius:.5,opacity:config.opacity,dryBristleSeed:watercolorSeedFor(id),watercolorSeed:watercolorSeedFor(id),colorSeed:watercolorSeedFor(id),points:Array.from({length:81},(_,i)=>({x:config.shape==='reverse'?820-i*9.2:40+i*9.2,y:280+(config.shape==='line'?0:90*Math.sin(i/80*Math.PI*3)),p:.12+.88*Math.sin(i/80*Math.PI)**2,v:i<40?.25:.85}))};
   function render(stroke){const c=make(),ctx=c.getContext('2d'),mask=make();ctx.drawImage(base,0,0);drawStroke(mask.getContext('2d'),stroke);compositePaintStroke(ctx,mask,stroke,0,0,strokeRasterBounds(stroke,900,560));mask.width=mask.height=0;return c;}
   const expected=render(s),replay=render(JSON.parse(JSON.stringify(s)));let replayMax=0;const aa=expected.getContext('2d').getImageData(0,0,900,560).data,rr=replay.getContext('2d').getImageData(0,0,900,560).data;for(let i=0;i<aa.length;i++)replayMax=Math.max(replayMax,Math.abs(aa[i]-rr[i]));replay.width=replay.height=0;
   const start=performance.now();let mainReads=0;const original=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){mainReads++;return original.apply(this,args);};
   for(const n of [1,15,42,81,81])await Promise.race([new Promise(resolve=>{waiter=resolve;client.preview({...s,points:s.points.slice(0,n)},base,{});}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker preview timeout '+id)),7000))]);
   const finalStart=performance.now(),pending=client.finish(s);if(!pending)throw Error('Missing final '+id);const actual=await pending.done;CanvasRenderingContext2D.prototype.getImageData=original;if(!actual)throw Error('Worker failed '+id);
   const finalMs=performance.now()-finalStart;timing.push({preset:preset.id,...config,totalWorkerMs:performance.now()-start,finalMs});
   const bb=actual.getContext('2d').getImageData(0,0,900,560).data;let max=0,changed=0;const diffs=[];for(let i=0;i<aa.length;i++){const d=Math.abs(aa[i]-bb[i]);max=Math.max(max,d);if(d){changed++;if(diffs.length<20)diffs.push({i,x:Math.floor(i/4)%900,y:Math.floor(i/3600),a:[...aa.slice(i-i%4,i-i%4+4)],b:[...bb.slice(i-i%4,i-i%4+4)]});}}
   rows.push({preset:preset.id,...config,replayMax,workerMax:max,workerChangedBytes:changed,mainReads,diffs});expected.width=expected.height=actual.width=actual.height=0;client.cancel();
  }
  client.dispose();window.Worker=NativeWorker;return{rows,errors,timing};
 },process.env.DEEP_FOCUS?.split(','));
 fs.writeFileSync(out+'/compatibility.json',JSON.stringify({baselineVersion:'0.5.178',unchanged:fresh.length,rows:fresh},null,2));
 fs.writeFileSync(out+'/deep-results.json',JSON.stringify(checks,null,2));
 assert.deepEqual(checks.errors,[]);for(const row of checks.rows){assert.equal(row.replayMax,0,JSON.stringify(row));assert.equal(row.workerMax,0,JSON.stringify(row));assert.equal(row.mainReads,0,JSON.stringify(row));}
 console.log(`${fresh.length} unchanged Paint/legacy Mix renders; ${checks.rows.length} deterministic saved replays and exact worker finals; zero worker errors and zero main-thread Mix readbacks.`);
}finally{await browser.close();await baseline.close();await candidate.close();}
