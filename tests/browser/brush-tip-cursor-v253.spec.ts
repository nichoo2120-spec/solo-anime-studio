import {expect,test,type Page} from '@playwright/test';
import {openBrushImports,openBrushSettings,selectBrushOption,setBrushSize} from '../brush-workspace.mjs';

const drawing = (page:Page) => page.getByLabel('Drawing canvas',{exact:true});
const overlay = (page:Page) => page.locator('.brush-cursor-overlay');
const panel = (page:Page) => page.getByRole('region',{name:'Brush Settings',exact:true});
async function cursorStyle(page:Page,style:string) {
 await openBrushSettings(page);
 await panel(page).getByRole('button',{name:'Cursor',exact:true}).click();
 await panel(page).getByRole('combobox',{name:'Cursor style',exact:true}).selectOption(style);
 await panel(page).getByRole('button',{name:'Done',exact:true}).click();
}
async function silhouette(page:Page) {
 const box = (await drawing(page).boundingBox())!;
 const x = Math.round(box.width * .55), y = Math.round(box.height * .50);
 await drawing(page).hover({position:{x,y}});
 return overlay(page).evaluate(async (canvas:HTMLCanvasElement,{x,y})=>{
  await new Promise(requestAnimationFrame);
  const dpr = devicePixelRatio, cx = Math.round(x*dpr), cy = Math.round(y*dpr);
  const side = Math.round(192*dpr), half = Math.floor(side/2);
  const data = canvas.getContext('2d')!.getImageData(cx-half,cy-half,side,side).data;
  let count=0, minX=side, minY=side, maxX=0,maxY=0,minRadius=Infinity,maxRadius=0;
  for(let iy=0;iy<side;iy++)for(let ix=0;ix<side;ix++){
   if(data[(iy*side+ix)*4+3]<180)continue;
   const radius=Math.hypot(ix-half,iy-half)/dpr;
   minRadius=Math.min(minRadius,radius);maxRadius=Math.max(maxRadius,radius);
   minX=Math.min(minX,ix);maxX=Math.max(maxX,ix);minY=Math.min(minY,iy);maxY=Math.max(maxY,iy);count++;
  }
  return {count,width:(maxX-minX)/dpr,height:(maxY-minY)/dpr,minRadius,maxRadius};
 },{x,y});
}

test('Ink, chalk, grass and an imported mask show their real cursor outline with Circle as a global option',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');
 await drawing(page).waitFor();
 await page.getByLabel('Canvas zoom',{exact:true}).selectOption('100');
 const before = await drawing(page).evaluate(async (canvas:HTMLCanvasElement)=>{
  await new Promise(requestAnimationFrame);
  return canvas.toDataURL();
 });
 await selectBrushOption(page,'Brush category','Ink');
 await selectBrushOption(page,'Brush preset','brush-pen');
 await setBrushSize(page,64);
 await openBrushSettings(page);
 await panel(page).getByRole('button',{name:'Brush tip',exact:true}).click();
 await panel(page).getByRole('combobox',{name:'Ink tip shape',exact:true}).selectOption('oval');
 await panel(page).getByLabel('Roundness exact value',{exact:true}).fill('30');
 await panel(page).getByLabel('Roundness exact value',{exact:true}).press('Enter');
 await panel(page).getByRole('button',{name:'Done',exact:true}).click();
 const ink=await silhouette(page);
 expect(ink.count).toBeGreaterThan(35);
 expect(ink.maxRadius-ink.minRadius).toBeGreaterThan(10);

 await selectBrushOption(page,'Brush category','Paint');
 await selectBrushOption(page,'Brush preset','dry');
 await setBrushSize(page,64);
 const chalk=await silhouette(page);
 expect(chalk.count).toBeGreaterThan(35);
 expect(chalk.maxRadius-chalk.minRadius).toBeGreaterThan(7);

 await selectBrushOption(page,'Brush category','Texture / Nature');
 await selectBrushOption(page,'Brush preset','nature-grass-tall');
 await setBrushSize(page,64);
 const grass=await silhouette(page);
 expect(grass.count).toBeGreaterThan(20);
 expect(grass.maxRadius-grass.minRadius).toBeGreaterThan(12);

 const png=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d')!;
  ctx.fillRect(4,4,18,56);ctx.fillRect(4,42,56,18);
  return canvas.toDataURL().split(',')[1];
 });
 await openBrushImports(page);
 await page.getByLabel('Choose brush files').setInputFiles({name:'Cursor L.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 const current=page.getByRole('button',{name:'Choose brush',exact:true});
 await expect(current).toHaveAttribute('data-current-brush-category','Imported');
 await current.click();
 const imported=await silhouette(page);
 expect(imported.count).toBeGreaterThan(50);
 expect(imported.maxRadius-imported.minRadius).toBeGreaterThan(10);
 expect(await drawing(page).evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL())).toBe(before);

 await cursorStyle(page,'circle');
 const circle=await silhouette(page);
 expect(circle.width).toBeGreaterThan(58);
 expect(Math.abs(circle.width-circle.height)).toBeLessThanOrEqual(2);
 expect(circle.maxRadius-circle.minRadius).toBeLessThan(4);
 await page.reload();
 await openBrushSettings(page);
 await panel(page).getByRole('button',{name:'Cursor',exact:true}).click();
 await expect(panel(page).getByRole('combobox',{name:'Cursor style',exact:true})).toHaveValue('circle');
});

