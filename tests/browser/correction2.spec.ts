import {test,expect} from '@playwright/test';

test('an unchanged ResizeObserver notification cannot finish a stroke or first lasso',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const ep='/src/engine/StudioEngine.ts',mp='/src/core/model.ts',hp='/src/core/history.ts';const {StudioEngine}=await import(ep),m=await import(mp),{DocumentStore}=await import(hp);
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:600px;height:400px';document.body.append(canvas);canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject()),engine=new StudioEngine(canvas,store,()=>{});await new Promise(requestAnimationFrame);engine.setView({x:0,y:0,zoom:1,rotation:0});
  const send=(type:string,x:number,y:number)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:5,isPrimary:true,pointerType:'mouse',button:0,clientX:x,clientY:y}));
  send('pointerdown',100,100);(engine as any).resize();send('pointermove',150,150);send('pointerup',200,100);const stroke=m.activeLayer(store.getSnapshot()).operations[0];engine.setTool('lasso');send('pointerdown',100,100);(engine as any).resize();send('pointermove',200,100);send('pointermove',200,200);send('pointerup',100,200);const result={strokePoints:stroke.points.length,endpoint:stroke.points.at(-1),selection:engine.selection.length};engine.dispose();canvas.remove();return result;
 });expect(result.strokePoints).toBe(3);expect(result.endpoint).toEqual({x:200,y:100,p:1});expect(result.selection).toBe(4);
});

test('the two controls independently change suitable noisy stroke geometry',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{const gp='/src/engine/strokeGeometry.ts';const {strokeGeometry}=await import(gp),points=Array.from({length:81},(_,i)=>({x:100+i*3,y:200+30*Math.sin(i/80*Math.PI*2)+(i%2?5:-5),p:1})),base={id:'levels',kind:'stroke',tool:'brush',engineVersion:4,size:4,color:'#000000',opacity:1,pressure:false,response:1,points};const geometries=[0,25,50,75,100].map(smoothness=>JSON.stringify(strokeGeometry({...base,stabilization:1,smoothness})));return new Set(geometries).size;});expect(result).toBe(5);
});
