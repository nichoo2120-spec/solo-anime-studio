import {selectBrushOption,openBrushSettings,activeBrush} from '../brush-workspace.mjs';
import {expect,test} from '@playwright/test';

test('New Blend strokes keep the real custom brush mask and match worker final pixels',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {brushBlendSettingsFor}=await import('/src/core/brushBlend.ts');
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
   ...settings,...brushStrokeMetadata(settings),...brushBlendSettingsFor(settings,6),brushBlendVersion:6,bbBlur:undefined,id:'dual-blend-v4',kind:'stroke' as const,tool:'brush' as const,
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
 expect(result).toMatchObject({version:6,style:'texture',outside:0,parity:0});
 expect(result.changed).toBeGreaterThan(100);
 expect(result.outer).toBeGreaterThan(0);
 for(const count of result.variations)expect(count).toBeGreaterThan(0);
});

test('watercolor presets keep distinct feel with their real masks and worker replay',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {brushBlendSettingsFor}=await import('/src/core/brushBlend.ts');
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
   return {...settings,...brushStrokeMetadata(settings),...brushBlendSettingsFor(settings,6),brushBlendVersion:6,bbBlur:undefined,id:'watercolor-feel',kind:'stroke' as const,tool:'brush' as const,
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
  expect(row.version,row.id).toBe(6);
  expect(row.outside,row.id).toBe(0);
  expect(row.changed,row.id).toBeGreaterThan(100);
 }
 const [smooth,wet,rough,flat]=result.rows;
 expect(rough.gaps).toBeGreaterThan(smooth.gaps+15);
 expect(wet.changed).toBeGreaterThan(rough.changed);
 expect(flat.span).toBeGreaterThan(result.turnedSpan+8);
 expect(result.workerDiff).toBe(0);
});

test('Blend Settings previews strength presets, saves per brush and resets',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Drawing canvas',{exact:true}).waitFor();
 await selectBrushOption(page,'Brush category','Paint');
 await selectBrushOption(page,'Brush family','all');
 await selectBrushOption(page,'Brush preset','water-flat');
 await page.getByRole('group',{name:'Paint or Blend'}).first().getByRole('button',{name:'Blend',exact:true}).click();
 await openBrushSettings(page);
 await page.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:'Blend settings',exact:true}).click();
 const panel=page.getByRole('region',{name:'Brush Settings'});
 const preview=panel.getByRole('img',{name:'Live preview of two colours blending with the current settings'});
 const pixels=()=>preview.evaluate((c:HTMLCanvasElement)=>c.toDataURL());
 const strength=panel.getByRole('slider',{name:'Blend strength',exact:true});
 const minimum=panel.getByRole('slider',{name:'Minimum blend at light pressure',exact:true});
 const pressure=panel.getByRole('checkbox',{name:'Pressure changes blend',exact:true});
 const curve=panel.getByRole('combobox',{name:'Blend pressure curve',exact:true});
 const style=panel.getByRole('combobox',{name:'Blend style',exact:true});
 await expect(strength).toHaveValue('100');
 await expect(strength).toHaveAttribute('max','200');
 await expect(minimum).toHaveValue('70');
 await expect(pressure).not.toBeChecked();
 await expect(style).toHaveValue('auto');
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const normal=await pixels();
 await panel.getByRole('button',{name:'Light blend',exact:true}).click();
 await expect(strength).toHaveValue('50');
 await expect.poll(pixels).not.toBe(normal);
 await panel.getByRole('button',{name:'Strong blend',exact:true}).click();
 await expect(strength).toHaveValue('160');
 await panel.getByRole('button',{name:'Normal blend',exact:true}).click();
 await expect(strength).toHaveValue('100');
 await expect.poll(pixels).toBe(normal);
 await pressure.check();
 await curve.selectOption('firm');
 await style.selectOption('dry');
 await expect.poll(pixels).not.toBe(normal);
 await panel.getByRole('button',{name:'Reset Blend settings',exact:true}).click();
 await expect(pressure).not.toBeChecked();
 await expect(curve).toHaveValue('linear');
 await expect(style).toHaveValue('auto');
 await expect.poll(pixels).toBe(normal);
});

