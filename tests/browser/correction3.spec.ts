import {test,expect} from '@playwright/test';
import {parkWheel} from './workspace';

test('every installed drawing preset paints its first stroke across repeated atomic switches',async({page})=>{
 test.setTimeout(90000);await page.goto('/');const result=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',bp='/src/core/brushes.ts';const m=await import(mp),{DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{stockPresets}=await import(bp);
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject('All presets',800,600)),e=new StudioEngine(c,store,()=>{});await new Promise(requestAnimationFrame);e.setView({x:0,y:0,zoom:1,rotation:0});let time=1000;
  const draw=(preset:any,pen:boolean)=>{const settings=structuredClone(preset.settings);e.setInput('brush',settings);for(const [i,type] of ['pointerdown','pointermove','pointerup'].entries()){const event=new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,pointerType:pen?'pen':'mouse',pressure:pen?(i===2?0:.5):0,clientX:100+i*60,clientY:120});Object.defineProperty(event,'timeStamp',{value:++time});c.dispatchEvent(event);}
   const doc=store.getSnapshot(),op=m.activeLayer(doc).operations.at(-1),canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const ctx=canvas.getContext('2d')!;
   // Render in isolation: prior G-Pen ink cannot conceal a missing Mapping stroke.
   const pixels=e.renderer.get({...m.activeLayer(doc),id:'isolated',operations:[op]},doc).getContext('2d')!.getImageData(80,80,180,80).data;
   return {requested:preset.id,actual:op.brushKind,visible:pixels.some((v:number,i:number)=>i%4===3&&v>0),tool:e.tool,settings:JSON.stringify(settings)===JSON.stringify(e.brush)};
  };
  const results=[];for(let repeat=0;repeat<5;repeat++)for(const p of stockPresets.filter((p:any)=>p.category!=='Eraser'))for(const pen of [false,true])results.push(draw(p,pen));
  for(let i=0;i<30;i++)for(const kind of ['g-pen','mapping','g-pen'])results.push(draw(stockPresets.find((p:any)=>p.id===kind),false));
  const count=m.activeLayer(store.getSnapshot()).operations.length;e.dispose();c.remove();return {results,count,presetCount:stockPresets.filter((p:any)=>p.category!=='Eraser').length};
 });expect(result.count).toBe(result.presetCount*5*2+30*3);for(const r of result.results){expect(r.actual).toBe(({hb:'graphite-hb','2b':'graphite-2b',mechanical:'graphite-mechanical',blue:'graphite-blue',dry:'dry-round','soft-paint':'paint','watercolor-round':'watercolor','watercolor-dagger':'watercolor','watercolor-cats-tongue':'watercolor','watercolor-liner':'watercolor'} as any)[r.requested]??r.requested);expect(r.visible,r.requested).toBe(true);expect(r.tool).toBe('brush');expect(r.settings).toBe(true);}
});

test('pen-down pressure never becomes a full-width provisional blob and invalid input stays saveable',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',bp='/src/core/brushes.ts';const m=await import(mp),{DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{stockPresets}=await import(bp);
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject('Initial pressure',800,600)),e=new StudioEngine(c,store,()=>{});await new Promise(requestAnimationFrame);e.setView({x:0,y:0,zoom:1,rotation:0});let time=1000;const results=[];
  for(const kind of ['g-pen','mapping','hb','brush-pen'])for(const size of [4,20,60])for(const pressure of [0,.5,.1,NaN,Infinity,-2,2]){
   e.setInput('brush',{...stockPresets.find((p:any)=>p.id===kind)!.settings,size});
   const send=(type:string,x:number,p:number)=>{const ev=new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,pointerType:'pen',clientX:x,clientY:180,pressure:0});Object.defineProperty(ev,'pressure',{value:p});Object.defineProperty(ev,'timeStamp',{value:++time});c.dispatchEvent(ev);};
   send('pointerdown',200,pressure);const stroke=(e as any).stroke;results.push({pressureEnabled:stroke.pressure,p:stroke.points[0].p,kind,size});send('pointerup',200,0);m.validateProject(store.getSnapshot());
  }e.dispose();c.remove();return results;
 });for(const r of result){expect(r.pressureEnabled).toBe(true);expect(Number.isFinite(r.p)).toBe(true);expect(r.p).toBeGreaterThan(0);expect(r.p).toBeLessThanOrEqual(1);}
});

