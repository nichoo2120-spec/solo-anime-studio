import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const ep='/src/engine/StudioEngine.ts',mp='/src/core/model.ts',hp='/src/core/history.ts',gp='/src/engine/strokeGeometry.ts',vp='/src/core/geometry.ts',fp='/tests/fixtures/drawingSequences.ts';
  const {StudioEngine}=await import(ep),m=await import(mp),{DocumentStore}=await import(hp),g=await import(gp),{toScreen}=await import(vp),fixtures=await import(fp);
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px';document.body.append(canvas);let held=false;canvas.setPointerCapture=()=>{held=true;};canvas.hasPointerCapture=()=>held;canvas.releasePointerCapture=()=>{held=false;};
  const store=new DocumentStore(m.newProject('Replay',640,480)),engine=new StudioEngine(canvas,store,()=>{});await new Promise(requestAnimationFrame);engine.setView({x:0,y:0,zoom:1,rotation:0});engine.setInput('brush',{...engine.brush,size:2,brushKind:'technical',smoothness:50,stabilization:.25});
  const event=(type:string,p:any,index:number)=>{const q=toScreen(p,engine.view),ev=new PointerEvent(type,{pointerId:7,pointerType:'mouse',isPrimary:true,button:0,clientX:q.x,clientY:q.y,buttons:type==='pointerup'?0:1});Object.defineProperty(ev,'timeStamp',{value:1000+index*4});return ev;};
  const send=(type:string,points:any[],index:number,from=index)=>{const ev=event(type,points[index],index),samples=points.slice(from,index+1).map((p:any,i:number)=>event('pointermove',p,from+i));Object.defineProperty(ev,'getCoalescedEvents',{value:()=>samples});canvas.dispatchEvent(ev);};
  const replay=(points:any[],batch=4,notify=false)=>{send('pointerdown',points,0);if(notify)(engine as any).resize();let from=1;for(let index=batch;index<points.length-1;index+=batch){send('pointermove',points,index,from);from=index+1;}send('pointerup',points,points.length-1,from);};
  (window as any).fixture={m,g,fixtures,canvas,store,engine,event,send,replay};
 });
});

test('100 exact replays each of circle13/circle30/S/hair/V/Z are deterministic with pending RAF and nearby autosave',async({page})=>{
 test.setTimeout(120000);const result=await page.evaluate(async()=>{
  const {m,g,fixtures,canvas,store,engine,send,replay}=(window as any).fixture;
  const originalRAF=window.requestAnimationFrame,callbacks:FrameRequestCallback[]=[];window.requestAnimationFrame=(cb)=>{callbacks.push(cb);return callbacks.length+10000;};
  const ap='/src/core/AutosaveWriter.ts',pp='/src/core/persistence.ts';const {AutosaveWriter}=await import(ap),{repository}=await import(pp),writer=new AutosaveWriter(),counts:any={};let mismatch=0,sampleLoss=0,endpoints=0,asyncSave:Promise<unknown>|undefined;
  try{
   engine.diagnostics.start();
   for(const name of ['circle13','circle30','fastS','hair5','v3','z4']){const points=fixtures.sequences[name];let expected='';counts[name]=0;
    for(let run=0;run<100;run++){
     if(run===50){send('pointerdown',points,0);asyncSave=writer.save(store.getSnapshot());send('pointerup',points,points.length-1,1);}else replay(points,run%2?2:40,run%3===0);
     const op=m.activeLayer(store.getSnapshot()).operations.at(-1),actual=JSON.stringify(g.strokeGeometry(op));if(!run)expected=actual;else if(actual!==expected)mismatch++;
     if(op.points.length!==points.length||JSON.stringify(op.points)!==JSON.stringify(points))sampleLoss++;if(JSON.stringify(g.strokeGeometry(op).points.at(-1))!==JSON.stringify(points.at(-1)))endpoints++;counts[name]++;
     if(run===99)for(const callback of callbacks.splice(0))callback(performance.now());
    }
   }
   await asyncSave;await writer.save(store.getSnapshot());const restored=(await repository.load(store.getSnapshot().id)).project;
   const consistent=restored.layers.every((l:any)=>l.operations.every((op:any)=>op.kind!=='stroke'||JSON.stringify(g.strokeGeometry(op))===JSON.stringify(g.strokeGeometry(m.activeLayer(store.getSnapshot()).operations.find((s:any)=>s.id===op.id)))));
   const traces=engine.diagnostics.export().traces,traceCheck=traces.every((trace:any)=>trace.reason==='release'&&trace.source.length===4&&trace.gestureId&&trace.events.at(-1).dispatch.type==='pointerup'&&trace.geometry);
   return {counts,mismatch,sampleLoss,endpoints,saved:consistent,count:m.activeLayer(restored).operations.length,traces:traceCheck};
  }finally{window.requestAnimationFrame=originalRAF;writer.dispose();engine.dispose();canvas.remove();}
 });expect(result).toEqual({counts:{circle13:100,circle30:100,fastS:100,hair5:100,v3:100,z4:100},mismatch:0,sampleLoss:0,endpoints:0,saved:true,count:600,traces:true});
});