test('cached hover overlay stays within a 16 ms p95 for a 1000 px imported tip',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {StudioEngine}=await load('/src/engine/StudioEngine.ts');
  const {DocumentStore}=await load('/src/core/history.ts');
  const {newProject}=await load('/src/core/model.ts');
  const {activePreset,addImportedBrushes,newBrushLibrary}=await load('/src/core/brushes.ts');
  const {encodeBitmapMask}=await load('/src/core/brushImport/mask.ts');
  const side=512, alpha=new Uint8Array(side*side);
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
   const dx=x-256,dy=y-256,limit=195+43*Math.cos(12*Math.atan2(dy,dx));
   if(Math.hypot(dx,dy)<limit&&((x+y)%37)>2)alpha[y*side+x]=255;
  }
  const mask=await encodeBitmapMask(alpha,side,side);
  const preset=activePreset(addImportedBrushes(newBrushLibrary(),'Cursor',[{name:'Large stamp',tips:[mask],size:500}]));
  const host=document.createElement('div');
  host.style.cssText='position:fixed;inset:0;pointer-events:none';
  const canvas=document.createElement('canvas');
  canvas.style.cssText='width:1280px;height:800px;display:block';
  host.append(canvas);document.body.append(host);
  const engine=new StudioEngine(canvas,new DocumentStore(newProject('Cursor perf',1000,700)),()=>{});
  const raf=window.requestAnimationFrame.bind(window), frame=()=>new Promise<void>(resolve=>raf(()=>resolve()));
  const hover=(i:number)=>canvas.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',isPrimary:true,clientX:600+i%40,clientY:380+i%23}));
  try{
   engine.setView({x:0,y:0,zoom:2,rotation:0});
   engine.setInput('brush',preset.settings,preset);
   await frame();await frame();hover(0);await frame();await frame();
   const before=canvas.toDataURL(),samples:number[]=[];
   for(let i=1;i<=72;i++){
    const actual=window.requestAnimationFrame;
    window.requestAnimationFrame=callback=>raf(timestamp=>{
     const start=performance.now();
     callback(timestamp);
     samples.push(performance.now()-start);
    });
    try{hover(i);}finally{window.requestAnimationFrame=actual;}
    await frame();
   }
   samples.sort((a,b)=>a-b);
   return {p95:samples[Math.ceil(samples.length*.95)-1],count:samples.length,diameter:preset.settings.size*engine.view.zoom,unchanged:before===canvas.toDataURL()};
  }finally{engine.dispose();host.remove();}
 });
 console.log('1000 px cursor overlay',result);
 expect(result.diameter).toBe(1000);
 expect(result.count).toBe(72);
 expect(result.p95).toBeLessThanOrEqual(16);
 expect(result.unchanged).toBe(true);
});
