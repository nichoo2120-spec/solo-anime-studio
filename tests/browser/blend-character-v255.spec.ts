import {expect,test} from '@playwright/test';
import {selectBrushOption,openBrushSettings} from '../brush-workspace.mjs';

const targetIds=['blend-mix','water-smooth','water-rough','water-wet','water-flat','water-gradient','water-edge','color-air'];

test('full-resolution Blend masks preserve the edge and each preset has its own material',async({page})=>{
 test.setTimeout(180_000);
 await page.goto('/');
 const result=await page.evaluate(async targetIds=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {prepareBlendMaskPressure}=await load('/src/core/brushBlend.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {renderBrushBlend}=await load('/src/engine/brushBlend.ts');
  const {renderSilkStroke}=await load('/src/engine/silkBlend.ts');
  const width=1000,height=740,edge=width/2;
  const canvas=()=>Object.assign(document.createElement('canvas'),{width,height}).getContext('2d',{willReadFrequently:true})!;
  const mask=canvas(),paint=canvas(),base=canvas();
  base.fillStyle='#143bab';base.fillRect(0,0,width,height);
  base.fillStyle='#e02936';base.fillRect(0,0,edge,height);
  base.clearRect(260,150,120,110);
  const bytes=(ctx:CanvasRenderingContext2D)=>ctx.getImageData(0,0,width,height).data;
  const before=bytes(base);
  const presets=stockPresets.filter((p:any)=>p.category!=='Eraser');
  const points=[{x:278,y:301,p:.5},{x:393,y:324,p:.5},{x:535,y:349,p:.5},{x:652,y:376,p:.5},{x:755,y:398,p:.5}];
  const difference=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>{
   let sum=0,count=0;
   for(let i=0;i<a.length;i+=4){
    const delta=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3]);
    if(delta>0){sum+=delta;count++;}
   }
   return {mean:sum/Math.max(1,count*4),pixels:count};
  };
  const render=(preset:any,size:number,path=points,options:Record<string,unknown>={})=>{
   const settings={...preset.settings,size,bbEnabled:true,bbPressure:true,pressureWidth:false,opacity:1,...options};
   const s={...settings,...brushStrokeMetadata(settings),id:'blend-character-'+preset.id,kind:'stroke',tool:'brush',points:path};
   mask.clearRect(0,0,width,height);paint.clearRect(0,0,width,height);paint.drawImage(base.canvas,0,0);
   prepareBlendMaskPressure(s);
   if(s.silkBlendVersion)renderSilkStroke(paint,s);
   else{drawStroke(mask,s);renderBrushBlend(paint,mask.canvas,s);}
   return {s,out:bytes(paint),coverage:s.silkBlendVersion?undefined:bytes(mask)};
  };
  const cases=[],pairs=[],drag=[],pressure=[],signatures=new Map<string,Uint8Array>();
  for(const size of [132,150,400])for(const mode of (size===150?['auto']:['auto','smudge','blur'])){
   const reference=new Map<string,Uint8ClampedArray>();
   for(const preset of presets){
    const {s,out,coverage}=render(preset,size,points,{bbRenderStyle:mode});
    if(size===132&&mode==='auto'){
     const signature=[];
     for(let y=200;y<490;y+=4)for(let x=180;x<850;x+=4){
      const i=(y*width+x)*4;signature.push(out[i],out[i+1],out[i+2],out[i+3]);
     }
     signatures.set(preset.id,new Uint8Array(signature));
    }
    const delta=new Uint8Array(width*height);
    let outside=0,longest=0,seamRatio=0;
    let longestEdge:{vertical:boolean;col:number;start:number;end:number}|undefined;
    for(let i=0,j=0;i<out.length;i+=4,j++){
     const srcAlpha=before[i+3],dstAlpha=out[i+3];
     let changed=false,visibleDelta=Math.abs(dstAlpha-srcAlpha);
     for(let c=0;c<4;c++)changed=changed||out[i+c]!==before[i+c];
     for(let c=0;c<3;c++)visibleDelta=Math.max(visibleDelta,Math.abs(out[i+c]*dstAlpha-before[i+c]*srcAlpha)/255);
     delta[j]=Math.round(visibleDelta);
     if(changed&&coverage&&!coverage[i+3])outside++;
    }
    // Find aligned jumps from visibly changed pixels directly to blank.
    // A tapered or rotated nib cannot sustain such a jump along an axis.
    for(const vertical of [false,true]){
     const columns=vertical?width:height,rows=vertical?height:width;
     for(let col=1;col<columns-1;col++){
      let run=0;
      for(let row=1;row<rows-1;row++){
       const at=vertical?row*width+col:col*width+row,neighbor=vertical?1:width;
       const backgroundEdge=vertical
        ?Math.abs(col-edge)<=1||row>=150&&row<260&&(Math.abs(col-260)<=1||Math.abs(col-380)<=1)
        :row>=260&&row<380&&(Math.abs(col-150)<=1||Math.abs(col-260)<=1);
       if(backgroundEdge){run=0;continue;}
       // A deliberate chisel edge or grain hole in the Paint mask is legal.
       // Detect a clipping jump only inside otherwise continuous coverage.
       if(coverage){
        const current=coverage[at*4+3],previous=coverage[(at-neighbor)*4+3];
        if(Math.min(current,previous)<20||Math.abs(current-previous)>8){run=0;continue;}
       }
       const a=delta[at],b=delta[at-neighbor];
       run=Math.abs(a-b)>27&&Math.min(a,b)<2?run+1:0;
       if(run>longest){longest=run;longestEdge={vertical,col,start:row-run+1,end:row};}
      }
     }
    }
    // Compare edge steps at the old 64 px seams with their nearby controls.
    let tile=0,neighbor=0,seamEdges=0;
    for(let x=64;x<width-3;x+=64)for(let y=3;y<height-3;y++){
     const i=y*width+x;
     if(coverage&&(coverage[i*4+3]<24||Math.abs(coverage[i*4+3]-coverage[(i-1)*4+3])>8))continue;
     if(Math.abs(x-edge)<=4||((Math.abs(x-260)<=4||Math.abs(x-380)<=4)&&y>=150&&y<260))continue;
     const jump=Math.abs(delta[i]-delta[i-1]);tile+=jump;seamEdges++;
     neighbor+=(Math.abs(delta[i-1]-delta[i-2])+Math.abs(delta[i+1]-delta[i]))*.5;
    }
    for(let y=64;y<height-3;y+=64)for(let x=3;x<width-3;x++){
     const i=y*width+x;
     if(coverage&&(coverage[i*4+3]<24||Math.abs(coverage[i*4+3]-coverage[(i-width)*4+3])>8))continue;
     if((Math.abs(y-150)<=4||Math.abs(y-260)<=4)&&x>=260&&x<380)continue;
     const jump=Math.abs(delta[i]-delta[i-width]);tile+=jump;seamEdges++;
     neighbor+=(Math.abs(delta[i-width]-delta[i-2*width])+Math.abs(delta[i+width]-delta[i]))*.5;
    }
    seamRatio=tile/(neighbor+seamEdges*.025||1);
    cases.push({id:preset.id,size,mode,version:s.brushBlendVersion,silk:s.silkBlendVersion,outside,longest,longestEdge,seamRatio,...difference(out,before)});
    if(mode==='auto'&&targetIds.includes(preset.id))reference.set(preset.id,out);
    if(mode!=='blur'&&['blend-mix','water-rough','water-flat'].includes(preset.id)){
     const reverse=render(preset,size,[...points].reverse(),{bbRenderStyle:mode}).out;
     let sum=0,n=0;
     for(let x=edge+12;x<edge+70;x++)for(let y=323;y<378;y++){
      const i=(y*width+x)*4;sum+=out[i]-reverse[i];n++;
     }
     drag.push({id:preset.id,size,mode,directionalRed:sum/n});
    }
    if(mode==='auto'&&targetIds.includes(preset.id)){
     // Isolate the Blend pressure curve. Paint opacity and flow are
     // intentionally pressure-sensitive in v8, and have independent coverage tests.
     const neutral={pressureOpacity:false,pressureFlow:false,pressure:false};
     const half=render(preset,size,points,neutral).out;
     const full=render(preset,size,points.map(p=>({...p,p:1})),neutral).out;
     pressure.push({id:preset.id,size,difference:difference(half,full),mix:difference(out,before)});
    }
   }
   for(const [a,first] of reference)for(const [b,second] of reference)if(a<b)pairs.push({a,b,size,...difference(first,second)});
  }
  const mix=stockPresets.find((p:any)=>p.id==='blend-mix');
  const smear=render(mix,150,points,{bbBlur:0}).out,blur=render(mix,150,points,{bbBlur:1}).out;
  const nearDuplicates=[];
  for(const [a,first] of signatures)for(const [b,second] of signatures)if(a<b){
   let delta=0,n=0;
   for(let i=0;i<first.length;i++){const d=Math.abs(first[i]-second[i]);delta+=d;if(d)n++;}
   if(!n||delta/first.length<.01)nearDuplicates.push([a,b]);
  }
  return {cases,pairs,drag,pressure,nearDuplicates,blurDifference:difference(smear,blur)};
 },targetIds);
 expect.soft(result.nearDuplicates,'all preset pairs on the edge fixture').toEqual([]);
 for(const row of result.cases){
  const label=row.id+' '+row.size;
  console.log('BLEND_V255_PIXELS '+JSON.stringify(row));
  expect.soft(row.version??row.silk,label).toBe(row.silk?2:9);
  expect.soft(row.outside,label+' writes outside the brush mask').toBe(0);
  expect.soft(row.longest,label+' uninterrupted hard axis edge').toBeLessThanOrEqual(25);
  expect.soft(row.seamRatio,label+' 64 px seams').toBeLessThan(2.2);
 }
 for(const r of result.pairs)expect.soft(r.mean,r.a+' / '+r.b+' '+r.size).toBeGreaterThan(.65);
 for(const r of result.drag){
  console.log('BLEND_V255_DRAG '+JSON.stringify(r));
  expect.soft(r.directionalRed,r.id+' '+r.size).toBeGreaterThan(2);
 }
 for(const r of result.pressure){
  expect.soft(r.mix.pixels,r.id+' '+r.size+' visible at 50%').toBeGreaterThan(250);
  expect.soft(r.difference.pixels,r.id+' '+r.size+' full mix from 40%').toBe(0);
 }
 expect(result.blurDifference.mean).toBeGreaterThan(3);
});

