import {selectBrushOption,openBrushSettings,activeBrush,openBrushSelection} from './brush-workspace.mjs';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const server=await createServer({server:{host:'127.0.0.1',port:5797,strictPort:true}});
let browser;
try{
 await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/workspace/scratch/e841b2ae644b/qa-tools/runtime/chromium'),args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:5797/');await page.waitForFunction(()=>window.soloStrokeDiagnostics);
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;const ctx=c.getContext('2d');ctx.fillStyle='#ef1529';ctx.fillRect(20,20,360,660);ctx.fillStyle='#1246cd';ctx.fillRect(380,20,290,660);return{format:'solo-anime-studio',version:3,id:'native-mix-ui',name:'Native Mix UI',width:1000,height:700,activeLayerId:'paint',layers:[{id:'paint',name:'Paint',visible:true,locked:false,opacity:1,kind:'raster',operations:[{id:'base-paint',kind:'image',png:c.toDataURL(),x:0,y:0,width:1000,height:700}]}],settings:{guides:false},createdAt:'2026-11-04T00:00:00.000Z'};});
 await page.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles({name:'mix.solo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.waitForFunction(()=>document.querySelector('.document-tab')?.textContent.includes('Native Mix UI'));
 assert.equal(await page.getByRole('tablist',{name:'Brush paint or mix mode'}).count(),0,'separate Mix mode selector should be removed');
 assert.equal(await page.getByRole('button',{name:'Mix',exact:true}).count(),0,'separate Mix tool action should be removed');
 await selectBrushOption(page,'Brush category','Paint');
 await selectBrushOption(page,'Brush family','all');
 const picker=await openBrushSelection(page);
 const preset=picker.getByLabel('Brush preset',{exact:true});
 const available=await preset.locator('option').evaluateAll(options=>options.map(o=>o.value));
 for(const retired of ['color-blender','smudge-bristle','blender-soft','wet-mix'])assert(!available.includes(retired),retired+' should not appear as a standalone brush preset');
 await preset.selectOption('soft-paint');
 await activeBrush(page).click();
 await openBrushSettings(page);
 await page.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:'Stroke',exact:true}).click();
 assert(await page.getByLabel('Flow exact value',{exact:true}).isVisible(),'Paint flow remains available');
 assert.deepEqual(errors,[]);
 console.log('MIX TOOL REMOVAL',JSON.stringify({separateMixMode:false,retiredMixPresets:available.filter(x=>['color-blender','smudge-bristle','blender-soft','wet-mix'].includes(x)),paintFlow:true}));
}finally{await browser?.close();await server.close();}
