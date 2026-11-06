import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

export async function verifyOffscreenDrawing(page,extension='ts'){
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.waitForFunction(()=>window.soloStrokeDiagnostics);
 const parity=await page.evaluate(async extension=>{
  const {SparseStrokeTiles}=await import(`/src/engine/SparseStrokeTiles.${extension}`);
  const {stockPresets}=await import(`/src/core/brushes.${extension}`);
  const {brushStrokeMetadata}=await import(`/src/core/paintTips.${extension}`);
  const region={x:-1200,y:-80,width:640,height:360};
  const context=()=>{
   const canvas=Object.assign(document.createElement('canvas'),{width:region.width,height:region.height});
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.translate(-region.x,-region.y);return ctx;
  };
  const makeStroke=(id,kind,y)=>{
   const s=stockPresets.find(p=>p.settings.brushKind===kind).settings;
   return {...s,...brushStrokeMetadata(s),id,kind:'stroke',tool:kind==='eraser-hard'?'eraser':'brush',
    color:'#486998',opacity:.8,pressure:true,size:46,points:Array.from({length:25},(_,i)=>({x:-1160+i*22,y:y+Math.sin(i*.4)*18,p:.85,v:.65}))};
  };
  const paint=makeStroke('finished','coloring-soft',80),stroke=makeStroke('preview','graphite-hb',92),erase=makeStroke('erase','eraser-hard',83);
  const grid=new SparseStrokeTiles(),stable=context(),preview=context(),final=context();
  const render=(ctx,live)=>{ctx.clearRect(region.x,region.y,region.width,region.height);grid.paint(ctx,region,live);};
  const pixels=ctx=>ctx.getImageData(0,0,region.width,region.height).data;
  const equal=(a,b)=>a.every((byte,i)=>byte===b[i]);
  grid.synchronize([paint]);render(stable);
  let finishedRepaints=0;
  const entry=grid.paintEntry.bind(grid);
  grid.paintEntry=(ctx,tile,job)=>{if(job.stroke===paint)finishedRepaints++;entry(ctx,tile,job);};
  for(let count=3;count<=stroke.points.length;count+=2)render(preview,{...stroke,points:stroke.points.slice(0,count)});
  const changed= !equal(pixels(preview),pixels(stable));
  render(final);
  const previewLeavesBaseAlone=equal(pixels(final),pixels(stable));
  grid.synchronize([paint,stroke]);render(final);
  const commitMatches=equal(pixels(preview),pixels(final));
  const pixelsBeforeEraser=pixels(final);
  render(preview,erase);
  grid.synchronize([paint,stroke,erase]);render(final);
  const eraseMatches=equal(pixels(preview),pixels(final));
  const eraserRemovedInk=pixels(preview).some((byte,i)=>i%4===3&&byte<pixelsBeforeEraser[i]);
  grid.dispose();
  return {changed,previewLeavesBaseAlone,commitMatches,eraseMatches,eraserRemovedInk,finishedRepaints};
 },extension);
 assert.deepEqual(parity,{changed:true,previewLeavesBaseAlone:true,commitMatches:true,eraseMatches:true,eraserRemovedInk:true,finishedRepaints:0});

 const project={format:'solo-anime-studio',version:3,id:'offscreen-perf-fixture',name:'Offscreen latency fixture',width:1920,height:1080,
  activeLayerId:'ink',layers:[{id:'ink',name:'Ink',visible:true,locked:false,opacity:1,operations:[]}],settings:{guides:false},createdAt:'2026-11-06T00:00:00.000Z'};
 await page.locator('input[accept=".json,.solo.json"]').setInputFiles({name:'offscreen.solo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.locator('.document-tab').filter({hasText:project.name}).waitFor();
 const button=name=>page.getByRole('button',{name,exact:true});
 const canvas=page.getByLabel('Drawing canvas',{exact:true}),zoom=page.getByLabel('Canvas zoom');
 await button('Show Outside Frame').click();await button('Frame Only').waitFor();
 await zoom.selectOption('5');
 const box=await canvas.boundingBox();
 for(let i=0;i<2;i++){
  await canvas.focus();await page.mouse.move(box.x+box.width*.48,box.y+box.height*.5);
  await page.keyboard.down('Space');await page.mouse.down();
  await page.mouse.move(box.x+box.width*.92,box.y+box.height*.5,{steps:10});await page.mouse.up();await page.keyboard.up('Space');
 }
 const frame=page.locator('.scene-camera-overlay .camera-frame');
 assert(await frame.evaluate((node,width)=>node.getAttribute('points').split(' ').every(pair=>Number(pair.split(',')[0])>width),box.width),'Fixture must place the shot fully offscreen');
 await zoom.selectOption('50');
 const pen=await page.context().newCDPSession(page);
 const send=(type,x,y,force)=>pen.send('Input.dispatchMouseEvent',{type,x,y,force,pointerType:'pen',
  button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1});
 const draw=async(index)=>{
  const x=box.x+box.width*.28,y=box.y+box.height*.41+index*4;
  await send('mousePressed',x,y,.5);
  for(let i=1;i<=56;i++){
   await send('mouseMoved',x+i*box.width*.0064,y+Math.sin(i*.1)*26,.45+.2*Math.sin(i/57*Math.PI));
   if(i%4===0)await page.evaluate(()=>new Promise(requestAnimationFrame));
  }
  await send('mouseReleased',x+56*box.width*.0064,y,0);
  await page.evaluate(()=>new Promise(requestAnimationFrame));
 };
 for(const [brush,budget] of [['Pencil',65],['Paint',120]]){
  await page.getByLabel('Brush category').selectOption({label:brush});
  if(brush==='Paint'){
   await page.getByLabel('Brush family').selectOption('all');
   await page.getByLabel('Brush preset').selectOption('color-soft');
   const size=page.getByLabel('Size exact value',{exact:true});await size.fill('100');await size.press('Enter');
  }
  for(let i=0;i<4;i++)await draw(i);
  await page.evaluate(()=>window.soloStrokeDiagnostics.performance.start());
  for(let i=0;i<3;i++)await draw(i);
  const samples=await page.evaluate(()=>{
   const timing=window.soloStrokeDiagnostics.performance;timing.stop();return timing.export().renderMs??[];
  });
  assert(samples.length>=30,`${brush} produced too few measured frames`);
  samples.sort((a,b)=>a-b);
  const p95=samples[Math.floor(samples.length*.95)];
  console.log(`${brush} offscreen render p95 ${p95.toFixed(1)} ms across ${samples.length} frames`);
  assert(p95<=budget,`${brush} offscreen render p95 ${p95.toFixed(1)} ms exceeds ${budget} ms`);
 }
 assert.deepEqual(errors,[]);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {createServer}=await import('vite');
 const {chromium}=await import('@playwright/test');
 const server=await createServer({server:{host:'127.0.0.1',port:5798,strictPort:true}});
 await server.listen();
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--disable-gpu']});
  const page=await browser.newPage({viewport:{width:1515,height:1010},deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:5798/');
  await verifyOffscreenDrawing(page);
 }finally{await browser?.close();await server.close();}
}