test('300 px and 500 px Blend keeps pen-up, undo, and exact worker replay responsive',async({page})=>{
 test.setTimeout(180_000);
 await page.goto('/');
 const rows=await page.evaluate(async ids=>{
  const load=(path:string)=>import(path);
  const {newProject,activeLayer}=await load('/src/core/model.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {LayerRenderer}=await load('/src/engine/renderer.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const results=[];
  for(const size of [130,300,500])for(const id of ids){
   const project=newProject('Blend character performance',1920,1080);
   const paint=(x:number,color:string)=>({id:color,kind:'stroke',tool:'brush',size:550,pressure:false,response:1,opacity:1,color,
    points:[{x,y:160,p:1},{x,y:920,p:1}]});
   activeLayer(project).operations=[paint(560,'#df303c'),paint(1080,'#1a55cf')];
   const store=new DocumentStore(project),host=document.createElement('div'),canvas=document.createElement('canvas');
   host.style.cssText='position:fixed;inset:0';canvas.style.cssText='display:block;width:1920px;height:1080px';
   host.append(canvas);document.body.append(host);
   let held=false;canvas.setPointerCapture=()=>{held=true;};canvas.hasPointerCapture=()=>held;canvas.releasePointerCapture=()=>{held=false;};
   const engine=new StudioEngine(canvas,store,()=>{}),preset=stockPresets.find((p:any)=>p.id===id);
   const recorder=new LayerRenderer(false);
   try{
    engine.setView({x:0,y:0,zoom:1,rotation:0});
    engine.setInput('brush',{...preset.settings,size,opacity:1,pressureWidth:false,bbEnabled:true,bbPressure:true});
    await frame();await frame();
    const send=(type:string,x:number,coalesced?:number[])=>{
     const event=(x:number)=>new PointerEvent(type,{pointerId:9,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,
      pointerType:'pen',clientX:x,clientY:537+Math.sin(x*.01)*31,pressure:.5});
     const latest=event(x);
     if(coalesced)Object.defineProperty(latest,'getCoalescedEvents',{value:()=>coalesced.map(event)});
     canvas.dispatchEvent(latest);
    };
    // The worker is kept alive between gestures in the installed application.
    // Warm its module and mask caches before timing the next visible stroke.
    send('pointerdown',506);await frame();send('pointermove',566);await frame();send('pointerup',566);
    await engine.renderer.whenSettled();
    engine.historyNavigation('undo');await frame();await frame();
    const timings:number[]=[],render=engine.render.bind(engine);
    let undo=0,undoStart=0,previews=0,reusedFinal=false,firstInput=0,firstPixel=0,ready=false;
    const receive=engine.blendWorker.receive.bind(engine.blendWorker);
    engine.blendWorker.receive=(reply:{bitmap?:ImageBitmap;final?:boolean;unchanged?:boolean})=>{
     if(reply.bitmap&&!reply.final&&engine.drawing){previews++;ready=true;}
     if(reply.final)reusedFinal=!!reply.unchanged;
     receive(reply);
    };
    engine.render=()=>{
     const start=performance.now();render();
     if((ready||engine.blendWorker.presentedMixerSamples>0)&&engine.drawing&&firstInput&&!firstPixel)firstPixel=performance.now()-firstInput;
     if(engine.drawing)timings.push(performance.now()-start);
     if(undoStart){undo=performance.now()-undoStart;undoStart=0;}
    };
    firstInput=performance.now();send('pointerdown',434);
    for(let j=1;j<=18;j++){const x=434+j*32;send('pointermove',x,[x-21,x-11,x]);await frame();}
    const start=performance.now();
    send('pointerup',1010);const dispatch=performance.now()-start;
    const drawn=store.getSnapshot(),op=activeLayer(drawn).operations.at(-1);
    await engine.renderer.whenSettled();const exact=performance.now()-start;
    const pixels=(renderer:any,p:any)=>renderer.get(activeLayer(p),p).getContext('2d').getImageData(370,284,860,500).data as Uint8ClampedArray;
    const output=pixels(engine.renderer,drawn),canonical=pixels(recorder,drawn);
    const parity=output.reduce((n,v,i)=>n+Number(v!==canonical[i]),0);
    undoStart=performance.now();engine.historyNavigation('undo');await frame();if(undoStart)await frame();
    const restored=pixels(engine.renderer,store.getSnapshot()),original=pixels(recorder,project);
    const undoParity=restored.reduce((n,v,i)=>n+Number(v!==original[i]),0);
    timings.sort((a,b)=>a-b);
    results.push({id,size,version:op.brushBlendVersion,previews,reusedFinal,firstPixel,frames:timings.length,
     p95:timings[Math.ceil(timings.length*.95)-1],dispatch,exact,undo,parity,undoParity});
   }finally{engine.dispose();recorder.clear();host.remove();}
  }
  return results;
 },targetIds);
 for(const r of rows){
  const label=r.id+' '+r.size;
  console.log('BLEND_V255_TIMING '+JSON.stringify(r));
  expect.soft(r.version,label).toBe(9);
  expect.soft(r.frames,label).toBeGreaterThanOrEqual(15);
  expect.soft(r.previews,label).toBeGreaterThan(0);
  expect.soft(r.firstPixel,label+' first input to composited preview').toBeLessThanOrEqual(1000/60);
  expect.soft(r.parity,label+' worker vs replay').toBe(0);
  expect.soft(r.undoParity,label+' restored original').toBe(0);
  expect.soft(r.p95,label+' p95').toBeLessThanOrEqual(16);
  expect.soft(r.dispatch,label+' pen-up dispatch').toBeLessThanOrEqual(50);
  expect.soft(r.exact,label+' exact pen-up result').toBeLessThanOrEqual(50);
  expect.soft(r.undo,label+' undo').toBeLessThanOrEqual(50);
 }
});


test('Full Brush Settings pins the Blend controls and saves Smear vs Blur per brush',async({page})=>{
 await page.goto('/');
 await selectBrushOption(page,'Brush category','Paint');
 await selectBrushOption(page,'Brush family','all');
 await selectBrushOption(page,'Brush preset','water-flat');
 await page.getByRole('group',{name:'Paint or Blend'}).first().getByRole('button',{name:'Blend',exact:true}).click();
 await openBrushSettings(page);
 await page.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:'Blend settings',exact:true}).click();
 const panel=page.getByRole('region',{name:'Brush Settings'});
 for(const name of ['Mix amount','Drag length','Wetness','Texture in blend','Smear vs Blur']){
  await expect(panel.getByRole('slider',{name,exact:true})).toBeVisible();
 }
 const blur=panel.getByRole('spinbutton',{name:'Smear vs Blur exact value'});
 await expect(blur).toHaveValue('4');
 await blur.fill('100');await blur.press('Enter');
 await expect(blur).toHaveValue('100');
 await panel.getByRole('button',{name:/show Smear vs Blur/i}).click();
 await expect(panel.getByRole('button',{name:/hide Smear vs Blur/i})).toBeVisible();
 await page.reload();
 await openBrushSettings(page);
 await page.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:'Blend settings',exact:true}).click();
 await expect(blur).toHaveValue('100');
});