test('pen-down captures Blend settings independently of ordinary Paint pressure',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',bp='/src/core/brushes.ts';
  const {newProject,activeLayer}=await import(mp);
  const {DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{stockPresets}=await import(bp);
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;inset:0;width:480px;height:320px';
  document.body.append(canvas);
  let captured=false;
  canvas.setPointerCapture=()=>{captured=true;};
  canvas.hasPointerCapture=()=>captured;
  canvas.releasePointerCapture=()=>{captured=false;};
  const store=new DocumentStore(newProject('Pen pressure',480,320));
  const engine=new StudioEngine(canvas,store,()=>{});
  await new Promise(requestAnimationFrame);
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  const watercolor=stockPresets.find((p:{id:string})=>p.id==='water-flat').settings;
  const send=(type:string,x:number,pressure:number)=>{
   canvas.dispatchEvent(new PointerEvent(type,{pointerId:4,isPrimary:true,button:0,pointerType:'pen',clientX:x,clientY:150,pressure}));
  };
  engine.setInput('brush',{...watercolor,pressureOpacity:true,bbEnabled:true});
  send('pointerdown',160,.1);
  engine.setInput('brush',{...watercolor,pressureOpacity:true,bbEnabled:true,bbStrength:1.6,bbPressure:true,bbPressureCurve:'firm'});
  send('pointermove',190,.5);send('pointerup',210,0);
  send('pointerdown',230,.1);send('pointerup',260,0);
  engine.setInput('brush',{...watercolor,pressureOpacity:true});
  send('pointerdown',270,.1);send('pointerup',310,0);
  return activeLayer(store.getSnapshot()).operations.map((s:{brushBlendVersion?:number;bbStrength?:number;bbPressure?:boolean;bbPressureCurve?:string;pressureFlow?:boolean;pressureOpacity?:boolean;pressureWidth?:boolean;minSize?:number})=>[
   s.brushBlendVersion??null,s.bbStrength??null,s.bbPressure??null,s.bbPressureCurve??null,s.pressureFlow,s.pressureOpacity,s.pressureWidth,s.minSize,
  ]);
 });
 expect(result).toEqual([
  [8,1,false,'linear',true,true,true,.1],
  [8,1.6,true,'firm',true,true,true,.1],
  [null,null,null,null,true,true,true,.1],
 ]);
});

test('real stock brush masks keep light-pressure blending strong across families',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const bp='/src/core/brushes.ts',mp='/src/core/paintTips.ts',cp='/src/core/brushBlend.ts',rp='/src/engine/renderer.ts',ep='/src/engine/brushBlend.ts';
  const {stockPresets}=await import(bp),{brushStrokeMetadata}=await import(mp),{prepareBlendMaskPressure}=await import(cp);
  const {drawStroke}=await import(rp),{renderBrushBlend}=await import(ep);
  const setup=()=>{
   const canvas=document.createElement('canvas');
   canvas.width=420;canvas.height=200;
   return canvas.getContext('2d',{willReadFrequently:true})!;
  };
  const mask=setup(),out=setup();
  return ['water-smooth','water-wet','water-rough','water-flat','dry-paint','paint','hb','g-pen','marker','color-air'].map(id=>{
   const settings=stockPresets.find((p:{id:string})=>p.id===id).settings;
   const strengths=[.1,.5,1].map(p=>{
    const stroke={
     ...settings,...brushStrokeMetadata({...settings,bbEnabled:true}),
     id:'pressure-swatch',kind:'stroke',tool:'brush',pressure:true,size:85,
     points:[{x:65,y:100,p,v:.65},{x:345,y:100,p,v:.65}],
    };
    prepareBlendMaskPressure(stroke);
    out.fillStyle='#f23535';out.fillRect(0,0,210,200);
    out.fillStyle='#154aea';out.fillRect(210,0,210,200);
    mask.clearRect(0,0,420,200);
    drawStroke(mask,stroke);renderBrushBlend(out,mask.canvas,stroke);
    const coverage=mask.getImageData(210,0,30,200).data,pixels=out.getImageData(210,0,30,200).data;
    let area=0,delta=0;
    for(let i=0;i<pixels.length;i+=4){area+=coverage[i+3]/255;delta+=Math.abs(pixels[i]-21);}
    return delta/Math.max(1,area);
   });
   return {id,strengths};
  });
 });
 for(const {id,strengths:[light,medium,full]} of result){
  expect(full,id).toBeGreaterThan(1);
  expect(light,id).toBeGreaterThanOrEqual(.7*full);
  expect(medium,id).toBeGreaterThanOrEqual(.7*full);
 }
});

