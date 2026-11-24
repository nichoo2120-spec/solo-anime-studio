// v0.5.238 Silk Blend: real-browser render sheet + real LiveBlendWorker live/final parity.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.'),out=path.join(root,'validation','silk-v238');fs.mkdirSync(out,{recursive:true});
const server=await createServer({root,logLevel:'error',cacheDir:'/tmp/solo-silk-v238-vite',server:{host:'127.0.0.1',port:5838,strictPort:true}});
server.middlewares.use('/__silkqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Silk Blend QA</title>');});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-gpu']});
let failed=false;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5838/__silkqa');
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const silk=stockPresets.find(p=>p.id==='silk-blend');
  const W=760,H=220,make=(w=W,h=H)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const scene=()=>{const c=make(),x=c.getContext('2d');x.fillStyle='#e8243a';x.fillRect(20,30,180,160);x.fillStyle='#f2c230';x.fillRect(200,30,170,160);x.fillStyle='#1f5bd8';x.fillRect(370,30,190,160);
   const g=x.createLinearGradient(560,0,740,0);g.addColorStop(0,'rgba(40,180,120,1)');g.addColorStop(1,'rgba(40,180,120,0)');x.fillStyle=g;x.fillRect(560,30,180,160);
   x.strokeStyle='#111';x.lineWidth=3;for(let i=0;i<6;i++){x.beginPath();x.moveTo(40+i*110,40);x.lineTo(90+i*110,180);x.stroke();}return c;};
  const pts=(n=160,fast=false)=>{const L=fast?9:n;return Array.from({length:L},(_,i)=>{const t=i/(L-1);return {x:40+t*680,y:110+45*Math.sin(t*Math.PI*3),p:.35+.65*Math.sin(t*Math.PI)};});};
  const strokeFor=(mode,extra={})=>{const settings={...silk.settings,silkMode:mode,silkTexture:mode==='dry'?.65:0,silkWetness:mode==='wet'?.75:mode==='smudge'?.5:silk.settings.silkWetness};return {...settings,...brushStrokeMetadata(settings),id:'silk-qa-'+mode,kind:'stroke',tool:'brush',color:'#00ff00',size:56,opacity:1,pressure:true,response:1,points:pts(),...extra};};
  const modes=['soft','wet','smudge','dry'],rows=[];
  const sheet=make(1540,70+(modes.length+1)*240),sc=sheet.getContext('2d');sc.fillStyle='#1b252b';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#e6eef2';sc.font='bold 22px sans-serif';sc.fillText('Silk Blend v0.5.238 — before (left) / after (right), layer on white',20,36);
  const checker=(x,y,w,h)=>{sc.fillStyle='#fff';sc.fillRect(x,y,w,h);};
  const draw=(label,base,res,row)=>{const y=60+row*240;sc.fillStyle='#e6eef2';sc.font='16px sans-serif';sc.fillText(label,20,y+12);checker(10,y+18,W,H);sc.drawImage(base,10,y+18);checker(780,y+18,W,H);sc.drawImage(res,780,y+18);};
  let row=0;
  for(const mode of [...modes,'fast']){
   const s=mode==='fast'?strokeFor('soft',{id:'silk-qa-fast',points:pts(0,true)}):strokeFor(mode);
   const base=scene(),res=scene(),ctx=res.getContext('2d'),before=ctx.getImageData(0,0,W,H).data;
   const t=performance.now();compositePaintStroke(ctx,res,s);const ms=performance.now()-t;
   const after=ctx.getImageData(0,0,W,H).data;let changed=0,green=0,grey=0;
   for(let i=0;i<after.length;i+=4){if(after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2]||after[i+3]!==before[i+3])changed++;if(after[i+3]>20&&after[i+1]>Math.max(after[i],after[i+2])+60&&before[i+3]===0)green++;
    // Halo check inside the transparent fade: unpremultiplied colour must stay the green paint's hue, never grey/dark.
    const x=(i/4)%W;const touched=after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2]||after[i+3]!==before[i+3];if(touched&&x>660&&after[i+3]>8&&after[i+3]<250&&(after[i]+after[i+1]+after[i+2])<200)grey++;}
   draw(mode==='fast'?'Fast stroke (9 points, ~85 px apart), Soft':mode[0].toUpperCase()+mode.slice(1),base,res,row++);
   rows.push({mode,changed,green,grey,ms:+ms.toFixed(1)});
  }
  // Real worker: incremental live pieces vs the canonical one-pass reload.
  const workerRows=[],workerErrors=[];let waiting;const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...a){super(...a);this.addEventListener('message',e=>{if(e.data?.error)workerErrors.push(e.data.error);});}};
  const worker=new LiveBlendWorker(()=>{waiting?.();waiting=undefined;});
  for(const mode of modes){
   const s=strokeFor(mode,{id:'silk-worker-'+mode}),base=scene();
   try{
    for(const n of [1,10,40,41,90,160,160])await Promise.race([new Promise(r=>{waiting=r;worker.preview({...s,points:s.points.slice(0,n)},base,{n});}),new Promise((_,rej)=>setTimeout(()=>rej(Error('no preview')),8000))]);
    const pending=worker.finish(s);if(!pending)throw Error('worker unavailable');const live=await pending.done;if(!live)throw Error('final failed');
    const exp=scene();compositePaintStroke(exp.getContext('2d'),exp,s,0,0,strokeRasterBounds(s,W,H));
    const a=exp.getContext('2d').getImageData(0,0,W,H).data,b=live.getContext('2d').getImageData(0,0,W,H).data;let max=0,diff=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){diff++;max=Math.max(max,d);}}
    workerRows.push({mode,max,diff});
   }catch(e){workerRows.push({mode,error:String(e)});}finally{worker.cancel();}
  }
  worker.dispose();window.Worker=NativeWorker;
  return {rows,workerRows,workerErrors,sheet:sheet.toDataURL()};
 });
 fs.writeFileSync(path.join(out,'silk-sheet.png'),Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
 result.errors=errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,1));
 for(const r of result.rows){assert(r.changed>3000,r.mode+' blended');assert.equal(r.green,0,r.mode+' must not add the brush colour on empty paper');assert.equal(r.grey,0,r.mode+' grey/dark halo');}
 for(const r of result.workerRows){assert(!r.error,r.mode+': '+r.error);assert.equal(r.diff,0,r.mode+' live/final parity');}
 assert.equal(result.workerErrors.length,0);assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS silk-v238-browser');
}catch(e){failed=true;console.error(e);}finally{await browser.close();await server.close();}
process.exitCode=failed?1:0;
