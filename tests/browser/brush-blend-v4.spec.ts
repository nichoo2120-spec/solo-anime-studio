import {expect,test} from '@playwright/test';

test('v4 keeps the real custom brush mask and matches worker final pixels',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {drawStroke}=await import('/src/engine/renderer.ts');
  const {compositePaintStroke}=await import('/src/engine/paintCompositing.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const width=320,height=180;
  function canvas(){
   const c=document.createElement('canvas');c.width=width;c.height=height;return c;
  }
  const source=canvas(),ctx=source.getContext('2d')!;
  ctx.fillStyle='#de3859';ctx.fillRect(0,0,160,height);
  ctx.fillStyle='#2d57cf';ctx.fillRect(160,0,160,height);
  const pixels=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,width,height).data;
  const before=pixels(source);
  const settings={
   ...stockPresets.find(p=>p.id==='soft-paint')!.settings,bbEnabled:true,bbMix:.12,bbFlow:1,bbStretch:1,
   tsEnabled:true,tsAngle:90,tsScaleX:2.9,dbEnabled:true,dbTip:'chalk' as const,dbMode:'subtract' as const,
   dbAmount:1,dbTexture:.9,dbSpacing:.55,dbScatter:1.2,dbScale:.8,tipSpacing:.12,pressureWidth:true,
  };
  const points=Array.from({length:53},(_,i)=>({x:44+i*4,y:90+Math.sin(i/9)*5,p:.2+.8*i/52}));
  const stroke={
   ...settings,...brushStrokeMetadata(settings),id:'dual-blend-v4',kind:'stroke' as const,tool:'brush' as const,
   points,size:42,pressure:true,opacity:1,response:1,color:'#00ff00',
  };
  function replay(s:typeof stroke){
   const out=canvas(),paint=out.getContext('2d')!,mask=canvas();
   paint.drawImage(source,0,0);drawStroke(mask.getContext('2d')!,s);
   compositePaintStroke(paint,mask,s);
   return {out:pixels(out),mask:pixels(mask)};
  }
  const decode=JSON.parse(JSON.stringify(stroke)) as typeof stroke;
  const {out,mask}=replay(decode);
  const result={version:stroke.brushBlendVersion,style:stroke.bbStyle,changed:0,outside:0,outer:0,parity:0,variations:[] as number[]};
  const difference=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.reduce((n,v,i)=>n+Number(v!==b[i]),0);
  for(let i=0;i<out.length;i+=4){
   if(out[i]===before[i]&&out[i+1]===before[i+1]&&out[i+2]===before[i+2]&&out[i+3]===before[i+3])continue;
   result.changed++;
   if(!mask[i+3])result.outside++;
   if(Math.abs(Math.floor(i/4/width)-90)>32)result.outer++;
  }
  const variations=[
   {...stroke,dbScatter:0},
   {...stroke,dbSpacing:.15},
   {...stroke,dbTexture:0},
   {...stroke,tsAngle:0},
   {...stroke,points:points.map(p=>({...p,p:1}))},
  ];
  result.variations=variations.map(s=>difference(out,replay(s).out));

  let notify:(()=>void)|undefined;
  const worker=new LiveBlendWorker(()=>notify?.());
  try{
   for(const count of [1,19,35,points.length]){
    await new Promise<void>((resolve,reject)=>{
     const timer=setTimeout(()=>reject(new Error('Blend preview worker did not respond')),7000);
     notify=()=>{clearTimeout(timer);resolve();};
     if(!worker.preview({...stroke,points:points.slice(0,count)},source,count)){
      clearTimeout(timer);reject(new Error('Blend preview worker unavailable'));
     }
    });
   }
   const final=await worker.finish(stroke)?.done;
   if(!final)throw new Error('Blend final worker unavailable');
   result.parity=difference(pixels(final),out);
  }finally{worker.dispose();}
  return result;
 });
 expect(result).toMatchObject({version:4,style:'texture',outside:0,parity:0});
 expect(result.changed).toBeGreaterThan(100);
 expect(result.outer).toBeGreaterThan(0);
 for(const count of result.variations)expect(count).toBeGreaterThan(0);
});

test('watercolor presets keep distinct feel with their real masks and worker replay',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {drawStroke}=await import('/src/engine/renderer.ts');
  const {compositePaintStroke}=await import('/src/engine/paintCompositing.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const width=320,height=180;
  const canvas=()=>Object.assign(document.createElement('canvas'),{width,height});
  const pixels=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,width,height).data;
  const source=canvas(),ctx=source.getContext('2d')!;
  ctx.fillStyle='#df3859';ctx.fillRect(0,0,160,height);
  ctx.fillStyle='#2a52c8';ctx.fillRect(160,0,160,height);
  const before=pixels(source),points=Array.from({length:56},(_,i)=>({x:44+i*4,y:90,p:1,v:.65}));
  const stroke=(id:string,tipAngle=0)=>{
   const settings={...stockPresets.find(p=>p.id===id)!.settings,tipAngle,size:82,bbEnabled:true};
   return {...settings,...brushStrokeMetadata(settings),id:'watercolor-feel',kind:'stroke' as const,tool:'brush' as const,
    points,pressure:false,color:'#00ff00'};
  };
  const render=(s:ReturnType<typeof stroke>)=>{
   const out=canvas(),paint=out.getContext('2d')!,mask=canvas();
   paint.drawImage(source,0,0);
   drawStroke(mask.getContext('2d')!,s);
   compositePaintStroke(paint,mask,s);
   const after=pixels(out),coverage=pixels(mask);
   let outside=0,changed=0,gaps=0,span=0;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=(y*width+x)*4,delta=Math.abs(before[k]-after[k]);
    if(delta>0){
     changed++;
     if(!coverage[k+3])outside++;
     if(x>=162&&x<190&&delta>3)span=Math.max(span,Math.abs(y-90));
    }
    if(x>=165&&x<188&&Math.abs(y-90)<14&&delta===0)gaps++;
   }
   return {after,changed,outside,gaps,span};
  };
  const ids=['water-smooth','water-wet','water-rough','water-flat'];
  const rows=ids.map(id=>{
   const s=stroke(id),{after:_after,...metrics}=render(s);
   return {id,version:s.brushBlendVersion,...metrics};
  });
  const flat=stroke('water-flat'),canonical=render(flat);
  const turned=render(stroke('water-flat',90));
  let notify:(()=>void)|undefined;
  const worker=new LiveBlendWorker(()=>notify?.());
  let workerDiff=0;
  try{
   await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Watercolor preview did not respond')),7000);
    notify=()=>{clearTimeout(timer);resolve();};
    if(!worker.preview({...flat,points:points.slice(0,35)},source,1)){
     clearTimeout(timer);reject(new Error('Watercolor Blend worker unavailable'));
    }
   });
   const final=await worker.finish(flat)?.done;
   if(!final)throw new Error('Watercolor Blend worker did not finish');
   workerDiff=pixels(final).reduce((n,v,i)=>n+Number(v!==canonical.after[i]),0);
  }finally{worker.dispose();}
  return {rows,turnedSpan:turned.span,workerDiff};
 });
 for(const row of result.rows){
  expect(row.version,row.id).toBe(5);
  expect(row.outside,row.id).toBe(0);
  expect(row.changed,row.id).toBeGreaterThan(100);
 }
 const [smooth,wet,rough,flat]=result.rows;
 expect(rough.gaps).toBeGreaterThan(smooth.gaps+15);
 expect(wet.changed).toBeGreaterThan(rough.changed);
 expect(flat.span).toBeGreaterThan(result.turnedSpan+8);
 expect(result.workerDiff).toBe(0);
});
