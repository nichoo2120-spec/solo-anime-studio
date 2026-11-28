import {expect,test} from '@playwright/test';

test('oil presets retain opacity, relight their ridges and reload their material',async({page})=>{
 await page.goto('/');
 const metrics=await page.evaluate(async()=>{
  const load=(p:string)=>import(p);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke,LayerRenderer}=await load('/src/engine/renderer.ts');
  const {newProject,appendOperation,activeLayer,validateProject}=await load('/src/core/model.ts');
  const make=()=>Object.assign(document.createElement('canvas'),{width:560,height:420});
  const makeStroke=(s:any)=>({...brushStrokeMetadata(s,true),id:'impasto-regression',kind:'stroke',tool:'brush',
   size:140,opacity:s.opacity,response:s.response,pressure:s.pressure,pressureWidth:s.pressureWidth,color:'#804020',points:[{x:120,y:180,p:.18},{x:220,y:180,p:1},{x:315,y:190,p:1},{x:405,y:245,p:.25}]});
  const pixels=(stroke:any)=>{
   const ctx=make().getContext('2d',{willReadFrequently:true})!;
   drawStroke(ctx,stroke);
   return ctx.getImageData(0,0,560,420).data;
  };
  const base=makeStroke(stockPresets.find((p:{id:string})=>p.id==='oil-bristle').settings);
  const a=pixels(base),b=pixels({...base,oilLight:45});
  const project=appendOperation(newProject('Oil test',560,420),base);
    const restored=validateProject(JSON.parse(JSON.stringify(project))),saved=activeLayer(restored).operations[0];
  const heightAt=(doc:any)=>{
   const renderer=new LayerRenderer();
   const plane=renderer.getImpastoHeight(activeLayer(doc),doc);
   return [...plane.getContext('2d')!.getImageData(220,176,1,1).data];
  };
  const layerHeight=heightAt(project),replayedHeight=heightAt(restored);
  const coveredHeight=heightAt(appendOperation(project,{...base,id:'deeper',oilDepth:1}));
  const replay=pixels(saved);
  const opaque=a[4*(180*560+220)+3];
  const colourDifference=a.reduce((n,v,i)=>n+Number(v!==b[i]),0);
  const replayDifference=a.reduce((n,v,i)=>n+Number(v!==replay[i]),0);
  return {opaque,colourDifference,replayDifference,layerHeight,replayedHeight,coveredHeight,depth:saved.oilDepth,presets:stockPresets.filter((p:any)=>p.category==='Oil / Impasto').length};
 });
 expect(metrics.presets).toBe(5);
 expect(metrics.opaque).toBe(255);
 expect(metrics.colourDifference).toBeGreaterThan(1000);
 expect(metrics.replayDifference).toBe(0);
 expect(metrics.depth).toBe(.83);
 expect(metrics.layerHeight).toEqual(metrics.replayedHeight);
 expect(metrics.layerHeight[3]).toBe(255);
 expect(metrics.coveredHeight[0]).toBeGreaterThan(metrics.layerHeight[0]);
});

test('records oil frame and release timings for all presets at three sizes',async({page})=>{
 test.setTimeout(150000);
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const load=(p:string)=>import(p);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {newProject}=await load('/src/core/model.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const nextFrame=()=>new Promise(requestAnimationFrame);
  const rows=[];
  for(const preset of stockPresets.filter((p:any)=>p.category==='Oil / Impasto'))for(const size of [150,300,500]){
   const canvas=document.createElement('canvas');
   canvas.style.cssText='position:fixed;inset:0;width:1120px;height:700px';
   document.body.append(canvas);
   canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
   const engine=new StudioEngine(canvas,new DocumentStore(newProject('Oil benchmark',1120,700)),()=>{});
   const send=(type:string,x:number)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:18,isPrimary:true,pointerType:'pen',
    clientX:x,clientY:330+Math.sin(x/34)*20,button:0,buttons:type==='pointerup'?0:1,pressure:.7}));
   try{
    engine.setView({x:0,y:0,zoom:1,rotation:0});
    engine.setInput('brush',{...preset.settings,size});
    await nextFrame();await nextFrame();
    const render=engine.render.bind(engine),costs:number[]=[];
    let first=0,begin=performance.now();
    engine.render=()=>{const start=performance.now();render();if(engine.drawing){costs.push(performance.now()-start);if(!first)first=performance.now()-begin;}};
    begin=performance.now();send('pointerdown',350);
    for(let i=1;i<=20;i++){send('pointermove',350+i*12);await nextFrame();}
    const release=performance.now();send('pointerup',590);engine.render();await engine.renderer.whenSettled();
    const penUp=performance.now()-release;
    const undoStart=performance.now();engine.historyNavigation('undo');engine.render();
    costs.sort((a,b)=>a-b);
    rows.push({preset:preset.id,size,p95:costs[Math.ceil(costs.length*.95)-1],first,penUp,undo:performance.now()-undoStart});
   }finally{engine.dispose();canvas.remove();}
  }
  return rows;
 });
 console.log('IMPASTO_PERF '+JSON.stringify(rows));
 expect(rows).toHaveLength(15);
});