test('Silk toolbar and B B activate the current brush in the shared Blend settings',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Drawing canvas',{exact:true}).waitFor();
 const preset=activeBrush(page);
 const silk=page.getByRole('button',{name:'Silk Blend (B B)',exact:true}).first();
 const toggle=page.getByRole('group',{name:'Paint or Blend'}).first();
 const id=await preset.getAttribute('data-current-brush-id');
 await silk.click();
 await expect(silk).toHaveAttribute('aria-pressed','true');
 await expect(preset).toHaveAttribute('data-current-brush-id',id!);
 await expect(toggle.getByRole('button',{name:'Blend',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('j');
 await expect(toggle.getByRole('button',{name:'Paint',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('e');
 await page.keyboard.press('b');
 await page.keyboard.press('b');
 await expect(silk).toHaveAttribute('aria-pressed','true');
 await expect(preset).toHaveAttribute('data-current-brush-id',id!);
 await expect(page.getByRole('group',{name:'Silk Blend settings',exact:true})).toHaveCount(0);
 await openBrushSettings(page);
 const panel=page.getByRole('region',{name:'Brush Settings'});
 await panel.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:'Blend settings',exact:true}).click();
 const controls=panel.getByRole('group',{name:'Silk Blend settings',exact:true});
 const style=panel.getByRole('combobox',{name:'Blend style',exact:true});
 await expect(style).toHaveValue('silk');
 await expect(style.locator('option')).toHaveText(['Auto (brush family)','Silk','Soft blur','Wet','Smudge','Dry']);
 await expect(controls.getByRole('slider')).toHaveCount(8);
 const mode=controls.getByRole('combobox',{name:'Silk Blend mode'});
 await expect(mode.locator('option')).toHaveText(['Soft','Wet','Smudge','Dry']);
 for(const name of ['Silk Soft','Silk Wet','Silk Dry'])await expect(controls.getByRole('button',{name,exact:true})).toBeVisible();
 await controls.getByRole('button',{name:'Silk Dry',exact:true}).click();
 await expect(mode).toHaveValue('dry');
 await expect(controls.getByRole('slider',{name:'Blend Strength',exact:true})).toHaveValue('75');
 await style.selectOption('auto');
 await expect(controls).toBeHidden();
 await style.selectOption('silk');
 await expect(mode).toHaveValue('dry');
 await panel.getByRole('combobox',{name:'Settings brush preset'}).selectOption('silk-blend');
 await expect(style).toHaveValue('silk');
});

test('Silk fallback previews update and its watercolor strokes undo and redo byte-identically',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const mp='/src/core/model.ts',hp='/src/core/history.ts',ep='/src/engine/StudioEngine.ts',bp='/src/core/brushes.ts',rp='/src/engine/renderer.ts';
  const {newProject,activeLayer}=await import(mp);
  const {DocumentStore}=await import(hp),{StudioEngine}=await import(ep),{stockPresets}=await import(bp),{LayerRenderer}=await import(rp);
  const project=newProject('Silk history',480,320);
  const paint=(x:number,color:string)=>({
   id:color,kind:'stroke',tool:'brush',size:150,pressure:false,response:1,opacity:1,color,
   points:[{x,y:20,p:1},{x,y:300,p:1}],
  });
  activeLayer(project).operations=[paint(165,'#eb3131'),paint(315,'#145adc')];
  const store=new DocumentStore(project),canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;inset:0;width:480px;height:320px';
  document.body.append(canvas);
  let captured=false;
  canvas.setPointerCapture=()=>{captured=true;};
  canvas.hasPointerCapture=()=>captured;
  canvas.releasePointerCapture=()=>{captured=false;};
  const engine=new StudioEngine(canvas,store,()=>{});
  engine.blendWorker.available=()=>false;
  engine.blendWorker.preview=()=>undefined;
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  await frame();
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  const capture=()=>{
   const snapshot=store.getSnapshot(),r=new LayerRenderer();
   const layer=r.get(activeLayer(snapshot),snapshot);
   return layer.getContext('2d').getImageData(0,0,480,320).data;
  };
  const diff=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.reduce((n,v,i)=>n+(v===b[i]?0:1),0);
  const before=capture();
  const watercolor=stockPresets.find((p:{id:string})=>p.id==='water-flat').settings;
  engine.setInput('brush',{...watercolor,bbEnabled:true,bbRenderStyle:'silk',silkMode:'smudge',nativeMixEnabled:true,size:80});
  const send=(type:string,x:number)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:4,isPrimary:true,button:0,pointerType:'pen',clientX:x,clientY:150,pressure:.6}));
  const preview=()=>engine.previewSurface.getContext('2d').getImageData(0,0,480,320).data;
  send('pointerdown',100);
  send('pointermove',170);
  await frame();
  const beginning=preview();
  send('pointermove',240);
  send('pointermove',315);
  await frame();
  const liveChanged=diff(beginning,preview());
  send('pointerup',380);
  const operation=activeLayer(store.getSnapshot()).operations.at(-1);
  const after=capture();
  engine.historyNavigation('undo');
  const undone=capture();
  engine.historyNavigation('redo');
  const redone=capture();
  engine.dispose();canvas.remove();
  return {version:operation.silkBlendVersion,style:operation.silkMode,otherVersion:operation.brushBlendVersion??null,mix:operation.nativeMixVersion??null,
   liveChanged,changed:diff(before,after),undo:diff(before,undone),redo:diff(after,redone)};
 });
 expect(result).toMatchObject({version:2,style:'smudge',otherVersion:null,mix:null,undo:0,redo:0});
 expect(result.changed).toBeGreaterThan(100);
 expect(result.liveChanged).toBeGreaterThan(100);
});
