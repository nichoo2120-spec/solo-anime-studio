import {createServer} from '../node_modules/vite/dist/node/index.js';
import {chromium} from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),baseline=path.resolve('../baseline142'),server=await createServer({root,server:{host:'127.0.0.1',port:5491,strictPort:true,fs:{allow:[root,baseline]}}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5491');const rows=await page.evaluate(async baseline=>{
 const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{LiveStrokeRaster}=await import('/src/engine/liveRaster.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{LiveStrokeRaster:OldRaster}=await import('/@fs/'+baseline+'/src/engine/liveRaster.ts');
 const rows=[];for(const preset of stockPresets.filter(p=>p.family==='watercolor'))for(const size of [85,150,500])for(const version of [142,143]){
  const c=document.createElement('canvas');c.width=1920;c.height=1080;const ctx=c.getContext('2d'),r=version===142?new OldRaster():new LiveStrokeRaster(),s={...preset.settings,...brushStrokeMetadata(preset.settings),watercolorAppearanceVersion:version===143?1:undefined,id:'performance-'+preset.id,kind:'stroke',tool:'brush',size,pressure:true,color:'#126db2',watercolorSeed:watercolorSeedFor('performance-'+preset.id),points:[]},times=[];
  for(let i=0;i<=400;i++){s.points.push({x:230+i*3.5,y:540+140*Math.sin(i/400*Math.PI*5),p:.2+.8*Math.sin(i/400*Math.PI)**2,v:.65});if(i%20)continue;const g=strokeGeometry(s,'live'),start=performance.now();r.paint(ctx,s,g);ctx.getImageData(0,0,1,1);times.push(performance.now()-start);}
  const warm=times.slice(5).sort((a,b)=>a-b);rows.push({preset:preset.id,size,version,mean:warm.reduce((a,b)=>a+b,0)/warm.length,p95:warm[Math.floor(warm.length*.95)],max:Math.max(...warm),times});r.reset();
 }return rows;
},baseline);fs.writeFileSync('validation/v143-watercolor-performance.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(({times,...r})=>r),null,2));}finally{await browser.close();await server.close();}
