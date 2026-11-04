import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='validation/mix-v179';fs.mkdirSync(out,{recursive:true});
const server=await createServer({cacheDir:'/tmp/solo-mix-reference',server:{host:'127.0.0.1',port:5796,strictPort:true}});
server.middlewares.use('/__reference',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html>');});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/workspace/scratch/e841b2ae644b/qa-tools/runtime/chromium'),args:['--no-sandbox','--disable-gpu']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5796/__reference');
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{drawStroke}=await import('/src/engine/renderer.ts'),{compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts');
  const make=(w=480,h=310)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const scene=both=>{const c=make(),ctx=c.getContext('2d');ctx.lineCap='round';ctx.lineWidth=110;ctx.strokeStyle='#e9a0ab';ctx.beginPath();ctx.moveTo(170,85);ctx.lineTo(170,225);ctx.stroke();if(both){ctx.strokeStyle='#aac438';ctx.beginPath();ctx.moveTo(300,85);ctx.lineTo(300,225);ctx.stroke();}return c;};
  const sheet=make(1460,90+4*335),sc=sheet.getContext('2d'),rows=[],images={};sc.fillStyle='white';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#17242e';sc.font='bold 22px sans-serif';sc.fillText('Actual brush output — pink/green Mixer Brush reference study',20,30);sc.font='16px sans-serif';sc.fillText('Input colours',20,65);sc.fillText('Pure Mix: existing pink + green',510,65);sc.fillText('Loaded Mix: green paint + pink pickup',995,65);
  for(const [index,presetId]of ['color-solid','soft-paint','color-texture','dry-ink-bristle'].entries()){
   const preset=stockPresets.find(p=>p.id===presetId),settings={...preset.settings,size:85,opacity:.95,flow:1,...(presetId==='color-solid'?{colorNib:'round'}:{})};
   const apply=(base,load)=>{
    for(let pass=0;pass<3;pass++){
     const id='reference-'+presetId+'-'+load+'-'+pass,stroke={...settings,...brushStrokeMetadata(settings),id,kind:'stroke',tool:'brush',pressure:true,color:'#aac438',nativeMixVersion:3,nativeMixAmount:.9,nativeMixRadius:.5,nativeMixPaintLoad:load,dryBristleSeed:watercolorSeedFor(id),colorSeed:watercolorSeedFor(id),points:Array.from({length:81},(_,i)=>({x:load?195+i*2.7:228+35*Math.sin(i/80*Math.PI*5+pass*.8),y:70+i*2.1,p:.4+.6*Math.sin(i/80*Math.PI),v:.65}))};
     const mask=make();drawStroke(mask.getContext('2d'),stroke);compositePaintStroke(base.getContext('2d'),mask,stroke,0,0,strokeRasterBounds(stroke,480,310));mask.width=mask.height=0;
    }return base;
   };
   const input=scene(true),pure=apply(scene(true),0),loaded=apply(scene(false),.75);images[presetId]={pure:pure.toDataURL(),loaded:loaded.toDataURL()};
   const bytes=loaded.getContext('2d').getImageData(0,0,480,310).data;let greenOnBarePaper=0,mixed=0;for(let y=40;y<280;y++)for(let x=110;x<430;x++){const i=(y*480+x)*4;if(x>250&&bytes[i+3]>10&&bytes[i+1]>bytes[i]+12)greenOnBarePaper++;if(x>180&&x<240&&bytes[i+3]>30&&bytes[i]>150&&bytes[i+1]>130&&bytes[i+2]<155)mixed++;}
   rows.push({preset:presetId,greenOnBarePaper,mixed});
   const y=90+index*335;sc.fillStyle='#f0f3f5';sc.fillRect(0,y,1460,335);sc.fillStyle='#17242e';sc.font='bold 17px sans-serif';sc.fillText(preset.name,20,y+22);for(const [i,c]of [input,pure,loaded].entries()){sc.fillStyle='white';sc.fillRect(5+i*487,y+25,480,305);sc.drawImage(c,5+i*487,y+25);}input.width=input.height=pure.width=pure.height=loaded.width=loaded.height=0;
  }return{rows,images,sheet:sheet.toDataURL()};
 });
 fs.writeFileSync(out+'/reference-study.png',Buffer.from(result.sheet.split(',')[1],'base64'));for(const [id,images]of Object.entries(result.images))for(const [kind,data]of Object.entries(images))fs.writeFileSync(`${out}/reference-${id}-${kind}.png`,Buffer.from(data.split(',')[1],'base64'));
 fs.writeFileSync(out+'/reference-results.json',JSON.stringify(result.rows,null,2));for(const row of result.rows){assert(row.greenOnBarePaper>0,JSON.stringify(row));assert(row.mixed>0,JSON.stringify(row));}console.log(result.rows);
}finally{await browser.close();await server.close();}
