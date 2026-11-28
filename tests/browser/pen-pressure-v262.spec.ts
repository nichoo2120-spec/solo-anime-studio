import {expect,test} from '@playwright/test';

test('coalesced tablet pressure is stored on the stroke before brush pressure controls',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(p:string)=>import(p);
  const {newProject,activeLayer}=await load('/src/core/model.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {penPresets,setPenSettings,penSettings,mapPenPressure}=await load('/src/core/penPressure.ts');
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;inset:0;width:640px;height:480px';
  document.body.append(canvas);
  canvas.setPointerCapture=()=>{};
  const store=new DocumentStore(newProject('Pressure test',640,480));
  const engine=new StudioEngine(canvas,store,()=>{});
  const original=penSettings();
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  engine.setInput('brush',{...stockPresets.find((p:{id:string})=>p.id==='hb').settings,pressure:true,size:32});
  const profile={curve:penPresets.Normal,min:0,max:1};
  setPenSettings(profile);
  function draw(device:string,y:number){
   const event=(type:string,x:number,pressure:number)=>new PointerEvent(type,{
    isPrimary:true,pointerId:20,pointerType:device,clientX:x,clientY:y,button:0,
    buttons:type==='pointerup'?0:1,pressure});
   canvas.dispatchEvent(event('pointerdown',85,.02));
   const samples=[event('pointermove',100,.22),event('pointermove',115,.62),event('pointermove',130,1),event('pointermove',145,.25)];
   const move=samples.at(-1)!;
   Object.defineProperty(move,'getCoalescedEvents',{value:()=>samples});
   canvas.dispatchEvent(move);
   canvas.dispatchEvent(event('pointerup',145,0));
   return activeLayer(store.getSnapshot()).operations.at(-1).points.map((p:{p:number})=>p.p);
  }
  try{return {pen:draw('pen',80),mouse:draw('mouse',220),
   expected:[.02,.22,.62,1,.25].map(raw=>mapPenPressure(raw,profile))};}
  finally{setPenSettings(original);engine.dispose();canvas.remove();}
 });
 expect(result.pen).toHaveLength(result.expected.length);
 result.expected.forEach((p:number,i:number)=>expect(result.pen[i]).toBeCloseTo(p,7));
 expect(result.mouse.length).toBeGreaterThanOrEqual(5);
 expect(result.mouse.every((p:number)=>p===1)).toBe(true);
});
