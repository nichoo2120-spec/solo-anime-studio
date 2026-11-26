import {expect,test} from '@playwright/test';

const baselineOnly = process.env.BLEND_BASELINE_ONLY === '1';

test('profiles each Blend family and style on a 1920 × 1080 canvas',async({page})=>{
 test.setTimeout(210_000);
 await page.goto('/');
 const rows=await page.evaluate(async({baselineOnly})=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {renderBrushBlend,applyBrushBlendLive,resetBrushBlend}=await load('/src/engine/brushBlend.ts');
  const {BrushBlendGestureV3}=await load('/src/engine/brushBlendStyles.ts');
  const {SilkGesture,renderSilkStroke,applySilkBlend,resetSilkBlend}=await load('/src/engine/silkBlend.ts');
  const width=1920,height=1080;
  const surface=()=>Object.assign(document.createElement('canvas'),{width,height}).getContext('2d',{willReadFrequently:true})!;
  const base=surface(),mask=surface(),out=surface(),before=surface(),after=surface(),historic=surface();
  const fill=base.createLinearGradient(370,260,1330,820);
  fill.addColorStop(0,'#b53858');fill.addColorStop(.55,'#e7af62');fill.addColorStop(1,'#4069bd');
  base.fillStyle=fill;base.fillRect(0,0,width,height);
  base.fillStyle='#365892';base.fillRect(735,445,420,250);
  base.clearRect(955,350,120,160);
  const fixture=[
   ['Soft paint','soft-paint','auto'],['Watercolor','water-flat','auto'],['Oil','flat','auto'],
   ['Airbrush','color-air','auto'],['Pencil','hb','auto'],['Ink','g-pen','auto'],
   ['Marker','marker','auto'],['Texture','color-texture','auto'],['Dry brush','dry','auto'],
   ['Soft blur','soft-paint','blur'],['Wet','soft-paint','wet'],['Smudge','soft-paint','smudge'],['Dry','soft-paint','dry'],
   ...['soft','wet','smudge','dry'].map(mode=>['Silk '+mode,'silk-blend','silk',mode]),
  ];
  const points=Array.from({length:33},(_,i)=>({x:572+i*23,y:525+Math.sin(i*.15)*30,p:.7+.25*i/32,v:.65}));
  const p95=(v:number[])=>v.sort((a,b)=>a-b)[Math.max(0,Math.ceil(v.length*.95)-1)]??0;
  let dabs:number[]|undefined;
  const wrap=(prototype:any)=>{
   const dab=prototype.dab;
   prototype.dab=function(...args:unknown[]){
    if(!dabs)return dab.apply(this,args);
    const t=performance.now();
    try{return dab.apply(this,args);}finally{dabs.push(performance.now()-t);}
   };
  };
  wrap(BrushBlendGestureV3.prototype);wrap(SilkGesture.prototype);
  const rows=[];
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  for(const size of [20,100,300,500])for(const [label,id,style,silkMode] of fixture){
   const settings={...stockPresets.find((p:{id:string})=>p.id===id).settings,bbEnabled:true,bbRenderStyle:style,silkMode,pressureWidth:false};
   const stroke={...settings,...brushStrokeMetadata(settings),id:'blend-profile-'+id,kind:'stroke',tool:'brush',size,points,pressure:false};
   const baseline={...stroke,blendRasterVersion:size>64?1:undefined};
   const candidate={...stroke,blendRasterVersion:size>64?2:undefined};
   mask.clearRect(0,0,width,height);
   const t=performance.now();
   if(style!=='silk')drawStroke(mask,baseline);
   const maskMs=performance.now()-t;
   const canonical=(canvas:CanvasRenderingContext2D,s:typeof stroke)=>{
    canvas.clearRect(0,0,width,height);canvas.drawImage(base.canvas,0,0);
    const t=performance.now();
    if(style==='silk')renderSilkStroke(canvas,s);
    else renderBrushBlend(canvas,mask.canvas,s);
    return performance.now()-t;
   };
   if(style!=='silk'&&!baselineOnly&&size===300)canonical(historic,{...stroke,brushBlendVersion:3,blendRasterVersion:undefined});
   const measure=(s:typeof baseline)=>{
    out.clearRect(0,0,width,height);out.drawImage(base.canvas,0,0);resetBrushBlend();resetSilkBlend();
    const samples:number[]=[];
    dabs=[];
    const draw=(n:number,final=false)=>{
     const section={...s,points:points.slice(0,n)};
     if(style==='silk')applySilkBlend(out,mask.canvas,section,0,0,undefined,base.canvas,final);
     else applyBrushBlendLive(out,mask.canvas,section,base.canvas,final,section.points);
    };
    for(let i=1;i<=points.length;i+=4){const t=performance.now();draw(i);samples.push(performance.now()-t);}
    const dabMs=dabs.reduce((sum,v)=>sum+v,0)/Math.max(1,dabs.length),peakDab=p95(dabs),dabCount=dabs.length;
    dabs=undefined;
    const t=performance.now();draw(points.length,true);
    return {dabMs,peakDab,dabCount,frame:p95(samples),penUp:performance.now()-t};
   };
   await frame();
   const prior=measure(baseline);
   const oldMs=canonical(before,baseline);
   let updated:ReturnType<typeof measure>|undefined,meanDelta:number|undefined,maxDelta:number|undefined,historicalDelta:number|undefined,canonicalMs:number|undefined;
   if(!baselineOnly){
    updated=measure(candidate);
    canonicalMs=canonical(after,candidate);
    const crop={x:320,y:230,w:1240,h:625};
    const a=before.getImageData(crop.x,crop.y,crop.w,crop.h).data,b=after.getImageData(crop.x,crop.y,crop.w,crop.h).data;
    const written=out.getImageData(crop.x,crop.y,crop.w,crop.h).data;
    let sum=0,max=0,mismatch=0,changed=0;
    const original=base.getImageData(crop.x,crop.y,crop.w,crop.h).data;
    for(let i=0;i<a.length;i+=4){
     const visible=a[i]!==original[i]||a[i+1]!==original[i+1]||a[i+2]!==original[i+2]||a[i+3]!==original[i+3]||
      b[i]!==original[i]||b[i+1]!==original[i+1]||b[i+2]!==original[i+2]||b[i+3]!==original[i+3];
     if(visible)changed+=4;
     for(let j=0;j<4;j++){const d=Math.abs(a[i+j]-b[i+j]);sum+=d;max=Math.max(max,d);mismatch+=Number(written[i+j]!==b[i+j]);}
    }
    meanDelta=sum/Math.max(1,changed);
    maxDelta=max;
    if(mismatch)throw Error(label+' '+size+' final worker/fallback parity differs by '+mismatch+' channels');
    if(style!=='silk'&&size===300){
     canonical(after,{...stroke,brushBlendVersion:3,blendRasterVersion:undefined});
     const h=historic.getImageData(crop.x,crop.y,crop.w,crop.h).data,hh=after.getImageData(crop.x,crop.y,crop.w,crop.h).data;
     historicalDelta=h.reduce((n,value,i)=>n+Number(value!==hh[i]),0);
    }
   }
   rows.push({label,size,maskMs,prior,oldMs,updated,canonicalMs,meanDelta,maxDelta,historicalDelta});
  }
  return rows;
 },{baselineOnly});
 for(const row of rows){
  console.log('BLEND_V254_PROFILE '+JSON.stringify(row));
  if(!baselineOnly){
   expect.soft(row.meanDelta,row.label+' '+row.size+' changed-pixel MAE').toBeLessThanOrEqual(2);
   if(row.historicalDelta!==undefined)expect.soft(row.historicalDelta,row.label+' historical v3 repeat').toBe(0);
  }
 }
});

