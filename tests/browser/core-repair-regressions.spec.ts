import {test,expect} from '@playwright/test';
import {parkWheel} from './workspace';

test.beforeEach(async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',gp='/src/core/geometry.ts';
  const m=await import(mp),{DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{toScreen}=await import(gp);
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:600px;height:400px';document.body.append(c);
  let held=false,time=100;c.setPointerCapture=()=>{held=true;};c.hasPointerCapture=()=>held;c.releasePointerCapture=()=>{held=false;};
  const store=new DocumentStore(m.newProject('Core repair regression',800,600)),e=new StudioEngine(c,store,()=>{});await new Promise(requestAnimationFrame);e.setView({x:0,y:0,zoom:1,rotation:0});
  e.setInput('brush',{...e.brush,size:2,brushKind:'technical',stabilization:1,smoothness:100});
  const sample=(type:string,p:any,id=7)=>{const q=toScreen(p,e.view),event=new PointerEvent(type,{pointerId:id,isPrimary:true,button:0,pointerType:'mouse',clientX:q.x,clientY:q.y,bubbles:true});Object.defineProperty(event,'timeStamp',{value:++time});return event;};
  const send=(type:string,p:any,points:any[]=[])=>{const buffered=points.map(p=>sample(type,p)),event=sample(type,p);Object.defineProperty(event,'getCoalescedEvents',{value:()=>buffered});c.dispatchEvent(event);};
  (window as any).repair={m,store,e,c,send,sample};
 });
});

test('fast lasso retains the raw boundary at 100/400/800% and rotation, and transforms undo',async({page})=>{
 const result=await page.evaluate(()=>{
  const {e,store,send}= (window as any).repair,results=[];
  for(const zoom of [1,4,8])for(const rotation of [0,.7]){
   e.setView({x:15,y:20,zoom,rotation});e.setTool('lasso');
   const p=Array.from({length:101},(_,i)=>({x:200+80*Math.cos(i/100*Math.PI*2),y:200+60*Math.sin(i/100*Math.PI*2),p:1}));
   send('pointerdown',p[0]);send('pointermove',p[40],p.slice(1,41));send('pointerup',p[100],p.slice(41));
   const error=Math.max(...e.selection.map((q:any,i:number)=>Math.hypot(q.x-p[i].x,q.y-p[i].y))),before=store.getSnapshot();e.setTool('transform');e.setTransform({dx:10,dy:15,angle:20,scale:1.2});e.applySelection();const after=store.getSnapshot();store.undo();const undo=store.getSnapshot()===before;store.redo();results.push({error,undo,redo:store.getSnapshot()===after});
  }return results;
 });for(const r of result){expect(r.error).toBeLessThan(.00001);expect(r.undo&&r.redo).toBe(true);}
});

test('100 short hatch gestures commit once, retain separate undo steps and survive save/reopen',async({page})=>{
 const result=await page.evaluate(async()=>{
  const {m,e,store,send,c}= (window as any).repair;
  for(let i=0;i<100;i++){const p={x:40+i*3,y:120};send('pointerdown',p);send('pointerup',{x:p.x+.4,y:120.7});if(i%10===0)await new Promise(requestAnimationFrame);}
  const doc=store.getSnapshot(),ops=m.activeLayer(doc).operations,separate=ops.every((o:any,i:number)=>o.points.length===2&&Math.abs(o.points[0].x-(40+i*3))<.001),ids=new Set(ops.map((o:any)=>o.id)).size;
  for(let i=0;i<80;i++)store.undo();const remaining=m.activeLayer(store.getSnapshot()).operations.length;for(let i=0;i<80;i++)store.redo();const redo=JSON.stringify(store.getSnapshot())===JSON.stringify(doc);
  const pp='/src/core/persistence.ts';const {repository}=await import(pp);await repository.save(doc);const restored=(await repository.load(doc.id)).project;m.validateProject(restored);const saved=JSON.stringify(restored)===JSON.stringify(doc);e.dispose();c.remove();return {count:ops.length,separate,ids,remaining,redo,saved};
 });expect(result).toEqual({count:100,separate:true,ids:100,remaining:20,redo:true,saved:true});
});

test('captured pressure and preset settings stay stable until release; the next press uses new settings',async({page})=>{
 const result=await page.evaluate(()=>{
  const {m,e,store,c}= (window as any).repair;let time=100;
  const send=(type:string,x:number,pressure:number)=>{const ev=new PointerEvent(type,{pointerId:8,isPrimary:true,clientX:x,clientY:150,pointerType:'pen',pressure,button:0});Object.defineProperty(ev,'timeStamp',{value:++time});c.dispatchEvent(ev);};
  e.setInput('brush',{...e.brush,brushKind:'blue',color:'#0000ff',size:8,pressure:true});send('pointerdown',100,.5);
  e.setInput('brush',{...e.brush,brushKind:'mechanical',color:'#111111',size:3,pressure:false});send('pointermove',120,.8);send('pointerup',140,0);send('pointerdown',160,.3);send('pointerup',180,0);
  return m.activeLayer(store.getSnapshot()).operations.map((o:any)=>({kind:o.brushKind,color:o.color,size:o.size,pressure:o.pressure,end:o.points.at(-1).p}));
 });expect(result).toEqual([{kind:'blue',color:'#0000ff',size:8,pressure:true,end:expect.closeTo(.8,5)},{kind:'mechanical',color:'#111111',size:3,pressure:false,end:expect.closeTo(.3,5)}]);
});