test('100 first-gesture star/circle/concave lassos retain boundaries and enclosed pixels at transformed views',async({page})=>{
 test.setTimeout(90000);const result=await page.evaluate(()=>{
  const {m,fixtures,store,engine,replay}=(window as any).fixture;let errors=0;const pixels=[];
  for(const name of ['star','circle13','concave']){
   const points=fixtures.sequences[name];for(let run=0;run<100;run++){engine.setInput('brush',{...engine.brush,stabilization:1,smoothness:100});engine.setTool('lasso');engine.setView({x:12,y:18,zoom:[1,4,8][run%3],rotation:run%2?Math.PI/6:0});replay(points,run%2?2:40,true);if(engine.selection.length!==points.length||engine.selection.some((p:any,i:number)=>Math.hypot(p.x-points[i].x,p.y-points[i].y)>1e-8))errors++;}
   const inside=name==='concave'?{x:120,y:200}:{x:300,y:260},outside={x:520,y:410};let doc=m.newProject('Lasso pixels',640,480);for(const p of [inside,outside])doc=m.appendOperation(doc,{id:m.uid(),kind:'stroke',tool:'brush',engineVersion:4,points:[{...p,p:1}],size:8,opacity:1,color:'#000000',pressure:false,response:1});store.replace(doc);engine.setView({x:0,y:0,zoom:1,rotation:0});engine.setTool('lasso');replay(points,40);engine.setTool('transform');engine.setTransform({dx:12,dy:0});engine.applySelection();const after=store.getSnapshot(),ctx=engine.renderer.get(m.activeLayer(after),after).getContext('2d'),old=ctx.getImageData(inside.x,inside.y,1,1).data[3],moved=ctx.getImageData(inside.x+12,inside.y,1,1).data[3],kept=ctx.getImageData(outside.x,outside.y,1,1).data[3];store.undo();const undo=store.getSnapshot()===doc;store.redo();pixels.push({old,moved,kept,undo,redo:store.getSnapshot()===after});
  }return {errors,pixels};
 });expect(result.errors).toBe(0);for(const p of result.pixels)expect(p).toEqual({old:0,moved:255,kept:255,undo:true,redo:true});
});

test('100 fixed eight-hatch sequences commit 800 separate strokes and survive undo/redo/save/reopen',async({page})=>{
 test.setTimeout(90000);const result=await page.evaluate(async()=>{const {m,g,fixtures,store,engine,replay}=(window as any).fixture;engine.request=()=>{};const expected:string[]=[];let mismatch=0;for(let run=0;run<100;run++)for(const [index,points] of fixtures.sequences.hatches.entries()){replay(points,40,true);const op=m.activeLayer(store.getSnapshot()).operations.at(-1);const geometry=JSON.stringify(g.strokeGeometry(op));if(!run)expected[index]=geometry;else if(expected[index]!==geometry)mismatch++;if(op.points.length!==2||JSON.stringify(op.points)!==JSON.stringify(points))mismatch++;}const doc=store.getSnapshot(),count=m.activeLayer(doc).operations.length,ids=new Set(m.activeLayer(doc).operations.map((o:any)=>o.id)).size;for(let i=0;i<80;i++)store.undo();const remaining=m.activeLayer(store.getSnapshot()).operations.length;for(let i=0;i<80;i++)store.redo();const redo=JSON.stringify(store.getSnapshot())===JSON.stringify(doc);const pp='/src/core/persistence.ts';const {repository}=await import(pp);await repository.save(doc);const loaded=(await repository.load(doc.id)).project;return {count,ids,mismatch,remaining,redo,saved:JSON.stringify(loaded)===JSON.stringify(doc)};});expect(result).toEqual({count:800,ids:800,mismatch:0,remaining:720,redo:true,saved:true});
});
