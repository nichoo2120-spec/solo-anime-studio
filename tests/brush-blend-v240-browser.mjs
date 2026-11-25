// v0.5.240 Blend mode on every paint brush: real-browser render sheet, real
// LiveBlendWorker live/final parity, all-layers sample, carry and protect alpha.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.'),out=path.join(root,'validation','brush-blend-v240');fs.mkdirSync(out,{recursive:true});
const port=5840;
const server=await createServer({root,logLevel:'error',cacheDir:'/tmp/solo-blend-v240-vite',server:{host:'127.0.0.1',port,strictPort:true}});
server.middlewares.use('/__blendqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Blend QA</title>');});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-gpu']});
let failed=false;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/__blendqa`);
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {compositePaintStroke}=await import('/src/engine/paintCompositing.ts');
  const {drawStroke}=await import('/src/engine/renderer.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const {registerBlendSample,sampleFromCanvas,setLiveBlendSample,encodeCarry}=await import('/src/engine/brushBlend.ts');
  const W=760,H=220,make=(w=W,h=H)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const scene=()=>{const c=make(),x=c.getContext('2d');x.fillStyle='#e8243a';x.fillRect(20,30,180,160);x.fillStyle='#f2c230';x.fillRect(200,30,170,160);x.fillStyle='#1f5bd8';x.fillRect(370,30,190,160);
   const g=x.createLinearGradient(560,0,740,0);g.addColorStop(0,'rgba(40,180,120,1)');g.addColorStop(1,'rgba(40,180,120,0)');x.fillStyle=g;x.fillRect(560,30,180,160);
   x.strokeStyle='#111';x.lineWidth=3;for(let i=0;i<6;i++){x.beginPath();x.moveTo(40+i*110,40);x.lineTo(90+i*110,180);x.stroke();}return c;};
  const pts=(L=160)=>Array.from({length:L},(_,i)=>{const t=i/(L-1);return {x:40+t*680,y:110+45*Math.sin(t*Math.PI*3),p:.35+.65*Math.sin(t*Math.PI)};});
  // v0.5.240 recipe (brushBlendVersion 1) stays frozen; v2 is tested in brush-blend-v242-browser.mjs
  const strokeFor=(id,extra={},blend={})=>{const preset=stockPresets.find(p=>p.id===id);const settings={...preset.settings,bbEnabled:true,...blend};const {bbStyle:_st,...meta}=brushStrokeMetadata(settings);for(const key of ['bbMode','bbColorCarry','bbSoftness','bbTextureKeep','bbSmoothing','bbEdgeDarkness'])delete meta[key];return {...settings,...meta,brushBlendVersion:1,id:'blend-qa-'+id,kind:'stroke',tool:'brush',color:'#00ff00',size:46,opacity:1,pressure:true,response:1,points:pts(),...extra};};
  // Reload path exactly as LayerRenderer replays a stroke.
  const reload=(s,base)=>{const res=make();const ctx=res.getContext('2d');ctx.drawImage(base,0,0);const mask=make();drawStroke(mask.getContext('2d'),s);compositePaintStroke(ctx,mask,s);return res;};
  const brushes=['hb','g-pen','soft-paint','paint','marker','dry','water-wet','color-air','color-texture'];
  const sheet=make(1540,70+brushes.length*240+3*240),sc=sheet.getContext('2d');sc.fillStyle='#1b252b';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#e6eef2';sc.font='bold 22px sans-serif';sc.fillText('Blend mode v0.5.240 — before (left) / after (right); brush colour is pure green and must never appear',20,36);
  const draw=(label,base,res,row)=>{const y=60+row*240;sc.fillStyle='#e6eef2';sc.font='16px sans-serif';sc.fillText(label,20,y+12);sc.fillStyle='#fff';sc.fillRect(10,y+18,W,H);sc.drawImage(base,10,y+18);sc.fillRect(780,y+18,W,H);sc.drawImage(res,780,y+18);};
  const diffCount=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;};
  const rows=[];let row=0;const data=c=>c.getContext('2d').getImageData(0,0,W,H).data;
  for(const id of brushes){
   const s=strokeFor(id),base=scene(),before=data(base);const t=performance.now();const res=reload(s,base);const ms=performance.now()-t;const after=data(res);
   let changed=0,green=0,grey=0;for(let i=0;i<after.length;i+=4){const touched=after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2]||after[i+3]!==before[i+3];if(touched)changed++;if(after[i+3]>20&&after[i+1]>Math.max(after[i],after[i+2])+90&&before[i+3]<5)green++;const x=(i/4)%W;if(touched&&x>660&&after[i+3]>8&&after[i+3]<250&&(after[i]+after[i+1]+after[i+2])<120)grey++;}
   draw(id+' (Blend)',base,res,row++);rows.push({id,brushKind:s.brushKind,changed,green,grey,ms:+ms.toFixed(1),version:s.brushBlendVersion});
  }
  // Settings change the result.
  const settingRows=[];
  {const base=scene(),ref=data(reload(strokeFor('soft-paint'),base));
   for(const [k,v] of [['bbAmount',.3],['bbPickup',1],['bbWetness',1],['bbMix',0],['bbFlow',.2],['bbStretch',0],['bbPaintLoad',.5],['bbPressure',false]]){const r=data(reload(strokeFor('soft-paint',{},{[k]:v}),base));settingRows.push({k,v,diff:diffCount(ref,r)});}}
  // Protect transparency: no pixel that was fully transparent gains alpha.
  let protectedGain=0;{const s=strokeFor('soft-paint',{},{bbProtectAlpha:true,bbPaintLoad:.4}),base=scene(),b=data(base),a=data(reload(s,base));for(let i=3;i<a.length;i+=4)if(b[i]===0&&a[i]!==0)protectedGain++;draw('Protect transparency + 40% paint load',base,reload(s,base),row++);}
  // All layers: a lower layer (blue) is picked up into an empty upper layer.
  let allLayers={};{const lower=make(),lx=lower.getContext('2d');lx.fillStyle='#ffffff';lx.fillRect(0,0,W,H);lx.fillStyle='#1f5bd8';lx.fillRect(0,0,W/2,H);lx.fillStyle='#e8243a';lx.fillRect(W/2,0,W/2,H);
   const upper=make();const sample=sampleFromCanvas(lower,{x:0,y:0,width:W,height:H});const sOnly=strokeFor('soft-paint',{id:'all-1'},{bbSample:'all'});
   // crop + PNG round trip exactly as StudioEngine does at pen-up
   const crop=make(W,H);crop.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(sample.data),W,H),0,0);const png=crop.toDataURL('image/png');registerBlendSample(png,{...sample});
   const s={...sOnly,bbSamplePng:png,bbSampleRect:{x:0,y:0,width:W,height:H}};setLiveBlendSample(undefined);
   const res=reload(s,upper),d=data(res);let picked=0,green=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>20)picked++;if(d[i+3]>20&&d[i+1]>Math.max(d[i],d[i+2])+90)green++;}
   const layerOnly=data(reload(sOnly,upper));let layerPicked=0;for(let i=3;i<layerOnly.length;i+=4)if(layerOnly[i]>0)layerPicked++;
   // the PNG decodes back to the identical bytes (renderer.prepare path)
   const img=new Image();img.src=png;await img.decode();const dc=make();dc.getContext('2d').drawImage(img,0,0);const round=diffCount(dc.getContext('2d').getImageData(0,0,W,H).data,sample.data);
   const show=make();show.getContext('2d').drawImage(lower,0,0);show.getContext('2d').drawImage(res,0,0);draw('All layers: empty upper layer picks up the lower layer',lower,res,row++);
   allLayers={picked,green,layerPicked,pngRoundTripDiff:round};}
  // Clean off: carried colour from the previous stroke end seeds the brush.
  let carry={};{const base=scene(),c=encodeCarry(base,300,110,23);const clean=data(reload(strokeFor('soft-paint',{id:'c1'},{bbClean:true}),base)),dirty=reload(strokeFor('soft-paint',{id:'c1',bbCarry:c},{bbClean:false}),base);carry={diff:diffCount(clean,data(dirty)),len:c.length};draw('Clean brush off (carries yellow from last stroke)',base,dirty,row++);}
  // Real worker: incremental live pieces vs the canonical one-pass reload.
  const workerRows=[],workerErrors=[];let waiting;const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...a){super(...a);this.addEventListener('message',e=>{if(e.data?.error)workerErrors.push(e.data.error);});}};
  const worker=new LiveBlendWorker(()=>{waiting?.();waiting=undefined;});
  const cases=[...['hb','soft-paint','paint','water-wet','color-air','dry'].map(id=>({id})),{id:'soft-paint',blend:{bbSample:'all'},all:true},{id:'paint',blend:{bbProtectAlpha:true,bbPaintLoad:.3}}];
  for(const c of cases){
   let s=strokeFor(c.id,{id:'blend-worker-'+c.id+(c.all?'-all':'')},c.blend??{}),base=scene();
   try{
    let page;if(c.all){const lower=make(),lx=lower.getContext('2d');lx.fillStyle='#fff';lx.fillRect(0,0,W,H);lx.drawImage(base,0,0);page=sampleFromCanvas(lower,{x:0,y:0,width:W,height:H});worker.blendSample=page;}else worker.blendSample=undefined;
    for(const n of [1,10,40,41,90,160,160])await Promise.race([new Promise(r=>{waiting=r;worker.preview({...s,points:s.points.slice(0,n)},base,{n});}),new Promise((_,rej)=>setTimeout(()=>rej(Error('no preview')),8000))]);
    if(c.all){const crop=make(W,H);crop.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(page.data),W,H),0,0);const png=crop.toDataURL('image/png');registerBlendSample(png,{...page});s={...s,bbSamplePng:png,bbSampleRect:{x:0,y:0,width:W,height:H}};}
    const pending=worker.finish(s);if(!pending)throw Error('worker unavailable');const live=await pending.done;if(!live)throw Error('final failed');
    const a=data(reload(s,base)),b=live.getContext('2d').getImageData(0,0,W,H).data;let max=0,diff=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){diff++;max=Math.max(max,d);}}
    workerRows.push({id:c.id,all:!!c.all,max,diff});
   }catch(e){workerRows.push({id:c.id,error:String(e)});}finally{worker.cancel();}
  }
  worker.dispose();window.Worker=NativeWorker;
  return {rows,settingRows,protectedGain,allLayers,carry,workerRows,workerErrors,sheet:sheet.toDataURL()};
 });
 fs.writeFileSync(path.join(out,'blend-sheet.png'),Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
 result.errors=errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,1));
 for(const r of result.rows){assert.equal(r.version,1,r.id+' metadata');assert(r.changed>3000,r.id+' blended');assert.equal(r.green,0,r.id+' must not add the brush colour');assert.equal(r.grey,0,r.id+' grey/dark halo');}
 for(const r of result.settingRows)assert(r.diff>500,r.k+' changes the blend');
 assert.equal(result.protectedGain,0,'protect transparency');
 assert(result.allLayers.picked>3000,'all layers picks up lower layer');assert.equal(result.allLayers.layerPicked,0,'current layer only: empty layer stays empty');assert.equal(result.allLayers.green,0);assert.equal(result.allLayers.pngRoundTripDiff,0,'png round trip');
 assert(result.carry.diff>500,'carry changes the start of the stroke');
 for(const r of result.workerRows){assert(!r.error,r.id+': '+r.error);assert.equal(r.diff,0,r.id+(r.all?' (all layers)':'')+' live/final parity');}
 assert.equal(result.workerErrors.length,0,result.workerErrors.join('\n'));assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS brush-blend-v240-browser');
}catch(e){failed=true;console.error(e);}finally{await browser.close();await server.close();}
process.exitCode=failed?1:0;
