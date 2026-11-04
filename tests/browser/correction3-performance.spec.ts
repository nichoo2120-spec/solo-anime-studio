import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
test('Correction 3 dense drawing pipeline benchmark retains every captured sample',async({page})=>{
 test.setTimeout(180000);await page.goto('/');
 const result=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',bp='/src/core/brushes.ts',ap='/src/core/AutosaveWriter.ts';
  const m=await import(mp),{DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{stockPresets}=await import(bp),{AutosaveWriter}=await import(ap);
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:1100px;height:700px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;
  const p=m.newProject('Correction 3 dense benchmark');p.settings.guides=false;
  for(let i=0;i<128;i++){const preset=stockPresets[i%3===0?0:i%3===1?5:7];p.layers[i%4].operations.push({...preset.settings,id:m.uid(),kind:'stroke',tool:'brush',engineVersion:4,pressure:false,points:Array.from({length:24},(_,j)=>({x:70+j*60,y:60+(i%25)*35+Math.sin(j/23*Math.PI*2)*12,p:1}))});}
  const store=new DocumentStore(p),e=new StudioEngine(c,store,()=>{});await new Promise(requestAnimationFrame);e.setView({x:20,y:20,zoom:.5,rotation:0});await new Promise(requestAnimationFrame);
  let time=1000;const send=(type:string,x:number,y:number)=>{const ev=new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,pointerType:'mouse',clientX:20+x*.5,clientY:20+y*.5});Object.defineProperty(ev,'timeStamp',{value:++time});c.dispatchEvent(ev);};
  e.performance.start();const writer=new AutosaveWriter(),retained=[];let autosave:Promise<unknown>|undefined;
  for(const kind of ['hb','mapping','brush-pen']){
   e.setInput('brush',stockPresets.find((p:any)=>p.id===kind)!.settings);
   send('pointerdown',100,350);for(let i=1;i<=320;i++){send('pointermove',100+i*5,350+Math.sin(i/320*Math.PI*4)*180);if(i%8===0){if(kind==='mapping'&&i===160)autosave=writer.save(store.getSnapshot());await new Promise(requestAnimationFrame);}}
   send('pointerup',1700,350+Math.sin(Math.PI*4)*180);await new Promise(requestAnimationFrame);retained.push(m.activeLayer(store.getSnapshot()).operations.at(-1).points.length);
   for(let i=0;i<16;i++){send('pointerdown',160+i*75,850);send('pointermove',180+i*75,820);send('pointerup',200+i*75,800);await new Promise(requestAnimationFrame);}
  }
  await autosave;const timings=e.performance.export(),count=store.getSnapshot().layers.reduce((n:any,l:any)=>n+l.operations.length,0);e.dispose();writer.dispose();c.remove();
  return {timings,retained,count,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:(navigator as any).deviceMemory,userAgent:navigator.userAgent};
 });
 const stats=Object.fromEntries(Object.entries(result.timings).map(([name,values])=>{const a=(values as number[]).sort((a,b)=>a-b);return [name,{count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)}];}));
 const report={label:process.env.CORRECTION3_BENCH_LABEL??'after',workload:'1920x1080, 4 visible layers, 128 seeded strokes; HB/Mapping/Brush Pen each 321-point long curve + 16 three-point flicks; 8 samples per frame, autosave during input',browser:page.context().browser()!.version(),cpu:os.cpus()[0]?.model,logicalProcessors:os.cpus().length,totalMemoryBytes:os.totalmem(),...result,timings:undefined,stats};
 fs.writeFileSync(`validation/correction3-performance-${report.label}.json`,JSON.stringify(report,null,2));expect(result.retained).toEqual([321,321,321]);expect(result.count).toBe(179);expect(stats.renderMs.count).toBeGreaterThan(100);expect(stats.inputBatchMs.p95).toBeLessThan(5);expect(stats.renderMs.p95).toBeLessThan(100);expect(stats.latestInputToCanvasMs.p95).toBeLessThan(160);
});

