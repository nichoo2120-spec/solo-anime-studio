import {expect,test} from '@playwright/test';
test.use({launchOptions:{args:['--disable-gpu']}});
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
  for(const preset of stockPresets.filter((p:any)=>p.category==='Oil / Impasto'))for(const size of [50,150,300,500]){
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
 expect(rows).toHaveLength(20);
});
