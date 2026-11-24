// v0.5.239: visual sheet — the real watercolor brush (Soft Wet Watercolor) next to
// Silk Wet v1 (v0.5.238) and Silk Wet v2 (watercolor) blending the same paint.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('.'),out=path.join(root,'validation','silk-v239');fs.mkdirSync(out,{recursive:true});
const server=await createServer({root,logLevel:'error',cacheDir:'/tmp/solo-silk-v239-vite',server:{host:'127.0.0.1',port:5839,strictPort:true}});
server.middlewares.use('/__silkqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Silk QA</title>');});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5839/__silkqa');
 const png=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {compositePaintStroke}=await import('/src/engine/paintCompositing.ts');const {drawStroke}=await import('/src/engine/renderer.ts');
  const W=720,H=230,make=(w=W,h=H)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const preset=id=>stockPresets.find(p=>p.id===id).settings;
  const paint=(ctx,id,color,points,extra={})=>{const st={...preset(id),...brushStrokeMetadata(preset(id)),id:'v-'+color+points[0].y,kind:'stroke',tool:'brush',color,pressure:true,response:1,points,...extra};const m=make();m.getContext('2d');if(st.silkBlendVersion){compositePaintStroke(ctx,m,st);return;}drawStroke(m.getContext('2d'),st);compositePaintStroke(ctx,m,st);};
  const line=(x0,x1,y,a=0,n=120)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:x0+(x1-x0)*t,y:y+Math.sin(t*Math.PI*2)*a,p:.35+.65*Math.sin(t*Math.PI)};});
  // Base paint: three opaque colour blocks
  const blocks=c=>{const x=c.getContext('2d');x.fillStyle='#d8263c';x.fillRect(20,30,220,170);x.fillStyle='#f0bf2c';x.fillRect(240,30,220,170);x.fillStyle='#2257c9';x.fillRect(460,30,220,170);return c;};
  const sheet=make(1480,60+4*260),sc=sheet.getContext('2d');sc.fillStyle='#1b252b';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#e6eef2';sc.font='bold 22px sans-serif';sc.fillText('v0.5.239 Silk Wet = watercolor blending (layer on white)',20,36);
  const put=(c,col,row,label)=>{const t=make();const x=t.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.drawImage(c,0,0);sc.drawImage(t,20+col*740,60+row*260+20);sc.fillStyle='#cfd8dc';sc.font='15px sans-serif';sc.fillText(label,20+col*740,60+row*260+14);};
  const silk=(c,version,extra={})=>{const s=preset('silk-blend'),settings={...s,silkMode:'wet',silkWetness:.75,silkStrength:.7,silkPickup:.45,...extra};const st={...settings,...brushStrokeMetadata(settings),silkBlendVersion:version,id:'silk-'+version,kind:'stroke',tool:'brush',color:'#00ff00',size:70,opacity:1,pressure:true,response:1,points:line(40,680,115,40)};compositePaintStroke(c.getContext('2d'),make(),st);return c;};
  // row 0: the real watercolor brush reference (Soft Wet Watercolor, overlapping strokes)
  const ref=make();paint(ref.getContext('2d'),'water-wet','#d8263c',line(40,420,90,20));paint(ref.getContext('2d'),'water-wet','#2257c9',line(300,680,140,-20));paint(ref.getContext('2d'),'water-wet','#f0bf2c',line(200,520,115,30));put(ref,0,0,'Reference: our Soft Wet Watercolor brush (3 overlapping strokes)');
  const refBlend=make();paint(refBlend.getContext('2d'),'water-wet','#d8263c',line(40,420,90,20));paint(refBlend.getContext('2d'),'water-wet','#2257c9',line(300,680,140,-20));paint(refBlend.getContext('2d'),'water-wet','#f0bf2c',line(200,520,115,30));silk(refBlend,2);put(refBlend,1,0,'Same watercolor paint + Silk Wet (new): blends it as watercolor');
  put(blocks(make()),0,1,'Before: flat colour blocks');put(silk(blocks(make()),2),1,1,'Silk Wet NEW (v2, watercolor)');
  put(silk(blocks(make()),1),0,2,'Silk Wet OLD (v1, v0.5.238) — saved strokes still look like this');put(silk(blocks(make()),2,{silkTexture:.7}),1,2,'Silk Wet NEW with Texture 70% (granulation)');
  const glaze=c=>{const x=c.getContext('2d');x.fillStyle='rgba(216,38,60,.55)';x.fillRect(40,40,300,150);x.fillStyle='rgba(34,87,201,.55)';x.fillRect(260,60,300,140);return c;};
  put(silk(glaze(make()),1),0,3,'Transparent glazes + Silk Wet OLD');put(silk(glaze(make()),2),1,3,'Transparent glazes + Silk Wet NEW');
  return sheet.toDataURL('image/png');
 });
 fs.writeFileSync(path.join(out,'silk-wet-watercolor.png'),Buffer.from(png.split(',')[1],'base64'));
 if(errors.length)throw Error(errors.join('\n'));console.log('SILK WET V239 VISUAL written');
}finally{await browser.close();await server.close();}
