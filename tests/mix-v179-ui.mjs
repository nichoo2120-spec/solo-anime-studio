import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='validation/mix-v179';fs.mkdirSync(out,{recursive:true});
const server=await createServer({cacheDir:'/tmp/solo-mix-ui',server:{host:'127.0.0.1',port:5797,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/workspace/scratch/e841b2ae644b/qa-tools/runtime/chromium'),args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:5797/');await page.waitForFunction(()=>window.soloStrokeDiagnostics);
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;const ctx=c.getContext('2d');ctx.fillStyle='#ef1529';ctx.fillRect(20,20,360,660);ctx.fillStyle='#1246cd';ctx.fillRect(380,20,290,660);return{format:'solo-anime-studio',version:3,id:'native-mix-ui',name:'Native Mix UI',width:1000,height:700,activeLayerId:'paint',layers:[{id:'paint',name:'Paint',visible:true,locked:false,opacity:1,kind:'raster',operations:[{id:'base-paint',kind:'image',png:c.toDataURL(),x:0,y:0,width:1000,height:700}]}],settings:{guides:false},createdAt:'2026-11-04T00:00:00.000Z'};});
 await page.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles({name:'mix.solo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.waitForFunction(()=>document.querySelector('.document-tab')?.textContent.includes('Native Mix UI'));
 const field=async(name,value)=>{if(!await page.getByRole('region',{name:'Brush Settings',exact:true}).count())await page.getByRole('button',{name:'Brush Settings',exact:true}).click();
 const group=['Mix strength','Add paint','Mix radius'].includes(name)?'Paint & mixing':'Stroke width';await page.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:group,exact:true}).click();const input=page.getByLabel((name==='Size'?'Brush size':name==='Opacity'?'Brush opacity':name)+' exact value',{exact:true});await input.fill(String(value));await input.press('Enter');};
 const backup=async()=>{await page.getByRole('button',{name:'File',exact:true}).click();const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Download editable backup',exact:true}).click();const stream=await(await waiting).createReadStream();let text='';for await(const b of stream)text+=b;return JSON.parse(text);};
 const settle=()=>page.waitForTimeout(300),canvas=page.getByLabel('Drawing canvas',{exact:true});
 const draw=async(index=0)=>{if(await page.getByRole('region',{name:'Brush Settings',exact:true}).count())await page.getByRole('button',{name:'Done',exact:true}).click();await canvas.evaluate(async(c,index)=>{c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;const r=c.getBoundingClientRect();for(let i=0;i<=72;i++){const t=i/72,event=new PointerEvent(i===0?'pointerdown':i===72?'pointerup':'pointermove',{pointerId:51,isPrimary:true,pointerType:'pen',button:0,buttons:i===72?0:1,pressure:.2+.8*Math.sin(t*Math.PI)**2,clientX:r.left+r.width*(.23+t*.56),clientY:r.top+r.height*(.35+index*.06+.04*Math.sin(t*Math.PI*2))});Object.defineProperty(event,'timeStamp',{value:10000+index*3000+i*8});c.dispatchEvent(event);if(i%4===0)await new Promise(requestAnimationFrame);}},index);await settle();};
 const presets=await page.evaluate(async()=>{const {stockPresets,isRetiredBlendPresetId}=await import('/src/core/brushes.ts');return stockPresets.filter(p=>p.category!=='Eraser'&&!isRetiredBlendPresetId(p.id)).map(p=>({id:p.id,category:p.category,brushKind:p.settings.brushKind,brushTip:p.settings.brushTip}));});
 const rows=[];
 for(const preset of presets){
  await page.getByLabel('Brush category',{exact:true}).selectOption(preset.category);if(preset.category==='Paint')await page.getByLabel('Brush family',{exact:true}).selectOption('all');
  await page.getByLabel('Brush preset',{exact:true}).selectOption(preset.id);await page.getByRole('button',{name:'Mix',exact:true}).click();await field('Size',90);await field('Opacity',85);await field('Mix strength',80);await field('Add paint',0);
  const before=await canvas.evaluate(c=>c.toDataURL());await draw();const after=await canvas.evaluate(c=>c.toDataURL());assert.notEqual(after,before,preset.id+' produced no displayed change');
  const saved=await backup(),stroke=saved.layers[0].operations.at(-1);assert.equal(stroke.nativeMixVersion,3,preset.id);assert.equal(stroke.nativeMixPaintLoad,0,preset.id);assert.equal(stroke.brushKind,preset.brushKind,preset.id);assert.equal(stroke.brushTip,preset.brushTip,preset.id);assert(stroke.points.some(p=>p.p>.9)&&stroke.points.some(p=>p.p<.3),preset.id+' lost pen pressure');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();assert.equal((await backup()).layers[0].operations.length,1,preset.id+' Undo');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settle();assert.deepEqual(await backup(),saved,preset.id+' Redo');
  rows.push({preset:preset.id,capturedVersion:stroke.nativeMixVersion,pressure:true,displayChanged:true,undoRedo:true});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();
 }
 // Reference mode: selected pigment is an explicit choice and is saved.
 await page.getByLabel('Brush category',{exact:true}).selectOption('Paint');await page.getByLabel('Brush family',{exact:true}).selectOption('coloring');await page.getByLabel('Brush preset',{exact:true}).selectOption('color-solid');await field('Add paint',75);await draw(1);
 const saved=await backup();assert.equal(saved.layers[0].operations.at(-1).nativeMixPaintLoad,.75);
 await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('button',{name:'Save · Ctrl/⌘ S',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.save-status')?.textContent==='Saved locally');
 await page.reload();await page.waitForFunction(()=>document.querySelector('.save-status')?.textContent==='Opened local project');assert.deepEqual(await backup(),saved);
 await page.screenshot({path:out+'/actual-app-mix.png'});
 fs.writeFileSync(out+'/ui-results.json',JSON.stringify({rows,loadedPaintSaved:true,projectReload:true,errors},null,2));assert.deepEqual(errors,[]);console.log(`${rows.length} actual UI Mix brushes captured v3 pressure strokes and passed Undo/Redo; loaded paint persisted after reload.`);
}finally{await browser.close();await server.close();}
