import {expect,test} from '@playwright/test';

test('large Blend uses frame-sized batches and preserves the appearance of each style',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {drawStroke}=await import('/src/engine/renderer.ts');
  const {applyBrushBlendLive,renderBrushBlend,resetBrushBlend}=await import('/src/engine/brushBlend.ts');
  const {applySilkBlend,renderSilkStroke,resetSilkBlend}=await import('/src/engine/silkBlend.ts');
  const width=1280,height=800;
  const canvas=()=>{
   const c=document.createElement('canvas');c.width=width;c.height=height;
   return c.getContext('2d',{willReadFrequently:true})!;
  };
  const base=canvas(),mask=canvas(),out=canvas(),canonical=canvas(),legacy=canvas();
  let sourceReads=0,maskReads=0,uploads=0;
  const sourceRead=base.getImageData.bind(base),maskRead=mask.getImageData.bind(mask),upload=out.putImageData.bind(out);
  base.getImageData=(x,y,w,h)=>{sourceReads++;return sourceRead(x,y,w,h);};
  mask.getImageData=(x,y,w,h)=>{maskReads++;return maskRead(x,y,w,h);};
  out.putImageData=(image,x,y,dx=0,dy=0,dw=image.width,dh=image.height)=>{uploads++;upload(image,x,y,dx,dy,dw,dh);};
  const grad=base.createLinearGradient(240,100,940,650);
  grad.addColorStop(0,'#b53858');grad.addColorStop(.5,'#e7af62');grad.addColorStop(1,'#4069bd');
  base.fillStyle=grad;base.fillRect(0,0,width,height);
  base.fillStyle='#4067a6';base.fillRect(650,155,380,352);
  const fixture=[
   ['water-flat','auto'],['water-rough','auto'],['g-pen','auto'],['hb','auto'],
   ['soft-paint','blur'],['soft-paint','wet'],['soft-paint','smudge'],['soft-paint','dry'],
   ['flat','auto','custom'],['soft-paint','silk','soft'],['soft-paint','silk','wet'],['soft-paint','silk','smudge'],['soft-paint','silk','dry'],
  ];
  const records=[];
  for(const size of [50,150,300,500]){
   for(const [id,style,silkMode] of fixture){
    if(size!==300&&id!=='water-flat'&&style!=='silk')continue;
    const source=stockPresets.find(p=>p.id===id)!.settings;
    const custom=silkMode==='custom'?{tsEnabled:true,tsAngle:45,tsScaleX:1.4,tsScaleY:.64,dbEnabled:true,dbTip:'chalk',dbScatter:.7,dbMode:'subtract',dbAmount:.5}:{};
    const settings={...source,...custom,bbEnabled:true,bbRenderStyle:style,silkMode,pressureWidth:false};
    const points=Array.from({length:45},(_,i)=>({x:310+i*13.5,y:390+Math.sin(i*.07)*68,p:.65+.35*i/45,v:.65}));
    const normal={...settings,...brushStrokeMetadata(settings),id:'large-blend-'+id,kind:'stroke',tool:'brush',size,points,pressure:false};
    const fast=size>64?{...normal,blendRasterVersion:1}:normal;
    mask.clearRect(0,0,width,height);
    if(style!=='silk')drawStroke(mask,fast);
    for(const ctx of [out,canonical,legacy])ctx.drawImage(base.canvas,0,0);
    resetBrushBlend();resetSilkBlend();
    const elapsed=[];
    let maxReads=0,maxMaskReads=0,maxUploads=0;
    let end=1;
    const frame=(stroke:typeof fast,final=false)=>style==='silk'
     ?applySilkBlend(out,mask.canvas,stroke,0,0,undefined,base.canvas,final)
     :applyBrushBlendLive(out,mask.canvas,stroke,base.canvas,final,stroke.points);
    for(;end<=points.length;end+=2){
     const stroke={...fast,points:points.slice(0,end)};
     sourceReads=maskReads=uploads=0;
     const start=performance.now();frame(stroke);elapsed.push(performance.now()-start);
     maxReads=Math.max(maxReads,sourceReads);maxMaskReads=Math.max(maxMaskReads,maskReads);maxUploads=Math.max(maxUploads,uploads);
    }
    const start=performance.now();frame(fast,true);const penUp=performance.now()-start;
    if(style==='silk'){renderSilkStroke(canonical,fast);renderSilkStroke(legacy,normal);}
    else{renderBrushBlend(canonical,mask.canvas,fast);renderBrushBlend(legacy,mask.canvas,normal);}
    const region={x:Math.max(0,310-Math.ceil(size*.7)),y:Math.max(0,390-Math.ceil(size*.7)-70)};
    const w=Math.min(width-region.x,Math.ceil(610+size*1.4)),h=Math.min(height-region.y,Math.ceil(145+size*1.4));
    const a=out.getImageData(region.x,region.y,w,h).data,b=canonical.getImageData(region.x,region.y,w,h).data,c=legacy.getImageData(region.x,region.y,w,h).data;
    let liveDifference=0,delta=0,outside=0;
    const alpha=style==='silk'?undefined:mask.getImageData(region.x,region.y,w,h).data;
    const original=base.getImageData(region.x,region.y,w,h).data;
    for(let i=0;i<a.length;i++){
     liveDifference+=Number(a[i]!==b[i]);delta+=Math.abs(b[i]-c[i]);
     if(alpha&&alpha[(i&~3)+3]===0&&b[i]!==original[i])outside++;
    }
    records.push({size,id,style,silkMode,liveDifference,outside,maxReads,maxMaskReads,maxUploads,meanPercent:100*delta/(255*a.length),p95:elapsed.sort((a,b)=>a-b)[Math.ceil(elapsed.length*.95)-1],penUp});
   }
  }
  return records;
 });
 console.log('LARGE_BLEND '+JSON.stringify(rows));
 for(const row of rows){
  const label=`${row.id} ${row.style} ${row.silkMode??''} ${row.size}px`;
  expect(row.liveDifference,label).toBe(0);
  expect(row.outside,label).toBe(0);
  if(row.size>64){
   expect(row.maxReads,label+' pigment reads per frame').toBeLessThanOrEqual(1);
   expect(row.maxMaskReads,label+' mask reads per frame').toBeLessThanOrEqual(1);
   expect(row.maxUploads,label+' uploads per frame').toBeLessThanOrEqual(1);
  }
  if(row.size===300)expect(row.meanPercent,label).toBeLessThan(2);
 }
});