test('Blend CPU fallback saves the exact watercolor mask and supports undo',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {newProject,activeLayer}=await load('/src/core/model.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {LayerRenderer}=await load('/src/engine/renderer.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const project=newProject('Watercolor fallback',840,530);
  const paint=(x:number,color:string)=>({id:color,kind:'stroke',tool:'brush',size:380,pressure:false,response:1,opacity:1,color,
   points:[{x,y:50,p:1},{x,y:480,p:1}]});
  activeLayer(project).operations=[paint(223,'#cf343f'),paint(579,'#194dd8')];
  const store=new DocumentStore(project),host=document.createElement('div'),canvas=document.createElement('canvas');
  host.style.cssText='position:fixed;inset:0';canvas.style.cssText='display:block;width:840px;height:530px';
  host.append(canvas);document.body.append(host);
  let held=false;canvas.setPointerCapture=()=>{held=true;};canvas.hasPointerCapture=()=>held;canvas.releasePointerCapture=()=>{held=false;};
  const engine=new StudioEngine(canvas,store,()=>{}),replay=new LayerRenderer(false);
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const send=(kind:string,x:number,y:number)=>canvas.dispatchEvent(new PointerEvent(kind,{pointerId:1,button:0,
   pointerType:'pen',pressure:.5,isPrimary:true,buttons:kind==='pointerup'?0:1,clientX:x,clientY:y}));
  const pixels=(renderer:any,p:any)=>renderer.get(activeLayer(p),p).getContext('2d').getImageData(0,0,840,530).data as Uint8ClampedArray;
  const delta=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.reduce((n,v,i)=>n+Number(v!==b[i]),0);
  try{
   engine.blendWorker.warm=()=>{};engine.blendWorker.available=()=>false;
   engine.setView({x:0,y:0,zoom:1,rotation:0});
   engine.setInput('brush',{...stockPresets.find((p:any)=>p.id==='water-flat').settings,size:150,opacity:1,bbEnabled:true});
   await frame();await frame();
   send('pointerdown',293,239);await frame();
   for(let j=1;j<=6;j++){send('pointermove',293+j*45,239+j*5);await frame();}
   send('pointerup',568,271);await frame();
   const drawn=store.getSnapshot(),final=pixels(engine.renderer,drawn),old=pixels(replay,project);
   const changed=delta(final,old),exact=delta(final,pixels(replay,drawn));
   engine.historyNavigation('undo');await frame();
   return {changed,exact,undo:delta(pixels(engine.renderer,store.getSnapshot()),old)};
  }finally{engine.dispose();replay.clear();host.remove();}
 });
 expect(result.changed).toBeGreaterThan(500);
 expect(result.exact).toBe(0);
 expect(result.undo).toBe(0);
});
