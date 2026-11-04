import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('.'),phase=process.env.MIX_PHASE??'after',out=path.join(root,'validation','mix-v179');
fs.mkdirSync(out,{recursive:true});
const server=await createServer({root,cacheDir:'/tmp/solo-mix-v179-vite',server:{host:'127.0.0.1',port:5792,strictPort:true}});
server.middlewares.use('/__mixqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Actual brush Mix verification</title>');});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/workspace/scratch/e841b2ae644b/qa-tools/runtime/chromium'),headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5792/__mixqa');
 const result=await page.evaluate(async phase=>{
  const {stockPresets,isRetiredBlendPresetId}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts');
  const {drawStroke}=await import('/src/engine/renderer.ts');
  const {compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const presets=stockPresets.filter(p=>p.category!=='Eraser'&&!isRetiredBlendPresetId(p.id));
  const make=(w=740,h=190)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const scene=()=>{const c=make(),ctx=c.getContext('2d');ctx.fillStyle='#ef1529';ctx.fillRect(10,24,240,142);ctx.fillStyle='#1246cd';ctx.fillRect(250,24,240,142);return c;};
  const sheet=make(1500,90+presets.length*155),sc=sheet.getContext('2d');sc.fillStyle='white';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#17242e';sc.font='bold 24px sans-serif';sc.fillText(phase==='before'?'v0.5.178: actual Mix output':'Candidate: actual Mix output',20,32);sc.font='16px sans-serif';sc.fillText('Input paint on transparent layer',20,65);sc.fillText('Mix dragged red → blue → empty paper; selected colour is GREEN',760,65);
  const rows=[],images={};
  for(const preset of presets){
   const settings={...preset.settings,size:90,opacity:1,flow:1},id='mix-qa-'+preset.id;
   const stroke={...settings,...brushStrokeMetadata(settings),id,kind:'stroke',tool:'brush',color:'#00ff00',size:90,opacity:1,flow:1,pressure:true,response:1,stabilization:.08,smoothness:18,captureZoom:1.21,nativeMixVersion:phase==='before'?2:3,nativeMixAmount:.85,nativeMixRadius:.65,dryBristleSeed:watercolorSeedFor(id),watercolorSeed:watercolorSeedFor(id),colorSeed:watercolorSeedFor(id),points:Array.from({length:101},(_,i)=>({x:48+i*6.2,y:95+24*Math.sin(i/100*Math.PI*2),p:.35+.65*Math.sin(i/100*Math.PI)**2,v:.65}))};
   const base=scene(),before=base.getContext('2d').getImageData(0,0,740,190).data,mask=make(),result=make();
   drawStroke(mask.getContext('2d'),stroke);result.getContext('2d').drawImage(base,0,0);
   const start=performance.now();compositePaintStroke(result.getContext('2d'),mask,stroke,0,0,strokeRasterBounds(stroke,740,190));const renderMs=performance.now()-start;
   const data=result.getContext('2d').getImageData(0,0,740,190).data;let changed=0,carry=0,green=0,outside=0,opaqueLoss=0;
   const nativeMask=mask.getContext('2d').getImageData(0,0,740,190).data;
   for(let i=0;i<data.length;i+=4){const x=(i/4)%740;const diff=data.slice(i,i+4).some((v,k)=>v!==before[i+k]);if(diff)changed++;if(x>515&&data[i+3]>2)carry++;if(data[i+3]>20&&data[i+1]>Math.max(data[i],data[i+2])+15)green++;if(nativeMask[i+3]===0&&diff)outside++;if(before[i+3]===255&&data[i+3]<255)opaqueLoss++;}
   const y=90+rows.length*155;sc.fillStyle='#f0f3f5';sc.fillRect(0,y,1500,155);sc.fillStyle='#17242e';sc.font='bold 16px sans-serif';sc.fillText(preset.name,20,y+20);sc.fillStyle='white';sc.fillRect(10,y+26,1480,125);sc.drawImage(base,10,y+26,730,125);sc.drawImage(result,760,y+26,730,125);
   images[preset.id]=result.toDataURL();rows.push({preset:preset.id,changedPixels:changed,carriedPixels:carry,greenPixels:green,outsideMaskChanged:outside,opaquePixelsLost:opaqueLoss,renderMs});
   mask.width=mask.height=result.width=result.height=base.width=base.height=0;
  }
  // Actual worker, including a duplicate pen sample (empty changed rectangles).
  const workerErrors=[],workerRows=[];let waiting;const worker=new LiveBlendWorker(()=>{waiting?.();waiting=undefined;});
  const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.error)workerErrors.push(e.data.error);});}};
  for(const presetId of ['color-solid','dry-ink-bristle','water-wet','g-pen','hb']){
   const settings={...presets.find(p=>p.id===presetId).settings,size:75},id='worker-'+presetId;
   const stroke={...settings,...brushStrokeMetadata(settings),id,kind:'stroke',tool:'brush',color:'#00ff00',pressure:true,opacity:.8,nativeMixVersion:phase==='before'?2:3,nativeMixAmount:.85,nativeMixRadius:.65,dryBristleSeed:watercolorSeedFor(id),watercolorSeed:watercolorSeedFor(id),colorSeed:watercolorSeedFor(id),points:Array.from({length:61},(_,i)=>({x:48+i*9,y:95+25*Math.sin(i/60*Math.PI*2),p:.4+.6*Math.sin(i/60*Math.PI),v:.65}))};
   const base=scene();let failed=false;
   try{
    for(const n of [1,12,30,61,61])await Promise.race([new Promise(resolve=>{waiting=resolve;worker.preview({...stroke,points:stroke.points.slice(0,n)},base,{});}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker did not deliver preview')),7000))]);
    const pending=worker.finish(stroke);if(!pending)throw Error('Worker unavailable');const result=await pending.done;if(!result)throw Error('Worker final failed');
    const expected=make(),mask=make();expected.getContext('2d').drawImage(base,0,0);drawStroke(mask.getContext('2d'),stroke);compositePaintStroke(expected.getContext('2d'),mask,stroke,0,0,strokeRasterBounds(stroke,740,190));
    const a=expected.getContext('2d').getImageData(0,0,740,190).data,b=result.getContext('2d').getImageData(0,0,740,190).data;let max=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);if(d)changed++;}workerRows.push({preset:presetId,max,changed});expected.width=expected.height=mask.width=mask.height=result.width=result.height=0;
   }catch(error){failed=true;workerRows.push({preset:presetId,error:String(error)});}finally{worker.cancel();if(failed)worker.retryForNewGesture();base.width=base.height=0;}
  }
  worker.dispose();window.Worker=NativeWorker;
  return{phase,rows,workerRows,workerErrors,images,sheet:sheet.toDataURL()};
 },phase);
 fs.writeFileSync(path.join(out,phase+'-sheet.png'),Buffer.from(result.sheet.split(',')[1],'base64'));
 for(const [id,png]of Object.entries(result.images))fs.writeFileSync(path.join(out,phase+'-'+id+'.png'),Buffer.from(png.split(',')[1],'base64'));
 delete result.sheet;delete result.images;fs.writeFileSync(path.join(out,phase+'-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(phase!=='before'){
  for(const row of result.rows){assert(row.changedPixels>0,row.preset+' did not mix');assert(row.carriedPixels>0,row.preset+' did not carry pigment onto empty paper');assert.equal(row.greenPixels,0,row.preset+' injected selected colour');assert.equal(row.outsideMaskChanged,0,row.preset+' changed outside native brush mask');assert.equal(row.opaquePixelsLost,0,row.preset+' reduced opaque coverage');}
  assert.deepEqual(result.workerErrors,[]);for(const row of result.workerRows){assert.equal(row.error,undefined,JSON.stringify(row));assert.equal(row.max,0,JSON.stringify(row));}
 }
}finally{await browser.close();await server.close();}
