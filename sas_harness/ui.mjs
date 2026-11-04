import {chromium} from '/workspace/sas_work/node_modules/playwright-core/index.mjs';import fs from 'fs';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const pg=await (await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1})).newPage();
await pg.goto('http://127.0.0.1:6161/');await pg.waitForTimeout(3000);
await pg.keyboard.press('b');await pg.waitForTimeout(500);
await pg.screenshot({path:'img/ui_brush_panel_b.png'});
const txt=await pg.evaluate(()=>document.body.innerText);
const out={hasMixWord:/\bMix\b/.test(txt),hasMixAmount:/mix amount/i.test(txt),hasPaintLoad:/paint load/i.test(txt),hasPickup:/pickup/i.test(txt),hasWetness:/wetness/i.test(txt)};
out.tabs=await pg.evaluate(()=>[...document.querySelectorAll('[role=tab],button')].map(e=>e.textContent.trim()).filter(t=>/^(paint|mix)$/i.test(t)));
out.activeTool=await pg.evaluate(()=>[...document.querySelectorAll('[aria-pressed=true]')].map(e=>e.getAttribute('aria-label')));
try{await pg.getByLabel('Expand circular toolbar').click({timeout:3000});}catch(e){out.expandErr=e.message.slice(0,80)}
await pg.waitForTimeout(500);
out.wheelTools=await pg.evaluate(()=>[...document.querySelectorAll('.radial-tool')].map(e=>e.getAttribute('aria-label')));
out.wheelBox=await pg.evaluate(()=>{const r=document.querySelector('.radial,.radial-expand')?.getBoundingClientRect();return r&&[r.x,r.y,r.width,r.height].map(Math.round)});
out.layersBox=await pg.evaluate(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/^LAYERS$/i.test(e.textContent.trim()));if(!el)return null;let p=el.closest('section,aside,div');const r=p.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round)});
await pg.screenshot({path:'img/ui_tool_wheel.png'});
console.log(JSON.stringify(out,null,1));fs.writeFileSync('ui_check.json',JSON.stringify(out,null,1));await b.close();
