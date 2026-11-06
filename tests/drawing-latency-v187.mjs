import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function verifyDrawingLatency(page,extension='ts'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const results=await page.evaluate(async extension=>{
  const {SparseStrokeTiles:Before}=await import(`/src/engine/SparseStrokeTiles.${extension}`);
  const {SparseStrokeTiles:After}=await import(`/src/engine/SparseStrokeTiles.${extension}`);
  const {stockPresets}=await import(`/src/core/brushes.${extension}`);
  const {brushStrokeMetadata}=await import(`/src/core/paintTips.${extension}`);
  const region={x:-1600,y:-300,width:1600,height:700};
  const canvas=()=>{const c=Object.assign(document.createElement('canvas'),{width:1600,height:700}).getContext('2d',{willReadFrequently:true});c.translate(1600,300);return c;};
  const rows=[];
  for(const kind of ['color-soft','color-solid'])for(const size of [12,100,230]){
   const settings=stockPresets.find(p=>p.id===kind).settings;
   const s={...settings,...brushStrokeMetadata(settings),id:'test',kind:'stroke',tool:'brush',color:'#7595b8',opacity:.65,size,pressure:true,colorSeed:453874,points:Array.from({length:81},(_,i)=>({x:-1500+i*17,y:60+Math.sin(i*.17)*160,p:.1+.8*Math.sin(i/82*Math.PI),v:.65}))};
   const a=new Before(),b=new After(),ac=canvas(),bc=canvas();let differences=0,max=0;
   for(let n=1;n<=81;n+=4){const live={...s,points:s.points.slice(0,n)};ac.clearRect(-1600,-300,1600,700);bc.clearRect(-1600,-300,1600,700);a.synchronize([live]);a.paint(ac,region);b.paint(bc,region,live);const ap=ac.getImageData(0,0,1600,700).data,bp=bc.getImageData(0,0,1600,700).data;for(let i=0;i<ap.length;i++)if(ap[i]!==bp[i]){differences++;max=Math.max(max,Math.abs(ap[i]-bp[i]));}}
   rows.push({kind,size,differences,max});a.dispose();b.dispose();
  }return rows;
 },extension);console.log('SPARSE PARITY',JSON.stringify(results));assert(results.every(r=>r.differences===0),'Live paint changed pixels');
 await verifyLargePage(page,extension);

 const button=name=>page.getByRole('button',{name,exact:true});
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'studio-v187-'));
 const png=async(name)=>{await button('Export PNG').click();const [f]=await Promise.all([page.waitForEvent('download'),button('Download PNG').click()]);const dest=path.join(output,name+'.png');await f.saveAs(dest);return fs.readFileSync(dest);};
 try{
 const before=await png('before');await button('File').click();
 const [f]=await Promise.all([page.waitForEvent('download'),button('Download editable backup').click()]);const dest=path.join(output,'drawing.json');await f.saveAs(dest);
 const p=JSON.parse(fs.readFileSync(dest,'utf8'));p.id+='-replay';p.name+=' replay';
 await page.locator('input[accept=".json,.solo.json"]').setInputFiles({name:'replay.solo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.locator('.document-tab').filter({hasText:p.name}).waitFor();
 assert(before.equals(await png('after')),'Committed drawing changes after reopening');
 console.log('Large-page committed and reopened pixels match');
 }finally{fs.rmSync(output,{recursive:true,force:true});}

 assert.deepEqual(errors,[]);
}
async function verifyLargePage(page,extension){
 const canvas=page.getByLabel('Drawing canvas',{exact:true});
 const button=name=>page.getByRole('button',{name,exact:true});
 const pen=await page.context().newCDPSession(page);
 const settle=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const metrics=()=>page.evaluate(()=>window.soloStrokeDiagnostics.performance.export());
 const send=(type,x,y,force)=>pen.send('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1,pointerType:'pen',force});
 const project=await page.evaluate(async extension=>{
  const {newProject,activeLayer}=await import(`/src/core/model.${extension}`);
  const p=newProject('Drawing lag fixture',1920,1080);
  for(let i=0;i<45;i++)activeLayer(p).operations.push({id:'base-'+i,kind:'stroke',tool:'brush',points:Array.from({length:7},(_,j)=>({x:620+i*15+16*j,y:200+i*13+32*Math.sin(j/2),p:1})),size:12,opacity:.75,color:'#2a505f',pressure:false,response:1});
  const {expandPasteboard}=await import(`/src/core/shotFrame.${extension}`);return expandPasteboard(p,1490,915);
 },extension);
 await page.locator('input[accept=".json,.solo.json"]').setInputFiles({name:'perf.solo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.locator('.document-tab').filter({hasText:project.name}).waitFor();
 const category=page.getByLabel('Brush category');
 for(const mode of ['large-page']){
  if(mode==='offscreen'){
   await button('Show Outside Frame').click();await button('Frame Only').waitFor();
   await page.getByLabel('Canvas zoom').selectOption('5');
   const b=await canvas.boundingBox();
   for(let i=0;i<2;i++){
    await canvas.focus();await page.mouse.move(b.x+b.width*.48,b.y+b.height*.5);
    await page.keyboard.down('Space');await page.mouse.down();await page.mouse.move(b.x+b.width*.92,b.y+b.height*.5,{steps:9});await page.mouse.up();await page.keyboard.up('Space');
   }
  }
  await page.getByLabel('Canvas zoom').selectOption('50');
  for(const brush of ['Pencil','Paint']){
   await category.selectOption({label:brush});
   if(brush==='Paint'){
    if(await page.getByLabel('Brush family').count())await page.getByLabel('Brush family').selectOption('all');
    await page.getByLabel('Brush preset').selectOption('color-soft');
    await page.getByRole('spinbutton',{name:'Size exact value',exact:true}).fill('100');
    await page.getByRole('spinbutton',{name:'Size exact value',exact:true}).press('Enter');
   }
   await settle(650);
   const {x,y,width,height}=await canvas.boundingBox(),x0=x+width*.28,y0=y+height*.38;
   await page.evaluate(()=>window.soloStrokeDiagnostics.performance.start());
   for(let i=0;i<3;i++){
    const start=performance.now();
    await send('mousePressed',x0,y0+i*5,.48);
    for(let j=1;j<=72;j++){
     await send('mouseMoved',x0+j*width*.005,y0+i*5+30*Math.sin(j*.08),.5+.25*Math.sin(j/73*Math.PI));
     await settle(Math.max(0,start+j*8-performance.now()));
    }
    await send('mouseReleased',x0+width*.36,y0+i*5,0);
    await settle(320);
   }
   await page.evaluate(()=>window.soloStrokeDiagnostics.performance.stop());
   const report=await metrics();
   const summary=Object.fromEntries(Object.entries(report).filter(([,v])=>Array.isArray(v)&&typeof v[0]==='number').map(([k,v])=>{
    const sorted=[...v].sort((a,b)=>a-b);
    return [k,{n:v.length,p95:+sorted[Math.floor(v.length*.95)].toFixed(1),max:+sorted.at(-1).toFixed(1)}];
   }));
   console.log('LAG',mode,brush,JSON.stringify(summary));
  }
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {createServer}=await import('vite');
 const {chromium}=await import('@playwright/test');
 const server=await createServer({server:{host:'127.0.0.1',port:5799,strictPort:true}});
 await server.listen();
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--disable-gpu']});
  const page=await browser.newPage({viewport:{width:1515,height:1010},deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:5799/');
  await verifyDrawingLatency(page);
 }finally{await browser?.close();await server.close();}
}
