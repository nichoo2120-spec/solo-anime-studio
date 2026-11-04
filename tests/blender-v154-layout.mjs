import {createServer} from '../node_modules/vite/dist/node/index.js';
import {chromium} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const before=process.argv.includes('--baseline'),root=before?path.resolve(process.env.DRY_BASELINE_ROOT??'../baseline153/Solo_Anime_Studio_v0_5_153'):process.cwd();
const server=await createServer({root,server:{host:'127.0.0.1',port:5531,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const rows=[];
 for(const [width,height]of [[1280,720],[1920,1080],[1024,600]]){
  const page=await browser.newPage({viewport:{width,height}});await page.goto('http://127.0.0.1:5531');await page.waitForFunction(()=>window.soloStrokeDiagnostics);await page.evaluate(()=>document.fonts.ready);
  const cases=[];
  for(const mode of ['DRAW','ANIMATE']){
   await page.getByRole('button',{name:mode,exact:true}).click();
   const tools=await page.locator('.navigation-tools button').evaluateAll(es=>es.map(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{name:el.getAttribute('aria-label'),visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&!!hit&&(el===hit||el.contains(hit))};}));
   const highlights=[];
   for(const key of ['b','n','e','g','s','l','m','v','h','z','r','i']){await page.keyboard.press(key);highlights.push({key,selected:await page.locator('.navigation-tools button[aria-pressed="true"]').count()});}
   cases.push({mode,tools,highlights});
  }
  const menus=[];
  for(const name of ['Edit','Animation']){
   await page.getByRole('button',{name,exact:true}).click();const popup=page.locator('.dropdown');
   const last=popup.locator('button:enabled').last();await last.scrollIntoViewIfNeeded();
   const bounds=await popup.evaluate(el=>{const r=el.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};});
   const hit=await last.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(el===hit||el.contains(hit));});
   menus.push({name,bounds,lastItem:await last.textContent(),lastHittable:hit});await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'DRAW',exact:true}).click();
  const wheelOverlap=await page.evaluate(()=>{const a=document.querySelector('.radial-wrap')?.getBoundingClientRect(),b=document.querySelector('.layer-heading')?.getBoundingClientRect();return !!a&&!!b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});
  await page.keyboard.press('b');
  await page.screenshot({path:'validation/v154-'+(before?'before':'after')+'-ui-'+width+'.png'});
  const layerHeadingVisible=await page.locator('.layer-heading').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
  const wheel={};
  if(!before){
   await page.getByRole('button',{name:'Circular toolbar options',exact:true}).click();await page.getByLabel('Toolbar dock',{exact:true}).selectOption('panel');await page.getByRole('button',{name:'Done',exact:true}).click();wheel.parked=await page.locator('#tool-wheel-home .radial-wrap').count()===1;
   await page.getByRole('button',{name:'Expand circular toolbar',exact:true}).click();wheel.expanded=await page.getByRole('button',{name:'Collapse circular toolbar',exact:true}).count()===1;
   await page.getByRole('button',{name:'Collapse circular toolbar',exact:true}).click();
   const grip=page.getByRole('button',{name:'Drag circular toolbar',exact:true}),box=await grip.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(380,170,{steps:8});await page.mouse.up();const moved=await page.locator('.radial-wrap').boundingBox();wheel.draggable=moved.x>250;
   await page.getByRole('button',{name:'Circular toolbar options',exact:true}).click();await page.getByLabel('Toolbar dock',{exact:true}).selectOption('panel');await page.getByRole('button',{name:'Done',exact:true}).click();
   assert(wheel.parked&&wheel.expanded&&wheel.draggable,JSON.stringify(wheel));assert(!wheelOverlap);assert(layerHeadingVisible);
  }
  rows.push({width,height,cases,menus,wheelOverlap,layerHeadingVisible,wheel});await page.close();
 }
 fs.writeFileSync('validation/v154-'+(before?'before':'after')+'-layout.json',JSON.stringify(rows,null,2));
 if(!before)for(const r of rows){for(const c of r.cases){assert.equal(c.tools.length,12);assert(c.tools.every(t=>t.visible),JSON.stringify(c));assert(c.highlights.every(h=>h.selected===1),JSON.stringify(c.highlights));}assert(r.menus.every(m=>m.lastHittable&&m.bounds.top>=0&&m.bounds.bottom<=r.height&&m.bounds.left>=0&&m.bounds.right<=r.width),JSON.stringify(r.menus));}
 console.log(JSON.stringify(rows,null,2));
}finally{await browser.close();await server.close();}
