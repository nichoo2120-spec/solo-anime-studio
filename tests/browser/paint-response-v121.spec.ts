import {test,expect} from '@playwright/test';

test('blank layers do not repeatedly allocate or resample bitmaps during paint input',async({page})=>{
 await page.goto('/');const r=await page.evaluate(async()=>{
  const m=await import('/src/core/model.ts'),{DocumentStore}=await import('/src/core/history.ts'),{StudioEngine}=await import('/src/engine/StudioEngine.ts'),{stockPresets}=await import('/src/core/brushes.ts');const p=m.newProject('Blank layers'),store=new DocumentStore(p),c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:900px;height:600px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;
  const e:any=new StudioEngine(c,store,()=>{}),get=e.renderer.get.bind(e.renderer);let inactive=0,active=0;e.renderer.get=(layer:any,project:any)=>{if(!layer.operations.length&&layer.id!==project.activeLayerId)inactive++;else active++;return get(layer,project);};e.setView({x:0,y:0,zoom:.5,rotation:0});e.render();const blankCalls=active+inactive;e.setInput('brush',{...stockPresets.find(p=>p.id==='paint')!.settings,size:150,pressure:false,stabilization:0,smoothness:0});
  const send=(type:string,x:number)=>c.dispatchEvent(new PointerEvent(type,{pointerId:9,isPrimary:true,pointerType:'mouse',buttons:type==='pointerup'?0:1,button:0,clientX:x,clientY:170}));send('pointerdown',120);for(let i=1;i<=12;i++){send('pointermove',120+i*8);e.render();}send('pointerup',216);e.render();const layers=store.getSnapshot().layers.length,strokes=m.activeLayer(store.getSnapshot()).operations.length;e.dispose();c.remove();return {blankCalls,inactive,active,layers,strokes};
 });expect(r.blankCalls).toBe(0);expect(r.inactive).toBe(0);expect(r.active).toBeGreaterThan(0);expect(r.layers).toBe(4);expect(r.strokes).toBe(1);
});

test('cached page backdrop matches direct rendering and follows camera and document changes',async({page})=>{
 await page.goto('/');const rows=await page.evaluate(async()=>{
  const {CanvasBackdrop}=await import('/src/engine/CanvasBackdrop.ts'),cache=new CanvasBackdrop(),rows=[];
  const a=document.createElement('canvas'),b=document.createElement('canvas');
  for(const dpr of [1,2])for(const zoom of [.25,.92,1.57,4])for(const rotation of [0,.31])for(const documentWidth of [500,780]){
   const width=600,height=400;a.width=b.width=width*dpr;a.height=b.height=height*dpr;const ctx=a.getContext('2d')!,reference=b.getContext('2d')!,view={x:65,y:45,zoom,rotation};
   reference.setTransform(dpr,0,0,dpr,0,0);reference.fillStyle='#20272c';reference.fillRect(0,0,width,height);reference.save();reference.translate(view.x,view.y);reference.rotate(rotation);reference.scale(zoom,zoom);reference.shadowColor='#0008';reference.shadowBlur=25/zoom;reference.fillStyle='#fff';reference.fillRect(0,0,documentWidth,270);reference.restore();
   cache.paint(ctx,width,height,dpr,view,documentWidth,270);const first=(cache as any).canvas.toDataURL();ctx.fillStyle='red';ctx.fillRect(0,0,200,200);cache.paint(ctx,width,height,dpr,view,documentWidth,270);const reused=first===(cache as any).canvas.toDataURL();
   const x=ctx.getImageData(0,0,a.width,a.height).data,y=reference.getImageData(0,0,b.width,b.height).data;let max=0;for(let i=0;i<x.length;i++)max=Math.max(max,Math.abs(x[i]-y[i]));rows.push({dpr,zoom,rotation,documentWidth,max,reused});
  }
  // A repeated drawing frame must not repaint the page or its blurred shadow.
  const ctx=a.getContext('2d')!,view={x:90,y:60,zoom:1,rotation:0};cache.paint(ctx,600,400,2,view,500,270);let fills=0;const bg=(cache as any).canvas.getContext('2d'),fill=bg.fillRect.bind(bg);bg.fillRect=(...args:any[])=>{fills++;fill(...args);};cache.paint(ctx,600,400,2,view,500,270);if(fills)throw Error('Unchanged backdrop was rebuilt');cache.paint(ctx,600,400,2,{...view,x:91},500,270);if(fills!==2)throw Error('Changed camera did not rebuild decoration');cache.clear();return rows;
 });for(const r of rows){expect(r.max,JSON.stringify(r)).toBe(0);expect(r.reused).toBe(true);}
});

