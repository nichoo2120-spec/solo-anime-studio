// v0.5.240 Paint / Blend switch in the real app: J shortcut, the Blend settings
// section, a real drawn Blend stroke that adds no paint, and the settings screenshot.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createServer} from 'vite';import {chromium} from '@playwright/test';
const port=5841,server=await createServer({logLevel:'error',cacheDir:'/tmp/solo-blend-v240-ui-vite',server:{host:'127.0.0.1',port,strictPort:true}});let browser,failed=false;
try{await server.listen();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),args:['--disable-gpu','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(`http://127.0.0.1:${port}`);await page.getByLabel('Drawing canvas',{exact:true}).waitFor();await page.waitForTimeout(800);
 await page.getByLabel('Brush category',{exact:true}).selectOption('Paint');await page.getByLabel('Brush family',{exact:true}).selectOption('all').catch(()=>{});await page.getByLabel('Brush preset',{exact:true}).selectOption('soft-paint');
 const drawing=page.getByLabel('Drawing canvas',{exact:true}),box=await drawing.boundingBox();
 const pixels=()=>drawing.evaluate(c=>{const t=document.createElement('canvas');t.width=c.width;t.height=c.height;const x=t.getContext('2d');x.drawImage(c,0,0);return {w:c.width,h:c.height,d:Array.from(x.getImageData(0,0,c.width,c.height).data)};});
 const drag=async(x0,y0,x1,y1)=>{await page.mouse.move(box.x+x0,box.y+y0);await page.mouse.down();await page.mouse.move(box.x+x1,box.y+y1,{steps:40});await page.mouse.up();await page.waitForTimeout(900);};
 const cx=box.width/2,cy=box.height/2;
 const toggle=page.getByRole('group',{name:'Paint or Blend'}).first();
 assert.equal(await toggle.getByRole('button',{name:'Paint',exact:true}).getAttribute('aria-pressed'),'true','Paint is the default');
 await drag(cx-260,cy,cx+260,cy);const painted=await pixels();
 await page.mouse.move(box.x+20,box.y+20);await page.keyboard.press('j');await page.waitForTimeout(200);
 assert.equal(await toggle.getByRole('button',{name:'Blend',exact:true}).getAttribute('aria-pressed'),'true','J switches to Blend');
 // Blend stroke crossing the painted stroke, starting on empty paper.
 await drag(cx,cy-200,cx,cy+200);const blended=await pixels();
 const W=painted.w,H=painted.h,sx=W/box.width,sy=H/box.height;let changed=0,emptyChanged=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;const diff=painted.d[i]!==blended.d[i]||painted.d[i+1]!==blended.d[i+1]||painted.d[i+2]!==blended.d[i+2];if(!diff)continue;changed++;
  // well away from the painted stroke (more than 70 css px above/below) nothing may appear
  if(Math.abs(y/sy-cy)>70&&Math.abs(y/sy-cy)<190&&Math.abs(x/sx-cx)<20)emptyChanged++;}
 // Back to Paint with J, and the Blend settings section.
 await page.keyboard.press('j');await page.waitForTimeout(150);assert.equal(await toggle.getByRole('button',{name:'Paint',exact:true}).getAttribute('aria-pressed'),'true','J switches back');
 await page.keyboard.press('j');await page.waitForTimeout(150);
 await page.getByRole('button',{name:'Brush Settings',exact:true}).click();
 await page.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:'Blend',exact:true}).click();
 const panel=page.getByRole('region',{name:'Brush Settings'});
 for(const name of ['Blend Amount','Colour Pickup','Wetness','Mix','Blend Flow','Stretch','Paint Load'])assert.equal(await panel.getByRole('slider',{name,exact:true}).count(),1,name);
 await panel.getByLabel('Blend sample',{exact:true}).selectOption('all');await panel.getByLabel('Clean brush after each stroke',{exact:true}).uncheck();
 await panel.getByRole('button',{name:'Wet mix',exact:true}).click();await page.waitForTimeout(200);
 fs.mkdirSync('validation/brush-blend-v240',{recursive:true});await page.screenshot({path:'validation/brush-blend-v240/blend-settings-panel.png'});
 await panel.getByRole('button',{name:'Done',exact:true}).click().catch(()=>page.keyboard.press('Escape'));
 // A stroke with All layers + carried colour must draw without errors.
 const before2=await pixels();await drag(cx-150,cy-60,cx+150,cy+60);const after2=await pixels();let changed2=0;for(let i=0;i<after2.d.length;i+=4)if(after2.d[i]!==before2.d[i]||after2.d[i+2]!==before2.d[i+2])changed2++;
 // Settings persist after reload.
 await page.waitForTimeout(400);await page.reload();await page.getByLabel('Drawing canvas',{exact:true}).waitFor();await page.waitForTimeout(800);
 const persisted=await page.getByRole('group',{name:'Paint or Blend'}).first().getByRole('button',{name:'Blend',exact:true}).getAttribute('aria-pressed');
 const result={changed,emptyChanged,changed2,persisted,errors};console.log(JSON.stringify(result));
 assert(changed>400,'Blend stroke changed the painted stroke');assert.equal(emptyChanged,0,'Blend added paint on empty paper');assert(changed2>100,'All layers stroke drew');
 assert.equal(persisted,'true','Blend saved with the brush');assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS brush-blend-v240-ui');
}catch(e){failed=true;console.error(e);}finally{await browser?.close();await server.close();}
process.exitCode=failed?1:0;