test('commit listeners can start a new stroke without previous finalization clearing it',async({page})=>{
 const result=await page.evaluate(()=>{const {m,e,store,send}=(window as any).repair;let once=false;const off=store.subscribe(()=>{if(!once){once=true;send('pointerdown',{x:250,y:150});}});send('pointerdown',{x:100,y:100});send('pointerup',{x:120,y:110});send('pointermove',{x:270,y:160});send('pointerup',{x:290,y:170});off();return m.activeLayer(store.getSnapshot()).operations.map((o:any)=>o.points.at(-1).x);});expect(result).toEqual([120,290]);
});

test('capture failure still receives a release outside the canvas',async({page})=>{
 const result=await page.evaluate(()=>{const {m,e,store,send,c,sample}=(window as any).repair;c.setPointerCapture=()=>{throw Error('unavailable');};send('pointerdown',{x:100,y:100});window.dispatchEvent(sample('pointermove',{x:130,y:120}));window.dispatchEvent(sample('pointerup',{x:150,y:140}));return {drawing:e.drawing,points:m.activeLayer(store.getSnapshot()).operations[0].points.length};});expect(result).toEqual({drawing:false,points:3});
});

test('with both controls zero the live preview and committed stroke use identical pixels',async({page})=>{
 const result=await page.evaluate(()=>{const {m,e,store,send}=(window as any).repair;e.setInput('brush',{...e.brush,size:5,opacity:.65,stabilization:0,smoothness:0,brushKind:'mechanical',color:'#134b9a'});const points=Array.from({length:17},(_,i)=>({x:200+80*Math.cos(i/16*Math.PI*2),y:200+80*Math.sin(i/16*Math.PI*2)}));send('pointerdown',points[0]);send('pointermove',points[16],points.slice(1));e.render();const before=e.previewSurface.getContext('2d').getImageData(0,0,800,600).data;send('pointerup',points[16]);const after=e.renderer.get(m.activeLayer(store.getSnapshot()),store.getSnapshot()).getContext('2d').getImageData(0,0,800,600).data;let different=0;for(let i=0;i<before.length;i++)if(before[i]!==after[i])different++;return {different,version:m.activeLayer(store.getSnapshot()).operations[0].engineVersion};});expect(result).toEqual({different:0,version:10});
});

test('overlapping and late coalesced batches retain each valid sample in order for brush and lasso',async({page})=>{
 const result=await page.evaluate(()=>{const {m,e,store,c}=(window as any).repair,paths=[];for(const tool of ['brush','lasso']){e.setTool(tool);const make=(type:string,t:number,x:number,id=7)=>{const ev=new PointerEvent(type,{pointerId:id,isPrimary:true,clientX:x,clientY:150,pointerType:'mouse',button:0});Object.defineProperty(ev,'timeStamp',{value:t});return ev;};const a=make('pointermove',410,110),b=make('pointermove',430,130);c.dispatchEvent(make('pointerdown',400,100));Object.defineProperty(b,'getCoalescedEvents',{value:()=>[a,b]});c.dispatchEvent(b);const late=make('pointermove',420,120);Object.defineProperty(late,'getCoalescedEvents',{value:()=>[a,late,make('pointermove',425,999,8)]});c.dispatchEvent(late);c.dispatchEvent(make('pointerup',440,140));paths.push((tool==='brush'?m.activeLayer(store.getSnapshot()).operations.at(-1).points:e.selection).map((p:any)=>p.x));}return paths;});expect(result).toEqual([[100,110,120,130,140],[100,110,120,130,140]]);
});

test('rapid E/B keyboard changes produce alternating eraser/brush operations and painted pixels',async({page})=>{
 await page.evaluate(()=>{(window as any).repair.e.dispose();(window as any).repair.c.remove();});await parkWheel(page);
 await page.getByLabel('Brush preset',{exact:true}).selectOption('mechanical');
 await page.evaluate(()=>{
  const c=document.querySelector('canvas[aria-label="Drawing canvas"]') as HTMLCanvasElement;c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;const r=c.getBoundingClientRect();
  for(let i=0;i<30;i++)for(const key of ['e','b']){c.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));for(const [type,x] of [['pointerdown',r.width*.5],['pointerup',r.width*.6]] as const)c.dispatchEvent(new PointerEvent(type,{pointerId:1,isPrimary:true,pointerType:'mouse',button:0,clientX:r.left+x,clientY:r.top+r.height*.5}));}
 });
 await page.getByRole('button',{name:'File',exact:true}).click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download editable backup',exact:true}).click()]);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream!)chunks.push(chunk);const doc=JSON.parse(Buffer.concat(chunks).toString()),ops=doc.layers.find((l:any)=>l.name==='Line').operations;expect(ops).toHaveLength(60);ops.forEach((o:any,i:number)=>{expect(o.tool).toBe(i%2?'brush':'eraser');if(i%2)expect(o.brushKind).toBe('graphite-mechanical');});
 const painted=await page.evaluate(async doc=>{const rp='/src/engine/renderer.ts';const {LayerRenderer}=await import(rp),renderer=new LayerRenderer();await renderer.prepare(doc);const l=doc.layers.find((l:any)=>l.name==='Line'),ctx=renderer.get(l,doc).getContext('2d'),image=ctx.getImageData(0,0,doc.width,doc.height).data;return image.some((v:number,i:number)=>i%4===3&&v>0);},doc);expect(painted).toBe(true);
});