test('large Blend stays within the frame and pen-up budgets on the drawing thread',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const {newProject,activeLayer}=await import('/src/core/model.ts');
  const {DocumentStore}=await import('/src/core/history.ts');
  const {StudioEngine}=await import('/src/engine/StudioEngine.ts');
  const {stockPresets}=await import('/src/core/brushes.ts');
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const rows=[];
  for(const size of [50,150,300,500]){
   for(const style of size===300?['auto','silk','blur','wet','smudge','dry']:['auto']){
    const project=newProject('Blend latency',1120,700);
    const paint=(x:number,color:string)=>({
     id:color,kind:'stroke',tool:'brush',size:450,pressure:false,response:1,opacity:1,color,
     points:[{x,y:120,p:1},{x,y:600,p:1}],
    });
    activeLayer(project).operations=[paint(350,'#eb3131'),paint(795,'#145adc')];
    const store=new DocumentStore(project),canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:1120px;height:700px';
    document.body.append(canvas);
    let held=false;
    canvas.setPointerCapture=()=>{held=true;};
    canvas.hasPointerCapture=()=>held;
    canvas.releasePointerCapture=()=>{held=false;};
    const engine=new StudioEngine(canvas,store,()=>{});
    engine.setView({x:0,y:0,zoom:1,rotation:0});
    const preset=stockPresets.find(p=>p.id==='water-flat')!.settings;
    engine.setInput('brush',{...preset,size,bbEnabled:true,bbRenderStyle:style,pressureWidth:false});
    await frame();await frame();
    const send=(type:string,x:number)=>{
     canvas.dispatchEvent(new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,
      pointerType:'pen',clientX:x,clientY:350+Math.sin(x*.015)*20,pressure:.73}));
    };
    const costs:number[]=[];
    const render=engine.render.bind(engine);
    engine.render=()=>{
     const start=performance.now();
     render();
     if(engine.drawing)costs.push(performance.now()-start);
    };
    send('pointerdown',270);
    for(let i=0;i<40;i++){
     for(let j=1;j<=3;j++)send('pointermove',270+(i*3+j)*4.5);
     await frame();
    }
    const start=performance.now();
    send('pointerup',820);
    const release=performance.now()-start;
    const op=activeLayer(store.getSnapshot()).operations.at(-1);
    const worker=engine.blendWorker.available();
    await engine.renderer.whenSettled();
    const settled=performance.now()-start;
    costs.sort((a,b)=>a-b);
    rows.push({size,style,worker,frames:costs.length,p95:costs[Math.ceil(costs.length*.95)-1],release,settled,version:op.blendRasterVersion??0});
    engine.dispose();canvas.remove();
   }
  }
  return rows;
 });
 console.log('BLEND_DRAWING_THREAD '+JSON.stringify(rows));
 for(const row of rows){
  const label=`${row.style} ${row.size}px`;
  expect(row.worker,label).toBe(true);
  expect(row.frames,label).toBeGreaterThan(32);
  expect(row.version,label).toBe(row.size>64?2:0);
  if(row.size===300){
   expect.soft(row.p95,label+' frame work').toBeLessThanOrEqual(16);
   expect.soft(row.release,label+' pointer-up dispatch').toBeLessThanOrEqual(50);
  }
 }
});
