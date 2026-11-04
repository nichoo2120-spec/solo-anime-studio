import {createServer} from '../node_modules/vite/dist/node/index.js';
import {chromium} from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd(),baseline=path.resolve(process.argv[2]??'../studio131');
if(!fs.existsSync(baseline+'/src/engine/brushRaster.ts'))throw Error('Pass the extracted v0.5.131 project directory as the first argument.');
const server=await createServer({root,server:{host:'127.0.0.1',port:5414,strictPort:true,fs:{allow:[root,baseline]}}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5414');const rows=await page.evaluate(async baseline=>{
 const {stockPresets}=await import('/@fs/'+baseline+'/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/@fs/'+baseline+'/src/core/paintTips.ts'),old=await import('/@fs/'+baseline+'/src/engine/brushRaster.ts'),now=await import('/src/engine/brushRaster.ts'),rows=[];
 for(const p of stockPresets)for(const pressure of [false,true]){
  const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=700;a.height=b.height=320;
  const s={...p.settings,...brushStrokeMetadata(p.settings),id:p.id,kind:'stroke',tool:p.category==='Eraser'?'eraser':'brush',size:95,pressure,points:Array.from({length:151},(_,i)=>({x:60+i*3.8,y:160+80*Math.sin(i/150*Math.PI*3),p:.1+.9*Math.sin(i/150*Math.PI)**2}))};
  old.drawModernStroke(a.getContext('2d'),s);now.drawModernStroke(b.getContext('2d'),JSON.parse(JSON.stringify(s)));const x=a.getContext('2d').getImageData(0,0,700,320).data,y=b.getContext('2d').getImageData(0,0,700,320).data;let max=0;for(let i=0;i<x.length;i++)max=Math.max(max,Math.abs(x[i]-y[i]));rows.push({id:p.id,pressure,max});
 }return rows;
},baseline);fs.writeFileSync('validation/compatibility132.json',JSON.stringify(rows,null,2));assert(rows.every(v=>v.max===0));console.log('48 historical watercolor/other brush/eraser fixtures: exact RGBA equality');
}finally{await browser.close();await server.close();}
