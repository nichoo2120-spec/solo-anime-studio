import {test,expect} from '@playwright/test';
import {parkWheel} from './workspace';
test('inspector follows the tool and advanced per-preset controls survive reload and reset',async({page})=>{
 await page.goto('/');await parkWheel(page);await page.getByRole('slider',{name:'Beginning taper',exact:true}).fill('100');await page.getByRole('slider',{name:'Ending taper',exact:true}).fill('100');await page.getByRole('slider',{name:'Minimum size',exact:true}).fill('20');await page.getByRole('slider',{name:'Maximum size',exact:true}).fill('80');await page.getByRole('slider',{name:'Minimum opacity',exact:true}).fill('15');await page.getByRole('slider',{name:'Maximum opacity',exact:true}).fill('75');await page.getByLabel('Mouse velocity taper',{exact:true}).check();await page.locator('.brand').click();await page.keyboard.press('g');await expect(page.getByLabel('Fill reference',{exact:true})).toBeVisible();await expect(page.getByRole('slider',{name:'Size',exact:true})).toHaveCount(0);await page.keyboard.press('l');await expect(page.getByLabel('Selection shape',{exact:true})).toHaveValue('lasso');await page.getByLabel('Selection shape',{exact:true}).selectOption('rectangle');await page.locator('.brand').click();await page.keyboard.press('b');await page.reload();await expect(page.getByRole('slider',{name:'Beginning taper',exact:true})).toHaveValue('100');await expect(page.getByRole('slider',{name:'Minimum size',exact:true})).toHaveValue('20');await expect(page.getByRole('slider',{name:'Maximum opacity',exact:true})).toHaveValue('75');await expect(page.getByLabel('Mouse velocity taper',{exact:true})).toBeChecked();await page.getByRole('button',{name:'Reset to Default',exact:true}).click();await expect(page.getByRole('slider',{name:'Beginning taper',exact:true})).toHaveValue('0');await expect(page.getByLabel('Mouse velocity taper',{exact:true})).not.toBeChecked();await page.getByRole('button',{name:'Export PNG',exact:true}).click();await page.getByLabel('PNG width',{exact:true}).focus();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('eraser cursor and actual hard-eraser footprint agree across zoom and rotation',async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',gp='/src/core/geometry.ts';
  const {appendOperation,newProject,activeLayer,uid}=await import(mp);
  const {DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{toScreen}=await import(gp);
  const results=[];
  for(const zoom of [.25,1,4])for(const size of [4,24]){
   const project=appendOperation(newProject(),{
    id:uid(),kind:'stroke',tool:'brush',engineVersion:2,brushKind:'technical',
    points:[{x:300,y:300,p:1},{x:600,y:300,p:1}],size:80,opacity:1,color:'#000000',pressure:false,response:1,
   });
   const host=document.createElement('div'),canvas=document.createElement('canvas');
   host.style.cssText='position:fixed;left:0;top:0;width:600px;height:400px';
   canvas.style.cssText='display:block;width:600px;height:400px';
   host.append(canvas);document.body.append(host);
   canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
   const store=new DocumentStore(project),engine=new StudioEngine(canvas,store,()=>{});
   try{
    await new Promise(requestAnimationFrame);
    const view={x:0,y:0,zoom,rotation:.4};
    const center=toScreen({x:400,y:300},view);
    engine.setView({...view,x:300-center.x,y:200-center.y});
    engine.setInput('eraser',{...engine.brush,brushKind:'eraser-hard',size,opacity:1,pressure:false,smoothness:0,stabilization:0});
    const send=(type:string,x:number,y:number)=>{
     const q=toScreen({x,y},engine.view);
     canvas.dispatchEvent(new PointerEvent(type,{pointerId:1,isPrimary:true,clientX:q.x,clientY:q.y,pointerType:'mouse',button:0,bubbles:true}));
    };
    send('pointermove',400,300);
    await new Promise(requestAnimationFrame);
    const overlay=host.querySelector<HTMLCanvasElement>('.brush-cursor-overlay')!;
    const dpr=devicePixelRatio,half=Math.ceil(52*dpr),side=half*2;
    const pixels=overlay.getContext('2d')!.getImageData(Math.round(300*dpr)-half,Math.round(200*dpr)-half,side,side).data;
    let radius=0;
    for(let j=0;j<side;j++)for(let i=0;i<side;i++){
     if(pixels[(j*side+i)*4+3]>=128)radius=Math.max(radius,Math.hypot(i+.5-half,j+.5-half)/dpr);
    }
    send('pointerdown',400,280);send('pointermove',400,320);send('pointerup',400,320);
    await new Promise(requestAnimationFrame);
    const raster=engine.renderer.get(activeLayer(store.getSnapshot()),store.getSnapshot()).getContext('2d')!;
    const inside=raster.getImageData(400+size/2-1,300,1,1).data[3];
    const outside=raster.getImageData(400+size/2+1,300,1,1).data[3];
    results.push({radius,expected:size/2*zoom,inside,outside});
   }finally{engine.dispose();host.remove();}
  }
  return results;
 });
 for(const result of results){
  if(result.expected<2)expect(result.radius).toBeGreaterThan(4);
  else expect(Math.abs(result.radius-result.expected)).toBeLessThanOrEqual(2);
  expect(result.inside).toBeLessThan(10);
  expect(result.outside).toBe(255);
 }
});
test('worker autosave rejects a bad snapshot without replacing a valid project',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{const mp='/src/core/model.ts',ap='/src/core/AutosaveWriter.ts',pp='/src/core/persistence.ts';const m=await import(mp),{AutosaveWriter}=await import(ap),{repository}=await import(pp),writer=new AutosaveWriter();let p=m.newProject('Worker consistency');for(let i=0;i<120;i++)p=m.appendOperation(p,{id:m.uid(),kind:'stroke',tool:'brush',points:[{x:20,y:20+i,p:1},{x:80,y:20+i,p:1}],size:4,opacity:1,color:'#000000',pressure:false,response:1});await writer.save(p);let rejected=false;try{await writer.save({...p,width:NaN});}catch{rejected=true;}const loaded=(await repository.load(p.id)).project;writer.dispose();return {rejected,count:m.activeLayer(loaded).operations.length,width:loaded.width};});expect(result).toEqual({rejected:true,count:120,width:1920});
});
test('autosave spanning an active coalesced circle preserves 120 existing strokes and its complete tail',async({page})=>{
 test.setTimeout(60000);await page.goto('/');await page.evaluate(async()=>{const mp='/src/core/model.ts',pp='/src/core/persistence.ts';const m=await import(mp),{repository}=await import(pp);let p=m.newProject('Long drawing session');for(let i=0;i<120;i++)p=m.appendOperation(p,{id:m.uid(),kind:'stroke',tool:'brush',engineVersion:2,brushKind:'technical',points:[{x:50,y:30+i,p:1},{x:100,y:30+i,p:1}],size:2,opacity:1,color:'#000000',pressure:false,response:1});await repository.save(p);localStorage.setItem('solo:last-project',JSON.stringify(p.id));});await page.reload();await expect(page.getByText('Opened local project',{exact:true})).toBeVisible();await parkWheel(page);await page.evaluate(()=>{const c=document.querySelector('canvas[aria-label="Drawing canvas"]') as HTMLCanvasElement;c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;const r=c.getBoundingClientRect(),z=Math.min((r.width-90)/1920,(r.height-90)/1080),at=(x:number,y:number)=>({x:r.left+(r.width-1920*z)/2+x*z,y:r.top+(r.height-1080*z)/2+y*z}),points=Array.from({length:101},(_,i)=>at(700+100*Math.cos(i/100*Math.PI*2),400+100*Math.sin(i/100*Math.PI*2))),send=(type:string,index:number,from=index)=>{const p=points[index],e=new PointerEvent(type,{pointerId:17,isPrimary:true,clientX:p.x,clientY:p.y,pointerType:'mouse',button:0,bubbles:true});Object.defineProperty(e,'getCoalescedEvents',{value:()=>points.slice(from,index+1).map(q=>new PointerEvent(type,{pointerId:17,clientX:q.x,clientY:q.y,pointerType:'mouse'}))});c.dispatchEvent(e);};send('pointerdown',0);send('pointerup',100,1);send('pointerdown',0);send('pointermove',40,1);(window as any).__finishCircle=()=>send('pointerup',100,41);});await page.waitForTimeout(3500);await page.evaluate(()=>(window as any).__finishCircle());await expect(page.getByText('Autosaved locally',{exact:true})).toBeVisible({timeout:15000});await page.reload();await expect(page.getByText('Opened local project',{exact:true})).toBeVisible();const count=await page.evaluate(async()=>{const pp='/src/core/persistence.ts';const {repository}=await import(pp),p=(await repository.list())[0].project,l=p.layers.find((l:any)=>l.name==='Line');return {count:l.operations.length,points:l.operations.at(-1).points.length};});expect(count).toEqual({count:122,points:101});
});
