import {test,expect} from '@playwright/test';

test('a Wacom pen with isPrimary false draws immediately after brush preset changes',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const m=await import('/src/core/model.ts');
  const {DocumentStore}=await import('/src/core/history.ts');
  const {StudioEngine}=await import('/src/engine/StudioEngine.ts');
  const {stockPresets}=await import('/src/core/brushes.ts');
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;left:0;top:0;width:600px;height:400px';
  document.body.append(canvas);
  canvas.setPointerCapture=()=>{};
  canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject());
  const engine=new StudioEngine(canvas,store,()=>{});
  await new Promise(requestAnimationFrame);
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  let stamp=1000,pointerId=32;
  const pen=(type:string,x:number,primary=false)=>{
   const event=new PointerEvent(type,{pointerId,pointerType:'pen',button:0,buttons:type==='pointerup'?0:1,isPrimary:primary,pressure:type==='pointerup'?0:0.6,clientX:x,clientY:110,bubbles:true});
   Object.defineProperty(event,'timeStamp',{value:++stamp});
   canvas.dispatchEvent(event);
  };
  const result=[];
  for(const presetId of ['mechanical','g-pen','mapping','g-pen']){
   const preset=stockPresets.find(p=>p.id===presetId)!;
   engine.setInput('brush',{...preset.settings,pressure:false},{id:preset.id,name:preset.name});
   pen('pointerdown',100+result.length*75);
   pen('pointermove',130+result.length*75);
   pen('pointerup',160+result.length*75);
   result.push({preset:presetId,operations:m.activeLayer(store.getSnapshot()).operations.length,pointerId:engine.diagnosticSnapshot().pointerId});
   pointerId++;
  }
  engine.dispose();canvas.remove();
  return result;
 });
 expect(result.map(row=>row.operations)).toEqual([1,2,3,4]);
 expect(result.map(row=>row.pointerId)).toEqual([undefined,undefined,undefined,undefined]);
});

test('secondary touch and secondary pen cannot steal an active stroke',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const m=await import('/src/core/model.ts');
  const {DocumentStore}=await import('/src/core/history.ts');
  const {StudioEngine}=await import('/src/engine/StudioEngine.ts');
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;left:0;top:0;width:600px;height:400px';
  document.body.append(canvas);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject()),engine=new StudioEngine(canvas,store,()=>{});
  await new Promise(requestAnimationFrame);engine.setView({x:0,y:0,zoom:1,rotation:0});
  let t=1000;
  const send=(type:string,id:number,pointerType:string,primary:boolean,x:number)=>{
   const event=new PointerEvent(type,{pointerId:id,pointerType,button:0,isPrimary:primary,pressure:0.5,clientX:x,clientY:125});
   Object.defineProperty(event,'timeStamp',{value:++t});canvas.dispatchEvent(event);
  };
  send('pointerdown',42,'pen',false,100);
  const ownerBefore=engine.diagnosticSnapshot().pointerId;
  send('pointerdown',50,'pen',false,300);
  send('pointerdown',51,'touch',false,360);
  const ownerAfter=engine.diagnosticSnapshot().pointerId;
  send('pointermove',42,'pen',false,150);
  send('pointerup',42,'pen',false,180);
  const operations=m.activeLayer(store.getSnapshot()).operations;
  engine.dispose();canvas.remove();
  return {ownerBefore,ownerAfter,operations:operations.length,firstX:operations[0]?.points[0]?.x,lastX:operations[0]?.points.at(-1)?.x};
 });
 expect(result).toMatchObject({ownerBefore:42,ownerAfter:42,operations:1,firstX:100,lastX:180});
});
