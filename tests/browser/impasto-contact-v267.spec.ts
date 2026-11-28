import {expect,test} from '@playwright/test';

test('three oil gestures ignore hover, stale pen samples and a pen-up away from contact',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {newProject,activeLayer}=await load('/src/core/model.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;left:0;top:0;width:640px;height:300px';
  document.body.append(canvas);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(newProject('Oil contact gaps',640,300)),engine=new StudioEngine(canvas,store,()=>{});
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  const results=[];
  try{
   for(const preset of stockPresets.filter((p:any)=>p.category==='Oil / Impasto')){
    engine.setInput('brush',{...preset.settings,size:28,color:'#b74462'});
    function event(type:string,x:number,pressure:number,clock:number,buttons=pressure?1:0){
     const e=new PointerEvent(type,{pointerId:14,pointerType:'pen',isPrimary:true,button:0,buttons,pressure,clientX:x,clientY:130});
     Object.defineProperty(e,'timeStamp',{value:clock});return e;
    }
    for(const [i,start] of [60,270,480].entries()){
     const t=100*i+100,stale=event('pointermove',start-100,.9,t-10);
     canvas.dispatchEvent(event('pointermove',start-75,0,t-1));
     canvas.dispatchEvent(event('pointerdown',start,.9,t));
     const move=event('pointermove',start+25,.9,t+5);
     Object.defineProperty(move,'getCoalescedEvents',{value:()=>[stale,event('pointermove',start-70,0,t+1),move]});
     canvas.dispatchEvent(move);engine.render();
     canvas.dispatchEvent(event('pointerup',start+155,0,t+10));engine.render();
    }
    const doc=store.getSnapshot(),layer=activeLayer(doc);
    const raster=engine.renderer.get(layer,doc).getContext('2d')!;
    const count=(x:number,w:number)=>raster.getImageData(x,105,w,50).data.filter((alpha,i)=>i%4===3&&alpha>0).length;
    results.push({id:preset.id,gaps:count(112,130)+count(322,130),ink:count(48,51)+count(258,51)+count(468,51),
     points:layer.operations.map((op:any)=>op.points.map((p:any)=>p.x))});
    for(let i=0;i<3;i++)store.undo();
    engine.render();
   }
  }finally{engine.dispose();canvas.remove();}
  return results;
 });
 expect(result).toHaveLength(5);
 for(const preset of result){
  expect(preset.points,preset.id).toEqual([[60,85],[270,295],[480,505]]);
  expect(preset.gaps,preset.id).toBe(0);
  expect(preset.ink,preset.id).toBeGreaterThan(50);
 }
});

test('oil pressure picks up pigment before laying down fresh colour and rotates with a tip offset',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {compositePaintStroke}=await load('/src/engine/paintCompositing.ts');
  const {stampPlan}=await load('/src/engine/stampBrush.ts');
  const {mapPenPressure}=await load('/src/core/penPressure.ts');
  const {brushCursorTip}=await load('/src/engine/brushTipCursor.ts');
  const {finalGeometry}=await load('/src/engine/geometryCache.ts');
  const settings=stockPresets.find((preset:any)=>preset.id==='oil-flat').settings;
  const make=(p:number)=>({...brushStrokeMetadata(settings,true),id:'oil-load',kind:'stroke',tool:'brush',size:90,opacity:1,
   pressure:true,pressureWidth:true,response:1,color:'#113fe8',points:[{x:60,y:75,p},{x:120,y:75,p},{x:220,y:75,p}]});
  const context=()=>Object.assign(document.createElement('canvas'),{width:280,height:150}).getContext('2d',{willReadFrequently:true})!;
  function render(s:any,withPaint:boolean,full=false){
   const ctx=context(),mask=context();
   if(withPaint){
    ctx.fillStyle='#ef3910';ctx.fillRect(0,0,130,150);
    ctx.fillStyle='#28aa30';ctx.fillRect(130,0,150,150);
   }
   drawStroke(mask,s,'final',undefined,false,true);compositePaintStroke(ctx,mask.canvas,s);
   return full?ctx.getImageData(0,0,280,150).data:ctx.getImageData(136,75,1,1).data;
  }
  const light=make(mapPenPressure(.22)),heavy=make(mapPenPressure(.98));
  const horizontal=stampPlan(heavy,finalGeometry(heavy)).dabs.at(1);
  const verticalStroke={...heavy,tsAngle:30,points:heavy.points.map((p:any)=>({...p,x:100,y:p.x}))};
  const vertical=stampPlan(verticalStroke,finalGeometry(verticalStroke)).dabs.at(1);
  const tip=brushCursorTip({...settings,tsAngle:30},false);
  const hover=tip({direction:1,pressure:1,speed:1}),moving=tip({direction:0,pressure:1,speed:1,drawing:true});
  const mask=hover.mask.mask(128);
  const mouse={...heavy,pressure:false},previous={...mouse,impastoVersion:4};
  const legacy=render(previous,true,true);
  const footprint=context();
  drawStroke(footprint,light);
  const contactCoverage=footprint.getImageData(87,75,1,1).data[3];
  return {contactCoverage,light:render(light,true),blank:render(light,false),heavy:render(heavy,true),
   difference:vertical.angle-horizontal.angle,hover:hover.angle,moving:moving.angle,
   corner:mask.alpha[0],center:mask.alpha[64*mask.width+64],mouseDifference:render(mouse,true,true).reduce((sum,pixel,index)=>sum+Number(pixel!==legacy[index]),0)};
 });
 expect(result.light[0]).toBeGreaterThan(65);
 expect(result.light[2]).toBeLessThan(55);
 expect(result.blank[3]).toBe(0);
 expect(result.contactCoverage).toBeGreaterThan(200);
 expect(result.heavy[2]).toBeGreaterThan(140);
 expect(result.difference).toBeCloseTo(Math.PI*2/3,5);
 expect(result.hover).toBeCloseTo(Math.PI/6,5);
 expect(result.moving).toBeCloseTo(Math.PI*2/3,5);
 expect(result.center).toBe(255);
 expect(result.corner).toBeLessThan(200);
 expect(result.mouseDifference).toBe(0);
});
