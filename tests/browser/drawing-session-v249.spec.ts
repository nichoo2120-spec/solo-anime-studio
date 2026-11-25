import {expect,test} from '@playwright/test';
test('a 500-stroke Ink session stays responsive and keeps exact undo pixels',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const thisImport=(path:string)=>import(path);
  const m=await thisImport('/src/core/model.ts'),t=await thisImport('/src/animation/timeline.ts'),{DocumentStore}=await thisImport('/src/core/history.ts'),{StudioEngine}=await thisImport('/src/engine/StudioEngine.ts'),{stockPresets}=await thisImport('/src/core/brushes.ts');
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:2048px;height:1152px';document.body.append(canvas);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  let project=m.newProject('Session benchmark',2048,1152);
  project.layers.push(m.newLayer('Fifth layer'));
  for(let i=0;i<5;i++)project.layers[i].operations=[{id:'seed-'+i,kind:'stroke',tool:'brush',size:9,color:'#32638b',opacity:1,pressure:false,response:1,points:[{x:100,y:80+i*60,p:1},{x:450,y:100+i*60,p:1}]}];
  project=t.duplicateDrawingFrame(project);
  const store=new DocumentStore(project),engine=new StudioEngine(canvas,store,()=>{});
  await new Promise(requestAnimationFrame);
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  engine.onion.setSettings({...engine.onion.settings,enabled:true,previous:true,previousCount:1});
  const presetId='brush-pen';
  const settings=stockPresets.find((p:{id:string})=>p.id===presetId).settings;
  engine.setInput('brush',{...settings,size:16});
  for(let i=0;i<80&&!engine.onion.hasContent;i++)await new Promise(resolve=>setTimeout(resolve,10));
  const onion=engine.onion.hasContent;
  const pixels=()=>canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
  const same=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.every((value,index)=>value===b[index]);
  const p95=(values:number[])=>values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
  const frames:number[][]=[],ups:number[]=[],cache=[];
  const pointer=(kind:string,i:number,j:number)=>{
   const x=80+(i%12)*110+j*2,y=85+(Math.floor(i/12)%16)*56+Math.sin(j*.16)*13;
   canvas.dispatchEvent(new PointerEvent(kind,{pointerId:3,isPrimary:true,pointerType:'pen',button:0,buttons:kind==='pointerup'?0:1,pressure:.66,clientX:x,clientY:y}));
  };
  for(let i=-5;i<500;i++){
   const current:number[]=[];
   pointer('pointerdown',i+5,0);
   for(let j=1;j<=32;j++){
    pointer('pointermove',i+5,j);
    if(j%4===0){const started=performance.now();engine.render();current.push(performance.now()-started);}
   }
   const started=performance.now();pointer('pointerup',i+5,32);engine.render();const up=performance.now()-started;
   if(i<0)continue;
   frames.push(current);ups.push(up);
   if(i%25===24){
    await new Promise(requestAnimationFrame);
    cache.push({stroke:i+1,raster:engine.renderer.cacheStats(),history:store.historySize,view:engine.inkDisplay.historyStats()});
   }
  }
  const t0=performance.now();
  store.undo();engine.render();const undo=performance.now()-t0;
  // Keep readback out of the timing sample. Compare the cached undo against
  // a fresh display render of the same 499-stroke document.
  const historyAtUndo=engine.inkDisplay.historyStats(),undone=pixels();
  engine.inkDisplay.clear();engine.drawingFrames.clear();engine.lastExactFrame=undefined;
  engine.render();
  const undoExact=same(pixels(),undone);
  store.redo();engine.render();
  const committed=pixels();
  store.undo();engine.render();store.redo();engine.render();
  const redoExact=same(pixels(),committed);
  const operations=m.activeLayer(store.getSnapshot()).operations.length;
  const report={operations,onion,first:p95(frames[0]),last:p95(frames.at(-1)!),first25:p95(frames.slice(0,25).flat()),last25:p95(frames.slice(-25).flat()),penUp:p95(ups),worstPenUp:Math.max(...ups),undo,cache:cache.filter(row=>row.stroke%100===0),undoExact,redoExact,view:historyAtUndo};
  engine.dispose();canvas.remove();return report;
 });
 console.log('SESSION_PROFILE',JSON.stringify(result));
 expect(result.operations).toBe(506);
 expect(result.onion).toBe(true);
 expect(result.undoExact).toBe(true);
 expect(result.redoExact).toBe(true);
 expect(result.view.hits).toBeGreaterThanOrEqual(1);
 expect(result.last).toBeLessThanOrEqual(16);
 expect(result.last25).toBeLessThanOrEqual(16);
 expect(result.last25).toBeLessThanOrEqual(result.first25*1.1+.1);
 expect(result.penUp).toBeLessThanOrEqual(50);
 expect(result.undo).toBeLessThanOrEqual(50);
 const mature=result.cache.filter((row:{stroke:number})=>row.stroke>=200);
 for(const row of mature){
  expect(row.view.patches).toBe(160);
  expect(row.view.bytes+row.raster.totalBytes).toBeLessThanOrEqual(row.view.budget+row.raster.budget);
  expect(row.view.bytes).toBeLessThanOrEqual(mature[0].view.bytes*1.02);
 }
});

test('Ctrl+Shift+P toggles the drawing performance panel',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Drawing canvas',{exact:true}).focus();
 const overlay=page.getByLabel('Drawing performance',{exact:true});
 await page.keyboard.press('Control+Shift+P');
 await expect(overlay).toContainText('FPS');
 await expect(overlay).toContainText('JS memory');
 await expect(overlay).toContainText('Undo');
 await page.keyboard.press('Control+Shift+P');
 await expect(overlay).toHaveCount(0);
});

test('the autosave worker persists a complete drawing after an incremental update',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {AutosaveWriter}=await load('/src/core/AutosaveWriter.ts');
  const {repository}=await load('/src/core/persistence.ts');
  const {newProject,appendOperation,activeLayer}=await load('/src/core/model.ts');
  const original=newProject('Incremental autosave');
  const withStroke=appendOperation(original,{
   id:'autosave-test-stroke',kind:'stroke',tool:'brush',color:'#153040',opacity:1,size:8,
   pressure:false,response:1,points:[{x:20,y:35,p:1},{x:60,y:35,p:1}],
  });
  const writer=new AutosaveWriter();
  try{
   await writer.save(original);
   const deferred=await writer.save(withStroke,async()=>false);
   const saved=await writer.save(withStroke,async()=>true);
   const read=await repository.get(original.id);
   return {deferred:deferred===undefined,saved:saved?.kind,operations:activeLayer(read.project).operations};
  }finally{writer.dispose();}
 });
 expect(result.deferred).toBe(true);
 expect(result.saved).toBe('autosave');
 expect(result.operations).toMatchObject([{id:'autosave-test-stroke'}]);
});
