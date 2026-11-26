import {openBrushImports,openBrushSelection} from '../brush-workspace.mjs';
import {expect,test} from '@playwright/test';
import {abrFixture,longBrushName} from '../fixtures/brushImport';

test('imports a named ABR pack in a worker, shows real tips and reloads its library',async({page})=>{
 await page.goto('/');
 await openBrushImports(page);
 await expect(page.getByRole('button',{name:'Import brushes',exact:true})).toBeVisible();
 await page.getByLabel('Choose brush files').setInputFiles({name:'Artiste.abr',mimeType:'application/octet-stream',buffer:abrFixture(10)});
 await openBrushSelection(page);
 const category=page.getByLabel('Brush category',{exact:true});
 await expect(category).toHaveValue('Imported');
 const preset=page.getByLabel('Brush preset',{exact:true});
 await expect(preset.locator('optgroup')).toHaveAttribute('label','Artiste');
 await expect(preset.locator('option:checked')).toHaveText(longBrushName);
 const thumbnail=page.getByLabel(longBrushName+' stroke preview',{exact:true});
 await expect.poll(()=>thumbnail.evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))).toBe(true);
 await expect.poll(()=>page.evaluate(async()=>{
  const name='/src/core/brushImport/library.ts';
  return (await (await import(name)).readBitmapLibrary())?.presets.length??0;
 })).toBe(1);
 await page.reload();
 await openBrushImports(page);
 await openBrushSelection(page);
 await expect(category).toHaveValue('Imported');
 await expect(preset.locator('option:checked')).toHaveText(longBrushName);
 await page.getByLabel('Choose brush files').setInputFiles({name:'broken.abr',mimeType:'application/octet-stream',buffer:Buffer.from('broken')});
 await expect(page.getByRole('alert')).toContainText('broken.abr');
 await expect(preset.locator('option:checked')).toHaveText(longBrushName);
 await page.locator('.brush-import-surface').evaluate(async panel=>{
  const canvas=document.createElement('canvas');canvas.width=14;canvas.height=8;
  canvas.getContext('2d')!.fillRect(3,1,4,5);
  const png=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!)));
  const transfer=new DataTransfer();transfer.items.add(new File([png],'Hand drawn.png',{type:'image/png'}));
  panel.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));
 });
 await expect(preset.locator('option:checked')).toHaveText('Hand drawn');
});

test('Bitmap Paint responds within budget at 50, 150 and 300 px',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const m=await load('/src/core/model.ts'),{DocumentStore}=await load('/src/core/history.ts'),{StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {newBrushLibrary,addImportedBrushes,activePreset}=await load('/src/core/brushes.ts');
  const {encodeBitmapMask}=await load('/src/core/brushImport/mask.ts');
  const pixels=320,bytes=new Uint8Array(pixels*pixels);
  for(let i=0;i<bytes.length;i++){
   const x=i%pixels-pixels/2,y=Math.floor(i/pixels)-pixels/2;
   if(Math.abs(x)+Math.abs(y)/1.5<132)bytes[i]=128+(i*3)%128;
  }
  const tip=await encodeBitmapMask(bytes,pixels,pixels);
  const preset=activePreset(addImportedBrushes(newBrushLibrary(),'Benchmark',[{name:'Bitmap leaf',tips:[tip],size:300,settings:{scatter:.32,count:2,spacing:.22,hue:6,mix:true}}]));
  const host=document.createElement('div');document.body.append(host);
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:1280px;height:720px';host.append(canvas);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject('Nature performance',1280,720)),engine=new StudioEngine(canvas,store,()=>{});
  await new Promise(requestAnimationFrame);
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  const p95=(values:number[])=>values.sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
  const rows=[];
  try{
   for(const size of [50,150,300]){
    engine.setInput('brush',{...preset.settings,size});
    const frames:number[]=[],ends:number[]=[];
    for(let n=0;n<9;n++){
     const y=335+Math.sin(n)*40;
     const send=(type:string,i:number)=>canvas.dispatchEvent(new PointerEvent(type,{pointerType:'pen',pointerId:5,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,pressure:.75,clientX:200+i*7,clientY:y+Math.sin(i*.11)*35}));
     send('pointerdown',0);
     for(let i=1;i<=88;i++){
      send('pointermove',i);
      if(i%4===0){
       const t=performance.now();engine.render();
       if(n>=2)frames.push(performance.now()-t);
      }
     }
     const t=performance.now();send('pointerup',88);engine.render();if(n>=2)ends.push(performance.now()-t);
     await new Promise(requestAnimationFrame);
    }
    const op=m.activeLayer(store.getSnapshot()).operations.at(-1);
    rows.push({size,frameP95:p95(frames),penUpP95:p95(ends),version:op?.natureVersion,seed:op?.nature?.seed});
   }
   return rows;
  }finally{engine.dispose();host.remove();}
 });
 console.log('BITMAP_PERF',JSON.stringify(results));
 for(const row of results){
  expect(row.version).toBe(1);expect(row.seed).toBeGreaterThan(0);
  expect(row.frameP95).toBeLessThanOrEqual(16);
  expect(row.penUpP95).toBeLessThanOrEqual(50);
 }
});