test('maximum paint sizes retain full-render pixels during incremental pressure and taper updates',async({page})=>{
 test.setTimeout(180000);await page.goto('/');const rows=await page.evaluate(async()=>{
  const {drawModernStroke}=await import('/src/engine/brushRaster.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{LiveStrokeRaster}=await import('/src/engine/liveRaster.ts'),{stockPresets}=await import('/src/core/brushes.ts');
  const rows=[];
  for(const id of ['marker','paint','dry','watercolor','airbrush','eraser-soft'])for(const pressure of [false,true])for(const taper of [0,.18]){
   const s:any={...stockPresets.find(p=>p.id===id)!.settings,id:'paint-test-'+id,kind:'stroke',tool:id==='eraser-soft'?'eraser':'brush',engineVersion:id==='dry'?9:['watercolor','airbrush'].includes(id)?8:10,paintNibVersion:id==='airbrush'?undefined:1,liveRefinementVersion:2,pressure,size:150,stabilization:0,smoothness:0,taperStart:taper,taperEnd:taper,points:[]};
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=960;a.height=b.height=520;const ac=a.getContext('2d',{willReadFrequently:true})!,bc=b.getContext('2d',{willReadFrequently:true})!,live=new LiveStrokeRaster();let max=0,changed=0;
   const points=Array.from({length:81},(_,i)=>({x:90+i*9.2,y:260+120*Math.sin(i/80*Math.PI*5),p:.08+.92*Math.sin(i/80*Math.PI)**2}));
   for(const n of [1,9,25,49,81]){
    s.points=points.slice(0,n);const g=strokeGeometry(s,'live');live.paint(ac,s,g);bc.clearRect(0,0,960,520);drawModernStroke(bc,s,'live',g);
    const x=ac.getImageData(0,0,960,520).data,y=bc.getImageData(0,0,960,520).data;for(let i=3;i<x.length;i+=4){const d=Math.abs(x[i]-y[i]);max=Math.max(max,d);if(d)changed++;}
   }
   rows.push({id,pressure,taper,max,changed});
  }
  return rows;
 });console.log('PAINT_LIVE_FIDELITY',JSON.stringify(rows));for(const r of rows)expect(r.max,JSON.stringify(r)).toBeLessThanOrEqual(1);
});

test('broad soft-paint sampling reduces work while keeping the same nib silhouette',async({page})=>{
 await page.goto('/');const rows=await page.evaluate(async()=>{
  const {drawModernStroke}=await import('/src/engine/brushRaster.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{stockPresets}=await import('/src/core/brushes.ts');const rows=[];
  for(const id of ['marker','paint','eraser-soft'])for(const pressure of [false,true]){
   const s:any={...stockPresets.find(p=>p.id===id)!.settings,id:'sampling',kind:'stroke',tool:'brush',engineVersion:10,liveRefinementVersion:2,size:150,pressure,taperEnd:.05,stabilization:0,smoothness:0,points:Array.from({length:160},(_,i)=>({x:90+i*4.8,y:250+110*Math.sin(i/159*Math.PI*4),p:.15+.85*Math.sin(i/159*Math.PI)**2}))},g=strokeGeometry(s);
   const images=[],times=[],calls=[];
   for(const version of [undefined,1]){
    s.paintNibVersion=version;const c=document.createElement('canvas');c.width=960;c.height=520;const ctx=c.getContext('2d',{willReadFrequently:true})!;let count=0;const prototype=CanvasRenderingContext2D.prototype,gradient=prototype.createRadialGradient;prototype.createRadialGradient=function(...args:any[]){count++;return (gradient as any).apply(this,args);};
    const start=performance.now();drawModernStroke(ctx,s,'final',g);images.push(ctx.getImageData(0,0,960,520).data);times.push(performance.now()-start);calls.push(count);prototype.createRadialGradient=gradient;
   }
   let error=0,mass=0,max=0,supportDifference=0;for(let i=3;i<images[0].length;i+=4){const a=images[0][i],b=images[1][i];error+=Math.abs(a-b);mass+=a;max=Math.max(max,Math.abs(a-b));if((a>16)!==(b>16))supportDifference++;}
   rows.push({id,pressure,relativeError:error/mass,max,supportDifference,times,calls});
  }return rows;
 });console.log('PAINT_SAMPLING',JSON.stringify(rows));for(const r of rows){expect(r.calls[1],JSON.stringify(r)).toBeLessThan(r.calls[0]*.5);expect(r.relativeError,JSON.stringify(r)).toBeLessThan(.025);expect(r.supportDifference,JSON.stringify(r)).toBeLessThan(1200);}
});

test('the real paint inspector and pen capture use the optimized renderer at maximum size',async({page})=>{
 await page.goto('/');await page.getByLabel('Brush category',{exact:true}).selectOption('Paint');
 for(const id of ['flat','marker','paint','dry','watercolor','airbrush']){
  await page.getByLabel('Brush preset',{exact:true}).selectOption(id);const size=page.getByLabel('Size exact value',{exact:true});await size.fill('150');await size.press('Enter');await expect(size).toHaveValue('150');
 }
 const r=await page.evaluate(async()=>{
  const m=await import('/src/core/model.ts'),{DocumentStore}=await import('/src/core/history.ts'),{StudioEngine}=await import('/src/engine/StudioEngine.ts'),{stockPresets}=await import('/src/core/brushes.ts');
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:1000px;height:650px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;const p=m.newProject('Paint input'),store=new DocumentStore(p),e:any=new StudioEngine(c,store,()=>{});e.setView({x:0,y:0,zoom:.5,rotation:0});let time=1000;const rows=[];
  const send=(type:string,x:number,y:number,pressure:number)=>{const ev=new PointerEvent(type,{pointerId:42,isPrimary:true,pointerType:'pen',button:0,buttons:type==='pointerup'?0:1,pressure,clientX:x,clientY:y});Object.defineProperty(ev,'timeStamp',{value:++time});c.dispatchEvent(ev);};
  for(const id of ['marker','paint','dry','watercolor','airbrush']){
   e.setInput('brush',{...stockPresets.find(p=>p.id===id)!.settings,size:150,stabilization:0,smoothness:0});send('pointerdown',100,240,.3);for(let i=1;i<=48;i++){send('pointermove',100+i*7,240+60*Math.sin(i/48*Math.PI*4),.2+.7*Math.sin(i/48*Math.PI)**2);if(i%4===0)e.render();}send('pointerup',436,240,0);e.render();
   const op:any=m.activeLayer(store.getSnapshot()).operations.at(-1);rows.push({id,version:op.paintNibVersion,pressure:op.pressure,points:op.points.length});
  }
  const before=e.renderer.composite(store.getSnapshot()).toDataURL();const loaded=m.validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));const {LayerRenderer}=await import('/src/engine/renderer.ts');const renderer=new LayerRenderer();const saved=renderer.composite(loaded).toDataURL()===before;store.undo();store.redo();const redo=e.renderer.composite(store.getSnapshot()).toDataURL()===before;e.dispose();renderer.clear();c.remove();return {rows,saved,redo};
 });for(const row of r.rows){expect(row.pressure).toBe(true);expect(row.points).toBe(50);if(['paint','marker'].includes(row.id))expect(row.version).toBe(1);}expect(r.saved).toBe(true);expect(r.redo).toBe(true);
});
