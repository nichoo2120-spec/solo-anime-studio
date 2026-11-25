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
       ...brushStrokeMetadata({...s,inkAntialiasing:mode}),id:'ink-edge',kind:'stroke',tool:'brush',brushKind:s.brushKind,
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
 await page.getByLabel('Brush category',{exact:true}).selectOption('Ink');
 await page.getByLabel('Brush preset',{exact:true}).selectOption('brush-pen');
 await page.getByRole('button',{name:'Brush Settings',exact:true}).click();
 const panel=page.getByRole('region',{name:'Brush Settings'});
 await panel.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:'Tip & texture',exact:true}).click();
 const edges=panel.getByRole('group',{name:'Ink edges'});
 await expect(edges.getByRole('slider',{name:'Edge sharpness'})).toHaveValue('100');
 const aa=edges.getByRole('combobox',{name:'Antialiasing'});
 await expect(aa).toHaveValue('low');
 await expect(panel.getByRole('combobox',{name:'Ink tip shape'})).toHaveValue('round');
 await aa.selectOption('off');
 await panel.getByRole('combobox',{name:'Settings brush preset'}).selectOption('g-pen');
 await expect(aa).toHaveValue('low');
 await panel.getByRole('combobox',{name:'Settings brush preset'}).selectOption('brush-pen');
 await expect(aa).toHaveValue('off');
});
