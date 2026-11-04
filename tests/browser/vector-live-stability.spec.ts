import {test,expect} from '@playwright/test';

test('settled ink stays geometrically fixed and Bold Ink uses a bounded live fit',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const vp='/src/engine/VectorController.ts',hp='/src/core/history.ts',mp='/src/core/model.ts',bp='/src/core/brushes.ts',cp='/src/engine/cleanInkContour.ts';
  const {VectorController}=await import(vp),{DocumentStore}=await import(hp),m=await import(mp),{stockPresets}=await import(bp),{cleanInkPathData}=await import(cp);
  const source=Array.from({length:1001},(_,i)=>({x:20+i*2,y:210+80*Math.sin(i/30)+.6*Math.sin(i*.7),p:.2+.7*Math.sin(i*.02)**2}));
  const store=new DocumentStore(m.newProject()),v=new VectorController(store,()=>stockPresets[4].settings,()=>{},()=>{});Object.assign(v,{width:12,smoothness:65,stabilization:12,minWidthPercent:35,pressure:true});
  const c=document.createElement('canvas');c.width=2200;c.height=400;const ctx=c.getContext('2d')!;v.down(source[0],1,true);v.moveSamples(source.slice(1,301));v.renderNewLayer(ctx);
  const ink=(v as any).liveInk,beforePaths=ink.frozen.filter((s:any)=>s.line.nodes.at(-1).x<450).map((s:any)=>cleanInkPathData(s.line)),before=ctx.getImageData(0,0,450,400).data;
  v.moveSamples(source.slice(301,401));ctx.clearRect(0,0,c.width,c.height);v.renderNewLayer(ctx);
  const afterPaths=ink.frozen.filter((s:any)=>s.line.nodes.at(-1).x<450).map((s:any)=>cleanInkPathData(s.line)),after=ctx.getImageData(0,0,450,400).data;let maxAlphaDifference=0;
  for(let i=3;i<before.length;i+=4)maxAlphaDifference=Math.max(maxAlphaDifference,Math.abs(before[i]-after[i]));
  for(let i=401;i<source.length;i+=20){v.moveSamples(source.slice(i,i+20));ctx.clearRect(0,0,c.width,c.height);v.renderNewLayer(ctx);}
  return {beforePaths,afterPaths,maxAlphaDifference,work:{...ink.work}};
 });
 expect(result.afterPaths).toEqual(result.beforePaths);
 // Native Canvas can quantize edge coverage differently as a compound path
 // grows. Geometry is checked exactly above; this bound only permits small AA
 // coverage variation, rather than a moved silhouette (v113 reached 246/255).
 expect(result.maxAlphaDifference).toBeLessThanOrEqual(12);
 expect(result.work.maxFitSamples).toBeLessThan(65);
 expect(result.work.acceptedSamples).toBe(1001);
});

test('live/saved strokes, opacity, taper, and SVG retain the same contour',async({page})=>{
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const vp='/src/engine/VectorController.ts',hp='/src/core/history.ts',mp='/src/core/model.ts',bp='/src/core/brushes.ts',drawp='/src/engine/vector.ts';
  const {VectorController}=await import(vp),{DocumentStore}=await import(hp),m=await import(mp),{stockPresets}=await import(bp),{drawVector,vectorSvg}=await import(drawp);
  const source=Array.from({length:401},(_,i)=>({x:20+i*2,y:210+80*Math.sin(i/30),p:.2+.7*Math.sin(i*.02)**2})),rows=[];
  for(const [width,pressure,opacity,taper]of [[2,false,1,0],[12,true,1,0],[36,true,.45,0],[12,true,.6,.15]] as const){
   const store=new DocumentStore(m.newProject()),v=new VectorController(store,()=>stockPresets[4].settings,()=>{},()=>{});Object.assign(v,{width,pressure,opacity,smoothness:65,stabilization:12,taperStart:taper,taperEnd:taper});const c=document.createElement('canvas');c.width=1200;c.height=500;const ctx=c.getContext('2d')!;v.down(source[0],1,true);
   for(let i=1;i<source.length;i+=10){v.moveSamples(source.slice(i,i+10));ctx.clearRect(0,0,c.width,c.height);v.renderNewLayer(ctx);}
   const live=ctx.getImageData(0,0,c.width,c.height).data;v.up(source.at(-1));const line=m.activeLayer(store.getSnapshot()).operations.at(-1);ctx.clearRect(0,0,c.width,c.height);drawVector(ctx,line);const saved=ctx.getImageData(0,0,c.width,c.height).data;let differences=0;for(let i=0;i<live.length;i++)if(live[i]!==saved[i])differences++;
   const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='data:image/svg+xml;base64,'+btoa(vectorSvg(line,c.width,c.height));});ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(image,0,0);const svg=ctx.getImageData(0,0,c.width,c.height).data;let svgAlphaDifference=0;for(let i=3;i<saved.length;i+=4)svgAlphaDifference=Math.max(svgAlphaDifference,Math.abs(saved[i]-svg[i]));
   rows.push({width,pressure,opacity,taper,differences,svgAlphaDifference,valid:!!m.validateProject(JSON.parse(JSON.stringify(store.getSnapshot())))});
  }return rows;
 });
 for(const row of rows){expect(row.differences,JSON.stringify(row)).toBe(0);expect(row.svgAlphaDifference,JSON.stringify(row)).toBeLessThanOrEqual(2);expect(row.valid).toBe(true);}
});
