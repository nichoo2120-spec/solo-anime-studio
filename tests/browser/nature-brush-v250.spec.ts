import {expect,test} from '@playwright/test';

test('Nature presets expose actual thumbnails, seed settings and a large brush size',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Brush category',{exact:true}).selectOption('Texture / Nature');
 const select=page.getByLabel('Brush preset',{exact:true});
 await select.selectOption('nature-foliage-clump');
 await page.getByRole('button',{name:'Brush Settings',exact:true}).click();
 const region=page.getByRole('region',{name:'Brush Settings'});
 await region.getByRole('button',{name:'Texture',exact:true}).click();
 const thumbnails=region.getByRole('group',{name:'Texture / Nature brush previews'});
 await expect(thumbnails.getByRole('button',{name:'Use Foliage clump',exact:true})).toHaveAttribute('aria-pressed','true');
 const preview=thumbnails.getByLabel('Foliage clump stroke preview',{exact:true});
 await expect.poll(()=>preview.evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))).toBe(true);
 const seed=region.getByLabel('Seed',{exact:true});
 await seed.fill('234567');
 await thumbnails.getByRole('button',{name:'Use Tall grass',exact:true}).click();
 await thumbnails.getByRole('button',{name:'Use Foliage clump',exact:true}).click();
 await expect(seed).toHaveValue('234567');
 await region.getByRole('button',{name:'New random',exact:true}).click();
 await expect(seed).not.toHaveValue('234567');
 await expect(page.getByRole('slider',{name:'Size',exact:true})).toHaveAttribute('max','500');
});

test('Nature Paint responds within budget at 50, 150 and 300 px',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const m=await load('/src/core/model.ts'),{DocumentStore}=await load('/src/core/history.ts'),{StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const host=document.createElement('div');document.body.append(host);
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:1280px;height:720px';host.append(canvas);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const store=new DocumentStore(m.newProject('Nature performance',1280,720)),engine=new StudioEngine(canvas,store,()=>{});
  await new Promise(requestAnimationFrame);
  engine.setView({x:0,y:0,zoom:1,rotation:0});
  const preset=stockPresets.find((p:{id:string})=>p.id==='nature-foliage-clump');
  const p95=(values:number[])=>values.sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
  const rows=[];
  try{
   for(const size of [50,150,300]){
    engine.setInput('brush',{...preset.settings,size});
    const frames:number[]=[],ends:number[]=[];
    for(let n=0;n<9;n++){
     const y=335+Math.sin(n)*40;
     const send=(type:string,i:number)=>canvas.dispatchEvent(new PointerEvent(type,{pointerType:'pen',pointerId:5,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,pressure:.75,clientX:200+i*7,clientY:y+Math.sin(i*.11)*35}));
     send('pointerdown',0);
     for(let i=1;i<=88;i++){
      send('pointermove',i);
      if(i%4===0){
       const t=performance.now();engine.render();
       if(n>=2)frames.push(performance.now()-t);
      }
     }
     const t=performance.now();send('pointerup',88);engine.render();if(n>=2)ends.push(performance.now()-t);
     await new Promise(requestAnimationFrame);
    }
    const op=m.activeLayer(store.getSnapshot()).operations.at(-1);
    rows.push({size,frameP95:p95(frames),penUpP95:p95(ends),version:op?.natureVersion,seed:op?.nature?.seed});
   }
   return rows;
  }finally{engine.dispose();host.remove();}
 });
 console.log('NATURE_PERF',JSON.stringify(results));
 for(const row of results){
  expect(row.version).toBe(1);expect(row.seed).toBeGreaterThan(0);
  expect(row.frameP95).toBeLessThanOrEqual(16);
  expect(row.penUpP95).toBeLessThanOrEqual(50);
 }
});

test('Nature Blend uses the seeded stamp mask and agrees with saved replay',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {compositePaintStroke}=await load('/src/engine/paintCompositing.ts');
  const {LiveBlendWorker}=await load('/src/engine/LiveBlendWorker.ts');
  const canvas=()=>Object.assign(document.createElement('canvas'),{width:440,height:260});
  const read=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  const base=canvas(),ctx=base.getContext('2d')!;
  ctx.fillStyle='#315d9a';ctx.fillRect(0,0,220,260);ctx.fillStyle='#b05a61';ctx.fillRect(220,0,220,260);
  const settings={...stockPresets.find((p:{id:string})=>p.id==='nature-leaves-pointed').settings,bbEnabled:true,bbMix:.1,bbStrength:1};
  const s={...brushStrokeMetadata(settings),id:'seeded-blend',kind:'stroke',tool:'brush',brushKind:settings.brushKind,size:100,opacity:1,pressure:false,response:1,color:'#00ff00',points:Array.from({length:48},(_,i)=>({x:110+i*4.5,y:125+14*Math.sin(i*.18),p:1}))};
  const mask=canvas(),full=canvas(),output=full.getContext('2d')!;
  output.drawImage(base,0,0);drawStroke(mask.getContext('2d')!,s);
  compositePaintStroke(output,mask,JSON.parse(JSON.stringify(s)));
  let handle:()=>void=()=>{};
  const worker=new LiveBlendWorker(()=>handle());
  try{
   await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Nature Blend worker preview timed out')),7000);
    handle=()=>{clearTimeout(timer);resolve();};
    worker.preview(s,base,{});
   });
   const pending=worker.finish(s);
   const final=await pending?.done;
   if(!final)throw Error('Nature Blend worker did not finish');
   const previous=read(base),replay=read(full),maskPixels=read(mask),workerPixels=read(final);
   let changed=0,outside=0,parity=0;
   for(let i=0;i<replay.length;i+=4){
    const diff=previous[i]!==replay[i]||previous[i+1]!==replay[i+1]||previous[i+2]!==replay[i+2]||previous[i+3]!==replay[i+3];
    if(diff){changed++;if(!maskPixels[i+3])outside++;}
    for(let k=0;k<4;k++)parity+=Number(replay[i+k]!==workerPixels[i+k]);
   }
   return {changed,outside,parity};
  }finally{worker.dispose();}
 });
 expect(result.changed).toBeGreaterThan(0);
 expect(result.outside).toBe(0);
 expect(result.parity).toBe(0);
});
