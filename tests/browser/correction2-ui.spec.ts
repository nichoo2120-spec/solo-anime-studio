import {test,expect} from '@playwright/test';
import {parkWheel} from './workspace';
import fs from 'node:fs';

test('Pencil, Ink and Brush Pen sliders reach production geometry and live tips at every level',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await parkWheel(page);const evidence:any[]=[];
 for(const preset of ['mechanical','g-pen','brush-pen']){
  await page.getByLabel('Brush category',{exact:true}).selectOption(preset==='mechanical'?'Pencil':'Ink');await page.getByLabel('Brush preset',{exact:true}).selectOption(preset);
  for(const mode of ['smoothness','stabilization']){
   const metrics:number[]=[];
   for(const level of [0,25,50,75,100]){
    await page.getByRole('slider',{name:'Smoothness',exact:true}).fill(String(mode==='smoothness'?level:0));await page.getByRole('slider',{name:'Smoothness',exact:true}).dispatchEvent('pointerup');await page.getByRole('slider',{name:'Stabilization',exact:true}).fill(String(mode==='stabilization'?level:0));await page.getByRole('slider',{name:'Stabilization',exact:true}).dispatchEvent('pointerup');await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
    const result=await page.evaluate(async({preset,mode,level})=>{
     const fp='/tests/fixtures/drawingSequences.ts',vp='/src/core/geometry.ts';const {noisyContours,noisyLine}=await import(fp),{fitView,toScreen}=await import(vp),points=mode==='smoothness'?noisyContours.s.points:noisyLine;
     const diagnostics=(window as any).soloStrokeDiagnostics;diagnostics.start();const c=document.querySelector('canvas[aria-label="Drawing canvas"]') as HTMLCanvasElement,r=c.getBoundingClientRect(),view=fitView(r.width,r.height,1920,1080,0);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;
     for(let i=0;i<points.length;i++){const q=toScreen(points[i],view),type=!i?'pointerdown':i===points.length-1?'pointerup':'pointermove',ev=new PointerEvent(type,{pointerId:7,isPrimary:true,pointerType:'mouse',button:0,clientX:r.left+q.x,clientY:r.top+q.y});Object.defineProperty(ev,'timeStamp',{value:1000+i*4});c.dispatchEvent(ev);}
     const trace=diagnostics.export().traces.at(-1),tips=trace.events.map((e:any)=>e.liveTip).filter(Boolean).slice(30,-1),mean=tips.reduce((sum:number,p:any)=>sum+p.y,0)/tips.length;
     const metric=mode==='smoothness'?Math.sqrt(trace.geometry.points.reduce((sum:number,p:any,i:number)=>sum+(p.x-noisyContours.s.reference[i].x)**2+(p.y-noisyContours.s.reference[i].y)**2,0)/points.length):Math.sqrt(tips.reduce((sum:number,p:any)=>sum+(p.y-mean)**2,0)/tips.length);
     return {preset,mode,level,kind:trace.settings.brushKind,smoothness:trace.settings.smoothness,stabilization:trace.settings.stabilization,metric,samples:trace.source.length,tipCount:tips.length,endpoint:trace.geometry.points.at(-1),expected:points.at(-1)};
    },{preset,mode,level});
    expect(result.kind).toBe(preset==='mechanical'?'graphite-mechanical':preset);expect(result.smoothness).toBe(mode==='smoothness'?level:0);expect(result.stabilization).toBe(mode==='stabilization'?level/100:0);expect(result.samples).toBe(121);expect(result.endpoint.x).toBeCloseTo(result.expected.x,6);expect(result.endpoint.y).toBeCloseTo(result.expected.y,6);if(mode==='stabilization')expect(result.tipCount).toBeGreaterThan(60);metrics.push(result.metric);evidence.push(result);
   }
   console.log('CONTROL_METRICS',JSON.stringify({preset,mode,metrics}));for(let i=1;i<metrics.length;i++){if(mode==='smoothness')expect(metrics[i]).toBeLessThan(metrics[i-1]);else expect(metrics[i]).toBeLessThan(metrics[0]);}expect(metrics[4]).toBeLessThan(metrics[0]*.4);
  }
 }
 fs.writeFileSync('validation/correction2-controls.json',JSON.stringify(evidence,null,2));
});

test('project viewport restores zoom/pan/rotation while a clean reload and navigation stay clean',async({page})=>{
 await page.goto('/');const id=await page.evaluate(async()=>{const mp='/src/core/model.ts',pp='/src/core/persistence.ts';const m=await import(mp),{repository}=await import(pp),p=m.newProject('Clean view regression');await repository.save(p);localStorage.setItem('solo:last-project',JSON.stringify(p.id));return p.id;});
 await page.addInitScript(()=>{(window as any).__dirtyFlash=false;new MutationObserver(()=>{if(document.body?.textContent?.includes('Unsaved changes'))(window as any).__dirtyFlash=true;}).observe(document,{childList:true,subtree:true,characterData:true});});
 await page.reload();await expect(page.getByText('Opened local project',{exact:true})).toBeVisible();await parkWheel(page);await expect(page.getByText('Unsaved changes',{exact:true})).toHaveCount(0);await page.getByLabel('Canvas zoom',{exact:true}).selectOption('400');await page.getByLabel('Canvas rotation',{exact:true}).fill('30');await page.locator('.brand').click();await page.keyboard.press('h');const box=(await page.getByLabel('Drawing canvas',{exact:true}).boundingBox())!;await page.mouse.move(box.x+box.width*.4,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.4+75,box.y+box.height*.6+40,{steps:4});await page.mouse.up();await page.waitForTimeout(300);await expect(page.getByText('Unsaved changes',{exact:true})).toHaveCount(0);
 const before=await page.evaluate(async id=>{const pp='/src/core/persistence.ts';const {repository}=await import(pp);return {view:JSON.parse(localStorage.getItem('solo:view:'+id)!),snapshots:(await repository.snapshots(id)).length,dirty:(window as any).__dirtyFlash};},id);await page.reload();await expect(page.getByText('Opened local project',{exact:true})).toBeVisible();await expect(page.getByLabel('Canvas zoom',{exact:true})).toHaveValue('400');await expect(page.getByLabel('Canvas rotation',{exact:true})).toHaveValue('30');await expect(page.getByText('Unsaved changes',{exact:true})).toHaveCount(0);const after=await page.evaluate(async id=>{const pp='/src/core/persistence.ts';const {repository}=await import(pp);return {view:JSON.parse(localStorage.getItem('solo:view:'+id)!),snapshots:(await repository.snapshots(id)).length,dirty:(window as any).__dirtyFlash};},id);expect(after.view).toEqual(before.view);expect(before.snapshots).toBe(1);expect(after.snapshots).toBe(1);expect(before.dirty||after.dirty).toBe(false);
});
