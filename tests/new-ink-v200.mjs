import fs from 'node:fs';import assert from 'node:assert/strict';import {createServer} from 'vite';import {chromium} from '@playwright/test';
async function main(){const url='http://127.0.0.1:5798',server=await createServer({server:{host:'127.0.0.1',port:5798,strictPort:true}});await server.listen();let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--disable-gpu']});const page=await browser.newPage({viewport:{width:1500,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);page.on('dialog',d=>d.accept());
 const pen=await page.context().newCDPSession(page);
 async function drawPen(){const send=(type,i,force)=>pen.send('Input.dispatchMouseEvent',{type,x:35+i*3.8,y:180+45*Math.sin(i*.05),pointerType:'pen',button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1,force});
  await send('mousePressed',0,.2);for(let i=1;i<=140;i++){await send('mouseMoved',i,.12+.8*Math.sin(i/140*Math.PI*2)**2);if(i===80)await page.evaluate(()=>window.captureSettled());if(i>95)await page.evaluate(()=>window.checkSettled());}
  await page.evaluate(()=>window.captureFinalLive());await send('mouseReleased',140,0);
 }
 const rows=[];
 for(const id of ['studio-ink','contour-flow'])for(const size of [18,90]){
  await page.evaluate(async({id,size})=>{const {StudioEngine}=await import('/src/engine/StudioEngine.ts'),{DocumentStore}=await import('/src/core/history.ts'),{newProject}=await import('/src/core/model.ts'),{stockPresets}=await import('/src/core/brushes.ts');
   // Frequent pixel probes must not switch Chrome's raster backend mid-stroke.
   const canvas=document.createElement('canvas');canvas.getContext('2d',{willReadFrequently:true});canvas.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px;z-index:99999';document.body.append(canvas);const p=newProject('Ink check',640,480),e=new StudioEngine(canvas,new DocumentStore(p),()=>{});e.setView({x:0,y:0,zoom:1,rotation:0});e.setInput('brush',{...stockPresets.find(p=>p.id===id).settings,size});window.testInk={engine:e,canvas,changes:0};
   // Measure artwork inside the canvas rulers, excluding UI label antialiasing.
   const pixels=()=>canvas.getContext('2d').getImageData(30,80,210,170).data;window.captureSettled=async()=>{await new Promise(requestAnimationFrame);window.testInk.settled=pixels();window.testInk.geometry=window.testInk.engine.getInputState().preview.slice(0,40);window.testInk.diffs=[];};window.checkSettled=async()=>{await new Promise(requestAnimationFrame);const a=window.testInk.settled,b=pixels();let count=0,max=0,first=[];a.forEach((v,i)=>{if(v!==b[i]){count++;max=Math.max(max,Math.abs(v-b[i]));if(first.length<4)first.push({x:10+Math.floor(i/4)%210,y:80+Math.floor(i/(210*4)),old:v,next:b[i]});}});if(count){window.testInk.changes++;window.testInk.diffs.push({count,max,first,geometryEqual:JSON.stringify(window.testInk.geometry)===JSON.stringify(window.testInk.engine.getInputState().preview.slice(0,40))});}};window.captureFinalLive=async()=>{await new Promise(requestAnimationFrame);window.testInk.live=canvas.getContext('2d').getImageData(30,30,610,450).data;};
  },{id,size});
  await page.evaluate(()=>new Promise(requestAnimationFrame));await drawPen();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const result=await page.evaluate(async()=>{const {engine:e,canvas,changes,live}=window.testInk,p=e.store.getSnapshot(),s=p.layers.flatMap(l=>l.operations).at(-1);const current=canvas.getContext('2d').getImageData(30,30,610,450).data;const difference=(a,b)=>a.reduce((n,v,i)=>n+(v!==b[i]?1:0),0);const penUpDifference=difference(current,live),saved=JSON.parse(JSON.stringify(p));await e.load(saved);e.setView({x:0,y:0,zoom:1,rotation:0});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const replay=canvas.getContext('2d').getImageData(30,30,610,450).data;const row={kind:s.brushKind,size:s.size,revision:s.liveRefinementVersion,pressureRange:[Math.min(...s.points.map(p=>p.p)),Math.max(...s.points.map(p=>p.p))],settledChanges:changes,penUpDifference,reopenDifference:difference(current,replay),points:s.points.length};e.dispose();canvas.remove();return row;});rows.push(result);
 }

 const parity=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/src/core/paintTips.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{drawSolidInkV10}=await import('/src/engine/solidInkV10.ts');const rows=[];
  for(const id of ['studio-ink','contour-flow'])for(const size of [3,18,90])for(const minSize of [0,.035]){
   const settings=stockPresets.find(p=>p.id===id).settings,s={...settings,...brushStrokeMetadata(settings),id:'round',kind:'stroke',tool:'brush',pressure:true,size,minSize,points:Array.from({length:140},(_,i)=>({x:30+i*3,y:100+25*Math.sin(i*.1),p:Math.sin(i/139*Math.PI*2)**2}))},g=strokeGeometry(s);
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=480;a.height=b.height=220;
   const native=drawSolidInkV10(a.getContext('2d'),s,g),display=drawSolidInkV10(b.getContext('2d'),s,g,undefined,1),aa=a.getContext('2d').getImageData(0,0,480,220).data,bb=b.getContext('2d').getImageData(0,0,480,220).data;
   rows.push({id,size,minSize,native,display,different:aa.reduce((n,v,i)=>n+(v!==bb[i]?1:0),0)});
  }return rows;
 });
 assert(parity.every(r=>r.native&&r.display&&r.different===0),'Native export and display nib disagree');console.log('ROUND NIB PARITY',JSON.stringify(parity));
 console.log('PEN STABILITY',JSON.stringify(rows));assert(rows.every(r=>r.revision===3&&r.points>100&&r.pressureRange[0]<.2&&r.pressureRange[1]>.8&&r.settledChanges===0&&r.penUpDifference===0&&r.reopenDifference===0));
 const sample=await page.evaluate(async()=>{const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/src/core/paintTips.ts'),{drawModernStroke}=await import('/src/engine/brushRaster.ts');const c=document.createElement('canvas');c.width=1200;c.height=690;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#14262c';ctx.fillRect(0,0,c.width,70);ctx.fillStyle='#e4f2ef';ctx.font='22px Segoe UI';ctx.fillText('SOLO ANIME STUDIO · ACTUAL BRUSH RENDER',28,44);
  for(const [j,id]of ['studio-ink','contour-flow'].entries()){const preset=stockPresets.find(p=>p.id===id),settings=preset.settings,x=30+j*600;ctx.fillStyle='#21383e';ctx.font='bold 24px Segoe UI';ctx.fillText(preset.name,x,112);ctx.font='14px Segoe UI';ctx.fillStyle='#5a7378';ctx.fillText(j?'Stronger thin–thick pressure passages':'Gentle round ink and longer taper',x,138);
   for(let row=0;row<3;row++){const points=Array.from({length:180},(_,i)=>{const t=i/179;return {x:x+12+t*515,y:230+row*165-45*Math.sin(t*Math.PI*(row===1?4:2)),p:.12+.82*Math.sin(t*Math.PI*2)**2};});const s={...settings,...brushStrokeMetadata(settings),kind:'stroke',tool:'brush',id:id+row,pressure:true,size:row===2?10:24,color:'#242c30',captureZoom:1,points};drawModernStroke(ctx,s);}
  }ctx.font='13px Segoe UI';ctx.fillStyle='#657b80';ctx.fillText('Same simulated pen path and pressure pulses · rendered by Studio, not image generation',28,674);return c.toDataURL();});fs.mkdirSync('validation',{recursive:true});fs.writeFileSync('validation/desktop-new-ink-v200.png',Buffer.from(sample.split(',')[1],'base64'));
 await page.getByLabel('Brush category',{exact:true}).selectOption('Ink');for(const id of ['studio-ink','contour-flow']){await page.getByLabel('Brush preset',{exact:true}).selectOption(id);assert(await page.getByText('Automatic thin–thick–thin passages work with steady pen pressure or a mouse.',{exact:false}).count());}
 await page.reload();await page.waitForFunction(()=>document.querySelector('[aria-label="Brush preset"]')?.value==='contour-flow');
 fs.writeFileSync('validation/desktop-new-ink-v200.json',JSON.stringify({rows,parity,errors,libraryRestored:true},null,2));
 assert.deepEqual(errors,[]);console.log('Both new Ink brushes selectable and restored; actual renderer sample saved');
}finally{await browser?.close();await server.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});