test('large Blend preserves responsive input, a canonical worker result and exact undo',async({page})=>{
 test.skip(baselineOnly,'Production input comparison runs with both raster versions.');
 test.setTimeout(210_000);
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {newProject,activeLayer}=await load('/src/core/model.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {LayerRenderer}=await load('/src/engine/renderer.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const width=1920,height=1080;
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const rows=[];
  const styles=[
   ['Normal','soft-paint','auto'],['Watercolor','water-flat','auto'],['Oil','flat','auto'],
   ['Airbrush','color-air','auto'],['Pencil','hb','auto'],['Ink','g-pen','auto'],
   ['Marker','marker','auto'],['Texture','color-texture','auto'],['Dry brush','dry','auto'],
   ['Soft blur','soft-paint','blur'],['Wet','soft-paint','wet'],['Smudge','soft-paint','smudge'],['Dry','soft-paint','dry'],
   ...['soft','wet','smudge','dry'].map(mode=>['Silk '+mode,'silk-blend','silk',mode]),
  ];
  for(const size of [300,500])for(const [style,id,renderStyle,silkMode] of styles)for(const version of [1,2]){
   const project=newProject('Blend latency',width,height);
   const paint=(x:number,color:string)=>({
    id:color,kind:'stroke',tool:'brush',size:550,pressure:false,response:1,opacity:1,color,
    points:[{x,y:160,p:1},{x,y:920,p:1}],
   });
   activeLayer(project).operations=[paint(510,'#eb3131'),paint(1090,'#145adc')];
   const store=new DocumentStore(project),host=document.createElement('div'),canvas=document.createElement('canvas');
   host.style.cssText='position:fixed;inset:0';canvas.style.cssText='display:block;width:1920px;height:1080px';
   host.append(canvas);document.body.append(host);
   let held=false;canvas.setPointerCapture=()=>{held=true;};canvas.hasPointerCapture=()=>held;canvas.releasePointerCapture=()=>{held=false;};
   const engine=new StudioEngine(canvas,store,()=>{}),pins=stockPresets.find((p:{id:string})=>p.id===id).settings;
   try{
    engine.setView({x:0,y:0,zoom:1,rotation:0});
    engine.setInput('brush',{...pins,size,bbEnabled:true,bbRenderStyle:renderStyle,silkMode,pressureWidth:false});
    await frame();await frame();
    const stamp=(type:string,x:number,coalesced?:number[])=>{
     const event=(x:number)=>new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,
      pointerType:'pen',clientX:x,clientY:525+Math.sin(x*.012)*22,pressure:.73});
     const last=event(x);
     if(coalesced)Object.defineProperty(last,'getCoalescedEvents',{value:()=>coalesced.map(event)});
     canvas.dispatchEvent(last);
    };
    const cost:number[]=[],render=engine.render.bind(engine);
    let undoAt:number|undefined,undo=0;
    engine.render=()=>{
     const t=performance.now();
     render();
     if(engine.drawing)cost.push(performance.now()-t);
     if(undoAt!==undefined){undo=performance.now()-undoAt;undoAt=undefined;}
    };
    stamp('pointerdown',424);
    const selectedVersion=engine.stroke.blendRasterVersion;
    engine.stroke.blendRasterVersion=version;
    for(let i=1;i<=18;i++){
     const x=424+i*39;
     stamp('pointermove',x,[x-26,x-13,x]);
     await frame();
    }
    const t=performance.now();stamp('pointerup',1138);const penUp=performance.now()-t;
    const painted=store.getSnapshot(),operation=activeLayer(painted).operations.at(-1);
    await engine.renderer.whenSettled();
    const settled=performance.now()-t;
    const canonical=new LayerRenderer(false);
    const sample=(renderer:any,project:any)=>renderer.get(activeLayer(project),project).getContext('2d').getImageData(535,400,500,236).data as Uint8ClampedArray;
    let parity=0,undoMismatch=0;
    if(version===2){
     const a=sample(engine.renderer,painted),b=sample(canonical,painted);
     parity=a.reduce((n,v,i)=>n+Number(v!==b[i]),0);
    }
    undoAt=performance.now();engine.historyNavigation('undo');
    await frame();if(undoAt!==undefined)await frame();
    if(version===2){
     const restored=store.getSnapshot(),a=sample(engine.renderer,restored),b=sample(canonical,project);
     undoMismatch=a.reduce((n,v,i)=>n+Number(v!==b[i]),0);
    }
    canonical.clear();
    cost.sort((a,b)=>a-b);
    rows.push({style,size,version,selectedVersion,stored:operation.blendRasterVersion,worker:engine.blendWorker.available(),
     frame:cost[Math.ceil(cost.length*.95)-1],frames:cost.length,penUp,settled,undo,parity,undoMismatch});
   }finally{engine.dispose();host.remove();}
  }
  return rows;
 });
 for(const row of rows){
  console.log('BLEND_V254_INPUT '+JSON.stringify(row));
  if(row.version!==2)continue;
  const id=row.style+' '+row.size;
  expect.soft(row.selectedVersion,id).toBe(2);
  expect.soft(row.stored,id).toBe(2);
  expect.soft(row.worker,id).toBe(true);
  expect.soft(row.frames,id).toBeGreaterThan(12);
  expect.soft(row.parity,id+' worker/replay bytes').toBe(0);
  expect.soft(row.undoMismatch,id+' undo bytes').toBe(0);
  expect.soft(row.frame,id+' main-thread frame').toBeLessThanOrEqual(16);
  expect.soft(row.penUp,id+' pen-up handler').toBeLessThanOrEqual(50);
  expect.soft(row.undo,id+' undo to display').toBeLessThanOrEqual(50);
 }
});
