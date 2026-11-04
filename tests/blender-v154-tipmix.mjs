import {createServer} from 'vite';import {chromium} from '@playwright/test';
import fs from 'node:fs';import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5544,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5544/exp/h.html');await page.waitForFunction(()=>window.H);
 const rows=await page.evaluate(async()=>{
  const {stockPresets,newBrushLibrary,restoreBrushLibrary}=await import('/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/src/core/paintTips.ts'),{newProject,activeLayer,validateProject}=await import('/src/core/model.ts'),{drawStroke}=await import('/src/engine/renderer.ts');
  const rows=[],hash=async c=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const render=s=>{const c=document.createElement('canvas');c.width=720;c.height=260;drawStroke(c.getContext('2d'),s);return c;};
  for(const original of ['round','bristle','flat-bristle']){
   const b={...stockPresets.find(p=>p.id==='paint').settings,brushTip:original,size:85,opacity:1,pressure:false,flow:.65,tipAngle:27,textureStrength:.2,mixTipA:'soft-round',mixTipB:'flat-bristle'};
   const s=t=>({...b,...brushStrokeMetadata({...b,mixBlend:t}),id:'tip-mix-'+original,kind:'stroke',tool:'brush',captureZoom:1,smoothness:0,stabilization:0,taperStart:0,taperEnd:0,points:Array.from({length:121},(_,i)=>({x:80+i*4.5,y:130+38*Math.sin(i/120*Math.PI*2),p:.2+.8*Math.sin(i/120*Math.PI),v:.65}))});
   const zero=s(0),half=s(.5),full=s(1),project=newProject('mixed nib saved',720,260);activeLayer(project).operations=[half];const reload=activeLayer(validateProject(JSON.parse(JSON.stringify(project)))).operations[0];
   const library=newBrushLibrary(),preset=library.presets.find(p=>p.id==='paint');preset.settings={...b,mixBlend:.5};const restored=restoreBrushLibrary(JSON.parse(JSON.stringify(library))).presets.find(p=>p.id==='paint').settings;
   const a=render(zero),h=render(half),z=render(full);rows.push({original,zero:await hash(a),half:await hash(h),full:await hash(z),reload:await hash(render(reload)),restored:{mixTipA:restored.mixTipA,mixTipB:restored.mixTipB,mixBlend:restored.mixBlend},pngs:[a.toDataURL(),h.toDataURL(),z.toDataURL()]});
  }return rows;
 });
 for(const r of rows){assert.notEqual(r.zero,r.half);assert.notEqual(r.half,r.full);assert.equal(r.half,r.reload);assert.deepEqual(r.restored,{mixTipA:'soft-round',mixTipB:'flat-bristle',mixBlend:.5});r.pngs.forEach((png,i)=>fs.writeFileSync(`validation/v154-tipmix-${r.original}-${i*50}.png`,Buffer.from(png.split(',')[1],'base64')));delete r.pngs;}
 fs.writeFileSync('validation/v154-tipmix.json',JSON.stringify(rows,null,2));console.log('3/3 actual Canvas strokes: Blend 0/50/100 differ; project replay and preset restore PASS.');
}finally{await browser.close();await server.close();}
