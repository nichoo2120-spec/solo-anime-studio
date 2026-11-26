import {selectBrushOption,openBrushSettings} from '../brush-workspace.mjs';
import {expect,test} from '@playwright/test';

test('Ink Paint edges stay narrow and live, commit and redo agree at DPR 2',async({browser})=>{
 const context=await browser.newContext({deviceScaleFactor:2});
 try{
  const page=await context.newPage();
  await page.goto('/');
  const rows=await page.evaluate(async()=>{
   const mp='/src/core/model.ts',ep='/src/engine/InkDisplay.ts',rp='/src/engine/renderer.ts',bp='/src/core/brushes.ts',tp='/src/core/paintTips.ts',gp='/src/engine/strokeGeometry.ts';
   const {newProject,activeLayer}=await import(mp),{InkDisplay}=await import(ep),{LayerRenderer}=await import(rp);
   const {stockPresets}=await import(bp),{brushStrokeMetadata}=await import(tp),{strokeGeometry}=await import(gp);
   const scales=[.75,1,1.5,2];
   const output=[];
   for(const id of ['brush-pen','g-pen','mapping','ink-marker']){
    for(const zoom of scales){
     for(const mode of id==='brush-pen'?['low','off','normal']:['low']){
      const size=zoom===.75?5:zoom===1?20:60;
      const project=newProject('Ink display',260,150),layer=activeLayer(project),renderer=new LayerRenderer();
      const s=stockPresets.find((p:{id:string})=>p.id===id).settings;
      const xStep=8,y=74.19;
      const stroke={
       ...brushStrokeMetadata({...s,inkAntialiasing:mode},true),id:'ink-edge',kind:'stroke',tool:'brush',brushKind:s.brushKind,
       response:s.response,size,opacity:1,color:'#132038',pressure:true,pressureWidth:true,taperStart:s.taperStart,taperEnd:s.taperEnd,
       captureZoom:zoom,stabilization:.31,smoothness:27,
       points:Array.from({length:24},(_,i)=>({x:26+i*xStep,y:y+Math.max(0,i-16)**2*.18,p:1})),
      };
      const scale=window.devicePixelRatio*zoom;
      const base=()=>{
       const c=document.createElement('canvas');c.width=Math.ceil(260*scale);c.height=Math.ceil(150*scale);
       return c.getContext('2d',{willReadFrequently:true})!;
      };
      const ctx=base(),ink=new InkDisplay();
      const read=()=>ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
      const reset=()=>{ctx.resetTransform();ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.setTransform(scale,0,0,scale,.23,.37);};
      reset();
      const short={...stroke,points:stroke.points.slice(0,12)};
      ink.paint(ctx,layer,project,short,strokeGeometry(short,'live'),renderer);
      reset();const live=ink.paint(ctx,layer,project,stroke,strokeGeometry(stroke,'live'),renderer),livePixels=read();
      const committed={...layer,operations:[structuredClone(stroke)]};
      reset();const final=ink.paint(ctx,committed,project,undefined,undefined,renderer),finalPixels=read();
      reset();ink.paint(ctx,layer,project,undefined,undefined,renderer);
      reset();const cold=new InkDisplay();cold.paint(ctx,committed,project,undefined,undefined,renderer);const coldPixels=read();
      const column=ctx.getImageData(Math.floor(105*scale),0,1,ctx.canvas.height).data;
      const span=(target:number)=>{
       for(let i=1;i<column.length/4;i++){
        const a=column[(i-1)*4+3]/255,b=column[i*4+3]/255;
        if(a<target&&b>=target)return i-1+(target-a)/(b-a);
       }
       return -1;
      };
      const diff=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.reduce((n,v,i)=>n+Number(v!==b[i]),0);
      output.push({id,zoom,mode,live,final,pixels:diff(livePixels,finalPixels),cold:diff(finalPixels,coldPixels),edge:span(.9)-span(.1),solid:span(.9)>0});
      ink.clear();cold.clear();
     }
    }
   }
   return output;
  });
  for(const row of rows){
   const label=`${row.id} ${row.zoom}x ${row.mode}`;
   expect(row,label).toMatchObject({live:true,final:true,pixels:0,cold:0,solid:true});
   expect(row.edge,label).toBeLessThanOrEqual(2);
  }
 }finally{await context.close();}
});

test('Brush Pen exposes default edge controls and saves them per preset',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Drawing canvas',{exact:true}).waitFor();
 await selectBrushOption(page,'Brush category','Ink');
 await selectBrushOption(page,'Brush preset','brush-pen');
 await openBrushSettings(page);
 const panel=page.getByRole('region',{name:'Brush Settings'});
 const nav=panel.getByRole('navigation',{name:'Brush settings sections'});
 await nav.getByRole('button',{name:'Brush tip',exact:true}).click();
 await expect(panel.getByRole('combobox',{name:'Ink tip shape'})).toHaveValue('round');
 await nav.getByRole('button',{name:'Ink',exact:true}).click();
 const edges=panel.getByRole('group',{name:'Ink edges'});
 await expect(edges.getByRole('slider',{name:'Edge sharpness'})).toHaveValue('100');
 const aa=edges.getByRole('combobox',{name:'Antialiasing'});
 await expect(aa).toHaveValue('low');
 await aa.selectOption('off');
 await panel.getByRole('combobox',{name:'Settings brush preset'}).selectOption('g-pen');
 await expect(aa).toHaveValue('low');
 await panel.getByRole('combobox',{name:'Settings brush preset'}).selectOption('brush-pen');
 await expect(aa).toHaveValue('off');
});

for(const pointCount of [32,125])test(`Brush Pen pointer-up keeps the pixels and records the edge version after ${pointCount} moves`,async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async pointCount=>{
  const load=(path:string)=>import(path);
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts'),{DocumentStore}=await load('/src/core/history.ts');
  const {newProject,activeLayer}=await load('/src/core/model.ts'),{stockPresets}=await load('/src/core/brushes.ts');
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;top:0;left:0;width:800px;height:510px';
  document.body.append(canvas);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(newProject('Ink pointer capture',800,510)),engine=new StudioEngine(canvas,store,()=>{});
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  const settings=stockPresets.find((p:{id:string})=>p.id==='brush-pen').settings;
  const read=()=>canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
  const results=[];
  try{
   for(const size of [5,20,60]){
    engine.setInput('brush',{...settings,size});
    const send=(type:string,i:number)=>canvas.dispatchEvent(new PointerEvent(type,{
     pointerId:9,isPrimary:true,pointerType:'pen',buttons:type==='pointerup'?0:1,button:0,
     pressure:.55+.35*Math.sin(i*.07),clientX:70+i*3,clientY:230+45*Math.sin(i*.11),
    }));
    send('pointerdown',0);
    for(let i=1;i<=pointCount;i++){send('pointermove',i);if(i%10===0)engine.render();}
    engine.render();const preview=read();
    send('pointerup',pointCount);engine.render();const committed=read();
    const stroke=activeLayer(store.getSnapshot()).operations[0];
    results.push({size,version:stroke?.inkEdgeVersion,differences:preview.reduce((n,v,i)=>n+Number(v!==committed[i]),0)});
    store.undo();engine.render();
   }
  }finally{engine.dispose();canvas.remove();}
  return results;
 },pointCount);
 expect(results).toEqual([5,20,60].map(size=>({size,version:1,differences:0})));
});
