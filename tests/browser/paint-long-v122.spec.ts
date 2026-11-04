import {test,expect} from '@playwright/test';

test('plain paint preserves coverage without JavaScript readback and has a compatible fallback',async({page})=>{
 await page.goto('/');const r=await page.evaluate(async()=>{
  const {drawModernStroke}=await import('/src/engine/brushRaster.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{paintColorFilter}=await import('/src/engine/paintColorFilter.ts');
  const s:any={id:'filter',kind:'stroke',tool:'brush',brushKind:'marker',engineVersion:10,paintNibVersion:1,liveRefinementVersion:3,points:Array.from({length:100},(_,i)=>({x:80+i*5.5,y:190+80*Math.sin(i/99*Math.PI*5),p:.1+.9*Math.sin(i/99*Math.PI)**2})),size:150,color:'#30597c',opacity:1,pressure:true,response:1,pressureWidth:true,pressureOpacity:true,textureStrength:0,taperEnd:.1},g=strokeGeometry(s,'live');
  const supported=!!paintColorFilter(s),proto=CanvasRenderingContext2D.prototype,read=proto.getImageData;let reads=0;proto.getImageData=function(...args:any[]){reads++;return (read as any).apply(this,args);};
  const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=800;a.height=b.height=400;
  try{drawModernStroke(a.getContext('2d')!,s,'live',g);}finally{proto.getImageData=read;}
  drawModernStroke(b.getContext('2d')!,{...s,liveRefinementVersion:2},'live',g);const x=a.getContext('2d')!.getImageData(0,0,800,400).data,y=b.getContext('2d')!.getImageData(0,0,800,400).data;let alphaMax=0,premultipliedMax=0;for(let i=0;i<x.length;i+=4){alphaMax=Math.max(alphaMax,Math.abs(x[i+3]-y[i+3]));for(let j=0;j<3;j++)premultipliedMax=Math.max(premultipliedMax,Math.abs(x[i+j]*x[i+3]/255-y[i+j]*y[i+3]/255));}return {supported,reads,alphaMax,premultipliedMax};
 });expect(r.supported).toBe(true);expect(r.reads).toBe(0);expect(r.alphaMax).toBeLessThanOrEqual(1);expect(r.premultipliedMax).toBeLessThanOrEqual(1.5);
 // A new document gets an independent capability check. Force that check to
 // fail, then verify that the original pixel renderer still paints correctly.
 await page.reload();const fallback=await page.evaluate(async()=>{const {paintColorFilter}=await import('/src/engine/paintColorFilter.ts'),{drawModernStroke}=await import('/src/engine/brushRaster.ts');const proto=CanvasRenderingContext2D.prototype,read=proto.getImageData,s:any={id:'fallback',kind:'stroke',tool:'brush',brushKind:'paint',engineVersion:10,paintNibVersion:1,liveRefinementVersion:3,points:[{x:40,y:100,p:1},{x:220,y:100,p:1}],size:70,color:'#123456',opacity:1,pressure:false,response:1,textureStrength:0};proto.getImageData=()=>{throw Error('Unavailable');};let selected;try{selected=paintColorFilter(s);}finally{proto.getImageData=read;}const c=document.createElement('canvas');c.width=300;c.height=200;drawModernStroke(c.getContext('2d')!,s);return {pixelRoute:selected===undefined,alpha:c.getContext('2d')!.getImageData(100,100,1,1).data[3]};});expect(fallback.pixelRoute).toBe(true);expect(fallback.alpha).toBe(255);
});

test('sustained overlapping paint retains full-render pixels and bounds gradient work',async({page})=>{
 test.setTimeout(180000);await page.goto('/');const rows=await page.evaluate(async()=>{
  const {LiveStrokeRaster}=await import('/src/engine/liveRaster.ts'),{drawModernStroke}=await import('/src/engine/brushRaster.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{stockPresets}=await import('/src/core/brushes.ts');const rows=[];
  for(const id of ['marker','paint','dry','watercolor','eraser-soft'])for(const pressure of [false,true]){
   const s:any={...stockPresets.find(p=>p.id===id)!.settings,id:'long-'+id,kind:'stroke',tool:'brush',engineVersion:id==='dry'?9:id==='watercolor'?8:10,paintNibVersion:1,liveRefinementVersion:3,pressure,size:150,stabilization:.25,smoothness:25,taperStart:0,taperEnd:.1,points:[]};
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=960;a.height=b.height=540;const ac=a.getContext('2d',{willReadFrequently:true})!,bc=b.getContext('2d',{willReadFrequently:true})!,live=new LiveStrokeRaster();let max=0,different=0;const work=[];
   const proto=CanvasRenderingContext2D.prototype,gradient=proto.createRadialGradient;let calls=0;proto.createRadialGradient=function(...args:any[]){calls++;return (gradient as any).apply(this,args);};
   try{for(let i=1;i<=600;i++){
    const t=i/600;s.points.push({x:480+340*Math.sin(t*Math.PI*6),y:270+160*Math.sin(t*Math.PI*36),p:.2+.8*Math.sin(t*Math.PI)**2});if(i%30)continue;
    const g=strokeGeometry(s,'live');calls=0;live.paint(ac,s,g);work.push(calls);
    if([120,300,600].includes(i)){bc.clearRect(0,0,960,540);drawModernStroke(bc,s,'live',g);const x=ac.getImageData(0,0,960,540).data,y=bc.getImageData(0,0,960,540).data;for(let j=3;j<x.length;j+=4){const d=Math.abs(x[j]-y[j]);max=Math.max(max,d);if(d)different++;}}
   }}finally{proto.createRadialGradient=gradient;}
   rows.push({id,pressure,max,different,work});live.reset();
  }return rows;
 });console.log('LONG_PAINT_PIXELS',JSON.stringify(rows));for(const r of rows){expect(r.max,JSON.stringify(r)).toBeLessThanOrEqual(1);if(['marker','paint'].includes(r.id)&&!r.pressure)expect(Math.max(...r.work.slice(4)),JSON.stringify(r)).toBeLessThan(900);}
});

test('flat display batches match a full draw through long strokes and release',async({page})=>{
 await page.goto('/');const rows=await page.evaluate(async()=>{
  const {FlatLiveRaster}=await import('/src/engine/FlatLiveRaster.ts'),{drawFlatInk}=await import('/src/engine/flatInk.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{stockPresets}=await import('/src/core/brushes.ts');const rows=[];
  for(const pressure of [false,true])for(const rotation of [0,.21]){
   const s:any={...stockPresets.find(p=>p.id==='flat')!.settings,id:'flat-test',kind:'stroke',tool:'brush',engineVersion:10,flatNibVersion:1,liveRefinementVersion:3,pressure,size:150,stabilization:.39,smoothness:0,taperStart:0,taperEnd:.1,points:[]},live=new FlatLiveRaster(),b=document.createElement('canvas');b.width=1200;b.height=800;const m=new DOMMatrix().translate(30,20).rotate(rotation*180/Math.PI).scale(1.28),ctx=b.getContext('2d')!;
   let max=0,changed=0;for(let i=1;i<=600;i++){const t=i/600;s.points.push({x:430+300*Math.sin(t*Math.PI*6),y:260+140*Math.sin(t*Math.PI*36),p:.2+.8*Math.sin(t*Math.PI)**2});if(i%60)continue;const g=strokeGeometry(s,'live'),a=live.paint(s,g,m,1200,800);ctx.resetTransform();ctx.clearRect(0,0,1200,800);ctx.setTransform(m);drawFlatInk(ctx,s,g,undefined,1.5);const x=a.getContext('2d')!.getImageData(0,0,1200,800).data,y=ctx.getImageData(0,0,1200,800).data;for(let j=3;j<x.length;j+=4){const d=Math.abs(x[j]-y[j]);max=Math.max(max,d);if(d)changed++;}}
   rows.push({pressure,rotation,max,changed});live.clear();
  }return rows;
 });console.log('FLAT_BATCH_PIXELS',JSON.stringify(rows));for(const r of rows)expect(r.max,JSON.stringify(r)).toBe(0);
});

test('final cached paint pixels match a fresh saved-document render',async({page})=>{
 test.setTimeout(120000);await page.goto('/');const rows=await page.evaluate(async()=>{
  const m=await import('/src/core/model.ts'),{DocumentStore}=await import('/src/core/history.ts'),{StudioEngine}=await import('/src/engine/StudioEngine.ts'),{LayerRenderer}=await import('/src/engine/renderer.ts'),{stockPresets}=await import('/src/core/brushes.ts');const rows=[];
  for(const id of ['marker','flat','paint','dry','watercolor','airbrush']){
   const p=m.newProject('Save',960,540),store=new DocumentStore(p),c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:1000px;height:650px';document.body.append(c);c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;const e:any=new StudioEngine(c,store,()=>{});e.setView({x:0,y:0,zoom:1,rotation:0});e.setInput('brush',{...stockPresets.find(p=>p.id===id)!.settings,size:150,stabilization:.25,smoothness:25});if(id==='flat')e.diagnostics.start({perEventGeometry:false});let time=1000;
   const send=(type:string,x:number,y:number,pressure:number)=>{const ev=new PointerEvent(type,{pointerId:7,isPrimary:true,pointerType:'pen',buttons:type==='pointerup'?0:1,button:0,pressure,clientX:x,clientY:y});Object.defineProperty(ev,'timeStamp',{value:++time});c.dispatchEvent(ev);};send('pointerdown',120,220,.3);for(let i=1;i<=180;i++){send('pointermove',120+i*3.8,220+120*Math.sin(i/180*Math.PI*10),.2+.8*Math.sin(i/180*Math.PI)**2);if(i%15===0)e.render();}send('pointerup',804,220,0);e.render();
   const doc=store.getSnapshot(),loaded=m.validateProject(JSON.parse(JSON.stringify(doc))),cold=new LayerRenderer(),a=e.renderer.get(m.activeLayer(doc),doc).getContext('2d')!.getImageData(0,0,960,540).data,b=cold.get(m.activeLayer(loaded),loaded).getContext('2d')!.getImageData(0,0,960,540).data;let max=0,changed=0,alphaMax=0;for(let j=0;j<a.length;j++){const d=Math.abs(a[j]-b[j]);max=Math.max(max,d);if(d)changed++;if(j%4===3)alphaMax=Math.max(alphaMax,d);}rows.push({id,max,alphaMax,changed,tipRecorded:id!=='flat'||e.diagnostics.trace()?.events.some((event:any)=>!!event.liveTip),version:m.activeLayer(doc).operations.at(-1)?.liveRefinementVersion});cold.clear();e.dispose();c.remove();
  }return rows;
 });console.log('CACHED_FINAL_PAINT',JSON.stringify(rows));for(const r of rows){expect(r.version).toBe(3);expect(r.tipRecorded).toBe(true);expect(r.changed,JSON.stringify(r)).toBe(0);}
});
