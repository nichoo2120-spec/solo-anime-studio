import {expect,test} from '@playwright/test';

test('all five oil brushes keep the displayed 50 px stroke and raw cursor position at release',async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {newProject}=await load('/src/core/model.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px';
  document.body.append(canvas);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(newProject('Oil release',640,480)),engine=new StudioEngine(canvas,store,()=>{});
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  const info=engine as any;
  const read=()=>canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
  const results=[];
  try{
   for(const preset of stockPresets.filter((p:any)=>p.category==='Oil / Impasto')){
    engine.setInput('brush',{...preset.settings,size:50,color:'#9e5836'});
    const send=(type:string,i:number)=>{
     const x=170+i*4,y=210+30*Math.sin(i*.14);
     canvas.dispatchEvent(new PointerEvent(type,{pointerId:14,pointerType:'pen',isPrimary:true,button:0,
      buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.25+.68*Math.sin(i*Math.PI/50),clientX:x,clientY:y}));
     return {x,y};
    };
    send('pointerdown',0);
    for(let i=1;i<=49;i++){send('pointermove',i);if(i%4===0)engine.render();}
    engine.render();const a=read(),endpoint=send('pointerup',49);
    engine.render();await engine.renderer.whenSettled();const b=read();
    const retained={x:info.cursor.x,y:info.cursor.y};
    results.push({id:preset.id,diff:a.reduce((n,v,i)=>n+Number(v!==b[i]),0),endpoint,retained});
    store.undo();engine.render();
   }
  }finally{engine.dispose();canvas.remove();}
  return results;
 });
 expect(results).toHaveLength(5);
 for(const result of results){
  expect.soft(result.diff,result.id).toBe(0);
  expect.soft(result.retained.x,result.id).toBeCloseTo(result.endpoint.x,5);
  expect.soft(result.retained.y,result.id).toBeCloseTo(result.endpoint.y,4);
 }
});

test('flat bristles turn across the path and tight loops stay inside the lighting range',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(p:string)=>import(p);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {stampPlan}=await load('/src/engine/stampBrush.ts');
  const {finalGeometry}=await load('/src/engine/geometryCache.ts');
  const settings=stockPresets.find((p:any)=>p.id==='oil-bristle').settings;
  const stroke=(points:any[])=>({...brushStrokeMetadata(settings,true),id:'oil-metrics',kind:'stroke',tool:'brush',
   size:50,opacity:1,response:1,pressure:true,pressureWidth:true,color:'#9e5836',points});
  const horizontal=stroke([{x:60,y:120,p:1},{x:240,y:120,p:1}]);
  const vertical=stroke([{x:120,y:60,p:1},{x:120,y:240,p:1}]);
  const make=()=>Object.assign(document.createElement('canvas'),{width:340,height:320}).getContext('2d',{willReadFrequently:true})!;
  const a=make(),b=make();
  drawStroke(a,horizontal);drawStroke(b,vertical);
  const width=(d:ImageData)=>[...d.data].filter((v,i)=>i%4===3&&v>128).length;
  const curve=stroke(Array.from({length:56},(_,i)=>{
   const t=i*.14;
   return {x:158+Math.cos(t)*43,y:155+Math.sin(t)*43,p:.26+.72*Math.sin(Math.PI*i/55)};
  }));
  const dabs=stampPlan(curve,finalGeometry(curve)).dabs;
  const middle=dabs.slice(2,-2);
  const heading=middle.map((p:any,i:number)=>{
   const q=dabs[i+1],r=dabs[i+3],t=Math.atan2(r.y-q.y,r.x-q.x);
   return Math.abs(Math.cos(t-(p.angle-Math.PI/2)));
  });
  const c=make();drawStroke(c,curve);
  // Across the fully covered interior, a horizontal pass must not have
  // regular luminance jumps along travel at tile or dab boundaries.
  const strip=a.getImageData(90,113,115,15).data;
  let maxStep=0;
  for(let y=0;y<15;y++)for(let x=1;x<115;x++){
   const k=(y*115+x)*4;
   if(strip[k+3]===255&&strip[k-1]===255)maxStep=Math.max(maxStep,Math.abs(strip[k]-strip[k-4]));
  }
  const pixels=c.getImageData(0,0,340,320).data;
  let darkest=255,brightest=0,count=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=253){darkest=Math.min(darkest,pixels[i]);brightest=Math.max(brightest,pixels[i]);count++;}
  return {horizontal:width(a.getImageData(150,0,1,320)),vertical:width(b.getImageData(0,150,340,1)),
   heading:Math.min(...heading),maxStep,count,darkest,brightest,finite:dabs.every((d:any)=>[d.x,d.y,d.rx,d.ry,d.angle].every(Number.isFinite)),
   minWidth:dabs[0].rx,maxWidth:Math.max(...dabs.map((d:any)=>d.rx))};
 });
 expect(Math.abs(result.horizontal-result.vertical)).toBeLessThanOrEqual(2);
 expect(result.heading).toBeGreaterThan(.85);
 expect(result.maxStep).toBeLessThanOrEqual(3);
 expect(result.finite).toBe(true);
 expect(result.minWidth).toBeLessThan(result.maxWidth*.65);
 expect(result.count).toBeGreaterThan(100);
 expect(result.darkest).toBeGreaterThanOrEqual(Math.floor(158*.56)-2);
 expect(result.brightest-result.darkest).toBeGreaterThan(15);
});
