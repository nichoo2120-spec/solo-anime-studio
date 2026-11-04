import {preview} from '../node_modules/vite/dist/node/index.js';
import {chromium} from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const server=await preview({root:process.cwd(),preview:{host:'127.0.0.1',port:5461,strictPort:true}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const expected=['Smooth Watercolor','Rough Watercolor','Soft Wet Watercolor','Flat Watercolor','Gradient Watercolor'];
const retired=['watercolor','watercolor-round','watercolor-dagger','watercolor-cats-tongue','watercolor-liner','watercolor-paper','watercolor-dry-wash','watercolor-soft-bloom'];
const report={errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1450,height:960}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(({retired})=>{if(localStorage.getItem('test-v133-seeded'))return;const base={size:20,opacity:.8,color:'#30343a',pressure:true,response:1,brushKind:'paint',brushTip:'round'};const presets=retired.map((id,i)=>({id,name:'Retired brush '+i,category:'Paint',custom:true,defaults:base,settings:base}));const old={...base,brushKind:'watercolor',brushTip:'wash-flat'};presets.push({id:'renamed-old-copy',name:'Renamed old copy',category:'Paint',custom:true,defaults:old,settings:old});localStorage.setItem('solo:brush-library',JSON.stringify({brushId:'watercolor-dagger',eraserId:'eraser-hard',presets}));localStorage.setItem('test-v133-seeded','1');},{retired});
 await page.goto('http://127.0.0.1:5461');await page.waitForFunction(()=>window.soloStrokeDiagnostics);
 report.build=await page.evaluate(()=>window.soloStrokeDiagnostics.build);assert.equal(report.build.version,'0.5.133');
 assert.equal(await page.getByLabel('Brush preset',{exact:true}).inputValue(),'soft-paint');
 const check=async()=>{await page.getByLabel('Brush category',{exact:true}).selectOption('Paint');const presets=page.getByLabel('Brush preset',{exact:true}),names=await presets.locator('option').allTextContents();assert.equal(names.length,11);assert.deepEqual(names.filter(n=>/watercolor/i.test(n)),expected);assert(!names.some(n=>/retired|old copy|wash|bloom|dagger|liner|tongue/i.test(n)));const tips=await page.getByLabel('Brush tip shape',{exact:true}).locator('option').evaluateAll(options=>options.map(o=>({id:o.value,name:o.textContent})));assert.equal(tips.filter(t=>t.id.startsWith('water-')).length,5);assert(!tips.some(t=>t.id==='wash'||t.id.startsWith('wash-')));const cards=await page.getByRole('group',{name:'Paint brush tips',exact:true}).getByRole('button').allTextContents();assert.equal(cards.length,11);assert(!cards.some(n=>/retired|old copy|dagger|tongue|bloom|wash/i.test(n)));return {names,tips};};
 report.beforeReload=await check();for(const name of expected){await page.getByLabel('Brush preset',{exact:true}).selectOption({label:name});assert.equal(await page.getByLabel('Pigment amount exact value',{exact:true}).count(),1);assert.equal(await page.getByLabel('Water amount exact value',{exact:true}).count(),1);}
 await page.reload();await page.waitForFunction(()=>window.soloStrokeDiagnostics);report.afterReload=await check();assert.deepEqual(report.afterReload,report.beforeReload);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('solo:brush-library')));assert(!stored.presets.some(p=>p.id==='renamed-old-copy'||retired.includes(p.id)));assert.deepEqual(report.errors,[]);
 fs.writeFileSync('validation/library-v133-ui.json',JSON.stringify(report,null,2));
 console.log('Production UI: only five new watercolor presets/tips/cards; all eight old IDs and legacy custom copies absent; migration persists after reload; no page errors.');
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
