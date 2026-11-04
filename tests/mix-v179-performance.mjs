import {createServer} from 'vite';import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const server=await createServer({cacheDir:'/tmp/solo-mix-performance',server:{host:'127.0.0.1',port:5799,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/workspace/scratch/e841b2ae644b/qa-tools/runtime/chromium'),args:['--no-sandbox','--disable-gpu']});
try{
 const rows=[];
 for(const config of [{name:'normal',dpr:1,cpu:1,sizes:[30,150]},{name:'stress',dpr:2,cpu:4,sizes:[150]}]){
  const page=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:config.dpr}),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:config.cpu});
  await page.goto('http://127.0.0.1:5799/tests/drawing-v155.html');await page.waitForFunction(()=>window.DRAWING_TEST);
  for(const preset of ['color-solid','dry-ink-bristle','water-wet'])for(const size of config.sizes){
   const result=await page.evaluate(async({preset,size})=>{
    const h=window.DRAWING_TEST;await h.scene('mix-perf-'+preset+'-'+size);h.brush(preset,size);h.engine.setInput('brush',{...h.engine.brush,nativeMixEnabled:true,mixAmount:.8,mixPaintLoad:0},{id:preset,name:preset});await h.ready();await new Promise(resolve=>setTimeout(resolve,250));
    const errors=[],worker=h.engine.blendWorker.worker,receive=e=>{if(e.data.error)errors.push(e.data.error);};worker?.addEventListener('message',receive);
    const c=document.querySelector('#drawing'),rect=c.getBoundingClientRect(),frames=[];let previous=performance.now();
    for(let frame=0;frame<=80;frame++){
     for(let k=0;k<4;k++){const i=frame*4+k,t=Math.min(1,i/323),v=h.engine.view,e=new PointerEvent(i===0?'pointerdown':i===323?'pointerup':'pointermove',{pointerId:63,isPrimary:true,pointerType:'pen',button:0,buttons:i===323?0:1,pressure:.2+.8*Math.sin(t*Math.PI)**2,clientX:rect.left+v.x+(80+t*720)*v.zoom,clientY:rect.top+v.y+(250+80*Math.sin(t*Math.PI*3))*v.zoom});Object.defineProperty(e,'timeStamp',{value:10000+i*5});c.dispatchEvent(e);}
     await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-previous);previous=now;
    }
    const release=performance.now();await h.engine.renderer.whenSettled();await h.ready();const settleMs=performance.now()-release,project=h.store.getSnapshot(),stroke=project.layers.find(l=>l.id===project.activeLayerId).operations.at(-1);worker?.removeEventListener('message',receive);
    frames.sort((a,b)=>a-b);return{frameP95Ms:frames[Math.floor(frames.length*.95)],frameMaxMs:frames.at(-1),settleMs,workerErrors:errors,operations:project.layers.flatMap(l=>l.operations).length,version:stroke.nativeMixVersion,workerActive:h.engine.blendWorker.available()};
   },{preset,size});rows.push({configuration:config.name,dpr:config.dpr,cpu:config.cpu,preset,size,...result});console.log(rows.at(-1));
  }await page.close();
 }
 fs.mkdirSync('validation/mix-v179',{recursive:true});fs.writeFileSync('validation/mix-v179/performance.json',JSON.stringify({method:'Single diagnostic run per case, software Chromium, 281-stroke fixture, four pen samples per RAF. Not a physical pen latency measurement or a statistically controlled before/after benchmark.',rows},null,2));
 for(const row of rows){assert.equal(row.version,3);assert.equal(row.workerActive,true);assert.deepEqual(row.workerErrors,[]);assert(row.operations>=282);}
}finally{await browser.close();await server.close();}