test('Bitmap Blend uses the seeded stamp mask and agrees with saved replay',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {newBrushLibrary,addImportedBrushes,activePreset}=await load('/src/core/brushes.ts');
  const {encodeBitmapMask}=await load('/src/core/brushImport/mask.ts');
  const pixels=320,bytes=new Uint8Array(pixels*pixels);
  for(let i=0;i<bytes.length;i++){
   const x=i%pixels-pixels/2,y=Math.floor(i/pixels)-pixels/2;
   if(Math.abs(x)+Math.abs(y)/1.5<132)bytes[i]=128+(i*3)%128;
  }
  const tip=await encodeBitmapMask(bytes,pixels,pixels);
  const preset=activePreset(addImportedBrushes(newBrushLibrary(),'Benchmark',[{name:'Bitmap leaf',tips:[tip],size:300,settings:{scatter:.32,count:2,spacing:.22,hue:6,mix:true}}]));
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {compositePaintStroke}=await load('/src/engine/paintCompositing.ts');
  const {LiveBlendWorker}=await load('/src/engine/LiveBlendWorker.ts');
  const canvas=()=>Object.assign(document.createElement('canvas'),{width:440,height:260});
  const read=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  const base=canvas(),ctx=base.getContext('2d')!;
  ctx.fillStyle='#315d9a';ctx.fillRect(0,0,220,260);ctx.fillStyle='#b05a61';ctx.fillRect(220,0,220,260);
  const settings={...preset.settings,bbEnabled:true,bbMix:.1,bbStrength:1};
  const s={...brushStrokeMetadata(settings),id:'seeded-blend',kind:'stroke',tool:'brush',brushKind:settings.brushKind,size:100,opacity:1,pressure:false,response:1,color:'#00ff00',points:Array.from({length:48},(_,i)=>({x:110+i*4.5,y:125+14*Math.sin(i*.18),p:1}))};
  const mask=canvas(),full=canvas(),output=full.getContext('2d')!;
  output.drawImage(base,0,0);drawStroke(mask.getContext('2d')!,s);
  compositePaintStroke(output,mask,JSON.parse(JSON.stringify(s)));
  let handle:()=>void=()=>{};
  const worker=new LiveBlendWorker(()=>handle());
  try{
   await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Bitmap Blend worker preview timed out')),7000);
    handle=()=>{clearTimeout(timer);resolve();};
    worker.preview(s,base,{});
   });
   const pending=worker.finish(s);
   const final=await pending?.done;
   if(!final)throw Error('Bitmap Blend worker did not finish');
   const previous=read(base),replay=read(full),maskPixels=read(mask),workerPixels=read(final);
   let changed=0,outside=0,parity=0;
   for(let i=0;i<replay.length;i+=4){
    const diff=previous[i]!==replay[i]||previous[i+1]!==replay[i+1]||previous[i+2]!==replay[i+2]||previous[i+3]!==replay[i+3];
    if(diff){changed++;if(!maskPixels[i+3])outside++;}
    for(let k=0;k<4;k++)parity+=Number(replay[i+k]!==workerPixels[i+k]);
   }
   return {changed,outside,parity};
  }finally{worker.dispose();}
 });
 expect(result.changed).toBeGreaterThan(0);
 expect(result.outside).toBe(0);
 expect(result.parity).toBe(0);
});

test('opens a Clip Studio brush through the packaged SQLite worker',async({page})=>{
 const {sutFixture}=await import('../fixtures/clipBrush');
 await page.goto('/');
 await openBrushImports(page);
 await page.getByLabel('Choose brush files').setInputFiles({name:'Cliffs.sut',mimeType:'application/octet-stream',buffer:await sutFixture()});
 await openBrushSelection(page);
 await expect(page.getByLabel('Brush category',{exact:true})).toHaveValue('Imported');
 await expect(page.getByLabel('Brush preset',{exact:true}).locator('option:checked')).toHaveText('Roche · 山');
});

test('imports 300 brushes in a near-50 MB ABR worker with progress',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const count=300,side=413,pixels=side*side,record=1+36+10+19+pixels,padded=(record+3)&~3,section=count*(4+padded);
  const data=new Uint8Array(16+section),v=new DataView(data.buffer),text=new TextEncoder();
  v.setUint16(0,6);v.setUint16(2,1);data.set(text.encode('8BIMsamp'),4);v.setUint32(12,section);
  for(let i=0;i<count;i++){
   const at=16+i*(4+padded),id='00000000-0000-0000-0000-'+String(i).padStart(12,'0');
   v.setUint32(at,record);data[at+4]=36;data.set(text.encode(id),at+5);
   const bounds=at+5+36+10;v.setUint32(bounds+8,side);v.setUint32(bounds+12,side);v.setUint16(bounds+16,8);
   data.fill(109+i%100,bounds+19,bounds+19+pixels);data[bounds+19+i]=255;
  }
  const load=(name:string)=>import(name);
  const {importInWorker}=await load('/src/core/brushImport/client.ts');
  const {newBrushLibrary,addImportedBrushes}=await load('/src/core/brushes.ts');
  const {writeBitmapLibrary,readBitmapLibrary}=await load('/src/core/brushImport/library.ts');
  const started=performance.now();
  let ticks=0,highest=0,last=started,worst=0;
  const ticker=setInterval(()=>{const time=performance.now();worst=Math.max(worst,time-last);last=time;ticks++;},16);
  try{
   const brushes=await importInWorker(new File([data],'Large pack.abr'),'auto',(done:number)=>{highest=Math.max(done,highest);});
   const decoded=performance.now()-started;
   const library=addImportedBrushes(newBrushLibrary(),'Large pack',brushes);
   await writeBitmapLibrary(library);
   const saved=await readBitmapLibrary();
   return {imported:brushes.length,saved:saved.presets.length,ticks,highest,mib:data.byteLength/(1024*1024),decoded,worst};
  }finally{clearInterval(ticker);}
 });
 console.log('BRUSH_PACK_IMPORT',JSON.stringify(result));
 expect(result.mib).toBeGreaterThan(48);
 expect(result.imported).toBe(300);expect(result.saved).toBe(300);
 expect(result.highest).toBe(300);expect(result.ticks).toBeGreaterThan(0);
});