test('real inspector G/Mapping changes are immediate, preserve per-preset settings and survive reload',async({page})=>{
 await page.goto('/');await parkWheel(page);await page.getByLabel('Brush category',{exact:true}).selectOption('Ink');await page.getByLabel('Brush preset',{exact:true}).selectOption('mapping');await page.getByRole('slider',{name:'Size',exact:true}).fill('9');await page.getByRole('slider',{name:'Size',exact:true}).dispatchEvent('pointerup');await page.getByRole('slider',{name:'Opacity',exact:true}).fill('73');await page.getByRole('slider',{name:'Opacity',exact:true}).dispatchEvent('pointerup');
 const result=await page.evaluate(()=>{
  const diagnostics=(window as any).soloStrokeDiagnostics;diagnostics.start();const select=document.querySelector('select[aria-label="Brush preset"]') as HTMLSelectElement,c=document.querySelector('canvas[aria-label="Drawing canvas"]') as HTMLCanvasElement,r=c.getBoundingClientRect();c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;let time=1000;
  for(let i=0;i<18;i++){const kind=i%2?'mapping':'g-pen';select.value=kind;select.dispatchEvent(new Event('change',{bubbles:true}));for(const [j,type] of ['pointerdown','pointerup'].entries()){const ev=new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,pointerType:'mouse',clientX:r.left+r.width*.45+j*35,clientY:r.top+r.height*.55});Object.defineProperty(ev,'timeStamp',{value:++time});c.dispatchEvent(ev);}}
  return diagnostics.export().traces.map((t:any)=>({tool:t.settings.tool,kind:t.settings.brushKind,size:t.settings.size,opacity:t.settings.opacity}));
 });expect(result).toHaveLength(18);result.forEach((r:any,i:number)=>{expect(r.tool).toBe('brush');expect(r.kind).toBe(i%2?'mapping':'g-pen');expect(r.size).toBe(i%2?9:7);expect(r.opacity).toBeCloseTo(i%2?.73:1);});await page.reload();await expect(page.getByLabel('Brush preset',{exact:true})).toHaveValue('mapping');await expect(page.getByRole('slider',{name:'Size',exact:true})).toHaveValue('9');await expect(page.getByRole('slider',{name:'Opacity',exact:true})).toHaveValue('73');
});

test('a zero-pressure pen-down waits for contact and uses the first real pressure without a broad cap',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',bp='/src/core/brushes.ts';const m=await import(mp),{DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{stockPresets}=await import(bp);
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject('Contact pressure',800,600)),e=new StudioEngine(c,store,()=>{});await new Promise(requestAnimationFrame);e.setView({x:0,y:0,zoom:1,rotation:0});let time=1000;const results=[];
  const send=(type:string,x:number,pressure:number)=>{const ev=new PointerEvent(type,{pointerId:7,isPrimary:true,pointerType:'pen',button:0,clientX:x,clientY:180,pressure});Object.defineProperty(ev,'timeStamp',{value:++time});c.dispatchEvent(ev);};
  for(const kind of ['hb','g-pen','mapping','brush-pen']){
   e.setInput('brush',{...stockPresets.find((p:any)=>p.id===kind)!.settings,size:60});send('pointerdown',200,0);(e as any).render();const empty=!(e as any).scratch.getContext('2d').getImageData(150,130,100,100).data.some((v:number,i:number)=>i%4===3&&v>0);
   send('pointermove',210,.12);const state=e.getInputState();send('pointerup',220,0);const op=m.activeLayer(store.getSnapshot()).operations.at(-1);results.push({empty,initial:state.raw[0].p,final:op.points.map((p:any)=>p.p)});
  }e.dispose();c.remove();return results;
 });for(const r of result){expect(r.empty).toBe(true);expect(r.initial).toBeCloseTo(.12,5);for(const p of r.final)expect(p).toBeCloseTo(.12,5);}
});

test('a delayed display frame retains every sample and uses unchanged accepted live geometry',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',sp='/src/engine/strokeGeometry.ts',fp='/tests/fixtures/drawingSequences.ts';const m=await import(mp),{DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{strokeGeometry}=await import(sp),{noisyLine}=await import(fp);
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;const store=new DocumentStore(m.newProject('Delayed display',800,600)),e=new StudioEngine(c,store,()=>{});await new Promise(requestAnimationFrame);e.setView({x:0,y:0,zoom:1,rotation:0});e.setInput('brush',{...e.brush,stabilization:.75,smoothness:75});e.performance.start();
  for(let i=0;i<noisyLine.length;i++){const p=noisyLine[i],ev=new PointerEvent(i?'pointermove':'pointerdown',{pointerId:7,isPrimary:true,pointerType:'mouse',button:0,clientX:p.x,clientY:p.y});Object.defineProperty(ev,'timeStamp',{value:1000+i});c.dispatchEvent(ev);}
  const raw=e.getInputState(),expected=strokeGeometry((e as any).stroke,'live'),same=JSON.stringify(raw.preview)===JSON.stringify(expected.points),geometryRuns=e.performance.export().liveGeometryMs?.length;
  const last=noisyLine.at(-1)!,ev=new PointerEvent('pointerup',{pointerId:7,isPrimary:true,pointerType:'mouse',button:0,clientX:last.x,clientY:last.y});Object.defineProperty(ev,'timeStamp',{value:2000});c.dispatchEvent(ev);const op=m.activeLayer(store.getSnapshot()).operations.at(-1);e.dispose();c.remove();return {raw:raw.raw.length,same,geometryRuns,committed:op.points.length,final:strokeGeometry(op).points.at(-1),last};
 });expect(result.raw).toBe(121);expect(result.committed).toBe(121);expect(result.same).toBe(true);expect(result.geometryRuns).toBeLessThan(4);expect(result.final).toEqual(result.last);
});
